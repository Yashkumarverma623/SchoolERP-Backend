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
const examsRoutes = require('./routes/exams');


const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: [
    'https://schoolerp-backend.onrender.com',
    'http://localhost:3000',
    'http://localhost:5173', // Default Vite dev server port
    'http://localhost:4173', // Default Vite preview port
  ],
  credentials: true, // Allow cookies and auth headers
  optionsSuccessStatus: 200, // For legacy browser support
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ]
};

app.use(cors(corsOptions));
app.use(express.json());

const mongoURI = process.env.MONGODB_URI

// Routes
app.use('/students', studentRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/timetable', timetableRoutes);
app.use('/fees', feeRoutes);
app.use('/notices', noticeRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/exams', examsRoutes);

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
  console.log(`CORS enabled for origins: ${corsOptions.origin.join(', ')}`);
});