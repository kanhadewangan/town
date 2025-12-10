const fs = require('fs');
const path = require('path');

// Session store to track active sessions
class SessionStore {
  constructor() {
    this.sessions = new Map();
  }

  set(sid, data) {
    this.sessions.set(sid, { ...data, timestamp: Date.now() });
  }

  get(sid) {
    return this.sessions.get(sid);
  }

  has(sid) {
    return this.sessions.has(sid);
  }

  delete(sid) {
    this.sessions.delete(sid);
  }

  // Clean expired sessions (older than 24 hours)
  cleanup(maxAge = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    for (const [sid, data] of this.sessions) {
      if (now - data.timestamp > maxAge) {
        this.sessions.delete(sid);
      }
    }
  }
}

// Middleware to handle connection errors gracefully
function createSocketIOMiddleware(sessionStore) {
  return {
    // Validate incoming requests
    validateConnection: (socket) => {
      const sid = socket.handshake.query.sid;

      // Allow new connections without SID
      if (!sid) {
        return true;
      }

      // Check if session exists
      if (!sessionStore.has(sid)) {
        return false;
      }

      return true;
    },

    // Handle successful connections
    onConnect: (socket) => {
      const sid = socket.id;
      sessionStore.set(sid, { transport: socket.handshake.query.transport });
    },

    // Handle disconnections
    onDisconnect: (socket, reason) => {
      // Don't immediately delete; let cleanup handle it
      // This allows brief reconnects within timeout window
    }
  };
}

module.exports = {
  SessionStore,
  createSocketIOMiddleware
};
