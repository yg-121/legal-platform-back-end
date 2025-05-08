import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import {
  approveLawyer,
  rejectLawyer,
  updateLawyerProfileWithUpload,
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
  getClientProfile,
  getClientDashboard,
  getLawyerDashboard,
  assignReviewer,
  getPendingReviews,
  updateClientProfileWithUpload,
  changeClientPassword,
  changeLawyerPassword 
} from '../controllers/userController.js';

const router = express.Router();

router.put('/approve-lawyer', authMiddleware(['LegalReviewer']), approveLawyer);
router.put('/reject-lawyer', authMiddleware(['LegalReviewer']), rejectLawyer);
router.put('/lawyer/profile', authMiddleware(['Lawyer']), updateLawyerProfileWithUpload);
router.put('/admin/profile', authMiddleware(['Admin']), updateAdminProfileWithUpload);
router.put('/client/profile', authMiddleware(['Client']), updateClientProfileWithUpload);
router.get('/client/profile', authMiddleware(['Client']), getClientProfile);
router.put('/client/password', authMiddleware(['Client']), changeClientPassword);
router.put('/lawyer/password', authMiddleware(['Lawyer']), changeLawyerPassword);
router.get('/admin/profile', authMiddleware(['Admin']), getAdminProfile);
router.put('/admin/password', authMiddleware(['Admin']), changeAdminPassword);
router.get('/', authMiddleware(['Admin']), getAllUsers);
router.get('/filter', authMiddleware(['Admin']), filterUsers);
router.get('/pending-lawyers', authMiddleware(['Admin', 'LegalReviewer']), getPendingLawyers);
router.delete('/:userId', authMiddleware(['Admin']), deleteUser);
router.post('/add-admin', authMiddleware(['Admin']), addAdmin);
router.post('/assign-reviewer', authMiddleware(['Admin']), assignReviewer);
router.get('/pending-reviews', authMiddleware(['LegalReviewer']), getPendingReviews);
router.get('/lawyers', authMiddleware(['Client']), getLawyers);
router.get('/lawyers/:lawyerId', getLawyerProfile);
router.get('/dashboard/client', authMiddleware(['Client']), getClientDashboard);
router.get('/dashboard/lawyer', authMiddleware(['Lawyer']), getLawyerDashboard);

export default router;
