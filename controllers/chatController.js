import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import Notification from '../models/Notification.js';
import Case from '../models/Case.js';
import User from '../models/User.js';
import { io } from '../index.js';
import path from 'path';
import { initiateRating } from './ratingController.js';

// Start a new chat
export const startChat = async (req, res) => {
  try {
    const { receiver } = req.body;
    const sender = req.user.id;

    if (!receiver) {
      return res.status(400).json({ message: 'Receiver ID is required' });
    }
    if (sender === receiver) {
      return res.status(400).json({ message: 'Cannot start chat with yourself' });
    }

    // Validate receiver exists
    const recipient = await User.findById(receiver);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // Check if sender is blocked by receiver
    if (recipient.blockedUsers.includes(sender)) {
      return res.status(403).json({ message: 'You are blocked by this user' });
    }

    // Check if sender has blocked receiver
    const senderUser = await User.findById(sender);
    if (senderUser.blockedUsers.includes(receiver)) {
      return res.status(403).json({ message: 'You have blocked this user' });
    }

    // Restrict Lawyers to initiating chats only for assigned cases
    if (req.user.role === 'Lawyer') {
      const caseWithAcceptedBid = await Case.findOne({
        client: receiver,
        assigned_lawyer: sender
      });
      if (!caseWithAcceptedBid) {
        return res.status(403).json({ message: 'Lawyers can only initiate chats for assigned cases' });
      }
    }

    // Check if chat already exists
    let chat = await Chat.findOne({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender }
      ]
    });

    if (!chat) {
      chat = new Chat({
        sender,
        receiver,
        message: 'Chat started',
        file: 'text',
        read: false
      });
      await chat.save();
    }

    // Populate sender and receiver details
    await chat.populate('sender receiver', 'username role');

    // Emit Socket.IO event for new chat
    io.to(receiver).emit('newChat', chat);

    res.status(201).json({ message: 'Chat initiated', chat });
  } catch (error) {
    console.error('❌ Start Chat Error:', error.message);
    res.status(500).json({ message: 'Failed to start chat', error: error.message });
  }
};

// Send a message (text, file, or voice)
export const sendMessage = async (req, res) => {
  try {
    const { receiver, message, caseId } = req.body;
    const filePath = req.file ? req.file.path : null;
    const sender = req.user.id;

    console.log('Request Headers:', req.headers);
    console.log('Request Body:', req.body);
    console.log('File:', req.file || 'No file uploaded');

    if (!receiver || (!message && !filePath)) {
      console.log('Validation failed: Missing receiver or content');
      return res.status(400).json({ message: 'Receiver and either a message or file are required' });
    }
    if (message && message.length > 1000) {
      return res.status(400).json({ message: 'Message must be under 1000 characters' });
    }
    if (sender === receiver) {
      return res.status(400).json({ message: 'Cannot send message to yourself' });
    }
    if (caseId && !mongoose.Types.ObjectId.isValid(caseId)) {
      return res.status(400).json({ message: 'Invalid case ID' });
    }

    // Validate receiver exists
    const recipient = await User.findById(receiver);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // Check if sender is blocked by receiver
    if (recipient.blockedUsers.includes(sender)) {
      return res.status(403).json({ message: 'You are blocked by this user' });
    }

    // Check if sender has blocked receiver
    const senderUser = await User.findById(sender);
    if (senderUser.blockedUsers.includes(receiver)) {
      return res.status(403).json({ message: 'You have blocked this user' });
    }

    let fileType = null;
    if (filePath) {
      const ext = path.extname(filePath).toLowerCase();
      fileType = (ext === '.mp3' || ext === '.wav') ? 'voice' : 'file';
      console.log('File Type:', fileType, 'Path:', filePath);
    } else if (message) {
      fileType = 'text';
    }

    const chat = new Chat({
      sender,
      receiver,
      message,
      file: fileType,
      filePath,
      case: caseId || null,
      read: false
    });
    await chat.save();

    // Emit Socket.IO event for new message
    io.to(receiver).emit('new_message', chat.toObject());
    console.log('Emitted new_message to:', receiver);

    // Create notification
    const notificationMessage = fileType === 'voice'
      ? `New voice message from ${senderUser.username || 'user'}`
      : fileType === 'file'
      ? `New file from ${senderUser.username || 'user'}: ${message || 'File sent'}`
      : `New message from ${senderUser.username || 'user'}: ${message}`;
    const notification = new Notification({
      message: notificationMessage.substring(0, 50) + '...',
      type: 'Chat',
      user: receiver
    });
    await notification.save();
    io.to(receiver).emit('new_notification', notification.toObject());

    // Initiate rating if this is the first message in a case-related chat
    if (caseId && req.user.role === 'Client') {
      const caseData = await Case.findById(caseId);
      if (caseData && caseData.assigned_lawyer && !chat) {
        await initiateRating(caseId, sender, caseData.assigned_lawyer);
      }
    }

    res.status(201).json({ message: 'Message sent', chat });
  } catch (error) {
    console.error('❌ Chat Error:', error.message);
    res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
};

// Get conversation history
export const getChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user.id;

    const chats = await Chat.find({
      $or: [
        { sender: currentUser, receiver: userId },
        { sender: userId, receiver: currentUser },
      ],
    })
      .populate('sender', 'username')
      .populate('receiver', 'username')
      .populate('case', 'description')
      .sort({ createdAt: 1 });

    res.json({ message: 'Chat history fetched', chats });
  } catch (error) {
    console.error('❌ Chat History Error:', error.message);
    res.status(500).json({ message: 'Failed to fetch chat history', error: error.message });
  }
};

