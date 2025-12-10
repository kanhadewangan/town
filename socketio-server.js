const io = require('socket.io')(8080, {
  cors: {
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: false
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e5,
  // ...existing options...
});

const {
  SessionStore,
  createSocketIOMiddleware
} = require('./socketio-debug');

const sessionStore = new SessionStore();
const middleware = createSocketIOMiddleware(sessionStore);

// Connection validation middleware
io.engine.on('connection', (req) => {
  middleware.validateConnection({ handshake: { query: req._query } });
});

// Handle connections
io.on('connection', (socket) => {
  middleware.onConnect(socket);

  socket.on('disconnect', (reason) => {
    middleware.onDisconnect(socket, reason);
  });

  // ...existing socket handlers...
});

// Periodic cleanup (every hour)
setInterval(() => {
  sessionStore.cleanup();
}, 60 * 60 * 1000);

console.log('Socket.IO server running on port 8080');
