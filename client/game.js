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
function toggleFullscreen() {
  if (!document.fullscreenElement) canvas.requestFullscreen();
  else document.exitFullscreen();
}
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
