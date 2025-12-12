import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'https://syncarena.onrender.com',
      'http://localhost:3000',
      'http://localhost:8000',
      'http://127.0.0.1:5500'
    ],
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000
});




// Store all connected players (by room)
const rooms = new Map(); // roomName -> Map(playerId -> playerData)

function getOrCreateRoom(roomName) {
    if (!rooms.has(roomName)) {
        rooms.set(roomName, new Map());
    }
    return rooms.get(roomName);
}

function getPlayersInRoom(roomName) {
    const room = rooms.get(roomName);
    return room ? Array.from(room.values()) : [];
}

io.on("connection", (socket) => {
    console.log(`Socket ${socket.id.substr(0,6)} connected from ${socket.handshake.address}`);
    
    let currentRoom = null;

    // Handle room join
    socket.on("joinRoom", (data) => {
        const roomName = data.room || 'default-room';
        currentRoom = roomName;
        
        // Join the socket.io room
        socket.join(roomName);
        console.log(`Player ${socket.id.substr(0,6)} joining room: ${roomName}`);
        
        // Get or create room players map
        const roomPlayers = getOrCreateRoom(roomName);
        
        // Generate a random starting position
        const startingPosition = {
            x: Math.random() * 1800 + 100,
            y: Math.random() * 900 + 100
        };
        
        // Create new player object
        const newPlayer = {
            id: socket.id,
            x: startingPosition.x,
            y: startingPosition.y,
            character: ['character', 'character2', 'character3'][roomPlayers.size % 3],
            room: roomName
        };
        
        // Add player to room
        roomPlayers.set(socket.id, newPlayer);
        
        // Send the new player their initial data
        socket.emit("playerJoined", {
            playerId: socket.id,
            playerData: newPlayer,
            allPlayers: Array.from(roomPlayers.values()),
            roomName: roomName
        });
        
        console.log(`Sent playerJoined to ${socket.id.substr(0,6)}, room: ${roomName}, total players: ${roomPlayers.size}`);
        
        // Tell all OTHER players in the same room about the new player
        socket.to(roomName).emit("newPlayer", newPlayer);
        
        // Announce to everyone in the room
        io.in(roomName).emit("announce", {
            type: "join",
            playerId: socket.id,
            message: `Player ${socket.id.substr(0,6)} joined the room`
        });
        
        // Send existing players
        socket.emit("existingPlayers", Array.from(roomPlayers.values()));
    });
    
    // Handle player movement
    socket.on("playerMove", (data) => {
        if (!currentRoom) return;
        
        const roomPlayers = rooms.get(currentRoom);
        if (roomPlayers && roomPlayers.has(socket.id)) {
            const player = roomPlayers.get(socket.id);
            player.x = data.x;
            player.y = data.y;
            
            socket.to(currentRoom).emit("playerMoved", {
                playerId: socket.id,
                x: data.x,
                y: data.y,
                character: player.character
            });
        }
    });
    
    // Handle chat messages
    socket.on("chatMessage", (message) => {
        if (!message || message.trim() === "" || !currentRoom) return;
        
        const chatData = {
            playerId: socket.id,
            playerName: socket.id.substr(0, 6),
            message: message.trim(),
            timestamp: Date.now()
        };
        
        io.in(currentRoom).emit("chatMessage", chatData);
    });
    
    // Get room status
    socket.on("getRoomStatus", () => {
        if (!currentRoom) {
            socket.emit("roomStatus", { error: "Not in a room" });
            return;
        }
        
        const roomInfo = io.sockets.adapter.rooms.get(currentRoom);
        const playersInRoom = roomInfo ? roomInfo.size : 0;
        const roomPlayers = rooms.get(currentRoom);
        
        socket.emit("roomStatus", {
            roomName: currentRoom,
            playersInRoom: playersInRoom,
            totalPlayersTracked: roomPlayers ? roomPlayers.size : 0,
            playersList: roomPlayers ? Array.from(roomPlayers.keys()).map(id => id.substr(0, 6)) : []
        });
    });
    
    // Handle player disconnect
    socket.on("disconnect", () => {
        console.log(`Socket ${socket.id.substr(0,6)} disconnected`);
        
        if (currentRoom) {
            const roomPlayers = rooms.get(currentRoom);
            if (roomPlayers) {
                roomPlayers.delete(socket.id);
                
                // Clean up empty rooms
                if (roomPlayers.size === 0) {
                    rooms.delete(currentRoom);
                    console.log(`Room ${currentRoom} deleted (empty)`);
                }
            }
            
            socket.to(currentRoom).emit("playerLeft", socket.id);

            io.in(currentRoom).emit("announce", {
                type: "leave",
                playerId: socket.id,
                message: `Player ${socket.id.substr(0,6)} left the room`
            });
        }
    });
    
    // --- WebRTC Signaling ---
    socket.on('webrtc-offer', (payload) => {
        // payload: { target, offer, from }
        if (payload && payload.target) {
            io.to(payload.target).emit('webrtc-offer', { offer: payload.offer, from: payload.from });
        } else if (currentRoom) {
            socket.to(currentRoom).emit('webrtc-offer', { offer: payload.offer, from: payload.from });
        }
    });

    socket.on('webrtc-answer', (payload) => {
        // payload: { target, answer, from }
        if (payload && payload.target) {
            io.to(payload.target).emit('webrtc-answer', { answer: payload.answer, from: payload.from });
        }
    });

    socket.on('webrtc-ice-candidate', (payload) => {
        // payload: { target, candidate, from }
        if (payload && payload.target) {
            io.to(payload.target).emit('webrtc-ice-candidate', { candidate: payload.candidate, from: payload.from });
        }
    });
});




app.get("/status", (req, res) => {
    res.json({ status: "ok", activeRooms: rooms.size });
})

// Connection error logging
io.engine.on('connection_error', (err) => {
    console.error('Engine connection_error:', err);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Multiplayer server listening on *:${PORT}`);
});