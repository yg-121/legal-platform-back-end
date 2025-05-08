import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Case from "../models/Case.js";
import { io } from "../socket.js";

// Add this function to get admin notifications
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      isAdminNotification: true 
    }).sort({ createdAt: -1 });

    // Get stats for the admin dashboard
    const totalUsers = await User.countDocuments();
    const lawyers = await User.countDocuments({ role: "Lawyer" });
    const pendingLawyers = await User.countDocuments({ role: "Lawyer", status: "Pending" });
    const totalCases = await Case.countDocuments();

    console.log("✅ Fetched Admin Notifications and Stats");

    res.json({
      notifications,
      counts: {
        totalUsers,
        lawyers,
        pendingLawyers,
        totalCases,
      }
    });
  } catch (error) {
    console.error("❌ Fetch Admin Notifications Error:", error.message);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const lawyers = await User.countDocuments({ role: "Lawyer" });
    const pendingLawyers = await User.countDocuments({ role: "Lawyer", status: "Pending" });
    const totalCases = await Case.countDocuments();

    console.log("✅ Fetched Stats:", { totalUsers, lawyers, pendingLawyers, totalCases });

    res.json({
      totalUsers,
      lawyers,
      pendingLawyers,
      totalCases,
    });
  } catch (error) {
    console.error("❌ Fetch Stats Error:", error.message);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if the notification belongs to the user
    if (notification.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    notification.status = 'Read';
    await notification.save();
    
    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('❌ Mark Notification Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Add more debugging to the controller function
export const markAllNotificationsAsRead = async (req, res) => {
  console.log("markAllNotificationsAsRead controller function called");
  try {
    console.log("User ID:", req.user.id);
    console.log("User role:", req.user.role);
    
    // For admin users, mark all admin notifications as read
    console.log("Updating notifications with query:", { isAdminNotification: true, status: "Unread" });
    const result = await Notification.updateMany(
      { isAdminNotification: true, status: "Unread" },
      { $set: { status: "Read" } }
    );
    
    console.log("✅ All admin notifications marked as read:", result);
    return res.json({ 
      message: "All admin notifications marked as read",
      updated: result.modifiedCount
    });
  } catch (error) {
    console.error("❌ Mark All Notifications Read Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const sendNotification = async (userId, message, type, data = {}) => {
  try {
    const notification = new Notification({
      user: userId,
      message,
      type,
      data,
      status: 'Unread'
    });
    
    await notification.save();
    
    // Emit to the user's specific room
    io.to(`user:${userId}`).emit('new_notification', notification);
    
    return notification;
  } catch (error) {
    console.error('❌ Send Notification Error:', error.message);
    return null;
  }
};
