
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server,{
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


const onlineUser = new Map();

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
        jwt.verify(token, process.env.JWT_TOKEN || "default_token", (err, decoded) => {
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
    onlineUser.set(socket.id, {username:socket.user.username, id: socket.id});
    console.log("Online users: ", Array.from(onlineUser.values()));
    socket.on("chat", (msg, cb) => {
        if (!msg || msg.trim() === "") return;
        io.emit("chat", msg);
        cb({"msg":"message received"});
    });
 
    io.of("/initiaPos").on("connection",(socket)=>{
        console.log("a user connected to /initiaPos");
        socket.on("initialPos",(data,cb)=>{
            if(!data) return;
            io.of("/initiaPos").emit("initialPos",data);
            cb({msg:"initial position received","data are":data});
        });
        socket.on("moves",(data,cb)=>{
            socket.emit("moves",data);
            cb({msg:"moves received","data are":data});
        })
    });

    io.of("/moves").on("connection", (socket) => {
        console.log("a user connected to /moves");
        socket.on("move", (data) => {
            if (!data) return;
            console.log(data)
            io.of("/moves").emit("move", data);
        });

    });
    socket.on("disconnect", () => {
        console.log("user disconnected");
        onlineUser.delete(socket.id,{username:socket.user.username, id: socket.id});
    });
});

app.get('/', (req, res) => {
    res.send('<h1>Hello world</h1>');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});