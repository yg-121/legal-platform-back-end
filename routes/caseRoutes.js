import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import caseUpload from '../utils/caseUpload.js';
import { createCase, getAllCases, getClientCases, updateCase, deleteCase, closeCase ,bidOnCase} from '../controllers/caseController.js';

const router = express.Router();

// Client-only routes
router.post('/', authMiddleware(['Client']),caseUpload, createCase); // POST /api/cases
router.get('/my-cases', authMiddleware(['Client']), getClientCases); // GET /api/cases/my-cases
router.put('/:caseId', authMiddleware(['Client']), updateCase); // PUT /api/cases/:caseId
router.delete('/:caseId', authMiddleware(['Client']), deleteCase); // DELETE /api/cases/:caseId
router.patch('/:caseId/close', authMiddleware(['Client']), closeCase); // PATCH /api/cases/:caseId/close
router.post('/bid', authMiddleware(['Lawyer']), bidOnCase);
// Lawyer/Admin route
router.get('/', authMiddleware(['Lawyer', 'Admin']), getAllCases); // GET /api/cases

export default router;