const socket = io('https://your-render-url.onrender.com'); // Update after deployment
let playerId = null;
let players = {};

socket.on('init', ({ id, players: serverPlayers }) => {
  playerId = id;
  players = serverPlayers;
});

socket.on('player-joined', ({ id }) => {
  players[id] = { x: 0, y: 0 };
});

socket.on('player-moved', ({ id, pos }) => {
  players[id] = pos;
});

socket.on('player-left', id => {
  delete players[id];
});

const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

function gameLoop() {
  const speed = 2;
  let pos = players[playerId];
  if (!pos) return;

  if (keys['ArrowUp']) pos.y -= speed;
  if (keys['ArrowDown']) pos.y += speed;
  if (keys['ArrowLeft']) pos.x -= speed;
  if (keys['ArrowRight']) pos.x += speed;

  socket.emit('move', pos);
  draw();
  requestAnimationFrame(gameLoop);
}

function draw() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  Object.entries(players).forEach(([id, { x, y }]) => {
    ctx.fillStyle = id === playerId ? 'blue' : 'green';
    ctx.fillRect(x, y, 20, 20);
  });
}
