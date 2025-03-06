import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import caseUpload from '../utils/caseUpload.js';
import { createCase, getAllCases, getClientCases } from '../controllers/caseController.js';

const router = express.Router();

// Create a new case (Client only, with file upload)
router.post('/', authMiddleware(['Client']), caseUpload, createCase);

// Get all cases (Admin only, for now)
router.get('/', authMiddleware(['Admin']), getAllCases);

// Get client's own cases (Client only)
router.get('/my-cases', authMiddleware(['Client']), getClientCases);

export default router;