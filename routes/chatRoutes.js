import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import chatUpload from '../utils/chatUpload.js';
import { sendMessage, getChatHistory } from '../controllers/chatController.js';

const router = express.Router();

router.post('/', authMiddleware(['Client', 'Lawyer']), chatUpload, sendMessage);
router.get('/history/:userId', authMiddleware(['Client', 'Lawyer']), getChatHistory);

export default router;