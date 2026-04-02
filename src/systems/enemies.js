import { centerOf, clamp, createSeededRandom, distance, normalize, rectsOverlap, sample } from "../core/runtime-utils.js";
import { getBiomeSpawnPlan } from "../data/enemy-spawn-plans.js";
import { getEnemyTierDef, getValidAffixIds, normalizeEnemyTier, pickRandomAffixIds } from "../data/enemy-affixes.js";
import { BARBARIAN_ENEMY_IDS, BARBARIAN_ROOM_ROSTER, getBarbarianEnemyDef } from "../data/barbarian-enemies.js";
import { ROOM_ENEMY_TABLE, getEnemyDef } from "../data/enemies.js";
import { getShepardEnemyDef, SHEPARD_ENEMY_IDS, SHEPARD_ROOM_ROSTER } from "../data/shepard-enemies.js";
import { UNDEAD_ENEMY_IDS, UNDEAD_ROOM_ROSTER, getUndeadEnemyDef } from "../data/undead-enemies.js";
import { getEnemyAwareness } from "./enemy-awareness.js";
import { applyEnemyAuraSources, beginEnemyAffixFrame, updateEnemyAffixes } from "./enemy-affixes.js";
import { spawnEnemyProjectile } from "./combat.js";
import {
  computeEnemyMoveVector,
  createEnemyNavState,
  resolveEnemyWallOverlap as sharedResolveEnemyWallOverlap,
  tryMoveEnemy as sharedTryMoveEnemy
} from "./enemy-navigation.js";
import { releaseEnemyMeleeAttackToken } from "./melee-attack-tokens.js";
import { getEntitySlowMultiplier, updateStatusState } from "./status-manager.js";
import { createUndeadRuntime, isUndeadEnemy, updateUndeadEnemy } from "./undead-runtime.js";

const ENEMY_ATTACK_LOCKOUT_SECONDS = 2;
const ENEMY_TIER_POISE_MULT = Object.freeze({
  minion: 1,
  elite: 0.5,
  miniBoss: 0.15
});
const DEFAULT_MOVEMENT_TACTIC = "Balance";
const DEFAULT_ROLE = "melee";
const MINI_BOSS_TACTIC_WEIGHT = Object.freeze({
  Brave: 2.2,
  Balance: 1.8,
  Coward: 0.45,
  Swarmer: 0.35
});
const MINI_BOSS_ROLE_WEIGHT = Object.freeze({
  melee: 1.7,
  ranged: 0.65
});
const PLAYER_SPAWN_SAFE_RADIUS = 280;

function resolveEnemyWallOverlap(enemy, room, game = null) {
  return sharedResolveEnemyWallOverlap(game, enemy, room);
}

function tryMoveEnemy(enemy, room, dx, dy, game = null) {
  return sharedTryMoveEnemy(game, enemy, room, dx, dy);
}

function rerollBlindWander(enemy) {
  enemy.state ||= {};
  const angle = Math.random() * Math.PI * 2;
  enemy.state.blindWanderDirX = Math.cos(angle);
  enemy.state.blindWanderDirY = Math.sin(angle);
  enemy.state.blindWanderTimer = 0.45 + Math.random() * 0.55;
}

function updateBlindedBaseEnemy(game, enemy, dt) {
  enemy.state.dragonBreath = null;
  enemy.state.skeletonDash = null;
  enemy.state.skeletonDashCooldown = Math.max(enemy.state.skeletonDashCooldown || 0, 0.8);
  enemy.state.blindWanderTimer = Math.max(0, (enemy.state.blindWanderTimer || 0) - dt);
  if (
    (enemy.state.blindWanderTimer || 0) <= 0 ||
    !Number.isFinite(enemy.state.blindWanderDirX) ||
    !Number.isFinite(enemy.state.blindWanderDirY)
  ) {
    rerollBlindWander(enemy);
  }
  const dir = normalize(enemy.state.blindWanderDirX || 1, enemy.state.blindWanderDirY || 0, { x: 1, y: 0 });
  const moved = tryMoveEnemy(enemy, game.world, dir.x * enemy.speed * 0.5 * dt, dir.y * enemy.speed * 0.5 * dt, game);
  if (!moved) rerollBlindWander(enemy);
  enemy.facing = dir.x >= 0 ? 1 : -1;
  enemy.direction = dir.x >= 0 ? "right" : "left";
  enemy.isMoving = moved;
  enemy.render.sheetKey = moved && enemy.sprite.move ? "move" : "idle";
  enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite[enemy.render.sheetKey]?.fps || 8)) % Math.max(1, enemy.sprite[enemy.render.sheetKey]?.frames || 1);
}

function tickEnemyHitReaction(enemy, dt) {
  enemy.hitTimer = Math.max(0, (enemy.hitTimer || 0) - dt);
  enemy.plateConsumeCooldownTimer = Math.max(0, (enemy.plateConsumeCooldownTimer || 0) - dt);
  enemy.staggerPauseTimer = Math.max(0, (enemy.staggerPauseTimer || 0) - dt);
  enemy.staggerTimer = Math.max(0, (enemy.staggerTimer || 0) - dt);
  if (enemy.staggerTimer <= 0) {
    enemy.staggerMoveSpeed = 0;
    enemy.hitDirX = 0;
    enemy.hitDirY = 0;
  }
}

function applyEnemyStaggerMotion(game, enemy, dt) {
  if ((enemy.staggerTimer || 0) <= 0 || (enemy.staggerMoveSpeed || 0) <= 0) return false;
  const speed = enemy.staggerMoveSpeed * Math.min(1, enemy.staggerTimer / Math.max(0.001, enemy.staggerDuration || 0.001));
  if (speed <= 0.1) return false;
  tryMoveEnemy(enemy, game.world, (enemy.hitDirX || 0) * speed * dt, (enemy.hitDirY || 0) * speed * dt, game);
  enemy.isMoving = false;
  return true;
}

