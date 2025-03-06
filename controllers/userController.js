import User from '../models/User.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import profileUpload from '../utils/profileUpload.js'; // Correct import for profile_photo

export const approveLawyer = async (req, res) => {
    try {
        const { lawyerId, status } = req.body;
        if (!lawyerId || !status || !['Active', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: "Lawyer ID and valid status (Active/Rejected) are required" });
        }

        const lawyer = await User.findById(lawyerId);
        if (!lawyer || lawyer.role !== 'Lawyer') {
            return res.status(404).json({ message: "Lawyer not found" });
        }

        lawyer.status = status;
        await lawyer.save();

        res.json({ 
            message: `Lawyer ${status}`, 
            lawyer: {
                _id: lawyer._id,
                username: lawyer.username,
                email: lawyer.email,
                license_file: lawyer.license_file,
                profile_photo: lawyer.profile_photo,
                status: lawyer.status
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { phone, password } = req.body;
        const profile_photo = req.file ? req.file.path : null;
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.role === 'Lawyer' && user.status !== 'Active') {
            return res.status(403).json({ message: "Account must be Active to update profile" });
        }

        if (phone) user.phone = phone;
        if (password) user.password = password;
        if (profile_photo) user.profile_photo = profile_photo;
        await user.save();

        res.json({ 
            _id: user._id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
            profile_photo: user.profile_photo
        });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const updateProfileWithUpload = [profileUpload, updateProfile];