import User from '../models/User.js';
import Notification from '../models/Notification.js';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: process.env.MAILTRAP_PORT,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS,
  },
});

export const sendNotification = async (userId, message, type) => {
  try {
    // Handle user-specific notifications
    if (type !== 'new_lawyer') {
      const user = await User.findById(userId);
      if (!user) {
        console.error('User not found for notification');
        return;
      }

      const notification = new Notification({
        user: userId,
        message,
        type,
      });
      await notification.save();
      console.log(`Notification saved for ${user.email}: ${message}`);

      const mailOptions = {
        from: 'test@legalplatform.com',
        to: user.email,
        subject: 'Legal Platform Notification',
        text: message,
      };
      await transporter.sendMail(mailOptions);
      console.log(`Email sent to ${user.email} via Mailtrap`);
    } else {
      // Handle admin notifications for new_lawyer
      const admins = await User.find({ role: 'Admin' });
      for (const admin of admins) {
        const adminNotification = new Notification({
          user: admin._id, // Store for each admin
          message,
          type,
          isAdminNotification: true,
        });
        await adminNotification.save();

        const mailOptions = {
          from: 'test@legalplatform.com',
          to: admin.email,
          subject: 'New Lawyer Registration',
          text: message,
        };
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to admin ${admin.email} via Mailtrap`);
      }
    }
  } catch (error) {
    console.error('Notification error:', error.message);
  }
};