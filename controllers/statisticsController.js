import User from '../models/User.js';
import Audit from '../models/Audit.js';
import mongoose from 'mongoose';

// Get statistics for legal reviewer dashboard
export const getLegalReviewerStats = async (req, res) => {
  try {
    // Get all lawyers
    const lawyers = await User.find({ role: 'Lawyer' });
    
    // Count by status
    const pendingCount = lawyers.filter(l => l.status === 'Pending').length;
    const activeCount = lawyers.filter(l => l.status === 'Active').length;
    const rejectedCount = lawyers.filter(l => l.status === 'Rejected').length;
    const totalProcessed = activeCount + rejectedCount;
    
    // Calculate approval rate
    const approvalRate = totalProcessed > 0 
      ? Math.round((activeCount / totalProcessed) * 100) 
      : 0;
    
    // Get audit logs for lawyer approvals/rejections by the current reviewer
    const reviewerId = req.user.id;
    const reviewerAuditLogs = await Audit.find({
      user: reviewerId,
      action: { $in: ['approve_lawyer', 'reject_lawyer'] }
    }).sort({ createdAt: -1 });
    
    // Calculate reviewer's personal stats
    const reviewerApprovals = reviewerAuditLogs.filter(log => log.action === 'approve_lawyer').length;
    const reviewerRejections = reviewerAuditLogs.filter(log => log.action === 'reject_lawyer').length;
    const reviewerTotal = reviewerApprovals + reviewerRejections;
    const reviewerApprovalRate = reviewerTotal > 0 
      ? Math.round((reviewerApprovals / reviewerTotal) * 100) 
      : 0;
    
    // Get all approval/rejection audit logs for processing time calculation
    const allAuditLogs = await Audit.find({
      action: { $in: ['approve_lawyer', 'reject_lawyer'] }
    })
    .populate('target')
    .sort({ createdAt: -1 })
    .limit(100);
    
    // Calculate average processing time
    let totalProcessingTime = 0;
    let processedCount = 0;
    
    for (const log of allAuditLogs) {
      if (log.target && log.target.createdAt) {
        const creationTime = new Date(log.target.createdAt);
        const decisionTime = new Date(log.createdAt);
        
        if (creationTime && decisionTime) {
          const processingTimeHours = (decisionTime - creationTime) / (1000 * 60 * 60);
          totalProcessingTime += processingTimeHours;
          processedCount++;
        }
      }
    }
    
    const avgProcessingTime = processedCount > 0 
      ? Math.round((totalProcessingTime / processedCount) * 10) / 10 
      : 0;
    
    // Get weekly application trends (last 4 weeks)
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const recentLawyers = await User.find({
      role: 'Lawyer',
      createdAt: { $gte: fourWeeksAgo }
    });
    
    // Group by week
    const weeklyApplications = [0, 0, 0, 0];
    const now = new Date();
    recentLawyers.forEach(lawyer => {
      const createdAt = new Date(lawyer.createdAt);
      const weeksAgo = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24 * 7));
      if (weeksAgo >= 0 && weeksAgo < 4) {
        weeklyApplications[weeksAgo]++;
      }
    });
    weeklyApplications.reverse(); // Most recent week last
    
    // Get recent activity for this reviewer
    const recentActivity = await Audit.find({
      user: reviewerId,
      action: { $in: ['approve_lawyer', 'reject_lawyer'] }
    })
    .populate('target', 'username email')
    .sort({ createdAt: -1 })
    .limit(5);
    
    const formattedActivity = recentActivity.map(log => ({
      id: log._id,
      action: log.action === 'approve_lawyer' ? 'Approved' : 'Rejected',
      lawyer: log.target ? {
        id: log.target._id,
        username: log.target.username,
        email: log.target.email
      } : { username: 'Unknown', email: 'Unknown' },
      date: log.createdAt,
      details: log.details
    }));
    
    // Get pending lawyers that need review
    const pendingLawyers = await User.find({ 
      role: 'Lawyer', 
      status: 'Pending' 
    })
    .select('_id username email createdAt specialization')
    .sort({ createdAt: 1 }) // Oldest first
    .limit(5);
    
    // Calculate specialization distribution
    const specializationCounts = {};
    lawyers.forEach(lawyer => {
      if (lawyer.specialization && Array.isArray(lawyer.specialization)) {
        lawyer.specialization.forEach(spec => {
          specializationCounts[spec] = (specializationCounts[spec] || 0) + 1;
        });
      }
    });
    
    // Format specialization data for charts
    const specializationData = Object.entries(specializationCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 specializations
    
    res.json({
      counts: {
        pending: pendingCount,
        active: activeCount,
        rejected: rejectedCount,
        total: lawyers.length
      },
      approvalRate,
      avgProcessingTime,
      weeklyApplications,
      reviewerStats: {
        approved: reviewerApprovals,
        rejected: reviewerRejections,
        total: reviewerTotal,
        approvalRate: reviewerApprovalRate
      },
      recentActivity: formattedActivity,
      pendingLawyers,
      specializationData
    });
  } catch (error) {
    console.error('❌ Legal Reviewer Stats Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Get statistics for admin dashboard
export const getAdminStats = async (req, res) => {
  // Your existing admin stats code
};
