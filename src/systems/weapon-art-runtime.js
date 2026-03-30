import { centerOf, clamp, distance, normalize, resolveHeroProjectileOrigin } from "../core/runtime-utils.js";
import { damageBreakablesAlongSegment, damageBreakablesInCone } from "./breakables.js";
import { applyStatusPayload } from "./status-manager.js";

function aimDirection(game) {
  const target = game.input.getAimWorld(game.camera);
  const center = centerOf(game.player);
  const baseDir = normalize(target.x - center.x, target.y - center.y, { x: 1, y: 0 });
  const origin = resolveHeroProjectileOrigin(game.player, game.heroDef, baseDir);
  return {
    origin,
    target,
    dir: normalize(target.x - origin.x, target.y - origin.y, baseDir)
  };
}

function directionDot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function healPlayer(game, amount) {
  game.player.hp = Math.min(game.player.maxHp, game.player.hp + amount);
}

function basicAttackDamageMultiplier(game) {
  return 1 + (game.player.damageBonus || 0) + (game.player.basicAttackDamageBonus || 0);
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
    homingRadius: Math.max(config.homingRadius ?? 0, game.player.ringProjectileHomingRadius || 0),
    homingTurnRate: Math.max(config.homingTurnRate ?? 0, game.player.ringProjectileHomingTurnRate || 0),
    lifetime: config.lifetime ?? (game.player.ringProjectileLifetime || null),
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

function beginAction(game, config) {
  game.combat.playerAction = {
    elapsed: 0,
    duration: config.duration,
    triggerTime: config.triggerTime,
    triggered: false,
    animationKey: config.animationKey,
    facing: config.facing,
    moveMultiplier: config.moveMultiplier ?? 1,
    onTrigger: config.onTrigger
  };
  game.player.facing = config.facing;
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
  if (state.comboTimer <= 0) state.comboIndex = 0;
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

function fireSoulSiphonSpiritProjectile(game, spirit, target) {
  if (!spirit || !target) return false;
  const center = centerOf(target);
  const dir = normalize(center.x - spirit.x, center.y - spirit.y, { x: 1, y: 0 });
  spawnProjectile(game, {
    x: spirit.x,
    y: spirit.y,
    radius: 12,
    drawSize: 22,
    damage: 22 * basicAttackDamageMultiplier(game),
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
  const base = aimDirection(game);
  const combat = game.heroDef.combat;
  const variants = [
    {
      animationKey: "cast",
      duration: 0.42,
      triggerTime: 0.16,
      cast: () => fireProjectileAtAngle(game, base, 0, {
        radius: 18,
        drawSize: 34,
        damage: 30 * basicAttackDamageMultiplier(game),
        speed: 520,
        range: 520,
        color: "#fb923c"
      })
    },
    {
      animationKey: "attack2",
      duration: 0.38,
      triggerTime: 0.12,
      cast: () => {
        fireProjectileAtAngle(game, base, -7, {
          radius: 12,
          drawSize: 20,
          damage: 18 * basicAttackDamageMultiplier(game),
          speed: 900,
          range: 640,
          color: "#60a5fa"
        });
        fireProjectileAtAngle(game, base, 7, {
          radius: 12,
          drawSize: 20,
          damage: 18 * basicAttackDamageMultiplier(game),
          speed: 900,
          range: 640,
          color: "#93c5fd"
        });
      }
    },
    {
      animationKey: "attack3",
      duration: 0.46,
      triggerTime: 0.18,
      cast: () => {
        fireProjectileAtAngle(game, base, -14, {
          radius: 10,
          drawSize: 16,
          damage: 16 * basicAttackDamageMultiplier(game),
          speed: 840,
          range: 560,
          color: "#fde047"
        });
        fireProjectileAtAngle(game, base, 0, {
          radius: 11,
          drawSize: 18,
          damage: 20 * basicAttackDamageMultiplier(game),
          speed: 860,
          range: 560,
          color: "#facc15"
        });
        fireProjectileAtAngle(game, base, 14, {
          radius: 10,
          drawSize: 16,
          damage: 16 * basicAttackDamageMultiplier(game),
          speed: 840,
          range: 560,
          color: "#fde047"
        });
      }
    }
  ][step];

  beginAction(game, {
    duration: variants.duration,
    triggerTime: variants.triggerTime,
    animationKey: variants.animationKey,
    facing: facingFromDir(base.dir),
    moveMultiplier: combat.moveMultiplier,
    onTrigger: variants.cast
  });
}

function attackBladeBlast(game) {
  const state = game.combat.weaponArtRuntime;
  const step = comboIndex(state, 3, game.heroDef.combat.comboReset);
  const combo = [
    { animationKey: "attack", duration: 0.4, triggerTime: 0.18, damage: 30, range: 80, arcDeg: 105, blastDamage: 0, heal: 2 },
    { animationKey: "attack2", duration: 0.42, triggerTime: 0.2, damage: 36, range: 88, arcDeg: 100, blastDamage: 0, heal: 3 },
    { animationKey: "attack3", duration: 0.52, triggerTime: 0.24, damage: 42, range: 96, arcDeg: 110, blastDamage: 20, heal: 4 }
  ][step];
  const base = aimDirection(game);
  beginAction(game, {
    duration: combo.duration,
    triggerTime: combo.triggerTime,
    animationKey: combo.animationKey,
    facing: facingFromDir(base.dir),
    moveMultiplier: game.heroDef.combat.moveMultiplier,
    onTrigger: () => {
      const { hits } = meleeHit(game, combo);
      let landed = 0;
      for (const enemy of hits) {
        game.damageEnemy(enemy, combo.damage * basicAttackDamageMultiplier(game), { source: "basic", isDirect: true });
        landed += 1;
      }
      damageBreakablesInCone(game, base.origin, base.dir, combo.range, combo.arcDeg, combo.damage * basicAttackDamageMultiplier(game));
      if (landed > 0 && game.heroDef.id === "death_knight") {
        healPlayer(game, combo.heal * landed);
      }
      if (combo.blastDamage > 0) {
        fireProjectileAtAngle(game, base, 0, {
          radius: 14,
          drawSize: 24,
          damage: combo.blastDamage * basicAttackDamageMultiplier(game),
          speed: 540,
          range: 280,
          color: "#7c3aed"
        });
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
    { animationKey: "attack", duration: 0.38, triggerTime: 0.17, damage: 34, range: 76, arcDeg: 100, projectileClear: false },
    { animationKey: "attack2", duration: 0.42, triggerTime: 0.2, damage: 42, range: 86, arcDeg: 95, projectileClear: false },
    { animationKey: "attack3", duration: 0.48, triggerTime: 0.26, damage: 52, range: 98, arcDeg: 105, projectileClear: true }
  ][step];
  const base = aimDirection(game);
  beginAction(game, {
    duration: combo.duration,
    triggerTime: combo.triggerTime,
    animationKey: combo.animationKey,
    facing: facingFromDir(base.dir),
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
  const base = aimDirection(game);
  const combat = game.heroDef.combat;
  beginAction(game, {
    duration: combat.actionDuration,
    triggerTime: combat.triggerTime,
    animationKey: combat.animationKey,
    facing: facingFromDir(base.dir),
    moveMultiplier: combat.moveMultiplier,
    onTrigger: () => {
      game.combat.weaponArtRuntime.activeBeam = {
        originX: base.origin.x,
        originY: base.origin.y,
        dirX: base.dir.x,
        dirY: base.dir.y,
        range: combat.range,
        width: combat.beamWidth,
        damage: combat.damage * basicAttackDamageMultiplier(game),
        duration: combat.activeDuration,
        tickInterval: combat.tickInterval,
        elapsed: 0,
        tickTimer: 0,
        source: "basic"
      };
      if (!game.combat.weaponArtRuntime.soulSiphonSpirit && game.combat.weaponArtRuntime.soulCount >= 10) {
        game.combat.weaponArtRuntime.soulCount -= 10;
        game.combat.weaponArtRuntime.soulSiphonSpirit = summonSoulSiphonSpirit(game, base.origin, base.dir);
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
  const base = aimDirection(game);
  const momentum = game.combat.weaponArtRuntime.windMomentum;
  const stage = momentum >= 2.2 ? 3 : momentum >= 1 ? 2 : 1;
  const spread = stage === 3 ? [-12, 0, 12] : stage === 2 ? [-6, 0, 6] : [0];
  const damage = stage === 3 ? 18 : stage === 2 ? 15 : 12;
  beginAction(game, {
    duration: 0.24,
    triggerTime: 0.1,
    animationKey: stage === 3 ? "attack3" : stage === 2 ? "attack2" : "attack",
    facing: facingFromDir(base.dir),
    moveMultiplier: game.heroDef.combat.moveMultiplier,
    onTrigger: () => {
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
  const base = aimDirection(game);
  const damage = 22 * basicAttackDamageMultiplier(game);
  beginAction(game, {
    duration: 0.34,
    triggerTime: 0.14,
    animationKey: "attack",
    facing: facingFromDir(base.dir),
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
  const base = aimDirection(game);
  beginAction(game, {
    duration: 0.44,
    triggerTime: 0.16,
    animationKey: "cast",
    facing: facingFromDir(base.dir),
    moveMultiplier: 0.58,
    onTrigger: () => {
      fireProjectileAtAngle(game, base, 0, {
        radius: 16,
        drawSize: 28,
        damage: 30 * basicAttackDamageMultiplier(game),
        speed: 520,
        range: 420,
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
  const base = aimDirection(game);
  beginAction(game, {
    duration: 0.42,
    triggerTime: 0.16,
    animationKey: "cast",
    facing: facingFromDir(base.dir),
    moveMultiplier: 0.46,
    onTrigger: () => {
      fireProjectileAtAngle(game, base, 0, {
        radius: 12,
        drawSize: 42,
        damage: 28 * basicAttackDamageMultiplier(game),
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
  const base = aimDirection(game);
  beginAction(game, {
    duration: 0.42,
    triggerTime: 0.15,
    animationKey: "cast",
    facing: facingFromDir(base.dir),
    moveMultiplier: 0.52,
    onTrigger: () => {
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
  const base = aimDirection(game);
  beginAction(game, {
    duration: 0.3,
    triggerTime: 0.11,
    animationKey: "attack2",
    facing: facingFromDir(base.dir),
    moveMultiplier: 0.74,
    onTrigger: () => {
      fireProjectileAtAngle(game, base, 0, {
        radius: 10,
        drawSize: 28,
        damage: 24 * basicAttackDamageMultiplier(game),
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
  beam.tickTimer -= dt;
  const origin = resolveHeroProjectileOrigin(game.player, game.heroDef, { x: beam.dirX, y: beam.dirY });
  beam.originX = origin.x;
  beam.originY = origin.y;
  const endX = origin.x + beam.dirX * beam.range;
  const endY = origin.y + beam.dirY * beam.range;
  game.combat.playerBeam = {
    x1: origin.x,
    y1: origin.y,
    x2: endX,
    y2: endY,
    width: beam.width,
    color: "#a855f7"
  };

  if (beam.tickTimer <= 0) {
    beam.tickTimer += beam.tickInterval;
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      const center = centerOf(enemy);
      const radius = (enemy.collisionRadius ?? 0.32) * enemy.w;
      const dist = pointSegmentDistance(center.x, center.y, origin.x, origin.y, endX, endY);
      if (dist > beam.width * 0.5 + radius) continue;
      const wasDead = enemy.dead;
      game.damageEnemy(enemy, beam.damage, { source: beam.source || "basic", isDirect: true });
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
      const dist = pointSegmentDistance(spirit.x, spirit.y, origin.x, origin.y, endX, endY);
      if (dist <= beam.width * 0.5 + 10) {
        spirit.charge = Math.min(spirit.maxCharge, spirit.charge + 1);
      }
    }
    damageBreakablesAlongSegment(game, origin.x, origin.y, endX, endY, beam.width, beam.damage);
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
      state.spiritAutoFireCooldown = 0.5;
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
    elementCycle: 0,
    windMomentum: 0,
    soulCount: 0,
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
