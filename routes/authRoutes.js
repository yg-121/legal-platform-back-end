import express from 'express';
import { 
  registerUserWithUpload, 
  loginUser, 
  requestPasswordReset, 
  resetPassword 
} from '../controllers/authController.js';

const router = express.Router();

router.post('/register', registerUserWithUpload);
router.post('/login', loginUser);
router.post('/password/reset-request', requestPasswordReset);
router.post('/password/reset', resetPassword);

export default router;