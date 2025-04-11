import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import {
  approveLawyer,
  rejectLawyer,
  updateProfileWithUpload,
  updateAdminProfileWithUpload,
  changeAdminPassword,
  getAllUsers,
  filterUsers,
  getPendingLawyers,
  deleteUser,
  addAdmin,
  getAdminProfile,
  getLawyers,
  getClientDashboard, 
  getLawyerDashboard,
} from '../controllers/userController.js';

const router = express.Router();

// Existing Routes
router.put('/approve-lawyer', authMiddleware(['Admin']), approveLawyer); // Changed to PUT
router.put('/reject-lawyer', authMiddleware(['Admin']), rejectLawyer);   // New
router.put('/profile', authMiddleware(['Lawyer']), updateProfileWithUpload);

// New Admin Routes
router.put('/admin/profile', authMiddleware(['Admin']), updateAdminProfileWithUpload);
router.get('/admin/profile', authMiddleware(['Admin']), getAdminProfile);
router.put('/admin/password', authMiddleware(['Admin']), changeAdminPassword);
router.get('/', authMiddleware(['Admin']), getAllUsers);
router.get('/filter', authMiddleware(['Admin']), filterUsers);
router.get('/pending-lawyers', authMiddleware(['Admin']), getPendingLawyers);
router.delete('/:userId', authMiddleware(['Admin']), deleteUser);
router.post('/add-admin', authMiddleware(['Admin']), addAdmin);
router.get('/lawyers', authMiddleware(['Client']), getLawyers);
router.get('/dashboard/client', authMiddleware(['Client']), getClientDashboard);
router.get('/dashboard/lawyer', authMiddleware(['Lawyer']), getLawyerDashboard);
export default router;