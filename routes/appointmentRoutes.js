import express from 'express';
import { scheduleAppointment, sendChatMessage } from '../controllers/appointmentController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/appointments', authMiddleware(['Client']), scheduleAppointment);
router.post('/chats', authMiddleware(), sendChatMessage);

export default router;