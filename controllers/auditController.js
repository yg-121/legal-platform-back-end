import Audit from '../models/Audit.js';

export const getAuditLogs = async (req, res) => {
  try {
    const logs = await Audit.find()
      .populate('admin', 'username role') // Changed to user for LegalReviewer
      .populate('target', 'username')
      .sort({ createdAt: -1 });
    res.json(logs);
  } catch (error) {
    console.error('❌ Get Audit Logs Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};