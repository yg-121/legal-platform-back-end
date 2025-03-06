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

        const chat = new Chat({
            sender,
            receiver,
            message,
            file
        });
        await chat.save();

        const notificationMessage = file 
            ? `New chat message with file from ${sender}: ${message || 'File sent'}`
            : `New chat message from ${sender}: ${message}`;
        await sendNotification(receiver, notificationMessage, 'Chat');

        res.status(201).json(chat);
    } catch (error) {
        console.error('❌ Chat Error:', error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
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