import { io } from '../index.js';
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import upload from "../utils/upload.js";
import { sendNotification } from "../utils/notify.js";

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, status: user.status },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

export const registerUser = async (req, res) => {
  try {
    const {
      username, email, password, role, phone, specialization, location,
      yearsOfExperience, bio, certifications, hourlyRate, languages
    } = req.body;
    const license_file = req.file ? req.file.path : null;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ message: "Username, email, password, and role are required" });
    }

    if (role === "Lawyer") {
      if (!license_file) return res.status(400).json({ message: "License file upload is required for Lawyers" });
      if (!specialization) return res.status(400).json({ message: "Specialization is required for Lawyers" });
      if (!location) return res.status(400).json({ message: "Location is required for Lawyers" });
      if (!yearsOfExperience) return res.status(400).json({ message: "Years of experience is required for Lawyers" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "Email already exists" });

    let specializationArray;
    if (role === "Lawyer") {
      if (Array.isArray(specialization)) {
        specializationArray = specialization;
      } else if (typeof specialization === 'string') {
        specializationArray = specialization.split(',').map(s => s.trim());
      } else {
        return res.status(400).json({
          message: "Specialization must be a string or an array"
        });
      }

      const validSpecializations = [
        'Criminal Law', 'Family Law', 'Corporate Law', 'Immigration', 'Personal Injury',
        'Real Estate', 'Intellectual Property', 'Employment Law', 'Bankruptcy', 'Tax Law'
      ];
      const invalidSpecializations = specializationArray.filter(s => !validSpecializations.includes(s));
      if (invalidSpecializations.length > 0) {
        return res.status(400).json({
          message: `Invalid specialization values: ${invalidSpecializations.join(', ')}`
        });
      }
    }

    const newUser = new User({
      username,
      email,
      password,
      role,
      phone: phone || undefined,
      license_file: role === "Lawyer" ? license_file : undefined,
      specialization: role === "Lawyer" ? specializationArray : undefined,
      location: role === "Lawyer" ? location : undefined,
      yearsOfExperience: role === "Lawyer" ? parseInt(yearsOfExperience) : undefined,
      bio: role === "Lawyer" ? (bio || '') : undefined,
      certifications: role === "Lawyer" && certifications ? (Array.isArray(certifications) ? certifications : [certifications]) : undefined,
      hourlyRate: role === "Lawyer" && hourlyRate ? parseFloat(hourlyRate) : undefined,
      languages: role === "Lawyer" && languages ? (Array.isArray(languages) ? languages : [languages]) : undefined
    });
    await newUser.save();

    if (role === "Lawyer") {
      await sendNotification(
        null,
        `New lawyer registered: ${username} (${newUser.specialization.join(', ')})`,
        'new_lawyer'
      );
    }

    const userData = {
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      license_file: newUser.license_file
    };
    res.status(201).json({
      data: {
        user: userData,
        token: generateToken(newUser),
      }
    });
  } catch (error) {
    console.error("❌ Registration Error:", error.message);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const registerUserWithUpload = [upload, registerUser];

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.role === "Lawyer" && user.status === "Pending") {
      return res.status(403).json({ message: `Account is ${user.status}. We will approve you, please check your email later.` });
    }

    if (user.role === "Lawyer" && user.status === "Rejected") {
      return res.status(403).json({ message: `Account is ${user.status}. Please register again with a valid license.` });
    }

    const userData = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      license_file: user.license_file
    };
    res.json({
      data: {
        user: userData,
        token: generateToken(user),
      }
    });
  } catch (error) {
    console.error("❌ Login Error:", error.message);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_HOST_USER,
        pass: process.env.EMAIL_HOST_PASSWORD,
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_HOST_USER,
      subject: "Password Reset Request",
      text: `You requested a password reset for your account.\n\nClick this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn’t request this, please ignore this email.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Reset email sent to ${user.email}`);

    res.json({ message: "Password reset link sent to your email" });
  } catch (error) {
    console.error("❌ Password Reset Request Error:", error.message);
    res.status(500).json({ message: "Failed to send reset link", error: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    console.log("Password reset for:", user.email);
    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("❌ Password Reset Error:", error.message);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const verifyToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('_id username role status email license_file');
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json({
      data: {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status,
          license_file: user.license_file
        }
      }
    });
  } catch (error) {
    console.error("❌ Verify Token Error:", error.message);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};