const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// 🔐 Replace these with your actual Supabase credentials:
const SUPABASE_URL = 'https://hbfyvamesmgdczjkqnzx.supabase.co';
const SUPABASE_KEY = 'YOUR_PUBLIC_ANON_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let players = {};
let structures = [];
let powerUps = [];
let npcs = [{ id: 'npc1', x: 300, y: 300, hp: 50 }];
let weather = 'clear';
let lobby = {};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randomName() {
  return 'Player_' + Math.floor(Math.random() * 1000);
}
setInterval(() => {
  const options = ['clear', 'rain', 'storm', 'snow'];
  weather = options[Math.floor(Math.random() * options.length)];
  io.emit('weather-update', weather);
}, 30000);
async function loadPlayerFromDB(socketId) {
  const { data } = await supabase
    .from('players')
    .select('*')
    .eq('id', socketId)
    .single();

  if (data) return data;

  const newPlayer = {
    id: socketId,
    name: randomName(),
    class: 'Scout',
    xp: 0,
    level: 1,
    coins: 0,
    kills: 0,
    deaths: 0
  };
  await supabase.from('players').insert([newPlayer]);
  return newPlayer;
}

async function savePlayerToDB(socketId) {
  const p = players[socketId];
  if (!p) return;
  await supabase.from('players').update(p).eq('id', socketId);
}
io.on('connection', async socket => {
  console.log(`[+] ${socket.id} connected`);

  const player = await loadPlayerFromDB(socket.id);
  player.hp = 100;
  player.x = rand(20, 760);
  player.y = rand(20, 560);
  player.zone = null;
  players[socket.id] = player;
  lobby[socket.id] = player;

  io.emit('lobby-update', Object.values(lobby));

  socket.on('join-game', zone => {
    player.zone = zone || 'forest';
    delete lobby[socket.id];

    io.emit('lobby-update', Object.values(lobby));
    socket.emit('init', { id: socket.id, players, powerUps });
    socket.broadcast.emit('player-joined', { id: socket.id, player });
  });
  socket.on('move', pos => {
    const p = players[socket.id];
    if (!p) return;
    p.x = Math.max(0, Math.min(780, pos.x));
    p.y = Math.max(0, Math.min(580, pos.y));
    io.emit('player-moved', { id: socket.id, pos: p });
  });

  socket.on('shoot', targetId => {
    const a = players[socket.id];
    const t = players[targetId];
    if (!a || !t || a.zone !== t.zone) return;

    t.hp -= 25;
    io.emit('player-hit', { id: targetId, hp: t.hp });

    if (t.hp <= 0) {
      a.kills++; a.coins += 10; a.xp += 20;
      if (a.xp >= a.level * 50) a.level++;
      t.deaths++; t.hp = 100;
      t.x = rand(0, 780); t.y = rand(0, 580);
      io.emit('player-respawned', { id: targetId, player: t });
      console.log(`[💀] ${a.name} killed ${t.name}`);
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

  socket.on('chat', msg => {
    io.emit('chat', `${players[socket.id].name}: ${msg}`);
  });

  socket.on('change-zone', zone => {
    players[socket.id].zone = zone;
    socket.emit('zone-changed', zone);
  });

  socket.on('admin-cmd', cmd => {
    if (cmd.startsWith('/kick')) {
      const id = cmd.split(' ')[1];
      if (players[id]) io.to(id).disconnect();
    }
    if (cmd.startsWith('/msg')) {
      const msg = cmd.slice(5);
      io.emit('chat', `[ADMIN]: ${msg}`);
    }
  });
  socket.on('disconnect', async () => {
    console.log(`[-] ${socket.id} disconnected`);
    await savePlayerToDB(socket.id);
    delete players[socket.id];
    delete lobby[socket.id];
    io.emit('player-left', socket.id);
    io.emit('lobby-update', Object.values(lobby));
  });
});
app.get('/api/leaderboard', async (req, res) => {
  const { data } = await supabase
    .from('players')
    .select('name, kills, deaths, level')
    .order('kills', { ascending: false })
    .limit(10);
  res.json(data || []);
});
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