function setEnemyHitRenderFrame(enemy) {
  const sheet = enemy?.sprite?.hit;
  if (!sheet) return false;
  const total = Math.max(0.001, enemy.hitDuration || (sheet.frames / Math.max(0.001, sheet.fps || 1)));
  const progress = clamp(1 - (enemy.hitTimer || 0) / total, 0, 0.9999);
  enemy.render.sheetKey = "hit";
  enemy.render.frame = clamp(Math.floor(progress * sheet.frames), 0, Math.max(0, sheet.frames - 1));
  return true;
}

function steerEnemyMovement(game, enemy, desiredDir, targetPoint, dt, options = {}) {
  const movement = computeEnemyMoveVector(game, enemy, desiredDir, targetPoint, dt, options);
  return tryMoveEnemy(
    enemy,
    game.world,
    movement.dir.x * enemy.speed * movement.speedMult * dt,
    movement.dir.y * enemy.speed * movement.speedMult * dt,
    game
  );
}

function randomizeEnemyAnimClock(sprite, random = Math.random) {
  const candidates = [sprite?.idle, sprite?.move].filter(Boolean);
  let maxCycleDuration = 0;
  for (const sheet of candidates) {
    const frames = Math.max(1, Number(sheet.frames) || 1);
    const fps = Math.max(0.001, Number(sheet.fps) || 8);
    maxCycleDuration = Math.max(maxCycleDuration, frames / fps);
  }
  return maxCycleDuration > 0 ? random() * maxCycleDuration : 0;
}

function randomizeEnemyAnimationSpeed(def, random = Math.random) {
  if (!def?.sprite?.move) return 1;
  return 0.9 + random() * 0.22;
}

function getMovementSheetFrame(enemy) {
  const moveSheet = enemy?.sprite?.move;
  if (!moveSheet) return 0;
  const frames = Math.max(1, Number(moveSheet.frames) || 1);
  const fps = Math.max(0.001, Number(moveSheet.fps) || 8);
  return Math.floor((enemy.animClock || 0) * fps) % frames;
}

function getBaseEnemyMovementSpeedMultiplier(enemy) {
  const profile = enemy?.movementProfile;
  if (profile?.kind !== "slimeHop") return 1;
  const moveSheet = enemy?.sprite?.move;
  if (!moveSheet) return 1;
  const frames = Math.max(1, Number(moveSheet.frames) || 1);
  if (frames <= 1) return profile.peakSpeedMult ?? 1;
  const minSpeedMult = profile.minSpeedMult ?? 0.3;
  const peakSpeedMult = profile.peakSpeedMult ?? 1;
  const peakFrameIndex = clamp((profile.peakFrame ?? 1) - 1, 0, frames - 1);
  const currentFrame = getMovementSheetFrame(enemy);
  if (currentFrame <= peakFrameIndex) {
    const t = peakFrameIndex <= 0 ? 1 : currentFrame / peakFrameIndex;
    return minSpeedMult + (peakSpeedMult - minSpeedMult) * t;
  }
  const trailingFrames = Math.max(1, (frames - 1) - peakFrameIndex);
  const t = (currentFrame - peakFrameIndex) / trailingFrames;
  return peakSpeedMult + (minSpeedMult - peakSpeedMult) * t;
}

function isEvasiveRetreatActive(enemy) {
  return (enemy?.affixState?.evasiveRetreatTimer || 0) > 0;
}

function getErraticMoveDir(enemy) {
  if ((enemy?.affixState?.erraticBurstAt || 0) <= 0) return null;
  return normalize(enemy.affixState.erraticMoveDirX, enemy.affixState.erraticMoveDirY, { x: 1, y: 0 });
}

function buildBaseEnemy(def, x, y, random = Math.random) {
  return {
    id: `${def.id}_${Math.random().toString(36).slice(2, 8)}`,
    type: def.id,
    name: def.name,
    role: def.role,
    x,
    y,
    w: def.size,
    h: def.size,
    drawSize: def.drawSize || def.size,
    hp: def.hp,
    maxHp: def.hp,
    damage: def.damage,
    baseDamage: def.damage,
    speed: def.speed,
    baseSpeed: def.speed,
    projectileSpeed: def.projectileSpeed,
    preferredRange: def.preferredRange || 0,
    movementTactic: def.movementTactic || "Balance",
    fireRate: def.fireRate || 0,
    cooldown: 0,
    animClock: randomizeEnemyAnimClock(def.sprite, random),
    animationSpeedMult: randomizeEnemyAnimationSpeed(def, random),
    dead: false,
    facing: 1,
    direction: "down",
    sprite: def.sprite,
    color: def.color,
    movementProfile: def.movementProfile || null,
    render: { sheetKey: "idle", frame: 0 },
    collisionRadius: def.collisionRadius,
    ignoreWalls: !!def.ignoreWalls,
    baseIgnoreWalls: !!def.ignoreWalls,
    specialBehavior: def.specialBehavior || null,
    projectileColor: def.projectileColor || null,
    state: {
      nav: createEnemyNavState()
    },
    enemyTier: "minion",
    tierXpMult: 1,
    affixes: [],
    affixState: {},
    renderAlpha: 1,
    showHealthBar: false,
    plates: Math.max(0, def.plates || 0),
    maxPlates: Math.max(0, def.plates || 0),
    plateMaxDurability: 0,
    plateDurability: 0,
    plateConsumeCooldownTimer: 0,
    hitTimer: 0,
    hitDuration: 0.1,
    staggerTimer: 0,
    staggerDuration: 0.14,
    hitDirX: 0,
    hitDirY: 0,
    staggerMoveSpeed: 0,
    staggerPauseTimer: 0,
    poiseMult: ENEMY_TIER_POISE_MULT.minion,
    hitInterruptPending: false,
    hitInterruptPauseDuration: 0,
    hitInterruptStaggerDuration: 0,
    hitInterruptBeforeWindupCommitOnly: false,
    recentDamageEvents: [],
    burstHeavyStaggerActiveUntil: -Infinity,
    burstHeavyStaggerCooldownUntil: -Infinity
  };
}

