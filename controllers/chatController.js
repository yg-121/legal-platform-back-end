import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { io } from '../index.js';

export const sendMessage = async (req, res) => {
  console.log('[sendMessage] Request body:', req.body);
  console.log('[sendMessage] File:', req.file);

  try {
    const { receiver, message } = req.body;
    const sender = req.user.id;

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

    // Check if sender is blocked by receiver
    if (receiverUser.blockedUsers.includes(sender)) {
      console.error(`[sendMessage] Sender ${sender} is blocked by ${receiver}`);
      return res.status(403).json({ message: 'You are blocked by this user' });
    }

    // Check if receiver is blocked by sender
    const senderUser = await User.findById(sender);
    if (senderUser.blockedUsers.includes(receiver)) {
      console.error(`[sendMessage] Receiver ${receiver} is blocked by ${sender}`);
      return res.status(403).json({ message: 'You have blocked this user' });
    }

    const chat = new Chat({
      sender,
      receiver,
      message: message || '',
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
    if (error.message.includes('allowed')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
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

export const deleteChat = async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  console.log(`[deleteChat] User: ${userId}, Chat: ${chatId}`);

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) {
      console.error(`[deleteChat] Chat not found: ${chatId}`);
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (chat.sender.toString() !== userId && chat.receiver.toString() !== userId) {
      console.error(`[deleteChat] User ${userId} is not authorized to delete chat ${chatId}`);
      return res.status(403).json({ message: 'Unauthorized to delete this chat' });
    }

    await chat.deleteOne();
    console.log(`[deleteChat] Chat ${chatId} deleted`);

    // Notify both users
    io.to(chat.sender.toString()).emit('chat_deleted', { chatId });
    io.to(chat.receiver.toString()).emit('chat_deleted', { chatId });
    console.log(`[deleteChat] Emitted chat_deleted to ${chat.sender}, ${chat.receiver}`);

    res.status(200).json({ message: 'Chat deleted' });
  } catch (error) {
    console.error(`[deleteChat] Error: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

export const blockUser = async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.id;

  console.log(`[blockUser] User: ${currentUserId}, Blocking: ${userId}`);

  try {
    if (userId === currentUserId) {
      console.error('[blockUser] Cannot block self');
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    const userToBlock = await User.findById(userId);
    if (!userToBlock) {
      console.error(`[blockUser] User not found: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUser = await User.findById(currentUserId);
    if (currentUser.blockedUsers.includes(userId)) {
      console.log(`[blockUser] User ${userId} already blocked`);
      return res.status(400).json({ message: 'User already blocked' });
    }

    currentUser.blockedUsers.push(userId);
    await currentUser.save();
    console.log(`[blockUser] User ${userId} blocked by ${currentUserId}`);

    res.status(200).json({ message: 'User blocked' });
  } catch (error) {
    console.error(`[blockUser] Error: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

export const unblockUser = async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.id;

  console.log(`[unblockUser] User: ${currentUserId}, Unblocking: ${userId}`);

  try {
    const currentUser = await User.findById(currentUserId);
    if (!currentUser.blockedUsers.includes(userId)) {
      console.error(`[unblockUser] User ${userId} not blocked`);
      return res.status(400).json({ message: 'User not blocked' });
    }

    currentUser.blockedUsers = currentUser.blockedUsers.filter(
      (id) => id.toString() !== userId
    );
    await currentUser.save();
    console.log(`[unblockUser] User ${userId} unblocked by ${currentUserId}`);

    res.status(200).json({ message: 'User unblocked' });
  } catch (error) {
    console.error(`[unblockUser] Error: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};