import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import dotenv from 'dotenv';
import pool from './db/connection.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import studentsRouter from './routes/students.js';
import instituteRouter from './routes/institute.js';
import quranRouter from './routes/quran.js';
import attendanceRouter from './routes/attendance.js';
import examsRouter from './routes/exams.js';
import financeRouter from './routes/finance.js';
import reportsRouter from './routes/reports.js';
import dashboardRouter from './routes/dashboard.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// MySQL Session Store configuration
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  clearExpired: true,
  checkExpirationInterval: 900000, // 15 mins
  expiration: 86400000, // 1 day
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, pool);

// Trust first proxy if running behind reverse proxy
if (isProduction) {
  app.set('trust proxy', 1);
}

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Server-managed sessions with HTTP-only cookies
app.use(session({
  name: 'mahad_sid',
  secret: process.env.SESSION_SECRET || 'mahad_session_secret_default_key_2026',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction, // HTTPS in production
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Basic request logging
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// API Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/students', studentsRouter);
app.use('/api/institute', instituteRouter);
app.use('/api/quran', quranRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/exams', examsRouter);
app.use('/api/finance', financeRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/dashboard', dashboardRouter);

// 404 & Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test' && !process.argv[1]?.includes('test')) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`   معهد التفسير للعلوم الشرعية والعربية - API Server`);
    console.log(`   Server running on: http://localhost:${PORT}`);
    console.log(`   Health check on:   http://localhost:${PORT}/api/health`);
    console.log(`   Environment:       ${process.env.NODE_ENV || 'development'}`);
    console.log(`=======================================================`);
  });
}

export default app;
