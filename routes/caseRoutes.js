import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import caseUpload from '../utils/caseUpload.js';
import { createCase, getAllCases, getClientCases, closeCase } from '../controllers/caseController.js';

const router = express.Router();

router.post('/', authMiddleware(['Client']), caseUpload, createCase);
router.get('/', authMiddleware(['Admin']), getAllCases);
router.get('/my-cases', authMiddleware(['Client']), getClientCases);
router.patch('/:caseId/close', authMiddleware(['Client']), closeCase);

export default router;