function buildUndeadEnemy(def, x, y) {
  return {
    id: `${def.id}_${Math.random().toString(36).slice(2, 8)}`,
    type: def.id,
    name: def.name,
    role: def.role,
    x,
    y,
    w: def.size,
    h: def.size,
    drawSize: def.drawSize || def.size,
    hp: def.hp,
    maxHp: def.hp,
    damage: def.damage,
    baseDamage: def.damage,
    speed: def.speed,
    baseSpeed: def.speed,
    preferredRange: def.preferredRange || 0,
    movementTactic: def.movementTactic || "Balance",
    dead: false,
    facing: 1,
    direction: "down",
    rowOrder: def.rowOrder,
    sprite: def.sprite,
    attacks: def.attacks,
    guardStance: def.guardStance || null,
    awakenBehavior: def.awakenBehavior || null,
    swiftStep: def.swiftStep || null,
    sneakBehavior: def.sneakBehavior || null,
    animClock: 0,
    color: def.tint,
    render: { sheetKey: "idle", frame: 0 },
    attackRuntime: createUndeadRuntime(),
    state: {
      nav: createEnemyNavState()
    },
    collisionRadius: def.collisionRadius,
    enemyTier: "minion",
    tierXpMult: 1,
    affixes: [],
    affixState: {},
    renderAlpha: 1,
    showHealthBar: false,
    plates: Math.max(0, def.plates || 0),
    maxPlates: Math.max(0, def.plates || 0),
    plateMaxDurability: 0,
    plateDurability: 0,
    plateConsumeCooldownTimer: 0,
    hitTimer: 0,
    hitDuration: 0.1,
    staggerTimer: 0,
    staggerDuration: 0.14,
    hitDirX: 0,
    hitDirY: 0,
    staggerMoveSpeed: 0,
    staggerPauseTimer: 0,
    poiseMult: ENEMY_TIER_POISE_MULT.minion,
    hitInterruptPending: false,
    hitInterruptPauseDuration: 0,
    hitInterruptStaggerDuration: 0,
    hitInterruptBeforeWindupCommitOnly: false,
    recentDamageEvents: [],
    burstHeavyStaggerActiveUntil: -Infinity,
    burstHeavyStaggerCooldownUntil: -Infinity
  };
}

function buildDirectionalEnemy(def, x, y) {
  return buildUndeadEnemy(def, x, y);
}

function applyTierAndAffixes(enemy, options = {}, random = Math.random) {
  const tier = normalizeEnemyTier(options.tier);
  const tierDef = getEnemyTierDef(tier);
  const center = centerOf(enemy);
  enemy.enemyTier = tier;
  enemy.isElite = tier === "elite";
  enemy.isMiniBoss = tier === "miniBoss";
  enemy.poiseMult = ENEMY_TIER_POISE_MULT[tier] ?? ENEMY_TIER_POISE_MULT.minion;
  enemy.tierXpMult = tierDef.xp;
  enemy.attackScale = tier === "minion" ? 1 : tier === "elite" ? 1.25 : 1.6;
  enemy.enableHiddenAttacks = tier === "miniBoss";
  enemy.w = Math.max(18, Math.round(enemy.w * tierDef.size));
  enemy.h = Math.max(18, Math.round(enemy.h * tierDef.size));
  if (isUndeadEnemy(enemy)) {
    enemy.drawSize = enemy.drawSize || enemy.w;
  } else {
    enemy.drawSize = Math.max(enemy.w, Math.round((enemy.drawSize || enemy.w) * tierDef.size));
  }
  enemy.x = center.x - enemy.w * 0.5;
  enemy.y = center.y - enemy.h * 0.5;
  enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * tierDef.hp));
  enemy.hp = options.currentHp ?? enemy.maxHp;
  enemy.baseDamage = Math.max(1, Math.round(enemy.baseDamage * tierDef.atk));
  enemy.baseSpeed = Math.max(12, Math.round(enemy.baseSpeed));
  enemy.damage = enemy.baseDamage;
  enemy.speed = enemy.baseSpeed;
  enemy.affixes = getValidAffixIds(
    options.affixes?.length ? options.affixes : pickRandomAffixIds(random, tierDef.affixCount)
  );
  if (enemy.affixes.includes("plated")) {
    enemy.plates = Math.max(0, enemy.plates || 0) + 3;
    enemy.maxPlates = Math.max(enemy.plates, (enemy.maxPlates || 0) + 3);
  }
  enemy.plateMaxDurability = Math.max(1, enemy.maxHp * 0.1);
  enemy.plateDurability = enemy.plates > 0 ? enemy.plateMaxDurability : 0;
  if (enemy.affixes.includes("phantom") || enemy.affixes.includes("flying")) {
    enemy.ignoreWalls = true;
  }
  return enemy;
}

export function spawnEnemyByType(typeId, x, y, options = {}) {
  const undead = getUndeadEnemyDef(typeId);
  if (undead) return applyTierAndAffixes(buildDirectionalEnemy(undead, x, y), options, options.random);
  const barbarian = getBarbarianEnemyDef(typeId);
  if (barbarian) return applyTierAndAffixes(buildDirectionalEnemy(barbarian, x, y), options, options.random);
  const shepard = getShepardEnemyDef(typeId);
  if (shepard) return applyTierAndAffixes(buildDirectionalEnemy(shepard, x, y), options, options.random);
  const def = getEnemyDef(typeId);
  if (def) return applyTierAndAffixes(buildBaseEnemy(def, x, y, options.random), options, options.random);
  return null;
}

function placeEnemy(typeId, tile, room, options = {}) {
  const def = getUndeadEnemyDef(typeId) || getBarbarianEnemyDef(typeId) || getShepardEnemyDef(typeId) || getEnemyDef(typeId);
  if (!def || !tile) return null;
  const size = def.size;
  const x = tile.x * room.tileSize + (room.tileSize - size) * 0.5;
  const y = tile.y * room.tileSize + (room.tileSize - size) * 0.5;
  const cliffCollisionRects = room?.tileWallRects?.filter((rect) => rect?._upperCliffRockCollision) || [];
  const enemy = spawnEnemyByType(typeId, x, y, options);
  if (!enemy) return null;
  const spawnRect = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
  if (cliffCollisionRects.some((rect) => rectsOverlap(spawnRect, rect))) return null;
  return enemy;
}

