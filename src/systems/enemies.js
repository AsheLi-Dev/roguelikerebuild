import { centerOf, createSeededRandom, distance, normalize, rectsOverlap, sample } from "../core/runtime-utils.js";
import { ROOM_ENEMY_TABLE, getEnemyDef } from "../data/enemies.js";
import { UNDEAD_ENEMY_IDS, UNDEAD_ROOM_ROSTER, getUndeadEnemyDef } from "../data/undead-enemies.js";
import { getEnemyAwareness } from "./enemy-awareness.js";
import { spawnEnemyProjectile } from "./combat.js";
import { createUndeadRuntime, isUndeadEnemy, updateUndeadEnemy } from "./undead-runtime.js";

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
    speed: def.speed,
    projectileSpeed: def.projectileSpeed,
    preferredRange: def.preferredRange || 0,
    fireRate: def.fireRate || 0,
    cooldown: 0,
    animClock: 0,
    dead: false,
    hitFlash: 0,
    facing: 1,
    direction: "down",
    sprite: def.sprite,
    color: def.color,
    render: { sheetKey: "idle", frame: 0 },
    collisionRadius: def.collisionRadius,
    ignoreWalls: !!def.ignoreWalls,
    specialBehavior: def.specialBehavior || null,
    projectileColor: def.projectileColor || null,
    state: {}
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
    drawSize: def.drawSize,
    hp: def.hp,
    maxHp: def.hp,
    damage: def.damage,
    speed: def.speed,
    preferredRange: def.preferredRange || 0,
    dead: false,
    hitFlash: 0,
    facing: 1,
    direction: "down",
    rowOrder: def.rowOrder,
    sprite: def.sprite,
    attacks: def.attacks,
    animClock: 0,
    color: def.tint,
    render: { sheetKey: "idle", frame: 0 },
    attackRuntime: createUndeadRuntime(),
    collisionRadius: def.collisionRadius
  };
}

export function spawnEnemyByType(typeId, x, y) {
  const undead = getUndeadEnemyDef(typeId);
  if (undead) return buildUndeadEnemy(undead, x, y);
  const def = getEnemyDef(typeId);
  if (def) return buildBaseEnemy(def, x, y);
  return null;
}

function placeEnemy(typeId, tile, room) {
  const def = getUndeadEnemyDef(typeId) || getEnemyDef(typeId);
  if (!def || !tile) return null;
  const size = def.size;
  const x = tile.x * room.tileSize + (room.tileSize - size) * 0.5;
  const y = tile.y * room.tileSize + (room.tileSize - size) * 0.5;
  return spawnEnemyByType(typeId, x, y);
}

function canPlace(rect, usedRects) {
  return !usedRects.some((other) => rectsOverlap(rect, { x: other.x - 24, y: other.y - 24, w: other.w + 48, h: other.h + 48 }));
}

function spawnBigSlimeSplit(game, enemy) {
  if (enemy.state.didSplit || enemy.hp > enemy.maxHp * 0.5) return;
  enemy.state.didSplit = true;
  const origin = centerOf(enemy);
  const angles = [0, Math.PI * (2 / 3), Math.PI * (4 / 3)];
  for (const angle of angles) {
    const distanceFromCenter = 54;
    const child = game.spawnEnemyByType(
      "small_slime_archive",
      origin.x + Math.cos(angle) * distanceFromCenter - 22,
      origin.y + Math.sin(angle) * distanceFromCenter - 22
    );
    if (!child) continue;
    child.state.spawnGrace = 0.35;
  }
}

export function spawnRoomEnemies(room, roomIndex, seed) {
  const random = createSeededRandom(seed + roomIndex * 41);
  const table = ROOM_ENEMY_TABLE[Math.min(roomIndex, ROOM_ENEMY_TABLE.length - 1)];
  const undeadRoster = UNDEAD_ROOM_ROSTER[Math.min(roomIndex, UNDEAD_ROOM_ROSTER.length - 1)] || [];
  const count = Math.min(4 + roomIndex * 2, 12);
  const usedRects = [room.start, room.exit];
  const enemies = [];

  for (const typeId of undeadRoster) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const tile = sample(room.spawnTiles, random);
      const enemy = placeEnemy(typeId, tile, room);
      if (!enemy) break;
      const rect = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
      if (!canPlace(rect, usedRects)) continue;
      enemies.push(enemy);
      usedRects.push(rect);
      break;
    }
  }

  for (let index = enemies.length; index < count; index += 1) {
    const typeId = sample(table, random);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const tile = sample(room.spawnTiles, random);
      const enemy = placeEnemy(typeId, tile, room);
      if (!enemy) break;
      const rect = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
      if (!canPlace(rect, usedRects)) continue;
      enemies.push(enemy);
      usedRects.push(rect);
      break;
    }
  }

  return enemies;
}

function updateBaseEnemy(game, enemy, dt) {
  const playerCenter = centerOf(game.player);
  enemy.cooldown = Math.max(0, enemy.cooldown - dt);
  enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
  enemy.animClock += dt;
  enemy.state.spawnGrace = Math.max(0, (enemy.state.spawnGrace || 0) - dt);

  if (enemy.specialBehavior === "big_slime_split") {
    spawnBigSlimeSplit(game, enemy);
  }

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
        enemy.cooldown = enemy.fireRate;
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
      enemy.cooldown = enemy.fireRate;
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

export function updateEnemies(game, dt) {
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.animClock += dt;
    if (isUndeadEnemy(enemy)) {
      updateUndeadEnemy(game, enemy, dt);
      continue;
    }
    updateBaseEnemy(game, enemy, dt);
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
  return [...new Set([...ROOM_ENEMY_TABLE.flat(), ...UNDEAD_ENEMY_IDS])];
}
