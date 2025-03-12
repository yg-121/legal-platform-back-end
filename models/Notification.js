import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: function() { return this.type !== 'new_lawyer'; } // Optional for admin notifications
  },
  message: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['Bid', 'Appointment', 'Chat', 'BidAccepted', 'new_lawyer','password_reset'], // Added 'new_lawyer'
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
    default: function() { return this.type === 'new_lawyer'; } // True for admin-specific notifications
  }
});

export default mongoose.model('Notification', NotificationSchema);