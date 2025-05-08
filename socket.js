// This file exports the Socket.IO instance to avoid circular dependencies
import { Server } from 'socket.io';
import http from 'http';
import express from 'express';

const app = express();
const server = http.createServer(app);

// Create Socket.IO server with CORS configuration
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Set up connection handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Get the user ID from the query parameters
  const userId = socket.handshake.query.userId;
  if (userId) {
    // Join a room specific to this user
    socket.join(`user:${userId}`);
    console.log(`User ${userId} joined their personal room`);
  }
  
  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, 'Reason:', reason);
    if (userId) {
      socket.leave(`user:${userId}`);
    }
  });
  
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

export { io, server, app };