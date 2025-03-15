import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Case from "../models/Case.js";

export const getNotifications = async (req, res) => {
  try {
    // Fetch admin notifications (new_lawyer type for this admin)
    const notifications = await Notification.find({ 
      user: req.user.id,
      isAdminNotification: true 
    }).sort({ createdAt: -1 });

    // Calculate counts
    const totalUsers = await User.countDocuments();
    const lawyers = await User.countDocuments({ role: "Lawyer" });
    const pendingLawyers = await User.countDocuments({ role: "Lawyer", status: "Pending" });
    const totalCases = await Case.countDocuments(); // Rename to totalCases for clarity

    console.log("✅ Fetched Stats:", { totalUsers, lawyers, pendingLawyers, totalCases }); // Debug log

    res.json({
      message: "Notifications fetched",
      notifications,
      counts: { // Change 'counts' to 'stats'
        totalUsers,
        lawyers,
        pendingLawyers,
        totalCases, // Change 'cases' to 'totalCases'
      },
    });
  } catch (error) {
    console.error("❌ Fetch Notifications Error:", error.message);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};