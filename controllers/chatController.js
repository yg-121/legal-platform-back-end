import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import Notification from '../models/Notification.js';
import Case from '../models/Case.js'; // Add this for case lookup
import { io } from '../index.js';
import path from 'path';
import { initiateRating } from './ratingController.js'; // Keep this one, remove the duplicate

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
      return res.status(400).json({ message: 'Receiver and either a message or file/voice are required' });
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
      read: false,
    });
    await chat.save();

    io.to(receiver).emit('new_message', chat.toObject());
    console.log('Emitted new_message to:', receiver);

    const notificationMessage = fileType === 'voice'
      ? `New voice message from ${req.user.username || 'user'}`
      : fileType === 'file'
      ? `New file from ${req.user.username || 'user'}: ${message || 'File sent'}`
      : `New chat from ${req.user.username || 'user'}: ${message}`;
    const notification = new Notification({
      message: notificationMessage.substring(0, 50) + '...',
      type: 'Chat',
      user: receiver,
    });
    await notification.save();
    io.to(receiver).emit('new_notification', notification.toObject());

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

// Start chat and initiate rating
export const startChat = async (req, res) => {
  try {
    const { caseId } = req.body;
    const client = req.user.id;

    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({ message: 'Case not found' });
    }
    if (caseData.client.toString() !== client) {
      return res.status(403).json({ message: 'Only the case owner can start chat' });
    }
    if (!caseData.assigned_lawyer) {
      return res.status(400).json({ message: 'No lawyer assigned yet' });
    }

    // Check if chat already started (optional, based on your logic)
    const existingChat = await Chat.findOne({
      $or: [
        { sender: client, receiver: caseData.assigned_lawyer, case: caseId },
        { sender: caseData.assigned_lawyer, receiver: client, case: caseId },
      ],
    });

    if (!existingChat) {
      // Initiate rating only on first chat
      await initiateRating(caseId, client, caseData.assigned_lawyer);
    }

    res.json({ message: 'Chat initiated', case: caseData });
  } catch (error) {
    console.error('❌ Start Chat Error:', error.message);
    res.status(500).json({ message: 'Failed to start chat', error: error.message });
  }
};