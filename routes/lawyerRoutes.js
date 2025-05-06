const express = require('express');
const router = express.Router();
const lawyerController = require('../controllers/lawyerController');
const { protect, authorize } = require('../middleware/auth');

// GET /api/lawyers - Get all lawyers with search functionality
router.get('/', protect, lawyerController.getAllLawyers);

// GET /api/lawyers/:id - Get lawyer by ID
router.get('/:id', protect, lawyerController.getLawyerById);

// Other lawyer routes...

module.exports = router;