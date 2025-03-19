import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Number },
    role: { type: String, enum: ['Client', 'Lawyer', 'Admin'], required: true },
    phone: { type: String, required: false },
    license_file: { type: String, required: function() { return this.role === 'Lawyer'; } },
    profile_photo: { type: String, required: false }, // Optional, set post-approval
    specialization: { type: String, required: function() { return this.role === 'Lawyer'; } },
    location: { type: String, required: function() { return this.role === 'Lawyer'; } },
    status: { 
        type: String, 
        enum: ['Pending', 'Active', 'Rejected'], 
        default: function() { return this.role === 'Lawyer' ? 'Pending' : 'Active'; }
    },
    ratings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Rating' }],
    averageRating: { type: Number, default: 0 }
    
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

UserSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', UserSchema);