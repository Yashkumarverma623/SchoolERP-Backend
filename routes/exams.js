const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

const getDb = () => {
  const { client } = require('../connect');
  return client.db('school-erp');
};

// Get all exams
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const exams = await db.collection('exams').find({}).toArray();
    res.json(exams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get exam by ID
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const exam = await db.collection('exams').findOne({ _id: new ObjectId(req.params.id) });
    
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    
    res.json(exam);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new exam
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const examData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('exams').insertOne(examData);
    const exam = await db.collection('exams').findOne({ _id: result.insertedId });
    
    res.status(201).json(exam);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update exam
router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    const result = await db.collection('exams').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    
    res.json(result.value);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete exam
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection('exams').deleteOne({ _id: new ObjectId(req.params.id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    
    res.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get exams by class
router.get('/class/:className', async (req, res) => {
  try {
    const db = getDb();
    const exams = await db.collection('exams').find({ class: req.params.className }).toArray();
    res.json(exams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all results
router.get('/results/all', async (req, res) => {
  try {
    const db = getDb();
    const results = await db.collection('examResults').find({}).toArray();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get results by student ID
router.get('/results/student/:studentId', async (req, res) => {
  try {
    const db = getDb();
    const results = await db.collection('examResults').find({ 
      studentId: new ObjectId(req.params.studentId) 
    }).toArray();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get results by exam ID
router.get('/results/exam/:examId', async (req, res) => {
  try {
    const db = getDb();
    const results = await db.collection('examResults').find({ 
      examId: new ObjectId(req.params.examId) 
    }).toArray();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add exam result
router.post('/results', async (req, res) => {
  try {
    const db = getDb();
    const resultData = {
      ...req.body,
      studentId: new ObjectId(req.body.studentId),
      examId: new ObjectId(req.body.examId),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('examResults').insertOne(resultData);
    const examResult = await db.collection('examResults').findOne({ _id: result.insertedId });
    
    res.status(201).json(examResult);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update exam result
router.put('/results/:id', async (req, res) => {
  try {
    const db = getDb();
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    if (req.body.studentId) {
      updateData.studentId = new ObjectId(req.body.studentId);
    }
    if (req.body.examId) {
      updateData.examId = new ObjectId(req.body.examId);
    }
    
    const result = await db.collection('examResults').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ error: 'Result not found' });
    }
    
    res.json(result.value);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete exam result
router.delete('/results/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection('examResults').deleteOne({ _id: new ObjectId(req.params.id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Result not found' });
    }
    
    res.json({ message: 'Result deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate report card for student
router.get('/report-card/:studentId', async (req, res) => {
  try {
    const db = getDb();
    const studentId = new ObjectId(req.params.studentId);
    
    const student = await db.collection('students').findOne({ _id: studentId });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const results = await db.collection('examResults').aggregate([
      { $match: { studentId: studentId } },
      { 
        $lookup: {
          from: 'exams',
          localField: 'examId',
          foreignField: '_id',
          as: 'exam'
        }
      },
      { $unwind: '$exam' },
      { $sort: { 'exam.date': -1 } }
    ]).toArray();
    
    const reportCard = {
      student: student,
      results: results,
      totalMarks: results.reduce((sum, result) => sum + result.marksObtained, 0),
      totalMaxMarks: results.reduce((sum, result) => sum + result.maxMarks, 0),
      averagePercentage: results.length > 0 ? 
        (results.reduce((sum, result) => sum + ((result.marksObtained / result.maxMarks) * 100), 0) / results.length).toFixed(2) 
        : 0
    };
    
    res.json(reportCard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;