import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Changed from admin to user
  action: { 
    type: String, 
    enum: ['update_profile', 'change_password', 'delete_user', 'add_admin', 'approve_lawyer', 'reject_lawyer', 'assign_reviewer'], // Added new actions
    required: true 
  },
  target: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  details: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Audit', auditSchema);