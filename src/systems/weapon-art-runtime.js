import { centerOf, clamp, distance, normalize, playThrottledAudio, resolveHeroProjectileOrigin, syncProjectileRangeToSpeed } from "../core/runtime-utils.js";
import { damageBreakable, damageBreakablesAlongSegment, damageBreakablesInCone, damageBreakablesInRadius } from "./breakables.js";
import { hitDevilMerchantInCone } from "./devil-merchant.js";
import { getPlayerAttackStat, getPlayerBasicDamageMultiplier, getPlayerCritDamage, getPlayerStat, setPlayerStatSource, clearPlayerStatSource } from "./player-stats.js";
import { getCurrentAttackRate } from "./rings.js";
import { applyStatusPayload, consumeEntityBurnStacks } from "./status-manager.js";
import { applyEnemySlow } from "./skills.js";
import { buildHasMod, getModById } from "../data/finger-mods.js";

const ELEMENT_MAGE_ICE_PROJECTILE_CLASS = "elementMageIceProjectile";
const ELEMENT_MAGE_ICE_SPLIT_PROJECTILE_CLASS = "elementMageIceSplitProjectile";
const ELEMENT_MAGE_LIGHTNING_ORB_PROJECTILE_CLASS = "elementMageLightningOrb";
const ELEMENT_MAGE_HYBRID_CORE_CLASS = "elementMageHybridCore";
const ELEMENT_MAGE_SUN_ORB_CLASS = "elementMageSunOrb";

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
const ELEMENT_MAGE_FIRE_BREATH_RANGE = 130;
const ELEMENT_MAGE_FIRE_BREATH_ARC_DEG = 50;
const ELEMENT_MAGE_FIRE_BREATH_VFX_RANGE = 100;
const ELEMENT_MAGE_FIRE_BREATH_VFX_ARC_DEG = 30;
const ELEMENT_MAGE_FIRE_BREATH_DURATION = 0.32;
const ELEMENT_MAGE_FIRE_BREATH_FORWARD_OFFSET = 8;
const ELEMENT_MAGE_SMOKE_BLAST_RADIUS = 76;
const LIGHTNING_SPARK_AFTERIMAGE_DURATION = 0.34;
const ELEMENT_PROJECTILE_AFTERIMAGE_DURATION = 0.24;

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

const WIND_VOLLEY_CONFIGS = Object.freeze({
  1: { count: 1, damageMult: 0.7, speedMult: 1.0, pierce: 0, spreadDeg: 0, trailLife: 0.14, trailMaxPoints: 6 },
  2: { count: 2, damageMult: 0.8, speedMult: 1.15, pierce: 1, spreadDeg: 9, trailLife: 0.18, trailMaxPoints: 8 },
  3: { count: 4, damageMult: 1.0, speedMult: 1.35, pierce: 2, spreadDeg: 18, trailLife: 0.22, trailMaxPoints: 10 }
});

const WIND_VOLLEY_PROJECTILE_ART = Object.freeze({
  spriteAsset: "heroWindArrow",
  spriteFrames: 1,
  spriteFrameWidth: 64,
  spriteFrameHeight: 64,
  spriteCropWidth: 64,
  spriteCropHeight: 64,
  spriteFps: 1
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
  return playThrottledAudio(audio, options);
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
        rawDir.y * (1 - aimAssistStrength) + normalize(assistTarget.y - origin.y, assistTarget.y - origin.y, rawDir).y * aimAssistStrength,
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

function basicAttackDamageMultiplier(game) {
  return getPlayerAttackStat(game.player) * getPlayerBasicDamageMultiplier(game.player);
}

function directionDot(d1, d2) {
  return d1.x * d2.x + d1.y * d2.y;
}

function comboIndex(state, max, resetTime) {
  if (state.comboTimer <= 0) state.comboIndex = 0;
  const current = state.comboIndex;
  state.comboIndex = (current + 1) % max;
  state.comboTimer = resetTime;
  return current;
}

function getAnimationDuration(state, fallback) {
  if (!state) return fallback;
  return Math.max(0.001, (state.frames ?? 1) / Math.max(1, state.fps ?? 1));
}

function getActionDurationForFixedWindup(frameCount, triggerFrame, windupSeconds, fullAnimationSeconds) {
  if (triggerFrame <= 0) return fullAnimationSeconds;
  const windupRatio = triggerFrame / frameCount;
  return windupSeconds / windupRatio;
}

function getDefaultPlayerHitboxTrigger(animationKey) {
  if (animationKey === "cast") return 7;
  if (animationKey === "attack") return 6;
  if (animationKey === "attack2") return 5;
  if (animationKey === "attack3") return 8;
  return null;
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
}

function meleeHit(game, options = {}) {
  const center = centerOf(game.player);
  const dir = options.dir || aimDirection(game).dir;
  const range = options.range || 80;
  const arcDeg = options.arcDeg || 90;
  const cosArc = Math.cos((arcDeg * Math.PI) / 360);
  const hits = [];
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const enemyCenter = centerOf(enemy);
    const dist = distance(center.x, center.y, enemyCenter.x, enemyCenter.y);
    if (dist > range + enemy.w * 0.4) continue;
    const delta = normalize(enemyCenter.x - center.x, enemyCenter.y - center.y, { x: dir.x, y: dir.y });
    if (directionDot(dir, delta) < cosArc) continue;
    hits.push(enemy);
  }
  hitDevilMerchantInCone(game, center, dir, range, arcDeg);
  return { hits, origin: center, dir };
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

function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const denom = abx * abx + aby * aby || 1;
  const t = clamp((apx * abx + apy * aby) / denom, 0, 1);
  const projX = ax + abx * t;
  const projY = ay + aby * t;
  return distance(px, py, projX, projY);
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
    spriteFrames: config.spriteFrames ?? null,
    spriteFrameWidth: config.spriteFrameWidth ?? null,
    spriteFrameHeight: config.spriteFrameHeight ?? null,
    spriteCropWidth: config.spriteCropWidth ?? null,
    spriteCropHeight: config.spriteCropHeight ?? null,
    spriteFps: config.spriteFps ?? null,
    color: config.color ?? "#a78bfa",
    pierce: config.pierce ?? 0,
    source: config.source || "skill",
    isDirect: !!config.isDirect,
    hitEnemyIds: new Set(),
    hitMeta: config.hitMeta || null,
    age: 0,
    onHitEnemy: config.onHitEnemy ?? null,
    sharedTargetHits: config.sharedTargetHits ?? null,
    repeatHitDamageMultiplier: config.repeatHitDamageMultiplier ?? null,
    onUpdate: config.onUpdate ?? null,
    baseSpeed: config.baseSpeed ?? config.speed,
    baseMaxRange: config.baseMaxRange ?? config.maxRange,
    afterimageInterval: config.afterimageInterval ?? null,
    afterimageDuration: config.afterimageDuration ?? null,
    afterimageAlpha: config.afterimageAlpha ?? null,
    projectileClass: config.projectileClass ?? null,
    returning: !!config.returning,
    returnTarget: config.returnTarget ?? null,
    returnCanHitAgain: !!config.returnCanHitAgain,
    impactSprite: config.impactSprite ?? null,
    impactFrames: config.impactFrames ?? null,
    impactFrameWidth: config.impactFrameWidth ?? null,
    impactFrameHeight: config.impactFrameHeight ?? null,
    impactFps: config.impactFps ?? null,
    impactSize: config.impactSize ?? null,
    isFriendly: !!config.isFriendly
  };
  syncProjectileRangeToSpeed(projectile);
  game.combat.playerProjectiles.push(projectile);
  return projectile;
}

