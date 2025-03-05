import express from 'express';
import { approveLawyer, updateProfileWithUpload } from '../controllers/userController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/approve-lawyer', authMiddleware(['Admin']), approveLawyer);
router.put('/profile', authMiddleware(['Lawyer']), updateProfileWithUpload);

export default router;