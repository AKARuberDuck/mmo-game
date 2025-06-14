import { weapons } from './weapons.js';
import { spawnProjectile, updateProjectiles } from './projectiles.js';

const socket = io();
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let player = {
  id: null,
  x: 400,
  y: 300,
  angle: 0,
  hp: 100,
  weapon: 'rifle',
  ammo: {
    rifle: weapons.rifle.maxAmmo,
    shotgun: weapons.shotgun.maxAmmo,
    pistol: weapons.pistol.maxAmmo
  },
  lastShot: 0,
  isReloading: false
};

const keys = {};
let mouseX = 0;
let mouseY = 0;
let mouseDown = false;

socket.on('init', data => {
  player.id = data.id;
  Object.assign(player, data.players[data.id]);
});

socket.on('player-hit', ({ id, hp }) => {
  if (id === player.id) {
    player.hp = hp;
    console.log(`You've been hit! HP: ${hp}`);
  }
});

document.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  keys[key] = true;

  if (key === '1') player.weapon = 'rifle';
  if (key === '2') player.weapon = 'shotgun';
  if (key === '3') player.weapon = 'pistol';
  if (key === 'r') reloadWeapon();
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
  ctx.fillText(`Weapon: ${weapons[player.weapon].name}`, 10, 40);
  ctx.fillText(`Ammo: ${player.ammo[player.weapon]} / ${weapons[player.weapon].maxAmmo}`, 10, 60);
  if (player.isReloading) ctx.fillText('Reloading...', 10, 80);
}

function gameLoop() {
  updateMovement();
  tryShoot();
  render();
  requestAnimationFrame(gameLoop);
}

gameLoop();
