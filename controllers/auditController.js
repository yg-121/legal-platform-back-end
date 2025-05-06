import Audit from '../models/Audit.js';
import User from '../models/User.js';

export const getAuditLogs = async (req, res) => {
  try {
    console.log("Fetching audit logs");
    
    // Check if there are any query parameters for filtering
    const { action, target } = req.query;
    const query = {};
    
    if (action) {
      query.action = action;
    }
    
    if (target) {
      // Try to find users matching the target username
      const targetUsers = await User.find({ 
        username: { $regex: target, $options: 'i' } 
      }).select('_id');
      
      if (targetUsers.length > 0) {
        query.target = { $in: targetUsers.map(user => user._id) };
      } else {
        // If no matching users, return empty result
        return res.json([]);
      }
    }
    
    console.log("Audit logs query:", query);
    
    const logs = await Audit.find(query)
      .populate('user', 'username role') // Changed from admin to user
      .populate('target', 'username')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${logs.length} audit logs`);
    res.json(logs);
  } catch (error) {
    console.error('❌ Get Audit Logs Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};
