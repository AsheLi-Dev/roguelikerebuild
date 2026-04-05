import { centerOf, clamp, distance, normalize, resolveHeroProjectileOrigin, syncProjectileRangeToSpeed } from "../core/runtime-utils.js";
import { damageBreakablesAlongSegment, damageBreakablesInCone, damageBreakablesInRadius } from "./breakables.js";
import { hitDevilMerchantInCone } from "./devil-merchant.js";
import { getPlayerBasicAttackDamage, getPlayerCritDamage, getPlayerStat } from "./player-stats.js";
import { getCurrentAttackRate } from "./rings.js";
import { applyStatusPayload, consumeEntityBurnStacks } from "./status-manager.js";

const ELEMENT_MAGE_ICE_PROJECTILE_CLASS = "elementMageIceProjectile";
const ELEMENT_MAGE_ICE_SPLIT_PROJECTILE_CLASS = "elementMageIceSplitProjectile";
const ELEMENT_MAGE_LIGHTNING_ORB_PROJECTILE_CLASS = "elementMageLightningOrb";
const ELEMENT_MAGE_ICE_PROJECTILE_ART = Object.freeze({
  spriteAsset: "elementMageIceProjectile",
  spriteFrames: 8,
  spriteFrameWidth: 256,
  spriteFrameHeight: 256,
  spriteCropWidth: 88,
  spriteCropHeight: 64,
  spriteFps: 16
});
const ELEMENT_MAGE_ICE_IMPACT_ART = Object.freeze({
  impactSprite: "elementMageIceImpactVfx",
  impactFrames: 11,
  impactFrameWidth: 256,
  impactFrameHeight: 256,
  impactFps: 18,
  impactSize: 64
});
const ELEMENT_MAGE_LIGHTNING_PROJECTILE_ART = Object.freeze({
  spriteAsset: "elementMageLightningProjectile",
  spriteFrames: 16,
  spriteFrameWidth: 64,
  spriteFrameHeight: 64,
  spriteCropWidth: 52,
  spriteCropHeight: 52,
  spriteFps: 20
});
const ELEMENT_MAGE_LIGHTNING_IMPACT_ART = Object.freeze({
  impactSprite: "elementMageLightningImpactVfx",
  impactFrames: 7,
  impactFrameWidth: 128,
  impactFrameHeight: 128,
  impactFps: 18,
  impactSize: 72
});
const SOUL_SIPHON_THIRD_CAST_SHAKE_MAGNITUDE = 8;
const SOUL_SIPHON_THIRD_CAST_SHAKE_DURATION = 0.16;
const ELEMENT_MAGE_FIRE_LIGHTNING_SHAKE_MAGNITUDE = 7;
const ELEMENT_MAGE_FIRE_LIGHTNING_SHAKE_DURATION = 0.18;
const ELEMENT_MAGE_FIRE_BREATH_RANGE = 130;
const ELEMENT_MAGE_FIRE_BREATH_ARC_DEG = 50;
const ELEMENT_MAGE_FIRE_BREATH_VFX_RANGE = 100;
const ELEMENT_MAGE_FIRE_BREATH_VFX_ARC_DEG = 30;
const ELEMENT_MAGE_FIRE_BREATH_DURATION = 0.32;
const ELEMENT_MAGE_FIRE_BREATH_FORWARD_OFFSET = 8;
const ELEMENT_MAGE_SMOKE_BLAST_RADIUS = 76;
const LIGHTNING_SPARK_AFTERIMAGE_DURATION = 0.34;
const ELEMENT_PROJECTILE_AFTERIMAGE_DURATION = 0.24;
// Keep element hit audio keyed per element so ice/lightning can slot in without changing combat plumbing.
const ELEMENT_MAGE_PROJECTILE_HIT_AUDIO_PRESETS = Object.freeze({
  fire: "elementMageFireProjectile",
  ice: "elementMageIceProjectile",
  windVolley: "windVolley"
});
const ELEMENT_MAGE_FIRE_HIT_META = Object.freeze({
  enemyHitAudioPreset: ELEMENT_MAGE_PROJECTILE_HIT_AUDIO_PRESETS.fire
});
const ELEMENT_MAGE_ICE_HIT_META = Object.freeze({
  enemyHitAudioPreset: ELEMENT_MAGE_PROJECTILE_HIT_AUDIO_PRESETS.ice
});
const WIND_VOLLEY_HIT_META = Object.freeze({
  enemyHitAudioPreset: ELEMENT_MAGE_PROJECTILE_HIT_AUDIO_PRESETS.windVolley
});
const DARK_CHAIN_OVERHEAD_ZONE_ANIMATION = Object.freeze({
  drawWidth: 156,
  drawHeight: 156,
  phaseOrder: ["start", "idle", "death"],
  phases: Object.freeze({
    start: Object.freeze({
      spriteAsset: "darkChainOverheadStartVfx",
      frameWidth: 96,
      frameHeight: 112,
      frames: 25,
      fps: 36,
      loop: false,
      nextPhase: "idle"
    }),
    idle: Object.freeze({
      spriteAsset: "darkChainOverheadIdleVfx",
      frameWidth: 96,
      frameHeight: 112,
      frames: 7,
      fps: 14,
      loop: true,
      nextPhase: "idle"
    }),
    death: Object.freeze({
      spriteAsset: "darkChainOverheadDeathVfx",
      frameWidth: 96,
      frameHeight: 112,
      frames: 5,
      fps: 18,
      loop: false,
      nextPhase: null
    })
  })
});
const DARK_CHAIN_OVERHEAD_START_DURATION =
  DARK_CHAIN_OVERHEAD_ZONE_ANIMATION.phases.start.frames / DARK_CHAIN_OVERHEAD_ZONE_ANIMATION.phases.start.fps;
const SOUL_SIPHON_ASSIST_EXECUTE_HP_RATIO = 0.1;
const SOUL_SIPHON_ASSIST_EXECUTE_BURST = Object.freeze({
  radius: 78,
  duration: 0.5,
  spriteAsset: "darkExecuteVfx",
  spriteFrames: 10,
  drawWidth: 111,
  drawHeight: 186,
  pivotY: 0.5,
  alpha: 0.95,
  color: "#c084fc"
});

function playAudioClone(audio, options = {}) {
  if (!audio) return;
  const instance = audio.cloneNode();
  instance.volume = options.volume ?? audio.volume;
  instance.playbackRate = options.playbackRate ?? 1;
  if (Number.isFinite(options.currentTime) && options.currentTime > 0) {
    instance.currentTime = options.currentTime;
  }
  instance.play().catch(() => {});
}

function playAttackSfx(audio, options = {}) {
  if (!audio) return;
  const baseVolume = audio.volume || options.baseVolume || 0.2;
  const volumeMin = options.volumeMin ?? 0.84;
  const volumeMax = options.volumeMax ?? 1.16;
  const pitchMin = options.pitchMin ?? 0.9;
  const pitchMax = options.pitchMax ?? 1.12;
  playAudioClone(audio, {
    volume: Math.min(1, baseVolume * (volumeMin + Math.random() * Math.max(0, volumeMax - volumeMin))),
    playbackRate: pitchMin + Math.random() * Math.max(0, pitchMax - pitchMin)
  });
}

function playElementMageAttackAudio(game, assetKey = "elementMageAttackSfx") {
  const attackSfx = game.assets?.[assetKey];
  if (!attackSfx) return;
  playAttackSfx(attackSfx);
}

function playDarkMageAttackAudio(game) {
  const attackSfx = game.assets?.darkMageAttackSfx;
  if (!attackSfx) return;
  playAttackSfx(attackSfx);
}

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

