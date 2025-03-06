import mongoose from 'mongoose';

const BidSchema = new mongoose.Schema({
    lawyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    case: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
    amount: { type: Number, required: true }, // Bid amount in currency (e.g., ETB)
    comment: { type: String, required: false }, // Optional lawyer comment
    status: { type: String, enum: ['Pending', 'Accepted', 'Rejected'], default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Bid', BidSchema);