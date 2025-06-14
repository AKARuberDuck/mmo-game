import { classes, renderClassOverlay } from './classSelector.js';

Object.entries(otherPlayers).forEach(([id, p]) => {
  if (id === player.id) return; // skip self

  const screenX = p.x - (player.x - canvas.width / 2);
  const screenY = p.y - (player.y - canvas.height / 2);

  // Draw red enemy
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'red';
  ctx.fillRect(-10, -10, 20, 20);
  ctx.restore();

  // Draw name
  ctx.fillStyle = 'white';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(p.name || `P${id.slice(0, 4)}`, screenX, screenY - 15);
});
let player = {
  id: null,
  x: 400,
  y: 300,
  angle: 0,
  class: null,
  name: null,
  hp: 100,
  xp: 0,
  level: 1,
  speed: 3,
  weapon: null,
  ammo: {},
  lastShot: 0,
  isReloading: false
};

let otherPlayers = {};
let killfeed = [];
let messages = {};
const keys = {};
let mouseX = 0;
let mouseY = 0;
let mouseDown = false;
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    canvas.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}
socket.on('init', data => {
  player.id = data.id;
  Object.assign(player, data.players[data.id]);
});

socket.on('player-hit', ({ id, hp }) => {
  if (id === player.id) {
    player.hp = hp;
  }
});

socket.on('update-players', players => {
  otherPlayers = players;
});

socket.on('kill', ({ killer, victim }) => {
  killfeed.unshift({ msg: `${killer} ➤ ${victim}`, time: Date.now() });
  killfeed = killfeed.slice(0, 5);
});

socket.on('chat', text => {
  messages[text + Date.now()] = { msg: text, time: Date.now() };
  if (Object.keys(messages).length > 5) {
    const oldest = Object.keys(messages).sort()[0];
    delete messages[oldest];
  }
});

socket.on('respawn', () => {
  player.hp = 100;
  player.x = Math.random() * 800;
  player.y = Math.random() * 600;
});
document.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  keys[key] = true;

  if (key === '1') player.weapon = 'rifle';
  if (key === '2') player.weapon = 'shotgun';
  if (key === '3') player.weapon = 'pistol';
  if (key === 'r') reloadWeapon();
  if (key === 'f') toggleFullscreen();
  if (key === 'enter') {
    const msg = prompt('Chat:');
    if (msg) socket.emit('chat', msg);
  }
});

document.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

canvas.addEventListener('mousedown', () => (mouseDown = true));
canvas.addEventListener('mouseup', () => (mouseDown = false));
function updateMovement() {
  const speed = 3;
  if (keys['w'] || keys['arrowup']) player.y -= speed;
  if (keys['s'] || keys['arrowdown']) player.y += speed;
  if (keys['a'] || keys['arrowleft']) player.x -= speed;
  if (keys['d'] || keys['arrowright']) player.x += speed;

  socket.emit('move', { x: player.x, y: player.y });
}

function tryShoot() {
  if (!mouseDown || player.isReloading) return;

  const now = Date.now();
  const weapon = weapons[player.weapon];

  if (now - player.lastShot >= weapon.fireRate && player.ammo[player.weapon] > 0) {
    socket.emit('shoot', { angle: player.angle, weapon: player.weapon });
    player.lastShot = now;
    player.ammo[player.weapon]--;

    const muzzleX = player.x + Math.cos(player.angle) * 20;
    const muzzleY = player.y + Math.sin(player.angle) * 20;
    spawnProjectile(muzzleX, muzzleY, player.angle);
  }

  if (player.ammo[player.weapon] === 0 && !player.isReloading) {
    reloadWeapon();
  }
}

function reloadWeapon() {
  player.isReloading = true;
  setTimeout(() => {
    player.ammo[player.weapon] = weapons[player.weapon].maxAmmo;
    player.isReloading = false;
  }, weapons[player.weapon].reloadTime);
}

function getAngleToMouse() {
  const dx = mouseX - canvas.width / 2;
  const dy = mouseY - canvas.height / 2;
  return Math.atan2(dy, dx);
}
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const camX = player.x - canvas.width / 2;
  const camY = player.y - canvas.height / 2;

  player.angle = getAngleToMouse();
  updateProjectiles(ctx, camX, camY);

  // Draw other players
  Object.entries(otherPlayers).forEach(([id, p]) => {
    if (id === player.id) return;

    const sx = p.x - camX;
    const sy = p.y - camY;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.angle || 0);
    ctx.fillStyle = 'red';
    ctx.fillRect(-10, -10, 20, 20);
    ctx.restore();

    ctx.fillStyle = 'white';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || `P${id.slice(0, 4)}`, sx, sy - 20);

    ctx.fillStyle = 'darkred';
    ctx.fillRect(sx - 20, sy - 10, 40, 4);
    ctx.fillStyle = 'lime';
    ctx.fillRect(sx - 20, sy - 10, 40 * (p.hp / 100), 4);
  });

  // Draw local player
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
  ctx.fillText(`Weapon: ${weapons[player.weapon].name}`, 10, 40);
  ctx.fillText(`Ammo: ${player.ammo[player.weapon]} / ${weapons[player.weapon].maxAmmo}`, 10, 60);
  if (player.isReloading) ctx.fillText('Reloading...', 10, 80);
  ctx.fillText('[F] Fullscreen', canvas.width - 150, 20);

  // Killfeed
  killfeed.forEach((e, i) => {
    if (Date.now() - e.time < 5000) {
      ctx.fillText(e.msg, canvas.width - 220, 100 + i * 18);
    }
  });

  // Chat messages
  Object.values(messages).forEach((e, i) => {
    if (Date.now() - e.time < 7000) {
      ctx.fillStyle = 'lightgreen';
      ctx.fillText(e.msg, 10, canvas.height - 20 - i * 18);
    }
  });
}
function gameLoop() {
  updateMovement();
  tryShoot();
  render();
  requestAnimationFrame(gameLoop);
}

gameLoop();
