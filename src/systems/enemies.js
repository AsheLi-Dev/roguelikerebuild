import { centerOf, createSeededRandom, distance, normalize, rectsOverlap, sample } from "../core/runtime-utils.js";
import { getBiomeSpawnPlan } from "../data/enemy-spawn-plans.js";
import { classifyEnemySize, getEnemyTierDef, getValidAffixIds, normalizeEnemyTier, pickRandomAffixIds } from "../data/enemy-affixes.js";
import { BARBARIAN_ENEMY_IDS, BARBARIAN_ROOM_ROSTER, getBarbarianEnemyDef } from "../data/barbarian-enemies.js";
import { ROOM_ENEMY_TABLE, getEnemyDef } from "../data/enemies.js";
import { UNDEAD_ENEMY_IDS, UNDEAD_ROOM_ROSTER, getUndeadEnemyDef } from "../data/undead-enemies.js";
import { getEnemyAwareness } from "./enemy-awareness.js";
import { applyEnemyAuraSources, beginEnemyAffixFrame, updateEnemyAffixes } from "./enemy-affixes.js";
import { spawnEnemyProjectile } from "./combat.js";
import { getEntitySlowMultiplier, updateStatusState } from "./status-manager.js";
import { createUndeadRuntime, isUndeadEnemy, updateUndeadEnemy } from "./undead-runtime.js";

const ENEMY_ATTACK_LOCKOUT_SECONDS = 2;
const ENEMY_TIER_POISE_MULT = Object.freeze({
  minion: 1,
  elite: 0.5,
  miniBoss: 0.15
});

function resolveEnemyWallOverlap(enemy, room) {
  if (!room?.collisionRects?.length || enemy.ignoreWalls) return false;
  let moved = false;
  for (let pass = 0; pass < 3; pass += 1) {
    let adjustedThisPass = false;
    for (const wall of room.collisionRects) {
      if (!rectsOverlap(enemy, wall)) continue;
      const enemyCenterX = enemy.x + enemy.w * 0.5;
      const enemyCenterY = enemy.y + enemy.h * 0.5;
      const wallCenterX = wall.x + wall.w * 0.5;
      const wallCenterY = wall.y + wall.h * 0.5;
      const overlapX = enemy.w * 0.5 + wall.w * 0.5 - Math.abs(enemyCenterX - wallCenterX);
      const overlapY = enemy.h * 0.5 + wall.h * 0.5 - Math.abs(enemyCenterY - wallCenterY);
      if (overlapX <= 0 || overlapY <= 0) continue;
      if (overlapX < overlapY) {
        enemy.x += enemyCenterX < wallCenterX ? -overlapX : overlapX;
      } else {
        enemy.y += enemyCenterY < wallCenterY ? -overlapY : overlapY;
      }
      enemy.x = Math.max(0, Math.min(room.width - enemy.w, enemy.x));
      enemy.y = Math.max(0, Math.min(room.height - enemy.h, enemy.y));
      adjustedThisPass = true;
      moved = true;
    }
    if (!adjustedThisPass) break;
  }
  return moved;
}

function tryMoveEnemy(enemy, room, dx, dy) {
  const nextX = Math.max(0, Math.min(room.width - enemy.w, enemy.x + dx));
  const nextY = Math.max(0, Math.min(room.height - enemy.h, enemy.y + dy));
  if (enemy.ignoreWalls) {
    enemy.x = nextX;
    enemy.y = nextY;
    return;
  }
  const testX = { x: nextX, y: enemy.y, w: enemy.w, h: enemy.h };
  const testY = { x: enemy.x, y: nextY, w: enemy.w, h: enemy.h };
  let moveX = nextX;
  let moveY = nextY;
  for (const wall of room.collisionRects) {
    if (rectsOverlap(testX, wall)) moveX = enemy.x;
    if (rectsOverlap(testY, wall)) moveY = enemy.y;
  }
  enemy.x = moveX;
  enemy.y = moveY;
  resolveEnemyWallOverlap(enemy, room);
}

function tickEnemyHitReaction(enemy, dt) {
  enemy.hitTimer = Math.max(0, (enemy.hitTimer || 0) - dt);
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
  tryMoveEnemy(enemy, game.world, (enemy.hitDirX || 0) * speed * dt, (enemy.hitDirY || 0) * speed * dt);
  enemy.isMoving = false;
  return true;
}

