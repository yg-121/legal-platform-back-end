import Audit from '../models/Audit.js';

export const getAuditLogs = async (req, res) => {
  try {
    const logs = await Audit.find()
      .populate('admin', 'username email')
      .populate('target', 'username email')
      .sort({ createdAt: -1 });
    res.json({ message: 'Audit logs fetched', logs });
  } catch (error) {
    console.error('❌ Fetch Audit Logs Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};