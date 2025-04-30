import Case from '../models/Case.js';
import Bid from '../models/Bid.js';
import Audit from '../models/Audit.js';
import User from '../models/User.js';
import { sendNotification } from '../utils/notify.js';
import { io } from '../index.js';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    const documents = files
      ? files.map((file) => ({
          filePath: file.path,
          fileName: file.originalname,
          category: 'Evidence',
          visibility: 'Both',
          uploadedBy: client,
        }))
      : [];

    const newCase = new Case({
      client,
      description,
      category,
      deadline: parsedDeadline,
      documents,
      status: 'Posted',
    });
    await newCase.save();

    const lawyers = await User.find({ role: 'Lawyer' });
    for (const lawyer of lawyers) {
      await sendNotification(
        lawyer._id,
        `New ${category} case posted: ${description.substring(0, 50)}... (Deadline: ${parsedDeadline.toLocaleDateString()})`,
        'new_case'
      );
    }

    io.emit('new_case', { caseId: newCase._id, category, description });
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
      `Lawyer ${lawyerData.username} (Rating: ${lawyerData.averageRating || 0}/5, ${
        lawyerData.ratingCount || 0
      } reviews) bid ${amount} ETB on your ${caseExists.category} case: "${
        caseExists.description
      }" (Deadline: ${caseExists.deadline.toLocaleDateString()})${comment ? ` - "${comment}"` : ''}`,
      'Bid'
  );
  await sendNotification(
    caseExists.client,
    `Lawyer ${req.user.username} bid ${amount} ETB on your ${caseExists.category} case: "${caseExists.description}" (Deadline: ${caseExists.deadline.toLocaleDateString()})${comment ? ` - "${comment}"` : ''}`,
    'Bid'
  );


    io.emit('new_bid', { caseId, bidId: bid._id, amount });
    res.status(201).json({ message: 'Bid placed', bid });
  } catch (error) {
    console.error('❌ Bid Error:', error.message);
    res.status(500).json({ message: 'Failed to place bid', error: error.message });
  }
};

