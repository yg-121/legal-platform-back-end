import mongoose from 'mongoose';

const AuditSchema = new mongoose.Schema({
  admin: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  action: { 
    type: String, 
    required: true,
    enum: [
      'approve_lawyer', 
      'reject_lawyer', 
      'delete_user', 
      'add_admin', 
      'update_profile', 
      'change_password', 
      'close_case' 
    ] 
  },
  target: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: false // Optional for actions not targeting a user (e.g., case-related)
  },
  details: { 
    type: String, 
    required: false // Extra info (e.g., case ID)
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

export default mongoose.model('Audit', AuditSchema);