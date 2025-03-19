import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import caseRoutes from './routes/caseRoutes.js';
import bidRoutes from './routes/bidRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import userRoutes from './routes/userRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import auditRoutes from './routes/auditRoutes.js'
// import authMiddleware from '../middlewares/authMiddleware.js';
import path from 'path';
import { fileURLToPath } from 'url'; // Add this import


connectDB();

const app = express();

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(authMiddleware);
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api', auditRoutes);

// Serve static files from 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
    res.json({ message: "🚀 Server is running!" });
});

app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

const startServer = async () => {
    try {
        await connectDB();
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));
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