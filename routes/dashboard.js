const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

const getDb = () => {
  const { client } = require('../connect');
  return client.db('school-erp');
};

router.get('/stats', async (req, res) => {
  try {
    const db = getDb();
    
    const totalStudents = await db.collection('students').countDocuments();
    
    const totalStaff = await db.collection('teachers').countDocuments();
    
    const totalClasses = await db.collection('classes').countDocuments();
    
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const todayAttendance = await db.collection('attendance').find({
      date: { $gte: startOfDay, $lte: endOfDay }
    }).toArray();
    
    const presentToday = todayAttendance.filter(record => record.status === 'present').length;
    const attendanceRate = todayAttendance.length > 0 ? Math.round((presentToday / todayAttendance.length) * 100) : 0;
    
    const totalFeesResult = await db.collection('fees').aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    
    const paidFeesResult = await db.collection('fees').aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    
    const pendingFeesCount = await db.collection('fees').countDocuments({ status: 'pending' });
    
    const pendingFeesResult = await db.collection('fees').aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    
    const overdueFeesCount = await db.collection('fees').countDocuments({ 
      status: 'pending', 
      dueDate: { $lt: new Date() } 
    });
    
    const recentNotices = await db.collection('notices').find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    
    const classDistribution = await db.collection('students').aggregate([
      { $group: { _id: '$class', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    const monthlyFeeCollection = await db.collection('fees').aggregate([
      { $match: { status: 'paid', paidDate: { $exists: true } } },
      {
        $group: {
          _id: {
            year: { $year: '$paidDate' },
            month: { $month: '$paidDate' }
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]).toArray();
    
    res.json({
      totalStudents,
      totalStaff,
      totalClasses,
      attendanceRate,
      presentToday,
      absentToday: todayAttendance.length - presentToday,
      totalFeesAmount: totalFeesResult[0]?.total || 0,
      paidFeesAmount: paidFeesResult[0]?.total || 0,
      pendingFeesCount,
      pendingFees: pendingFeesResult[0]?.total || 0, 
      overdueFeesCount,
      recentNotices,
      classDistribution: classDistribution.map(item => ({
        className: item._id,
        count: item.count
      })),
      monthlyFeeCollection: monthlyFeeCollection.map(item => ({
        month: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
        amount: item.totalAmount,
        count: item.count
      }))
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/activities', async (req, res) => {
  try {
    const db = getDb();
    const { limit = 10 } = req.query;
    
    const recentAttendance = await db.collection('attendance').find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    const studentIds = recentAttendance.map(record => new ObjectId(record.studentId));
    const students = await db.collection('students').find({ _id: { $in: studentIds } }).toArray();
    
    const studentMap = students.reduce((acc, student) => {
      acc[student._id.toString()] = student;
      return acc;
    }, {});
    
    const recentPayments = await db.collection('fees').find({ status: 'paid' })
      .sort({ paidDate: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    const paymentStudentIds = recentPayments.map(payment => new ObjectId(payment.studentId));
    const paymentStudents = await db.collection('students').find({ _id: { $in: paymentStudentIds } }).toArray();
    
    const paymentStudentMap = paymentStudents.reduce((acc, student) => {
      acc[student._id.toString()] = student;
      return acc;
    }, {});
    
    const attendanceActivities = recentAttendance.map(record => {
      const student = studentMap[record.studentId.toString()];
      return {
        type: 'attendance',
        message: `${student?.name || 'Unknown'} (${student?.rollNo || 'N/A'}) marked ${record.status}`,
        date: record.date,
        timestamp: record.createdAt,
        class: student?.class
      };
    });
    
    const paymentActivities = recentPayments.map(payment => {
      const student = paymentStudentMap[payment.studentId.toString()];
      return {
        type: 'payment',
        message: `${student?.name || 'Unknown'} (${student?.rollNo || 'N/A'}) paid ₹${payment.amount}`,
        date: payment.paidDate,
        timestamp: payment.paidDate,
        class: student?.class
      };
    });
    
    const allActivities = [...attendanceActivities, ...paymentActivities]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));
    
    res.json(allActivities);
  } catch (error) {
    console.error('Dashboard activities error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/attendance-overview', async (req, res) => {
  try {
    const db = getDb();
    const { days = 7 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const attendanceOverview = await db.collection('attendance').aggregate([
      {
        $match: {
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          present: {
            $sum: { $cond: [{ $eq: ['$_id.status', 'present'] }, '$count', 0] }
          },
          absent: {
            $sum: { $cond: [{ $eq: ['$_id.status', 'absent'] }, '$count', 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    res.json(attendanceOverview);
  } catch (error) {
    console.error('Attendance overview error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/fee-overview', async (req, res) => {
  try {
    const db = getDb();
    
    const feeOverview = await db.collection('fees').aggregate([
      {
        $group: {
          _id: '$className',
          totalAmount: { $sum: '$amount' },
          paidAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] }
          },
          pendingAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] }
          },
          totalCount: { $sum: 1 },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          className: '$_id',
          totalAmount: 1,
          paidAmount: 1,
          pendingAmount: 1,
          totalCount: 1,
          paidCount: 1,
          pendingCount: 1,
          collectionPercentage: {
            $round: [
              { $multiply: [{ $divide: ['$paidAmount', '$totalAmount'] }, 100] },
              2
            ]
          }
        }
      },
      { $sort: { className: 1 } }
    ]).toArray();
    
    res.json(feeOverview);
  } catch (error) {
    console.error('Fee overview error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;