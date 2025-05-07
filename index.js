import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import caseRoutes from './routes/caseRoutes.js';
import bidRoutes from './routes/bidRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import userRoutes from './routes/userRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import { remindPendingRatings } from './controllers/ratingController.js';
import { sendAppointmentReminders } from './controllers/appointmentController.js';
import auditRoutes from './routes/auditRoutes.js';
import path from 'path';
import cron from 'node-cron';
import { fileURLToPath } from 'url';

connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', '*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  // Add path if you're using a specific path
  path: '/socket.io/',
  // Add transport options
  transports: ['polling', 'websocket']
});

// Add more detailed logging for socket connections
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Log authentication information
  console.log('Auth data:', socket.handshake.auth);
  
  // Handle user joining a room
  if (socket.handshake.auth.userId) {
    const userId = socket.handshake.auth.userId;
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  }
  
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api', auditRoutes);

cron.schedule('0 0 * * *', remindPendingRatings);
cron.schedule('0 * * * *', sendAppointmentReminders); // Hourly

app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));
app.use('/templates', express.static(path.join(__dirname, 'templates')));

app.get('/', (req, res) => {
  res.json({ message: '🚀 Server is running!' });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const startServer = async () => {
  try {
    await connectDB();
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

export { io };
