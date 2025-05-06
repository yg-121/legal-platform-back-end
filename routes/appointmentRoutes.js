import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import {
  createAppointment,
  getAppointments,
  confirmAppointment,
  cancelAppointment,
  changeAppointmentDate,
  completeAppointment,
  getCasesAppointments,
  generateICS, // New import
} from '../controllers/appointmentController.js';

const router = express.Router();

// Add console log to debug route registration
console.log("Registering appointment routes");

// Create an appointment (Client or Lawyer)
router.post('/', authMiddleware(['Client', 'Lawyer']), createAppointment);

// Get appointments (calendar view) - Allow Admin access
console.log("Registering GET / route for appointments");
router.get('/', authMiddleware(['Client', 'Lawyer', 'Admin']), (req, res) => {
  console.log("GET /appointments route hit by user:", req.user?.id, "with role:", req.user?.role);
  console.log("Query params:", req.query);
  getAppointments(req, res);
});

// Confirm appointment (Lawyer only)
router.patch('/:id/confirm', authMiddleware(['Lawyer']), confirmAppointment);

// Cancel appointment (Client or Lawyer)
router.patch('/:id/cancel', authMiddleware(['Client', 'Lawyer']), cancelAppointment);

// Change appointment date (Client or Lawyer)
router.patch('/:id/date', authMiddleware(['Client', 'Lawyer']), changeAppointmentDate);

// Complete appointment (Lawyer only)
router.patch('/:id/complete', authMiddleware(['Lawyer']), completeAppointment);

// Generate ICS file (Client or Lawyer)
router.get('/:id/ics', authMiddleware(['Client', 'Lawyer']), generateICS);

router.get("/case/:caseId",authMiddleware(["Client", "Lawyer"]), getCasesAppointments);


export default router;