function fireProjectileAtAngle(game, base, angleOffset, config) {
  const angle = Math.atan2(base.dir.y, base.dir.x) + (angleOffset * Math.PI) / 180;
  const speed = config.speed || 700;
  return spawnProjectile(game, {
    ...config,
    x: base.origin.x,
    y: base.origin.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed
  });
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

function findNearestEnemy(game, origin, range) {
  let nearest = null;
  let nearestDistance = range;
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

function healPlayer(game, amount) {
  game.player.hp = Math.min(game.player.maxHp, game.player.hp + amount);
}

// ---------------------------------------------------------------------------
// Spirit Logic
// ---------------------------------------------------------------------------
function summonSoulSiphonSpirit(game, origin, dir = { x: 1, y: 0 }) {
  const build = game.activeFingerBuild;
  let spiritCount = 1;
  let damageMultiplier = 1;
  
  if (buildHasMod(build, "necro_twin_spirits")) {
    const mod = getModById("necro_twin_spirits");
    spiritCount = mod?.values?.spiritCount ?? 2;
    damageMultiplier = mod?.values?.damageMultiplier ?? 0.7;
  }

  const spirits = [];
  for (let i = 0; i < spiritCount; i++) {
    spirits.push({
      x: origin.x + dir.x * 62,
      y: origin.y + dir.y * 62 - 14,
      orbitAngle: -Math.PI * 0.5 + (i * Math.PI * 2 / spiritCount),
      orbitRadius: 72,
      charge: 0,
      maxCharge: 10,
      animClock: 0,
      attackTimer: 0,
      visible: true,
      damageMultiplier,
      teleportTimer: 0
    });
  }
  return spirits;
}

export function initializeWeaponArtRuntime(game) {
  const state = game?.combat?.weaponArtRuntime;
  if (!state || game?.weaponArt?.id !== "soulSiphon" || (state.soulSiphonSpirits && state.soulSiphonSpirits.length > 0)) return;
  const playerCenter = centerOf(game.player);
  state.soulSiphonSpirits = summonSoulSiphonSpirit(game, playerCenter, { x: 1, y: 0 });
}

function fireSoulSiphonSpiritProjectile(game, spirit, target) {
  if (!spirit || !target) return false;
  
  const build = game.activeFingerBuild;
  
  // Guardian Spirit Mod: Shockwave instead of fireball
  if (buildHasMod(build, "necro_guardian_spirit")) {
    const mod = getModById("necro_guardian_spirit");
    if (spirit.attackTimer > 0) return false;
    
    game.spawnEnemyAreaHitbox?.({
      sourceId: "player_spirit",
      x: spirit.x,
      y: spirit.y,
      radius: mod.values.radius ?? 120,
      duration: 0.2,
      damage: basicAttackDamageMultiplier(game) * (mod.values.damageRatio ?? 0.7),
      color: "#c084fc",
      shape: "circle",
      knockback: mod.values.knockback ?? 24,
      isFriendly: true
    });
    
    spirit.attackTimer = mod.values.interval ?? 1.5;
    return true;
  }

  const center = centerOf(target);
  const dir = normalize(center.x - spirit.x, center.y - spirit.y, { x: 1, y: 0 });
  spawnProjectile(game, {
    x: spirit.x,
    y: spirit.y,
    radius: 12,
    drawSize: 22,
    damage: basicAttackDamageMultiplier(game) * (spirit.damageMultiplier || 1),
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

function updateSoulSiphonSpirit(game, dt) {
  const state = game.combat.weaponArtRuntime;
  const spirits = state.soulSiphonSpirits;
  if (!spirits || !spirits.length) return;

  const build = game.activeFingerBuild;
  const playerCenter = centerOf(game.player);
  const isAssassin = buildHasMod(build, "necro_assassin_spirit");
  const assassinMod = isAssassin ? getModById("necro_assassin_spirit") : null;

  for (const spirit of spirits) {
    let desiredX;
    let desiredY;
    let follow = Math.min(1, dt * 7);

    // Assassin Spirit: Teleport to low HP targets
    let assassinTarget = null;
    if (isAssassin && spirit.charge >= 1) {
      const threshold = assassinMod.values.targetHpThreshold ?? 0.3;
      assassinTarget = game.enemies.find(e => !e.dead && (e.hp / e.maxHp) <= threshold);
    }

    if (assassinTarget) {
      spirit.teleportTimer -= dt;
      if (spirit.teleportTimer <= 0) {
        const targetCenter = centerOf(assassinTarget);
        spirit.x = targetCenter.x;
        spirit.y = targetCenter.y;
        spirit.teleportTimer = assassinMod.values.teleportInterval ?? 0.8;
        
        // Instant damage on teleport hit
        game.damageEnemy(assassinTarget, basicAttackDamageMultiplier(game) * (assassinMod.values.teleportDamageRatio ?? 1.2), {
          source: "skill",
          isDirect: true
        });
        spirit.charge -= 1;
        state.spiritAutoFireCooldown = 0.5; // Brief pause after teleport attack
      }
      // Stay on target
      desiredX = spirit.x;
      desiredY = spirit.y;
    } else if (state.activeBeam) {
      desiredX = playerCenter.x + state.activeBeam.dirX * 62;
      desiredY = playerCenter.y + state.activeBeam.dirY * 62 - 14;
    } else {
      spirit.orbitAngle += dt * 1.9;
      desiredX = playerCenter.x + Math.cos(spirit.orbitAngle) * spirit.orbitRadius;
      desiredY = playerCenter.y + Math.sin(spirit.orbitAngle) * spirit.orbitRadius - 18;
    }

    if (!assassinTarget) {
      spirit.x += (desiredX - spirit.x) * follow;
      spirit.y += (desiredY - spirit.y) * follow;
    }

    spirit.animClock += dt;
    spirit.attackTimer = Math.max(0, spirit.attackTimer - dt);
    state.spiritAutoFireCooldown = Math.max(0, state.spiritAutoFireCooldown - dt);

    if (spirit.charge >= 1 && state.spiritAutoFireCooldown <= 0 && !assassinTarget) {
      const target = findNearestEnemy(game, spirit, 500);
      if (target && fireSoulSiphonSpiritProjectile(game, spirit, target)) {
        spirit.charge -= 1;
        state.spiritAutoFireCooldown = 1 / getCurrentAttackRate(game);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Beam Logic
// ---------------------------------------------------------------------------
function updateSoulSiphonBeam(game, dt) {
  const state = game.combat.weaponArtRuntime;
  const beam = state.activeBeam;
  if (!beam) {
    game.combat.playerBeam = null;
    clearPlayerStatSource(game.player, "beam_channel_penalty");
    return;
  }

  const build = game.activeFingerBuild;
  const isChanneling = buildHasMod(build, "necro_channeling_beam");
  const channelMod = isChanneling ? getModById("necro_channeling_beam") : null;

  beam.elapsed += dt;
  
  if (isChanneling) {
    // Ramping range and damage
    const progress = Math.min(1, beam.elapsed / (channelMod.values.rampDuration ?? 2));
    const startRange = 200; // Base range
    const maxRange = channelMod.values.maxRange ?? 280;
    beam.range = startRange + (maxRange - startRange) * progress;
    
    const startDps = channelMod.values.startingDpsRatio ?? 0.4;
    const maxDps = channelMod.values.maxDpsRatio ?? 1.4;
    beam.damage = basicAttackDamageMultiplier(game) * (startDps + (maxDps - startDps) * progress);
    
    // Apply move speed penalty
    setPlayerStatSource(game.player, "beam_channel_penalty", {
      moveSpeed: { mult: 1 - (channelMod.values.movePenalty ?? 0.4) }
    });
  }

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
      const center = centerOf(enemy);
      const dist = pointSegmentDistance(center.x, center.y, originX, originY, endX, endY);
      if (dist <= beam.width * 0.5 + enemy.w * 0.35) {
        game.damageEnemy(enemy, beam.damage, { source: beam.source || "basic", isCrit: !!beam.isCrit });
        hitAnyEnemy = true;
        if (shouldApplyStagger) {
          applyEnemySlow(enemy, 0.4, 0.5);
        }
      }
    }

    if (hitAnyEnemy) {
      if (beam.shakeOnHit) game.camera?.triggerShake?.(2, 0.1);
    }

    if (state.soulSiphonSpirits) {
      for (const spirit of state.soulSiphonSpirits) {
        const dist = pointSegmentDistance(spirit.x, spirit.y, originX, originY, endX, endY);
        if (dist <= 48) {
          spirit.charge = Math.min(spirit.maxCharge, spirit.charge + 1);
        }
      }
    }

    if (beam.hitInterval > 0) {
      beam.nextHitAt = beam.elapsed + beam.hitInterval;
    }
  }
}

// ---------------------------------------------------------------------------
// Zone Logic
// ---------------------------------------------------------------------------
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

function spawnSoulSiphonAssistExecuteBurst(game, zone) {
  spawnAssistBurst(game, {
    ...SOUL_SIPHON_ASSIST_EXECUTE_BURST,
    x: zone.x,
    y: zone.y
  });
}

function updateAssistGroundZones(game, dt) {
  const state = game.combat.weaponArtRuntime;
  const remaining = [];
  const build = game.activeFingerBuild;
  const hasExecuteMod = buildHasMod(build, "necro_execute_detonation");
  const executeMod = hasExecuteMod ? getModById("necro_execute_detonation") : null;

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
        const radiusY = (zone.radiusY || zone.radius) + enemy.h * 0.22;
        const nx = (center.x - zone.x) / Math.max(1, radiusX);
        const ny = (center.y - zone.y) / Math.max(1, radiusY);
        if (nx * nx + ny * ny > 1) continue;

        // Use modded execution threshold if available
        const executeThreshold = hasExecuteMod ? (executeMod.values.executeThreshold ?? 0.1) : SOUL_SIPHON_ASSIST_EXECUTE_HP_RATIO;
        const canExecute = (enemy.hp / enemy.maxHp) <= executeThreshold;

        if (canExecute) {
          spawnSoulSiphonAssistExecuteBurst(game, zone);
          
          // Execution Detonation Mod: Spawn additional explosion
          if (hasExecuteMod) {
            game.spawnEnemyAreaHitbox?.({
              sourceId: "execute_detonation",
              x: enemy.x + enemy.w * 0.5,
              y: enemy.y + enemy.h * 0.5,
              radius: executeMod.values.explosionRadius ?? 100,
              duration: 0.15,
              damage: getPlayerAttackStat(game.player) * (executeMod.values.explosionDamageAtkRatio ?? 0.8),
              color: "#f87171",
              shape: "circle",
              isFriendly: true
            });
          }

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

// ---------------------------------------------------------------------------
// Weapon Art Handlers
// ---------------------------------------------------------------------------
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
        color: isEmpoweredThirdCast ? "#c084fc" : "#a855f7"
      };
    }
  });
}

function assistSoulSiphon(game) {
  const state = game.combat.weaponArtRuntime;
  const { target, dir } = aimDirection(game);
  state.pendingAssistGroundZones.push({
    kind: "soulSiphonGround",
    x: target.x,
    y: target.y,
    radius: 64,
    radiusY: 48,
    duration: 3.5,
    tickInterval: 0.5,
    damage: 0.25,
    slowDuration: 1.2,
    slowMult: 0.5
  });
}

function deathKnightComboResetTime(game) {
  return 1.2;
}

function spawnDeathKnightSlashVfx(game, origin, dir, combo) {}

function attackBladeBlast(game) {
  const state = game.combat.weaponArtRuntime;
  const build = game.activeFingerBuild;
  const step = comboIndex(state, 3, deathKnightComboResetTime(game));
  
  const isPiercing = buildHasMod(build, "dk_piercing_stance");
  const piercingMod = isPiercing ? getModById("dk_piercing_stance") : null;
  const isSpin = buildHasMod(build, "dk_reaping_cyclone");
  const spinMod = isSpin ? getModById("dk_reaping_cyclone") : null;

  const combo = [
    { animationKey: "attack", duration: 0.4, triggerTime: 0.18, damage: 1, range: 136, arcDeg: 105, blastDamage: 0, heal: 2 },
    { animationKey: "attack2", duration: 0.42, triggerTime: 0.2, damage: 1.3, range: 150, arcDeg: 100, blastDamage: 0, heal: 3 },
    { animationKey: "attack3", duration: 0.52, triggerTime: 0.24, damage: 1.6, range: 164, arcDeg: 110, blastDamage: 1, heal: 4 }
  ][step];

  if (isPiercing) {
    combo.duration /= (piercingMod.values.attackSpeedMultiplier ?? 1.2);
    combo.triggerTime /= (piercingMod.values.attackSpeedMultiplier ?? 1.2);
    combo.range *= (piercingMod.values.rangeMultiplier ?? 1.35);
    combo.arcDeg *= (piercingMod.values.widthMultiplier ?? 0.5);
  }

  if (isSpin) {
    combo.arcDeg = 360;
    combo.damage *= (spinMod.values.damageMultiplier ?? 0.85);
    combo.range = spinMod.values.aoeRadius ?? 112;
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
        
        if (isSpin) {
          const directions = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
          for (const dir of directions) {
            spawnProjectile(game, {
              x: base.origin.x, y: base.origin.y,
              vx: dir.x * 540, vy: dir.y * 540,
              radius: 50 * finisherSizeScale, drawSize: 98 * finisherSizeScale,
              damage: combo.blastDamage * basicAttackDamageMultiplier(game) * finisherDamageScale * (spinMod.values.waveDamageMultiplier ?? 0.7),
              speed: 540, maxRange: 280 * finisherSizeScale,
              pierce: 999, color: "#7c3aed", spriteAsset: "deathKnightDarkWaveProjectile", source: "basic"
            });
          }
        } else {
          const isSpectral = buildHasMod(build, "dk_spectral_pursuit");
          const spectralMod = isSpectral ? getModById("dk_spectral_pursuit") : null;
          const count = isSpectral ? (spectralMod.values.totalProjectiles ?? 3) : 1;
          const spread = 15;
          const startAngle = -(spread * (count - 1)) / 2;

          for (let i = 0; i < count; i++) {
            fireProjectileAtAngle(game, base, startAngle + i * spread, {
              radius: 50 * finisherSizeScale * (isSpectral ? (spectralMod.values.widthMultiplier ?? 0.35) : (isPiercing ? (piercingMod.values.waveWidthMultiplier ?? 0.45) : 1)),
              drawSize: 98 * finisherSizeScale,
              damage: combo.blastDamage * basicAttackDamageMultiplier(game) * finisherDamageScale,
              speed: 540, maxRange: 280 * finisherSizeScale * (isSpectral ? (spectralMod.values.distanceMultiplier ?? 1.5) : 1),
              pierce: 999, color: "#7c3aed", spriteAsset: "deathKnightDarkWaveProjectile", source: "basic",
              homingRadius: isSpectral ? (spectralMod.values.homingRadius ?? 180) : 0,
              homingTurnRate: isSpectral ? (spectralMod.values.homingTurnRate ?? 2.4) : 0
            });
          }
        }
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

function clearGuardProjectiles(game, origin, dir, range, arcDeg) {
  const cosArc = Math.cos((arcDeg * Math.PI) / 360);
  game.combat.enemyProjectiles = game.combat.enemyProjectiles.filter((projectile) => {
    const dist = distance(origin.x, origin.y, projectile.x, projectile.y);
    if (dist > range) return true;
    const delta = normalize(projectile.x - origin.x, projectile.y - origin.y, { x: dir.x, y: dir.y });
    return directionDot(dir, delta) < cosArc;
  });
}

function assistProjectile(game) {
  const startBase = aimDirection(game);
  const build = game.activeFingerBuild;
  const hasNovaPursuit = buildHasMod(build, "elem_nova_frost_pursuit");
  const novaMod = hasNovaPursuit ? getModById("elem_nova_frost_pursuit") : null;
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
        x: origin.x, y: origin.y, radius, duration: 0.42,
        spriteAsset: "iceNovaImpact", spriteFrames: 7, color: "#93c5fd"
      });
      let boltCount = 0;
      for (const enemy of game.enemies) {
        if (enemy.dead) continue;
        const enemyCenter = centerOf(enemy);
        const hitDir = normalize(enemyCenter.x - origin.x, enemyCenter.y - origin.y, { x: 1, y: 0 });
        const hitDistance = distance(origin.x, origin.y, enemyCenter.x, enemyCenter.y);
        if (hitDistance > radius + enemy.w * 0.3) continue;
        game.damageEnemy(enemy, damage, {
          source: "basic", isDirect: true, hitDirX: hitDir.x, hitDirY: hitDir.y,
          hitDuration: 0.18, staggerPause: 0.1, staggerDuration: 0.28, recoilDistance: 86, instantRecoil: false
        });
        
        if (hasNovaPursuit && boltCount < (novaMod.values.maxProjectiles ?? 8)) {
          fireProjectileAtAngle(game, { origin, dir: hitDir }, 0, {
            radius: 12, drawSize: 30, damage: damage * (novaMod.values.damageMultiplier ?? 0.85),
            speed: 900, range: 640, color: "#60a5fa",
            projectileClass: ELEMENT_MAGE_ICE_PROJECTILE_CLASS,
            hitMeta: ELEMENT_MAGE_ICE_HIT_META,
            onUpdate: updateElementProjectileAfterimage,
            afterimageInterval: 0.065, afterimageDuration: 0.26, afterimageAlpha: 0.16,
            ...ELEMENT_MAGE_ICE_PROJECTILE_ART, ...ELEMENT_MAGE_ICE_IMPACT_ART
          });
          boltCount++;
        }
      }
      damageBreakablesInRadius(game, origin.x, origin.y, radius, damage);
    }
  });
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

function handleElementMageIceHit(game, enemy) {}

function updateElementProjectileAfterimage(game, projectile, dt) {
  projectile.afterimageTimer = (projectile.afterimageTimer || 0) - dt;
  if (projectile.afterimageTimer <= 0) {
    projectile.afterimageTimer = projectile.afterimageInterval || 0.05;
    game.combat.weaponArtRuntime.elementProjectileAfterimages.push({
      x: projectile.x, y: projectile.y, z: projectile.z || 0,
      vx: projectile.vx * 0.2, vy: projectile.vy * 0.2,
      radius: projectile.radius, color: projectile.color,
      elapsed: 0, duration: projectile.afterimageDuration || 0.2,
      alpha: projectile.afterimageAlpha || 0.3,
      spriteAsset: projectile.spriteAsset,
      frame: Math.floor(projectile.age * (projectile.spriteFps || 16)) % (projectile.spriteFrames || 1)
    });
  }
}

function updateLightningOrbProjectile(game, projectile, dt) {
  projectile.sparkCooldown -= dt;
  if (projectile.sparkCooldown <= 0) {
    const build = game.activeFingerBuild;
    const hasSolar = buildHasMod(build, "elem_solar_conversion");
    const solarMod = hasSolar ? getModById("elem_solar_conversion") : null;

    if (hasSolar && projectile.projectileClass === ELEMENT_MAGE_SUN_ORB_CLASS) {
      const radius = 120;
      const damage = basicAttackDamageMultiplier(game);
      for (const enemy of game.enemies) {
        if (enemy.dead || distance(projectile.x, projectile.y, enemy.x, enemy.y) > radius) continue;
        applyStatusPayload(enemy, {
          burnDuration: 3,
          burnDamagePerSecond: damage * (solarMod.values.burningDpsRatio ?? 0.06),
          burnMaxStacks: 999
        });
      }
      projectile.sparkCooldown = 0.5;
    } else {
      const target = findNearestEnemy(game, projectile, 240);
      if (target) {
        const center = centerOf(target);
        const dir = normalize(center.x - projectile.x, center.y - projectile.y, { x: 1, y: 0 });
        spawnProjectile(game, {
          x: projectile.x, y: projectile.y, vx: dir.x * 800, vy: dir.y * 800,
          radius: 8, damage: projectile.damage * (projectile.arcDamageMultiplier || 0.5),
          speed: 800, maxRange: 240, color: "#fef08a",
          ...ELEMENT_MAGE_LIGHTNING_PROJECTILE_ART, ...ELEMENT_MAGE_LIGHTNING_IMPACT_ART
        });
        projectile.sparkCooldown = 0.25;
      }
    }
  }
}

function triggerElementMageFireBreath(game) {
  const { origin, dir } = aimDirection(game);
  spawnElementMageFireBreathVfx(game, origin, dir);
  detonateLightningOrbsInCone(game, origin, dir, ELEMENT_MAGE_FIRE_BREATH_RANGE, ELEMENT_MAGE_FIRE_BREATH_ARC_DEG);
  
  const build = game.activeFingerBuild;
  const hasSolar = buildHasMod(build, "elem_solar_conversion");
  const solarMod = hasSolar ? getModById("elem_solar_conversion") : null;

  const damage = basicAttackDamageMultiplier(game);
  const { hits } = meleeHit(game, { range: ELEMENT_MAGE_FIRE_BREATH_RANGE, arcDeg: ELEMENT_MAGE_FIRE_BREATH_ARC_DEG });
  for (const enemy of hits) {
    game.damageEnemy(enemy, damage, { source: "basic", isDirect: true, ...ELEMENT_MAGE_FIRE_HIT_META });
    applyStatusPayload(enemy, { 
      burnDuration: 3, 
      burnDamagePerSecond: damage * (hasSolar ? (solarMod.values.burningDpsRatio ?? 0.06) : 0.2),
      burnMaxStacks: hasSolar ? 999 : 99
    });
  }
  damageBreakablesInCone(game, origin, dir, ELEMENT_MAGE_FIRE_BREATH_RANGE, ELEMENT_MAGE_FIRE_BREATH_ARC_DEG, damage);
}

function spawnElementMageFireBreathVfx(game, origin, dir) {}
function detonateLightningOrbsInCone(game, origin, dir, range, arc) {
  const build = game.activeFingerBuild;
  const hasHybridMod = buildHasMod(build, "elem_frost_thunder_core");
  const hybridMod = hasHybridMod ? getModById("elem_frost_thunder_core") : null;

  for (const projectile of game.combat.playerProjectiles) {
    if (projectile.projectileClass === ELEMENT_MAGE_LIGHTNING_ORB_PROJECTILE_CLASS || projectile.projectileClass === ELEMENT_MAGE_HYBRID_CORE_CLASS) {
      const dist = distance(origin.x, origin.y, projectile.x, projectile.y);
      if (dist <= range) {
        if (projectile.projectileClass === ELEMENT_MAGE_HYBRID_CORE_CLASS && hasHybridMod) {
          const radius = hybridMod.values.steamExplosionRadius ?? 112;
          spawnAssistBurst(game, { x: projectile.x, y: projectile.y, radius, color: "#e0f2fe", duration: 0.5 });
          damageBreakablesInRadius(game, projectile.x, projectile.y, radius, basicAttackDamageMultiplier(game) * 0.8);
          for (const enemy of game.enemies) {
            if (enemy.dead || distance(projectile.x, projectile.y, enemy.x, enemy.y) > radius) continue;
            game.damageEnemy(enemy, basicAttackDamageMultiplier(game) * (hybridMod.values.steamExplosionDamageRatio ?? 0.8), { source: "skill" });
          }
          const count = hybridMod.values.extraFrostBolts ?? 6;
          for (let i = 0; i < count; i++) {
            const angle = (i * Math.PI * 2) / count;
            spawnProjectile(game, {
              x: projectile.x, y: projectile.y, vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900,
              radius: 12, damage: basicAttackDamageMultiplier(game) * 0.7,
              speed: 900, maxRange: 640, color: "#60a5fa",
              projectileClass: ELEMENT_MAGE_ICE_PROJECTILE_CLASS,
              ...ELEMENT_MAGE_ICE_PROJECTILE_ART, ...ELEMENT_MAGE_ICE_IMPACT_ART
            });
          }
        }
        projectile._destroyed = true;
      }
    }
  }
}

function attackProjectile(game) {
  const state = game.combat.weaponArtRuntime;
  const build = game.activeFingerBuild;
  const hasSolar = buildHasMod(build, "elem_solar_conversion");
  const solarMod = hasSolar ? getModById("elem_solar_conversion") : null;
  const hasHybrid = buildHasMod(build, "elem_frost_thunder_core");
  
  let step = state.elementCycle % 3;
  if (hasHybrid && step === 1) {
    state.elementCycle++;
    step = 2;
  }
  state.elementCycle++;

  const startBase = aimDirection(game);
  const variants = [
    {
      animationKey: "cast", duration: 0.42, triggerTime: 0.16,
      cast: () => triggerElementMageFireBreath(game)
    },
    {
      animationKey: "attack2", duration: 0.38, triggerTime: 0.12,
      cast: () => {
        const base = aimDirection(game);
        const hasReturning = buildHasMod(build, "elem_returning_frost_bolt");
        const returnMod = hasReturning ? getModById("elem_returning_frost_bolt") : null;
        const FIREBALL_ART = {
          spriteAsset: "volatileFireballProjectile", spriteFrames: 16, spriteFrameWidth: 64, spriteFrameHeight: 64,
          spriteCropWidth: 64, spriteCropHeight: 64, spriteFps: 18
        };
        const config = {
          radius: 12, drawSize: 30, damage: basicAttackDamageMultiplier(game),
          speed: 900, range: 640, color: hasSolar ? "#f87171" : "#60a5fa",
          projectileClass: ELEMENT_MAGE_ICE_PROJECTILE_CLASS,
          hitMeta: hasSolar ? { burnMaxStacks: 999, burnDamagePerSecond: basicAttackDamageMultiplier(game) * (solarMod.values.burningDpsRatio ?? 0.06) } : ELEMENT_MAGE_ICE_HIT_META,
          returning: hasReturning, returnTarget: "player",
          returnSpeedMult: returnMod?.values?.returnSpeedMultiplier ?? 1.2,
          maxRange: 640 * (returnMod?.values?.initialDistanceMultiplier ?? 1),
          ...(hasSolar ? FIREBALL_ART : ELEMENT_MAGE_ICE_PROJECTILE_ART),
          ...ELEMENT_MAGE_ICE_IMPACT_ART
        };
        fireProjectileAtAngle(game, base, -7, config);
        fireProjectileAtAngle(game, base, 7, config);
      }
    },
    {
      animationKey: "attack3", duration: 0.46, triggerTime: 0.18,
      cast: () => {
        const base = aimDirection(game);
        const classId = hasHybrid ? ELEMENT_MAGE_HYBRID_CORE_CLASS : (hasSolar ? ELEMENT_MAGE_SUN_ORB_CLASS : ELEMENT_MAGE_LIGHTNING_ORB_PROJECTILE_CLASS);
        const orb = fireProjectileAtAngle(game, base, 0, {
          radius: 22, drawSize: 96, damage: basicAttackDamageMultiplier(game),
          speed: hasHybrid ? 60 : 100, range: 300, pierce: 999,
          color: hasSolar ? "#fbbf24" : "#facc15",
          projectileClass: classId,
          arcDamageMultiplier: hasHybrid ? 0.5 : (hasSolar ? 0 : 0.5),
          ...ELEMENT_MAGE_LIGHTNING_PROJECTILE_ART, ...ELEMENT_MAGE_LIGHTNING_IMPACT_ART
        });
        orb.sparkCooldown = 0.5;
        orb.onUpdate = (g, p, dt) => {
          updateLightningOrbProjectile(g, p, dt);
          if (hasHybrid) {
            p.boltTimer = (p.boltTimer || 0) - dt;
            if (p.boltTimer <= 0) {
              const t = findNearestEnemy(g, p, 400);
              if (t) {
                const d = normalize(t.x - p.x, t.y - p.y, { x: 1, y: 0 });
                spawnProjectile(g, {
                  x: p.x, y: p.y, vx: d.x * 900, vy: d.y * 900,
                  radius: 12, damage: basicAttackDamageMultiplier(g) * 0.7,
                  speed: 900, maxRange: 640, color: "#60a5fa",
                  ...ELEMENT_MAGE_ICE_PROJECTILE_ART, ...ELEMENT_MAGE_ICE_IMPACT_ART
                });
                p.boltTimer = 0.8;
              }
            }
          }
        };
      }
    }
  ][step];

  beginAction(game, {
    duration: variants.duration, triggerTime: variants.triggerTime,
    animationKey: variants.animationKey, facing: facingFromDir(startBase.dir),
    direction: startBase.dir, moveMultiplier: game.heroDef.combat.moveMultiplier,
    onTrigger: variants.cast
  });
}

function getWindArcherMomentumStage(momentum) {
  if (momentum >= 0.68) return 3;
  if (momentum >= 0.34) return 2;
  return 1;
}

function updateWindArcherMomentum(game, dt) {
  const state = game.combat.weaponArtRuntime;
  if (game.weaponArt.id !== "windVolley") {
    state.windMomentum = 0;
    return;
  }
  const distance = game.player.lastDistanceMoved || 0;
  if (distance > 0.01) {
    state.windMomentum = Math.min(1, (state.windMomentum || 0) + distance / 260);
  } else {
    state.windMomentum = Math.max(0, (state.windMomentum || 0) - dt * 0.6);
  }
}

function attackWindVolley(game) {
  const state = game.combat.weaponArtRuntime;
  const stage = getWindArcherMomentumStage(state.windMomentum || 0);
  const config = WIND_VOLLEY_CONFIGS[stage] || WIND_VOLLEY_CONFIGS[1];
  
  state.windMomentum = 0; // Reset momentum on attack

  const startBase = aimDirection(game);
  beginAction(game, {
    duration: 0.38,
    triggerTime: 0.12,
    animationKey: "attack",
    facing: facingFromDir(startBase.dir),
    direction: startBase.dir,
    moveMultiplier: game.heroDef.combat.moveMultiplier,
    onTrigger: () => {
      const base = aimDirection(game);
      const count = config.count;
      const spread = config.spreadDeg;
      const startAngle = count > 1 ? -spread / 2 : 0;
      const stepAngle = count > 1 ? spread / (count - 1) : 0;

      for (let i = 0; i < count; i++) {
        fireProjectileAtAngle(game, base, startAngle + i * stepAngle, {
          radius: 12,
          drawSize: stage >= 3 ? 32 : 24,
          damage: basicAttackDamageMultiplier(game) * config.damageMult,
          speed: 1000 * config.speedMult,
          maxRange: 640,
          pierce: config.pierce,
          color: stage === 3 ? "#4ade80" : stage === 2 ? "#bbf7d0" : "#f0fdf4",
          ...WIND_VOLLEY_PROJECTILE_ART,
          hitMeta: WIND_VOLLEY_HIT_META
        });
      }
      const spawnSfx = game.assets?.windVolleySpawnSfx;
      if (spawnSfx) playAttackSfx(spawnSfx);
    }
  });
}

function assistBladeBlast(game) { return assistProjectile(game); }
function assistGuardCombo(game) { return assistProjectile(game); }
function assistWindVolley(game) { return assistProjectile(game); }

export function spawnStationaryLightningOrb(game, x, y, options = {}) {
  const orb = spawnProjectile(game, {
    x, y, radius: 22, drawSize: 96,
    damage: basicAttackDamageMultiplier(game) * (options.arcDamageMultiplier ?? 0.75),
    speed: 0, maxRange: 9999, pierce: 999,
    color: "#facc15",
    projectileClass: ELEMENT_MAGE_LIGHTNING_ORB_PROJECTILE_CLASS,
    ...ELEMENT_MAGE_LIGHTNING_PROJECTILE_ART, ...ELEMENT_MAGE_LIGHTNING_IMPACT_ART
  });
  orb.lifetime = options.lifetime ?? 4.0;
  orb.sparkCooldown = 0.5;
  orb.arcDamageMultiplier = options.arcDamageMultiplier ?? 0.75;
  orb.onUpdate = (g, p, dt) => updateLightningOrbProjectile(g, p, dt);
  return orb;
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

export function createWeaponArtRuntime() {
  return {
    elementCycle: 0, windMomentum: 0, soulCount: 0, soulSiphonCastIndex: 0,
    comboIndex: 0, comboTimer: 0,
    bladeBlastLeadHits: 0, activeBeam: null, soulSiphonSpirits: [],
    spiritAutoFireCooldown: 0, pendingAssistGroundZones: [],
    assistGroundZones: [], assistBursts: [],
    elementProjectileAfterimages: [], sparkAfterimages: []
  };
}

function updateElementProjectileAfterimages(game, dt) {
  const state = game.combat.weaponArtRuntime;
  if (!state.elementProjectileAfterimages) return;
  state.elementProjectileAfterimages = state.elementProjectileAfterimages.filter(a => {
    a.elapsed += dt;
    return a.elapsed < a.duration;
  });
}

function updateSparkAfterimages(game, dt) {
  const state = game.combat.weaponArtRuntime;
  if (!state.sparkAfterimages) return;
  state.sparkAfterimages = state.sparkAfterimages.filter(a => {
    a.elapsed += dt;
    return a.elapsed < a.duration;
  });
}

export function updateWeaponArtRuntime(game, dt) {
  const state = game.combat.weaponArtRuntime;
  if (!state) return;
  if (state.pendingAssistGroundZones?.length > 0) {
    for (const pending of state.pendingAssistGroundZones) {
      state.assistGroundZones.push({ ...pending, elapsed: 0, tickTimer: 0, active: true });
    }
    state.pendingAssistGroundZones = [];
  }
  updateSoulSiphonBeam(game, dt);
  updateSoulSiphonSpirit(game, dt);
  updateAssistGroundZones(game, dt);
  updateWindArcherMomentum(game, dt);
  state.comboTimer = Math.max(0, (state.comboTimer || 0) - dt);
  state.assistBursts = state.assistBursts?.filter(b => { b.elapsed += dt; return b.elapsed < b.duration; }) || [];
  updateElementProjectileAfterimages(game, dt);
  updateSparkAfterimages(game, dt);
}

export function triggerWeaponArtAttack(game) {
  const handler = WEAPON_ART_ATTACK_HANDLERS[game.weaponArt.id];
  if (!handler) return false;
  handler(game);
  return true;
}

export function triggerWeaponArtAssist(game) {
  const handler = WEAPON_ART_ASSIST_HANDLERS[game.weaponArt.id];
  if (!handler) return false;
  handler(game);
  return true;
}

export function triggerReactiveHitAssist(game, sourceEnemy) {
  if (game.heroDef?.id !== "death_knight" || game.weaponArt?.id !== "bladeBlast") return 0;
  if (!sourceEnemy || sourceEnemy.dead) return 0;
  const target = centerOf(sourceEnemy);
  return assistBladeBlast(game, target) || 0;
}
