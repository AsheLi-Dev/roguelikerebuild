import { centerOf, distance } from "../core/runtime-utils.js";
import { getEnemyTargetCenter } from "./enemy-targeting.js";
import { isEntityBlinded } from "./status-manager.js";

const ENEMY_DETECTION_RANGE_CAMERA_HEIGHT_MULT = 0.6;

export function getEnemyAwareness(game, enemy) {
  if (game?.runStartIntro?.active && (game.runStartIntro.elapsed || 0) < 2) {
    const enemyCenter = centerOf(enemy);
    const playerCenter = getEnemyTargetCenter(game);
    const detectionRange = (game.camera?.viewHeight ?? game.canvas?.height ?? 720) * ENEMY_DETECTION_RANGE_CAMERA_HEIGHT_MULT;
    const alertRange = detectionRange * 2;
    const dist = distance(playerCenter.x, playerCenter.y, enemyCenter.x, enemyCenter.y);
    return { state: "idle", distance: dist, detectionRange, alertRange, speedMultiplier: 0 };
  }
  if (isEntityBlinded(enemy)) {
    const enemyCenter = centerOf(enemy);
    const detectionRange = (game.camera?.viewHeight ?? game.canvas?.height ?? 720) * ENEMY_DETECTION_RANGE_CAMERA_HEIGHT_MULT;
    const alertRange = detectionRange * 2;
    return { state: "blinded", distance: Infinity, detectionRange, alertRange, speedMultiplier: 0.5 };
  }
  const playerCenter = getEnemyTargetCenter(game);
  const enemyCenter = centerOf(enemy);
  const dist = distance(playerCenter.x, playerCenter.y, enemyCenter.x, enemyCenter.y);
  const detectionRange = (game.camera?.viewHeight ?? game.canvas?.height ?? 720) * ENEMY_DETECTION_RANGE_CAMERA_HEIGHT_MULT;
  const alertRange = detectionRange * 2;

  if (dist <= detectionRange) {
    return { state: "detected", distance: dist, detectionRange, alertRange, speedMultiplier: 1 };
  }
  if (dist <= alertRange) {
    return { state: "alerted", distance: dist, detectionRange, alertRange, speedMultiplier: 0.5 };
  }
  return { state: "idle", distance: dist, detectionRange, alertRange, speedMultiplier: 0 };
}
