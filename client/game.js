import { weapons } from './weapons.js';
import { spawnProjectile, updateProjectiles } from './projectiles.js';
import { classes, renderClassOverlay } from './classSelector.js';

const socket = io();
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const MAP_SCALE = 0.1;

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
let keys = {};
let mouseX = 0;
let mouseY = 0;
let mouseDown = false;
let killfeed = [];
let messages = {};

// ─── Fullscreen Toggle ───────────────────────────────

function toggleFullscreen() {
  if (!document.fullscreenElement) canvas.requestFullscreen();
  else document.exitFullscreen();
}

// ─── Socket Events ───────────────────────────────────

socket.on('init', data => {
  player.id = data.id;
  Object.assign(player, data.players[data.id]);

  renderClassOverlay(classId => {
    const selected = classes[classId];
    player.class = selected.name;
    player.hp = selected.hp;
    player.speed = selected.speed;
    player.weapon = selected.weapon;
    player.ammo = {
      rifle: weapons.rifle.maxAmmo,
      shotgun: weapons.shotgun.maxAmmo,
      pistol: weapons.pistol.maxAmmo
    };
    socket.emit('class-select', classId);
  });
});

socket.on('update-players', players => {
  otherPlayers = players;
});

socket.on('player-hit', ({ id, hp }) => {
  if (id === player.id) player.hp = hp;
});

socket.on('kill', ({ killer, victim }) => {
  killfeed.unshift({ msg: `${killer} ➤ ${victim}`, time: Date.now() });
  killfeed = killfeed.slice(0, 5);
});

socket.on('chat', msg => {
  messages[msg + Date.now()] = { msg, time: Date.now() };
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

// ─── Input Events ─────────────────────────────────────

document.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  keys[key] = true;

  if (key === '1') player.weapon = 'rifle';
  if (key === '2') player.weapon = 'shotgun';
  if (key === '3') player.weapon = 'pistol';
  if (key === 'r') reloadWeapon();
  if (key === 'f') toggleFullscreen();
  if (key === 'c') {
    renderClassOverlay(classId => {
      const selected = classes[classId];
      player.class = selected.name;
      player.hp = selected.hp;
      player.speed = selected.speed;
      player.weapon = selected.weapon;
      socket.emit('class-select', classId);
    });
  }
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

canvas.addEventListener('mousedown', () => mouseDown = true);
canvas.addEventListener('mouseup', () => mouseDown = false);

// ─── Movement & Shooting ──────────────────────────────

function updateMovement() {
  const speed = player.speed || 3;
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

  if (player.ammo[player.weapon] === 0 && !player.isReloading) reloadWeapon();
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

// ─── Rendering ────────────────────────────────────────

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const camX = player.x - canvas.width / 2;
  const camY = player.y - canvas.height / 2;
  player.angle = getAngleToMouse();

  updateProjectiles(ctx, camX, camY);

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

  // Player avatar
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
  ctx.fillText(`Ammo: ${player.ammo[player.weapon] || 0}`, 10, 60);
  ctx.fillText(`Level: ${player.level} XP: ${player.xp}`, 10, 80);
  if (player.isReloading) ctx.fillText('Reloading...', 10, 100);
  ctx.fillText('[F] Fullscreen | [Enter] Chat | [C] Switch Class', 10, 130);

  // Killfeed
  killfeed.forEach((e, i) => {
    if (Date.now() - e.time < 5000) {
      ctx.fillText(e.msg, canvas.width - 220, 100 + i * 18);
    }
  });

  // Chat
  Object.values(messages).forEach((e, i) => {
    if (Date.now() - e.time < 7000) {
      ctx.fillStyle = 'lightgreen';
      ctx.fillText(e.msg, 10, canvas.height - 20 - i * 18);
    }
  });

  // Minimap
  const miniX = canvas.width - 110;
  const miniY = canvas.height - 110;
  ctx.fillStyle = '#222';
  ctx.fillRect(miniX, miniY, 100, 100);
  Object.entries(otherPlayers).forEach(([id, p]) => {
    if (id === player.id) return;
    const dotX = miniX + p.x * MAP_SCALE;
    const dotY = miniY + p.y * MAP_SCALE;
    ctx.fillStyle = 'red';
    ctx.fillRect(dotX,
  ctx.fillStyle = 'blue';
  ctx.fillRect(miniX + player.x * MAP_SCALE, miniY + player.y * MAP_SCALE, 5, 5);

  // Minimap border
  ctx.strokeStyle = 'white';
  ctx.strokeRect(miniX, miniY, 100, 100);
}
