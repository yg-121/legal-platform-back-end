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
  getLawyerProfile,
  getClientDashboard, 
  getLawyerDashboard,
} from '../controllers/userController.js';

const router = express.Router();

router.put('/approve-lawyer', authMiddleware(['Admin']), approveLawyer);
router.put('/reject-lawyer', authMiddleware(['Admin']), rejectLawyer);
router.put('/profile', authMiddleware(['Lawyer']), updateProfileWithUpload);
router.put('/admin/profile', authMiddleware(['Admin']), updateAdminProfileWithUpload);
router.get('/admin/profile', authMiddleware(['Admin']), getAdminProfile);
router.put('/admin/password', authMiddleware(['Admin']), changeAdminPassword);
router.get('/', authMiddleware(['Admin']), getAllUsers);
router.get('/filter', authMiddleware(['Admin']), filterUsers);
router.get('/pending-lawyers', authMiddleware(['Admin']), getPendingLawyers);
router.delete('/:userId', authMiddleware(['Admin']), deleteUser);
router.post('/add-admin', authMiddleware(['Admin']), addAdmin);
router.get('/lawyers', authMiddleware(['Client']), getLawyers);
router.get('/lawyers/:lawyerId', getLawyerProfile); // New public endpoint
router.get('/dashboard/client', authMiddleware(['Client']), getClientDashboard);
router.get('/dashboard/lawyer', authMiddleware(['Lawyer']), getLawyerDashboard);

export default router;