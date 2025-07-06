const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

const getDb = () => {
  const { client } = require('../connect');
  return client.db('school-erp');
};

router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const teachers = await db.collection('teachers').find({}).toArray();
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const teacher = await db.collection('teachers').findOne({ _id: new ObjectId(req.params.id) });
    
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    res.json(teacher);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const teacherData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('teachers').insertOne(teacherData);
    const teacher = await db.collection('teachers').findOne({ _id: result.insertedId });
    
    res.status(201).json(teacher);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    const result = await db.collection('teachers').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    res.json(result.value);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection('teachers').deleteOne({ _id: new ObjectId(req.params.id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    res.json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/department/:department', async (req, res) => {
  try {
    const db = getDb();
    const teachers = await db.collection('teachers').find({ department: req.params.department }).toArray();
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/subject/:subject', async (req, res) => {
  try {
    const db = getDb();
    const teachers = await db.collection('teachers').find({ 
      subjects: { $in: [req.params.subject] } 
    }).toArray();
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/search/:query', async (req, res) => {
  try {
    const db = getDb();
    const query = req.params.query;
    
    const teachers = await db.collection('teachers').find({
      $or: [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { employeeId: { $regex: query, $options: 'i' } },
        { department: { $regex: query, $options: 'i' } },
        { subjects: { $in: [new RegExp(query, 'i')] } }
      ]
    }).toArray();
    
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/timetable', async (req, res) => {
  try {
    const db = getDb();
    const timetable = await db.collection('timetable').find({ 
      teacherId: req.params.id 
    }).toArray();
    
    res.json(timetable);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/availability', async (req, res) => {
  try {
    const db = getDb();
    const { availability } = req.body;
    
    const result = await db.collection('teachers').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { 
        $set: { 
          availability: availability,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    res.json(result.value);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;