function aimDirectionAtPoint(game, target) {
  const center = centerOf(game.player);
  const baseDir = normalize(target.x - center.x, target.y - center.y, { x: 1, y: 0 });
  const origin = resolveHeroProjectileOrigin(game.player, game.heroDef, baseDir);
  const dir = normalize(target.x - origin.x, target.y - origin.y, baseDir);
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

function applyElementMageIceSlow(enemy) {
  applyStatusPayload(enemy, { slowDuration: 3, slowMult: 0.8 });
}

function applyElementMageBlind(enemy, duration = 2) {
  applyStatusPayload(enemy, { blindDuration: duration });
}

function applyElementMageFireBurn(game, enemy) {
  applyEnemyBurn(enemy, {
    stacks: 1,
    duration: 3,
    tickInterval: 0.5,
    damagePerSecond: basicAttackDamageMultiplier(game) * 0.1
  });
}

function applyEnemyBurn(enemy, config = {}) {
  applyStatusPayload(enemy, {
    burnStacks: config.stacks ?? 1,
    burnDuration: config.duration ?? 3,
    burnTickInterval: Math.max(0.05, config.tickInterval ?? 1),
    burnDamagePerSecond: config.damagePerSecond ?? config.damagePerStack ?? 1
  });
}

function rotateDir(dir, angleDeg) {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: dir.x * cos - dir.y * sin,
    y: dir.x * sin + dir.y * cos
  };
}

function applyLightningSparkDirection(projectile) {
  const dir = rotateDir(
    { x: projectile.zigZagBaseDirX || 1, y: projectile.zigZagBaseDirY || 0 },
    (projectile.zigZagSign || 1) * (projectile.zigZagAngleDeg || 28)
  );
  projectile.vx = dir.x * projectile.speed;
  projectile.vy = dir.y * projectile.speed;
}

function rollLightningSparkSegment(projectile) {
  projectile.zigZagAngleDeg = (projectile.zigZagAngleMin ?? 24) + Math.random() * (projectile.zigZagAngleRange ?? 16);
  projectile.zigZagInterval = (projectile.zigZagIntervalMin ?? 0.05) + Math.random() * (projectile.zigZagIntervalRange ?? 0.02);
}

function pushLightningSparkAfterimage(game, projectile) {
  game.combat.weaponArtRuntime.sparkAfterimages.push({
    x: projectile.x,
    y: projectile.y,
    angle: Math.atan2(projectile.vy, projectile.vx),
    size: projectile.drawSize || Math.max(12, projectile.radius * 2),
    elapsed: 0,
    duration: LIGHTNING_SPARK_AFTERIMAGE_DURATION
  });
}

function pushElementProjectileAfterimage(game, projectile) {
  game.combat.weaponArtRuntime.elementProjectileAfterimages.push({
    x: projectile.x,
    y: projectile.y,
    vx: projectile.vx,
    vy: projectile.vy,
    radius: projectile.radius,
    drawSize: projectile.drawSize,
    age: projectile.age || 0,
    spriteAsset: projectile.spriteAsset ?? null,
    spriteFrames: projectile.spriteFrames ?? null,
    spriteFrameWidth: projectile.spriteFrameWidth ?? null,
    spriteFrameHeight: projectile.spriteFrameHeight ?? null,
    spriteFps: projectile.spriteFps ?? null,
    spriteLoopStart: projectile.spriteLoopStart ?? null,
    spriteLoopEnd: projectile.spriteLoopEnd ?? null,
    spriteCropWidth: projectile.spriteCropWidth ?? null,
    spriteCropHeight: projectile.spriteCropHeight ?? null,
    spriteDrawWidth: projectile.spriteDrawWidth ?? null,
    spriteDrawHeight: projectile.spriteDrawHeight ?? null,
    spriteEndStart: projectile.spriteEndStart ?? null,
    spriteEndFrames: projectile.spriteEndFrames ?? null,
    spriteEndDistance: projectile.spriteEndDistance ?? null,
    elapsed: 0,
    duration: projectile.afterimageDuration ?? ELEMENT_PROJECTILE_AFTERIMAGE_DURATION,
    alpha: projectile.afterimageAlpha ?? 0.16
  });
}

function updateElementProjectileAfterimage(game, projectile, dt) {
  projectile.afterimageTimer = (projectile.afterimageTimer ?? projectile.afterimageInterval ?? 0.08) - dt;
  while (projectile.afterimageTimer <= 0) {
    projectile.afterimageTimer += projectile.afterimageInterval ?? 0.08;
    pushElementProjectileAfterimage(game, projectile);
  }
}

function updateLightningSparkProjectile(game, projectile, dt) {
  projectile.afterimageTimer = (projectile.afterimageTimer ?? projectile.afterimageInterval ?? 0.035) - dt;
  while (projectile.afterimageTimer <= 0) {
    projectile.afterimageTimer += projectile.afterimageInterval ?? 0.035;
    pushLightningSparkAfterimage(game, projectile);
  }
  projectile.zigZagTimer = (projectile.zigZagTimer ?? projectile.zigZagInterval ?? 0.06) - dt;
  while (projectile.zigZagTimer <= 0) {
    projectile.zigZagSign = (projectile.zigZagSign || 1) * -1;
    rollLightningSparkSegment(projectile);
    projectile.zigZagTimer += projectile.zigZagInterval ?? 0.06;
    applyLightningSparkDirection(projectile);
  }
}

function circleIntersectsCone(x, y, radius, origin, dir, range, arcDeg) {
  const dist = distance(origin.x, origin.y, x, y);
  if (dist > range + radius) return false;
  if (dist <= radius) return true;
  const delta = normalize(x - origin.x, y - origin.y, dir);
  const cosArc = Math.cos((arcDeg * Math.PI) / 360);
  return directionDot(dir, delta) >= cosArc;
}

function spawnElementMageFireBreathVfx(game, origin, dir) {
  const halfWidth = Math.tan((ELEMENT_MAGE_FIRE_BREATH_VFX_ARC_DEG * Math.PI) / 360) * ELEMENT_MAGE_FIRE_BREATH_VFX_RANGE;
  spawnAssistBurst(game, {
    x: origin.x + dir.x * ELEMENT_MAGE_FIRE_BREATH_FORWARD_OFFSET,
    y: origin.y + dir.y * ELEMENT_MAGE_FIRE_BREATH_FORWARD_OFFSET,
    radius: ELEMENT_MAGE_FIRE_BREATH_VFX_RANGE * 0.5,
    duration: ELEMENT_MAGE_FIRE_BREATH_DURATION,
    spriteAsset: "elementMageFireBreathVfx",
    spriteFrames: 16,
    drawWidth: ELEMENT_MAGE_FIRE_BREATH_VFX_RANGE,
    drawHeight: halfWidth * 2,
    angle: Math.atan2(dir.y, dir.x),
    pivotX: 0,
    pivotY: 0.5,
    color: "#fb923c"
  });
}

function spawnLightningSpark(game, x, y, options = {}) {
  const baseDir = options.dir
    ? normalize(options.dir.x, options.dir.y, { x: 1, y: 0 })
    : (() => {
        const angle = Math.random() * Math.PI * 2;
        return { x: Math.cos(angle), y: Math.sin(angle) };
      })();
  const spark = spawnProjectile(game, {
    x,
    y,
    radius: 4,
    drawSize: 14,
    damage: Math.max(1, basicAttackDamageMultiplier(game) * (options.damageScale ?? 0.25)),
    speed: 1400,
    vx: baseDir.x * 1400,
    vy: baseDir.y * 1400,
    maxRange: options.maxRange ?? 260,
    color: "#fef08a",
    source: "spark",
    isDirect: false,
    onHitEnemy: options.applyBurnOnHit
      ? (runtimeGame, enemy) => {
          applyElementMageFireBurn(runtimeGame, enemy);
        }
      : null,
    projectileClass: "lightningSpark"
  });
  spark.zigZagBaseDirX = baseDir.x;
  spark.zigZagBaseDirY = baseDir.y;
  spark.zigZagAngleMin = 24;
  spark.zigZagAngleRange = 16;
  spark.zigZagIntervalMin = 0.05;
  spark.zigZagIntervalRange = 0.02;
  spark.zigZagSign = Math.random() < 0.5 ? -1 : 1;
  rollLightningSparkSegment(spark);
  spark.zigZagTimer = spark.zigZagInterval;
  spark.afterimageInterval = options.afterimageInterval ?? 0.035;
  spark.afterimageTimer = 0;
  spark.onUpdate = updateLightningSparkProjectile;
  applyLightningSparkDirection(spark);
  return spark;
}

function updateLightningOrbProjectile(game, projectile, dt) {
  projectile.sparkCooldown = (projectile.sparkCooldown ?? 1) - dt;
  while (projectile.sparkCooldown <= 0) {
    projectile.sparkCooldown += 1;
    spawnLightningSpark(game, projectile.x, projectile.y);
  }
}

