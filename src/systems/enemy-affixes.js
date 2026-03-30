import { centerOf, circleHitsRect, clamp, distance, normalize, rectsOverlap } from "../core/runtime-utils.js";

function hasAffix(enemy, id) {
  return enemy.affixes?.includes(id);
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.0001) return Math.hypot(px - x1, py - y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSq, 0, 1);
  const sx = x1 + dx * t;
  const sy = y1 + dy * t;
  return Math.hypot(px - sx, py - sy);
}

function cleanupAffixWalls(game) {
  const walls = Array.isArray(game.affixWallRects) ? game.affixWallRects : [];
  const active = walls.filter((wall) => (wall.expiresAt ?? 0) > game.time);
  game.affixWallRects = active;
  game.world.collisionRects = [
    ...(game.world.tileWallRects || []),
    ...(game.world.invisibleBarrierRects || []),
    ...(game.world.treeCollisionRects || []),
    ...active
  ];
}

function spawnAffixWalls(game, enemy, count = 2) {
  const tileSize = game.world.tileSize;
  const center = centerOf(enemy);
  const radius = 120;
  const created = [];
  for (let attempt = 0; attempt < 24 && created.length < count; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 36 + Math.random() * radius;
    const x = Math.floor((center.x + Math.cos(angle) * dist) / tileSize) * tileSize;
    const y = Math.floor((center.y + Math.sin(angle) * dist) / tileSize) * tileSize;
    const wall = { x, y, w: tileSize, h: tileSize, expiresAt: game.time + 2.5, isAffixWall: true };
    const blocked = game.world.collisionRects.some((existing) => rectsOverlap(wall, existing));
    if (blocked) continue;
    created.push(wall);
  }
  if (!created.length) return;
  game.affixWallRects.push(...created);
  cleanupAffixWalls(game);
}

function spawnVolatileBurst(game, enemy) {
  const origin = centerOf(enemy);
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    game.spawnEnemyProjectile(enemy, {
      dirX: Math.cos(angle),
      dirY: Math.sin(angle),
      damage: Math.max(1, Math.round(enemy.damage * 0.6)),
      speed: 120,
      radius: 8,
      size: 16,
      color: "#f97316",
      lifetime: 4,
      sourceAttackId: "affix_volatile"
    });
  }
  enemy.affixState.volatileFlash = 0.2;
  enemy.affixState.lastBurstAt = game.time;
  enemy.affixState.lastBurstX = origin.x;
  enemy.affixState.lastBurstY = origin.y;
}

function updateOrbiting(game, enemy, dt) {
  const state = enemy.affixState;
  state.orbitAngle = (state.orbitAngle || 0) + dt * 3;
  const center = centerOf(enemy);
  const playerCenter = centerOf(game.player);
  const orbRadius = enemy.w * 0.8;
  state.orbitOrbs = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = state.orbitAngle + (index / 4) * Math.PI * 2;
    const x = center.x + Math.cos(angle) * orbRadius;
    const y = center.y + Math.sin(angle) * orbRadius;
    state.orbitOrbs.push({ x, y, radius: 6 });
    if (distance(playerCenter.x, playerCenter.y, x, y) <= 6 + Math.min(game.player.w, game.player.h) * 0.35) {
      if ((state.orbitHitAt || 0) <= game.time) {
        state.orbitHitAt = game.time + 1;
        game.damagePlayer?.(4, enemy);
      }
    }
  }
}

function updateLasering(game, enemy, dt) {
  const state = enemy.affixState;
  const center = centerOf(enemy);
  const playerCenter = centerOf(game.player);
  state.laserAngle = (state.laserAngle || 0) + dt * 1.5;
  const length = 150;
  const endX = center.x + Math.cos(state.laserAngle) * length;
  const endY = center.y + Math.sin(state.laserAngle) * length;
  state.laserBeam = { x1: center.x, y1: center.y, x2: endX, y2: endY, width: 20 };
  if ((state.laserHitAt || 0) > game.time) return;
  if (pointToSegmentDist(playerCenter.x, playerCenter.y, center.x, center.y, endX, endY) <= state.laserBeam.width) {
    state.laserHitAt = game.time + 1;
    game.damagePlayer?.(10, enemy);
  }
}

