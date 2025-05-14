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
     import fs from 'fs';
     import statisticsRoutes from './routes/statisticsRoutes.js';

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
       path: '/socket.io/',
       transports: ['polling', 'websocket']
     });

     io.on('connection', (socket) => {
       console.log('Client connected:', socket.id);
       console.log('Auth data:', socket.handshake.auth);
       if (socket.handshake.auth.userId) {
         const userId = socket.handshake.auth.userId;
         socket.join(userId);
         console.log(`User ${userId} joined their room`);
       }
       socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
     });

     const __filename = fileURLToPath(import.meta.url);
     const __dirname = path.dirname(__filename);
     console.log(`Project directory: ${__dirname}`);
     console.log(`Uploads directory: /D/s/b/Uploads`);

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
     app.use('/api/statistics', statisticsRoutes);

     cron.schedule('0 0 * * *', remindPendingRatings);
     cron.schedule('0 * * * *', sendAppointmentReminders);

     // Log requests to /uploads and check file existence
     app.use('/uploads', (req, res, next) => {
       const filePath = path.join(__dirname, 'uploads', req.path);
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
     }, express.static(path.join(__dirname, 'uploads')));

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
