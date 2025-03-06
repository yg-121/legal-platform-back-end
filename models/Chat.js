import mongoose from 'mongoose';

const ChatSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: false }, // Optional if file is sent
    file: { type: String, required: false }, // Path to uploaded file
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Chat', ChatSchema);