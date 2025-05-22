import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import { getLegalReviewerStats, getAdminStats } from '../controllers/statisticsController.js';

const router = express.Router();

// Get statistics for legal reviewer dashboard
router.get('/legal-reviewer', authMiddleware(['LegalReviewer']), getLegalReviewerStats);

// Get statistics for admin dashboard
router.get('/admin', authMiddleware(['Admin']), getAdminStats);

export default router;
