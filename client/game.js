const socket = io('https://mmo-game.onrender.com');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const chatInput = document.getElementById('chat-input');

let playerId = null;
let players = {};
let npcs = [];
let powerUps = [];
let structures = [];

const keys = {};

document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === '/' && document.activeElement !== chatInput) {
    e.preventDefault();
    const cmd = prompt("Admin command:");
    if (cmd) socket.emit('admin-cmd', cmd);
  }
});
document.addEventListener('keyup', e => keys[e.key] = false);

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    socket.emit('chat', e.target.value);
    e.target.value = '';
  }
});

function switchZone(zone) {
  socket.emit('change-zone', zone);
}

function buy(item) {
  socket.emit('buy', item);
}

socket.on('init', ({ id, players: serverPlayers, powerUps: serverPowers }) => {
  playerId = id;
  players = serverPlayers;
  powerUps = serverPowers;
  requestAnimationFrame(gameLoop);
});

socket.on('player-joined', ({ id, player }) => players[id] = player);
socket.on('player-left', id => delete players[id]);
socket.on('player-moved', ({ id, pos }) => players[id] = pos);
socket.on('player-hit', ({ id, hp }) => {
  if (players[id]) players[id].hp = hp;
  if (id === playerId) document.getElementById('hit-sfx').play();
});
socket.on('player-respawned', ({ id, player }) => {
  players[id] = player;
  if (id === playerId) document.getElementById('respawn-sfx').play();
});
socket.on('npc-update', updated => npcs = updated);
socket.on('structure-added', list => structures = list);
socket.on('new-powerup', p => powerUps.push(p));
socket.on('powerup-collected', ({ id }) => powerUps = powerUps.filter(p => p.id !== id));
socket.on('chat', msg => {
  const box = document.getElementById('chat-box');
  box.innerHTML += `<div>${msg}</div>`;
  box.scrollTop = box.scrollHeight;
});
socket.on('item-used', updatedPlayer => {
  if (updatedPlayer.id === playerId) players[playerId] = updatedPlayer;
});

document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    const targetId = Object.entries(players)
      .find(([id, p]) => id !== playerId && sameZone(p) && dist(p, players[playerId]) < 30)?.[0];
    if (targetId) socket.emit('shoot', targetId);
  }
  if (e.key === 'b') {
    const me = players[playerId];
    socket.emit('build', { type: 'barrier', x: me.x + 30, y: me.y });
  }
});

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function sameZone(p) {
  return p.zone === players[playerId].zone;
}

function gameLoop() {
  const speed = 2;
  const me = players[playerId];
  if (!me) return;

  if (keys['ArrowUp']) me.y -= speed;
  if (keys['ArrowDown']) me.y += speed;
  if (keys['ArrowLeft']) me.x -= speed;
  if (keys['ArrowRight']) me.x += speed;

  socket.emit('move', me);
  draw();
  requestAnimationFrame(gameLoop);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  powerUps.forEach(p => {
    ctx.fillStyle = 'yellow';
    ctx.fillRect(p.x, p.y, 10, 10);
    if (dist(players[playerId], p) < 15) socket.emit('collect', p.id);
  });

  structures.forEach(s => {
    ctx.fillStyle = s.type === 'barrier' ? 'gray' : 'orange';
    ctx.fillRect(s.x, s.y, 30, 30);
  });

  Object.entries(players).forEach(([id, p]) => {
    if (!sameZone(p)) return;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 20, 20);
    ctx.fillStyle = 'black';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${p.name} Lv${p.level} (${p.hp})`, p.x - 10, p.y - 8);
  });

  npcs.forEach(npc => {
    ctx.fillStyle = 'red';
    ctx.fillRect(npc.x, npc.y, 20, 20);
    ctx.fillText(`NPC (${npc.hp})`, npc.x - 10, npc.y - 8);
  });
}
