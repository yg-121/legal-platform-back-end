import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: function() { 
      return !['new_lawyer', 'new_case'].includes(this.type); // Optional for new_lawyer and new_case
    }
  },
  message: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['Bid', 'Appointment','lawyer_password_change','lawyer_profile_update','client_profile_update','client_password_change','admin_profile_update','admin_password_change','Chat', 'BidAccepted', 'new_lawyer', 'deadline', 'new_case', 'form_created', 'form_signed', 'note_added', 'case_closed', 'lawyer_approved_admin', 'lawyer_rejected_admin', 'reviewer_assigned_admin', 'role_assigned'], // Added role_assigned
    required: true 
  },
  status: { 
    type: String, 
    enum: ['Unread', 'Read'], 
    default: 'Unread' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  isAdminNotification: { 
    type: Boolean, 
    default: function() { 
      return ['new_lawyer', 'lawyer_approved_admin', 'lawyer_rejected_admin', 'reviewer_assigned_admin'].includes(this.type); // Unchanged
    } 
  }
});

export default mongoose.model('Notification', NotificationSchema);