import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { io } from '../index.js';

export const sendNotification = async (userId, message, type) => {
  try {
    // Handle user-specific notifications
    if (type !== 'new_lawyer') {
      const user = await User.findById(userId);
      if (!user) {
        console.error('User not found for notification');
        return;
      }

      const notification = new Notification({
        user: userId,
        message,
        type,
      });
      await notification.save();
      console.log(`Notification saved for ${user.username}: ${message}`);

      io.to(userId).emit('new_notification', notification.toObject());
    } else {
      // Handle admin notifications for new_lawyer
      const admins = await User.find({ role: 'Admin' });
      for (const admin of admins) {
        const adminNotification = new Notification({
          user: admin._id,
          message,
          type,
          isAdminNotification: true,
        });
        await adminNotification.save();
        console.log(`Notification saved for admin ${admin.username}: ${message}`);

        io.to(admin._id.toString()).emit('new_notification', adminNotification.toObject());
      }
    }
  } catch (error) {
    console.error('Notification error:', error.message);
  }
};