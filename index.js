import dotenv from "dotenv";
dotenv.config();
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import caseRoutes from './routes/caseRoutes.js';
import bidRoutes from './routes/bidRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import userRoutes from './routes/userRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import statisticsRoutes from './routes/statisticsRoutes.js';
import { remindPendingRatings } from './controllers/ratingController.js';
import { sendAppointmentReminders } from './controllers/appointmentController.js';
import path from 'path';
import cron from 'node-cron';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, 'Uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('Created Uploads directory');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  path: '/socket.io',
  transports: ['websocket', 'polling'],
});

io.use((socket, next) => {
  const { token, userId } = socket.handshake.auth;
  if (!token || !userId) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Socket Auth Error: Missing token or userId');
    }
    return next(new Error('Authentication error: Missing token or userId'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (process.env.NODE_ENV === 'development') {
      console.log('Socket Auth Decoded:', decoded);
    }
    if (decoded.id !== userId) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Socket Auth Error: Invalid userId');
      }
      return next(new Error('Authentication error: Invalid userId'));
    }
    socket.user = decoded;
    next();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Socket Auth Error:', error.message);
    }
    return next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id, 'Namespace:', socket.nsp.name);
  console.log('Auth data:', socket.handshake.auth);
  const userId = socket.user.id;
  socket.join(userId);
  console.log(`User ${userId} joined room ${userId}`);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.use(cors({
  origin: ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/socket.io/*', (req, res, next) => {
  console.log('Serving Socket.IO script:', req.originalUrl);
  next();
});

app.use('/Uploads', (req, res, next) => {
  const filePath = path.join(__dirname, 'Uploads', req.path);
  console.log(`Request for file: ${req.originalUrl}`);
  console.log(`Resolved file path: ${filePath}`);
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.log(`File does not exist: ${filePath}`);
      res.status(404).json({ message: `File not found: ${req.originalUrl}` });
    } else {
      console.log(`File exists: ${filePath}`);
      next();
    }
  });
}, express.static(uploadDir));

app.use('/templates', express.static(path.join(__dirname, 'templates')));

app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/statistics', statisticsRoutes);

app.get("/", (req, res) => {
  res.json({ message: "🚀 Server is running!" });
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

cron.schedule('0 0 * * *', remindPendingRatings);
cron.schedule('0 * * * *', sendAppointmentReminders);

const startServer = async () => {
  try {
    await connectDB();
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🔥 Server running on port ${PORT}`);
      console.log(`Project directory: ${__dirname}`);
      console.log(`Uploads directory: ${uploadDir}`);
      console.log('Environment:', {
        MONGO_URI: process.env.MONGO_URI,
        JWT_SECRET: process.env.JWT_SECRET,
        PORT: process.env.PORT,
      });
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is in use. Try a different port or terminate the process using it.`);
        console.error(`Run: lsof -i :${PORT} to find the process, then kill -9 <PID>`);
      } else {
        console.error('Server error:', err.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

export { io };