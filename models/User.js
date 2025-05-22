import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
  firstName: { type: String, required: false, trim: true },
  lastName: { type: String, required: false, trim: true },
  email: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true, minlength: 8 },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Number },
  role: { type: String, enum: ['Client', 'Lawyer', 'Admin','LegalReviewer'], required: true },
  phone: { type: String, required: false },
  license_file: { type: String, required: function() { return this.role === 'Lawyer'; } },
  profile_photo: { type: String, required: false },
  specialization: {
    type: [String],
    enum: [
      'Criminal Law', 'Family Law', 'Corporate Law', 'Immigration', 'Personal Injury',
      'Real Estate', 'Civil law', 'Marriage law', 'Intellectual Property', 'Employment Law', 'Bankruptcy', 'Tax Law'
    ],
    required: function() { return this.role === 'Lawyer'; },
    default: []
  },
  location: { type: String, required: function() { return this.role === 'Lawyer'; }, trim: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Active', 'Rejected'], 
    default: function() { return this.role === 'Lawyer' ? 'Pending' : 'Active'; }
  },
  ratings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Rating' }],
  averageRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  yearsOfExperience: {
    type: Number,
    min: 0,
    default: 0,
    required: function() { return this.role === 'Lawyer'; }
  },
  bio: { type: String, maxlength: 500, trim: true, default: '' },
  certifications: { type: [String], default: [] },
  hourlyRate: { type: Number, min: 0, default: 0 },
  isAvailable: { type: Boolean, default: true },
  languages: { type: [String], default: ['English'] },
  verificationStatus: {
    type: String,
    enum: ['Pending', 'Verified', 'Rejected'],
    default: 'Pending',
    required: function() { return this.role === 'Lawyer'; }
  },
  // New field for blocked users
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Indexes for efficient queries
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ specialization: 1 });
UserSchema.index({ location: 1 });
UserSchema.index({ verificationStatus: 1 });

export default mongoose.model('User', UserSchema);
