import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import { createRating, getLawyerRatings, dismissRating ,getPendingRatings} from '../controllers/ratingController.js';

const router = express.Router();

router.post('/', authMiddleware(['Client']), createRating);
router.post('/dismiss', authMiddleware(['Client']), dismissRating); // POST /api/ratings/dismiss
router.get('/:lawyerId', getLawyerRatings); // Public access
router.get('/pending', authMiddleware(['Client']), getPendingRatings); // GET /api/ratings/pending
export default router;