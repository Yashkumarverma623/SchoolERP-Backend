const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

const getDb = () => {
  const { client } = require('../connect');
  return client.db('school-erp');
};

// Get all students
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const students = await db.collection('students').find({}).toArray();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get student by ID
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const student = await db.collection('students').findOne({ _id: new ObjectId(req.params.id) });
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new student
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const studentData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('students').insertOne(studentData);
    const student = await db.collection('students').findOne({ _id: result.insertedId });
    
    res.status(201).json(student);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update student
router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    const result = await db.collection('students').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json(result.value);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete student
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection('students').deleteOne({ _id: new ObjectId(req.params.id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get students by class
router.get('/class/:className', async (req, res) => {
  try {
    const db = getDb();
    const students = await db.collection('students').find({ class: req.params.className }).toArray();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search students
router.get('/search/:query', async (req, res) => {
  try {
    const db = getDb();
    const query = req.params.query;
    
    const students = await db.collection('students').find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { rollNo: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).toArray();
    
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;