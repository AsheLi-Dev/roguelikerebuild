import { centerOf, clamp, distance, normalize, resolveHeroProjectileOrigin } from "../core/runtime-utils.js";
import { damageBreakablesAlongSegment, damageBreakablesInCone, damageBreakablesInRadius } from "./breakables.js";
import { getPlayerBasicAttackDamage, getPlayerCritDamage, getPlayerStat } from "./player-stats.js";
import { getCurrentAttackRate } from "./rings.js";
import { applyStatusPayload } from "./status-manager.js";

function pointRayDistance(px, py, ox, oy, dx, dy) {
  const toPointX = px - ox;
  const toPointY = py - oy;
  const projection = toPointX * dx + toPointY * dy;
  if (projection <= 0) return Infinity;
  const closestX = ox + dx * projection;
  const closestY = oy + dy * projection;
  return distance(px, py, closestX, closestY);
}

function getAimAssistTarget(game, origin, dir) {
  const maxAssistAngleDeg = 10;
  const maxAssistDistance = 420;
  const maxNearMissPadding = 28;
  const minDot = Math.cos((maxAssistAngleDeg * Math.PI) / 180);
  let bestTarget = null;
  let bestScore = Infinity;

  for (const enemy of game.enemies || []) {
    if (enemy.dead) continue;
    const center = centerOf(enemy);
    const toEnemy = normalize(center.x - origin.x, center.y - origin.y, dir);
    const dot = dir.x * toEnemy.x + dir.y * toEnemy.y;
    if (dot < minDot) continue;
    const distToEnemy = distance(origin.x, origin.y, center.x, center.y);
    if (distToEnemy > maxAssistDistance) continue;
    const enemyRadius = Math.max(enemy.w, enemy.h) * (enemy.collisionRadius ?? 0.32);
    const nearMissDistance = pointRayDistance(center.x, center.y, origin.x, origin.y, dir.x, dir.y);
    if (nearMissDistance > enemyRadius + maxNearMissPadding) continue;
    const score = nearMissDistance + distToEnemy * 0.02;
    if (score >= bestScore) continue;
    bestScore = score;
    bestTarget = center;
  }

  return bestTarget;
}

function aimDirection(game) {
  const target = game.combat.overrideAimPointOnce || game.input.getAimWorld(game.camera);
  game.combat.overrideAimPointOnce = null;
  const center = centerOf(game.player);
  const baseDir = normalize(target.x - center.x, target.y - center.y, { x: 1, y: 0 });
  const origin = resolveHeroProjectileOrigin(game.player, game.heroDef, baseDir);
  const rawDir = normalize(target.x - origin.x, target.y - origin.y, baseDir);
  const assistTarget = getAimAssistTarget(game, origin, rawDir);
  const aimAssistStrength = assistTarget ? 0.38 : 0;
  const dir = assistTarget
    ? normalize(
        rawDir.x * (1 - aimAssistStrength) + normalize(assistTarget.x - origin.x, assistTarget.y - origin.y, rawDir).x * aimAssistStrength,
        rawDir.y * (1 - aimAssistStrength) + normalize(assistTarget.x - origin.x, assistTarget.y - origin.y, rawDir).y * aimAssistStrength,
        rawDir
      )
    : rawDir;
  return {
    origin,
    target,
    dir
  };
}

function directionDot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function healPlayer(game, amount) {
  game.player.hp = Math.min(game.player.maxHp, game.player.hp + amount);
}

function basicAttackDamageMultiplier(game) {
  return getPlayerBasicAttackDamage(game.player);
}

function spawnProjectile(game, config) {
  game.combat.playerProjectiles.push({
    x: config.x,
    y: config.y,
    radius: config.radius,
    drawSize: config.drawSize ?? config.radius * 2,
    damage: config.damage,
    speed: config.speed,
    vx: config.vx,
    vy: config.vy,
    traveled: 0,
    maxRange: config.maxRange,
    spriteAsset: config.spriteAsset ?? null,
    color: config.color ?? "#a78bfa",
    pierce: config.pierce ?? 0,
    source: config.source ?? "basic",
    isDirect: config.isDirect ?? ((config.source ?? "basic") === "basic"),
    hitEnemyIds: new Set(),
    spriteFrames: config.spriteFrames ?? null,
    spriteFrameWidth: config.spriteFrameWidth ?? null,
    spriteFrameHeight: config.spriteFrameHeight ?? null,
    spriteFps: config.spriteFps ?? null,
    spriteLoopStart: config.spriteLoopStart ?? null,
    spriteLoopEnd: config.spriteLoopEnd ?? null,
    spriteEndStart: config.spriteEndStart ?? null,
    spriteEndFrames: config.spriteEndFrames ?? null,
    spriteEndDistance: config.spriteEndDistance ?? null,
    homingRadius: Math.max(config.homingRadius ?? 0, getPlayerStat(game.player, "projectileHomingRadius")),
    homingTurnRate: Math.max(config.homingTurnRate ?? 0, getPlayerStat(game.player, "projectileHomingTurnRate")),
    lifetime: config.lifetime ?? (getPlayerStat(game.player, "projectileLifetime") || null),
    age: 0,
    hitMeta: config.hitMeta ?? null,
    onHitEnemy: config.onHitEnemy ?? null,
    bounceOnWall: !!config.bounceOnWall,
    detonateOnEnemy: !!config.detonateOnEnemy,
    detonateOnWall: !!config.detonateOnWall,
    explosionRadius: config.explosionRadius ?? null,
    explosionDamage: config.explosionDamage ?? null,
    explosionColor: config.explosionColor ?? null,
    projectileClass: config.projectileClass ?? null
  });
}

