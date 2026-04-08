import { centerOf, normalize } from "../core/runtime-utils.js";
import { getEnemySeparationCircleAt } from "./enemy-movement-collider.js";

export const ENEMY_APPROACH_SLOT_RADIUS_MIN = 10;
export const ENEMY_APPROACH_SLOT_RADIUS_MAX = 100;
export const ENEMY_APPROACH_SLOT_ARC = Math.PI / 6;
export const ENEMY_APPROACH_SLOT_SPACING = 24;
export const ENEMY_APPROACH_SLOT_CANDIDATES = 8;
export const ENEMY_APPROACH_SLOT_PRIORITY_COUNT = 30;
export const ENEMY_APPROACH_SLOT_HOLD_MIN = 0.45;
export const ENEMY_APPROACH_SLOT_HOLD_MAX = 0.8;
export const ENEMY_APPROACH_SLOT_RETRY_COOLDOWN = 0.18;
export const ENEMY_APPROACH_SLOT_TURN_REASSIGN_ANGLE = Math.PI / 7.2;
export const ENEMY_APPROACH_SLOT_SMOOTH_TIME_MIN = 0.12;
export const ENEMY_APPROACH_SLOT_SMOOTH_TIME_MAX = 0.2;
export const ENEMY_APPROACH_FACE_PLAYER_DISTANCE = 10;
export const ENEMY_APPROACH_LOITER_RADIUS = 10;
export const ENEMY_APPROACH_LOITER_SPEED_MIN = 0.8;
export const ENEMY_APPROACH_LOITER_SPEED_MAX = 1.35;

