import Rating from '../models/Rating.js';
import User from '../models/User.js';
import Case from '../models/Case.js';
import { sendNotification } from '../utils/notify.js';

export const initiateRating = async (caseId, clientId, lawyerId) => {
  // Called when chat/appointment starts (e.g., from chatController or appointmentController)
  try {
    const existingRating = await Rating.findOne({ client: clientId, case: caseId });
    if (existingRating) return; // Already initiated

    const rating = new Rating({
      client: clientId,
      lawyer: lawyerId,
      case: caseId,
    });
    await rating.save();

    await sendNotification(
      clientId,
      `How’s your experience with ${lawyerId.username} on case "${caseId.description}"? Rate them now!`,
      'RatingPrompt'
    );
  } catch (error) {
    console.error('❌ Initiate Rating Error:', error.message);
  }
};

export const createRating = async ( wreq, res) => {
  try {
    const { caseId, rating, comment } = req.body;
    const client = req.user.id;

    if (!caseId || !rating) {
      return res.status(400).json({ message: 'Case ID and rating are required' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
    }
    if (comment && comment.length > 500) {
      return res.status(400).json({ message: 'Comment must be under 500 characters' });
    }

    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({ message: 'Case not found' });
    }
    if (caseData.client.toString() !== client) {
      return res.status(403).json({ message: 'You can only rate your own cases' });
    }
    if (!caseData.assigned_lawyer) {
      return res.status(400).json({ message: 'No lawyer assigned yet' });
    }

    let ratingData = await Rating.findOne({ client, case: caseId });
    if (!ratingData) {
      ratingData = new Rating({
        client,
        lawyer: caseData.assigned_lawyer,
        case: caseId,
      });
    }
    if (ratingData.status === 'Completed') {
      return res.status(400).json({ message: 'You’ve already rated this case' });
    }

    ratingData.rating = rating;
    ratingData.comment = comment;
    ratingData.status = 'Completed';
    await ratingData.save();

    // Update lawyer's ratings and average
    const lawyer = await User.findById(caseData.assigned_lawyer);
    const ratings = await Rating.find({ lawyer: lawyer._id, status: 'Completed' });
    const avgRating = ratings.length ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0;
    lawyer.ratings = ratings.map(r => r._id);
    lawyer.averageRating = Number(avgRating.toFixed(1));
    lawyer.ratingCount = ratings.length;
    await lawyer.save();

    await sendNotification(
      lawyer._id,
      `Client ${req.user.username} rated you ${rating}/5 for case "${caseData.description}"${comment ? ` - "${comment}"` : ''}`,
      'Rating'
    );

    res.status(201).json({ message: 'Rating submitted', rating: ratingData });
  } catch (error) {
    console.error('❌ Rating Creation Error:', error.message);
    res.status(500).json({ message: 'Failed to create rating', error: error.message });
  }
};

export const dismissRating = async (req, res) => {
  try {
    const { caseId } = req.body;
    const client = req.user.id;

    const ratingData = await Rating.findOne({ client, case: caseId });
    if (!ratingData) {
      return res.status(404).json({ message: 'Rating prompt not found' });
    }
    if (ratingData.status === 'Completed') {
      return res.status(400).json({ message: 'Rating already completed' });
    }

    ratingData.status = 'Dismissed';
    ratingData.lastRemindedAt = new Date();
    await ratingData.save();

    res.json({ message: 'Rating prompt dismissed' });
  } catch (error) {
    console.error('❌ Dismiss Rating Error:', error.message);
    res.status(500).json({ message: 'Failed to dismiss rating', error: error.message });
  }
};

export const getLawyerRatings = async (req, res) => {
  try {
    const { lawyerId } = req.params;

    const lawyer = await User.findById(lawyerId);
    if (!lawyer || lawyer.role !== 'Lawyer') {
      return res.status(404).json({ message: 'Lawyer not found' });
    }

    const ratings = await Rating.find({ lawyer: lawyerId, status: 'Completed' })
      .populate('client', 'username')
      .populate('case', 'description')
      .sort({ createdAt: -1 });

    res.json({
      averageRating: lawyer.averageRating,
      ratingCount: lawyer.ratingCount,
      ratings,
    });
  } catch (error) {
    console.error('❌ Fetch Ratings Error:', error.message);
    res.status(500).json({ message: 'Failed to fetch ratings', error: error.message });
  }
};

// Reminder logic (run periodically, e.g., via cron job)
export const remindPendingRatings = async () => {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const dismissedRatings = await Rating.find({
      status: 'Dismissed',
      lastRemindedAt: { $lt: oneWeekAgo },
    }).populate('case', 'description');

    for (const rating of dismissedRatings) {
      await sendNotification(
        rating.client,
        `Reminder: Rate your experience with ${rating.lawyer.username} on case "${rating.case.description}"!`,
        'RatingPrompt'
      );
      rating.lastRemindedAt = new Date();
      await rating.save();
    }
    console.log(`Sent ${dismissedRatings.length} rating reminders`);
  } catch (error) {
    console.error('❌ Rating Reminder Error:', error.message);
  }
};
export const getPendingRatings = async (req, res) => {
  try {
    const ratings = await Rating.find({ 
      client: req.user.id, 
      status: 'Pending' 
    })
      .populate('case', 'description')
      .populate('lawyer', 'username');
    const pending = ratings.map(r => ({
      caseId: r.case._id,
      lawyerUsername: r.lawyer.username,
      caseDescription: r.case.description,
    }));
    res.json(pending);
  } catch (error) {
    console.error('❌ Fetch Pending Ratings Error:', error.message);
    res.status(500).json({ message: 'Failed to fetch pending ratings', error: error.message });
  }
};