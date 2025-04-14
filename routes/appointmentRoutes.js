import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import { createAppointment, getAppointments, confirmAppointment, cancelAppointment, changeAppointmentDate, completeAppointment } from '../controllers/appointmentController.js';

const router = express.Router();

router.post('/', authMiddleware(['Client', 'Lawyer']), createAppointment);
router.get('/', authMiddleware(['Client', 'Lawyer']), getAppointments);
router.patch('/:id/confirm', authMiddleware(['Lawyer']), confirmAppointment);
router.patch('/:id/cancel', authMiddleware(['Client', 'Lawyer']), cancelAppointment);
router.patch('/:id/date', authMiddleware(['Client', 'Lawyer']), changeAppointmentDate);
router.patch('/:id/complete', authMiddleware(['Lawyer']), completeAppointment); // New route

export default router;