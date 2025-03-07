import mongoose from 'mongoose';

const RatingSchema = new mongoose.Schema({
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lawyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    case: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxLength: 500 },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Rating', RatingSchema);