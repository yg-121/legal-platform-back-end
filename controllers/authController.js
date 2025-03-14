import User from '../models/User.js';
import Notification from '../models/Notification.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto'; // For reset token
import { sendNotification } from '../utils/notify.js';
import upload from '../utils/upload.js';

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, status: user.status },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
};

export const registerUser = async (req, res) => {
  try {
    const { username, email, password, role, phone, specialization, location } = req.body;
    const license_file = req.file ? req.file.path : null;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ message: 'Username, email, password, and role are required' });
    }

    if (role === 'Lawyer') {
      if (!license_file) {
        return res.status(400).json({ message: 'License file upload is required for Lawyers' });
      }
      if (!specialization) {
        return res.status(400).json({ message: 'Specialization is required for Lawyers' });
      }
      if (!location) {
        return res.status(400).json({ message: 'Location is required for Lawyers' });
      }
    }

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'Email already exists' });

    const newUser = new User({ 
      username, 
      email, 
      password, 
      role,
      phone: phone || undefined,
      license_file: role === 'Lawyer' ? license_file : undefined,
      specialization: role === 'Lawyer' ? specialization : undefined,
      location: role === 'Lawyer' ? location : undefined
    });
    await newUser.save();

    // Trigger notification for new lawyer
    if (role === 'Lawyer') {
      const notification = new Notification({
        message: `New lawyer registered: ${username}`,
        type: 'new_lawyer',
        user: null, // Admin notification, no specific user
        isAdminNotification: true,
      });
      await notification.save();

      // Notify all admins
      const admins = await User.find({ role: 'Admin' });
      for (const admin of admins) {
        await sendNotification(
          admin._id, // Admin ID
          `A new lawyer, ${username}, has registered and is pending approval.`,
          'new_lawyer'
        );
      }
    }

    res.status(201).json({ 
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      license_file: newUser.license_file,
      token: generateToken(newUser) 
    });
  } catch (error) {
    console.error('❌ Registration Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const registerUserWithUpload = [upload, registerUser];

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.role === 'Lawyer' && user.status === 'Pending') {
      return res.status(403).json({ message: `Account is ${user.status}. Please wait, you will be approved very soon.` });
    }

    if (user.role === 'Lawyer' && user.status === 'Rejected') {
      return res.status(403).json({ message: `Account is ${user.status}. Please register again,with legal license` });
    }

    res.json({ 
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      license_file: user.license_file,
      token: generateToken(user) 
    });
  } catch (error) {
    console.error('❌ Login Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' }); // Vague for security
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${email}`;
    await sendNotification(
      user._id,
      `You requested a password reset. Click here: ${resetUrl}\nThis link expires in 1 hour.`,
      'password_reset'
    );

    res.json({ message: 'Password reset link sent to your email' });
  } catch (error) {
    console.error('❌ Password Reset Request Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = newPassword; // Pre-save hook hashes it
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('❌ Password Reset Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};