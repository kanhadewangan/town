
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store all connected players
const players = new Map();
const GAME_ROOM = 'main-game-room'; // Single consistent room name

io.on("connection", (socket) => {
    console.log(`🔌 Player connected: ${socket.id}`);
    
    // Join the main game room - ALL players join the same room
    socket.join(GAME_ROOM);
    console.log(`🏠 Player ${socket.id} joined room: ${GAME_ROOM}`);
    
    // Generate a random starting position
    const startingPosition = {
        x: Math.random() * 1800 + 100, // Random x between 100-1900
        y: Math.random() * 900 + 100   // Random y between 100-1000
    };
    
    // Create new player object
    const newPlayer = {
        id: socket.id,
        x: startingPosition.x,
        y: startingPosition.y,
        character: `character${(players.size % 5) + 1}`, // Cycle through character1-5
        room: GAME_ROOM
    };
    
    // Add player to our players map
    players.set(socket.id, newPlayer);
    
    console.log(`👥 Total players in game: ${players.size}`);
    
    // Send the new player their initial data
    socket.emit("playerJoined", {
        playerId: socket.id,
        playerData: newPlayer,
        allPlayers: Array.from(players.values()),
        roomName: GAME_ROOM
    });
    
    // Tell all OTHER players in the same room about the new player
    socket.to(GAME_ROOM).emit("newPlayer", newPlayer);
    
    console.log(`📢 Broadcasted new player ${socket.id} to room ${GAME_ROOM}`);
    
    // Announce to everyone in the room that a player joined (includes the new player)
    io.in(GAME_ROOM).emit("announce", {
        type: "join",
        playerId: socket.id,
        message: `Player ${socket.id.substr(0,6)} joined the room`
    });
    
    // Also send explicit existingPlayers event (help clients that listen for it)
    socket.emit("existingPlayers", Array.from(players.values()));
    
    // Handle player movement
    socket.on("playerMove", (data) => {
        if (players.has(socket.id)) {
            // Update player position in server
            const player = players.get(socket.id);
            player.x = data.x;
            player.y = data.y;
            
            // Broadcast movement to ALL OTHER players in the same room
            socket.to(GAME_ROOM).emit("playerMoved", {
                playerId: socket.id,
                x: data.x,
                y: data.y,
                character: player.character
            });
            
            console.log(`🚶 Player ${socket.id.substr(0,6)} moved to (${Math.round(data.x)}, ${Math.round(data.y)}) - broadcasted to room ${GAME_ROOM}`);
        }
    });
    
    // Handle chat messages
    socket.on("chatMessage", (message) => {
        if (!message || message.trim() === "") return;
        
        const chatData = {
            playerId: socket.id,
            playerName: socket.id.substr(0, 6),
            message: message.trim(),
            timestamp: Date.now()
        };
        
        // Broadcast to all players in the room (including sender)
        io.in(GAME_ROOM).emit("chatMessage", chatData);
        console.log(`💬 Chat from ${chatData.playerName}: ${chatData.message}`);
    });
    
    // Debug: Get room status (optional - for debugging)
    socket.on("getRoomStatus", () => {
        const roomInfo = io.sockets.adapter.rooms.get(GAME_ROOM);
        const playersInRoom = roomInfo ? roomInfo.size : 0;
        
        socket.emit("roomStatus", {
            roomName: GAME_ROOM,
            playersInRoom: playersInRoom,
            totalPlayersTracked: players.size,
            playersList: Array.from(players.keys()).map(id => id.substr(0, 6))
        });
        
        console.log(`📊 Room ${GAME_ROOM}: ${playersInRoom} connected, ${players.size} tracked`);
    });
    
    // Handle player disconnect
    socket.on("disconnect", () => {
        console.log(`❌ Player disconnected: ${socket.id}`);
        
        // Remove player from players map
        players.delete(socket.id);
        console.log(`👥 Remaining players: ${players.size}`);
        
        // Tell all other players in the room that this player left
        socket.to(GAME_ROOM).emit("playerLeft", socket.id);
        console.log(`📢 Broadcasted player left ${socket.id} to room ${GAME_ROOM}`);

        // Announce leave to everyone in the room
        io.in(GAME_ROOM).emit("announce", {
            type: "leave",
            playerId: socket.id,
            message: `Player ${socket.id.substr(0,6)} left the room`
        });
    });
});

app.get('/', (req, res) => {
    res.send('<h1>Multiplayer Game Server</h1>');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Multiplayer server listening on *:${PORT}`);
});