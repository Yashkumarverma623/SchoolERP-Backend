const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');


dotenv.config();

const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const timetableRoutes = require('./routes/timetable');
const feeRoutes = require('./routes/fees');
const noticeRoutes = require('./routes/notices');
const dashboardRoutes = require('./routes/dashboard');


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const mongoURI = process.env.MONGODB_URI

// Routes
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/dashboard', dashboardRoutes);

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB successfully');

})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Connection error:'));
db.on('disconnected', () => {
  console.log('MongoDB disconnected');
});



app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});