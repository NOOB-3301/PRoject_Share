import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors'

let rooms = {};
let socketToRoom = {};


const app = express();
app.use(cors({ origin: '*', credentials: true }));


const server = createServer(app); // Properly create an HTTP server
const io = new Server(server,{
    cors:{
        origin:'*',
        methods:["GET", "POST"],
        credentials:true
    }
}); // Pass the correct server instance

app.get('/', (req, res) => {
    res.send('hello world');
});

io.on('connection', (socket) => {
    console.log('a user connected');
    // Handle user disconnect
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
        // let a new user join to the room
        const roomId = data.room
        socket.join(roomId);
        socketToRoom[socket.id] = roomId;

        // persist the new user in the room
        if (rooms[roomId]) {
            rooms[roomId].push({id: socket.id, name: data.name});
        } else {
            rooms[roomId] = [{id: socket.id, name: data.name}];
        }

        // sends a list of joined users to a new user
        const users = rooms[data.room].filter(user => user.id !== socket.id);
        io.sockets.to(socket.id).emit("room_users", users);
        console.log("[joined] room:" + data.room + " name: " + data.name);
    });

    socket.on("offer", sdp => {
        socket.broadcast.emit("getOffer", sdp);
        console.log("offer: " + socket.id);
    });

    socket.on("answer", sdp => {
        socket.broadcast.emit("getAnswer", sdp);
        console.log("answer: " + socket.id);
    });

    socket.on("candidate", candidate => {
        socket.broadcast.emit("getCandidate", candidate);
        console.log("candidate: " + socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
