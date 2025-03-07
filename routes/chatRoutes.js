import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import chatUpload from '../utils/chatUpload.js';
import { sendMessage, getChatHistory, getUnreadChats, markChatAsRead } from '../controllers/chatController.js';

const router = express.Router();

router.post('/', authMiddleware(['Client', 'Lawyer']), chatUpload, sendMessage);
router.get('/history/:userId', authMiddleware(['Client', 'Lawyer']), getChatHistory);
router.get('/unread', authMiddleware(['Client', 'Lawyer']), getUnreadChats);
router.patch('/:chatId/read', authMiddleware(['Client', 'Lawyer']), markChatAsRead);

export default router;