function canPlace(rect, usedRects) {
  return !usedRects.some((other) => rectsOverlap(rect, { x: other.x - 24, y: other.y - 24, w: other.w + 48, h: other.h + 48 }));
}

function isRectNearPlayerSpawn(rect, room, minDistance = PLAYER_SPAWN_SAFE_RADIUS) {
  if (!rect || !room?.start) return false;
  const spawnCenter = centerOf(room.start);
  const rectCenter = centerOf(rect);
  return distance(spawnCenter.x, spawnCenter.y, rectCenter.x, rectCenter.y) < minDistance;
}

function getEnemySpawnDef(typeId) {
  return getUndeadEnemyDef(typeId) || getBarbarianEnemyDef(typeId) || getShepardEnemyDef(typeId) || getEnemyDef(typeId) || null;
}

function getEnemyMovementTactic(def) {
  return def?.movementTactic || DEFAULT_MOVEMENT_TACTIC;
}

function getEnemyRole(def) {
  return def?.role || DEFAULT_ROLE;
}

function createSpawnCategoryStats() {
  return {
    roleCounts: Object.create(null),
    tacticCounts: Object.create(null),
    typeCounts: Object.create(null)
  };
}

function recordSpawnCategory(stats, def) {
  if (!stats || !def) return;
  const role = getEnemyRole(def);
  const tactic = getEnemyMovementTactic(def);
  stats.roleCounts[role] = (stats.roleCounts[role] || 0) + 1;
  stats.tacticCounts[tactic] = (stats.tacticCounts[tactic] || 0) + 1;
  stats.typeCounts[def.id] = (stats.typeCounts[def.id] || 0) + 1;
}

function getUnderrepresentedWeight(count) {
  if (!count) return 2.4;
  return Math.max(0.4, 1.4 - count * 0.18);
}

function chooseWeightedEnemyType(candidates, stats, tier, random) {
  if (!candidates.length) return null;
  const weighted = candidates.map((typeId) => {
    const def = getEnemySpawnDef(typeId);
    if (!def) return { typeId, weight: 0 };
    const role = getEnemyRole(def);
    const tactic = getEnemyMovementTactic(def);
    const roleWeight = getUnderrepresentedWeight(stats.roleCounts[role] || 0);
    const tacticWeight = getUnderrepresentedWeight(stats.tacticCounts[tactic] || 0);
    const repetitionPenalty = 1 / (1 + (stats.typeCounts[def.id] || 0) * 0.75);
    let weight = roleWeight * tacticWeight * repetitionPenalty;

    if (tier === "miniBoss") {
      weight *= MINI_BOSS_ROLE_WEIGHT[role] ?? 1;
      weight *= MINI_BOSS_TACTIC_WEIGHT[tactic] ?? 1;
    } else if (tier === "elite") {
      if (tactic === "Brave" || tactic === "Balance") weight *= 1.2;
      if (role === "ranged" && (stats.roleCounts.melee || 0) === 0) weight *= 0.8;
    } else {
      if (tactic === "Swarmer") weight *= 1.25;
      if (role === "ranged" && (stats.roleCounts.ranged || 0) > (stats.roleCounts.melee || 0) + 1) weight *= 0.75;
    }

    return { typeId, weight };
  }).filter((entry) => entry.weight > 0);

  if (!weighted.length) return sample(candidates, random);
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * totalWeight;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.typeId;
  }
  return weighted[weighted.length - 1]?.typeId || sample(candidates, random);
}

function getGroupSizeForBehavior(typeId, tier, random) {
  const def = getEnemySpawnDef(typeId);
  const role = getEnemyRole(def);
  const tactic = getEnemyMovementTactic(def);
  if (tier === "miniBoss") return 1;
  if (tier === "elite") {
    if (tactic === "Swarmer") return 2 + Math.floor(random() * 2);
    if (role === "ranged" || tactic === "Coward") return 1 + Math.floor(random() * 2);
    if (tactic === "Brave" || role === "melee") return 1 + Math.floor(random() * 2);
    return 1 + Math.floor(random() * 2);
  }
  if (tactic === "Swarmer") return 3 + Math.floor(random() * 3);
  if (role === "ranged" || tactic === "Coward") return 1 + Math.floor(random() * 2);
  if (tactic === "Brave" || role === "melee") return 2 + Math.floor(random() * 2);
  return 2 + Math.floor(random() * 2);
}

function getUnlockedRosterEntries(roster, roomIndex) {
  const unlocked = [];
  const lastIndex = Math.min(roomIndex, roster.length - 1);
  for (let index = 0; index <= lastIndex; index += 1) {
    unlocked.push(...(roster[index] || []));
  }
  return unlocked;
}

