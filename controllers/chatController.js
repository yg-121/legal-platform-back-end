import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import { sendNotification } from '../utils/notify.js';

export const sendMessage = async (req, res) => {
    try {
        const { receiver, message } = req.body;
        const file = req.file ? req.file.path : null;
        const sender = req.user.id;

        if (!receiver || (!message && !file)) {
            return res.status(400).json({ message: "Receiver and either a message or file are required" });
        }
        if (message && message.length > 1000) {
            return res.status(400).json({ message: "Message must be under 1000 characters" });
        }
        if (sender === receiver) {
            return res.status(400).json({ message: "Cannot send message to yourself" });
        }

        const chat = new Chat({ sender, receiver, message, file });
        await chat.save();

        const notificationMessage = file 
            ? `New chat with file from ${sender}: ${message || 'File sent'}`
            : `New chat from ${sender}: ${message}`;
        await sendNotification(receiver, notificationMessage, 'Chat');

        res.status(201).json(chat);
    } catch (error) {
        console.error('❌ Chat Error:', error.message);
        res.status(500).json({ message: "Failed to send message", error: error.message });
    }
};

export const getUnreadChats = async (req, res) => {
    try {
        const userId = req.user.id;

        const unreadChats = await Chat.aggregate([
            { $match: { receiver: new mongoose.Types.ObjectId(userId) } },
            {
                $lookup: {
                    from: 'notifications',
                    let: { chatId: "$_id" },
                    pipeline: [
                        { $match: { 
                            $expr: { $eq: ["$message", `New chat from ${userId}: $${"message"}`] },
                            status: 'Read'
                        } }
                    ],
                    as: 'readNotifications'
                }
            },
            { $match: { 'readNotifications': { $size: 0 } } },
            { $sort: { createdAt: 1 } }
        ]);

        res.json(unreadChats);
    } catch (error) {
        console.error('❌ Unread Chats Error:', error.message);
        res.status(500).json({ message: "Failed to fetch unread chats", error: error.message });
    }
};

export const getChatHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUser = req.user.id;

        const chats = await Chat.find({
            $or: [
                { sender: currentUser, receiver: userId },
                { sender: userId, receiver: currentUser }
            ]
        }).sort({ createdAt: 1 });

        res.json(chats);
    } catch (error) {
        console.error('❌ Chat History Error:', error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};