import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Case from "../models/Case.js";

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      isAdminNotification: true 
    }).sort({ createdAt: -1 });

    const totalUsers = await User.countDocuments();
    const lawyers = await User.countDocuments({ role: "Lawyer" });
    const pendingLawyers = await User.countDocuments({ role: "Lawyer", status: "Pending" });
    const totalCases = await Case.countDocuments();

    console.log("✅ Fetched Stats:", { totalUsers, lawyers, pendingLawyers, totalCases });

    res.json({
      message: "Notifications fetched",
      notifications,
      counts: { 
        totalUsers,
        lawyers,
        pendingLawyers,
        totalCases,
      },
    });
  } catch (error) {
    console.error("❌ Fetch Notifications Error:", error.message);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await Notification.findById(notificationId);
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    if (!notification.isAdminNotification || req.user.role !== "Admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }
    notification.status = "Read";
    await notification.save();
    res.json({ message: "Notification marked as read", notification });
  } catch (error) {
    console.error("❌ Mark Notification Read Error:", error.message);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};