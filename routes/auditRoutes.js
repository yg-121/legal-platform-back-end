import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import { getAuditLogs } from '../controllers/auditController.js';

const router = express.Router();

router.get('/', authMiddleware(['Admin']), (req, res, next) => {
  console.log("Audit route hit with user:", req.user);
  next();
}, getAuditLogs);

export default router;