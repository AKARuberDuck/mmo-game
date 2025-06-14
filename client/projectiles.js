export const projectiles = [];

export function spawnProjectile(x, y, angle, speed = 12, lifespan = 1000) {
  const now = Date.now();
  projectiles.push({
    x,
    y,
    angle,
    speed,
    createdAt: now,
    lifespan
  });
}

export function updateProjectiles(ctx, camX, camY) {
  const now = Date.now();
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (now - p.createdAt > p.lifespan) {
      projectiles.splice(i, 1);
      continue;
    }
    p.x += Math.cos(p.angle) * p.speed;
    p.y += Math.sin(p.angle) * p.speed;

    ctx.beginPath();
    ctx.arc(p.x - camX, p.y - camY, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffeb3b';
    ctx.fill();
  }
}
