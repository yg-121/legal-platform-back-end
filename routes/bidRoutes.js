import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import { createBid, getCaseBids, acceptBid } from '../controllers/bidController.js';

const router = express.Router();

router.post('/', authMiddleware(['Lawyer']), createBid);
router.get('/case/:caseId', authMiddleware(['Client', 'Admin']), getCaseBids);
router.patch('/accept/:bidId', authMiddleware(['Client']), acceptBid);

export default router;