function fireProjectileAtAngle(game, base, angleOffsetDeg, extra = {}) {
  const angle = Math.atan2(base.dir.y, base.dir.x) + (angleOffsetDeg * Math.PI) / 180;
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  spawnProjectile(game, {
    x: base.origin.x,
    y: base.origin.y,
    radius: extra.radius,
    drawSize: extra.drawSize,
    damage: extra.damage,
    speed: extra.speed,
    vx: dir.x * extra.speed,
    vy: dir.y * extra.speed,
    maxRange: extra.range,
    spriteAsset: extra.spriteAsset,
    spriteFrames: extra.spriteFrames,
    spriteFrameWidth: extra.spriteFrameWidth,
    spriteFrameHeight: extra.spriteFrameHeight,
    spriteFps: extra.spriteFps,
    spriteLoopStart: extra.spriteLoopStart,
    spriteLoopEnd: extra.spriteLoopEnd,
    spriteEndStart: extra.spriteEndStart,
    spriteEndFrames: extra.spriteEndFrames,
    spriteEndDistance: extra.spriteEndDistance,
    color: extra.color,
    pierce: extra.pierce,
    source: extra.source,
    isDirect: extra.isDirect,
    hitMeta: extra.hitMeta,
    onHitEnemy: extra.onHitEnemy,
    bounceOnWall: extra.bounceOnWall,
    detonateOnEnemy: extra.detonateOnEnemy,
    detonateOnWall: extra.detonateOnWall,
    explosionRadius: extra.explosionRadius,
    explosionDamage: extra.explosionDamage,
    explosionColor: extra.explosionColor,
    projectileClass: extra.projectileClass
  });
}

function meleeHit(game, options) {
  const { origin, dir } = aimDirection(game);
  const hits = [];
  const range = options.range;
  const cosArc = Math.cos(((options.arcDeg ?? 90) * Math.PI) / 360);
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const enemyCenter = centerOf(enemy);
    const delta = normalize(enemyCenter.x - origin.x, enemyCenter.y - origin.y, { x: dir.x, y: dir.y });
    const dist = distance(origin.x, origin.y, enemyCenter.x, enemyCenter.y);
    if (dist > range + enemy.w * 0.35) continue;
    if (directionDot(dir, delta) < cosArc) continue;
    hits.push(enemy);
  }
  return { hits, origin, dir };
}

function forwardCircleHit(game, origin, dir, options) {
  const radius = options.hitCircleRadius ?? Math.max(30, options.range * 0.38);
  const distanceOut = options.hitCircleDistance ?? Math.max(radius * 0.8, options.range * 0.72);
  const x = origin.x + dir.x * distanceOut;
  const y = origin.y + dir.y * distanceOut;
  const hits = [];
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const center = centerOf(enemy);
    const enemyRadius = Math.max(enemy.w, enemy.h) * (enemy.collisionRadius ?? 0.32);
    if (distance(x, y, center.x, center.y) > radius + enemyRadius) continue;
    hits.push(enemy);
  }
  return { hits, x, y, radius };
}

function getDefaultPlayerHitboxTrigger(animationKey) {
  if (animationKey === "cast") return 7;
  if (animationKey === "attack") return 6;
  if (animationKey === "attack2") return 5;
  if (animationKey === "attack3") return 8;
  return null;
}

function getAnimationDuration(stateDef, fallbackDuration) {
  if (stateDef?.frames && stateDef?.fps) {
    return stateDef.frames / Math.max(1, stateDef.fps);
  }
  return fallbackDuration;
}

function getActionDurationForFixedWindup(frameCount, hitboxTrigger, windupSeconds, fallbackDuration) {
  if (!Number.isFinite(hitboxTrigger) || hitboxTrigger <= 0 || !Number.isFinite(frameCount) || frameCount <= 0) {
    return fallbackDuration;
  }
  return (windupSeconds * frameCount) / hitboxTrigger;
}

function spawnDeathKnightSlashVfx(game, origin, dir, combo) {
  if (game.heroDef?.id !== "death_knight") return;
  game.combat.impactVfx.push({
    x: origin.x + dir.x * (combo.range * 0.42),
    y: origin.y + dir.y * (combo.range * 0.24),
    sprite: "deathKnightSwordSlashVfx",
    frames: 6,
    frameWidth: 196,
    frameHeight: 196,
    fps: 20,
    size: 96,
    drawWidth: 168,
    drawHeight: 168,
    angle: Math.atan2(dir.y, dir.x),
    age: 0,
    currentFrame: 0
  });
}