// Accept a bid
export const acceptBid = async (req, res) => {
  try {
    const { caseId, bidId } = req.body;
    const clientId = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    if (caseData.client.toString() !== clientId) {
      return res.status(403).json({ message: 'Only the case owner can accept bids' });
    }
    if (caseData.status !== 'Posted') {
      return res.status(400).json({ message: 'Cannot accept bid on a non-posted case' });
    }

    const bid = await Bid.findById(bidId).populate('lawyer', 'username email');
    if (!bid || bid.case.toString() !== caseId) {
      return res.status(404).json({ message: 'Bid not found' });
    }

    caseData.winning_bid = bidId;
    caseData.assigned_lawyer = bid.lawyer._id;
    caseData.status = 'Assigned';
    await caseData.save();

    await sendNotification(
      bid.lawyer._id,
      `Your bid of ${bid.amount} ETB was accepted for case: ${caseData.description}`,
      'bid_accepted'
    );
    await sendNotification(
      clientId,
      `You accepted ${bid.lawyer.username}'s bid for case: ${caseData.description}`,
      'bid_accepted'
    );

    io.emit('bid_accepted', { caseId, bidId, lawyerId: bid.lawyer._id });
    res.json({ message: 'Bid accepted', case: caseData });
  } catch (error) {
    console.error('❌ Accept Bid Error:', error.message);
    res.status(500).json({ message: 'Failed to accept bid', error: error.message });
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

// Get case bids
export const getCaseBids = async (req, res) => {
  try {
    const { caseId } = req.params;
    const clientId = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    if (caseData.client.toString() !== clientId) {
      return res.status(403).json({ message: 'Only the case owner can view bids' });
    }

    const bids = await Bid.find({ case: caseId }).populate('lawyer', 'username averageRating ratingCount');
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
    const casesWithBids = await Promise.all(
      cases.map(async (c) => {
        const bids = await Bid.find({ case: c._id }).populate('lawyer', 'username averageRating ratingCount');
        return { ...c.toObject(), bids };
      })
    );
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
    const userId = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    if (
      caseData.client.toString() !== userId &&
      caseData.assigned_lawyer?.toString() !== userId &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const documents = caseData.documents.filter(
      (doc) =>
        doc.visibility === 'Both' ||
        (doc.visibility === 'Client' && caseData.client.toString() === userId) ||
        (doc.visibility === 'Lawyer' && caseData.assigned_lawyer?.toString() === userId)
    );

    res.json({
      message: 'Case documents fetched',
      documents,
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
    const userId = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    if (
      caseData.client.toString() !== userId &&
      caseData.assigned_lawyer?.toString() !== userId &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const documentIndex = caseData.documents.findIndex((doc) => doc._id.toString() === documentId);
    if (documentIndex === -1) return res.status(404).json({ message: 'Document not found' });

    const document = caseData.documents[documentIndex];
    const filePath = path.resolve(document.filePath);

    caseData.documents.splice(documentIndex, 1);
    await caseData.save();

    await fs.unlink(filePath).catch((err) => {
      console.error('❌ File Deletion Error:', err.message);
    });

    await sendNotification(
      caseData.client.toString() === userId ? caseData.assigned_lawyer : caseData.client,
      `Document deleted from case: ${caseData.description}`,
      'case_updated'
    );

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
      if (description.length > 500) {
        return res.status(400).json({ message: 'Description must be under 500 characters' });
      }
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
      const newDocuments = files.map((file) => ({
        filePath: file.path,
        fileName: file.originalname,
        category: 'Evidence',
        visibility: 'Both',
        uploadedBy: clientId,
      }));
      caseData.documents = [...caseData.documents, ...newDocuments];
    }

    await caseData.save();

    if (caseData.assigned_lawyer) {
      await sendNotification(
        caseData.assigned_lawyer,
        `Case updated: ${caseData.description}`,
        'case_updated'
      );
    }

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

    for (const doc of caseData.documents) {
      await fs.unlink(path.resolve(doc.filePath)).catch((err) => {
        console.error('❌ File Deletion Error:', err.message);
      });
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
    if (caseData.client.toString() !== clientId) {
      return res.status(403).json({ message: 'Only the case owner can close it' });
    }
    if (caseData.status === 'Closed') {
      return res.status(400).json({ message: 'Case is already closed' });
    }

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

    io.emit('case_closed', { caseId });
    res.json({ message: 'Case closed successfully', case: caseData });
  } catch (error) {
    console.error('❌ Case Close Error:', error.message);
    res.status(500).json({ message: 'Failed to close case', error: error.message });
  }
};

// Add additional deadline
export const addDeadline = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { title, date, assignedTo } = req.body;
    const userId = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    if (
      caseData.client.toString() !== userId &&
      caseData.assigned_lawyer?.toString() !== userId &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (!title || !date) {
      return res.status(400).json({ message: 'Title and date are required' });
    }
    const parsedDate = new Date(date);
    if (isNaN(parsedDate) || parsedDate < Date.now()) {
      return res.status(400).json({ message: 'Deadline must be a valid future date' });
    }

    const deadline = {
      title,
      date: parsedDate,
      assignedTo: assignedTo || null,
      completed: false,
    };
    caseData.additionalDeadlines.push(deadline);
    await caseData.save();

    if (assignedTo) {
      const user = await User.findById(assignedTo);
      if (user) {
        const transporter = nodemailer.createTransport({
          service: 'Gmail',
          auth: { user: process.env.EMAIL_HOST_USER, pass: process.env.EMAIL_HOST_PASSWORD },
        });
        await transporter.sendMail({
          to: user.email,
          from: process.env.EMAIL_HOST_USER,
          subject: `New Deadline: ${title}`,
          text: `You have a new deadline for case "${caseData.description}": ${title} due on ${parsedDate.toLocaleString()}.`,
        });
        await sendNotification(
          assignedTo,
          `New deadline: ${title} for case ${caseData.description}`,
          'deadline'
        );
      }
    }

    io.emit('new_deadline', { caseId, deadline });
    res.json({ message: 'Deadline added', case: caseData });
  } catch (error) {
    console.error('❌ Add Deadline Error:', error.message);
    res.status(500).json({ message: 'Failed to add deadline', error: error.message });
  }
};

// Complete a deadline
export const completeDeadline = async (req, res) => {
  try {
    const { caseId, deadlineId } = req.params;
    const userId = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    if (
      caseData.client.toString() !== userId &&
      caseData.assigned_lawyer?.toString() !== userId &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const deadline = caseData.additionalDeadlines.id(deadlineId);
    if (!deadline) return res.status(404).json({ message: 'Deadline not found' });
    if (deadline.completed) return res.status(400).json({ message: 'Deadline already completed' });

    deadline.completed = true;
    await caseData.save();

    await sendNotification(
      caseData.client.toString() === userId ? caseData.assigned_lawyer : caseData.client,
      `Deadline completed: ${deadline.title} for case ${caseData.description}`,
      'deadline'
    );

    io.emit('deadline_completed', { caseId, deadlineId });
    res.json({ message: 'Deadline completed', case: caseData });
  } catch (error) {
    console.error('❌ Complete Deadline Error:', error.message);
    res.status(500).json({ message: 'Failed to complete deadline', error: error.message });
  }
};

/// Create legal form
export const createLegalForm = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { templateId, name, language } = req.body;
    const userId = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    if (
      caseData.client.toString() !== userId &&
      caseData.assigned_lawyer?.toString() !== userId &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const templates = {
      affidavit_v1: {
        name: 'Affidavit',
        fields: ['clientName', 'caseDescription', 'date'],
        path: path.join(__dirname, '../templates/Affidavit.pdf'),
      },
      power_of_attorney_v1: {
        name: 'Power of Attorney',
        fields: ['clientName', 'lawyerName', 'date'],
        path: path.join(__dirname, '../templates/power_of_attorney.pdf'),
      },
      lease_agreement_v1: {
        name: 'Lease Agreement',
        fields: ['clientName', 'propertyDetails', 'date'],
        path: path.join(__dirname, '../templates/lease_agreement.pdf'),
      },
    };

    if (!templates[templateId]) {
      return res.status(400).json({ message: 'Invalid template ID' });
    }

    const template = templates[templateId];
    const uploadsDir = path.join(__dirname, '../uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const pdfPath = path.join(uploadsDir, `form-${caseId}-${templateId}-${Date.now()}.pdf`);

    let pdfDoc;
    try {
      const pdfBytes = await fs.readFile(template.path).catch((err) => {
        throw new Error(`Template file not found: ${template.path} (${err.message})`);
      });
      pdfDoc = await PDFDocument.load(pdfBytes);
    } catch (error) {
      console.warn(`Failed to load PDF template: ${error.message}. Creating blank PDF.`);
      pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      page.drawText(`Placeholder ${template.name}`, { x: 50, y: 500 });
    }

    let form;
    try {
      form = pdfDoc.getForm();
      const client = await User.findById(caseData.client);
      const lawyer = caseData.assigned_lawyer ? await User.findById(caseData.assigned_lawyer) : null;
      const fieldValues = {
        clientName: client.username,
        lawyerName: lawyer?.username || 'N/A',
        caseDescription: caseData.description,
        date: new Date().toLocaleDateString(),
        propertyDetails: caseData.category === 'Property' ? caseData.description : 'N/A',
      };

      template.fields.forEach((field) => {
        try {
          const textField = form.getTextField(field);
          if (textField && fieldValues[field]) {
            textField.setText(fieldValues[field]);
          }
        } catch (err) {
          console.warn(`Field ${field} not found in PDF`);
        }
      });

      form.flatten();
    } catch (error) {
      console.warn(`Form processing failed: ${error.message}. Saving without fields.`);
    }

    const pdfBytesFilled = await pdfDoc.save();
    try {
      await fs.writeFile(pdfPath, pdfBytesFilled);
      console.log(`✅ PDF saved: ${pdfPath}`);
    } catch (error) {
      console.error(`❌ Failed to save PDF: ${error.message}`);
      throw new Error(`Failed to save PDF: ${error.message}`);
    }

    const formData = {
      templateId,
      name: name || template.name,
      language: language || 'English',
      generatedFile: `/uploads/${path.basename(pdfPath)}`, // Lowercase /uploads/
      status: 'Draft',
      createdBy: userId,
    };
    caseData.formTemplates.push(formData);
    caseData.documents.push({
      filePath: `/uploads/${path.basename(pdfPath)}`, // Lowercase /uploads/
      fileName: `${name || template.name}.pdf`,
      category: 'Form',
      visibility: 'Both',
      uploadedBy: userId,
    });
    await caseData.save();

    try {
      await sendNotification(
        caseData.client.toString() === userId ? caseData.assigned_lawyer : caseData.client,
        `New form created for case: ${caseData.description}`,
        'form_created'
      );
    } catch (error) {
      console.warn(`Notification failed: ${error.message}`);
    }

    io.emit('form_created', { caseId, formId: formData._id });
    res.json({ message: 'Form created', case: caseData });
  } catch (error) {
    console.error('❌ Create Form Error:', error.message);
    res.status(500).json({ message: 'Failed to create form', error: error.message });
  }
};

// Sign legal form
export const signForm = async (req, res) => {
  try {
    const { caseId, formId } = req.params;
    const userId = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    if (
      caseData.client.toString() !== userId &&
      caseData.assigned_lawyer?.toString() !== userId &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const form = caseData.formTemplates.id(formId);
    if (!form) return res.status(404).json({ message: 'Form not found' });
    if (form.status !== 'Draft') {
      return res.status(400).json({ message: 'Form cannot be signed' });
    }

    form.status = 'Signed';
    await caseData.save();

    await sendNotification(
      caseData.client.toString() === userId ? caseData.assigned_lawyer : caseData.client,
      `Form signed for case: ${caseData.description}`,
      'form_signed'
    );

    io.emit('form_signed', { caseId, formId });
    res.json({ message: 'Form signed', case: caseData });
  } catch (error) {
    console.error('❌ Sign Form Error:', error.message);
    res.status(500).json({ message: 'Failed to sign form', error: error.message });
  }
};

// Add note
export const addNote = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { content, visibility } = req.body;
    const userId = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) return res.status(404).json({ message: 'Case not found' });
    if (
      caseData.client.toString() !== userId &&
      caseData.assigned_lawyer?.toString() !== userId &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (!content) {
      return res.status(400).json({ message: 'Note content is required' });
    }

    caseData.notes.push({
      content,
      createdBy: userId,
      visibility: visibility || 'Both',
    });
    await caseData.save();

    await sendNotification(
      caseData.client.toString() === userId ? caseData.assigned_lawyer : caseData.client,
      `New note added to case: ${caseData.description}`,
      'note_added'
    );

    io.emit('note_added', { caseId, note: content });
    res.json({ message: 'Note added', case: caseData });
  } catch (error) {
    console.error('❌ Add Note Error:', error.message);
    res.status(500).json({ message: 'Failed to add note', error: error.message });
  }
};

// Get case analytics
export const getCaseAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'Admin' && userRole !== 'Lawyer') {
      return res.status(403).json({ message: 'Only admins and lawyers can view analytics' });
    }

    const query = userRole === 'Lawyer' ? { assigned_lawyer: userId } : {};
    const cases = await Case.find(query);

    const analytics = {
      totalCases: cases.length,
      byStatus: {
        Posted: cases.filter((c) => c.status === 'Posted').length,
        Assigned: cases.filter((c) => c.status === 'Assigned').length,
        Closed: cases.filter((c) => c.status === 'Closed').length,
      },
      byCategory: {
        Contract: cases.filter((c) => c.category === 'Contract').length,
        Family: cases.filter((c) => c.category === 'Family').length,
        Criminal: cases.filter((c) => c.category === 'Criminal').length,
        Property: cases.filter((c) => c.category === 'Property').length,
        Labor: cases.filter((c) => c.category === 'Labor').length,
        Other: cases.filter((c) => c.category === 'Other').length,
      },
      formUsage: cases.reduce((acc, c) => {
        c.formTemplates.forEach((f) => {
          acc[f.name] = (acc[f.name] || 0) + 1;
        });
        return acc;
      }, {}),
      activeDeadlines: cases.reduce(
        (acc, c) => acc + c.additionalDeadlines.filter((d) => !d.completed).length,
        0
      ),
    };

    res.json({ message: 'Analytics fetched', analytics });
  } catch (error) {
    console.error('❌ Analytics Error:', error.message);
    res.status(500).json({ message: 'Failed to fetch analytics', error: error.message });
  }
};

// Get case details (client portal)
export const getCaseDetails = async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;

    console.log(`Fetching case ${caseId} for user ${userId}, role: ${req.user.role}`);

    const caseData = await Case.findById(caseId)
      .populate('client', 'username email')
      .populate('assigned_lawyer', 'username email')
      .populate('winning_bid', 'amount lawyer')
      .populate('documents.uploadedBy', 'username')
      .populate('formTemplates.createdBy', 'username')
      .populate('notes.createdBy', 'username')
      .populate('additionalDeadlines.assignedTo', 'username');

    if (!caseData) {
      console.log(`Case ${caseId} not found`);
      return res.status(404).json({ message: 'Case not found' });
    }

    console.log(`Case client: ${caseData.client._id}, lawyer: ${caseData.assigned_lawyer?._id}`);

    // Ensure proper ObjectId comparison
    const isClient = caseData.client._id.toString() === userId;
    const isLawyer = caseData.assigned_lawyer && caseData.assigned_lawyer._id.toString() === userId;
    const isAdmin = req.user.role === 'Admin';
    const isPostedCase = req.user.role === 'Lawyer' && caseData.status === 'Posted';

    console.log(`Auth check: isClient=${isClient}, isLawyer=${isLawyer}, isAdmin=${isAdmin}`);

    if (!isClient && !isLawyer && !isAdmin && !isPostedCase) {
      console.log(`Unauthorized: user ${userId} not client, lawyer, or Admin`);
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const filteredCase = {
      ...caseData.toObject(),
      documents: caseData.documents.filter(
        (doc) =>
          doc.visibility === 'Both' ||
          (doc.visibility === 'Client' && caseData.client._id.toString() === userId) ||
          (doc.visibility === 'Lawyer' && caseData.assigned_lawyer?._id.toString() === userId)
      ),
      notes: caseData.notes.filter(
        (note) =>
          note.visibility === 'Both' ||
          (note.visibility === 'Client' && caseData.client._id.toString() === userId) ||
          (note.visibility === 'Lawyer' && caseData.assigned_lawyer?._id.toString() === userId)
      ),
    };

    res.json({ message: 'Case details fetched', case: filteredCase });
  } catch (error) {
    console.error('❌ Fetch Case Details Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};