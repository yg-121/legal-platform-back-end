import mongoose from 'mongoose';

const AppointmentSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  lawyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: false, // Optional link to a case
  },
  date: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Cancelled', 'Completed'],
    default: 'Pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // New fields for Clio-like features
  type: {
    type: String,
    enum: ['Meeting', 'Hearing', 'Deadline', 'Other'],
    default: 'Meeting',
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  reminderSent: {
    type: Map,
    of: Boolean,
    default: { '24h': false, '1h': false }, // Tracks reminders
  },
}, { timestamps: true });

// Index for efficient calendar queries
AppointmentSchema.index({ lawyer: 1, date: 1 });
AppointmentSchema.index({ client: 1, date: 1 });

export default mongoose.model('Appointment', AppointmentSchema);