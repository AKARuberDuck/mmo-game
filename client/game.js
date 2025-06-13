const socket = io('https://your-render-url.onrender.com'); // Replace with your backend URL
const keys = {};
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let playerId = null;
let players = {};
let powerUps = [];

document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);
document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    socket.emit('chat', e.target.value);
    e.target.value = '';
  }
});

socket.on('init', data => {
  playerId = data.id;
  players = data.players;
  powerUps = data.powerUps;
  requestAnimationFrame(gameLoop);
});

socket.on('player-joined', ({ id, player }) => players[id] = player);
socket.on('player-left', id => delete players[id]);
socket.on('player-moved', ({ id, pos }) => players[id] = pos);
socket.on('player-hit', ({ id, hp }) => {
  players[id].hp = hp;
  if (id === playerId) document.getElementById('hit-sfx').play();
});
socket.on('player-respawned', ({ id, player }) => {
  players[id] = player;
  if (id === playerId) document.getElementById('respawn-sfx').play();
});
socket.on('new-powerup', p => powerUps.push(p));
socket.on('powerup-collected', ({ id }) => powerUps = powerUps.filter(p => p.id !== id));
socket.on('chat', msg => {
  const box = document.getElementById('chat-box');
  box.innerHTML += `<div>${msg}</div>`;
  box.scrollTop = box.scrollHeight;
});

document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    const targetId = Object.entries(players).find(([id, p]) => id !== playerId && distance(players[playerId], p) < 30)?.[0];
    if (targetId) socket.emit('shoot', targetId);
  }
});

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function gameLoop() {
  const speed = 2;
  const p = players[playerId];
  if (!p) return;

  if (keys['ArrowUp']) p.y -= speed;
  if (keys['ArrowDown']) p.y += speed;
  if (keys['ArrowLeft']) p.x -= speed;
  if (keys['ArrowRight']) p.x += speed;

  socket.emit('move', p);
  draw();
  requestAnimationFrame(gameLoop);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const p of powerUps) {
    ctx.fillStyle = 'yellow';
    ctx.fillRect(p.x, p.y, 10, 10);
    if (distance(players[playerId], p) < 15) socket.emit('collect', p.id);
  }

  for (const [id, player] of Object.entries(players)) {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, 20, 20);
    ctx.fillStyle = 'black';
    ctx.fillText(`${player.name} (${player.hp})`, player.x - 10, player.y - 5);
  }
}
