// routes/fees.js
const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

// Get database connection
const getDb = () => {
  const { client } = require('../connect');
  return client.db('school-erp');
};

// Get all fees
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { status, class: className, studentId } = req.query;
    let filter = {};
    
    if (status) filter.status = status;
    if (className) filter.className = className;
    if (studentId) filter.studentId = new ObjectId(studentId);
    
    const fees = await db.collection('fees').find(filter).sort({ dueDate: 1 }).toArray();
    
    // Get student details for each fee record
    const studentIds = fees.map(fee => new ObjectId(fee.studentId));
    const students = await db.collection('students').find({ _id: { $in: studentIds } }).toArray();
    
    // Create student map for quick lookup
    const studentMap = students.reduce((acc, student) => {
      acc[student._id.toString()] = student;
      return acc;
    }, {});
    
    // Populate student data
    const populatedFees = fees.map(fee => ({
      ...fee,
      studentData: studentMap[fee.studentId.toString()] || null
    }));
    
    res.json(populatedFees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get fee by ID
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const fee = await db.collection('fees').findOne({ _id: new ObjectId(req.params.id) });
    
    if (!fee) {
      return res.status(404).json({ error: 'Fee record not found' });
    }
    
    // Get student details
    const student = await db.collection('students').findOne({ _id: new ObjectId(fee.studentId) });
    
    res.json({
      ...fee,
      studentData: student || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new fee record
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const feeData = {
      ...req.body,
      studentId: new ObjectId(req.body.studentId),
      dueDate: new Date(req.body.dueDate),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('fees').insertOne(feeData);
    const fee = await db.collection('fees').findOne({ _id: result.insertedId });
    
    // Get student details
    const student = await db.collection('students').findOne({ _id: new ObjectId(fee.studentId) });
    
    res.status(201).json({
      ...fee,
      studentData: student || null
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update fee record
router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    if (req.body.studentId) {
      updateData.studentId = new ObjectId(req.body.studentId);
    }
    
    if (req.body.dueDate) {
      updateData.dueDate = new Date(req.body.dueDate);
    }
    
    const result = await db.collection('fees').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ error: 'Fee record not found' });
    }
    
    // Get student details
    const student = await db.collection('students').findOne({ _id: new ObjectId(result.value.studentId) });
    
    res.json({
      ...result.value,
      studentData: student || null
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Mark fee as paid
router.patch('/:id/pay', async (req, res) => {
  try {
    const db = getDb();
    const { paymentMethod, transactionId, paidAmount } = req.body;
    
    const updateData = {
      status: 'paid',
      paidDate: new Date(),
      paymentMethod,
      transactionId,
      updatedAt: new Date()
    };
    
    if (paidAmount) {
      updateData.paidAmount = paidAmount;
    }
    
    const result = await db.collection('fees').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ error: 'Fee record not found' });
    }
    
    // Get student details
    const student = await db.collection('students').findOne({ _id: new ObjectId(result.value.studentId) });
    
    res.json({
      ...result.value,
      studentData: student || null
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get fee statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const db = getDb();
    
    // Get counts
    const totalFees = await db.collection('fees').countDocuments();
    const paidFees = await db.collection('fees').countDocuments({ status: 'paid' });
    const pendingFees = await db.collection('fees').countDocuments({ status: 'pending' });
    const overdueFees = await db.collection('fees').countDocuments({ 
      status: 'pending', 
      dueDate: { $lt: new Date() } 
    });
    
    // Get amount aggregations
    const totalAmountResult = await db.collection('fees').aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    
    const paidAmountResult = await db.collection('fees').aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    
    const totalAmount = totalAmountResult[0]?.total || 0;
    const paidAmount = paidAmountResult[0]?.total || 0;
    
    res.json({
      totalFees,
      paidFees,
      pendingFees,
      overdueFees,
      totalAmount,
      paidAmount,
      pendingAmount: totalAmount - paidAmount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get class-wise fee summary
router.get('/stats/class', async (req, res) => {
  try {
    const db = getDb();
    
    const classStats = await db.collection('fees').aggregate([
      {
        $group: {
          _id: '$className',
          totalFees: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          paidFees: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          },
          paidAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] }
          },
          pendingFees: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          overdueFees: {
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $eq: ['$status', 'pending'] },
                    { $lt: ['$dueDate', new Date()] }
                  ]
                }, 
                1, 
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          className: '$_id',
          totalFees: 1,
          totalAmount: 1,
          paidFees: 1,
          paidAmount: 1,
          pendingFees: 1,
          pendingAmount: { $subtract: ['$totalAmount', '$paidAmount'] },
          overdueFees: 1,
          collectionRate: {
            $round: [
              { $multiply: [{ $divide: ['$paidAmount', '$totalAmount'] }, 100] },
              2
            ]
          }
        }
      },
      { $sort: { className: 1 } }
    ]).toArray();
    
    res.json(classStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete fee record
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection('fees').deleteOne({ _id: new ObjectId(req.params.id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Fee record not found' });
    }
    
    res.json({ message: 'Fee record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;