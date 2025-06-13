const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const players = {};
const powerUps = [];

function randomColor() {
  const letters = '0123456789ABCDEF';
  return '#' + Array.from({length: 6}, () => letters[Math.floor(Math.random() * 16)]).join('');
}

function randomName() {
  return 'Player_' + Math.floor(Math.random() * 1000);
}

function spawnPowerUp() {
  return {
    id: Date.now(),
    x: Math.random() * 780,
    y: Math.random() * 580,
    type: 'health'
  };
}

// Spawn new power-ups every 10 seconds
setInterval(() => {
  const p = spawnPowerUp();
  powerUps.push(p);
  io.emit('new-powerup', p);
}, 10000);

io.on('connection', socket => {
  console.log(`${socket.id} connected`);
  players[socket.id] = {
    x: Math.random() * 780,
    y: Math.random() * 580,
    hp: 100,
    color: randomColor(),
    name: randomName(),
    kills: 0,
    deaths: 0
  };

  socket.emit('init', { id: socket.id, players, powerUps });
  socket.broadcast.emit('player-joined', { id: socket.id, player: players[socket.id] });

  socket.on('move', pos => {
    if (players[socket.id]) {
      players[socket.id].x = Math.max(0, Math.min(780, pos.x));
      players[socket.id].y = Math.max(0, Math.min(580, pos.y));
      socket.broadcast.emit('player-moved', { id: socket.id, pos: players[socket.id] });
    }
  });

  socket.on('shoot', targetId => {
    if (players[targetId]) {
      players[targetId].hp -= 25;
      io.emit('player-hit', { id: targetId, hp: players[targetId].hp });
      if (players[targetId].hp <= 0) {
        players[socket.id].kills++;
        players[targetId].deaths++;
        players[targetId].x = Math.random() * 780;
        players[targetId].y = Math.random() * 580;
        players[targetId].hp = 100;
        io.emit('player-respawned', { id: targetId, player: players[targetId] });
      }
    }
  });

  socket.on('collect', pId => {
    const index = powerUps.findIndex(p => p.id === pId);
    if (index !== -1) {
      players[socket.id].hp = Math.min(100, players[socket.id].hp + 20);
      io.emit('powerup-collected', { id: pId, player: socket.id, hp: players[socket.id].hp });
      powerUps.splice(index, 1);
    }
  });

  socket.on('chat', msg => {
    io.emit('chat', `${players[socket.id].name}: ${msg}`);
  });

  socket.on('disconnect', () => {
    console.log(`${socket.id} disconnected`);
    delete players[socket.id];
    io.emit('player-left', socket.id);
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
