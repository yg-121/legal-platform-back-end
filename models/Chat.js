import mongoose from 'mongoose';

const ChatSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: false },
    file: { type: String, required: false },
    read: { type: Boolean, default: false }, // Added for unread tracking
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Chat', ChatSchema);