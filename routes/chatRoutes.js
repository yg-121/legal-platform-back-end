import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import chatUpload from '../utils/chatUpload.js';
import { sendMessage, getChatHistory, markChatAsRead, deleteChat, blockUser, unblockUser } from '../controllers/chatController.js';

const router = express.Router();

router.post('/send', authMiddleware(['Client', 'Lawyer']), chatUpload, sendMessage);
router.get('/history/:userId', authMiddleware(['Client', 'Lawyer']), getChatHistory);
router.patch('/read/:chatId', authMiddleware(['Client', 'Lawyer']), markChatAsRead);
router.delete('/:chatId', authMiddleware(['Client', 'Lawyer']), deleteChat);
router.post('/block/:userId', authMiddleware(['Client', 'Lawyer']), blockUser);
router.post('/unblock/:userId', authMiddleware(['Client', 'Lawyer']), unblockUser);

export default router;