import User from '../models/User.js';
import jwt from 'jsonwebtoken';
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
        // console.log('Request Body:', req.body); // Debug: Log incoming body
        // console.log('File:', req.file); // Debug: Log uploaded file
        const { username, email, password, role, phone, specialization, location } = req.body;
        const license_file = req.file ? req.file.path : null;

        if (!username || !email || !password || !role) {
            return res.status(400).json({ message: "Username, email, password, and role are required" });
        }

        if (role === 'Lawyer') {
            if (!license_file) {
                return res.status(400).json({ message: "License file upload is required for Lawyers" });
            }
            if (!specialization) {
                return res.status(400).json({ message: "Specialization is required for Lawyers" });
            }
            if (!location) {
                return res.status(400).json({ message: "Location is required for Lawyers" });
            }
        }

        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: "Email already exists" });

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

        if (user.role === 'Lawyer' && user.status !== 'Active') {
            return res.status(403).json({ message: `Account is ${user.status}. Contact an Admin.` });
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
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};