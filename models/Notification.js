import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    message: { 
        type: String, 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['Bid', 'Appointment', 'Chat', 'BidAccepted'], // Added 'BidAccepted'
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
    }
});

export default mongoose.model('Notification', NotificationSchema);