import { centerOf, distance } from "../core/runtime-utils.js";

export function getEnemyAwareness(game, enemy) {
  const playerCenter = centerOf(game.player);
  const enemyCenter = centerOf(enemy);
  const dist = distance(playerCenter.x, playerCenter.y, enemyCenter.x, enemyCenter.y);
  const detectionRange = game.camera?.viewHeight ?? game.canvas?.height ?? 720;
  const alertRange = detectionRange * 2;

  if (dist <= detectionRange) {
    return { state: "detected", distance: dist, detectionRange, alertRange, speedMultiplier: 1 };
  }
  if (dist <= alertRange) {
    return { state: "alerted", distance: dist, detectionRange, alertRange, speedMultiplier: 0.5 };
  }
  return { state: "idle", distance: dist, detectionRange, alertRange, speedMultiplier: 0 };
}
