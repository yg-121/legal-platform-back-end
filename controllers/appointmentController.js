import Appointment from '../models/Appointment.js';
import Case from '../models/Case.js';
import User from '../models/User.js';
import { sendNotification } from '../utils/notify.js';
import { io } from '../index.js';
import nodemailer from 'nodemailer';

// Create an appointment (client or lawyer)
export const createAppointment = async (req, res) => {
  try {
    const { lawyer, client, case: caseId, date, type, description } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!date || (!lawyer && !client)) {
      return res.status(400).json({ message: 'Date and either lawyer or client are required' });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate) || parsedDate < Date.now()) {
      return res.status(400).json({ message: 'Invalid or past date' });
    }

    // Validate case if provided
    if (caseId) {
      const caseData = await Case.findById(caseId);
      if (!caseData) {
        return res.status(404).json({ message: 'Case not found' });
      }
      if (caseData.status === 'Closed') {
        return res.status(400).json({ message: 'Cannot book for a closed case' });
      }
      if (userRole === 'Client' && caseData.client.toString() !== userId) {
        return res.status(403).json({ message: 'You can only book for your own cases' });
      }
      if (userRole === 'Lawyer' && caseData.assigned_lawyer?.toString() !== userId) {
        return res.status(403).json({ message: 'You can only book for your assigned cases' });
      }
    }

    // Validate lawyer/client based on role
    let appointmentData = { date: parsedDate, case: caseId || null, type: type || 'Meeting', description };
    if (userRole === 'Client') {
      if (!lawyer) {
        return res.status(400).json({ message: 'Lawyer ID required for client bookings' });
      }
      const lawyerData = await User.findById(lawyer);
      if (!lawyerData || lawyerData.role !== 'Lawyer') {
        return res.status(404).json({ message: 'Lawyer not found' });
      }
      appointmentData.client = userId;
      appointmentData.lawyer = lawyer;
    } else if (userRole === 'Lawyer') {
      if (!client) {
        return res.status(400).json({ message: 'Client ID required for lawyer bookings' });
      }
      const clientData = await User.findById(client);
      if (!clientData || clientData.role !== 'Client') {
        return res.status(404).json({ message: 'Client not found' });
      }
      appointmentData.client = client;
      appointmentData.lawyer = userId;
    } else {
      return res.status(403).json({ message: 'Only clients or lawyers can create appointments' });
    }

    const appointment = new Appointment(appointmentData);
    await appointment.save();

    const caseData = caseId ? await Case.findById(caseId) : null;
    const targetId = userRole === 'Client' ? appointment.lawyer : appointment.client;
    await sendNotification(
      targetId,
      `New ${appointment.type} booked for ${parsedDate.toLocaleString()}${caseData ? ` on case: "${caseData.description}"` : ''}`,
      'Appointment'
    );

    res.status(201).json({ message: 'Appointment created', appointment });
  } catch (error) {
    console.error('❌ Appointment Creation Error:', error.message);
    res.status(500).json({ message: 'Failed to create appointment', error: error.message });
  }
};

// Get appointments (calendar view)
export const getAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    const query = {
      $or: [{ client: userId }, { lawyer: userId }],
    };
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const appointments = await Appointment.find(query)
      .populate('client', 'username email')
      .populate('lawyer', 'username email')
      .populate('case', 'description status')
      .sort({ date: 1 })
      .lean();

    res.json({ message: 'Appointments fetched', appointments });
  } catch (error) {
    console.error('❌ Fetch Appointments Error:', error.message);
    res.status(500).json({ message: 'Failed to fetch appointments', error: error.message });
  }
};

// Confirm appointment
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
      `Your ${appointment.type} on ${appointment.date.toLocaleString()}${caseData ? ` for case "${caseData.description}"` : ''} has been confirmed`,
      'Appointment'
    );

    res.json({ message: 'Appointment confirmed', appointment });
  } catch (error) {
    console.error('❌ Confirm Appointment Error:', error.message);
    res.status(500).json({ message: 'Failed to confirm appointment', error: error.message });
  }
};

// Cancel appointment
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
      `${appointment.type} on ${appointment.date.toLocaleString()}${caseData ? ` for case "${caseData.description}"` : ''} was cancelled by ${req.user.username || 'user'}`,
      'Appointment'
    );

    res.json({ message: 'Appointment cancelled', appointment });
  } catch (error) {
    console.error('❌ Cancel Appointment Error:', error.message);
    res.status(500).json({ message: 'Failed to cancel appointment', error: error.message });
  }
};

// Change appointment date
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
    appointment.reminderSent = { '24h': false, '1h': false }; // Reset reminders
    await appointment.save();

    const targetId = appointment.client.toString() === userId ? appointment.lawyer : appointment.client;
    const caseData = await Case.findById(appointment.case);
    await sendNotification(
      targetId,
      `${appointment.type} for case "${caseData?.description || 'no case'}" was rescheduled from ${oldDate} to ${parsedDate.toLocaleString()} by ${req.user.username || 'user'}`,
      'Appointment'
    );

    res.json({ message: 'Appointment date changed', appointment });
  } catch (error) {
    console.error('❌ Change Appointment Date Error:', error.message);
    res.status(500).json({ message: 'Failed to change appointment date', error: error.message });
  }
};