// Get unread chats
export const getUnreadChats = async (req, res) => {
  try {
    const userId = req.user.id;

    const unreadChats = await Chat.find({
      receiver: userId,
      read: false,
    })
      .populate('sender', 'username')
      .populate('case', 'description')
      .sort({ createdAt: 1 });

    res.json({ message: 'Unread chats fetched', unreadChats });
  } catch (error) {
    console.error('❌ Unread Chats Error:', error.message);
    res.status(500).json({ message: 'Failed to fetch unread chats', error: error.message });
  }
};

// Mark chat as read
export const markChatAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    if (chat.receiver.toString() !== userId) {
      return res.status(403).json({ message: 'You can only mark your own received chats as read' });
    }
    if (chat.read) {
      return res.status(400).json({ message: 'Chat is already marked as read' });
    }

    chat.read = true;
    await chat.save();

    res.json({ message: 'Chat marked as read', chat });
  } catch (error) {
    console.error('❌ Mark Chat Read Error:', error.message);
    res.status(500).json({ message: 'Failed to mark chat as read', error: error.message });
  }
};

// Delete a chat
export const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const user = req.user.id;

    // Validate chat exists and user is a participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    if (![chat.sender.toString(), chat.receiver.toString()].includes(user)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Delete the chat
    await Chat.findByIdAndDelete(chatId);

    // Emit Socket.IO event to both users
    const recipientId = chat.sender.toString() === user ? chat.receiver : chat.sender;
    io.to(user).to(recipientId).emit('chatDeleted', chatId);

    res.json({ message: 'Chat deleted' });
  } catch (error) {
    console.error('❌ Delete Chat Error:', error.message);
    res.status(500).json({ message: 'Failed to delete chat', error: error.message });
  }
};

// Block a user
export const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = req.user.id;

    // Validate user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent blocking self
    if (userId === user) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    // Add user to blockedUsers
    await User.findByIdAndUpdate(user, {
      $addToSet: { blockedUsers: userId }
    });

    // Emit Socket.IO event
    io.to(userId).emit('userBlocked', { userId: user });

    res.json({ message: 'User blocked' });
  } catch (error) {
    console.error('❌ Block User Error:', error.message);
    res.status(500).json({ message: 'Failed to block user', error: error.message });
  }
};

// Unblock a user
export const unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = req.user.id;

    // Validate user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove user from blockedUsers
    await User.findByIdAndUpdate(user, {
      $pull: { blockedUsers: userId }
    });

    // Emit Socket.IO event
    io.to(userId).emit('userUnblocked', { userId: user });

    res.json({ message: 'User unblocked' });
  } catch (error) {
    console.error('❌ Unblock User Error:', error.message);
    res.status(500).json({ message: 'Failed to unblock user', error: error.message });
  }
};