const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

const SUPABASE_URL = 'https://hbfyvamesmgdczjkqnzx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiZnl2YW1lc21nZGN6amtxbnp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MzU1MDgsImV4cCI6MjA2NTQxMTUwOH0.9srkRg41WGkDEzdOBfnKWLuJEVtmy8AZvOHT_fsaf6Q'; // Replace this!
const supabase = createClient(https://hbfyvamesmgdczjkqnzx.supabase.co, eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiZnl2YW1lc21nZGN6amtxbnp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MzU1MDgsImV4cCI6MjA2NTQxMTUwOH0.9srkRg41WGkDEzdOBfnKWLuJEVtmy8AZvOHT_fsaf6Q);

// Game state
let players = {};
let lobby = {};
let structures = [];
let powerUps = [];
let weather = 'clear';

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randomName() {
  return 'Player_' + Math.floor(Math.random() * 1000);
}

// Weather system: broadcast every 30s
setInterval(() => {
  const states = ['clear', 'rain', 'snow', 'storm'];
  weather = states[Math.floor(Math.random() * states.length)];
  io.emit('weather-update', weather);
}, 30000);

// Load or create player in DB
async function loadPlayerFromDB(id) {
  const { data } = await supabase.from('players').select('*').eq('id', id).single();
  if (data) return data;

  const newPlayer = {
    id,
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

// Save player back to DB
async function savePlayerToDB(id) {
  const p = players[id];
  if (!p) return;
  await supabase.from('players').update(p).eq('id', id);
}

// Scoreboard API
app.get('/api/leaderboard', async (req, res) => {
  const { data } = await supabase
    .from('players')
    .select('name, kills, deaths, level')
    .order('kills', { ascending: false })
    .limit(10);

  res.json(data || []);
});

// WebSocket logic
io.on('connection', async socket => {
  console.log(`[+] ${socket.id} connected`);

  const p = await loadPlayerFromDB(socket.id);
  p.hp = 100;
  p.x = rand(20, 760);
  p.y = rand(20, 560);
  p.zone = null;
  players[socket.id] = p;
  lobby[socket.id] = p;

  io.emit('lobby-update', Object.values(lobby));

  socket.on('join-game', zone => {
    p.zone = zone || 'forest';
    delete lobby[socket.id];

    io.emit('lobby-update', Object.values(lobby));
    socket.emit('init', {
      id: socket.id,
      players,
      powerUps
    });

    socket.broadcast.emit('player-joined', { id: socket.id, player: p });
  });

  socket.on('move', pos => {
    const player = players[socket.id];
    if (!player) return;
    player.x = Math.max(0, Math.min(780, pos.x));
    player.y = Math.max(0, Math.min(580, pos.y));
    io.emit('player-moved', { id: socket.id, pos: player });
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
    } else if (cmd.startsWith('/msg')) {
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

server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
