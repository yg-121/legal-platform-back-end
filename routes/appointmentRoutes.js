import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import { createAppointment, getAppointments, confirmAppointment } from '../controllers/appointmentController.js';

const router = express.Router();

router.post('/', authMiddleware(['Client']), createAppointment);
router.get('/', authMiddleware(['Client', 'Lawyer']), getAppointments);
router.patch('/:id/confirm', authMiddleware(['Lawyer']), confirmAppointment);

export default router;