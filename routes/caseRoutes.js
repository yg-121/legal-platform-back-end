import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import caseUpload from '../utils/caseUpload.js';
import {
  createCase,
  getAllCases,
  getClientCases,
  getCaseDocuments,
  deleteCaseDocument,
  updateCase,
  deleteCase,
  closeCase,
  bidOnCase,
  acceptBid,
  addDeadline,
  completeDeadline,
  createLegalForm,
  signForm,
  addNote,
  getCaseAnalytics,
  getCaseDetails,
} from '../controllers/caseController.js';
import { createBid, getCaseBids } from '../controllers/bidController.js';

const router = express.Router();

// Client-only routes
router.post('/', authMiddleware(['Client']), caseUpload, createCase);
router.get('/my-cases', authMiddleware(['Client']), getClientCases);
router.put('/:caseId', authMiddleware(['Client']), caseUpload, updateCase);
router.delete('/:caseId', authMiddleware(['Client']), deleteCase);
router.patch('/:caseId/close', authMiddleware(['Client']), closeCase);
router.post('/bid', authMiddleware(['Lawyer']), bidOnCase);
router.post('/accept-bid', authMiddleware(['Client']), acceptBid);
router.get('/analytics', authMiddleware(['Lawyer', 'Admin']), getCaseAnalytics);

// Client/Lawyer/Admin routes
router.get('/:caseId', authMiddleware(['Client', 'Lawyer', 'Admin']), getCaseDetails);
router.post('/:caseId/deadlines', authMiddleware(['Client', 'Lawyer', 'Admin']), addDeadline);
router.patch('/:caseId/deadlines/:deadlineId/complete', authMiddleware(['Client', 'Lawyer', 'Admin']), completeDeadline);
router.post('/:caseId/forms', authMiddleware(['Client', 'Lawyer', 'Admin']), createLegalForm);
router.patch('/:caseId/forms/:formId/sign', authMiddleware(['Client', 'Lawyer', 'Admin']), signForm);
router.post('/:caseId/notes', authMiddleware(['Client', 'Lawyer', 'Admin']), addNote);
router.get('/:caseId/documents', authMiddleware(['Client', 'Lawyer', 'Admin']), getCaseDocuments);
router.delete('/:caseId/documents/:documentId', authMiddleware(['Client', 'Lawyer', 'Admin']), deleteCaseDocument);

// Lawyer/Admin routes
router.get('/', authMiddleware(['Lawyer', 'Admin']), getAllCases);

// Client routes
router.get('/:caseId/bids', authMiddleware(['Client']), getCaseBids);

export default router;