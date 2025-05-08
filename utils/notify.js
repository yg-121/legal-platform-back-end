import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { io } from '../index.js';
import nodemailer from 'nodemailer';

export const sendNotification = async (userId, message, type) => {
  try {
    console.log(`[DEBUG] sendNotification called with type: ${type}, userId: ${userId}, message: ${message}`);

    // Handle user-specific notifications
    if (!['new_lawyer', 'lawyer_approved_admin', 'lawyer_rejected_admin', 'reviewer_assigned_admin'].includes(type)) {
      const user = await User.findById(userId);
      if (!user) {
        console.error(`[DEBUG] User not found for userId: ${userId}`);
        return;
      }

      console.log(`[DEBUG] Creating notification for user: ${user.username} (${user.email})`);
      const notification = new Notification({
        user: userId,
        message,
        type,
      });
      await notification.save();
      console.log(`[DEBUG] Notification saved for ${user.username}: ${message}`);

      io.to(userId).emit('new_notification', notification.toObject());
      console.log(`[DEBUG] Emitted new_notification to ${userId}`);

      // Send email for role_assigned
      if (type === 'role_assigned') {
        console.log(`[DEBUG] Sending role_assigned email to ${user.email}`);
        const transporter = nodemailer.createTransport({
          service: 'Gmail',
          auth: {
            user: process.env.EMAIL_HOST_USER,
            pass: process.env.EMAIL_HOST_PASSWORD,
          },
        });

        const mailOptions = {
          to: user.email,
          from: process.env.EMAIL_HOST_USER,
          subject: 'Legal Reviewer Role Assigned',
          text: `Dear ${user.username},\n\n${message}\n\nLog in to review pending lawyers: ${process.env.FRONTEND_URL}/login`,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Role assigned email sent to ${user.email}`);
      }
    } else if (type === 'new_lawyer') {
      // Handle new_lawyer notifications for LegalReviewers
      console.log('[DEBUG] Fetching LegalReviewers for new_lawyer notification');
      const legalReviewers = await User.find({ role: 'LegalReviewer' });
      console.log(`[DEBUG] Found ${legalReviewers.length} LegalReviewers: ${legalReviewers.map(r => `${r.username} (${r.email})`).join(', ')}`);

      if (legalReviewers.length === 0) {
        console.log('[DEBUG] No LegalReviewers found for new_lawyer notification');
        return;
      }

      const transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: process.env.EMAIL_HOST_USER,
          pass: process.env.EMAIL_HOST_PASSWORD,
        },
      });

      for (const reviewer of legalReviewers) {
        console.log(`[DEBUG] Creating notification for LegalReviewer: ${reviewer.username} (${reviewer.email})`);
        const reviewerNotification = new Notification({
          user: reviewer._id,
          message,
          type,
          isAdminNotification: false,
        });
        await reviewerNotification.save();
        console.log(`[DEBUG] Notification saved for LegalReviewer ${reviewer.username}: ${message}`);

        io.to(reviewer._id.toString()).emit('new_notification', reviewerNotification.toObject());
        console.log(`[DEBUG] Emitted new_notification to ${reviewer._id}`);

        // Send email to LegalReviewer
        console.log(`[DEBUG] Sending new_lawyer email to ${reviewer.email}`);
        const mailOptions = {
          to: reviewer.email,
          from: process.env.EMAIL_HOST_USER,
          subject: 'New Lawyer Registration',
          text: `Dear ${reviewer.username},\n\nA new lawyer has registered and requires your review: ${message}\n\nReview details at: ${process.env.FRONTEND_URL}/reviewer`,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ New lawyer email sent to ${reviewer.email}`);
      }
    } else {
      // Handle admin notifications for lawyer_approved_admin, lawyer_rejected_admin, reviewer_assigned_admin
      console.log('[DEBUG] Fetching Admins for admin notification');
      const admins = await User.find({ role: 'Admin' });
      console.log(`[DEBUG] Found ${admins.length} Admins: ${admins.map(a => `${a.username} (${a.email})`).join(', ')}`);

      // Track which admins we've already notified to prevent duplicates
      const notifiedAdmins = new Set();

      for (const admin of admins) {
        // Skip if we've already notified this admin
        if (notifiedAdmins.has(admin._id.toString())) {
          console.log(`[DEBUG] Skipping duplicate notification for admin ${admin.username}`);
          continue;
        }
        
        // Add to notified set
        notifiedAdmins.add(admin._id.toString());
        
        console.log(`[DEBUG] Creating notification for Admin: ${admin.username} (${admin.email})`);
        const adminNotification = new Notification({
          user: admin._id,
          message,
          type,
          isAdminNotification: true,
        });
        await adminNotification.save();
        console.log(`[DEBUG] Notification saved for admin ${admin.username}: ${message}`);

        io.to(admin._id.toString()).emit('new_notification', adminNotification.toObject());
        console.log(`[DEBUG] Emitted new_notification to ${admin._id}`);
      }
    }
  } catch (error) {
    console.error(`[ERROR] Notification error for type ${type}:`, error.message);
  }
};
