// routes/timetable.js
const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

// Get database connection
const getDb = () => {
  const { client } = require('../connect');
  return client.db('school-erp');
};

// Get timetable by class and day
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { class: className, day } = req.query;
    let filter = {};
    
    if (className) filter.className = className;
    if (day) filter.day = day;
    
    const timetable = await db.collection('timetable').find(filter)
      .sort({ day: 1, startTime: 1 })
      .toArray();
    
    // Get teacher details for each timetable entry
    const teacherIds = timetable.map(entry => new ObjectId(entry.teacherId)).filter(id => id);
    const teachers = await db.collection('teachers').find({ _id: { $in: teacherIds } }).toArray();
    
    const teacherMap = teachers.reduce((acc, teacher) => {
      acc[teacher._id.toString()] = teacher;
      return acc;
    }, {});
    
    const populatedTimetable = timetable.map(entry => ({
      ...entry,
      teacherData: teacherMap[entry.teacherId?.toString()] || null
    }));
    
    res.json(populatedTimetable);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get timetable by ID
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const timetable = await db.collection('timetable').findOne({ _id: new ObjectId(req.params.id) });
    
    if (!timetable) {
      return res.status(404).json({ error: 'Timetable entry not found' });
    }
    
    // Get teacher details
    let teacherData = null;
    if (timetable.teacherId) {
      teacherData = await db.collection('teachers').findOne({ _id: new ObjectId(timetable.teacherId) });
    }
    
    res.json({
      ...timetable,
      teacherData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new timetable entry
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const { className, day, startTime, endTime, teacherId } = req.body;
    
    // Check for time conflicts
    const conflictingEntry = await db.collection('timetable').findOne({
      className: className,
      day: day,
      $or: [
        {
          $and: [
            { startTime: { $lt: endTime } },
            { endTime: { $gt: startTime } }
          ]
        }
      ]
    });
    
    if (conflictingEntry) {
      return res.status(400).json({ error: 'Time slot conflict detected' });
    }
    
    const timetableData = {
      ...req.body,
      teacherId: teacherId ? new ObjectId(teacherId) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('timetable').insertOne(timetableData);
    const timetable = await db.collection('timetable').findOne({ _id: result.insertedId });
    
    // Get teacher details
    let teacherData = null;
    if (timetable.teacherId) {
      teacherData = await db.collection('teachers').findOne({ _id: new ObjectId(timetable.teacherId) });
    }
    
    res.status(201).json({
      ...timetable,
      teacherData
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update timetable entry
router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    if (req.body.teacherId) {
      updateData.teacherId = new ObjectId(req.body.teacherId);
    }
    
    const result = await db.collection('timetable').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ error: 'Timetable entry not found' });
    }
    
    // Get teacher details
    let teacherData = null;
    if (result.value.teacherId) {
      teacherData = await db.collection('teachers').findOne({ _id: new ObjectId(result.value.teacherId) });
    }
    
    res.json({
      ...result.value,
      teacherData
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete timetable entry
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection('timetable').deleteOne({ _id: new ObjectId(req.params.id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Timetable entry not found' });
    }
    
    res.json({ message: 'Timetable entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get weekly timetable for a class
router.get('/weekly/:className', async (req, res) => {
  try {
    const db = getDb();
    const { className } = req.params;
    
    const weeklyTimetable = await db.collection('timetable').find({ className: className })
      .sort({ day: 1, startTime: 1 })
      .toArray();
    
    // Get teacher details
    const teacherIds = weeklyTimetable.map(entry => new ObjectId(entry.teacherId)).filter(id => id);
    const teachers = await db.collection('teachers').find({ _id: { $in: teacherIds } }).toArray();
    
    const teacherMap = teachers.reduce((acc, teacher) => {
      acc[teacher._id.toString()] = teacher;
      return acc;
    }, {});
    
    // Group by day
    const groupedTimetable = weeklyTimetable.reduce((acc, entry) => {
      if (!acc[entry.day]) {
        acc[entry.day] = [];
      }
      acc[entry.day].push({
        ...entry,
        teacherData: teacherMap[entry.teacherId?.toString()] || null
      });
      return acc;
    }, {});
    
    res.json(groupedTimetable);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get teacher's timetable
router.get('/teacher/:teacherId', async (req, res) => {
  try {
    const db = getDb();
    const { teacherId } = req.params;
    
    const teacherTimetable = await db.collection('timetable').find({ teacherId: new ObjectId(teacherId) })
      .sort({ day: 1, startTime: 1 })
      .toArray();
    
    // Get teacher details
    const teacher = await db.collection('teachers').findOne({ _id: new ObjectId(teacherId) });
    
    res.json({
      teacher,
      timetable: teacherTimetable
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all classes with their timetables
router.get('/all/classes', async (req, res) => {
  try {
    const db = getDb();
    
    const allTimetables = await db.collection('timetable').find()
      .sort({ className: 1, day: 1, startTime: 1 })
      .toArray();
    
    // Get teacher details
    const teacherIds = allTimetables.map(entry => new ObjectId(entry.teacherId)).filter(id => id);
    const teachers = await db.collection('teachers').find({ _id: { $in: teacherIds } }).toArray();
    
    const teacherMap = teachers.reduce((acc, teacher) => {
      acc[teacher._id.toString()] = teacher;
      return acc;
    }, {});
    
    // Group by class
    const groupedByClass = allTimetables.reduce((acc, entry) => {
      if (!acc[entry.className]) {
        acc[entry.className] = {};
      }
      if (!acc[entry.className][entry.day]) {
        acc[entry.className][entry.day] = [];
      }
      acc[entry.className][entry.day].push({
        ...entry,
        teacherData: teacherMap[entry.teacherId?.toString()] || null
      });
      return acc;
    }, {});
    
    res.json(groupedByClass);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;