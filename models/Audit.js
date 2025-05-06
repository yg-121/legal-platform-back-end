import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // Ensure user is required
  },
  action: {
    type: String,
    required: true,
    enum: [
      'approve_lawyer',
      'reject_lawyer',
      'update_profile',
      'change_password',
      'delete_user',
      'add_admin',
      'assign_reviewer',
      'login',
      'logout',
      'create',
      'update',
      'delete'
    ]
  },
  target: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  // Allow population of fields not explicitly defined
  strictPopulate: false
});

export default mongoose.model('Audit', auditSchema);