function buildBaseEnemy(def, x, y) {
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
    animClock: 0,
    dead: false,
    facing: 1,
    direction: "down",
    sprite: def.sprite,
    color: def.color,
    render: { sheetKey: "idle", frame: 0 },
    collisionRadius: def.collisionRadius,
    ignoreWalls: !!def.ignoreWalls,
    baseIgnoreWalls: !!def.ignoreWalls,
    specialBehavior: def.specialBehavior || null,
    projectileColor: def.projectileColor || null,
    state: {},
    enemyTier: "minion",
    tierXpMult: 1,
    affixes: [],
    affixState: {},
    renderAlpha: 1,
    showHealthBar: false,
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
    hitInterruptStaggerDuration: 0
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
    animClock: 0,
    color: def.tint,
    render: { sheetKey: "idle", frame: 0 },
    attackRuntime: createUndeadRuntime(),
    collisionRadius: def.collisionRadius,
    enemyTier: "minion",
    tierXpMult: 1,
    affixes: [],
    affixState: {},
    renderAlpha: 1,
    showHealthBar: false,
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
    hitInterruptStaggerDuration: 0
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
  const def = getEnemyDef(typeId);
  if (def) return applyTierAndAffixes(buildBaseEnemy(def, x, y), options, options.random);
  return null;
}

function placeEnemy(typeId, tile, room, options = {}) {
  const def = getUndeadEnemyDef(typeId) || getBarbarianEnemyDef(typeId) || getEnemyDef(typeId);
  if (!def || !tile) return null;
  const size = def.size;
  const x = tile.x * room.tileSize + (room.tileSize - size) * 0.5;
  const y = tile.y * room.tileSize + (room.tileSize - size) * 0.5;
  return spawnEnemyByType(typeId, x, y, options);
}

function canPlace(rect, usedRects) {
  return !usedRects.some((other) => rectsOverlap(rect, { x: other.x - 24, y: other.y - 24, w: other.w + 48, h: other.h + 48 }));
}

