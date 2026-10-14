const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const logger = require('../utils/logger');
const { ROLES } = require('../utils/constants');

let io = null;

/**
 * Real-time layer (Socket.IO).
 *  - Handshake is authenticated with the same JWT access token as the REST API.
 *  - Rooms enforce who hears what: admins/receptionists join "staff";
 *    a doctor joins only "doctor:<id>" so they never receive other doctors' events.
 *  - Events carry IDs and slot info only (no patient data). Clients refresh
 *    via the REST API, which re-applies authorization. Nothing sensitive
 *    ever travels over the socket.
 */
function init(httpServer) {
  io = new Server(httpServer, { cors: { origin: env.clientOrigins, credentials: true } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
      socket.data.user = { id: payload.sub, role: payload.role, doctorId: payload.doctorId };
      return next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { role, doctorId } = socket.data.user;
    if (role === ROLES.DOCTOR) {
      if (doctorId) socket.join(`doctor:${doctorId}`);
    } else {
      socket.join('staff');
    }
    logger.info('socket connected', { role });
  });

  return io;
}

/** eventName: appointment:created | appointment:updated | appointment:cancelled */
function emitAppointmentEvent(eventName, payload) {
  if (!io) return;
  io.to('staff').to(`doctor:${payload.doctorId}`).emit(eventName, payload);
}

module.exports = { init, emitAppointmentEvent };
