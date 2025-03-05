import express from 'express';
import { registerUserWithUpload, loginUser } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', registerUserWithUpload);
router.post('/login', loginUser);

export default router;