const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const players = {};
const powerUps = [];
const structures = [];
let npcs = [{ id: 'npc1', x: 300, y: 300, hp: 50 }];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randomColor() {
  const letters = '0123456789ABCDEF';
  return '#' + Array.from({ length: 6 }, () => letters[Math.floor(Math.random() * 16)]).join('');
}

function randomName() {
  return 'Player_' + Math.floor(Math.random() * 1000);
}

function spawnPowerUp() {
  return { id: Date.now(), x: rand(20, 750), y: rand(20, 550), type: 'health' };
}

// NPC movement
setInterval(() => {
  npcs.forEach(npc => {
    const targets = Object.values(players).filter(p => p.zone === (npc.zone || 'forest'));
    if (targets.length === 0) return;
    const target = targets[Math.floor(Math.random() * targets.length)];
    const dx = target.x - npc.x;
    const dy = target.y - npc.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 5) {
      npc.x += (dx / dist) * 1;
      npc.y += (dy / dist) * 1;
    }
  });
  io.emit('npc-update', npcs);
}, 500);

// Power-up spawning
setInterval(() => {
  const p = spawnPowerUp();
  powerUps.push(p);
  io.emit('new-powerup', p);
}, 10000);

io.on('connection', socket => {
  console.log(`[+] ${socket.id} connected`);
  players[socket.id] = {
    id: socket.id,
    x: rand(0, 780),
    y: rand(0, 580),
    hp: 100,
    color: randomColor(),
    name: randomName(),
    kills: 0,
    deaths: 0,
    xp: 0,
    level: 1,
    zone: 'forest',
    coins: 0,
    class: 'Scout'
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
    const attacker = players[socket.id];
    const target = players[targetId];
    if (attacker && target && attacker.zone === target.zone) {
      target.hp -= 25;
      io.emit('player-hit', { id: targetId, hp: target.hp });
      if (target.hp <= 0) {
        attacker.kills++;
        attacker.xp += 20;
        attacker.coins += 10;
        if (attacker.xp >= attacker.level * 50) attacker.level++;
        target.deaths++;
        target.hp = 100;
        target.x = rand(0, 780);
        target.y = rand(0, 580);
        io.emit('player-respawned', { id: targetId, player: target });
        console.log(`[💀] ${attacker.name} killed ${target.name}`);
      }
    }
  });

  socket.on('collect', pId => {
    const pIndex = powerUps.findIndex(p => p.id === pId);
    if (pIndex !== -1) {
      players[socket.id].hp = Math.min(100, players[socket.id].hp + 20);
      powerUps.splice(pIndex, 1);
      io.emit('powerup-collected', { id: pId, player: socket.id, hp: players[socket.id].hp });
    }
  });

  socket.on('build', obj => {
    structures.push({ ...obj, owner: socket.id });
    io.emit('structure-added', structures);
  });

  socket.on('buy', item => {
    const p = players[socket.id];
    if (item === 'heal' && p.coins >= 5) {
      p.coins -= 5;
      p.hp = Math.min(100, p.hp + 25);
      socket.emit('item-used', p);
    }
  });

  socket.on('change-zone', zone => {
    players[socket.id].zone = zone;
    socket.emit('zone-changed', zone);
  });

  socket.on('chat', msg => {
    io.emit('chat', `${players[socket.id].name}: ${msg}`);
  });

  socket.on('admin-cmd', raw => {
    if (raw.startsWith('/kick')) {
      const id = raw.split(' ')[1];
      if (players[id]) io.to(id).disconnect();
    }
    if (raw.startsWith('/msg')) {
      const msg = raw.slice(5);
      io.emit('chat', `[ADMIN]: ${msg}`);
    }
    if (raw.startsWith('/powerup')) {
      const p = spawnPowerUp();
      powerUps.push(p);
      io.emit('new-powerup', p);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id} disconnected`);
    delete players[socket.id];
    io.emit('player-left', socket.id);
  });
});

server.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
