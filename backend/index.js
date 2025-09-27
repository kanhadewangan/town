
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

io.on("connection", (socket) => {
    console.log(`Player connected: ${socket.id}`);
    socket.join('game');
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
        character: `character${(players.size % 5) + 1}` // Cycle through character1-5
    };
    
    // Add player to our players map
    players.set(socket.id, newPlayer);
    
    // Send the new player their initial data
    socket.emit("playerJoined", {
        playerId: socket.id,
        playerData: newPlayer,
        allPlayers: Array.from(players.values())
    });
    
    // Tell all other players about the new player
    socket.broadcast.emit("newPlayer", newPlayer);
    
    // Send all existing players to the new player
    socket.emit("existingPlayers", Array.from(players.values()));
    
    // Handle player movement
    socket.on("playerMove", (data) => {
        if (players.has(socket.id)) {
            // Update player position in server
            const player = players.get(socket.id);
            player.x = data.x;
            player.y = data.y;
            
            // Broadcast movement to all other players in the game room
            socket.emit("playerMoved", {
                playerId: socket.id,
                x: data.x,
                y: data.y,
                character: player.character
            });
            
        }
    });
    
    // Handle player disconnect
    socket.on("disconnect", () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        // Remove player from players map
        players.delete(socket.id);
        
        // Tell all other players this player left
        socket.broadcast.emit("playerLeft", socket.id);
    });
});

app.get('/', (req, res) => {
    res.send('<h1>Multiplayer Game Server</h1>');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Multiplayer server listening on *:${PORT}`);
});