export function spawnRoomEnemies(room, roomIndex, seed) {
  const random = createSeededRandom(seed + roomIndex * 41);
  const table = ROOM_ENEMY_TABLE[Math.min(roomIndex, ROOM_ENEMY_TABLE.length - 1)] || [];
  const undeadRoster = UNDEAD_ROOM_ROSTER[Math.min(roomIndex, UNDEAD_ROOM_ROSTER.length - 1)] || [];
  const barbarianRoster = BARBARIAN_ROOM_ROSTER[Math.min(roomIndex, BARBARIAN_ROOM_ROSTER.length - 1)] || [];
  const pool = [...new Set([...table, ...undeadRoster, ...barbarianRoster])];
  const usedRects = [room.start, room.exit, ...((room.treeObstacles || []).map((tree) => ({ x: tree.x, y: tree.y, w: tree.w, h: tree.h })))];
  const enemies = [];
  const maxEnemies = Math.min(20 + roomIndex * 4, 34);
  const exitCellKey = `${room.archetypeGrid.exitCell.col},${room.archetypeGrid.exitCell.row}`;

  function getCellTiles(col, row) {
    const minX = col * 30;
    const maxX = minX + 29;
    const minY = row * 30;
    const maxY = minY + 29;
    return room.spawnTiles.filter((tile) => tile.x >= minX && tile.x <= maxX && tile.y >= minY && tile.y <= maxY);
  }

  function pickTypeIdForTier(tier) {
    const filtered = pool.filter((typeId) => {
      const def = getUndeadEnemyDef(typeId) || getBarbarianEnemyDef(typeId) || getEnemyDef(typeId);
      if (!def) return false;
      if (tier === "miniBoss") return classifyEnemySize(def) !== "small";
      return true;
    });
    return sample(filtered.length ? filtered : pool, random);
  }

  function getGroupSize(typeId, tier) {
    const def = getUndeadEnemyDef(typeId) || getBarbarianEnemyDef(typeId) || getEnemyDef(typeId);
    const sizeCategory = classifyEnemySize(def);
    if (tier === "miniBoss") return 1;
    if (tier === "elite") {
      if (sizeCategory === "small") return 2 + Math.floor(random() * 2);
      if (sizeCategory === "medium") return 1 + Math.floor(random() * 2);
      return 1;
    }
    if (sizeCategory === "small") return 4 + Math.floor(random() * 2);
    if (sizeCategory === "medium") return 2 + Math.floor(random() * 2);
    return 1;
  }

  function spawnGroupInCell(col, row, tier) {
    const cellTiles = getCellTiles(col, row);
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
        usedRects.push(rect);
        break;
      }
    }
  }

  const cells = [];
  for (let row = 0; row < room.archetypeGrid.grid.length; row += 1) {
    for (let col = 0; col < room.archetypeGrid.grid[row].length; col += 1) {
      const cellKey = `${col},${row}`;
      const archetype = room.archetypeGrid.grid[row][col];
      if (archetype === "empty" || archetype === "start" || cellKey === exitCellKey) continue;
      cells.push({ col, row, archetype });
    }
  }
  cells.sort((a, b) => (a.archetype === "miniboss" ? -1 : 0) - (b.archetype === "miniboss" ? -1 : 0));

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
  enemy.awarenessState = awareness.state;
  enemy.facing = dir.x >= 0 ? 1 : -1;
  enemy.direction = dir.x >= 0 ? "right" : "left";

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
      tryMoveEnemy(enemy, game.world, dir.x * enemy.speed * awareness.speedMultiplier * dt, dir.y * enemy.speed * awareness.speedMultiplier * dt);
      enemy.render.sheetKey = "move";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.move?.fps || 10)) % (enemy.sprite.move?.frames || 1);
      return;
    }

    if (targetDistance > enemy.preferredRange + 20) {
      tryMoveEnemy(enemy, game.world, dir.x * enemy.speed * dt, dir.y * enemy.speed * dt);
      enemy.render.sheetKey = "move";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.move?.fps || 10)) % (enemy.sprite.move?.frames || 1);
      return;
    }
    if (targetDistance < 60) {
      tryMoveEnemy(enemy, game.world, -dir.x * enemy.speed * dt, -dir.y * enemy.speed * dt);
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
      tryMoveEnemy(enemy, game.world, dash.dirX * dashDistance, dash.dirY * dashDistance);
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
      tryMoveEnemy(enemy, game.world, dir.x * enemy.speed * awareness.speedMultiplier * dt, dir.y * enemy.speed * awareness.speedMultiplier * dt);
      enemy.render.sheetKey = "move";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.move?.fps || 8)) % (enemy.sprite.move?.frames || 1);
      return;
    }
    if (targetDistance > enemy.preferredRange + 30) {
      tryMoveEnemy(enemy, game.world, dir.x * enemy.speed * dt, dir.y * enemy.speed * dt);
    } else if (targetDistance < enemy.preferredRange - 40) {
      tryMoveEnemy(enemy, game.world, -dir.x * enemy.speed * dt, -dir.y * enemy.speed * dt);
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
    tryMoveEnemy(
      enemy,
      game.world,
      (dir.x * 0.6 + side.x * 0.5) * enemy.speed * awareness.speedMultiplier * dt,
      (dir.y * 0.6 + side.y * 0.5) * enemy.speed * awareness.speedMultiplier * dt
    );
  } else {
    tryMoveEnemy(enemy, game.world, dir.x * enemy.speed * awareness.speedMultiplier * dt, dir.y * enemy.speed * awareness.speedMultiplier * dt);
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
    resolveEnemyWallOverlap(enemy, game.world);
    const hitPauseActiveAtFrameStart = (enemy.staggerPauseTimer || 0) > 0;
    tickEnemyHitReaction(enemy, dt);
    if (!hitPauseActiveAtFrameStart) enemy.animClock += dt;
    enemy.state.freezeTimer = Math.max(0, (enemy.state.freezeTimer || 0) - dt);
    enemy.state.skillSlowTimer = Math.max(0, (enemy.state.skillSlowTimer || 0) - dt);
    enemy.state.bleedTimer = Math.max(0, (enemy.state.bleedTimer || 0) - dt);
    enemy.state.bleedTickTimer = Math.max(0, (enemy.state.bleedTickTimer || 0) - dt);
    enemy.state.poisonBlessingUntil = Math.max(0, (enemy.state.poisonBlessingUntil || 0) - dt);
    if ((enemy.state.bleedStacks || 0) > 0 && (enemy.state.bleedTimer || 0) > 0 && enemy.state.bleedTickTimer <= 0) {
      enemy.state.bleedTickTimer = 1;
      game.damageEnemy(enemy, (enemy.state.bleedStacks || 0) * (enemy.state.bleedDamagePerStack || 1), { source: "skill", isDirect: false });
      if (enemy.dead) continue;
    }
    if ((enemy.state.bleedTimer || 0) <= 0) {
      enemy.state.bleedStacks = 0;
      enemy.state.bleedDamagePerStack = 0;
    }
    updateEnemyAffixes(game, enemy, dt);
    updateStatusState(enemy, dt);
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
      continue;
    }
    if (enemy.state.freezeTimer > 0) {
      enemy.speed = 0;
      enemy.render.sheetKey = "idle";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.idle?.fps || 8)) % (enemy.sprite.idle?.frames || 1);
      continue;
    }
    if (applyEnemyStaggerMotion(game, enemy, dt)) continue;
    if (isUndeadEnemy(enemy)) {
      updateUndeadEnemy(game, enemy, dt);
      continue;
    }
    updateBaseEnemy(game, enemy, dt);
  }
  for (const enemy of game.enemies) {
    if (!enemy.dead) continue;
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
  return [...new Set([...ROOM_ENEMY_TABLE.flat(), ...UNDEAD_ENEMY_IDS, ...BARBARIAN_ENEMY_IDS])];
}

export function getControllableEnemyTypeIds() {
  return getAllEnemyTypeIds().filter((typeId) => {
    const def = getUndeadEnemyDef(typeId) || getBarbarianEnemyDef(typeId) || getEnemyDef(typeId);
    return Array.isArray(def?.attacks) && def.attacks.length > 0;
  });
}