export function spawnRoomEnemies(room, roomIndex, seed, searchables = []) {
  const random = createSeededRandom(seed + roomIndex * 41);
  const table = getUnlockedRosterEntries(ROOM_ENEMY_TABLE, roomIndex);
  const undeadRoster = getUnlockedRosterEntries(UNDEAD_ROOM_ROSTER, roomIndex);
  const barbarianRoster = getUnlockedRosterEntries(BARBARIAN_ROOM_ROSTER, roomIndex);
  const shepardRoster = getUnlockedRosterEntries(SHEPARD_ROOM_ROSTER, roomIndex);
  const pool = [...new Set([...table, ...undeadRoster, ...barbarianRoster, ...shepardRoster])];
  const usedRects = [
    room.start,
    room.exit,
    ...((room.biomeObstaclePlacementRects || []).map((rect) => ({ x: rect.x, y: rect.y, w: rect.w, h: rect.h }))),
    ...((room.treeObstacles || []).map((tree) => ({ x: tree.x, y: tree.y, w: tree.w, h: tree.h })))
  ];
  const enemies = [];
  const spawnStats = createSpawnCategoryStats();
  const maxEnemies = 50 + roomIndex * 10;
  const exitCellKey = `${room.archetypeGrid.exitCell.col},${room.archetypeGrid.exitCell.row}`;

  function getCellTiles(col, row) {
    const minX = col * 30;
    const maxX = minX + 29;
    const minY = row * 30;
    const maxY = minY + 29;
    return room.spawnTiles.filter((tile) => tile.x >= minX && tile.x <= maxX && tile.y >= minY && tile.y <= maxY);
  }

  function getRowZeroCenterTiles(col) {
    const minX = col * 30;
    const minY = 0;
    const centerX = minX + 15;
    const centerY = minY + 15;
    const offsets = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ];
    return offsets
      .map(([ox, oy]) => ({ x: centerX + ox, y: centerY + oy }))
      .filter((tile) => (
        tile.x >= 0
        && tile.y >= 0
        && tile.x < room.cols
        && tile.y < room.rows
        && room.grid?.[tile.y]?.[tile.x] === 0
      ));
  }

  function getTilesNearRect(rect, radiusTiles = 8) {
    if (!rect) return [];
    const centerX = Math.floor((rect.x + rect.w * 0.5) / room.tileSize);
    const centerY = Math.floor((rect.y + rect.h * 0.5) / room.tileSize);
    return room.spawnTiles.filter((tile) => (
      Math.abs(tile.x - centerX) <= radiusTiles
      && Math.abs(tile.y - centerY) <= radiusTiles
    ));
  }

  function filterTilesAwayFromPlayerSpawn(tiles) {
    if (!Array.isArray(tiles) || !tiles.length) return [];
    return tiles.filter((tile) => {
      const rect = {
        x: tile.x * room.tileSize,
        y: tile.y * room.tileSize,
        w: room.tileSize,
        h: room.tileSize
      };
      return !isRectNearPlayerSpawn(rect, room);
    });
  }

  function pickTypeIdForTier(tier) {
    const filtered = pool.filter((typeId) => {
      const def = getEnemySpawnDef(typeId);
      if (!def) return false;
      return true;
    });
    return chooseWeightedEnemyType(filtered.length ? filtered : pool, spawnStats, tier, random);
  }

  function getGroupSize(typeId, tier) {
    return getGroupSizeForBehavior(typeId, tier, random);
  }

  function spawnGroupInCell(col, row, tier) {
    const cellTiles = filterTilesAwayFromPlayerSpawn(getCellTiles(col, row));
    if (!cellTiles.length || enemies.length >= maxEnemies) return;
    const typeId = pickTypeIdForTier(tier);
    const affixes = pickRandomAffixIds(random, getEnemyTierDef(tier).affixCount);
    const targetCount = Math.min(getGroupSize(typeId, tier), maxEnemies - enemies.length);
    const spawnGroupId = `${col}_${row}_${tier}_${Math.floor(random() * 99999)}`;
    for (let index = 0; index < targetCount; index += 1) {
      for (let attempt = 0; attempt < 28; attempt += 1) {
        const tile = index === 0 ? sample(cellTiles, random) : sample(cellTiles, random);
        const enemy = placeEnemy(typeId, tile, room, { tier, affixes, random, spawnGroupId });
        if (!enemy) return;
        const rect = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
        if (!canPlace(rect, usedRects)) continue;
        enemy.spawnGroupId = spawnGroupId;
        enemies.push(enemy);
        recordSpawnCategory(spawnStats, getEnemySpawnDef(typeId));
        usedRects.push(rect);
        break;
      }
    }
  }

  function spawnGroupAtPreferredTiles(candidateTiles, col, row, tier, groupLabel = tier) {
    candidateTiles = filterTilesAwayFromPlayerSpawn(candidateTiles);
    if (!candidateTiles.length || enemies.length >= maxEnemies) return;
    const typeId = pickTypeIdForTier(tier);
    const affixes = pickRandomAffixIds(random, getEnemyTierDef(tier).affixCount);
    const targetCount = Math.min(getGroupSize(typeId, tier), maxEnemies - enemies.length);
    const spawnGroupId = `${col}_${row}_${groupLabel}_${Math.floor(random() * 99999)}`;
    for (let index = 0; index < targetCount; index += 1) {
      for (let attempt = 0; attempt < 28; attempt += 1) {
        const tile = sample(candidateTiles, random);
        const enemy = placeEnemy(typeId, tile, room, { tier, affixes, random, spawnGroupId });
        if (!enemy) return;
        const rect = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
        if (!canPlace(rect, usedRects)) continue;
        enemy.spawnGroupId = spawnGroupId;
        enemies.push(enemy);
        recordSpawnCategory(spawnStats, getEnemySpawnDef(typeId));
        usedRects.push(rect);
        break;
      }
    }
  }

  const cells = [];
  const rowZeroPlayableCells = [];
  for (let row = 0; row < room.archetypeGrid.grid.length; row += 1) {
    for (let col = 0; col < room.archetypeGrid.grid[row].length; col += 1) {
      const cellKey = `${col},${row}`;
      const archetype = room.archetypeGrid.grid[row][col];
      if (archetype === "empty" || archetype === "start" || cellKey === exitCellKey) continue;
      if (row === 0) {
        rowZeroPlayableCells.push({ col, row, archetype });
        continue;
      }
      cells.push({ col, row, archetype });
    }
  }
  cells.sort((a, b) => (a.archetype === "miniboss" ? -1 : 0) - (b.archetype === "miniboss" ? -1 : 0));

  for (const cell of rowZeroPlayableCells) {
    const centerTiles = getRowZeroCenterTiles(cell.col);
    spawnGroupAtPreferredTiles(centerTiles, cell.col, cell.row, "elite", "row0_elite_a");
    spawnGroupAtPreferredTiles(centerTiles, cell.col, cell.row, "elite", "row0_elite_b");
  }

  for (const searchable of searchables || []) {
    if (enemies.length >= maxEnemies) break;
    if (searchable?.typeId !== "smallChest" && searchable?.typeId !== "largeChest") continue;
    const guardTiles = getTilesNearRect(searchable, 7);
    if (!guardTiles.length) continue;
    const guardTier = searchable.typeId === "largeChest" ? "elite" : "minion";
    const groupLabel = searchable.typeId === "largeChest" ? "large_chest_guard" : "small_chest_guard";
    spawnGroupAtPreferredTiles(guardTiles, -1, -1, guardTier, `${groupLabel}_${searchable.id}`);
  }

  for (const cell of cells) {
    const plan = getBiomeSpawnPlan(cell.archetype);
    for (const entry of plan) {
      if (enemies.length >= maxEnemies) break;
      if (entry.chance != null && random() > entry.chance) continue;
      spawnGroupInCell(cell.col, cell.row, entry.tier);
    }
    if (cell.archetype === "miniboss") {
      room.minibossBounds = room.biomeCellBounds?.(cell.col, cell.row) || null;
    }
  }

  return enemies;
}