function triggerElementMageFireLightningDetonation(game, orbProjectile, source) {
  const x = orbProjectile?.x ?? source?.x ?? 0;
  const y = orbProjectile?.y ?? source?.y ?? 0;
  const radius = 96;
  const damage = orbProjectile?.damage ?? basicAttackDamageMultiplier(game);
  if (game.assets?.elementMageFireLightningDetonationSfx) {
    playAudioClone(game.assets.elementMageFireLightningDetonationSfx, {
      volume: game.assets.elementMageFireLightningDetonationSfx.volume,
      playbackRate: 0.98 + (Math.random() * 0.08 - 0.04)
    });
  }
  spawnAssistBurst(game, {
    x,
    y,
    radius,
    duration: 0.36,
    spriteAsset: "elementMageLightningImpactVfx",
    color: "#fb923c"
  });
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const enemyCenter = centerOf(enemy);
    const enemyRadius = enemy.w * (enemy.collisionRadius ?? 0.32);
    if (distance(x, y, enemyCenter.x, enemyCenter.y) > radius + enemyRadius) continue;
    const hit = game.damageEnemy(enemy, damage, { source: "skill", isDirect: false });
    if (!hit.hit) continue;
    applyElementMageFireBurn(game, enemy);
  }
  damageBreakablesInRadius(game, x, y, radius, damage);
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    spawnLightningSpark(game, x, y, {
      dir: { x: Math.cos(angle), y: Math.sin(angle) },
      applyBurnOnHit: true
    });
  }
}

function triggerElementMageSmokeExplosion(game, x, y) {
  const damage = basicAttackDamageMultiplier(game) * 0.5;
  spawnAssistBurst(game, {
    x,
    y,
    radius: ELEMENT_MAGE_SMOKE_BLAST_RADIUS,
    duration: 0.34,
    spriteAsset: "smokeExplosionVfx",
    color: "#d1d5db"
  });
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const enemyCenter = centerOf(enemy);
    const enemyRadius = enemy.w * (enemy.collisionRadius ?? 0.32);
    if (distance(x, y, enemyCenter.x, enemyCenter.y) > ELEMENT_MAGE_SMOKE_BLAST_RADIUS + enemyRadius) continue;
    const hit = game.damageEnemy(enemy, damage, { source: "skill", isDirect: false });
    if (!hit.hit) continue;
    applyElementMageBlind(enemy, 2);
  }
}

function handleElementMageIceHit(game, enemy) {
  applyElementMageIceSlow(enemy);
  if (consumeEntityBurnStacks(enemy, 1) <= 0) return;
  const center = centerOf(enemy);
  triggerElementMageSmokeExplosion(game, center.x, center.y);
}

function detonateLightningOrbsInCone(game, origin, dir, range, arcDeg) {
  let detonatedAny = false;
  for (const projectile of game.combat.playerProjectiles || []) {
    if (projectile._destroyed) continue;
    if (projectile.projectileClass !== ELEMENT_MAGE_LIGHTNING_ORB_PROJECTILE_CLASS) continue;
    if (!circleIntersectsCone(projectile.x, projectile.y, projectile.radius || 0, origin, dir, range, arcDeg)) continue;
    triggerElementMageFireLightningDetonation(game, projectile, origin);
    projectile._destroyed = true;
    detonatedAny = true;
  }
  if (detonatedAny) {
    game.camera?.triggerShake?.(
      ELEMENT_MAGE_FIRE_LIGHTNING_SHAKE_MAGNITUDE,
      ELEMENT_MAGE_FIRE_LIGHTNING_SHAKE_DURATION
    );
  }
}

function triggerElementMageFireBreath(game) {
  const damage = basicAttackDamageMultiplier(game);
  const { hits, origin, dir } = meleeHit(game, {
    range: ELEMENT_MAGE_FIRE_BREATH_RANGE,
    arcDeg: ELEMENT_MAGE_FIRE_BREATH_ARC_DEG
  });
  spawnElementMageFireBreathVfx(game, origin, dir);
  for (const enemy of hits) {
    const hit = game.damageEnemy(enemy, damage, {
      source: "basic",
      isDirect: true,
      ...ELEMENT_MAGE_FIRE_HIT_META
    });
    if (!hit.hit) continue;
    applyElementMageFireBurn(game, enemy);
  }
  damageBreakablesInCone(game, origin, dir, ELEMENT_MAGE_FIRE_BREATH_RANGE, ELEMENT_MAGE_FIRE_BREATH_ARC_DEG, damage);
  detonateLightningOrbsInCone(game, origin, dir, ELEMENT_MAGE_FIRE_BREATH_RANGE, ELEMENT_MAGE_FIRE_BREATH_ARC_DEG);
}

function spawnElementMageIceSplitProjectile(game, x, y, dir) {
  return spawnProjectile(game, {
    x,
    y,
    radius: 7,
    drawSize: 20,
    damage: basicAttackDamageMultiplier(game) * 0.5,
    speed: 840,
    vx: dir.x * 840,
    vy: dir.y * 840,
    maxRange: 240,
    color: "#bfdbfe",
    projectileClass: ELEMENT_MAGE_ICE_SPLIT_PROJECTILE_CLASS,
    hitMeta: ELEMENT_MAGE_ICE_HIT_META,
    onHitEnemy: (runtimeGame, enemy) => {
      handleElementMageIceHit(runtimeGame, enemy);
    },
    onUpdate: updateElementProjectileAfterimage,
    afterimageInterval: 0.07,
    afterimageDuration: 0.24,
    afterimageAlpha: 0.14,
    ...ELEMENT_MAGE_ICE_PROJECTILE_ART,
    ...ELEMENT_MAGE_ICE_IMPACT_ART
  });
}

export function handleWeaponArtPlayerProjectileCollision(game, projectile, otherProjectile) {
  if (
    projectile?.projectileClass !== ELEMENT_MAGE_ICE_PROJECTILE_CLASS ||
    otherProjectile?.projectileClass !== ELEMENT_MAGE_LIGHTNING_ORB_PROJECTILE_CLASS
  ) {
    return false;
  }
  const originX = (projectile.x + otherProjectile.x) * 0.5;
  const originY = (projectile.y + otherProjectile.y) * 0.5;
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    spawnElementMageIceSplitProjectile(game, originX, originY, {
      x: Math.cos(angle),
      y: Math.sin(angle)
    });
  }
  return true;
}

function spawnProjectile(game, config) {
  const projectile = {
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
    spriteCropWidth: config.spriteCropWidth ?? null,
    spriteCropHeight: config.spriteCropHeight ?? null,
    spriteDrawWidth: config.spriteDrawWidth ?? null,
    spriteDrawHeight: config.spriteDrawHeight ?? null,
    spriteEndStart: config.spriteEndStart ?? null,
    spriteEndFrames: config.spriteEndFrames ?? null,
    spriteEndDistance: config.spriteEndDistance ?? null,
    impactSprite: config.impactSprite ?? null,
    impactFrames: config.impactFrames ?? null,
    impactFrameWidth: config.impactFrameWidth ?? null,
    impactFrameHeight: config.impactFrameHeight ?? null,
    impactFps: config.impactFps ?? null,
    impactSize: config.impactSize ?? null,
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
    projectileClass: config.projectileClass ?? null,
    sharedTargetHits: config.sharedTargetHits ?? null,
    repeatHitDamageMultiplier: config.repeatHitDamageMultiplier ?? null,
    onUpdate: config.onUpdate ?? null,
    baseSpeed: config.baseSpeed ?? config.speed,
    baseMaxRange: config.baseMaxRange ?? config.maxRange,
    afterimageInterval: config.afterimageInterval ?? null,
    afterimageDuration: config.afterimageDuration ?? null,
    afterimageAlpha: config.afterimageAlpha ?? null
  };
  syncProjectileRangeToSpeed(projectile);
  game.combat.playerProjectiles.push(projectile);
  return projectile;
}