export function hashEnemyApproachSeed(enemy) {
  const seed = `${enemy?.spawnGroupId || ""}|${enemy?.type || ""}|${enemy?.id || ""}|${enemy?.movementTactic || ""}`;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shouldUseApproachOffset(enemy) {
  const tactic = String(enemy?.movementTactic || "").trim().toLowerCase();
  return tactic === "brave" || tactic === "swarmer";
}

function randomFromSeed(seed) {
  let value = seed >>> 0;
  value = Math.imul(value ^ 61, value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function angleBetween(a, b) {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y));
  return Math.acos(dot);
}

function getEnemyApproachSlotState(enemy) {
  enemy.state ||= {};
  enemy.state.approachSlot ||= {
    x: 0,
    y: 0,
    radius: 0,
    angle: 0,
    expiresAt: 0,
    retryAt: 0,
    generation: 0,
    hasSlot: false,
    sector: "right",
    targetX: 0,
    targetY: 0,
    transitionFromX: 0,
    transitionFromY: 0,
    transitionStartAt: 0,
    transitionUntil: 0,
    lastDirX: Number.NaN,
    lastDirY: Number.NaN
  };
  return enemy.state.approachSlot;
}

function getApproachSector(playerCenter, point) {
  const dx = point.x - playerCenter.x;
  const dy = point.y - playerCenter.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "down" : "up";
}

function getOtherEnemySlotPoint(other) {
  const slot = other?.state?.approachSlot;
  if (!slot?.hasSlot) return null;
  if (!Number.isFinite(slot.targetX) || !Number.isFinite(slot.targetY)) return null;
  return { x: slot.targetX, y: slot.targetY };
}

function getEnemyApproachSpacing(enemy) {
  const circle = getEnemySeparationCircleAt(enemy);
  const baseSpacing = Math.max(ENEMY_APPROACH_SLOT_SPACING, (circle?.radius || 0) * 1.35);
  const tactic = String(enemy?.movementTactic || "").trim().toLowerCase();
  if (tactic === "brave") return Math.max(18, baseSpacing * 0.9);
  if (tactic === "swarmer") return Math.max(16, baseSpacing * 0.78);
  return baseSpacing;
}

function getEnemyApproachRadiusRange(enemy) {
  const circle = getEnemySeparationCircleAt(enemy);
  const sizeRadius = circle?.radius || Math.max(8, (enemy?.w || 24) * 0.16);
  const tactic = String(enemy?.movementTactic || "").trim().toLowerCase();
  let min = ENEMY_APPROACH_SLOT_RADIUS_MIN;
  let max = ENEMY_APPROACH_SLOT_RADIUS_MAX;

  if (tactic === "brave") {
    min = 10 + sizeRadius * 0.1;
    max = 64 + sizeRadius * 0.55;
  } else if (tactic === "swarmer") {
    min = 22 + sizeRadius * 0.2;
    max = 92 + sizeRadius * 0.85;
  } else {
    min = 14 + sizeRadius * 0.18;
    max = 80 + sizeRadius * 0.72;
  }

  if ((enemy?.drawSize || enemy?.w || 0) >= 96) {
    min += 10;
    max += 18;
  }

  return {
    min: Math.max(8, min),
    max: Math.max(min + 18, max)
  };
}

function getEnemyApproachArc(enemy) {
  const tactic = String(enemy?.movementTactic || "").trim().toLowerCase();
  if (tactic === "brave") return ENEMY_APPROACH_SLOT_ARC * 0.8;
  if (tactic === "swarmer") return ENEMY_APPROACH_SLOT_ARC * 1.2;
  return ENEMY_APPROACH_SLOT_ARC;
}

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function updateEnemyApproachSlotPosition(slot, time) {
  if (!slot?.hasSlot) return null;
  if (!Number.isFinite(slot.targetX) || !Number.isFinite(slot.targetY)) return null;
  if (!(slot.transitionUntil > slot.transitionStartAt) || time >= slot.transitionUntil) {
    slot.x = slot.targetX;
    slot.y = slot.targetY;
    return { x: slot.x, y: slot.y };
  }
  const duration = Math.max(0.001, slot.transitionUntil - slot.transitionStartAt);
  const t = smoothstep((time - slot.transitionStartAt) / duration);
  slot.x = slot.transitionFromX + (slot.targetX - slot.transitionFromX) * t;
  slot.y = slot.transitionFromY + (slot.targetY - slot.transitionFromY) * t;
  return { x: slot.x, y: slot.y };
}

function isEnemyEligibleForApproachSlot(game, playerCenter, enemy) {
  if (!enemy || enemy.dead || !shouldUseApproachOffset(enemy)) return false;
  const currentSlot = enemy.state?.approachSlot;
  if (currentSlot?.hasSlot) return true;
  const enemies = game?.enemies || [];
  let closerCount = 0;
  const enemyCenter = centerOf(enemy);
  const enemySector = getApproachSector(playerCenter, enemyCenter);
  const enemyDistance = Math.hypot(playerCenter.x - enemyCenter.x, playerCenter.y - enemyCenter.y);

  for (let index = 0; index < enemies.length; index += 1) {
    const other = enemies[index];
    if (!other || other === enemy || other.dead || !shouldUseApproachOffset(other)) continue;
    const otherCenter = centerOf(other);
    const otherSector = getApproachSector(playerCenter, otherCenter);
    if (otherSector !== enemySector) continue;
    const otherDistance = Math.hypot(playerCenter.x - otherCenter.x, playerCenter.y - otherCenter.y);
    if (otherDistance < enemyDistance) {
      closerCount += 1;
      if (closerCount >= ENEMY_APPROACH_SLOT_PRIORITY_COUNT) return false;
    }
  }
  return true;
}

function slotOverlapsOtherEnemy(game, playerCenter, enemy, candidatePoint) {
  const candidateSector = getApproachSector(playerCenter, candidatePoint);
  const candidateSpacing = getEnemyApproachSpacing(enemy);
  const enemies = game?.enemies || [];
  for (let index = 0; index < enemies.length; index += 1) {
    const other = enemies[index];
    if (!other || other === enemy || other.dead) continue;
    if (!shouldUseApproachOffset(other)) continue;
    if ((other.state?.approachSlot?.sector || null) !== candidateSector) continue;
    const otherPoint = getOtherEnemySlotPoint(other);
    if (!otherPoint) continue;
    const spacing = Math.max(candidateSpacing, getEnemyApproachSpacing(other));
    if (Math.hypot(candidatePoint.x - otherPoint.x, candidatePoint.y - otherPoint.y) < spacing) {
      return true;
    }
  }
  return false;
}

function buildSlotCandidate(playerCenter, baseAngle, enemy, generation, candidateIndex) {
  const seedBase = hashEnemyApproachSeed(enemy) + generation * 131 + candidateIndex * 977;
  const angleT = randomFromSeed(seedBase) * 2 - 1;
  const radiusT = randomFromSeed(seedBase ^ 0x9e3779b9);
  const arc = getEnemyApproachArc(enemy);
  const radiusRange = getEnemyApproachRadiusRange(enemy);
  const angle = baseAngle + angleT * arc;
  const radius = radiusRange.min + (radiusRange.max - radiusRange.min) * radiusT;
  return {
    x: playerCenter.x + Math.cos(angle) * radius,
    y: playerCenter.y + Math.sin(angle) * radius,
    angle,
    radius
  };
}

function tryAssignEnemyApproachSlot(game, playerCenter, enemy, enemyCenter, baseDir, time) {
  const slot = getEnemyApproachSlotState(enemy);
  const baseAngle = Math.atan2(enemyCenter.y - playerCenter.y, enemyCenter.x - playerCenter.x);
  const sector = getApproachSector(playerCenter, enemyCenter);
  const generation = (slot.generation || 0) + 1;

  for (let index = 0; index < ENEMY_APPROACH_SLOT_CANDIDATES; index += 1) {
    const candidate = buildSlotCandidate(playerCenter, baseAngle, enemy, generation, index);
    if (slotOverlapsOtherEnemy(game, playerCenter, enemy, candidate)) continue;
    const previousPoint = updateEnemyApproachSlotPosition(slot, time) || { x: candidate.x, y: candidate.y };
    slot.angle = candidate.angle;
    slot.radius = candidate.radius;
    slot.sector = sector;
    slot.targetX = candidate.x;
    slot.targetY = candidate.y;
    slot.transitionFromX = previousPoint.x;
    slot.transitionFromY = previousPoint.y;
    slot.transitionStartAt = time;
    slot.transitionUntil = time + ENEMY_APPROACH_SLOT_SMOOTH_TIME_MIN
      + (ENEMY_APPROACH_SLOT_SMOOTH_TIME_MAX - ENEMY_APPROACH_SLOT_SMOOTH_TIME_MIN) * randomFromSeed(generation ^ 0xc2b2ae35);
    slot.expiresAt = time + ENEMY_APPROACH_SLOT_HOLD_MIN
      + (ENEMY_APPROACH_SLOT_HOLD_MAX - ENEMY_APPROACH_SLOT_HOLD_MIN) * randomFromSeed(generation ^ 0x85ebca6b);
    slot.retryAt = 0;
    slot.generation = generation;
    slot.hasSlot = true;
    slot.lastDirX = baseDir.x;
    slot.lastDirY = baseDir.y;
    return slot;
  }

  slot.hasSlot = false;
  slot.sector = sector;
  slot.transitionUntil = time;
  slot.retryAt = time + ENEMY_APPROACH_SLOT_RETRY_COOLDOWN;
  slot.generation = generation;
  slot.lastDirX = baseDir.x;
  slot.lastDirY = baseDir.y;
  return slot;
}

function ensureEnemyApproachSlot(game, playerCenter, enemy, enemyCenter, dirToPlayer, time) {
  const slot = getEnemyApproachSlotState(enemy);
  if (!isEnemyEligibleForApproachSlot(game, playerCenter, enemy)) {
    slot.hasSlot = false;
    slot.retryAt = 0;
    slot.transitionUntil = time;
    slot.lastDirX = dirToPlayer.x;
    slot.lastDirY = dirToPlayer.y;
    return slot;
  }
  const hasLastDir = Number.isFinite(slot.lastDirX) && Number.isFinite(slot.lastDirY);
  const lastDir = hasLastDir ? normalize(slot.lastDirX, slot.lastDirY, dirToPlayer) : dirToPlayer;
  const turnAngle = hasLastDir ? angleBetween(lastDir, dirToPlayer) : Infinity;
  const slotExpired = !slot.hasSlot || time >= (slot.expiresAt || 0);
  const shouldReassignForTurn = hasLastDir
    && turnAngle >= ENEMY_APPROACH_SLOT_TURN_REASSIGN_ANGLE
    && time >= (slot.expiresAt || 0);

  if (!slotExpired && !shouldReassignForTurn) {
    slot.lastDirX = dirToPlayer.x;
    slot.lastDirY = dirToPlayer.y;
    return slot;
  }
  if (!slot.hasSlot && time < (slot.retryAt || 0)) {
    slot.lastDirX = dirToPlayer.x;
    slot.lastDirY = dirToPlayer.y;
    return slot;
  }
  return tryAssignEnemyApproachSlot(game, playerCenter, enemy, enemyCenter, dirToPlayer, time);
}

export function getEnemyApproachTargetPoint(game, playerCenter, enemy, time = 0) {
  if (!enemy || !shouldUseApproachOffset(enemy)) {
    return { x: playerCenter.x, y: playerCenter.y };
  }
  const enemyCenter = centerOf(enemy);
  const dirToPlayer = normalize(playerCenter.x - enemyCenter.x, playerCenter.y - enemyCenter.y, { x: 1, y: 0 });
  const slot = ensureEnemyApproachSlot(game, playerCenter, enemy, enemyCenter, dirToPlayer, time);
  if (!slot?.hasSlot) return null;
  return updateEnemyApproachSlotPosition(slot, time);
}

function getEnemyApproachLoiterTargetPoint(anchorPoint, enemy, time = 0) {
  const hash = hashEnemyApproachSeed(enemy);
  const angle = ((hash >>> 11) & 2047) / 2048 * Math.PI * 2;
  const radiusT = ((hash >>> 22) & 255) / 255;
  const radius = 3 + (ENEMY_APPROACH_LOITER_RADIUS - 3) * radiusT;
  const speedT = ((hash >>> 4) & 255) / 255;
  const angularSpeed = ENEMY_APPROACH_LOITER_SPEED_MIN
    + (ENEMY_APPROACH_LOITER_SPEED_MAX - ENEMY_APPROACH_LOITER_SPEED_MIN) * speedT;
  const orbitAngle = angle + time * angularSpeed;
  return {
    x: anchorPoint.x + Math.cos(orbitAngle) * radius,
    y: anchorPoint.y + Math.sin(orbitAngle) * radius
  };
}

export function buildEnemyApproachContext(game, playerCenter, enemy, time = 0) {
  const enemyCenter = centerOf(enemy);
  const dx = playerCenter.x - enemyCenter.x;
  const dy = playerCenter.y - enemyCenter.y;
  const dirToPlayer = normalize(dx, dy, { x: 1, y: 0 });
  const targetDistance = Math.hypot(dx, dy);
  const useOffset = shouldUseApproachOffset(enemy);
  const approachTargetPoint = getEnemyApproachTargetPoint(game, playerCenter, enemy, time);

  if (useOffset && !approachTargetPoint) {
    return {
      playerCenter: { x: playerCenter.x, y: playerCenter.y },
      enemyCenter,
      dirToPlayer,
      targetDistance,
      approachTargetPoint: null,
      anchorDistance: Infinity,
      movementTargetPoint: null,
      approachDir: { x: 0, y: 0 },
      approachDistance: Infinity,
      referenceDir: { x: 0, y: 0 },
      referenceDistance: Infinity,
      useOffset,
      shouldFacePlayer: false,
      hasSlot: false
    };
  }

  const resolvedApproachTargetPoint = approachTargetPoint || { x: playerCenter.x, y: playerCenter.y };
  const anchorDx = resolvedApproachTargetPoint.x - enemyCenter.x;
  const anchorDy = resolvedApproachTargetPoint.y - enemyCenter.y;
  const anchorDistance = Math.hypot(anchorDx, anchorDy);
  const shouldFacePlayer = useOffset && anchorDistance <= ENEMY_APPROACH_FACE_PLAYER_DISTANCE;
  const movementTargetPoint = shouldFacePlayer
    ? getEnemyApproachLoiterTargetPoint(resolvedApproachTargetPoint, enemy, time)
    : resolvedApproachTargetPoint;
  const approachDx = movementTargetPoint.x - enemyCenter.x;
  const approachDy = movementTargetPoint.y - enemyCenter.y;
  const approachDistance = Math.hypot(approachDx, approachDy);
  const movementDir = normalize(approachDx, approachDy, dirToPlayer);

  return {
    playerCenter: { x: playerCenter.x, y: playerCenter.y },
    enemyCenter,
    dirToPlayer,
    targetDistance,
    approachTargetPoint: resolvedApproachTargetPoint,
    anchorDistance,
    movementTargetPoint,
    approachDir: movementDir,
    approachDistance,
    referenceDir: useOffset ? movementDir : dirToPlayer,
    referenceDistance: useOffset ? approachDistance : targetDistance,
    useOffset,
    shouldFacePlayer,
    hasSlot: true
  };
}
