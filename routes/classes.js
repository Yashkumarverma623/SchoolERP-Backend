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
    const classes = await db.collection('classes').find({}).toArray();
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const classData = await db.collection('classes').findOne({ _id: new ObjectId(req.params.id) });
    
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    res.json(classData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/name/:name', async (req, res) => {
  try {
    const db = getDb();
    const classData = await db.collection('classes').findOne({ name: req.params.name });
    
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    res.json(classData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const classData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('classes').insertOne(classData);
    const newClass = await db.collection('classes').findOne({ _id: result.insertedId });
    
    res.status(201).json(newClass);
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
    
    const result = await db.collection('classes').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    res.json(result.value);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection('classes').deleteOne({ _id: new ObjectId(req.params.id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/grade/:grade', async (req, res) => {
  try {
    const db = getDb();
    const classes = await db.collection('classes').find({ grade: req.params.grade }).toArray();
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/section/:section', async (req, res) => {
  try {
    const db = getDb();
    const classes = await db.collection('classes').find({ section: req.params.section }).toArray();
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/students', async (req, res) => {
  try {
    const db = getDb();
    const classData = await db.collection('classes').findOne({ _id: new ObjectId(req.params.id) });
    
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const students = await db.collection('students').find({ class: classData.name }).toArray();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/name/:name/students', async (req, res) => {
  try {
    const db = getDb();
    const students = await db.collection('students').find({ class: req.params.name }).toArray();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/timetable', async (req, res) => {
  try {
    const db = getDb();
    const classData = await db.collection('classes').findOne({ _id: new ObjectId(req.params.id) });
    
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const timetable = await db.collection('timetable').find({ className: classData.name }).toArray();
    res.json(timetable);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/name/:name/timetable', async (req, res) => {
  try {
    const db = getDb();
    const timetable = await db.collection('timetable').find({ className: req.params.name }).toArray();
    res.json(timetable);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/teacher', async (req, res) => {
  try {
    const db = getDb();
    const { teacherId } = req.body;
    
    const result = await db.collection('classes').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { 
        $set: { 
          classTeacher: teacherId,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    res.json(result.value);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/stats', async (req, res) => {
  try {
    const db = getDb();
    const classData = await db.collection('classes').findOne({ _id: new ObjectId(req.params.id) });
    
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const studentCount = await db.collection('students').countDocuments({ class: classData.name });
    const timetableCount = await db.collection('timetable').countDocuments({ className: classData.name });
    
    const stats = {
      className: classData.name,
      totalStudents: studentCount,
      totalSchedules: timetableCount,
      grade: classData.grade,
      section: classData.section,
      classTeacher: classData.classTeacher
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/search/:query', async (req, res) => {
  try {
    const db = getDb();
    const query = req.params.query;
    
    const classes = await db.collection('classes').find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { grade: { $regex: query, $options: 'i' } },
        { section: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    }).toArray();
    
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;