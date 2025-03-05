import mongoose from 'mongoose';

const CaseSchema = new mongoose.Schema({
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['Posted', 'Assigned', 'Closed'], default: 'Posted' },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Case', CaseSchema);