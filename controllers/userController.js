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

    // Audit log
    await new Audit({
      user: req.user.id, // Changed from admin to user for LegalReviewer
      action: 'approve_lawyer',
      target: lawyerId,
      details: comments || 'No comments provided',
    }).save();

    // Notify lawyer via email
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

    // Notify Admins via notification and email
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
    const { lawyerId, comments } = req.body; // Changed from reason to comments
    if (!lawyerId) return res.status(400).json({ message: 'Lawyer ID is required' });

    const lawyer = await User.findById(lawyerId);
    if (!lawyer || lawyer.role !== 'Lawyer') return res.status(404).json({ message: 'Lawyer not found' });
    if (lawyer.status !== 'Pending') return res.status(400).json({ message: 'Lawyer is not pending approval' });

    lawyer.status = 'Rejected';
    lawyer.verificationStatus = 'Rejected';
    await lawyer.save();

    // Audit log
    await new Audit({
      user: req.user.id, // Changed from admin to user
      action: 'reject_lawyer',
      target: lawyerId,
      details: comments || 'No reason provided',
    }).save();

    // Notify lawyer via email
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

    // Notify Admins via notification and email
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

export const updateProfile = async (req, res) => {
  try {
    const { 
      phone, password, specialization, location, yearsOfExperience, 
      bio, certifications, hourlyRate, languages, isAvailable 
    } = req.body;
    const profile_photo = req.file ? req.file.path : null;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'Lawyer') return res.status(403).json({ message: 'Only lawyers can update this profile' });
    if (user.status !== 'Active') return res.status(403).json({ message: 'Account must be Active to update profile' });

    const updatedFields = {};
    let requiresReverification = false;

    if (phone) updatedFields.phone = phone;
    if (password) updatedFields.password = password;
    if (profile_photo) updatedFields.profile_photo = profile_photo;
    if (specialization) {
      updatedFields.specialization = Array.isArray(specialization) ? specialization : [specialization];
      requiresReverification = true;
    }
    if (location) updatedFields.location = location;
    if (yearsOfExperience) updatedFields.yearsOfExperience = parseInt(yearsOfExperience);
    if (bio) updatedFields.bio = bio.substring(0, 500);
    if (certifications) updatedFields.certifications = Array.isArray(certifications) ? certifications : [certifications];
    if (hourlyRate) updatedFields.hourlyRate = parseFloat(hourlyRate);
    if (languages) updatedFields.languages = Array.isArray(languages) ? languages : [languages];
    if (typeof isAvailable !== 'undefined') updatedFields.isAvailable = isAvailable === 'true' || isAvailable === true;

    if (requiresReverification) {
      updatedFields.verificationStatus = 'Pending';
      updatedFields.status = 'Pending';
    }

    Object.assign(user, updatedFields);
    await user.save();

    if (requiresReverification) {
      const notification = new Notification({
        message: `Lawyer ${user.username} updated specialization to ${updatedFields.specialization.join(', ')}. Please re-verify.`,
        type: 'lawyer_update',
        user: null,
        isAdminNotification: true,
      });
      await notification.save();
      io.emit('new_admin_notification', notification.toObject());
    }

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      profile_photo: user.profile_photo,
      specialization: user.specialization,
      location: user.location,
      yearsOfExperience: user.yearsOfExperience,
      bio: user.bio,
      certifications: user.certifications,
      hourlyRate: user.hourlyRate,
      languages: user.languages,
      isAvailable: user.isAvailable,
      verificationStatus: user.verificationStatus
    });
  } catch (error) {
    console.error('❌ Update Profile Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const updateProfileWithUpload = [profileUpload, updateProfile];

export const updateAdminProfile = async (req, res) => {
  try {
    const { username, email, phone } = req.body;
    const profile_photo = req.file ? req.file.path : null;
    const user = await User.findById(req.user.id);

    if (!user || user.role !== 'Admin') return res.status(403).json({ message: 'Admin access required' });

    if (username) user.username = username;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (profile_photo) user.profile_photo = profile_photo;
    await user.save();

    await new Audit({
      admin: req.user.id,
      action: 'update_profile',
      target: req.user.id,
    }).save();

    res.json({
      message: 'Admin profile updated',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile_photo: user.profile_photo,
      },
    });
  } catch (error) {
    console.error('❌ Update Admin Profile Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const updateAdminProfileWithUpload = [profileUpload, updateAdminProfile];

export const changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user || user.role !== 'Admin') return res.status(403).json({ message: 'Admin access required' });
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new passwords are required' });
    if (!(await user.comparePassword(currentPassword))) return res.status(401).json({ message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();

    await new Audit({
      admin: req.user.id,
      action: 'change_password',
      target: req.user.id,
    }).save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('❌ Change Password Error:', error.message);
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
      admin: req.user.id,
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

    // Notify the new LegalReviewer
    const notification = new Notification({
      user: user._id,
      message: 'You have been assigned as a Legal Reviewer.',
      type: 'role_assigned',
    });
    await notification.save();
    io.to(user._id.toString()).emit('new_notification', notification.toObject());

    // Audit log
    await new Audit({
      user: req.user.id,
      action: 'assign_reviewer',
      target: userId,
      details: `Assigned ${user.username} as Legal Reviewer`,
    }).save();

    // Notify Admins
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
      await adminNotification.save();
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