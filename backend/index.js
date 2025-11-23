
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
    // Join the main game room - ALL players join the same room
    socket.join(GAME_ROOM);
    
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
        character: `character${(players.size % 5) + 1}`,
        room: GAME_ROOM
    };
    
    // Add player to our players map
    players.set(socket.id, newPlayer);
    
    // Send the new player their initial data
    socket.emit("playerJoined", {
        playerId: socket.id,
        playerData: newPlayer,
        allPlayers: Array.from(players.values()),
        roomName: GAME_ROOM
    });
    
    // Tell all OTHER players in the same room about the new player
    socket.to(GAME_ROOM).emit("newPlayer", newPlayer);
    
    // Announce to everyone in the room that a player joined
    io.in(GAME_ROOM).emit("announce", {
        type: "join",
        playerId: socket.id,
        message: `Player ${socket.id.substr(0,6)} joined the room`
    });
    
    // Also send explicit existingPlayers event
    socket.emit("existingPlayers", Array.from(players.values()));
    
    // Handle player movement
    socket.on("playerMove", (data) => {
        if (players.has(socket.id)) {
            const player = players.get(socket.id);
            player.x = data.x;
            player.y = data.y;
            
            socket.to(GAME_ROOM).emit("playerMoved", {
                playerId: socket.id,
                x: data.x,
                y: data.y,
                character: player.character
            });
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
        
        io.in(GAME_ROOM).emit("chatMessage", chatData);
    });
    
    // Get room status
    socket.on("getRoomStatus", () => {
        const roomInfo = io.sockets.adapter.rooms.get(GAME_ROOM);
        const playersInRoom = roomInfo ? roomInfo.size : 0;
        
        socket.emit("roomStatus", {
            roomName: GAME_ROOM,
            playersInRoom: playersInRoom,
            totalPlayersTracked: players.size,
            playersList: Array.from(players.keys()).map(id => id.substr(0, 6))
        });
    });
    
    // Handle player disconnect
    socket.on("disconnect", () => {
        players.delete(socket.id);
        
        socket.to(GAME_ROOM).emit("playerLeft", socket.id);

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