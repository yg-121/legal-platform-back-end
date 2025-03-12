import Case from '../models/Case.js';
import Audit from '../models/Audit.js'; // Add this

export const createCase = async (req, res) => {
  try {
    const { description } = req.body;
    const file_id = req.file ? req.file.path : null;
    const client = req.user.id;

    if (!description) return res.status(400).json({ message: 'Description is required' });
    if (description.length > 500) return res.status(400).json({ message: 'Description must be under 500 characters' });

    const newCase = new Case({ client, description, file_id });
    await newCase.save();

    res.status(201).json(newCase);
  } catch (error) {
    console.error('❌ Case Creation Error:', error.message);
    res.status(500).json({ message: 'Failed to create case', error: error.message });
  }
};

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

export const getClientCases = async (req, res) => {
  try {
    const cases = await Case.find({ client: req.user.id });
    res.json(cases);
  } catch (error) {
    console.error('❌ Fetch Client Cases Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

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

    // Audit log (currently client-only, but future-proof for admin)
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