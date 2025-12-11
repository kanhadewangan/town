import { jest } from '@jest/globals';
const { SessionStore, createSocketIOMiddleware } = require('../socketio-debug');

describe('Socket.IO Middleware', () => {
  let sessionStore;
  let middleware;
  let mockSocket;

  beforeEach(() => {
    sessionStore = new SessionStore();
    middleware = createSocketIOMiddleware(sessionStore);
    mockSocket = {
      id: 'socket123',
      handshake: {
        query: {}
      }
    };
  });

  test('validateConnection allows new connections without SID', () => {
    mockSocket.handshake.query = {};
    const result = middleware.validateConnection(mockSocket);
    expect(result).toBe(true);
  });

  test('validateConnection rejects connections with invalid SID', () => {
    mockSocket.handshake.query = { sid: 'invalidSid' };
    const result = middleware.validateConnection(mockSocket);
    expect(result).toBe(false);
  });

  test('validateConnection allows connections with valid SID', () => {
    sessionStore.set('validSid', { transport: 'websocket' });
    mockSocket.handshake.query = { sid: 'validSid' };
    const result = middleware.validateConnection(mockSocket);
    expect(result).toBe(true);
  });

  test('onConnect stores session data', () => {
    mockSocket.handshake.query = { transport: 'websocket' };
    middleware.onConnect(mockSocket);
    const sessionData = sessionStore.get('socket123');
    expect(sessionData).toBeDefined();
    expect(sessionData.transport).toBe('websocket');
  });

  test('onDisconnect removes session data', () => {
    sessionStore.set('socket123', { transport: 'websocket' });
    middleware.onDisconnect(mockSocket, 'client disconnect');
    const sessionData = sessionStore.get('socket123');
    expect(sessionData).toBeUndefined();
  });

  test('SessionStore cleanup removes expired sessions', () => {
    const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
    sessionStore.sessions.set('oldSid', { transport: 'websocket', timestamp: oldTimestamp });
    sessionStore.sessions.set('newSid', { transport: 'polling', timestamp: Date.now() });

    sessionStore.cleanup();

    expect(sessionStore.has('oldSid')).toBe(false);
    expect(sessionStore.has('newSid')).toBe(true);
  });
});
    