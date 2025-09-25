
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const onlineUser = new Map();

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
        console.log("token received: ", token);
        jwt.verify(token, process.env.JW_TOKEN, (err, decoded) => {
            if (err) {
                next(new Error("invalid token"));
            } else {
                socket.user = decoded;
                next();
            }
        });
    }
    else {
        next(new Error("invalid token"));
    }
})

io.on("connection", (socket) => {
    console.log("a user connected");
    onlineUser.set(socket.id, socket);
    socket.on("chat", (msg, cb) => {
        if (!msg || msg.trim() === "") return;
        io.emit("chat", msg);
        cb();
    });

    io.of("/moves").on("connection", (socket) => {
        console.log("a user connected to /moves");
        socket.on("move", (data, cb) => {
            if (!data) return;
            io.of("/moves").emit("move", data);
            cb({ msg: "move received", "data are": data });
        });

    });
    socket.on("disconnect", () => {
        console.log("user disconnected");
    });
});

app.get('/', (req, res) => {
    res.send('<h1>Hello world</h1>');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});