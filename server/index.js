const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

let players = {};

io.on('connection', socket => {
  console.log(`Player ${socket.id} connected`);
  players[socket.id] = { x: 0, y: 0 };

  socket.emit('init', { id: socket.id, players });
  socket.broadcast.emit('player-joined', { id: socket.id });

  socket.on('move', pos => {
    players[socket.id] = pos;
    socket.broadcast.emit('player-moved', { id: socket.id, pos });
  });

  socket.on('disconnect', () => {
    console.log(`Player ${socket.id} left`);
    delete players[socket.id];
    socket.broadcast.emit('player-left', socket.id);
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
