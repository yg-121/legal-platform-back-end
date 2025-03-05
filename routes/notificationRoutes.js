import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import Notification from '../models/Notification.js';

const router = express.Router();

router.get('/notifications', authMiddleware(), async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(notifications);
    } catch (error) {
        console.error('❌ Fetch Notifications Error:', error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

export default router;