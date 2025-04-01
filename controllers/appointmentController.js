import Appointment from '../models/Appointment.js';
import Case from '../models/Case.js';
import User from '../models/User.js';
import { sendNotification } from '../utils/notify.js';
import {io} from '../index.js'

export const createAppointment = async (req, res) => {
  try {
    const { lawyer, case: caseId, date } = req.body;
    const client = req.user.id;

    if (!lawyer || !caseId || !date) {
      return res.status(400).json({ message: 'Lawyer, case, and date are required' });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate) || parsedDate < Date.now()) {
      return res.status(400).json({ message: 'Invalid or past date' });
    }

    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({ message: 'Case not found' });
    }
    if (caseData.client.toString() !== client) {
      return res.status(403).json({ message: 'You can only book for your own cases' });
    }
    if (caseData.status === 'Closed') {
      return res.status(400).json({ message: 'Cannot book for a closed case' });
    }

    const lawyerData = await User.findById(lawyer);
    if (!lawyerData || lawyerData.role !== 'Lawyer') {
      return res.status(404).json({ message: 'Lawyer not found' });
    }

    const appointment = new Appointment({
      client,
      lawyer,
      case: caseId,
      date: parsedDate,
    });
    await appointment.save();

    await sendNotification(
      lawyer,
      `New appointment booked for ${parsedDate.toLocaleString()} on case: "${caseData.description}"`,
      'Appointment'
    );

    res.status(201).json({ message: 'Appointment created', appointment });
  } catch (error) {
    console.error('❌ Appointment Creation Error:', error.message);
    res.status(500).json({ message: 'Failed to create appointment', error: error.message });
  }
};

export const getAppointments = async (req, res) => {
  try {
    const userId = req.user.id;

    const appointments = await Appointment.find({
      $or: [{ client: userId }, { lawyer: userId }],
    })
      .populate('client', 'username email')
      .populate('lawyer', 'username email')
      .populate('case', 'description status')
      .sort({ date: 1 });

    res.json({ message: 'Appointments fetched', appointments });
  } catch (error) {
    console.error('❌ Fetch Appointments Error:', error.message);
    res.status(500).json({ message: 'Failed to fetch appointments', error: error.message });
  }
};

export const confirmAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const lawyerId = req.user.id;

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    if (appointment.lawyer.toString() !== lawyerId) {
      return res.status(403).json({ message: 'Only the assigned lawyer can confirm' });
    }
    if (appointment.status !== 'Pending') {
      return res.status(400).json({ message: 'Appointment cannot be confirmed' });
    }

    appointment.status = 'Confirmed';
    await appointment.save();

    const caseData = await Case.findById(appointment.case);
    await sendNotification(
      appointment.client,
      `Your appointment on ${appointment.date.toLocaleString()} for case "${caseData.description}" has been confirmed`,
      'Appointment'
    );

    res.json({ message: 'Appointment confirmed', appointment });
  } catch (error) {
    console.error('❌ Confirm Appointment Error:', error.message);
    res.status(500).json({ message: 'Failed to confirm appointment', error: error.message });
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    if (appointment.client.toString() !== userId && appointment.lawyer.toString() !== userId) {
      return res.status(403).json({ message: 'Only the client or lawyer can cancel' });
    }
    if (appointment.status === 'Cancelled') {
      return res.status(400).json({ message: 'Appointment already cancelled' });
    }

    appointment.status = 'Cancelled';
    await appointment.save();

    const targetId = appointment.client.toString() === userId ? appointment.lawyer : appointment.client;
    const caseData = await Case.findById(appointment.case);
    await sendNotification(
      targetId,
      `Appointment on ${appointment.date.toLocaleString()} for case "${caseData.description}" was cancelled by ${req.user.username || 'user'}`,
      'Appointment'
    );

    res.json({ message: 'Appointment cancelled', appointment });
  } catch (error) {
    console.error('❌ Cancel Appointment Error:', error.message);
    res.status(500).json({ message: 'Failed to cancel appointment', error: error.message });
  }
};

export const changeAppointmentDate = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.body;
    const userId = req.user.id;

    if (!date) {
      return res.status(400).json({ message: 'New date is required' });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate) || parsedDate < Date.now()) {
      return res.status(400).json({ message: 'Invalid or past date' });
    }

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    if (appointment.client.toString() !== userId && appointment.lawyer.toString() !== userId) {
      return res.status(403).json({ message: 'Only the client or lawyer can change the date' });
    }
    if (appointment.status === 'Cancelled') {
      return res.status(400).json({ message: 'Cannot change date of a cancelled appointment' });
    }

    const oldDate = appointment.date.toLocaleString();
    appointment.date = parsedDate;
    await appointment.save();

    const targetId = appointment.client.toString() === userId ? appointment.lawyer : appointment.client;
    const caseData = await Case.findById(appointment.case);
    await sendNotification(
      targetId,
      `Appointment for case "${caseData.description}" was rescheduled from ${oldDate} to ${parsedDate.toLocaleString()} by ${req.user.username || 'user'}`,
      'Appointment'
    );

    res.json({ message: 'Appointment date changed', appointment });
  } catch (error) {
    console.error('❌ Change Appointment Date Error:', error.message);
    res.status(500).json({ message: 'Failed to change appointment date', error: error.message });
  }
};