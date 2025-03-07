import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import { createRating, getLawyerRatings } from '../controllers/ratingController.js';

const router = express.Router();

router.post('/', authMiddleware(['Client']), createRating);
router.get('/:lawyerId', getLawyerRatings); // Public access

export default router;