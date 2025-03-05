import express from 'express';
import { placeBid, getCaseBids } from '../controllers/bidController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', authMiddleware(['Lawyer']), placeBid);
router.get('/:caseId', authMiddleware(), getCaseBids);

export default router;