function fireProjectileAtAngle(game, base, angleOffsetDeg, extra = {}) {
  const angle = Math.atan2(base.dir.y, base.dir.x) + (angleOffsetDeg * Math.PI) / 180;
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  return spawnProjectile(game, {
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
    spriteCropWidth: extra.spriteCropWidth,
    spriteCropHeight: extra.spriteCropHeight,
    spriteDrawWidth: extra.spriteDrawWidth,
    spriteDrawHeight: extra.spriteDrawHeight,
    spriteEndStart: extra.spriteEndStart,
    spriteEndFrames: extra.spriteEndFrames,
    spriteEndDistance: extra.spriteEndDistance,
    impactSprite: extra.impactSprite,
    impactFrames: extra.impactFrames,
    impactFrameWidth: extra.impactFrameWidth,
    impactFrameHeight: extra.impactFrameHeight,
    impactFps: extra.impactFps,
    impactSize: extra.impactSize,
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
    projectileClass: extra.projectileClass,
    sharedTargetHits: extra.sharedTargetHits,
    repeatHitDamageMultiplier: extra.repeatHitDamageMultiplier,
    onUpdate: extra.onUpdate,
    afterimageInterval: extra.afterimageInterval,
    afterimageDuration: extra.afterimageDuration,
    afterimageAlpha: extra.afterimageAlpha
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
  hitDevilMerchantInCone(game, origin, dir, range, options.arcDeg ?? 90);
  return { hits, origin, dir };
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

  const mod = game.heroModState?.dk_piercing_stance;
  let drawWidth = 168;
  let drawHeight = 168;

  if (mod?.active) {
    drawWidth *= (mod.rangeMultiplier || 1.35); // Stretch forward (thrust)
    drawHeight *= (mod.widthMultiplier || 0.5); // Squeeze side-to-side (arc)
  }

  game.combat.impactVfx.push({
    x: origin.x + dir.x * (combo.range * 0.42),
    y: origin.y + dir.y * (combo.range * 0.24),
    sprite: "deathKnightSwordSlashVfx",
    frames: 6,
    frameWidth: 196,
    frameHeight: 196,
    fps: 20,
    size: 96,
    drawWidth: drawWidth,
    drawHeight: drawHeight,
    angle: Math.atan2(dir.y, dir.x),
    age: 0,
    currentFrame: 0
  });
}

function beginAction(game, config) {
  const hitboxTrigger = Number.isFinite(config.hitboxTrigger)
    ? Math.max(0, Math.floor(config.hitboxTrigger))
    : getDefaultPlayerHitboxTrigger(config.animationKey);
  const direction = config.direction
    ? normalize(config.direction.x, config.direction.y, { x: 1, y: 0 })
    : null;
  game.combat.playerAction = {
    kind: config.kind ?? "attack",
    elapsed: 0,
    duration: config.duration,
    triggerTime: config.triggerTime,
    hitboxTrigger,
    hitFrames: Array.isArray(config.hitFrames) ? config.hitFrames.map((frame) => Math.max(0, Math.floor(frame))) : null,
    firedFrames: new Set(),
    triggered: false,
    animationKey: config.animationKey,
    facing: config.facing,
    direction,
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

function deathKnightComboResetTime(game) {
  return 1.1 / getCurrentAttackRate(game);
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
  if (!state || game?.weaponArt?.id !== "soulSiphon") return;
  
  const mod = game.heroModState?.necro_twin_spirits;
  const desiredSpiritCount = mod?.active ? (mod.spiritCount || 2) : 1;
  const currentSpiritsCount = Array.isArray(state.soulSiphonSpirit) ? state.soulSiphonSpirit.length : (state.soulSiphonSpirit ? 1 : 0);

  if (currentSpiritsCount >= desiredSpiritCount) return;

  const playerCenter = centerOf(game.player);

  if (desiredSpiritCount > 1) {
    if (!Array.isArray(state.soulSiphonSpirit)) {
      state.soulSiphonSpirit = state.soulSiphonSpirit ? [state.soulSiphonSpirit] : [];
    }
    while (state.soulSiphonSpirit.length < desiredSpiritCount) {
      state.soulSiphonSpirit.push(summonSoulSiphonSpirit(game, playerCenter, { x: 1, y: 0 }));
    }
  } else if (!state.soulSiphonSpirit) {
    state.soulSiphonSpirit = summonSoulSiphonSpirit(game, playerCenter, { x: 1, y: 0 });
  }
}

function fireSoulSiphonSpiritProjectile(game, spirit, target) {
  if (!spirit || !target) return false;
  const center = centerOf(target);
  const dir = normalize(center.x - spirit.x, center.y - spirit.y, { x: 1, y: 0 });
  
  const mod = game.heroModState?.necro_twin_spirits;
  const damageMult = mod?.active ? (mod.perSpiritDamageMultiplier || 0.7) : 1.0;

  spawnProjectile(game, {
    x: spirit.x,
    y: spirit.y,
    radius: 12,
    drawSize: 22,
    damage: basicAttackDamageMultiplier(game) * damageMult,
    speed: 620,
    vx: dir.x * 620,
    vy: dir.y * 620,
    maxRange: 420,
    color: "#c084fc",
    pierce: 1,
    hitMeta: {
      suppressHitReaction: true
    }
  });
  spirit.attackTimer = 0.32;
  return true;
}

function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const lengthSq = abx * abx + aby * aby || 1;
  const t = clamp((apx * abx + apy * aby) / lengthSq, 0, 1);
  const closestX = ax + abx * t;
  const closestY = ay + aby * t;
  return distance(px, py, closestX, closestY);
}

function spawnAssistGroundZone(game, config) {
  const state = game.combat.weaponArtRuntime;
  const activeDuration = config.activeDuration ?? config.duration;
  const animation = config.animation
    ? {
        ...config.animation,
        phases: config.animation.phases ?? {},
        phaseOrder: config.animation.phaseOrder ?? Object.keys(config.animation.phases ?? {})
      }
    : null;
  const zone = {
    id: config.id ?? `assist_zone_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: config.kind ?? "assistGround",
    x: config.x,
    y: config.y,
    radius: config.radius,
    radiusY: config.radiusY ?? config.radius * 0.72,
    elapsed: 0,
    duration: activeDuration,
    totalDuration: animation
      ? activeDuration + getAssistGroundZoneAnimationPhaseDuration(animation, "death")
      : activeDuration,
    tickTimer: 0,
    tickInterval: config.tickInterval ?? 0.2,
    slowDuration: config.slowDuration ?? 0.28,
    slowMult: config.slowMult ?? 0.5,
    damage: config.damage ?? 0,
    color: config.color ?? "#7c3aed",
    animation,
    animationPhase: config.initialPhase ?? animation?.phaseOrder?.[0] ?? null,
    animationElapsed: 0,
    active: true
  };
  if (config.replaceExisting) {
    for (const entry of state.assistGroundZones) {
      if (entry.kind !== zone.kind || !entry.active) continue;
      entry.active = false;
      if (entry.animation?.phases?.death) {
        entry.animationPhase = "death";
        entry.animationElapsed = 0;
        entry.totalDuration = Math.max(entry.elapsed, entry.duration) + getAssistGroundZoneAnimationPhaseDuration(entry.animation, "death");
      } else {
        entry.animationPhase = null;
        entry.totalDuration = entry.elapsed;
      }
    }
  }
  state.assistGroundZones.push(zone);
  return zone;
}

function queueAssistGroundZone(game, config) {
  const state = game.combat.weaponArtRuntime;
  const pendingZone = {
    ...config,
    delay: Math.max(0, config.delay ?? 0)
  };
  if (config.replaceExisting) {
    state.pendingAssistGroundZones = state.pendingAssistGroundZones.filter((entry) => entry.kind !== pendingZone.kind);
    for (const entry of state.assistGroundZones) {
      if (entry.kind !== pendingZone.kind || !entry.active) continue;
      entry.active = false;
      if (entry.animation?.phases?.death) {
        entry.animationPhase = "death";
        entry.animationElapsed = 0;
        entry.totalDuration = Math.max(entry.elapsed, entry.duration) + getAssistGroundZoneAnimationPhaseDuration(entry.animation, "death");
      } else {
        entry.animationPhase = null;
        entry.totalDuration = entry.elapsed;
      }
    }
  }
  state.pendingAssistGroundZones.push(pendingZone);
}

function applyAssistGroundZoneSpawnHit(game, zone, damageScale = 0) {
  if (!(damageScale > 0)) return;
  const damage = basicAttackDamageMultiplier(game) * damageScale;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const center = centerOf(enemy);
    const radiusX = zone.radius + enemy.w * 0.28;
    const radiusY = zone.radiusY + enemy.h * 0.22;
    const nx = (center.x - zone.x) / Math.max(1, radiusX);
    const ny = (center.y - zone.y) / Math.max(1, radiusY);
    if (nx * nx + ny * ny > 1) continue;
    game.damageEnemy(enemy, damage, {
      source: "skill",
      isDirect: true
    });
  }
}

function shouldExecuteAssistGroundEnemy(zone, enemy) {
  return (
    zone.kind === "soulSiphonGround" &&
    enemy.hp > 0 &&
    enemy.maxHp > 0 &&
    enemy.hp / enemy.maxHp <= SOUL_SIPHON_ASSIST_EXECUTE_HP_RATIO
  );
}

function spawnSoulSiphonAssistExecuteBurst(game, zone) {
  spawnAssistBurst(game, {
    ...SOUL_SIPHON_ASSIST_EXECUTE_BURST,
    x: zone.x,
    y: zone.y
  });
}

function getAssistGroundZoneAnimationPhaseDuration(animation, phaseName) {
  const phase = animation?.phases?.[phaseName];
  if (!phase || phase.loop) return 0;
  return Math.max(0.001, (phase.frames ?? 1) / Math.max(1, phase.fps ?? 1));
}

function advanceAssistGroundZoneAnimation(zone) {
  if (!zone.animation || !zone.animationPhase) return;
  let phaseName = zone.animationPhase;
  let phase = zone.animation.phases?.[phaseName];
  if (!phase) return;
  while (phase && !phase.loop) {
    const phaseDuration = Math.max(0.001, (phase.frames ?? 1) / Math.max(1, phase.fps ?? 1));
    if (zone.animationElapsed < phaseDuration) break;
    zone.animationElapsed -= phaseDuration;
    phaseName = phase.nextPhase ?? null;
    zone.animationPhase = phaseName;
    if (!phaseName) break;
    phase = zone.animation.phases?.[phaseName];
  }
}

function spawnAssistBurst(game, config) {
  const state = game.combat.weaponArtRuntime;
  state.assistBursts.push({
    x: config.x,
    y: config.y,
    radius: config.radius,
    elapsed: 0,
    duration: config.duration ?? 0.42,
    spriteAsset: config.spriteAsset ?? null,
    spriteFrames: config.spriteFrames ?? null,
    drawWidth: config.drawWidth ?? null,
    drawHeight: config.drawHeight ?? null,
    angle: config.angle ?? null,
    pivotX: config.pivotX ?? 0.5,
    pivotY: config.pivotY ?? 0.5,
    alpha: config.alpha ?? 0.96,
    color: config.color ?? "#93c5fd"
  });
}

function attackProjectile(game) {
  const state = game.combat.weaponArtRuntime;
  const step = state.elementCycle % 3;
  state.elementCycle += 1;
  const startBase = aimDirection(game);
  const combat = game.heroDef.combat;
  const fireAnimationState = game.heroDef?.sprite?.states?.cast || null;
  const fireFrameCount = Math.max(1, fireAnimationState?.frames || 1);
  const fireHitboxTrigger = getDefaultPlayerHitboxTrigger("cast") ?? 0;
  const fireHitFrames = [...new Set([
    fireHitboxTrigger,
    Math.min(fireFrameCount - 1, fireHitboxTrigger + 1),
    Math.min(fireFrameCount - 1, fireHitboxTrigger + 2)
  ])];
  const variants = [
    {
      animationKey: "cast",
      duration: 0.42,
      triggerTime: 0.16,
      hitFrames: fireHitFrames,
      fireHitEnemies: new Set(),
      cast: () => {
        const { origin, dir } = aimDirection(game);
        spawnElementMageFireBreathVfx(game, origin, dir);
        detonateLightningOrbsInCone(game, origin, dir, ELEMENT_MAGE_FIRE_BREATH_RANGE, ELEMENT_MAGE_FIRE_BREATH_ARC_DEG);
      },
      onHitFrame() {
        const damage = basicAttackDamageMultiplier(game);
        const { hits, origin, dir } = meleeHit(game, {
          range: ELEMENT_MAGE_FIRE_BREATH_RANGE,
          arcDeg: ELEMENT_MAGE_FIRE_BREATH_ARC_DEG
        });
        for (const enemy of hits) {
          if (this.fireHitEnemies.has(enemy)) continue;
          this.fireHitEnemies.add(enemy);
          const hit = game.damageEnemy(enemy, damage, {
            source: "basic",
            isDirect: true,
            ...ELEMENT_MAGE_FIRE_HIT_META
          });
          if (!hit.hit) continue;
          applyElementMageFireBurn(game, enemy);
        }
        damageBreakablesInCone(game, origin, dir, ELEMENT_MAGE_FIRE_BREATH_RANGE, ELEMENT_MAGE_FIRE_BREATH_ARC_DEG, damage);
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
          drawSize: 30,
          damage: basicAttackDamageMultiplier(game),
          speed: 900,
          range: 640,
          color: "#60a5fa",
          pierce: 99,
          boomerang: true,
          projectileClass: ELEMENT_MAGE_ICE_PROJECTILE_CLASS,
          hitMeta: ELEMENT_MAGE_ICE_HIT_META,
          onHitEnemy: (runtimeGame, enemy) => {
            handleElementMageIceHit(runtimeGame, enemy);
          },
          onUpdate: updateElementProjectileAfterimage,
          afterimageInterval: 0.065,
          afterimageDuration: 0.26,
          afterimageAlpha: 0.16,
          ...ELEMENT_MAGE_ICE_PROJECTILE_ART,
          ...ELEMENT_MAGE_ICE_IMPACT_ART
        });
        fireProjectileAtAngle(game, base, 7, {
          radius: 12,
          drawSize: 30,
          damage: basicAttackDamageMultiplier(game),
          speed: 900,
          range: 640,
          color: "#93c5fd",
          pierce: 99,
          boomerang: true,
          projectileClass: ELEMENT_MAGE_ICE_PROJECTILE_CLASS,
          hitMeta: ELEMENT_MAGE_ICE_HIT_META,
          onHitEnemy: (runtimeGame, enemy) => {
            handleElementMageIceHit(runtimeGame, enemy);
          },
          onUpdate: updateElementProjectileAfterimage,
          afterimageInterval: 0.065,
          afterimageDuration: 0.26,
          afterimageAlpha: 0.16,
          ...ELEMENT_MAGE_ICE_PROJECTILE_ART,
          ...ELEMENT_MAGE_ICE_IMPACT_ART
        });
      }
    },
    {
      animationKey: "attack3",
      duration: 0.46,
      triggerTime: 0.18,
      cast: () => {
        const base = aimDirection(game);
        const orb = fireProjectileAtAngle(game, base, 0, {
          radius: 22,
          drawSize: 96,
          damage: basicAttackDamageMultiplier(game),
          speed: 100,
          range: 300,
          pierce: 999,
          color: "#facc15",
          projectileClass: ELEMENT_MAGE_LIGHTNING_ORB_PROJECTILE_CLASS,
          ...ELEMENT_MAGE_LIGHTNING_PROJECTILE_ART,
          ...ELEMENT_MAGE_LIGHTNING_IMPACT_ART
        });
        orb.sparkCooldown = 1;
        orb.onUpdate = updateLightningOrbProjectile;
      }
    }
  ][step];

  beginAction(game, {
    duration: variants.duration,
    triggerTime: variants.triggerTime,
    hitFrames: variants.hitFrames,
    animationKey: variants.animationKey,
    facing: facingFromDir(startBase.dir),
    direction: startBase.dir,
    moveMultiplier: combat.moveMultiplier,
    onTrigger: variants.cast,
    onHitFrame: variants.onHitFrame ? variants.onHitFrame.bind(variants) : null
  });
  if (step !== 2) {
    playElementMageAttackAudio(
      game,
      step === 1 ? "elementMageIceAttackSfx" : "elementMageAttackSfx"
    );
  }
}

function attackBladeBlast(game) {
  const state = game.combat.weaponArtRuntime;
  const step = comboIndex(state, 3, deathKnightComboResetTime(game));
  const combo = [
    { animationKey: "attack", duration: 0.4, triggerTime: 0.18, damage: 1, range: 136, arcDeg: 105, blastDamage: 0, heal: 2 },
    { animationKey: "attack2", duration: 0.42, triggerTime: 0.2, damage: 1.3, range: 150, arcDeg: 100, blastDamage: 0, heal: 3 },
    { animationKey: "attack3", duration: 0.52, triggerTime: 0.24, damage: 1.6, range: 164, arcDeg: 110, blastDamage: 1, heal: 4 }
  ][step];

  // Hero Mod: Piercing Stance
  const mod = game.heroModState?.dk_piercing_stance;
  if (mod?.active) {
    combo.range *= (mod.rangeMultiplier || 1.35);
    combo.arcDeg *= (mod.widthMultiplier || 0.5);
  }

  const startBase = aimDirection(game);
  const animationState = game.heroDef?.sprite?.states?.[combo.animationKey] || null;
  const frameCount = Math.max(1, animationState?.frames || 1);
  const hitboxTrigger = getDefaultPlayerHitboxTrigger(combo.animationKey) ?? 0;
  const hitFrames = [...new Set([
    hitboxTrigger,
    Math.min(frameCount - 1, hitboxTrigger + 1),
    Math.min(frameCount - 1, hitboxTrigger + 2)
  ])];
  const hitEnemies = new Set();
  let awardedLeadHit = false;
  const hitMeta = {
    source: "basic",
    isDirect: true,
    hitDuration: 0.18,
    staggerPause: 0.12,
    staggerDuration: 0.34,
    recoilDistance: 42,
    instantRecoil: false
  };
  beginAction(game, {
    duration: combo.duration,
    triggerTime: combo.triggerTime,
    hitFrames,
    animationKey: combo.animationKey,
    facing: facingFromDir(startBase.dir),
    direction: startBase.dir,
    moveMultiplier: game.heroDef.combat.moveMultiplier,
    onTrigger: () => {
      const base = aimDirection(game);
      spawnDeathKnightSlashVfx(game, base.origin, base.dir, combo);
      if (combo.blastDamage > 0) {
        const leadHits = Math.min(2, state.bladeBlastLeadHits || 0);
        const finisherDamageScale = 0.5 + 0.5 * leadHits;
        const finisherSizeScale = leadHits >= 2 ? 1.5 : leadHits >= 1 ? 1.2 : 1;

        let waveRadius = 50 * finisherSizeScale;
        let waveRange = 280 * finisherSizeScale;
        let waveDrawSize = 98 * finisherSizeScale;

        if (mod?.active) {
          waveRadius *= 0.5; // Narrower hitbox
          waveRange *= 1.35;  // Longer reach
          waveDrawSize *= 0.8; // Visual squeeze
        }

        fireProjectileAtAngle(game, base, 0, {
          radius: waveRadius,
          drawSize: waveDrawSize,
          damage: combo.blastDamage * basicAttackDamageMultiplier(game) * finisherDamageScale,
          speed: 540,
          range: waveRange,
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
    },
    onHitFrame: () => {
      const { hits, origin, dir } = meleeHit(game, combo);
      let landed = 0;
      for (const enemy of hits) {
        if (hitEnemies.has(enemy)) continue;
        hitEnemies.add(enemy);
        game.damageEnemy(enemy, combo.damage * basicAttackDamageMultiplier(game), hitMeta);
        landed += 1;
      }
      damageBreakablesInCone(game, origin, dir, combo.range, combo.arcDeg, combo.damage * basicAttackDamageMultiplier(game));
      if (step < 2 && !awardedLeadHit && landed > 0) {
        state.bladeBlastLeadHits = Math.min(2, (state.bladeBlastLeadHits || 0) + 1);
        awardedLeadHit = true;
      }
      if (landed > 0 && game.heroDef.id === "death_knight") {
        healPlayer(game, combo.heal * landed);
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
    direction: startBase.dir,
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
  const isEmpoweredThirdCast = animationKey === "attack3";
  const actionDuration = getActionDurationForFixedWindup(frameCount, hitboxTrigger, fixedWindupSeconds, getAnimationDuration(animationState, combat.actionDuration));
  const secondsPerFrame = actionDuration / frameCount;
  const damageDelay = hitboxTrigger * secondsPerFrame;
  const followFrames = 4;
  const beamSpriteFrames = 7;
  const followDuration = (actionDuration * followFrames) / beamSpriteFrames;
  const baseDamage = basicAttackDamageMultiplier(game) * 0.4;
  const beamDamage = isEmpoweredThirdCast ? baseDamage * 1.5 : baseDamage;
  const beamRange = isEmpoweredThirdCast ? combat.range * 1.2 : combat.range;
  beginAction(game, {
    duration: actionDuration,
    triggerTime: damageDelay,
    hitboxTrigger,
    animationKey,
    facing: facingFromDir(startBase.dir),
    direction: startBase.dir,
    moveMultiplier: combat.moveMultiplier,
    onTrigger: () => {
      const base = aimDirection(game);
      state.activeBeam = {
        originX: base.origin.x,
        originY: base.origin.y,
        dirX: base.dir.x,
        dirY: base.dir.y,
        range: beamRange,
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
        isCrit: false,
        source: "basic",
        shakeOnHit: isEmpoweredThirdCast,
        hitShakeFired: false,
        color: "#a855f7",
        spriteAsset: "darkLaserVfx",
        spriteFrames: beamSpriteFrames,
        overlaySpriteAsset: isEmpoweredThirdCast ? "arcaneDarkBeamVfx" : null,
        overlaySpriteFrames: isEmpoweredThirdCast ? 7 : 0,
        overlayColor: isEmpoweredThirdCast ? "#f5d0fe" : null,
        overlayAlpha: isEmpoweredThirdCast ? 0.8 : 0,
        overlayHeightMult: isEmpoweredThirdCast ? 0.72 : 1,
        shadowBlur: isEmpoweredThirdCast ? 18 : 12
      };
      
      const mod = game.heroModState?.necro_twin_spirits;
      const maxSpirits = mod?.active ? (mod.spiritCount || 2) : 1;
      const currentSpiritsCount = Array.isArray(state.soulSiphonSpirit) ? state.soulSiphonSpirit.length : (state.soulSiphonSpirit ? 1 : 0);

      if (currentSpiritsCount < maxSpirits && state.soulCount >= 10) {
        state.soulCount -= 10;
        const newSpirit = summonSoulSiphonSpirit(game, base.origin, base.dir);
        if (maxSpirits > 1) {
          if (!Array.isArray(state.soulSiphonSpirit)) {
            state.soulSiphonSpirit = Array.isArray(state.soulSiphonSpirit) ? state.soulSiphonSpirit : (state.soulSiphonSpirit ? [state.soulSiphonSpirit] : []);
          }
          state.soulSiphonSpirit.push(newSpirit);
        } else {
          state.soulSiphonSpirit = newSpirit;
        }
      }
    }
  });
  playDarkMageAttackAudio(game);
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
  const stage = game.isLoadoutPreview ? 3 : momentum >= 2.2 ? 3 : momentum >= 1 ? 2 : 1;
  const spread = stage === 3 ? [-12, 0, 12] : stage === 2 ? [-6, 0, 6] : [0];
  const stageDamageMultiplier = stage === 3 ? 1.5 : stage === 2 ? 1 : 0.7;
  const stagePierce = stage === 3 ? 999 : stage === 2 ? 2 : 0;
  const stageSpeed = stage === 3 ? 1400 : stage === 2 ? 1200 : 980;
  const stageSpawnSfxVolumeMult = stage === 3 ? 1.1 : stage === 2 ? 0.9 : 0.7;
  beginAction(game, {
    duration: 0.24,
    triggerTime: 0.1,
    animationKey: stage === 3 ? "attack3" : stage === 2 ? "attack2" : "attack",
    facing: facingFromDir(startBase.dir),
    direction: startBase.dir,
    moveMultiplier: game.heroDef.combat.moveMultiplier,
    onTrigger: () => {
      const base = aimDirection(game);
      const sharedTargetHits = new Map();
      const windVolleySpawnSfx = game.assets?.windVolleySpawnSfx;
      for (const angle of spread) {
        fireProjectileAtAngle(game, base, angle, {
          radius: 10,
          drawSize: 24,
          damage: stageDamageMultiplier * basicAttackDamageMultiplier(game),
          speed: stageSpeed,
          range: 720,
          color: "#a7f3d0",
          pierce: stagePierce,
          sharedTargetHits,
          repeatHitDamageMultiplier: 0.2,
          spriteAsset: "heroWindArrow",
          spriteFrames: 30,
          spriteFrameWidth: 100,
          spriteFrameHeight: 68,
          spriteDrawWidth: 24,
          spriteDrawHeight: 16,
          spriteFps: 18,
          onUpdate: updateElementProjectileAfterimage,
          afterimageInterval: 0.04,
          afterimageDuration: 0.18,
          afterimageAlpha: 0.2,
          hitMeta: WIND_VOLLEY_HIT_META
        });
        playAttackSfx(windVolleySpawnSfx, {
          volumeMin: 0.88 * stageSpawnSfxVolumeMult,
          volumeMax: 1.12 * stageSpawnSfxVolumeMult,
          pitchMin: 0.9,
          pitchMax: 1.14
        });
      }
      game.combat.weaponArtRuntime.windMomentum = Math.max(0, momentum - (stage === 3 ? 2 : stage === 2 ? 1 : 0));
    }
  });
}

function assistProjectile(game) {
  const startBase = aimDirection(game);
  const damage = basicAttackDamageMultiplier(game);
  beginAction(game, {
    kind: "assist",
    duration: 0.34,
    triggerTime: 0.14,
    animationKey: "cast",
    facing: facingFromDir(startBase.dir),
    direction: startBase.dir,
    moveMultiplier: 0.52,
    onTrigger: () => {
      const origin = centerOf(game.player);
      const radius = 138;
      spawnAssistBurst(game, {
        x: origin.x,
        y: origin.y,
        radius,
        duration: 0.42,
        spriteAsset: "iceNovaImpact",
        spriteFrames: 7,
        color: "#93c5fd"
      });
      for (const enemy of game.enemies) {
        if (enemy.dead) continue;
        const enemyCenter = centerOf(enemy);
        const hitDir = normalize(enemyCenter.x - origin.x, enemyCenter.y - origin.y, { x: 1, y: 0 });
        const hitDistance = distance(origin.x, origin.y, enemyCenter.x, enemyCenter.y);
        if (hitDistance > radius + enemy.w * 0.3) continue;
        game.damageEnemy(enemy, damage, {
          source: "basic",
          isDirect: true,
          hitDirX: hitDir.x,
          hitDirY: hitDir.y,
          hitDuration: 0.18,
          staggerPause: 0.1,
          staggerDuration: 0.28,
          recoilDistance: 86,
          instantRecoil: false
        });
      }
      damageBreakablesInRadius(game, origin.x, origin.y, radius, damage);
    }
  });
  return 1.35;
}

function assistBladeBlast(game, forcedTarget = null) {
  const startBase = forcedTarget ? aimDirectionAtPoint(game, forcedTarget) : aimDirection(game);
  beginAction(game, {
    kind: "assist",
    duration: 0.44,
    triggerTime: 0.16,
    animationKey: "cast",
    facing: facingFromDir(startBase.dir),
    direction: startBase.dir,
    moveMultiplier: 0.58,
    onTrigger: () => {
      const base = forcedTarget ? aimDirectionAtPoint(game, forcedTarget) : aimDirection(game);
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

function assistGuardCombo(game, forcedTarget = null) {
  const startBase = aimDirection(game);
  beginAction(game, {
    kind: "assist",
    duration: 0.42,
    triggerTime: 0.16,
    animationKey: "cast",
    facing: facingFromDir(startBase.dir),
    direction: startBase.dir,
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
    kind: "assist",
    duration: 0.42,
    triggerTime: 0.16,
    animationKey: "cast",
    facing: facingFromDir(startBase.dir),
    direction: startBase.dir,
    moveMultiplier: 0.52,
    onTrigger: () => {
      const base = aimDirection(game);
      const targetDistance = Math.min(220, distance(base.origin.x, base.origin.y, base.target.x, base.target.y));
      const zoneX = base.origin.x + base.dir.x * targetDistance;
      const zoneY = base.origin.y + base.dir.y * targetDistance;
      spawnAssistBurst(game, {
        x: zoneX,
        y: zoneY,
        radius: 184,
        duration: DARK_CHAIN_OVERHEAD_START_DURATION,
        spriteAsset: "darkChainOverheadStartVfx",
        spriteFrames: 25,
        drawWidth: 148,
        drawHeight: 148,
        pivotY: 0.68,
        alpha: 0.82,
        color: "#c084fc"
      });
      queueAssistGroundZone(game, {
        kind: "soulSiphonGround",
        x: zoneX,
        y: zoneY,
        radius: 156,
        radiusY: 108,
        duration: 4.5,
        delay: DARK_CHAIN_OVERHEAD_START_DURATION,
        tickInterval: 0.18,
        slowDuration: 0.32,
        slowMult: 0.42,
        spawnDamageScale: 0.5,
        color: "#7c3aed",
        animation: DARK_CHAIN_OVERHEAD_ZONE_ANIMATION,
        initialPhase: "idle",
        replaceExisting: true
      });
    }
  });
  return 1.8;
}

function assistWindVolley(game) {
  const startBase = aimDirection(game);
  beginAction(game, {
    kind: "assist",
    duration: 0.3,
    triggerTime: 0.11,
    animationKey: "attack2",
    facing: facingFromDir(startBase.dir),
    direction: startBase.dir,
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
        spriteFrames: 30,
        spriteFrameWidth: 100,
        spriteFrameHeight: 68,
        spriteDrawWidth: 28,
        spriteDrawHeight: 20,
        spriteFps: 18,
        onUpdate: updateElementProjectileAfterimage,
        afterimageInterval: 0.04,
        afterimageDuration: 0.18,
        afterimageAlpha: 0.22,
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
      spriteFrames: beam.spriteFrames || 7,
      overlaySpriteAsset: beam.overlaySpriteAsset || null,
      overlaySpriteFrames: beam.overlaySpriteFrames || 0,
      overlayColor: beam.overlayColor || "#f5d0fe",
      overlayAlpha: beam.overlayAlpha ?? 0.72,
      overlayHeightMult: beam.overlayHeightMult ?? 0.82,
      shadowBlur: beam.shadowBlur ?? 12
    };
  } else {
    game.combat.playerBeam = null;
  }

  while (beam.hitCount < (beam.maxHits || 1) && beam.elapsed >= (beam.nextHitAt ?? (beam.damageDelay || 0))) {
    beam.hitCount += 1;
    const shouldApplyStagger = beam.hitCount === 1;
    let hitAnyEnemy = false;
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      const enemyCenter = centerOf(enemy);
      const radius = (enemy.collisionRadius ?? 0.32) * enemy.w;
      const dist = pointSegmentDistance(enemyCenter.x, enemyCenter.y, originX, originY, endX, endY);
      if (dist > beam.width * 0.5 + radius) continue;
      const wasDead = enemy.dead;
      game.damageEnemy(enemy, beam.damage, {
        source: beam.source || "basic",
        isDirect: true,
        isCrit: !!beam.isCrit,
        suppressHitReaction: !shouldApplyStagger
      });
      hitAnyEnemy = true;
      const mod = game.heroModState?.necro_twin_spirits;
      const maxSpirits = mod?.active ? (mod.spiritCount || 2) : 1;
      const currentSpiritsCount = Array.isArray(state.soulSiphonSpirit) ? state.soulSiphonSpirit.length : (state.soulSiphonSpirit ? 1 : 0);

      if (!wasDead && enemy.dead && currentSpiritsCount < maxSpirits) {
        state.soulCount = Math.min(30, state.soulCount + 1);
      }
    }
    if (hitAnyEnemy && beam.shakeOnHit && !beam.hitShakeFired) {
      game.camera?.triggerShake?.(SOUL_SIPHON_THIRD_CAST_SHAKE_MAGNITUDE, SOUL_SIPHON_THIRD_CAST_SHAKE_DURATION);
      beam.hitShakeFired = true;
    }

    const mod = game.heroModState?.necro_twin_spirits;
    const maxSpirits = mod?.active ? (mod.spiritCount || 2) : 1;
    const currentSpirits = Array.isArray(state.soulSiphonSpirit) ? state.soulSiphonSpirit : (state.soulSiphonSpirit ? [state.soulSiphonSpirit] : []);

    if (currentSpirits.length < maxSpirits && state.soulCount >= 10) {
      state.soulCount -= 10;
      const newSpirit = summonSoulSiphonSpirit(game, { x: originX, y: originY }, { x: beam.dirX, y: beam.dirY });
      if (maxSpirits > 1) {
        if (!Array.isArray(state.soulSiphonSpirit)) {
          state.soulSiphonSpirit = Array.isArray(state.soulSiphonSpirit) ? state.soulSiphonSpirit : (state.soulSiphonSpirit ? [state.soulSiphonSpirit] : []);
        }
        state.soulSiphonSpirit.push(newSpirit);
      } else {
        state.soulSiphonSpirit = newSpirit;
      }
    }

    if (state.soulSiphonSpirit) {
      const spirits = Array.isArray(state.soulSiphonSpirit) ? state.soulSiphonSpirit : [state.soulSiphonSpirit];
      for (const spirit of spirits) {
        const dist = pointSegmentDistance(spirit.x, spirit.y, originX, originY, endX, endY);
        if (dist <= beam.width * 0.5 + 10) {
          spirit.charge = Math.min(spirit.maxCharge, spirit.charge + 1);
        }
      }
    }
    damageBreakablesAlongSegment(game, originX, originY, endX, endY, beam.width, beam.damage, null, { ignoreCooldown: true });
    beam.nextHitAt = (beam.nextHitAt ?? (beam.damageDelay || 0)) + (beam.hitInterval || 0);
  }

  if (beam.elapsed >= beam.duration) {
    state.activeBeam = null;
    game.combat.playerBeam = null;
  }
}

function updateSoulSiphonSpirit(game, dt) {
  const state = game.combat.weaponArtRuntime;
  if (!state.soulSiphonSpirit) return;

  const spirits = Array.isArray(state.soulSiphonSpirit) ? state.soulSiphonSpirit : [state.soulSiphonSpirit];
  const playerCenter = centerOf(game.player);
  state.spiritAutoFireCooldown = Math.max(0, state.spiritAutoFireCooldown - dt);

  spirits.forEach((spirit, index) => {
    let desiredX;
    let desiredY;
    if (state.activeBeam) {
      desiredX = playerCenter.x + state.activeBeam.dirX * 62;
      desiredY = playerCenter.y + state.activeBeam.dirY * 62 - 14;
      if (spirits.length > 1) {
        const offset = (index === 0 ? -12 : 12);
        desiredX += state.activeBeam.dirY * offset;
        desiredY -= state.activeBeam.dirX * offset;
      }
    } else {
      const orbitMod = spirits.length > 1 ? (index * Math.PI) : 0;
      spirit.orbitAngle += dt * 1.9;
      desiredX = playerCenter.x + Math.cos(spirit.orbitAngle + orbitMod) * spirit.orbitRadius;
      desiredY = playerCenter.y + Math.sin(spirit.orbitAngle + orbitMod) * spirit.orbitRadius - 18;
    }
    const follow = Math.min(1, dt * 7);
    spirit.x += (desiredX - spirit.x) * follow;
    spirit.y += (desiredY - spirit.y) * follow;
    spirit.animClock += dt;
    spirit.attackTimer = Math.max(0, spirit.attackTimer - dt);

    if (spirit.charge >= 1 && state.spiritAutoFireCooldown <= 0) {
      const target = findNearestEnemy(game, spirit, 500);
      if (target && fireSoulSiphonSpiritProjectile(game, spirit, target)) {
        spirit.charge -= 1;
        state.spiritAutoFireCooldown = 1 / getCurrentAttackRate(game);
      }
    }
  });
}

function updateAssistGroundZones(game, dt) {
  const state = game.combat.weaponArtRuntime;
  const remaining = [];
  for (const zone of state.assistGroundZones) {
    zone.elapsed += dt;
    zone.animationElapsed += dt;
    advanceAssistGroundZoneAnimation(zone);
    if (zone.active && zone.elapsed >= zone.duration) {
      zone.active = false;
      if (zone.animation?.phases?.death) {
        zone.animationPhase = "death";
        zone.animationElapsed = 0;
      } else {
        zone.animationPhase = null;
      }
    }
    zone.tickTimer -= dt;
    if (zone.active && zone.tickTimer <= 0) {
      zone.tickTimer += zone.tickInterval;
      for (const enemy of game.enemies) {
        if (enemy.dead) continue;
        const center = centerOf(enemy);
        const radiusX = zone.radius + enemy.w * 0.28;
        const radiusY = zone.radiusY + enemy.h * 0.22;
        const nx = (center.x - zone.x) / Math.max(1, radiusX);
        const ny = (center.y - zone.y) / Math.max(1, radiusY);
        if (nx * nx + ny * ny > 1) continue;
        if (shouldExecuteAssistGroundEnemy(zone, enemy)) {
          spawnSoulSiphonAssistExecuteBurst(game, zone);
          game.damageEnemy(enemy, enemy.maxHp * 999, {
            source: "skill",
            isDirect: false,
            bypassPlates: true,
            isCrit: false
          });
          continue;
        }
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
    if (zone.elapsed < (zone.totalDuration ?? zone.duration)) remaining.push(zone);
  }
  state.assistGroundZones = remaining;
}

function updatePendingAssistGroundZones(game, dt) {
  const state = game.combat.weaponArtRuntime;
  const remaining = [];
  for (const pendingZone of state.pendingAssistGroundZones) {
    pendingZone.delay -= dt;
    if (pendingZone.delay > 0) {
      remaining.push(pendingZone);
      continue;
    }
    const zone = spawnAssistGroundZone(game, {
      ...pendingZone,
      delay: undefined,
      replaceExisting: false
    });
    applyAssistGroundZoneSpawnHit(game, zone, pendingZone.spawnDamageScale ?? 0);
  }
  state.pendingAssistGroundZones = remaining;
}

function updateAssistBursts(game, dt) {
  const state = game.combat.weaponArtRuntime;
  state.assistBursts = state.assistBursts.filter((burst) => {
    burst.elapsed += dt;
    return burst.elapsed < burst.duration;
  });
}

function updateElementProjectileAfterimages(game, dt) {
  const state = game.combat.weaponArtRuntime;
  state.elementProjectileAfterimages = state.elementProjectileAfterimages.filter((afterimage) => {
    afterimage.elapsed += dt;
    return afterimage.elapsed < afterimage.duration;
  });
}

function updateLightningSparkAfterimages(game, dt) {
  const state = game.combat.weaponArtRuntime;
  state.sparkAfterimages = state.sparkAfterimages.filter((afterimage) => {
    afterimage.elapsed += dt;
    return afterimage.elapsed < afterimage.duration;
  });
}

export function createWeaponArtRuntime() {
  return {
    comboIndex: 0,
    comboTimer: 0,
    bladeBlastLeadHits: 0,
    reactiveHitAssistCooldown: 0,
    elementCycle: 0,
    windMomentum: 0,
    soulCount: 0,
    soulSiphonCastIndex: 0,
    activeBeam: null,
    soulSiphonSpirit: null,
    spiritAutoFireCooldown: 0,
    pendingAssistGroundZones: [],
    assistGroundZones: [],
    assistBursts: [],
    elementProjectileAfterimages: [],
    sparkAfterimages: []
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

export function triggerReactiveHitAssist(game, sourceEnemy) {
  if (game.heroDef?.id !== "death_knight" || game.weaponArt?.id !== "bladeBlast") return 0;
  if (!sourceEnemy || sourceEnemy.dead) return 0;
  const target = centerOf(sourceEnemy);
  return assistBladeBlast(game, target) || 0;
}

export function updateWeaponArtRuntime(game, dt) {
  const state = game.combat.weaponArtRuntime;
  state.comboTimer = Math.max(0, state.comboTimer - dt);
  state.reactiveHitAssistCooldown = Math.max(0, (state.reactiveHitAssistCooldown || 0) - dt);
  updateWindMomentum(game, dt);
  updateSoulSiphonBeam(game, dt);
  updateSoulSiphonSpirit(game, dt);
  updatePendingAssistGroundZones(game, dt);
  updateAssistGroundZones(game, dt);
  updateAssistBursts(game, dt);
  updateElementProjectileAfterimages(game, dt);
  updateLightningSparkAfterimages(game, dt);
}