// Complete appointment
export const completeAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const lawyerId = req.user.id;

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    if (appointment.lawyer.toString() !== lawyerId) {
      return res.status(403).json({ message: 'Only the assigned lawyer can mark as completed' });
    }
    if (appointment.status !== 'Confirmed') {
      return res.status(400).json({ message: 'Only confirmed appointments can be completed' });
    }

    appointment.status = 'Completed';
    await appointment.save();

    const caseData = await Case.findById(appointment.case);
    await sendNotification(
      appointment.client,
      `Your ${appointment.type} on ${appointment.date.toLocaleString()}${caseData ? ` for case "${caseData.description}"` : ''} was marked as completed`,
      'Appointment'
    );

    res.json({ message: 'Appointment completed', appointment });
  } catch (error) {
    console.error('❌ Complete Appointment Error:', error.message);
    res.status(500).json({ message: 'Failed to complete appointment', error: error.message });
  }
};

// Send reminders (cron job)
export const sendAppointmentReminders = async () => {
  try {
    const now = new Date();
    const in24HoursStart = new Date(now.getTime() + 22 * 60 * 60 * 1000); // Widened window
    const in24HoursEnd = new Date(now.getTime() + 26 * 60 * 60 * 1000);
    // const in1HourStart = now; // Temporary: catch immediate appointments
    const in1HourStart = new Date(now.getTime() + 30 * 60 * 1000);
    const in1HourEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    console.log(`⏰ Checking reminders at ${now.toISOString()}`);
    console.log(`24h window: ${in24HoursStart.toISOString()} to ${in24HoursEnd.toISOString()}`);
    console.log(`1h window: ${in1HourStart.toISOString()} to ${in1HourEnd.toISOString()}`);

    const appointments = await Appointment.find({
      status: { $in: ['Pending', 'Confirmed'] },
      $or: [
        { date: { $gte: in24HoursStart, $lte: in24HoursEnd }, 'reminderSent.24h': false },
        { date: { $gte: in1HourStart, $lte: in1HourEnd }, 'reminderSent.1h': false },
      ],
    })
      .populate('lawyer', 'email username')
      .populate('client', 'email username')
      .populate('case', 'description');

    console.log(`Found ${appointments.length} appointments for reminders`);

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: { user: process.env.EMAIL_HOST_USER, pass: process.env.EMAIL_HOST_PASSWORD },
    });

    for (const appt of appointments) {
      const timeDiff = appt.date - now;
      const is24h = timeDiff >= 22 * 60 * 60 * 1000 && timeDiff <= 26 * 60 * 60 * 1000;
      const is1h = timeDiff >= 30 * 60 * 1000 && timeDiff <= 2 * 60 * 60 * 1000;

      if (is24h || is1h) {
        const reminderType = is24h ? '24h' : '1h';
        const subject = `${reminderType === '24h' ? '24-Hour' : '1-Hour'} Appointment Reminder`;

        // Notify lawyer
        const lawyerMail = {
          to: appt.lawyer.email,
          from: process.env.EMAIL_HOST_USER,
          subject,
          text: `Reminder: You have a ${appt.type} scheduled on ${appt.date.toLocaleString()} with ${appt.client.username}${appt.case ? ` for case "${appt.case.description}"` : ''}.\nDetails: ${appt.description || 'None'}`,
        };
        try {
          await transporter.sendMail(lawyerMail);
          console.log(`📧 Lawyer email sent to ${appt.lawyer.email} for ${reminderType}`);
        } catch (emailError) {
          console.error(`❌ Failed to send lawyer email for ${appt._id} (${reminderType}):`, emailError.message);
        }

        // Notify client
        const clientMail = {
          to: appt.client.email,
          from: process.env.EMAIL_HOST_USER,
          subject,
          text: `Reminder: You have a ${appt.type} scheduled on ${appt.date.toLocaleString()} with ${appt.lawyer.username}${appt.case ? ` for case "${appt.case.description}"` : ''}.\nDetails: ${appt.description || 'None'}`,
        };
        try {
          await transporter.sendMail(clientMail);
          console.log(`📧 Client email sent to ${appt.client.email} for ${reminderType}`);
        } catch (emailError) {
          console.error(`❌ Failed to send client email for ${appt._id} (${reminderType}):`, emailError.message);
        }

        appt.reminderSent.set(reminderType, true);
        await appt.save();

        // Socket.IO notifications
        await sendNotification(
          appt.lawyer._id,
          `${reminderType === '24h' ? '24-hour' : '1-hour'} reminder: ${appt.type} with ${appt.client.username} on ${appt.date.toLocaleString()}${appt.case ? ` for case "${appt.case.description}"` : ''}`,
          'Appointment'
        );
        await sendNotification(
          appt.client._id,
          `${reminderType === '24h' ? '24-hour' : '1-hour'} reminder: ${appt.type} with ${appt.lawyer.username} on ${appt.date.toLocaleString()}${appt.case ? ` for case "${appt.case.description}"` : ''}`,
          'Appointment'
        );

        console.log(`✅ Reminder sent for appointment ${appt._id} (${reminderType})`);
      }
    }
  } catch (error) {
    console.error('❌ Send Reminder Error:', error.message);
  }
};