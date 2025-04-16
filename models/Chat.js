import mongoose from 'mongoose';

const ChatSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: false }, // Text message (optional if file/voice)
  file: { 
    type: String, 
    required: false, 
    enum: ['text', 'file', 'voice', null], // Type indicator (null if only text)
    default: null 
  },
  filePath: { type: String, required: false }, // Store file path separately
  case: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: false },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Chat', ChatSchema);