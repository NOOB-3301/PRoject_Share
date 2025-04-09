import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors'

let rooms = {};
let socketToRoom = {};

const app = express();
app.use(cors({ origin: '*', credentials: true }));

const server = createServer(app);
const io = new Server(server,{
    cors:{
        origin:'*',
        methods:["GET", "POST"],
        credentials:true
    }
});

app.get('/', (req, res) => {
    res.send('hello world');
});

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on("disconnect", () => {
        console.log('User disconnected:', socket.id);

        const roomId = socketToRoom[socket.id];
        if (roomId) {
            rooms[roomId] = rooms[roomId].filter(user => user.id !== socket.id);
            delete socketToRoom[socket.id];

            // Notify remaining users in the room
            io.to(roomId).emit("room_users", rooms[roomId]);
        }
    });

    socket.on("join", data => {
        const roomId = data.room;
        
        // Check if room exists and has less than 2 users
        if (rooms[roomId] && rooms[roomId].length >= 2) {
            // Room is full - emit an error event to the client
            socket.emit("room_join_error", { message: "Room is full! Maximum 2 users allowed." });
            return;
        }
        
        socket.join(roomId);
        socketToRoom[socket.id] = roomId;
        
        if (rooms[roomId]) {
            rooms[roomId].push({id: socket.id, name: data.name});
        } else {
            rooms[roomId] = [{id: socket.id, name: data.name}];
        }
        
        // sends a list of joined users to all users in the room
        io.to(roomId).emit("room_users", rooms[roomId]);
        io.emit("available_room", rooms);
        console.log("[joined] room:" + roomId + " name: " + data.name + " users:" + rooms[roomId].length);
    });

    // Modified WebRTC signaling to use rooms
    socket.on("offer", sdp => {
        const roomId = socketToRoom[socket.id];
        if (roomId) {
            socket.to(roomId).emit("getOffer", sdp);
            console.log("offer sent to room:", roomId);
        }
    });

    socket.on("answer", sdp => {
        const roomId = socketToRoom[socket.id];
        if (roomId) {
            socket.to(roomId).emit("getAnswer", sdp);
            console.log("answer sent to room:", roomId);
        }
    });

    socket.on("candidate", candidate => {
        const roomId = socketToRoom[socket.id];
        if (roomId) {
            socket.to(roomId).emit("getCandidate", candidate);
            console.log("candidate sent to room:", roomId);
        }
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