function updateDeflecting(game, enemy, dt) {
  const state = enemy.affixState;
  state.deflectAngle = (state.deflectAngle || 0) + dt * 2.5;
  const center = centerOf(enemy);
  const shieldRadius = enemy.w * 0.72;
  state.deflectOrbs = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = state.deflectAngle + (index / 3) * Math.PI * 2;
    const x = center.x + Math.cos(angle) * shieldRadius;
    const y = center.y + Math.sin(angle) * shieldRadius;
    state.deflectOrbs.push({ x, y, radius: 10 });
  }
  game.combat.playerProjectiles = game.combat.playerProjectiles.filter((projectile) => {
    for (const orb of state.deflectOrbs) {
      if (distance(projectile.x, projectile.y, orb.x, orb.y) <= projectile.radius + orb.radius) {
        return false;
      }
    }
    return true;
  });
}

function spawnHiveMinion(game, enemy) {
  const center = centerOf(enemy);
  const choices = game.enemies
    .filter((candidate) => !candidate.dead && candidate.enemyTier === "minion" && !candidate.attackRuntime)
    .map((candidate) => candidate.type);
  const typeId = choices[Math.floor(Math.random() * choices.length)] || "m_ud_brute";
  const angle = Math.random() * Math.PI * 2;
  const distanceFromCenter = 42 + Math.random() * 24;
  const spawned = game.spawnEnemyByType?.(
    typeId,
    center.x + Math.cos(angle) * distanceFromCenter - 22,
    center.y + Math.sin(angle) * distanceFromCenter - 22,
    { tier: "minion", isAffixMinion: true }
  );
  if (spawned) {
    spawned.state ||= {};
    spawned.state.spawnGrace = 0.4;
  }
}

export function beginEnemyAffixFrame(game) {
  game.affixWallRects ||= [];
  for (const enemy of game.enemies) {
    enemy._auraBuffed = false;
    enemy.renderAlpha = 1;
  }
  cleanupAffixWalls(game);
}

export function applyEnemyAuraSources(game) {
  for (const enemy of game.enemies) {
    if (enemy.dead || !hasAffix(enemy, "auraBearer")) continue;
    const center = centerOf(enemy);
    for (const other of game.enemies) {
      if (other.dead || other === enemy) continue;
      if (distance(center.x, center.y, other.x + other.w * 0.5, other.y + other.h * 0.5) <= 800) {
        other._auraBuffed = true;
      }
    }
  }
}

export function updateEnemyAffixes(game, enemy, dt) {
  enemy.affixState ||= {};
  enemy.renderAlpha = 1;
  enemy.ignoreWalls = !!enemy.baseIgnoreWalls;
  let speedMult = 1;
  let damageMult = 1;

  if (hasAffix(enemy, "swift")) speedMult *= 1.12;
  if (hasAffix(enemy, "evasive")) speedMult *= 1.2;
  if (enemy._auraBuffed) {
    speedMult *= 1.15;
    damageMult *= 1.15;
  }
  if ((enemy.damageBuffUntil || 0) > game.time) {
    damageMult *= enemy.damageBuffMult || 1;
  } else {
    enemy.damageBuffUntil = 0;
    enemy.damageBuffMult = 1;
  }
  if (hasAffix(enemy, "agile")) {
    enemy.affixState.agileBurstAt = Math.max(0, (enemy.affixState.agileBurstAt || 0) - dt);
    enemy.affixState.agileTimer = (enemy.affixState.agileTimer || 0) + dt;
    if (enemy.affixState.agileTimer >= 2) {
      enemy.affixState.agileTimer = 0;
      enemy.affixState.agileBurstAt = 0.5;
    }
    if (enemy.affixState.agileBurstAt > 0) speedMult *= 1.4;
  }
  if (hasAffix(enemy, "erratic")) {
    enemy.affixState.erraticBurstAt = Math.max(0, (enemy.affixState.erraticBurstAt || 0) - dt);
    enemy.affixState.erraticTimer = (enemy.affixState.erraticTimer || 0) + dt;
    if (enemy.affixState.erraticTimer >= 2.6) {
      enemy.affixState.erraticTimer = 0;
      enemy.affixState.erraticBurstAt = 0.45;
    }
    if (enemy.affixState.erraticBurstAt > 0) speedMult *= 1.28;
  }
  if (hasAffix(enemy, "invisible")) {
    enemy.affixState.invisibleTimer = (enemy.affixState.invisibleTimer || 0) + dt;
    const cycle = enemy.affixState.invisibleTimer % 4;
    if (cycle >= 3 && cycle <= 4) enemy.renderAlpha = 0.22;
  }
  if (hasAffix(enemy, "phantom") || hasAffix(enemy, "flying")) {
    enemy.ignoreWalls = true;
  }
  if (hasAffix(enemy, "boulder")) {
    enemy.affixState.boulderTimer = (enemy.affixState.boulderTimer || 0) + dt;
    if (enemy.affixState.boulderTimer >= 6) {
      enemy.affixState.boulderTimer = 0;
      const center = centerOf(enemy);
      const playerCenter = centerOf(game.player);
      const dir = normalize(playerCenter.x - center.x, playerCenter.y - center.y);
      game.spawnEnemyProjectile(enemy, {
        dirX: dir.x,
        dirY: dir.y,
        damage: Math.max(1, Math.round(enemy.damage * 0.6)),
        speed: 150,
        radius: 42,
        size: 84,
        color: "#4b5563",
        lifetime: 4,
        sourceAttackId: "affix_boulder"
      });
    }
  }
  if (hasAffix(enemy, "volatile")) {
    enemy.affixState.volatileTimer = (enemy.affixState.volatileTimer || 0) + dt;
    enemy.affixState.volatileFlash = Math.max(0, (enemy.affixState.volatileFlash || 0) - dt);
    if (enemy.affixState.volatileTimer >= 3) {
      enemy.affixState.volatileTimer = 0;
      spawnVolatileBurst(game, enemy);
    }
  }
  if (hasAffix(enemy, "wall")) {
    enemy.affixState.wallTimer = (enemy.affixState.wallTimer || 0) + dt;
    if (enemy.affixState.wallTimer >= 3) {
      enemy.affixState.wallTimer = 0;
      spawnAffixWalls(game, enemy, 2);
    }
  }
  if (hasAffix(enemy, "orbiting")) {
    updateOrbiting(game, enemy, dt);
  } else {
    enemy.affixState.orbitOrbs = [];
  }
  if (hasAffix(enemy, "lasering")) {
    updateLasering(game, enemy, dt);
  } else {
    enemy.affixState.laserBeam = null;
  }
  if (hasAffix(enemy, "deflecting")) {
    updateDeflecting(game, enemy, dt);
  } else {
    enemy.affixState.deflectOrbs = [];
  }

  enemy.speed = Math.round((enemy.baseSpeed ?? enemy.speed) * speedMult);
  enemy.damage = Math.max(1, Math.round((enemy.baseDamage ?? enemy.damage) * damageMult));
}