function updateBaseEnemy(game, enemy, dt) {
  const playerCenter = centerOf(game.player);
  enemy.cooldown = Math.max(0, enemy.cooldown - dt);
  enemy.state.spawnGrace = Math.max(0, (enemy.state.spawnGrace || 0) - dt);

  const enemyCenter = centerOf(enemy);
  const dx = playerCenter.x - enemyCenter.x;
  const dy = playerCenter.y - enemyCenter.y;
  const dir = normalize(dx, dy, { x: 1, y: 0 });
  const awareness = getEnemyAwareness(game, enemy);
  const movementSpeedMult = getBaseEnemyMovementSpeedMultiplier(enemy);
  enemy.awarenessState = awareness.state;
  enemy.facing = dir.x >= 0 ? 1 : -1;
  enemy.direction = dir.x >= 0 ? "right" : "left";

  if (awareness.state === "blinded") {
    updateBlindedBaseEnemy(game, enemy, dt);
    return;
  }

  const erraticMoveDir = getErraticMoveDir(enemy);
  if (awareness.state !== "idle" && erraticMoveDir) {
    enemy.facing = erraticMoveDir.x >= 0 ? 1 : -1;
    enemy.direction = erraticMoveDir.x >= 0 ? "right" : "left";
    enemy.isMoving = steerEnemyMovement(game, enemy, erraticMoveDir, playerCenter, dt, {
      speedMult: movementSpeedMult * (awareness.speedMultiplier || 1) * 1.3,
      behavior: "hold"
    });
    enemy.render.sheetKey = enemy.isMoving ? "move" : "idle";
    enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite[enemy.render.sheetKey]?.fps || 8)) % (enemy.sprite[enemy.render.sheetKey]?.frames || 1);
    return;
  }

  if (awareness.state !== "idle" && isEvasiveRetreatActive(enemy)) {
    const retreatDir = { x: -dir.x, y: -dir.y };
    enemy.facing = retreatDir.x >= 0 ? 1 : -1;
    enemy.direction = retreatDir.x >= 0 ? "right" : "left";
    enemy.isMoving = steerEnemyMovement(game, enemy, retreatDir, playerCenter, dt, {
      speedMult: movementSpeedMult * (awareness.speedMultiplier || 1),
      behavior: "retreat",
      desiredRange: Math.max(enemy.preferredRange || 0, 220),
      clearDistanceThreshold: Math.max(enemy.preferredRange || 0, 220)
    });
    enemy.render.sheetKey = enemy.isMoving ? "move" : "idle";
    enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite[enemy.render.sheetKey]?.fps || 8)) % (enemy.sprite[enemy.render.sheetKey]?.frames || 1);
    return;
  }

  if (enemy.specialBehavior === "dragon_breath") {
    const breath = enemy.state.dragonBreath;
    const targetDistance = distance(playerCenter.x, playerCenter.y, enemyCenter.x, enemyCenter.y);
    if (breath) {
      breath.timer -= dt;
      enemy.render.sheetKey = "idle";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.idle?.fps || 10)) % (enemy.sprite.idle?.frames || 1);
      if (breath.phase === "windup" && breath.timer <= 0) {
        game.spawnEnemyAreaHitbox({
          shape: "cone",
          x: enemyCenter.x,
          y: enemyCenter.y,
          dirX: breath.dirX,
          dirY: breath.dirY,
          range: breath.range,
          arcDeg: breath.arcDeg,
          damage: breath.damage,
          duration: 0.22,
          sourceAttackId: "dragon_fire_breath"
        });
        breath.phase = "recover";
        breath.timer = 0.4;
      } else if (breath.phase === "recover" && breath.timer <= 0) {
        enemy.state.dragonBreath = null;
        enemy.cooldown = Math.max(enemy.cooldown, enemy.fireRate || 0, ENEMY_ATTACK_LOCKOUT_SECONDS);
      }
      return;
    }

    if (awareness.state === "idle") {
      enemy.render.sheetKey = "idle";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.idle?.fps || 10)) % (enemy.sprite.idle?.frames || 1);
      return;
    }

    if (awareness.state === "alerted") {
      steerEnemyMovement(game, enemy, dir, playerCenter, dt, {
        speedMult: movementSpeedMult * awareness.speedMultiplier,
        behavior: "advance",
        clearDistanceThreshold: enemy.preferredRange + 20
      });
      enemy.render.sheetKey = "move";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.move?.fps || 10)) % (enemy.sprite.move?.frames || 1);
      return;
    }

    if (targetDistance > enemy.preferredRange + 20) {
      steerEnemyMovement(game, enemy, dir, playerCenter, dt, {
        speedMult: movementSpeedMult,
        behavior: "advance",
        clearDistanceThreshold: enemy.preferredRange + 20
      });
      enemy.render.sheetKey = "move";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.move?.fps || 10)) % (enemy.sprite.move?.frames || 1);
      return;
    }
    if (targetDistance < 60) {
      steerEnemyMovement(game, enemy, { x: -dir.x, y: -dir.y }, playerCenter, dt, {
        speedMult: movementSpeedMult,
        behavior: "retreat",
        desiredRange: 60,
        clearDistanceThreshold: 60
      });
      enemy.render.sheetKey = "move";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.move?.fps || 10)) % (enemy.sprite.move?.frames || 1);
      return;
    }
    if (enemy.cooldown <= 0 && targetDistance <= 220) {
      enemy.cooldown = Math.max(enemy.fireRate || 0, ENEMY_ATTACK_LOCKOUT_SECONDS);
      enemy.state.dragonBreath = {
        phase: "windup",
        timer: 0.7,
        dirX: dir.x,
        dirY: dir.y,
        range: 250,
        arcDeg: 75,
        damage: enemy.damage * 1.3
      };
      enemy.render.sheetKey = "idle";
      enemy.render.frame = 0;
      return;
    }
    enemy.render.sheetKey = "idle";
    enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.idle?.fps || 10)) % (enemy.sprite.idle?.frames || 1);
    return;
  }

  if (awareness.state === "idle") {
    enemy.render.sheetKey = "idle";
    enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.idle?.fps || 8)) % (enemy.sprite.idle?.frames || 1);
    return;
  }

  if (enemy.specialBehavior === "ghost_flicker") {
    enemy.state.flickerTimer = (enemy.state.flickerTimer ?? (2 + Math.random() * 0.5)) - dt;
    if (enemy.state.flickerTimer <= 0) {
      enemy.state.flickerTimer = 2 + Math.random() * 0.3;
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 100;
      enemy.x = Math.max(0, Math.min(game.world.width - enemy.w, enemyCenter.x + Math.cos(angle) * radius - enemy.w * 0.5));
      enemy.y = Math.max(0, Math.min(game.world.height - enemy.h, enemyCenter.y + Math.sin(angle) * radius - enemy.h * 0.5));
    }
  }

  if (enemy.specialBehavior === "skeleton_dash") {
    const dash = enemy.state.skeletonDash;
    if (dash && awareness.state === "detected") {
      const dashDistance = Math.min(dash.speed * dt, dash.remaining);
      tryMoveEnemy(enemy, game.world, dash.dirX * dashDistance, dash.dirY * dashDistance, game);
      dash.remaining -= dashDistance;
      enemy.render.sheetKey = "move";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.move?.fps || 8)) % (enemy.sprite.move?.frames || 1);
      if (dash.remaining <= 0.001) {
        enemy.state.skeletonDash = null;
        enemy.state.skeletonDashCooldown = 4;
      }
      return;
    }
    enemy.state.skeletonDashCooldown = Math.max(0, (enemy.state.skeletonDashCooldown ?? 0) - dt);
    const targetDistance = distance(playerCenter.x, playerCenter.y, enemyCenter.x, enemyCenter.y);
    if (awareness.state === "detected" && enemy.state.skeletonDashCooldown <= 0 && targetDistance > 1 && targetDistance <= 200) {
      enemy.state.skeletonDash = { dirX: dir.x, dirY: dir.y, remaining: 80, speed: 400 };
      enemy.render.sheetKey = "move";
      enemy.render.frame = 0;
      return;
    }
  }

  if (enemy.role === "ranged") {
    const targetDistance = distance(playerCenter.x, playerCenter.y, enemyCenter.x, enemyCenter.y);
    if (awareness.state === "alerted") {
      steerEnemyMovement(game, enemy, dir, playerCenter, dt, {
        speedMult: movementSpeedMult * awareness.speedMultiplier,
        behavior: "advance",
        clearDistanceThreshold: enemy.preferredRange + 30
      });
      enemy.render.sheetKey = "move";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.move?.fps || 8)) % (enemy.sprite.move?.frames || 1);
      return;
    }
    if (targetDistance > enemy.preferredRange + 30) {
      steerEnemyMovement(game, enemy, dir, playerCenter, dt, {
        speedMult: movementSpeedMult,
        behavior: "advance",
        clearDistanceThreshold: enemy.preferredRange + 30
      });
    } else if (targetDistance < enemy.preferredRange - 40) {
      steerEnemyMovement(game, enemy, { x: -dir.x, y: -dir.y }, playerCenter, dt, {
        speedMult: movementSpeedMult,
        behavior: "retreat",
        desiredRange: enemy.preferredRange,
        clearDistanceThreshold: enemy.preferredRange - 40
      });
    }
    if (enemy.cooldown <= 0 && targetDistance < 420) {
      spawnEnemyProjectile(game, enemy, {
        x: dir.x,
        y: dir.y,
        damage: enemy.damage,
        speed: enemy.projectileSpeed || 300,
        radius: enemy.projectileRadius ?? 10,
        size: enemy.projectileSize ?? 20,
        color: enemy.projectileColor ?? "#f59e0b"
      });
      enemy.cooldown = Math.max(enemy.fireRate || 0, ENEMY_ATTACK_LOCKOUT_SECONDS);
    }
    enemy.render.sheetKey = enemy.cooldown <= 0 ? "move" : "idle";
    enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite[enemy.render.sheetKey]?.fps || 8)) % (enemy.sprite[enemy.render.sheetKey]?.frames || 1);
    return;
  }

  if (enemy.role === "skirmisher") {
    const side = { x: -dir.y, y: dir.x };
    steerEnemyMovement(game, enemy, {
      x: dir.x * 0.6 + side.x * 0.5,
      y: dir.y * 0.6 + side.y * 0.5
    }, playerCenter, dt, {
      speedMult: movementSpeedMult * awareness.speedMultiplier,
      behavior: "advance"
    });
  } else {
    steerEnemyMovement(game, enemy, dir, playerCenter, dt, {
      speedMult: movementSpeedMult * awareness.speedMultiplier,
      behavior: "advance"
    });
  }
  enemy.render.sheetKey = "move";
  enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.move?.fps || 8)) % (enemy.sprite.move?.frames || 1);
}

