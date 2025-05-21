import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import chatUpload from '../utils/chatUpload.js';
import { sendMessage, getChatHistory, getUnreadChats, markChatAsRead, startChat, deleteChat, blockUser, unblockUser } from '../controllers/chatController.js';

const router = express.Router();

// Modified: Allow both Client and Lawyer to start chats, with validation in controller
router.post('/start', authMiddleware(['Client', 'Lawyer']), startChat);
router.post('/send', authMiddleware(['Client', 'Lawyer']), chatUpload, sendMessage);
router.get('/history/:userId', authMiddleware(['Client', 'Lawyer']), getChatHistory);
router.get('/unread', authMiddleware(['Client', 'Lawyer']), getUnreadChats);
router.patch('/:chatId/read', authMiddleware(['Client', 'Lawyer']), markChatAsRead);
// New routes
router.delete('/:chatId', authMiddleware(['Client', 'Lawyer']), deleteChat);
router.post('/block/:userId', authMiddleware(['Client', 'Lawyer']), blockUser);
router.post('/unblock/:userId', authMiddleware(['Client', 'Lawyer']), unblockUser);

export default router;