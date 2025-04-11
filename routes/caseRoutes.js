import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import caseUpload from '../utils/caseUpload.js';
import { createCase, getAllCases, getClientCases,deleteCaseDocument, updateCase, deleteCase,getCaseDocuments, closeCase ,bidOnCase} from '../controllers/caseController.js';
import { createBid, getCaseBids } from '../controllers/bidController.js';
const router = express.Router();

// Client-only routes
router.post('/', authMiddleware(['Client']),caseUpload, createCase); // POST /api/cases
router.get('/my-cases', authMiddleware(['Client']), getClientCases); // GET /api/cases/my-cases
router.put('/:caseId', authMiddleware(['Client']),caseUpload, updateCase); // PUT /api/cases/:caseId
router.delete('/:caseId', authMiddleware(['Client']), deleteCase); // DELETE /api/cases/:caseId
router.patch('/:caseId/close', authMiddleware(['Client']), closeCase); // PATCH /api/cases/:caseId/close
router.post('/bid', authMiddleware(['Lawyer']),createBid);
// Lawyer/Admin route
router.get('/', authMiddleware(['Lawyer', 'Admin']), getAllCases); // GET /api/cases
router.get('/:caseId/bids', authMiddleware(['Client']), getCaseBids);
router.get('/:caseId/documents', authMiddleware(['Client', 'Admin']), getCaseDocuments);
router.delete('/:caseId/documents/:documentId', authMiddleware(['Client', 'Admin']), deleteCaseDocument); // New route
export default router;