import Appointment from '../models/Appointment.js';
import Case from '../models/Case.js';
import User from '../models/User.js';
import { sendNotification } from '../utils/notify.js';

export const createAppointment = async (req, res) => {
    try {
        const { lawyer, case: caseId, date } = req.body;
        const client = req.user.id;

        if (!lawyer || !caseId || !date) {
            return res.status(400).json({ message: "Lawyer, case, and date are required" });
        }

        const parsedDate = new Date(date);
        if (isNaN(parsedDate) || parsedDate < Date.now()) {
            return res.status(400).json({ message: "Invalid or past date" });
        }

        const caseData = await Case.findById(caseId);
        if (!caseData) {
            return res.status(404).json({ message: "Case not found" });
        }
        if (caseData.client.toString() !== client) {
            return res.status(403).json({ message: "You can only book for your own cases" });
        }
        if (caseData.status === 'Closed') {
            return res.status(400).json({ message: "Cannot book for a closed case" });
        }

        const lawyerData = await User.findById(lawyer);
        if (!lawyerData || lawyerData.role !== 'Lawyer') {
            return res.status(404).json({ message: "Lawyer not found" });
        }

        const appointment = new Appointment({
            client,
            lawyer,
            case: caseId,
            date: parsedDate
        });
        await appointment.save();

        await sendNotification(lawyer, `New appointment booked for ${parsedDate.toLocaleString()} on case: "${caseData.description}"`, 'Appointment');

        res.status(201).json(appointment);
    } catch (error) {
        console.error('❌ Appointment Creation Error:', error.message);
        res.status(500).json({ message: "Failed to create appointment", error: error.message });
    }
};

export const getAppointments = async (req, res) => {
    try {
        const userId = req.user.id;

        const appointments = await Appointment.find({
            $or: [{ client: userId }, { lawyer: userId }]
        })
        .populate('client', 'username email')
        .populate('lawyer', 'username email')
        .populate('case', 'description status')
        .sort({ date: 1 });

        res.json(appointments);
    } catch (error) {
        console.error('❌ Fetch Appointments Error:', error.message);
        res.status(500).json({ message: "Failed to fetch appointments", error: error.message });
    }
};

export const confirmAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const lawyerId = req.user.id;

        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found" });
        }
        if (appointment.lawyer.toString() !== lawyerId) {
            return res.status(403).json({ message: "Only the assigned lawyer can confirm" });
        }
        if (appointment.status !== 'Pending') {
            return res.status(400).json({ message: "Appointment cannot be confirmed" });
        }

        appointment.status = 'Confirmed';
        await appointment.save();

        const caseData = await Case.findById(appointment.case);
        await sendNotification(appointment.client, `Your appointment on ${appointment.date.toLocaleString()} for case "${caseData.description}" has been confirmed`, 'Appointment');

        res.json({ message: "Appointment confirmed", appointment });
    } catch (error) {
        console.error('❌ Confirm Appointment Error:', error.message);
        res.status(500).json({ message: "Failed to confirm appointment", error: error.message });
    }
};