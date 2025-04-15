import mongoose from 'mongoose';

const CaseSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['Contract', 'Family', 'Criminal', 'Property', 'Labor', 'Other'], // Add your categories
    required: true,
  },
  deadline: {
    type: Date,
    required: true,
  },
  additionalDeadlines: [
    {
      title: { type: String, required: true },
      date: { type: Date, required: true },
      completed: { type: Boolean, default: false },
      assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  ],
  status: { type: String, enum: ['Posted', 'Assigned', 'Closed'], default: 'Posted' },
  documents: [
    {
      filePath: { type: String, required: true },
      fileName: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
      category: { type: String, enum: ['Evidence', 'Form', 'Correspondence'], default: 'Evidence' },
      visibility: { type: String, enum: ['Client', 'Lawyer', 'Both'], default: 'Both' },
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  ],
  winning_bid: { type: mongoose.Schema.Types.ObjectId, ref: 'Bid', default: null },
  assigned_lawyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  formTemplates: [
    {
      templateId: { type: String, required: true }, // e.g., "affidavit_v1"
      name: { type: String, required: true }, // e.g., "Affidavit"
      language: { type: String, enum: ['English', 'Amharic'], default: 'English' },
      generatedFile: { type: String }, // Path to PDF
      status: { type: String, enum: ['Draft', 'Signed', 'Finalized'], default: 'Draft' },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  notes: [
    {
      content: { type: String, required: true },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now },
      visibility: { type: String, enum: ['Client', 'Lawyer', 'Both'], default: 'Both' },
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

CaseSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

CaseSchema.index({ client: 1, status: 1 });
CaseSchema.index({ assigned_lawyer: 1, status: 1 });

export default mongoose.model('Case', CaseSchema);