import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { io } from '../index.js';
import chatUpload from '../utils/chatUpload.js';

export const sendMessage = async (req, res) => {
  console.log('[sendMessage] Request body:', req.body);
  console.log('[sendMessage] File:', req.file);

  // Apply multer middleware
  chatUpload(req, res, async (err) => {
    if (err) {
      console.error(`[sendMessage] Multer error: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }

    const { receiver, message } = req.body;
    const sender = req.user.id;

    console.log(`[sendMessage] Sender: ${sender}, Receiver: ${receiver}, Message: ${message}, File: ${req.file?.filename || 'none'}`);

    try {
      if (!receiver) {
        console.error('[sendMessage] Missing receiver');
        return res.status(400).json({ message: 'Receiver is required' });
      }

      const receiverUser = await User.findById(receiver);
      if (!receiverUser) {
        console.error(`[sendMessage] Receiver not found: ${receiver}`);
        return res.status(404).json({ message: 'Receiver not found' });
      }

      if (receiverUser._id.toString() === sender) {
        console.error('[sendMessage] Sender and receiver cannot be the same');
        return res.status(400).json({ message: 'Cannot send message to self' });
      }

      const chat = new Chat({
        sender,
        receiver,
        message: message || '', // Allow empty message if file is present
        fileUrl: req.file ? `/Uploads/chats/${req.file.filename}` : null,
        fileName: req.file ? req.file.originalname : null,
        fileType: req.file ? req.file.mimetype : null,
        read: false,
      });

      await chat.save();
      console.log(`[sendMessage] Chat saved: ${chat._id}`);

      await chat.populate('sender receiver', 'username email');

      io.to(receiver).emit('new_message', chat);
      console.log(`[sendMessage] Emitted new_message to ${receiver}`);

      res.status(201).json({ chat });
    } catch (error) {
      console.error(`[sendMessage] Error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  });
};

export const getChatHistory = async (req, res) => {
  const { userId } = req.params;
  const currentUser = req.user.id;

  console.log(`[getChatHistory] User: ${currentUser}, History for: ${userId}`);

  try {
    if (userId !== currentUser) {
      console.error('[getChatHistory] Unauthorized access');
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const chats = await Chat.find({
      $or: [{ sender: userId }, { receiver: userId }],
    })
      .populate('sender receiver', 'username email')
      .sort({ createdAt: -1 });

    console.log(`[getChatHistory] Fetched ${chats.length} chats`);

    res.status(200).json({ chats });
  } catch (error) {
    console.error(`[getChatHistory] Error: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

export const markChatAsRead = async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  console.log(`[markChatAsRead] User: ${userId}, Chat: ${chatId}`);

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      console.error(`[markChatAsRead] Chat not found: ${chatId}`);
      return res.status(404).json({ message: 'Chat not found' });
    }
  if (chat.receiver.toString() !== userId) {
      console.error(`[markChatAsRead] User ${userId} is not the receiver`);
      return res.status(403).json({ message: 'Only the receiver can mark as read' });
    }

    if (chat.read) {
      console.log(`[markChatAsRead] Chat ${chatId} already read`);
      return res.status(200).json({ message: 'Chat already read' });
    }

    chat.read = true;
    await chat.save();
    console.log(`[markChatAsRead] Chat ${chatId} marked as read`);

    res.status(200).json({ message: 'Chat marked as read' });
  } catch (error) {
    console.error(`[markChatAsRead] Error: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};