import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import Notification from '../models/Notification.js';
import { 
  getNotifications, 
  markNotificationAsRead, 
  getAdminStats,
  markAllNotificationsAsRead 
} from '../controllers/notificationController.js';

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
router.get('/admin/stats', authMiddleware(['Admin']), getAdminStats);
router.patch('/notifications/:notificationId/read', authMiddleware(['Admin']), markNotificationAsRead);

// Add console log to debug route registration
console.log("Registering route: /mark-all-read");

// Add new route for marking all notifications as read
router.patch('/mark-all-read', authMiddleware(['Admin']), (req, res) => {
  console.log("Mark all notifications as read route hit");
  markAllNotificationsAsRead(req, res);
});

export default router;
