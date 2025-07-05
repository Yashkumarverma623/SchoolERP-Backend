// routes/attendance.js
const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

// Get database connection
const getDb = () => {
  const { client } = require('../connect');
  return client.db('school-erp');
};

// Get attendance by date
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { date, class: className } = req.query;
    let filter = {};
    
    if (date) {
      const queryDate = new Date(date);
      filter.date = {
        $gte: new Date(queryDate.setHours(0, 0, 0, 0)),
        $lt: new Date(queryDate.setHours(23, 59, 59, 999))
      };
    }
    
    if (className) {
      filter.className = className;
    }
    
    const attendanceRecords = await db.collection('attendance').find(filter).toArray();
    
    // Get student details for each attendance record
    const studentIds = attendanceRecords.map(record => new ObjectId(record.studentId));
    const students = await db.collection('students').find({ _id: { $in: studentIds } }).toArray();
    
    // Create a map for quick lookup
    const studentMap = students.reduce((acc, student) => {
      acc[student._id.toString()] = student;
      return acc;
    }, {});
    
    // Populate student data
    const populatedRecords = attendanceRecords.map(record => ({
      ...record,
      studentData: studentMap[record.studentId.toString()] || null
    }));
    
    // Group by class and calculate stats
    const groupedAttendance = populatedRecords.reduce((acc, record) => {
      const className = record.className;
      if (!acc[className]) {
        acc[className] = { present: 0, absent: 0, total: 0 };
      }
      acc[className].total++;
      if (record.status === 'present') {
        acc[className].present++;
      } else {
        acc[className].absent++;
      }
      return acc;
    }, {});

    const result = Object.keys(groupedAttendance).map(className => ({
      className,
      present: groupedAttendance[className].present,
      absent: groupedAttendance[className].absent,
      attendanceRate: Math.round((groupedAttendance[className].present / groupedAttendance[className].total) * 100)
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance records with details
router.get('/records', async (req, res) => {
  try {
    const db = getDb();
    const { date, class: className, studentId } = req.query;
    let filter = {};
    
    if (date) {
      const queryDate = new Date(date);
      filter.date = {
        $gte: new Date(queryDate.setHours(0, 0, 0, 0)),
        $lt: new Date(queryDate.setHours(23, 59, 59, 999))
      };
    }
    
    if (className) filter.className = className;
    if (studentId) filter.studentId = new ObjectId(studentId);
    
    const attendanceRecords = await db.collection('attendance').find(filter).toArray();
    
    // Get student details
    const studentIds = attendanceRecords.map(record => new ObjectId(record.studentId));
    const students = await db.collection('students').find({ _id: { $in: studentIds } }).toArray();
    
    const studentMap = students.reduce((acc, student) => {
      acc[student._id.toString()] = student;
      return acc;
    }, {});
    
    const populatedRecords = attendanceRecords.map(record => ({
      ...record,
      studentData: studentMap[record.studentId.toString()] || null
    }));
    
    res.json(populatedRecords);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark attendance
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const attendanceData = {
      ...req.body,
      studentId: new ObjectId(req.body.studentId),
      date: new Date(req.body.date),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('attendance').insertOne(attendanceData);
    const attendance = await db.collection('attendance').findOne({ _id: result.insertedId });
    
    res.status(201).json(attendance);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Mark bulk attendance
router.post('/bulk', async (req, res) => {
  try {
    const db = getDb();
    const { attendanceRecords } = req.body;
    
    const formattedRecords = attendanceRecords.map(record => ({
      ...record,
      studentId: new ObjectId(record.studentId),
      date: new Date(record.date),
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    const result = await db.collection('attendance').insertMany(formattedRecords);
    res.status(201).json({ message: 'Bulk attendance marked successfully', insertedCount: result.insertedCount });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update attendance
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
    
    if (req.body.date) {
      updateData.date = new Date(req.body.date);
    }
    
    const result = await db.collection('attendance').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    res.json(result.value);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete attendance record
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection('attendance').deleteOne({ _id: new ObjectId(req.params.id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get attendance statistics
router.get('/stats', async (req, res) => {
  try {
    const db = getDb();
    const { startDate, endDate, class: className } = req.query;
    
    let filter = {};
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (className) filter.className = className;
    
    const stats = await db.collection('attendance').aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$className',
          totalRecords: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          className: '$_id',
          totalRecords: 1,
          presentCount: 1,
          absentCount: 1,
          attendanceRate: {
            $round: [
              { $multiply: [{ $divide: ['$presentCount', '$totalRecords'] }, 100] },
              2
            ]
          }
        }
      }
    ]).toArray();
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;