function triggerPoisonBlessingDeathBurst(game, enemy) {
  const blessing = enemy.state?.poisonBlessingProjectile;
  if (!blessing || enemy.state?.poisonBlessingDeathBurstDone) return;
  const enemyCenter = centerOf(enemy);
  const playerCenter = centerOf(game.player);
  const dir = normalize(playerCenter.x - enemyCenter.x, playerCenter.y - enemyCenter.y, { x: 1, y: 0 });
  spawnEnemyProjectile(game, enemy, {
    dirX: dir.x,
    dirY: dir.y,
    damage: Math.max(1, Math.round(enemy.damage * (blessing.damageScale ?? 0.5))),
    speed: blessing.speed ?? 240,
    radius: blessing.radius ?? 6,
    size: blessing.size ?? 10,
    color: "#84cc16",
    spriteAsset: blessing.spriteAsset ?? null,
    spriteFrames: blessing.spriteFrames ?? null,
    spriteFrameWidth: blessing.spriteFrameWidth ?? null,
    spriteFrameHeight: blessing.spriteFrameHeight ?? null,
    spriteFps: blessing.spriteFps ?? null,
    spriteLoopStart: blessing.spriteLoopStart ?? null,
    spriteLoopEnd: blessing.spriteLoopEnd ?? null,
    spriteCropWidth: blessing.spriteCropWidth ?? null,
    spriteCropHeight: blessing.spriteCropHeight ?? null,
    poisonDps: blessing.poisonDps ?? 3,
    poisonDuration: blessing.poisonDuration ?? 4,
    sourceAttackId: "poisonous_blessing_death"
  });
  enemy.state.poisonBlessingDeathBurstDone = true;
}