function beginAction(game, config) {
  const hitboxTrigger = Number.isFinite(config.hitboxTrigger)
    ? Math.max(0, Math.floor(config.hitboxTrigger))
    : getDefaultPlayerHitboxTrigger(config.animationKey);
  game.combat.playerAction = {
    elapsed: 0,
    duration: config.duration,
    triggerTime: config.triggerTime,
    hitboxTrigger,
    hitFrames: Array.isArray(config.hitFrames) ? config.hitFrames.map((frame) => Math.max(0, Math.floor(frame))) : null,
    firedFrames: new Set(),
    triggered: false,
    animationKey: config.animationKey,
    facing: config.facing,
    moveMultiplier: config.moveMultiplier ?? 1,
    onHitFrame: config.onHitFrame ?? null,
    onStart: config.onStart ?? null,
    onTrigger: config.onTrigger
  };
  game.player.facing = config.facing;
  game.combat.playerAction.onStart?.();
}

function facingFromDir(dir) {
  const x = dir.x;
  const y = dir.y;
  if (Math.abs(x) > Math.abs(y) * 1.4) return x >= 0 ? "right" : "left";
  if (Math.abs(y) > Math.abs(x) * 1.4) return y >= 0 ? "down" : "up";
  if (x >= 0 && y >= 0) return "right_down";
  if (x >= 0 && y < 0) return "right_up";
  if (x < 0 && y >= 0) return "left_down";
  return "left_up";
}

function comboIndex(state, max, resetTime) {
  if (state.comboTimer <= 0) {
    state.comboIndex = 0;
    state.bladeBlastLeadHits = 0;
  }
  const index = state.comboIndex % max;
  state.comboIndex = (state.comboIndex + 1) % max;
  state.comboTimer = resetTime;
  return index;
}

function findNearestEnemy(game, origin, maxDistance = Infinity) {
  let nearest = null;
  let nearestDistance = maxDistance;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const center = centerOf(enemy);
    const dist = distance(origin.x, origin.y, center.x, center.y);
    if (dist >= nearestDistance) continue;
    nearest = enemy;
    nearestDistance = dist;
  }
  return nearest;
}

function summonSoulSiphonSpirit(game, origin, dir = { x: 1, y: 0 }) {
  return {
    x: origin.x + dir.x * 62,
    y: origin.y + dir.y * 62 - 14,
    orbitAngle: -Math.PI * 0.5,
    orbitRadius: 72,
    charge: 0,
    maxCharge: 10,
    animClock: 0,
    attackTimer: 0,
    visible: true
  };
}

export function initializeWeaponArtRuntime(game) {
  const state = game?.combat?.weaponArtRuntime;
  if (!state || game?.weaponArt?.id !== "soulSiphon" || state.soulSiphonSpirit) return;
  const playerCenter = centerOf(game.player);
  state.soulSiphonSpirit = summonSoulSiphonSpirit(game, playerCenter, { x: 1, y: 0 });
}

function fireSoulSiphonSpiritProjectile(game, spirit, target) {
  if (!spirit || !target) return false;
  const center = centerOf(target);
  const dir = normalize(center.x - spirit.x, center.y - spirit.y, { x: 1, y: 0 });
  spawnProjectile(game, {
    x: spirit.x,
    y: spirit.y,
    radius: 12,
    drawSize: 22,
    damage: basicAttackDamageMultiplier(game),
    speed: 620,
    vx: dir.x * 620,
    vy: dir.y * 620,
    maxRange: 420,
    color: "#c084fc",
    pierce: 1
  });
  spirit.attackTimer = 0.32;
  return true;
}

function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const denom = abx * abx + aby * aby || 1;
  const t = clamp((apx * abx + apy * aby) / denom, 0, 1);
  const closestX = ax + abx * t;
  const closestY = ay + aby * t;
  return distance(px, py, closestX, closestY);
}

