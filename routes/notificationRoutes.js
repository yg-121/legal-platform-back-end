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

// Get user notifications
router.get('/notifications', authMiddleware(), async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      user: req.user.id, 
      isAdminNotification: false 
    }).sort({ createdAt: -1 });
    
    res.json(notifications);
  } catch (error) {
    console.error('❌ Fetch Notifications Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Mark notification as read
router.patch('/notifications/:notificationId/read', authMiddleware(), markNotificationAsRead);

// Get unread notification count
router.get('/unread-count', authMiddleware(), async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      user: req.user.id, 
      status: { $ne: "Read" },
      isAdminNotification: req.user.role === 'Admin'
    });
    
    res.json({ count });
  } catch (error) {
    console.error('❌ Fetch Unread Count Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', authMiddleware(), async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, status: { $ne: "Read" } },
      { $set: { status: "Read" } }
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('❌ Mark All Read Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

export default router;
