import Rating from '../models/Rating.js';
import User from '../models/User.js';
import Case from '../models/Case.js';

export const createRating = async (req, res) => {
    try {
        const { lawyer, case: caseId, rating, comment } = req.body;
        const client = req.user.id;

        if (!lawyer || !caseId || !rating) {
            return res.status(400).json({ message: "Lawyer, case, and rating are required" });
        }
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Rating must be an integer between 1 and 5" });
        }
        if (comment && comment.length > 500) {
            return res.status(400).json({ message: "Comment must be under 500 characters" });
        }

        const caseData = await Case.findById(caseId);
        if (!caseData) {
            return res.status(404).json({ message: "Case not found" });
        }
        if (caseData.client.toString() !== client) {
            return res.status(403).json({ message: "You can only rate your own cases" });
        }
        if (caseData.status !== 'Closed') {
            return res.status(400).json({ message: "Case must be closed to rate" });
        }

        const lawyerData = await User.findById(lawyer);
        if (!lawyerData || lawyerData.role !== 'Lawyer') {
            return res.status(404).json({ message: "Lawyer not found" });
        }
        if (await Rating.findOne({ client, case: caseId })) {
            return res.status(400).json({ message: "You’ve already rated this case" });
        }

        const newRating = new Rating({ client, lawyer, case: caseId, rating, comment });
        await newRating.save();

        // Update lawyer's ratings and average
        lawyerData.ratings.push(newRating._id);
        const ratings = await Rating.find({ lawyer });
        const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
        lawyerData.averageRating = Number(avgRating.toFixed(1));
        await lawyerData.save();

        res.status(201).json(newRating);
    } catch (error) {
        console.error('❌ Rating Creation Error:', error.message);
        res.status(500).json({ message: "Failed to create rating", error: error.message });
    }
};

export const getLawyerRatings = async (req, res) => {
    try {
        const { lawyerId } = req.params;

        const lawyer = await User.findById(lawyerId);
        if (!lawyer || lawyer.role !== 'Lawyer') {
            return res.status(404).json({ message: "Lawyer not found" });
        }

        const ratings = await Rating.find({ lawyer: lawyerId })
            .populate('client', 'username')
            .populate('case', 'description')
            .sort({ createdAt: -1 });

        res.json({
            averageRating: lawyer.averageRating,
            ratings
        });
    } catch (error) {
        console.error('❌ Fetch Ratings Error:', error.message);
        res.status(500).json({ message: "Failed to fetch ratings", error: error.message });
    }
};