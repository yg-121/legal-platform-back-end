import User from '../models/User.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import profileUpload from '../utils/profileUpload.js'; // Your Multer setup

// Existing: Approve/Reject Lawyer (Updated to PUT)
export const approveLawyer = async (req, res) => {
  try {
    const { lawyerId } = req.body;
    if (!lawyerId) {
      return res.status(400).json({ message: 'Lawyer ID is required' });
    }

    const lawyer = await User.findById(lawyerId);
    if (!lawyer || lawyer.role !== 'Lawyer') {
      return res.status(404).json({ message: 'Lawyer not found' });
    }
    if (lawyer.status !== 'Pending') {
      return res.status(400).json({ message: 'Lawyer is not pending approval' });
    }

    lawyer.status = 'Active';
    await lawyer.save();

    res.json({
      message: 'Lawyer approved',
      lawyer: {
        _id: lawyer._id,
        username: lawyer.username,
        email: lawyer.email,
        license_file: lawyer.license_file,
        profile_photo: lawyer.profile_photo,
        status: lawyer.status,
      },
    });
  } catch (error) {
    console.error('❌ Approve Lawyer Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const rejectLawyer = async (req, res) => {
  try {
    const { lawyerId } = req.body;
    if (!lawyerId) {
      return res.status(400).json({ message: 'Lawyer ID is required' });
    }

    const lawyer = await User.findById(lawyerId);
    if (!lawyer || lawyer.role !== 'Lawyer') {
      return res.status(404).json({ message: 'Lawyer not found' });
    }
    if (lawyer.status !== 'Pending') {
      return res.status(400).json({ message: 'Lawyer is not pending approval' });
    }

    lawyer.status = 'Rejected';
    await lawyer.save();

    res.json({
      message: 'Lawyer rejected',
      lawyer: {
        _id: lawyer._id,
        username: lawyer.username,
        email: lawyer.email,
        license_file: lawyer.license_file,
        profile_photo: lawyer.profile_photo,
        status: lawyer.status,
      },
    });
  } catch (error) {
    console.error('❌ Reject Lawyer Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Existing: Update Profile (for Lawyers)
export const updateProfile = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const profile_photo = req.file ? req.file.path : null;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'Lawyer' && user.status !== 'Active') {
      return res.status(403).json({ message: 'Account must be Active to update profile' });
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
      profile_photo: user.profile_photo,
    });
  } catch (error) {
    console.error('❌ Update Profile Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const updateProfileWithUpload = [profileUpload, updateProfile];

// New: Update Admin Profile
export const updateAdminProfile = async (req, res) => {
  try {
    const { username, email, phone } = req.body;
    const profile_photo = req.file ? req.file.path : null;
    const user = await User.findById(req.user.id);

    if (!user || user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    if (username) user.username = username;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (profile_photo) user.profile_photo = profile_photo;
    await user.save();

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

// New: Change Admin Password
export const changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user || user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword; // Pre-save hook hashes it
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('❌ Change Password Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// New: Get All Users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ message: 'Users fetched successfully', users });
  } catch (error) {
    console.error('❌ Fetch Users Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// New: Filter Users
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

// New: Get Pending Lawyers
export const getPendingLawyers = async (req, res) => {
  try {
    const pendingLawyers = await User.find({ role: 'Lawyer', status: 'Pending' }).select('-password');
    res.json({ message: 'Pending lawyers fetched', pendingLawyers });
  } catch (error) {
    console.error('❌ Fetch Pending Lawyers Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// New: Delete User
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role === 'Admin') {
      return res.status(403).json({ message: 'Cannot delete an admin' });
    }

    await User.deleteOne({ _id: userId });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('❌ Delete User Error:', error.message);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// New: Add Another Admin
export const addAdmin = async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const newAdmin = new User({
      username,
      email,
      password, // Pre-save hook hashes it
      role: 'Admin',
      status: 'Active',
      phone,
    });
    await newAdmin.save();

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