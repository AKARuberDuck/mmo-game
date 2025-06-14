const socket = io(); // auto-connect to same domain
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let player = {
  id: null,
  x: 400,
  y: 300,
  angle: 0,
  weapon: 'rifle',
  hp: 100,
  ammo: { rifle: 10, shotgun: 4, pistol: 15 }
};

const keys = {};
let mouseX = 0;
let mouseY = 0;
let mouseDown = false;
socket.on('init', data => {
  player.id = data.id;
  player = { ...player, ...data.players[data.id] };
});

socket.on('player-hit', ({ id, hp }) => {
  if (id === player.id) {
    player.hp = hp;
    console.log(`You've been hit! HP: ${hp}`);
  }
});
document.addEventListener('keydown', e => (keys[e.key.toLowerCase()] = true));
document.addEventListener('keyup', e => (keys[e.key.toLowerCase()] = false));
canvas.addEventListener('mousemove', e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});
canvas.addEventListener('mousedown', () => (mouseDown = true));
canvas.addEventListener('mouseup', () => (mouseDown = false));
function updateMovement() {
  const speed = 3;
  if (keys['w']) player.y -= speed;
  if (keys['s']) player.y += speed;
  if (keys['a']) player.x -= speed;
  if (keys['d']) player.x += speed;

  socket.emit('move', { x: player.x, y: player.y });
}
function getAngleToMouse() {
  const dx = mouseX - canvas.width / 2;
  const dy = mouseY - canvas.height / 2;
  return Math.atan2(dy, dx);
}

function tryShoot() {
  if (!mouseDown) return;
  const now = Date.now();
  if (!player.lastShot || now - player.lastShot > 300) {
    socket.emit('shoot', { angle: player.angle, weapon: player.weapon });
    player.lastShot = now;
  }
}
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const camX = player.x - canvas.width / 2;
  const camY = player.y - canvas.height / 2;

  player.angle = getAngleToMouse();

  // Draw player
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(player.angle);
  ctx.fillStyle = 'blue';
  ctx.fillRect(-10, -10, 20, 20);
  ctx.restore();

  // HUD
  ctx.fillStyle = 'white';
  ctx.font = '14px monospace';
  ctx.fillText(`HP: ${player.hp}`, 10, 20);
  ctx.fillText(`Weapon: ${player.weapon}`, 10, 40);
}

function gameLoop() {
  updateMovement();
  tryShoot();
  render();
  requestAnimationFrame(gameLoop);
}
gameLoop();
