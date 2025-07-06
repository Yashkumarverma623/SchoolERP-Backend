routes/notices.js
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
    const { type, class: className, active, priority } = req.query;
    let filter = {};
    
    if (type) filter.type = type;
    if (className) filter.targetClass = className;
    if (active === 'true') filter.isActive = true;
    if (priority) filter.priority = priority;
    
    const notices = await db.collection('notices').find(filter)
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(notices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const notice = await db.collection('notices').findOne({ _id: new ObjectId(req.params.id) });
    
    if (!notice) {
      return res.status(404).json({ error: 'Notice not found' });
    }
    
    res.json(notice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const noticeData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: req.body.isActive !== undefined ? req.body.isActive : true
    };
    
    const result = await db.collection('notices').insertOne(noticeData);
    const notice = await db.collection('notices').findOne({ _id: result.insertedId });
    
    res.status(201).json(notice);
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
    
    const result = await db.collection('notices').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!result.value) {
      return res.status(404).json({ error: 'Notice not found' });
    }
    
    res.json(result.value);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    const db = getDb();
    const notice = await db.collection('notices').findOne({ _id: new ObjectId(req.params.id) });
    
    if (!notice) {
      return res.status(404).json({ error: 'Notice not found' });
    }
    
    const result = await db.collection('notices').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { isActive: !notice.isActive, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    
    res.json(result.value);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.collection('notices').deleteOne({ _id: new ObjectId(req.params.id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Notice not found' });
    }
    
    res.json({ message: 'Notice deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/type/:type', async (req, res) => {
  try {
    const db = getDb();
    const notices = await db.collection('notices').find({ 
      type: req.params.type,
      isActive: true 
    })
    .sort({ createdAt: -1 })
    .toArray();
    
    res.json(notices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/class/:className', async (req, res) => {
  try {
    const db = getDb();
    const notices = await db.collection('notices').find({ 
      $or: [
        { targetClass: req.params.className },
        { targetClass: 'all' }
      ],
      isActive: true 
    })
    .sort({ priority: -1, createdAt: -1 })
    .toArray();
    
    res.json(notices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;