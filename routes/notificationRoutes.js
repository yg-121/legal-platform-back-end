import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import Notification from '../models/Notification.js';
import { getNotifications } from '../controllers/notificationController.js';

const router = express.Router();

// Existing: User notifications
router.get('/notifications', authMiddleware(), async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id, isAdminNotification: false }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error('❌ Fetch Notifications Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// New: Admin notifications with counts
router.get('/admin/notifications', authMiddleware(['Admin']), getNotifications);

export default router;