function spawnAssistGroundZone(game, config) {
  const state = game.combat.weaponArtRuntime;
  const zone = {
    id: config.id ?? `assist_zone_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: config.kind ?? "assistGround",
    x: config.x,
    y: config.y,
    radius: config.radius,
    radiusY: config.radiusY ?? config.radius * 0.72,
    elapsed: 0,
    duration: config.duration,
    tickTimer: 0,
    tickInterval: config.tickInterval ?? 0.2,
    slowDuration: config.slowDuration ?? 0.28,
    slowMult: config.slowMult ?? 0.5,
    damage: config.damage ?? 0,
    color: config.color ?? "#7c3aed"
  };
  if (config.replaceExisting) {
    state.assistGroundZones = state.assistGroundZones.filter((entry) => entry.kind !== zone.kind);
  }
  state.assistGroundZones.push(zone);
  return zone;
}

function attackProjectile(game) {
  const state = game.combat.weaponArtRuntime;
  const step = state.elementCycle % 3;
  state.elementCycle += 1;
  const startBase = aimDirection(game);
  const combat = game.heroDef.combat;
  const fireballSprite = {
    spriteAsset: "elementMageFireballProjectile",
    spriteFrames: 60,
    spriteFrameWidth: 64,
    spriteFrameHeight: 64,
    spriteFps: 24
  };
  const variants = [
    {
      animationKey: "cast",
      duration: 0.42,
      triggerTime: 0.16,
      cast: () => {
        const base = aimDirection(game);
        fireProjectileAtAngle(game, base, 0, {
        radius: 18,
        drawSize: 34,
        damage: basicAttackDamageMultiplier(game),
        speed: 520,
        range: 520,
        color: "#fb923c",
        ...fireballSprite
        });
      }
    },
    {
      animationKey: "attack2",
      duration: 0.38,
      triggerTime: 0.12,
      cast: () => {
        const base = aimDirection(game);
        fireProjectileAtAngle(game, base, -7, {
          radius: 12,
          drawSize: 20,
          damage: basicAttackDamageMultiplier(game),
          speed: 900,
          range: 640,
          color: "#60a5fa",
          ...fireballSprite
        });
        fireProjectileAtAngle(game, base, 7, {
          radius: 12,
          drawSize: 20,
          damage: basicAttackDamageMultiplier(game),
          speed: 900,
          range: 640,
          color: "#93c5fd",
          ...fireballSprite
        });
      }
    },
    {
      animationKey: "attack3",
      duration: 0.46,
      triggerTime: 0.18,
      cast: () => {
        const base = aimDirection(game);
        fireProjectileAtAngle(game, base, -14, {
          radius: 10,
          drawSize: 16,
          damage: basicAttackDamageMultiplier(game),
          speed: 840,
          range: 560,
          color: "#fde047",
          ...fireballSprite
        });
        fireProjectileAtAngle(game, base, 0, {
          radius: 11,
          drawSize: 18,
          damage: basicAttackDamageMultiplier(game),
          speed: 860,
          range: 560,
          color: "#facc15",
          ...fireballSprite
        });
        fireProjectileAtAngle(game, base, 14, {
          radius: 10,
          drawSize: 16,
          damage: basicAttackDamageMultiplier(game),
          speed: 840,
          range: 560,
          color: "#fde047",
          ...fireballSprite
        });
      }
    }
  ][step];

  beginAction(game, {
    duration: variants.duration,
    triggerTime: variants.triggerTime,
    animationKey: variants.animationKey,
    facing: facingFromDir(startBase.dir),
    moveMultiplier: combat.moveMultiplier,
    onTrigger: variants.cast
  });
}

function attackBladeBlast(game) {
  const state = game.combat.weaponArtRuntime;
  const step = comboIndex(state, 3, game.heroDef.combat.comboReset);
  const combo = [
    { animationKey: "attack", duration: 0.4, triggerTime: 0.18, damage: 1, range: 80, arcDeg: 105, blastDamage: 0, heal: 2, hitCircleRadius: 32, hitCircleDistance: 56 },
    { animationKey: "attack2", duration: 0.42, triggerTime: 0.2, damage: 1, range: 88, arcDeg: 100, blastDamage: 0, heal: 3, hitCircleRadius: 36, hitCircleDistance: 62 },
    { animationKey: "attack3", duration: 0.52, triggerTime: 0.24, damage: 1, range: 96, arcDeg: 110, blastDamage: 1, heal: 4, hitCircleRadius: 40, hitCircleDistance: 68 }
  ][step];
  const startBase = aimDirection(game);
  beginAction(game, {
    duration: combo.duration,
    triggerTime: combo.triggerTime,
    animationKey: combo.animationKey,
    facing: facingFromDir(startBase.dir),
    moveMultiplier: game.heroDef.combat.moveMultiplier,
    onTrigger: () => {
      const base = aimDirection(game);
      spawnDeathKnightSlashVfx(game, base.origin, base.dir, combo);
      const { hits } = meleeHit(game, combo);
      const { hits: circleHits, x: circleX, y: circleY, radius: circleRadius } = forwardCircleHit(game, base.origin, base.dir, combo);
      const allHits = [...new Set([...hits, ...circleHits])];
      let landed = 0;
      for (const enemy of allHits) {
        game.damageEnemy(enemy, combo.damage * basicAttackDamageMultiplier(game), { source: "basic", isDirect: true });
        landed += 1;
      }
      if (step < 2 && landed > 0) {
        state.bladeBlastLeadHits = Math.min(2, (state.bladeBlastLeadHits || 0) + 1);
      }
      damageBreakablesInCone(game, base.origin, base.dir, combo.range, combo.arcDeg, combo.damage * basicAttackDamageMultiplier(game));
      damageBreakablesInRadius(game, circleX, circleY, circleRadius, combo.damage * basicAttackDamageMultiplier(game));
      if (landed > 0 && game.heroDef.id === "death_knight") {
        healPlayer(game, combo.heal * landed);
      }
      if (combo.blastDamage > 0) {
        const finisherDamageScale = 0.5 + 0.5 * Math.min(2, state.bladeBlastLeadHits || 0);
        fireProjectileAtAngle(game, base, 0, {
          radius: 50,
          drawSize: 98,
          damage: combo.blastDamage * basicAttackDamageMultiplier(game) * finisherDamageScale,
          speed: 540,
          range: 280,
          pierce: 999,
          color: "#7c3aed",
          spriteAsset: "deathKnightDarkWaveProjectile",
          spriteFrames: 12,
          spriteFrameWidth: 196,
          spriteFrameHeight: 196,
          spriteFps: 16,
          spriteLoopStart: 0,
          spriteLoopEnd: 6,
          spriteEndStart: 7,
          spriteEndFrames: 5
        });
        state.bladeBlastLeadHits = 0;
      }
    }
  });
}

function clearGuardProjectiles(game, origin, dir, range, arcDeg) {
  const cosArc = Math.cos((arcDeg * Math.PI) / 360);
  game.combat.enemyProjectiles = game.combat.enemyProjectiles.filter((projectile) => {
    const dist = distance(origin.x, origin.y, projectile.x, projectile.y);
    if (dist > range) return true;
    const delta = normalize(projectile.x - origin.x, projectile.y - origin.y, { x: dir.x, y: dir.y });
    return directionDot(dir, delta) < cosArc;
  });
}

function attackGuardCombo(game) {
  const state = game.combat.weaponArtRuntime;
  const step = comboIndex(state, 3, game.heroDef.combat.comboReset);
  const combo = [
    { animationKey: "attack", duration: 0.38, triggerTime: 0.17, damage: 1, range: 76, arcDeg: 100, projectileClear: false },
    { animationKey: "attack2", duration: 0.42, triggerTime: 0.2, damage: 1, range: 86, arcDeg: 95, projectileClear: false },
    { animationKey: "attack3", duration: 0.48, triggerTime: 0.26, damage: 1, range: 98, arcDeg: 105, projectileClear: true }
  ][step];
  const startBase = aimDirection(game);
  beginAction(game, {
    duration: combo.duration,
    triggerTime: combo.triggerTime,
    animationKey: combo.animationKey,
    facing: facingFromDir(startBase.dir),
    moveMultiplier: game.heroDef.combat.moveMultiplier,
    onTrigger: () => {
      const { hits, origin, dir } = meleeHit(game, combo);
      for (const enemy of hits) game.damageEnemy(enemy, combo.damage * basicAttackDamageMultiplier(game), { source: "basic", isDirect: true });
      damageBreakablesInCone(game, origin, dir, combo.range, combo.arcDeg, combo.damage * basicAttackDamageMultiplier(game));
      if (combo.projectileClear) clearGuardProjectiles(game, origin, dir, combo.range + 40, combo.arcDeg);
    }
  });
}

function attackSoulSiphon(game) {
  const state = game.combat.weaponArtRuntime;
  const startBase = aimDirection(game);
  const combat = game.heroDef.combat;
  const soulSiphonStep = state.soulSiphonCastIndex % 3;
  const animationKey = soulSiphonStep === 2 ? "attack3" : soulSiphonStep === 1 ? "attack2" : "attack";
  state.soulSiphonCastIndex += 1;
  const animationState = game.heroDef?.sprite?.states?.[animationKey] || null;
  const frameCount = Math.max(1, animationState?.frames || 1);
  const hitboxTrigger = getDefaultPlayerHitboxTrigger(animationKey) ?? combat.hitboxTrigger ?? 0;
  const fixedWindupSeconds = animationKey === "attack3" ? 0.4 : 0.2;
  const isChargedCrit = animationKey === "attack3";
  const actionDuration = getActionDurationForFixedWindup(frameCount, hitboxTrigger, fixedWindupSeconds, getAnimationDuration(animationState, combat.actionDuration));
  const secondsPerFrame = actionDuration / frameCount;
  const damageDelay = hitboxTrigger * secondsPerFrame;
  const followFrames = 4;
  const beamSpriteFrames = 7;
  const followDuration = (actionDuration * followFrames) / beamSpriteFrames;
  const baseDamage = basicAttackDamageMultiplier(game) * 0.4;
  const beamDamage = isChargedCrit ? baseDamage * getPlayerCritDamage(game.player) : baseDamage;
  beginAction(game, {
    duration: actionDuration,
    triggerTime: damageDelay,
    hitboxTrigger,
    animationKey,
    facing: facingFromDir(startBase.dir),
    moveMultiplier: combat.moveMultiplier,
    onTrigger: () => {
      const base = aimDirection(game);
      state.activeBeam = {
        originX: base.origin.x,
        originY: base.origin.y,
        dirX: base.dir.x,
        dirY: base.dir.y,
        range: combat.range,
        width: combat.beamWidth,
        damage: beamDamage,
        duration: actionDuration,
        elapsed: 0,
        damageDelay: 0,
        visualDelay: 0,
        followDuration,
        hitCount: 0,
        maxHits: 3,
        hitInterval: 0.06,
        nextHitAt: 0,
        breakablesApplied: false,
        isCrit: isChargedCrit,
        source: "basic",
        color: "#a855f7",
        spriteAsset: "darkLaserVfx",
        spriteFrames: beamSpriteFrames
      };
      if (!state.soulSiphonSpirit && state.soulCount >= 10) {
        state.soulCount -= 10;
        state.soulSiphonSpirit = summonSoulSiphonSpirit(game, base.origin, base.dir);
      }
    }
  });
}

function updateWindMomentum(game, dt) {
  const state = game.combat.weaponArtRuntime;
  if (game.weaponArt.id !== "windVolley") {
    state.windMomentum = 0;
    return;
  }
  if (game.player.isMoving) state.windMomentum = clamp(state.windMomentum + dt * 1.15, 0, 3);
  else state.windMomentum = clamp(state.windMomentum - dt * 0.8, 0, 3);
}

function attackWindVolley(game) {
  const startBase = aimDirection(game);
  const momentum = game.combat.weaponArtRuntime.windMomentum;
  const stage = momentum >= 2.2 ? 3 : momentum >= 1 ? 2 : 1;
  const spread = stage === 3 ? [-12, 0, 12] : stage === 2 ? [-6, 0, 6] : [0];
  const damage = 1;
  beginAction(game, {
    duration: 0.24,
    triggerTime: 0.1,
    animationKey: stage === 3 ? "attack3" : stage === 2 ? "attack2" : "attack",
    facing: facingFromDir(startBase.dir),
    moveMultiplier: game.heroDef.combat.moveMultiplier,
    onTrigger: () => {
      const base = aimDirection(game);
      for (const angle of spread) {
        fireProjectileAtAngle(game, base, angle, {
          radius: 10,
          drawSize: 24,
          damage: damage * basicAttackDamageMultiplier(game),
          speed: 980,
          range: 720,
          color: "#a7f3d0",
          spriteAsset: "heroWindArrow",
          spriteFrames: 15,
          spriteFrameWidth: 512,
          spriteFrameHeight: 26,
          spriteFps: 18
        });
      }
      game.combat.weaponArtRuntime.windMomentum = Math.max(0, momentum - (stage === 3 ? 2 : 1));
    }
  });
}

function assistProjectile(game) {
  const startBase = aimDirection(game);
  const damage = basicAttackDamageMultiplier(game);
  beginAction(game, {
    duration: 0.34,
    triggerTime: 0.14,
    animationKey: "attack",
    facing: facingFromDir(startBase.dir),
    moveMultiplier: 0.52,
    onTrigger: () => {
      const shock = { range: 142, arcDeg: 120 };
      const { hits, origin, dir } = meleeHit(game, shock);
      for (const enemy of hits) {
        game.damageEnemy(enemy, damage, {
          source: "basic",
          isDirect: true,
          hitDirX: dir.x,
          hitDirY: dir.y,
          hitDuration: 0.18,
          staggerPause: 0.1,
          staggerDuration: 0.42,
          recoilDistance: 86
        });
      }
      damageBreakablesInCone(game, origin, dir, shock.range, shock.arcDeg, damage);
    }
  });
  return 1.35;
}

function assistBladeBlast(game) {
  const startBase = aimDirection(game);
  beginAction(game, {
    duration: 0.44,
    triggerTime: 0.16,
    animationKey: "cast",
    facing: facingFromDir(startBase.dir),
    moveMultiplier: 0.58,
    onTrigger: () => {
      const base = aimDirection(game);
      fireProjectileAtAngle(game, base, 0, {
        radius: 50,
        drawSize: 98,
        damage: basicAttackDamageMultiplier(game),
        speed: 520,
        range: 420,
        pierce: 999,
        spriteAsset: "deathKnightDarkWaveProjectile",
        spriteFrames: 12,
        spriteFrameWidth: 196,
        spriteFrameHeight: 196,
        spriteFps: 16,
        spriteLoopStart: 0,
        spriteLoopEnd: 6,
        spriteEndStart: 7,
        spriteEndFrames: 5,
        color: "#4c1d95",
        source: "basic",
        hitMeta: {
          staggerDuration: 0.24,
          staggerPause: 0.06,
          recoilDistance: 24
        }
      });
    }
  });
  return 1.25;
}

function assistGuardCombo(game) {
  const startBase = aimDirection(game);
  beginAction(game, {
    duration: 0.42,
    triggerTime: 0.16,
    animationKey: "cast",
    facing: facingFromDir(startBase.dir),
    moveMultiplier: 0.46,
    onTrigger: () => {
      const base = aimDirection(game);
      fireProjectileAtAngle(game, base, 0, {
        radius: 12,
        drawSize: 42,
        damage: basicAttackDamageMultiplier(game),
        speed: 760,
        range: 460,
        spriteAsset: "heroFlyingSword",
        color: "#cbd5e1",
        source: "basic",
        pierce: 2,
        hitMeta: {
          staggerDuration: 0.26,
          staggerPause: 0.08,
          recoilDistance: 32
        }
      });
    }
  });
  return 1.4;
}

function assistSoulSiphon(game) {
  const startBase = aimDirection(game);
  beginAction(game, {
    duration: 0.42,
    triggerTime: 0.15,
    animationKey: "cast",
    facing: facingFromDir(startBase.dir),
    moveMultiplier: 0.52,
    onTrigger: () => {
      const base = aimDirection(game);
      const targetDistance = Math.min(220, distance(base.origin.x, base.origin.y, base.target.x, base.target.y));
      const zoneX = base.origin.x + base.dir.x * targetDistance;
      const zoneY = base.origin.y + base.dir.y * targetDistance;
      spawnAssistGroundZone(game, {
        kind: "soulSiphonGround",
        x: zoneX,
        y: zoneY,
        radius: 78,
        radiusY: 54,
        duration: 4.5,
        tickInterval: 0.18,
        slowDuration: 0.32,
        slowMult: 0.42,
        color: "#7c3aed",
        replaceExisting: true
      });
    }
  });
  return 1.8;
}

function assistWindVolley(game) {
  const startBase = aimDirection(game);
  beginAction(game, {
    duration: 0.3,
    triggerTime: 0.11,
    animationKey: "attack2",
    facing: facingFromDir(startBase.dir),
    moveMultiplier: 0.74,
    onTrigger: () => {
      const base = aimDirection(game);
      fireProjectileAtAngle(game, base, 0, {
        radius: 10,
        drawSize: 28,
        damage: basicAttackDamageMultiplier(game),
        speed: 1040,
        range: 680,
        color: "#99f6e4",
        spriteAsset: "heroWindArrow",
        spriteFrames: 15,
        spriteFrameWidth: 512,
        spriteFrameHeight: 26,
        spriteFps: 18,
        source: "basic",
        pierce: 1,
        hitMeta: {
          staggerDuration: 0.16,
          staggerPause: 0.04,
          recoilDistance: 18
        },
        onHitEnemy: (_runtimeGame, enemy) => {
          applyStatusPayload(enemy, { slowDuration: 1.2, slowMult: 0.65 });
        }
      });
    }
  });
  return 1.05;
}

const WEAPON_ART_ATTACK_HANDLERS = {
  projectile: attackProjectile,
  bladeBlast: attackBladeBlast,
  guardCombo: attackGuardCombo,
  soulSiphon: attackSoulSiphon,
  windVolley: attackWindVolley
};

const WEAPON_ART_ASSIST_HANDLERS = {
  projectile: assistProjectile,
  bladeBlast: assistBladeBlast,
  guardCombo: assistGuardCombo,
  soulSiphon: assistSoulSiphon,
  windVolley: assistWindVolley
};

function updateSoulSiphonBeam(game, dt) {
  const state = game.combat.weaponArtRuntime;
  const beam = state.activeBeam;
  if (!beam) {
    game.combat.playerBeam = null;
    return;
  }

  beam.elapsed += dt;
  if (beam.elapsed < (beam.followDuration || 0)) {
    const origin = resolveHeroProjectileOrigin(game.player, game.heroDef, { x: beam.dirX, y: beam.dirY });
    beam.originX = origin.x;
    beam.originY = origin.y;
  }
  const originX = beam.originX;
  const originY = beam.originY;
  const endX = originX + beam.dirX * beam.range;
  const endY = originY + beam.dirY * beam.range;
  const visualDelay = beam.visualDelay || 0;
  if (beam.elapsed >= visualDelay) {
    const visualElapsed = Math.max(0, beam.elapsed - visualDelay);
    const visualDuration = Math.max(0.001, (beam.duration || 0.2) - visualDelay);
    game.combat.playerBeam = {
      x1: originX,
      y1: originY,
      x2: endX,
      y2: endY,
      width: beam.width,
      color: beam.color || "#a855f7",
      elapsed: visualElapsed,
      duration: visualDuration,
      spriteAsset: beam.spriteAsset || "darkLaserVfx",
      spriteFrames: beam.spriteFrames || 7
    };
  } else {
    game.combat.playerBeam = null;
  }

  while (beam.hitCount < (beam.maxHits || 1) && beam.elapsed >= (beam.nextHitAt ?? (beam.damageDelay || 0))) {
    beam.hitCount += 1;
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      const center = centerOf(enemy);
      const radius = (enemy.collisionRadius ?? 0.32) * enemy.w;
      const dist = pointSegmentDistance(center.x, center.y, originX, originY, endX, endY);
      if (dist > beam.width * 0.5 + radius) continue;
      const wasDead = enemy.dead;
      game.damageEnemy(enemy, beam.damage, { source: beam.source || "basic", isDirect: true, isCrit: !!beam.isCrit });
      if (!wasDead && enemy.dead && !state.soulSiphonSpirit) {
        state.soulCount = Math.min(30, state.soulCount + 1);
      }
    }
    if (!state.soulSiphonSpirit && state.soulCount >= 10) {
      state.soulCount -= 10;
      state.soulSiphonSpirit = summonSoulSiphonSpirit(game, origin, { x: beam.dirX, y: beam.dirY });
    }
    if (state.soulSiphonSpirit) {
      const spirit = state.soulSiphonSpirit;
      const dist = pointSegmentDistance(spirit.x, spirit.y, originX, originY, endX, endY);
      if (dist <= beam.width * 0.5 + 10) {
        spirit.charge = Math.min(spirit.maxCharge, spirit.charge + 1);
      }
    }
    if (!beam.breakablesApplied) {
      beam.breakablesApplied = true;
      damageBreakablesAlongSegment(game, originX, originY, endX, endY, beam.width, beam.damage);
    }
    beam.nextHitAt = (beam.nextHitAt ?? (beam.damageDelay || 0)) + (beam.hitInterval || 0);
  }

  if (beam.elapsed >= beam.duration) {
    state.activeBeam = null;
    game.combat.playerBeam = null;
  }
}

function updateSoulSiphonSpirit(game, dt) {
  const state = game.combat.weaponArtRuntime;
  const spirit = state.soulSiphonSpirit;
  if (!spirit) return;

  const playerCenter = centerOf(game.player);
  let desiredX;
  let desiredY;
  if (state.activeBeam) {
    desiredX = playerCenter.x + state.activeBeam.dirX * 62;
    desiredY = playerCenter.y + state.activeBeam.dirY * 62 - 14;
  } else {
    spirit.orbitAngle += dt * 1.9;
    desiredX = playerCenter.x + Math.cos(spirit.orbitAngle) * spirit.orbitRadius;
    desiredY = playerCenter.y + Math.sin(spirit.orbitAngle) * spirit.orbitRadius - 18;
  }
  const follow = Math.min(1, dt * 7);
  spirit.x += (desiredX - spirit.x) * follow;
  spirit.y += (desiredY - spirit.y) * follow;
  spirit.animClock += dt;
  spirit.attackTimer = Math.max(0, spirit.attackTimer - dt);
  state.spiritAutoFireCooldown = Math.max(0, state.spiritAutoFireCooldown - dt);

  if (spirit.charge >= 1 && state.spiritAutoFireCooldown <= 0) {
    const target = findNearestEnemy(game, spirit, 500);
    if (target && fireSoulSiphonSpiritProjectile(game, spirit, target)) {
      spirit.charge -= 1;
      state.spiritAutoFireCooldown = 1 / getCurrentAttackRate(game);
    }
  }
}

function updateAssistGroundZones(game, dt) {
  const state = game.combat.weaponArtRuntime;
  const remaining = [];
  for (const zone of state.assistGroundZones) {
    zone.elapsed += dt;
    zone.tickTimer -= dt;
    if (zone.tickTimer <= 0) {
      zone.tickTimer += zone.tickInterval;
      for (const enemy of game.enemies) {
        if (enemy.dead) continue;
        const center = centerOf(enemy);
        const radiusX = zone.radius + enemy.w * 0.28;
        const radiusY = zone.radiusY + enemy.h * 0.22;
        const nx = (center.x - zone.x) / Math.max(1, radiusX);
        const ny = (center.y - zone.y) / Math.max(1, radiusY);
        if (nx * nx + ny * ny > 1) continue;
        if (zone.damage > 0) {
          game.damageEnemy(enemy, zone.damage * basicAttackDamageMultiplier(game), {
            source: "skill",
            isDirect: false
          });
        }
        applyStatusPayload(enemy, {
          slowDuration: zone.slowDuration,
          slowMult: zone.slowMult
        });
      }
    }
    if (zone.elapsed < zone.duration) remaining.push(zone);
  }
  state.assistGroundZones = remaining;
}

export function createWeaponArtRuntime() {
  return {
    comboIndex: 0,
    comboTimer: 0,
    bladeBlastLeadHits: 0,
    elementCycle: 0,
    windMomentum: 0,
    soulCount: 0,
    soulSiphonCastIndex: 0,
    activeBeam: null,
    soulSiphonSpirit: null,
    spiritAutoFireCooldown: 0,
    assistGroundZones: []
  };
}

export function triggerWeaponArtAttack(game) {
  const handler = WEAPON_ART_ATTACK_HANDLERS[game.weaponArt.id];
  if (!handler) return false;
  handler(game);
  return true;
}

export function triggerWeaponArtAssist(game) {
  const handler = WEAPON_ART_ASSIST_HANDLERS[game.weaponArt.id];
  if (!handler) return 0;
  return handler(game) || 0;
}

export function updateWeaponArtRuntime(game, dt) {
  const state = game.combat.weaponArtRuntime;
  state.comboTimer = Math.max(0, state.comboTimer - dt);
  updateWindMomentum(game, dt);
  updateSoulSiphonBeam(game, dt);
  updateSoulSiphonSpirit(game, dt);
  updateAssistGroundZones(game, dt);
}
