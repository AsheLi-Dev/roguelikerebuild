import { centerOf, circleHitsRect, clamp, distance, normalize } from "../core/runtime-utils.js";

const VOLATILE_PROJECTILE_VFX = Object.freeze({
  spriteAsset: "barbarianShamanFireOrb",
  spriteFrames: 16,
  spriteFrameWidth: 64,
  spriteFrameHeight: 64,
  spriteFps: 18,
  spriteLoopStart: 0,
  impactSprite: "fireExplosionVfx",
  impactFrames: 5,
  impactFrameWidth: 64,
  impactFrameHeight: 64,
  impactFps: 12,
  impactSize: 40
});

function hasAffix(enemy, id) {
  return enemy.affixes?.includes(id);
}

function easeInOutQuad(t) {
  const clamped = clamp(t, 0, 1);
  return clamped < 0.5
    ? 2 * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 2) * 0.5;
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
      size: 48,
      color: "#f97316",
      lifetime: 4,
      ...VOLATILE_PROJECTILE_VFX,
      sourceAttackId: "affix_volatile"
    });
  }
  enemy.affixState.volatileFlash = 0.2;
  enemy.affixState.lastBurstAt = game.time;
  enemy.affixState.lastBurstX = origin.x;
  enemy.affixState.lastBurstY = origin.y;
}

function spawnMartyrBurst(game, enemy) {
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    game.spawnEnemyProjectile(enemy, {
      dirX: Math.cos(angle),
      dirY: Math.sin(angle),
      damage: Math.max(1, Math.round(enemy.damage * 0.6)),
      speed: 120,
      radius: 8,
      size: 48,
      color: "#78716c",
      lifetime: 4,
      ...VOLATILE_PROJECTILE_VFX,
      sourceAttackId: "affix_martyr"
    });
  }
}

function spawnMartyrSlimes(game, enemy, count = 3) {
  const center = centerOf(enemy);
  for (let index = 0; index < count; index += 1) {
    const angle = (index / Math.max(1, count)) * Math.PI * 2;
    const distanceFromCenter = 36;
    const spawned = game.spawnEnemyByType?.(
      "slime_green_2",
      center.x + Math.cos(angle) * distanceFromCenter - 22,
      center.y + Math.sin(angle) * distanceFromCenter - 22,
      { tier: "minion", isAffixMinion: true }
    );
    if (spawned) {
      spawned.state ||= {};
      spawned.state.spawnGrace = 0.4;
    }
  }
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

function summonGuardedOgres(game, enemy, count = 2) {
  const origin = centerOf(enemy);
  const playerCenter = centerOf(game.player);
  const toPlayer = normalize(playerCenter.x - origin.x, playerCenter.y - origin.y, { x: 1, y: 0 });
  const distanceToPlayer = Math.max(80, distance(origin.x, origin.y, playerCenter.x, playerCenter.y));
  for (let index = 0; index < count; index += 1) {
    const progress = count === 1 ? 0.5 : (index + 1) / (count + 1);
    const spawnDistance = distanceToPlayer * progress;
    const spawned = game.spawnEnemyByType?.(
      "m_bar_ogre_1",
      origin.x + toPlayer.x * spawnDistance - 48,
      origin.y + toPlayer.y * spawnDistance - 48,
      { tier: "minion", isAffixMinion: true }
    );
    if (spawned) {
      spawned.state ||= {};
      spawned.state.spawnGrace = 0.4;
    }
  }
}

export function beginEnemyAffixFrame(game) {
  for (const enemy of game.enemies) {
    enemy._auraBuffed = false;
    enemy.renderAlpha = 1;
  }
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
  if (hasAffix(enemy, "evasive")) {
    if (!Number.isFinite(enemy.affixState.evasiveCooldown)) enemy.affixState.evasiveCooldown = 10;
    enemy.affixState.evasiveCooldown = Math.max(0, enemy.affixState.evasiveCooldown - dt);
    enemy.affixState.evasiveRetreatTimer = Math.max(0, (enemy.affixState.evasiveRetreatTimer || 0) - dt);
    if (enemy.affixState.evasiveCooldown <= 0) {
      enemy.affixState.evasiveCooldown = 10;
      enemy.affixState.evasiveRetreatTimer = 4;
    }
  } else {
    enemy.affixState.evasiveCooldown = 0;
    enemy.affixState.evasiveRetreatTimer = 0;
  }
  if (hasAffix(enemy, "erratic")) {
    enemy.affixState.erraticBurstAt = Math.max(0, (enemy.affixState.erraticBurstAt || 0) - dt);
    enemy.affixState.erraticTimer = (enemy.affixState.erraticTimer || 0) + dt;
    if (enemy.affixState.erraticTimer >= 3) {
      enemy.affixState.erraticTimer = 0;
      enemy.affixState.erraticBurstAt = 0.5;
      const angle = Math.random() * Math.PI * 2;
      enemy.affixState.erraticMoveDirX = Math.cos(angle);
      enemy.affixState.erraticMoveDirY = Math.sin(angle);
    }
  } else {
    enemy.affixState.erraticBurstAt = 0;
    enemy.affixState.erraticTimer = 0;
    enemy.affixState.erraticMoveDirX = 0;
    enemy.affixState.erraticMoveDirY = 0;
  }
  if (hasAffix(enemy, "invisible")) {
    const visibleDuration = 3;
    const fadeOutDuration = 0.5;
    const hiddenDuration = 1.5;
    const fadeInDuration = 0.5;
    const cycleDuration = visibleDuration + fadeOutDuration + hiddenDuration + fadeInDuration;
    enemy.affixState.invisibleTimer = (enemy.affixState.invisibleTimer || 0) + dt;
    const cycle = enemy.affixState.invisibleTimer % cycleDuration;

    if (cycle < visibleDuration) {
      enemy.renderAlpha = 1;
    } else if (cycle < visibleDuration + fadeOutDuration) {
      const progress = (cycle - visibleDuration) / Math.max(0.001, fadeOutDuration);
      enemy.renderAlpha = 1 - easeInOutQuad(progress);
    } else if (cycle < visibleDuration + fadeOutDuration + hiddenDuration) {
      enemy.renderAlpha = 0;
    } else {
      const progress = (cycle - visibleDuration - fadeOutDuration - hiddenDuration) / Math.max(0.001, fadeInDuration);
      enemy.renderAlpha = easeInOutQuad(progress);
    }
  } else {
    enemy.affixState.invisibleTimer = 0;
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
    summonGuardedOgres(game, enemy, 2);
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
    spawnMartyrBurst(game, enemy);
    spawnMartyrSlimes(game, enemy, 3);
  }
}