export function updateEnemies(game, dt) {
  beginEnemyAffixFrame(game);
  applyEnemyAuraSources(game);
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    enemy.state ||= {};
    resolveEnemyWallOverlap(enemy, game.world, game);
    const hitPauseActiveAtFrameStart = (enemy.staggerPauseTimer || 0) > 0;
    tickEnemyHitReaction(enemy, dt);
    if (!hitPauseActiveAtFrameStart) enemy.animClock += dt * (enemy.animationSpeedMult || 1);
    enemy.state.freezeTimer = Math.max(0, (enemy.state.freezeTimer || 0) - dt);
    enemy.state.skillSlowTimer = Math.max(0, (enemy.state.skillSlowTimer || 0) - dt);
    enemy.state.bleedTimer = Math.max(0, (enemy.state.bleedTimer || 0) - dt);
    enemy.state.bleedTickTimer = Math.max(0, (enemy.state.bleedTickTimer || 0) - dt);
    enemy.state.poisonBlessingUntil = Math.max(0, (enemy.state.poisonBlessingUntil || 0) - dt);
    if ((enemy.state.bleedStacks || 0) > 0 && (enemy.state.bleedTimer || 0) > 0 && enemy.state.bleedTickTimer <= 0) {
      enemy.state.bleedTickTimer = 1;
      game.damageEnemy(enemy, (enemy.state.bleedStacks || 0) * (enemy.state.bleedDamagePerStack || 1), {
        source: "skill",
        isDirect: false,
        bypassPlates: true
      });
      if (enemy.dead) continue;
    }
    if ((enemy.state.bleedTimer || 0) <= 0) {
      enemy.state.bleedStacks = 0;
      enemy.state.bleedDamagePerStack = 0;
    }
    updateEnemyAffixes(game, enemy, dt);
    updateStatusState(enemy, dt, {
      onTickDamage(amount, kind) {
        if (amount <= 0) return;
        game.damageEnemy(enemy, amount, {
          source: kind === "burn" ? "burn" : "skill",
          isDirect: false,
          bypassPlates: true
        });
      }
    });
    if (enemy.dead) continue;
    if ((enemy.state.poisonBlessingUntil || 0) > 0) {
      enemy.speed = Math.max(0, Math.round(enemy.speed * (enemy.state.poisonBlessingSpeedMult || 1.3)));
    } else {
      enemy.state.poisonBlessingSpeedMult = 1;
      enemy.state.poisonBlessingProjectile = null;
      enemy.state.poisonBlessingSourceId = null;
      enemy.state.poisonBlessingDeathBurstDone = false;
    }
    if (enemy.state.skillSlowTimer > 0) {
      enemy.speed = Math.max(0, Math.round(enemy.speed * (enemy.state.skillSlowMult || 1)));
    } else {
      enemy.state.skillSlowMult = 1;
    }
    enemy.speed = Math.max(0, Math.round(enemy.speed * getEntitySlowMultiplier(enemy)));
    if (enemy.staggerPauseTimer > 0) {
      enemy.isMoving = false;
      setEnemyHitRenderFrame(enemy);
      continue;
    }
    if (enemy.state.freezeTimer > 0) {
      enemy.speed = 0;
      if (!setEnemyHitRenderFrame(enemy)) {
        enemy.render.sheetKey = "idle";
        enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.idle?.fps || 8)) % (enemy.sprite.idle?.frames || 1);
      }
      continue;
    }
    if (applyEnemyStaggerMotion(game, enemy, dt)) {
      setEnemyHitRenderFrame(enemy);
      continue;
    }
    if (isUndeadEnemy(enemy)) {
      updateUndeadEnemy(game, enemy, dt);
      continue;
    }
    updateBaseEnemy(game, enemy, dt);
  }
  for (const enemy of game.enemies) {
    if (!enemy.dead) continue;
    releaseEnemyMeleeAttackToken(game, enemy);
    if ((enemy.state?.poisonBlessingUntil || 0) > 0) triggerPoisonBlessingDeathBurst(game, enemy);
  }
  game.enemies = game.enemies.filter((enemy) => !enemy.dead);
}

export function eachLivingEnemy(game, callback) {
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    callback(enemy);
  }
}

export function getAllEnemyTypeIds() {
  return [...new Set([...ROOM_ENEMY_TABLE.flat(), ...UNDEAD_ENEMY_IDS, ...BARBARIAN_ENEMY_IDS, ...SHEPARD_ENEMY_IDS])];
}

export function getControllableEnemyTypeIds() {
  return getAllEnemyTypeIds().filter((typeId) => {
    const def = getUndeadEnemyDef(typeId) || getBarbarianEnemyDef(typeId) || getShepardEnemyDef(typeId) || getEnemyDef(typeId);
    return Array.isArray(def?.attacks) && def.attacks.length > 0;
  });
}
