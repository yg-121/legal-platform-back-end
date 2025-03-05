// import Appointment from '../models/Appointment.js';
// import Chat from '../models/Chat.js';

// export const scheduleAppointment = async (req, res) => {
//     try {
//         const { lawyerId, date } = req.body;
//         if (!lawyerId || !date) {
//             return res.status(400).json({ message: "Lawyer ID and date are required" });
//         }

//         const newAppointment = new Appointment({
//             client: req.user.id,
//             lawyer: lawyerId,
//             date
//         });
//         await newAppointment.save();

//         res.status(201).json(newAppointment);
//     } catch (error) {
//         console.error('❌ Appointment Error:', error.message);
//         res.status(500).json({ message: "Server Error", error: error.message });
//     }
// };

// export const sendChatMessage = async (req, res) => {
//     try {
//         const { receiverId, message } = req.body;
//         if (!receiverId || !message) {
//             return res.status(400).json({ message: "Receiver ID and message are required" });
//         }

//         const newChat = new Chat({
//             sender: req.user.id,
//             receiver: receiverId,
//             message
//         });
//         await newChat.save();

//         res.status(201).json(newChat);
//     } catch (error) {
//         console.error('❌ Chat Error:', error.message);
//         res.status(500).json({ message: "Server Error", error: error.message });
//     }
// };
import Appointment from '../models/Appointment.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { sendNotification } from '../utils/notify.js';

export const scheduleAppointment = async (req, res) => {
    try {
        const { lawyerId, date } = req.body;
        if (!lawyerId || !date) {
            return res.status(400).json({ message: "Lawyer ID and date are required" });
        }

        const newAppointment = new Appointment({
            client: req.user.id,
            lawyer: lawyerId,
            date
        });
        await newAppointment.save();

        await sendNotification(lawyerId, `Client scheduled an appointment with you on ${date}`, 'Appointment');

        res.status(201).json(newAppointment);
    } catch (error) {
        console.error('❌ Appointment Error:', error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const sendChatMessage = async (req, res) => {
    try {
        const { receiverId, message } = req.body;
        if (!receiverId || !message) {
            return res.status(400).json({ message: "Receiver ID and message are required" });
        }

        const newChat = new Chat({
            sender: req.user.id,
            receiver: receiverId,
            message
        });
        await newChat.save();

        const sender = await User.findById(req.user.id);
        await sendNotification(receiverId, `New message from ${sender.username}: ${message}`, 'Chat');

        res.status(201).json(newChat);
    } catch (error) {
        console.error('❌ Chat Error:', error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};