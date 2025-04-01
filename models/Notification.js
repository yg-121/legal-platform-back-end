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
    enum: ['Bid', 'Appointment', 'Chat', 'BidAccepted', 'new_lawyer', 'new_case', 'case_closed'], // Added new_case, case_closed
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
      return this.type === 'new_lawyer'; // Only true for new_lawyer (admin-specific)
    } 
  }
});

export default mongoose.model('Notification', NotificationSchema);