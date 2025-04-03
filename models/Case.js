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
    status: { type: String, enum: ['Posted', 'Assigned', 'Closed'], default: 'Posted' },
    file_id: { type: String, required: false }, // For case documents
    winning_bid: { type: mongoose.Schema.Types.ObjectId, ref: 'Bid', default: null },
    assigned_lawyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

CaseSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('Case', CaseSchema);