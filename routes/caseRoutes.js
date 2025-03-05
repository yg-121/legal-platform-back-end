import express from 'express';
import { createCase, getAllCases, getClientCases } from '../controllers/caseController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', authMiddleware(['Client']), createCase);
router.get('/', authMiddleware(), getAllCases);
router.get('/my-cases', authMiddleware(['Client']), getClientCases);

export default router;