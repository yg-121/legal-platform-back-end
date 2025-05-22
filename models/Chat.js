import mongoose from 'mongoose';

const ChatSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      trim: true,
    },
    fileUrl: {
      type: String,
      trim: true,
    },
    fileName: {
      type: String,
      trim: true,
    },
    fileType: {
      type: String,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Prevent sender and receiver from being the same
ChatSchema.pre('save', function (next) {
  if (this.sender.toString() === this.receiver.toString()) {
    return next(new Error('Sender and receiver cannot be the same'));
  }
  next();
});

// Indexes for efficient queries
ChatSchema.index({ sender: 1 });
ChatSchema.index({ receiver: 1 });

export default mongoose.model('Chat', ChatSchema);