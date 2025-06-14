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
