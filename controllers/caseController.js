import Case from '../models/Case.js';
import Bid from '../models/Bid.js'; // Add Bid model
import Audit from '../models/Audit.js';
import User from '../models/User.js';
import { sendNotification } from '../utils/notify.js';
import { io } from '../index.js';

// Create a new case
export const createCase = async (req, res) => {
  try {
    const { description } = req.body;
    const file_id = req.file ? req.file.path : null;
    const client = req.user.id;

    if (!description) return res.status(400).json({ message: 'Description is required' });
    if (description.length > 500) return res.status(400).json({ message: 'Description must be under 500 characters' });

    const newCase = new Case({ client, description, file_id });
    await newCase.save();

    const lawyers = await User.find({ role: 'Lawyer' });
    for (const lawyer of lawyers) {
      await sendNotification(
        lawyer._id,
        `New case posted: ${description.substring(0, 50)}...`,
        'new_case'
      );
    }

    res.status(201).json({ message: 'Case created', case: newCase });
  } catch (error) {
    console.error('❌ Case Creation Error:', error.message);
    res.status(500).json({ message: 'Failed to create case', error: error.message });
  }
};

// Bid on a case (moved from bidController.js logic)
export const bidOnCase = async (req, res) => {
  try {
    const { caseId, amount, comment } = req.body;
    const lawyer = req.user.id;

    if (!caseId || !amount) {
      return res.status(400).json({ message: 'Case ID and amount are required' });
    }
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number' });
    }
    if (comment && comment.length > 200) {
      return res.status(400).json({ message: 'Comment must be under 200 characters' });
    }

    const caseExists = await Case.findById(caseId);
    if (!caseExists) {
      return res.status(404).json({ message: 'Case not found' });
    }
    if (caseExists.status !== 'Posted') {
      return res.status(400).json({ message: 'Cannot bid on a non-posted case' });
    }
    if (await Bid.findOne({ lawyer, case: caseId })) {
      return res.status(400).json({ message: 'You’ve already bid on this case' });
    }

    const bid = new Bid({ lawyer, case: caseId, amount, comment });
    await bid.save();

    await sendNotification(
      caseExists.client,
      `Lawyer ${req.user.username} bid ${amount} ETB on your case: "${caseExists.description}"${comment ? ` - "${comment}"` : ''}`,
      'Bid'
    );

    res.status(201).json({ message: 'Bid placed', bid });
  } catch (error) {
    console.error('❌ Bid Error:', error.message);
    res.status(500).json({ message: 'Failed to place bid', error: error.message });
  }
};

// Get all cases (for lawyers/admin)
export const getAllCases = async (req, res) => {
  try {
    const cases = await Case.find()
      .populate('client', 'username email')
      .populate('assigned_lawyer', 'username email')
      .populate('winning_bid', 'amount lawyer');
    res.json({ message: 'Cases fetched successfully', cases });
  } catch (error) {
    console.error('❌ Fetch Cases Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Get client's cases
export const getClientCases = async (req, res) => {
  try {
    const cases = await Case.find({ client: req.user.id })
      .populate('assigned_lawyer', 'username email')
      .populate('winning_bid', 'amount lawyer');
    res.json({ message: 'Client cases fetched', cases });
  } catch (error) {
    console.error('❌ Fetch Client Cases Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Update a case
export const updateCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { description } = req.body;
    const file_id = req.file ? req.file.path : null;
    const clientId = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    if (caseData.client.toString() !== clientId) {
      return res.status(403).json({ message: 'Only the case owner can update it' });
    }
    if (caseData.status !== 'Posted') {
      return res.status(400).json({ message: 'Can only update cases with status "Posted"' });
    }

    if (description) {
      if (description.length > 500) return res.status(400).json({ message: 'Description must be under 500 characters' });
      caseData.description = description;
    }
    if (file_id) caseData.file_id = file_id;
    await caseData.save();

    res.json({ message: 'Case updated', case: caseData });
  } catch (error) {
    console.error('❌ Update Case Error:', error.message);
    res.status(500).json({ message: 'Failed to update case', error: error.message });
  }
};

// Delete a case
export const deleteCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const clientId = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    if (caseData.client.toString() !== clientId) {
      return res.status(403).json({ message: 'Only the case owner can delete it' });
    }
    if (caseData.status !== 'Posted') {
      return res.status(400).json({ message: 'Can only delete cases with status "Posted"' });
    }

    await Case.deleteOne({ _id: caseId });
    res.json({ message: 'Case deleted' });
  } catch (error) {
    console.error('❌ Delete Case Error:', error.message);
    res.status(500).json({ message: 'Failed to delete case', error: error.message });
  }
};

// Close a case
export const closeCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const clientId = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    if (caseData.client.toString() !== clientId) return res.status(403).json({ message: 'Only the case owner can close it' });
    if (caseData.status === 'Closed') return res.status(400).json({ message: 'Case is already closed' });

    caseData.status = 'Closed';
    await caseData.save();

    if (caseData.assigned_lawyer) {
      await sendNotification(
        caseData.assigned_lawyer,
        `Case closed: ${caseData.description.substring(0, 50)}...`,
        'case_closed'
      );
    }

    if (req.user.role === 'Admin') {
      await new Audit({
        admin: req.user.id,
        action: 'close_case',
        details: caseId,
      }).save();
    }

    res.json({ message: 'Case closed successfully', case: caseData });
  } catch (error) {
    console.error('❌ Case Close Error:', error.message);
    res.status(500).json({ message: 'Failed to close case', error: error.message });
  }
};