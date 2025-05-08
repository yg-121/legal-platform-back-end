import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Case from "../models/Case.js";
import { io } from "../socket.js";

// Add this function to get admin notifications
export const getNotifications = async (req, res) => {
  try {
    console.log("getNotifications called for user:", req.user.id);
    
    // Get all admin notifications for this user
    const notifications = await Notification.find({ 
      isAdminNotification: true,
      user: req.user.id
    }).sort({ createdAt: -1 });
    
    console.log(`Found ${notifications.length} notifications for user ${req.user.id}`);

    // Count unread notifications with explicit logging
    console.log("Counting unread notifications with query:", {
      isAdminNotification: true,
      user: req.user.id,
      status: "Unread"
    });
    
    const unreadCount = await Notification.countDocuments({
      isAdminNotification: true,
      user: req.user.id,
      status: "Unread"
    });
    
    console.log(`Unread notification count for user ${req.user.id}: ${unreadCount}`);

    // Get other stats
    const totalUsers = await User.countDocuments();
    const lawyers = await User.countDocuments({ role: "Lawyer" });
    const pendingLawyers = await User.countDocuments({ role: "Lawyer", status: "Pending" });
    const totalCases = await Case.countDocuments();

    console.log("✅ Fetched Admin Notifications and Stats for user:", req.user.id);
    console.log("✅ Unread notification count:", unreadCount);

    // Return all data including the unread count
    res.json({
      notifications,
      unreadCount,
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
    console.log("🔍 getAdminStats controller function called");
    
    // Basic counts with more detailed logging
    console.log("🔍 Fetching user counts...");
    const totalUsers = await User.countDocuments();
    const lawyers = await User.countDocuments({ role: "Lawyer" });
    const clients = await User.countDocuments({ role: "Client" });
    const pendingLawyers = await User.countDocuments({ role: "Lawyer", status: "Pending" });
    
    console.log("🔍 Fetching case counts...");
    const totalCases = await Case.countDocuments();
    
    console.log("🔍 User counts:", { totalUsers, lawyers, clients, pendingLawyers });
    console.log("🔍 Case counts:", { totalCases });
    
    // Cases by status
    const casesByStatus = {
      Posted: await Case.countDocuments({ status: "Posted" }),
      Assigned: await Case.countDocuments({ status: "Assigned" }),
      Closed: await Case.countDocuments({ status: "Closed" })
    };
    
    // Cases by category
    const casesByCategory = {
      Contract: await Case.countDocuments({ category: "Contract" }),
      Family: await Case.countDocuments({ category: "Family" }),
      Criminal: await Case.countDocuments({ category: "Criminal" }),
      Property: await Case.countDocuments({ category: "Property" }),
      Labor: await Case.countDocuments({ category: "Labor" }),
      Other: await Case.countDocuments({ category: "Other" })
    };
    
    // Recent cases
    const recentCases = await Case.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('description category status createdAt')
      .lean();
    
    // User growth - last 6 months
    const userGrowth = [];
    const currentDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const month = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthName = month.toLocaleString('default', { month: 'short' });
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      
      const count = await User.countDocuments({
        createdAt: { $gte: month, $lt: nextMonth }
      });
      
      userGrowth.push({
        name: monthName,
        users: count
      });
    }
    
    // Platform activity - last 7 days
    const recentActivity = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayName = date.toLocaleString('default', { weekday: 'short' });
      
      const userCount = await User.countDocuments({
        createdAt: { $gte: date, $lt: nextDate }
      });
      
      const caseCount = await Case.countDocuments({
        createdAt: { $gte: date, $lt: nextDate }
      });
      
      recentActivity.push({
        name: dayName,
        users: userCount,
        cases: caseCount
      });
    }

    console.log("✅ Fetched Admin Stats:", { 
      totalUsers, 
      lawyers, 
      clients,
      pendingLawyers, 
      totalCases 
    });

    res.json({
      totalUsers,
      lawyers,
      clients,
      pendingLawyers,
      totalCases,
      casesByStatus,
      casesByCategory,
      recentCases,
      userGrowth,
      recentActivity
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