export function modifyDamageAgainstEnemy(enemy, amount) {
  let remaining = amount;
  if ((enemy.affixShield || 0) > 0) {
    const absorbed = Math.min(enemy.affixShield, remaining);
    enemy.affixShield -= absorbed;
    remaining -= absorbed;
  }
  return remaining;
}

export function onEnemyDamagedByPlayer(game, enemy, amount) {
  if (hasAffix(enemy, "hive")) {
    enemy.affixState.hiveCount = enemy.affixState.hiveCount || 0;
    if (enemy.affixState.hiveCount < 3) {
      enemy.affixState.hiveCount += 1;
      spawnHiveMinion(game, enemy);
    }
  }
  if (hasAffix(enemy, "guarded") && !enemy.affixState.guardedTriggered && enemy.hp > 0 && enemy.maxHp > 0 && enemy.hp / enemy.maxHp <= 0.5) {
    enemy.affixState.guardedTriggered = true;
    enemy.affixShield = (enemy.affixShield || 0) + Math.round(enemy.maxHp * 0.25);
  }
  if (hasAffix(enemy, "inking") && !enemy.affixState.inkingTriggered && enemy.hp > 0 && enemy.maxHp > 0 && enemy.hp / enemy.maxHp <= 0.5) {
    enemy.affixState.inkingTriggered = true;
    game.inkFlashTimer = 1.2;
  }
}

export function tryPreventEnemyDeath(game, enemy) {
  if (!hasAffix(enemy, "undying") || enemy.affixState.undyingUsed) return false;
  enemy.affixState.undyingUsed = true;
  enemy.state ||= {};
  enemy.hp = Math.max(1, Math.round(enemy.maxHp * 0.35));
  enemy.state.spawnGrace = Math.max(enemy.state.spawnGrace || 0, 0.8);
  return true;
}

export function onEnemyKilledByPlayer(game, enemy) {
  if (hasAffix(enemy, "martyr")) {
    const center = centerOf(enemy);
    game.spawnEnemyAreaHitbox({
      shape: "circle",
      x: center.x,
      y: center.y,
      radius: 72,
      damage: Math.max(1, Math.round(enemy.damage * 0.9)),
      duration: 0.18,
      sourceAttackId: "affix_martyr"
    });
  }
}
