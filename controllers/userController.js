import User from '../models/User.js';
import Audit from '../models/Audit.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import profileUpload from '../utils/profileUpload.js';
import nodemailer from 'nodemailer';
import Case from '../models/Case.js';
import Rating from '../models/Rating.js';
import Appointment from '../models/Appointment.js';
import Bid from '../models/Bid.js';
import Notification from '../models/Notification.js';
import { io } from '../index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getAdminProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    if (user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profile_photo: user.profile_photo,
      status: user.status,
    });
  } catch (error) {
    console.error('❌ Get Admin Profile Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const approveLawyer = async (req, res) => {
  try {
    const { lawyerId, comments } = req.body;
    if (!lawyerId) return res.status(400).json({ message: 'Lawyer ID is required' });

    const lawyer = await User.findById(lawyerId);
    if (!lawyer || lawyer.role !== 'Lawyer') return res.status(404).json({ message: 'Lawyer not found' });
    if (lawyer.status !== 'Pending') return res.status(400).json({ message: 'Lawyer is not pending approval' });

    lawyer.status = 'Active';
    lawyer.verificationStatus = 'Verified';
    await lawyer.save();

    await new Audit({
      user: req.user.id,
      action: 'approve_lawyer',
      target: lawyerId,
      details: comments || 'No comments provided',
    }).save();

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_HOST_USER,
        pass: process.env.EMAIL_HOST_PASSWORD,
      },
    });

    const mailOptions = {
      to: lawyer.email,
      from: process.env.EMAIL_HOST_USER,
      subject: "Your Lawyer Account Has Been Approved",
      text: `Dear ${lawyer.username},\n\nYour lawyer account has been approved. You can now log in and update your profile: ${process.env.FRONTEND_URL}/login\n\nWelcome to the platform!`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Approval email sent to ${lawyer.email}`);

    const admins = await User.find({ role: 'Admin' });
    for (const admin of admins) {
      const notification = new Notification({
        user: admin._id,
        message: `Lawyer ${lawyer.username} approved by ${req.user.username}. Comments: ${comments || 'None'}`,
        type: 'lawyer_approved_admin',
        isAdminNotification: true,
      });
      await notification.save();
      io.to(admin._id.toString()).emit('new_admin_notification', notification.toObject());

      const adminMailOptions = {
        to: admin.email,
        from: process.env.EMAIL_HOST_USER,
        subject: "Lawyer Approval Notification",
        text: `Dear ${admin.username},\n\nLawyer ${lawyer.username} has been approved by ${req.user.username}. Comments: ${comments || 'None'}.\n\nView details at: ${process.env.FRONTEND_URL}/admin`,
      };
      await transporter.sendMail(adminMailOptions);
      console.log(`✅ Admin approval email sent to ${admin.email}`);
    }

    res.json({
      message: 'Lawyer approved',
      lawyer: {
        _id: lawyer._id,
        username: lawyer.username,
        email: lawyer.email,
        license_file: lawyer.license_file,
        profile_photo: lawyer.profile_photo,
        status: lawyer.status,
        verificationStatus: lawyer.verificationStatus
      },
    });
  } catch (error) {
    console.error('❌ Approve Lawyer Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const rejectLawyer = async (req, res) => {
  try {
    const { lawyerId, comments } = req.body;
    if (!lawyerId) return res.status(400).json({ message: 'Lawyer ID is required' });

    const lawyer = await User.findById(lawyerId);
    if (!lawyer || lawyer.role !== 'Lawyer') return res.status(404).json({ message: 'Lawyer not found' });
    if (lawyer.status !== 'Pending') return res.status(400).json({ message: 'Lawyer is not pending approval' });

    lawyer.status = 'Rejected';
    lawyer.verificationStatus = 'Rejected';
    await lawyer.save();

    await new Audit({
      user: req.user.id,
      action: 'reject_lawyer',
      target: lawyerId,
      details: comments || 'No reason provided',
    }).save();

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_HOST_USER,
        pass: process.env.EMAIL_HOST_PASSWORD,
      },
    });

    const mailOptions = {
      to: lawyer.email,
      from: process.env.EMAIL_HOST_USER,
      subject: "Your Lawyer Account Registration",
      text: `Dear ${lawyer.username},\n\nYour lawyer account registration was rejected. Reason: ${comments || 'Not specified'}. Please update your details and reapply.\n\nThank you for your interest.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Rejection email sent to ${lawyer.email}`);

    const admins = await User.find({ role: 'Admin' });
    for (const admin of admins) {
      const notification = new Notification({
        user: admin._id,
        message: `Lawyer ${lawyer.username} rejected by ${req.user.username}. Reason: ${comments || 'None'}`,
        type: 'lawyer_rejected_admin',
        isAdminNotification: true,
      });
      await notification.save();
      io.to(admin._id.toString()).emit('new_admin_notification', notification.toObject());

      const adminMailOptions = {
        to: admin.email,
        from: process.env.EMAIL_HOST_USER,
        subject: "Lawyer Rejection Notification",
        text: `Dear ${admin.username},\n\nLawyer ${lawyer.username} has been rejected by ${req.user.username}. Reason: ${comments || 'None'}.\n\nView details at: ${process.env.FRONTEND_URL}/admin`,
      };
      await transporter.sendMail(adminMailOptions);
      console.log(`✅ Admin rejection email sent to ${admin.email}`);
    }

    res.json({
      message: 'Lawyer rejected',
      lawyer: {
        _id: lawyer._id,
        username: lawyer.username,
        email: lawyer.email,
        license_file: lawyer.license_file,
        profile_photo: lawyer.profile_photo,
        status: lawyer.status,
        verificationStatus: lawyer.verificationStatus
      },
    });
  } catch (error) {
    console.error('❌ Reject Lawyer Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const updateLawyerProfile = async (req, res) => {
  try {
    console.log('req.file:', req.file);
    const userId = req.user.id;
    const {
      username,
      email,
      specialization,
      location,
      yearsOfExperience,
      bio,
      certifications,
      hourlyRate,
      languages,
      isAvailable
    } = req.body;
    const profilePhoto = req.file;

    if (req.user.role !== 'Lawyer') {
      return res.status(403).json({ message: 'Only Lawyers can update their profile' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.status !== 'Active') {
      return res.status(403).json({ message: 'Account must be Active to update profile' });
    }

    const updatedFields = {};
    let requiresReverification = false;

    if (username) {
      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({ message: 'Username must be between 3 and 30 characters' });
      }
      const existingUsername = await User.findOne({ username, _id: { $ne: userId } });
      if (existingUsername) {
        return res.status(409).json({ message: 'Username already taken' });
      }
      updatedFields.username = username;
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      const existingEmail = await User.findOne({ email, _id: { $ne: userId } });
      if (existingEmail) {
        return res.status(409).json({ message: 'Email already in use' });
      }
      updatedFields.email = email;
    }

    if (profilePhoto) {
      if (user.profile_photo) {
        const oldPhotoPath = path.join(__dirname, '../Uploads/profiles', user.profile_photo);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }
      updatedFields.profile_photo = profilePhoto.filename;
    }

    if (specialization) {
      const specializations = Array.isArray(specialization) ? specialization : [specialization];
      const validSpecializations = [
        'Criminal Law', 'Family Law', 'Corporate Law', 'Immigration', 'Personal Injury',
        'Real Estate', 'Civil law', 'Marriage law', 'Intellectual Property', 'Employment Law',
        'Bankruptcy', 'Tax Law'
      ];
      if (!specializations.every(spec => validSpecializations.includes(spec))) {
        return res.status(400).json({ message: 'Invalid specialization' });
      }
      updatedFields.specialization = specializations;
      requiresReverification = true;
    }

    if (location) {
      updatedFields.location = location;
    }

    if (yearsOfExperience) {
      const years = parseInt(yearsOfExperience);
      if (isNaN(years) || years < 0) {
        return res.status(400).json({ message: 'Invalid years of experience' });
      }
      updatedFields.yearsOfExperience = years;
    }

    if (bio) {
      updatedFields.bio = bio.substring(0, 500);
    }

    if (certifications) {
      updatedFields.certifications = Array.isArray(certifications) ? certifications : [certifications];
    }

    if (hourlyRate) {
      const rate = parseFloat(hourlyRate);
      if (isNaN(rate) || rate < 0) {
        return res.status(400).json({ message: 'Invalid hourly rate' });
      }
      updatedFields.hourlyRate = rate;
    }

    if (languages) {
      updatedFields.languages = Array.isArray(languages) ? languages : [languages];
    }

    if (typeof isAvailable !== 'undefined') {
      updatedFields.isAvailable = isAvailable === 'true' || isAvailable === true;
    }

    if (requiresReverification) {
      updatedFields.verificationStatus = 'Pending';
      updatedFields.status = 'Pending';
    }

    console.log('updatedFields:', updatedFields);
    console.log('user before update:', user);

    await User.updateOne(
      { _id: userId },
      { $set: updatedFields }
    );

    const updatedUser = await User.findById(userId).select('-password');
    console.log('user after update:', updatedUser);

    await Audit.create({
      user: userId,
      action: 'update_profile',
      target: userId,
      details: JSON.stringify({ updatedFields })
    });

    if (email || requiresReverification) {
      const admins = await User.find({ role: 'Admin' });
      const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: process.env.EMAIL_HOST_USER,
          pass: process.env.EMAIL_HOST_PASSWORD,
        },
      });

      for (const admin of admins) {
        const message = email
          ? `Lawyer ${user.username} updated their email to ${email}.`
          : `Lawyer ${user.username} updated specialization to ${updatedFields.specialization.join(', ')}. Please re-verify.`;
        const notification = new Notification({
          user: admin._id,
          message,
          type: 'lawyer_profile_update',
          isAdminNotification: true,
        });
        await notification.save();
        io.to(admin._id.toString()).emit('new_admin_notification', notification.toObject());

        const adminMailOptions = {
          to: admin.email,
          from: process.env.EMAIL_HOST_USER,
          subject: 'Lawyer Profile Update Notification',
          text: `Dear ${admin.username},\n\n${message}\n\nView details at: ${process.env.FRONTEND_URL}/admin`,
        };
        await transporter.sendMail(adminMailOptions);
        console.log(`✅ Admin notification email sent to ${admin.email}`);
      }
    }

    res.json({ message: 'Lawyer profile updated successfully', user: updatedUser });
  } catch (error) {
    console.error('❌ Update Lawyer Profile Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const updateLawyerProfileWithUpload = [profileUpload, updateLawyerProfile];

export const changeLawyerPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (req.user.role !== 'Lawyer') {
      return res.status(403).json({ message: 'Only Lawyers can change their password' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    user.password = newPassword;
    await user.save();

    await Audit.create({
      user: userId,
      action: 'change_password',
      target: userId,
      details: JSON.stringify({ message: 'Lawyer changed their password' })
    });

    const admins = await User.find({ role: 'Admin' });
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_HOST_USER,
        pass: process.env.EMAIL_HOST_PASSWORD,
      },
    });

    for (const admin of admins) {
      const notification = new Notification({
        user: admin._id,
        message: `Lawyer ${user.username} changed their password.`,
        type: 'lawyer_password_change',
        isAdminNotification: true,
      });
      await notification.save();
      io.to(admin._id.toString()).emit('new_admin_notification', notification.toObject());

      const adminMailOptions = {
        to: admin.email,
        from: process.env.EMAIL_HOST_USER,
        subject: 'Lawyer Password Change Notification',
        text: `Dear ${admin.username},\n\nLawyer ${user.username} has changed their password.\n\nView details at: ${process.env.FRONTEND_URL}/admin`,
      };
      await transporter.sendMail(adminMailOptions);
      console.log(`✅ Admin notification email sent to ${admin.email}`);
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('❌ Change Lawyer Password Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const updateAdminProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email, phone } = req.body;
    const profilePhoto = req.file;

    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedFields = {};

    if (username) {
      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({ message: 'Username must be between 3 and 30 characters' });
      }
      const existingUsername = await User.findOne({ username, _id: { $ne: userId } });
      if (existingUsername) {
        return res.status(409).json({ message: 'Username already taken' });
      }
      updatedFields.username = username;
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      const existingEmail = await User.findOne({ email, _id: { $ne: userId } });
      if (existingEmail) {
        return res.status(409).json({ message: 'Email already in use' });
      }
      updatedFields.email = email;
    }

    if (phone) {
      const phoneRegex = /^\+?[\d\s-]{7,15}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ message: 'Invalid phone number format' });
      }
      updatedFields.phone = phone;
    }

    if (profilePhoto) {
      if (user.profile_photo) {
        const oldPhotoPath = path.join(__dirname, '../Uploads/profiles', user.profile_photo);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }
      updatedFields.profile_photo = profilePhoto.filename;
    }

    console.log('updatedFields:', updatedFields);

    await User.updateOne(
      { _id: userId },
      { $set: updatedFields }
    );

    const updatedUser = await User.findById(userId).select('-password');

    await Audit.create({
      user: userId,
      action: 'update_profile',
      target: userId,
      details: JSON.stringify({ updatedFields })
    });

    if (email) {
      const admins = await User.find({ role: 'Admin', _id: { $ne: userId } });
      const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: process.env.EMAIL_HOST_USER,
          pass: process.env.EMAIL_HOST_PASSWORD,
        },
      });

      for (const admin of admins) {
        const notification = new Notification({
          user: admin._id,
          message: `Admin ${updatedUser.username} updated their email to ${email}.`,
          type: 'admin_profile_update',
          isAdminNotification: true,
        });
        await notification.save();
        io.to(admin._id.toString()).emit('new_admin_notification', notification.toObject());

        const adminMailOptions = {
          to: admin.email,
          from: process.env.EMAIL_HOST_USER,
          subject: 'Admin Profile Update Notification',
          text: `Dear ${admin.username},\n\nAdmin ${updatedUser.username} has updated their email to ${email}.\n\nView details at: ${process.env.FRONTEND_URL}/admin`,
        };
        await transporter.sendMail(adminMailOptions);
        console.log(`✅ Admin notification email sent to ${admin.email}`);
      }
    }

    res.json({
      message: 'Admin profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('❌ Update Admin Profile Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const updateAdminProfileWithUpload = [profileUpload, updateAdminProfile];

export const changeAdminPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    user.password = newPassword;
    await user.save();

    await Audit.create({
      user: userId,
      action: 'change_password',
      target: userId,
      details: JSON.stringify({ message: 'Admin changed their password' })
    });

    const admins = await User.find({ role: 'Admin', _id: { $ne: userId } });
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_HOST_USER,
        pass: process.env.EMAIL_HOST_PASSWORD,
      },
    });

    for (const admin of admins) {
      const notification = new Notification({
        user: admin._id,
        message: `Admin ${user.username} changed their password.`,
        type: 'admin_password_change',
        isAdminNotification: true,
      });
      await notification.save();
      io.to(admin._id.toString()).emit('new_admin_notification', notification.toObject());

      const adminMailOptions = {
        to: admin.email,
        from: process.env.EMAIL_HOST_USER,
        subject: 'Admin Password Change Notification',
        text: `Dear ${admin.username},\n\nAdmin ${user.username} has changed their password.\n\nView details at: ${process.env.FRONTEND_URL}/admin`,
      };
      await transporter.sendMail(adminMailOptions);
      console.log(`✅ Admin notification email sent to ${admin.email}`);
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('❌ Change Admin Password Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ message: 'Users fetched successfully', users });
  } catch (error) {
    console.error('❌ Fetch Users Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const filterUsers = async (req, res) => {
  try {
    const { role, status } = req.query;
    const query = {};
    if (role) query.role = role;
    if (status) query.status = status;

    const users = await User.find(query).select('-password');
    res.json({ message: 'Filtered users fetched', users });
  } catch (error) {
    console.error('❌ Filter Users Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const getPendingLawyers = async (req, res) => {
  try {
    const pendingLawyers = await User.find({ role: 'Lawyer', status: 'Pending' }).select('-password');
    res.json({ message: 'Pending lawyers fetched', pendingLawyers });
  } catch (error) {
    console.error('❌ Fetch Pending Lawyers Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'Admin') return res.status(403).json({ message: 'Cannot delete an admin' });

    await User.deleteOne({ _id: userId });

    await new Audit({
      user: req.user.id,
      action: 'delete_user',
      target: userId,
    }).save();

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('❌ Delete User Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const addAdmin = async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'Username, email, and password are required' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already exists' });

    const newAdmin = new User({
      username,
      email,
      password,
      role: 'Admin',
      status: 'Active',
      phone,
    });
    await newAdmin.save();

    await new Audit({
      admin: req.user.id,
      action: 'add_admin',
      target: newAdmin._id,
    }).save();

    res.json({
      message: 'Admin added successfully',
      user: {
        _id: newAdmin._id,
        username: newAdmin.username,
        email: newAdmin.email,
        phone: newAdmin.phone,
        role: newAdmin.role,
      },
    });
  } catch (error) {
    console.error('❌ Add Admin Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const getLawyers = async (req, res) => {
  try {
    const { specialization, location, minRating, available } = req.query;
    const filters = { role: 'Lawyer', status: 'Active', verificationStatus: 'Verified' };

    if (specialization) filters.specialization = { $in: Array.isArray(specialization) ? specialization : [specialization] };
    if (location) filters.location = { $regex: location, $options: 'i' };
    if (minRating) filters.averageRating = { $gte: parseFloat(minRating) };
    if (available) filters.isAvailable = available === 'true';

    const lawyers = await User.find(filters)
      .select('username specialization location averageRating ratingCount hourlyRate profile_photo')
      .sort({ averageRating: -1 })
      .lean();

    res.json({ message: 'Lawyers fetched', lawyers });
  } catch (error) {
    console.error('❌ Fetch Lawyers Error:', error.message);
    res.status(500).json({ message: 'Failed to fetch lawyers', error: error.message });
  }
};

export const getLawyerProfile = async (req, res) => {
  try {
    const { lawyerId } = req.params;
    const lawyer = await User.findById(lawyerId)
      .select('username specialization yearsOfExperience location bio certifications hourlyRate languages averageRating ratingCount profile_photo isAvailable verificationStatus role')
      .lean();
    if (!lawyer || lawyer.role !== 'Lawyer') {
      return res.status(404).json({ message: 'Lawyer not found' });
    }

    const verified = lawyer.verificationStatus === 'Verified';
    res.json({ message: 'Lawyer profile fetched', lawyer: { ...lawyer, verified } });
  } catch (error) {
    console.error('❌ Fetch Lawyer Profile Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const getClientDashboard = async (req, res) => {
  try {
    const clientId = req.user.id;

    const cases = await Case.find({ client: clientId });
    const totalCases = cases.length;
    const activeCases = cases.filter(c => c.status !== 'Closed').length;

    const pendingRatings = await Rating.countDocuments({ client: clientId, status: 'Pending' });

    const upcomingAppointments = await Appointment.countDocuments({
      client: clientId,
      date: { $gt: new Date() },
    });

    res.json({
      message: 'Client dashboard fetched successfully',
      dashboard: {
        totalCases,
        activeCases,
        pendingRatings,
        upcomingAppointments,
      },
    });
  } catch (error) {
    console.error('❌ Client Dashboard Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const getLawyerDashboard = async (req, res) => {
  try {
    const lawyerId = req.user.id;

    const cases = await Case.find({ assigned_lawyer: lawyerId });
    const totalCases = cases.length;
    const activeCases = cases.filter(c => c.status !== 'Closed').length;

    const totalBids = await Bid.countDocuments({ lawyer: lawyerId });
    const acceptedBids = await Bid.countDocuments({ lawyer: lawyerId, status: 'Accepted' });
    const bidSuccessRate = totalBids > 0 ? Number(((acceptedBids / totalBids) * 100).toFixed(1)) : 0;

    const ratings = await Rating.find({ lawyer: lawyerId, status: 'Completed' });
    const averageRating = ratings.length
      ? Number((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1))
      : 0;

    const upcomingAppointments = await Appointment.countDocuments({
      lawyer: lawyerId,
      date: { $gt: new Date() },
    });

    const recentCases = await Case.find({ assigned_lawyer: lawyerId })
      .sort({ updatedAt: -1 })
      .limit(3)
      .select('description category deadline')
      .lean();
    const formattedRecentCases = recentCases.map(c => ({
      caseId: c._id,
      description: c.description.substring(0, 50) + (c.description.length > 50 ? '...' : ''),
      category: c.category,
      deadline: c.deadline,
    }));

    res.json({
      message: 'Lawyer dashboard fetched successfully',
      dashboard: {
        totalCases,
        activeCases,
        totalBids,
        bidSuccessRate,
        averageRating,
        upcomingAppointments,
        recentCases: formattedRecentCases,
      },
    });
  } catch (error) {
    console.error('❌ Lawyer Dashboard Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const getPendingReviews = async (req, res) => {
  try {
    const pendingLawyers = await User.find({ role: 'Lawyer', status: 'Pending' })
      .select('username email license_file specialization verificationStatus');
    res.json({ message: 'Pending reviews fetched', pendingLawyers });
  } catch (error) {
    console.error('❌ Get Pending Reviews Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const assignReviewer = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'User ID is required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'LegalReviewer') return res.status(400).json({ message: 'User is already a Legal Reviewer' });

    user.role = 'LegalReviewer';
    user.status = 'Active';
    await user.save();

    const notification = new Notification({
      user: user._id,
      message: 'You have been assigned as a Legal Reviewer.',
      type: 'role_assigned',
    });
    await notification.save();
    io.to(user._id.toString()).emit('new_notification', notification.toObject());

    await new Audit({
      user: req.user.id,
      action: 'assign_reviewer',
      target: userId,
      details: `Assigned ${user.username} as Legal Reviewer`,
    }).save();

    const admins = await User.find({ role: 'Admin' });
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_HOST_USER,
        pass: process.env.EMAIL_HOST_PASSWORD,
      },
    });
    for (const admin of admins) {
      const adminNotification = new Notification({
        user: admin._id,
        message: `User ${user.username} assigned as Legal Reviewer by ${req.user.username}.`,
        type: 'reviewer_assigned_admin',
        isAdminNotification: true,
      });
      await notification.save();
      io.to(admin._id.toString()).emit('new_admin_notification', adminNotification.toObject());

      const adminMailOptions = {
        to: admin.email,
        from: process.env.EMAIL_HOST_USER,
        subject: "Legal Reviewer Assignment Notification",
        text: `Dear ${admin.username},\n\nUser ${user.username} has been assigned as a Legal Reviewer by ${req.user.username}.\n\nView details at: ${process.env.FRONTEND_URL}/admin`,
      };
      await transporter.sendMail(adminMailOptions);
      console.log(`✅ Admin reviewer assignment email sent to ${admin.email}`);
    }

    res.json({
      message: 'User assigned as Legal Reviewer successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('❌ Assign Reviewer Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const updateClientProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email } = req.body;
    const profilePhoto = req.file;

    if (req.user.role !== 'Client') {
      return res.status(403).json({ message: 'Only Clients can update their profile' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedFields = {};

    if (username) {
      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({ message: 'Username must be between 3 and 30 characters' });
      }
      const existingUsername = await User.findOne({ username, _id: { $ne: userId } });
      if (existingUsername) {
        return res.status(409).json({ message: 'Username already taken' });
      }
      updatedFields.username = username;
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      const existingEmail = await User.findOne({ email, _id: { $ne: userId } });
      if (existingEmail) {
        return res.status(409).json({ message: 'Email already in use' });
      }
      updatedFields.email = email;
    }

    if (profilePhoto) {
      if (user.profile_photo) {
        const oldPhotoPath = path.join(__dirname, '../Uploads/profiles', user.profile_photo);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }
      updatedFields.profile_photo = profilePhoto.filename;
    }

    console.log('updatedFields:', updatedFields);

    await User.updateOne(
      { _id: userId },
      { $set: updatedFields }
    );

    const updatedUser = await User.findById(userId).select('-password');

    await Audit.create({
      user: userId,
      action: 'update_profile',
      target: userId,
      details: JSON.stringify({ updatedFields })
    });

    if (email) {
      const admins = await User.find({ role: 'Admin' });
      const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: process.env.EMAIL_HOST_USER,
          pass: process.env.EMAIL_HOST_PASSWORD,
        },
      });

      for (const admin of admins) {
        const notification = new Notification({
          user: admin._id,
          message: `Client ${updatedUser.username} updated their email to ${email}.`,
          type: 'client_profile_update',
          isAdminNotification: true,
        });
        await notification.save();
        io.to(admin._id.toString()).emit('new_admin_notification', notification.toObject());

        const adminMailOptions = {
          to: admin.email,
          from: process.env.EMAIL_HOST_USER,
          subject: 'Client Profile Update Notification',
          text: `Dear ${admin.username},\n\nClient ${updatedUser.username} has updated their email to ${email}.\n\nView details at: ${process.env.FRONTEND_URL}/admin`,
        };
        await transporter.sendMail(adminMailOptions);
        console.log(`✅ Admin notification email sent to ${admin.email}`);
      }
    }

    res.json({ message: 'Client profile updated successfully', user: updatedUser });
  } catch (error) {
    console.error('❌ Update Client Profile Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const updateClientProfileWithUpload = [profileUpload, updateClientProfile];

export const changeClientPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (req.user.role !== 'Client') {
      return res.status(403).json({ message: 'Only Clients can change their password' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    user.password = newPassword;
    await user.save();

    await Audit.create({
      user: userId,
      action: 'change_password',
      target: userId,
      details: JSON.stringify({ message: 'Client changed their password' })
    });

    const admins = await User.find({ role: 'Admin' });
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_HOST_USER,
        pass: process.env.EMAIL_HOST_PASSWORD,
      },
    });

    for (const admin of admins) {
      const notification = new Notification({
        user: admin._id,
        message: `Client ${user.username} changed their password.`,
        type: 'client_password_change',
        isAdminNotification: true,
      });
      await notification.save();
      io.to(admin._id.toString()).emit('new_admin_notification', notification.toObject());

      const adminMailOptions = {
        to: admin.email,
        from: process.env.EMAIL_HOST_USER,
        subject: 'Client Password Change Notification',
        text: `Dear ${admin.username},\n\nClient ${user.username} has changed their password.\n\nView details at: ${process.env.FRONTEND_URL}/admin`,
      };
      await transporter.sendMail(adminMailOptions);
      console.log(`✅ Admin notification email sent to ${admin.email}`);
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('❌ Change Client Password Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};
export const getClientProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Client not found' });
    }
    if (user.role !== 'Client') {
      return res.status(403).json({ message: 'Client access required' });
    }
    res.json({
      message: 'Client profile fetched successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile_photo: user.profile_photo,
        status: user.status,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('❌ Get Client Profile Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};