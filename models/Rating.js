import mongoose from 'mongoose';

const RatingSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lawyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  case: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  rating: { type: Number, min: 1, max: 5 }, // Not required until submitted
  comment: { type: String, maxLength: 500 },
  status: {
    type: String,
    enum: ['Pending', 'Dismissed', 'Completed'],
    default: 'Pending',
  },
  createdAt: { type: Date, default: Date.now },
  lastRemindedAt: { type: Date }, // For rescheduling reminders
});

export default mongoose.model('Rating', RatingSchema);