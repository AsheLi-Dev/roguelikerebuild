export function isPlayerIgnoringEnemyCollision(player) {
  const movement = player?.movement;
  if (!movement) return false;
  return (movement.dashTimer || 0) > 0 || (movement.slideTimer || 0) > 0;
}

export function shouldPlayerBlockEnemies(player) {
  return !!player && !player.dead && !isPlayerIgnoringEnemyCollision(player);
}
