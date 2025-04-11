import Case from '../models/Case.js';
import Bid from '../models/Bid.js';
import Audit from '../models/Audit.js';
import User from '../models/User.js';
import { sendNotification } from '../utils/notify.js';
import { io } from '../index.js';
import fs from 'fs'; 
import path from 'path';

// Create a new case
export const createCase = async (req, res) => {
  try {
    const { description, category, deadline } = req.body;
    const files = req.files;
    const client = req.user.id;

    if (!description || !category || !deadline) {
      return res.status(400).json({ message: 'Description, category, and deadline are required' });
    }
    if (description.length > 500) {
      return res.status(400).json({ message: 'Description must be under 500 characters' });
    }
    const parsedDeadline = new Date(deadline);
    if (isNaN(parsedDeadline) || parsedDeadline < Date.now()) {
      return res.status(400).json({ message: 'Deadline must be a valid future date' });
    }

    const documents = files ? files.map(file => ({
      filePath: file.path,
      fileName: file.originalname,
  })) : [];

    const newCase = new Case({ 
      client, 
      description, 
      category, 
      deadline: parsedDeadline, 
      documents, });
    await newCase.save();

    const lawyers = await User.find({ role: 'Lawyer' });
    for (const lawyer of lawyers) {
      await sendNotification(
        lawyer._id,
        `New ${category} case posted: ${description.substring(0, 50)}... (Deadline: ${parsedDeadline.toLocaleDateString()})`,
        'new_case'
      );
    }

    res.status(201).json({ message: 'Case created', case: newCase });
  } catch (error) {
    console.error('❌ Case Creation Error:', error.message);
    res.status(500).json({ message: 'Failed to create case', error: error.message });
  }
};

// Bid on a case
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
    console.log(`Case ID: ${caseId}, Status: ${caseExists.status}`); // Debug log
    if (caseExists.status !== 'Posted') {
      return res.status(400).json({ message: 'Cannot bid on a non-posted case' });
    }
    if (await Bid.findOne({ lawyer, case: caseId })) {
      return res.status(400).json({ message: 'You’ve already bid on this case' });
    }

    const bid = new Bid({ lawyer, case: caseId, amount, comment });
    await bid.save();

    const lawyerData = await User.findById(lawyer).select('username averageRating ratingCount');
    await sendNotification(
      caseExists.client,
      `Lawyer ${lawyerData.username} (Rating: ${lawyerData.averageRating}/5, ${lawyerData.ratingCount} reviews) bid ${amount} ETB on your ${caseExists.category} case: "${caseExists.description}" (Deadline: ${caseExists.deadline.toLocaleDateString()})${comment ? ` - "${comment}"` : ''}`,
      'Bid'
    );

    await sendNotification(
      caseExists.client,
      `Lawyer ${req.user.username} bid ${amount} ETB on your ${caseExists.category} case: "${caseExists.description}" (Deadline: ${caseExists.deadline.toLocaleDateString()})${comment ? ` - "${comment}"` : ''}`,
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
export const getCaseBids = async (req, res) => {
  try {
    const { caseId } = req.params;
    const clientId = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    if (caseData.client.toString() !== clientId) return res.status(403).json({ message: 'Only the case owner can view bids' });

    const bids = await Bid.find({ case: caseId })
      .populate('lawyer', 'username averageRating ratingCount');
    res.json({ message: 'Bids fetched', bids });
  } catch (error) {
    console.error('❌ Fetch Case Bids Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};
// Get client's cases
export const getClientCases = async (req, res) => {
  try {
    const cases = await Case.find({ client: req.user.id })
      .populate('assigned_lawyer', 'username email')
      .populate('winning_bid', 'amount lawyer');
      const casesWithBids = await Promise.all(cases.map(async (c) => {
        const bids = await Bid.find({ case: c._id }).populate('lawyer', 'username averageRating ratingCount');
        return { ...c.toObject(), bids };
      }));
    res.json({ message: 'Client cases fetched', cases: casesWithBids });
  } catch (error) {
    console.error('❌ Fetch Client Cases Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Get case documents
export const getCaseDocuments = async (req, res) => {
    try {
        const { caseId } = req.params;
        const caseData = await Case.findById(caseId);
        if (!caseData) return res.status(404).json({ message: 'Case not found' });
        if (caseData.client.toString() !== req.user.id && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        res.json({
            message: 'Case documents fetched',
            documents: caseData.documents,
        });
    } catch (error) {
        console.error('❌ Fetch Case Documents Error:', error.message);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// Delete a case document
export const deleteCaseDocument = async (req, res) => {
    try {
        const { caseId, documentId } = req.params;
        const clientId = req.user.id;

        const caseData = await Case.findById(caseId);
        if (!caseData) return res.status(404).json({ message: 'Case not found' });
        if (caseData.client.toString() !== clientId && req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Only the case owner or an admin can delete documents' });
        }

        const documentIndex = caseData.documents.findIndex(doc => doc._id.toString() === documentId);
        if (documentIndex === -1) return res.status(404).json({ message: 'Document not found' });

        const document = caseData.documents[documentIndex];
        const filePath = path.resolve(document.filePath); // Resolve absolute path

        // Remove document from array
        caseData.documents.splice(documentIndex, 1);
        await caseData.save();

        // Delete the physical file
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('❌ File Deletion Error:', err.message);
                // Don’t fail the request if file deletion fails, just log it
            }
        });

        res.json({
            message: 'Document deleted successfully',
            documents: caseData.documents,
        });
    } catch (error) {
        console.error('❌ Delete Case Document Error:', error.message);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// Update a case
export const updateCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { description, category, deadline } = req.body;
    const files = req.files;
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
    if (category) {
      if (!['Contract', 'Family', 'Criminal', 'Property', 'Labor', 'Other'].includes(category)) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      caseData.category = category;
    }
    if (deadline) {
      const parsedDeadline = new Date(deadline);
      if (isNaN(parsedDeadline) || parsedDeadline < Date.now()) {
        return res.status(400).json({ message: 'Deadline must be a valid future date' });
      }
      caseData.deadline = parsedDeadline;
    }
if (files && files.length > 0) {
            const newDocuments = files.map(file => ({
                filePath: file.path,
                fileName: file.originalname,
            }));
            caseData.documents = [...caseData.documents, ...newDocuments]; // Append new files
        }
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
