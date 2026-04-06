import { centerOf, circleHitsRect, clamp, distance, normalize, playThrottledAudio, rectsOverlap, syncProjectileRangeToSpeed } from "../core/runtime-utils.js";
import { damageBreakable, damageBreakablesInRadius, getBlockingBreakableRects } from "./breakables.js";
import { modifyDamageAgainstEnemy, onEnemyDamagedByPlayer, onEnemyKilledByPlayer, tryPreventEnemyDeath } from "./enemy-affixes.js";
import { getEnemyTargetCenter, getEnemyTargetEntity, isEnemyTestDummy } from "./enemy-targeting.js";
import { spawnGoldDropsForEnemy } from "./gold.js";
import { spawnExperienceDropsForEnemy } from "./experience.js";
import { maybeSpawnMaterialDropForEnemy } from "./materials.js";
import { notePlayerDamagedByEnemyMelee } from "./melee-attack-tokens.js";
import { onFingerBasicAttackUsed, onFingerEnemyKilled, onFingerHit } from "./fingers.js";
import { enemyCanBeDisplaced } from "./enemy-displacement.js";
import { isPlayerIgnoringEnemyCollision } from "./player-collision.js";
import {
  canAttackWhileSliding,
  damageMirrorClone,
  getMirrorClone,
  applyInfernoBurnOnHit,
  modifyIncomingPlayerDamage,
  modifyOutgoingPlayerDamage,
  onRingBasicAttackUsed,
  onRingEnemyKilled,
  onRingHit,
  onRingPlayerDamaged,
  refreshRingDerivedStats,
  getCurrentAttackRate,
  getTotalAttackSpeedMultiplier,
  rollLuckyChance,
  tryChaosRebirth,
  tryReviveEnemyOnKill
} from "./rings.js";
import { getPlayerAttackStat, getPlayerCritChance, getPlayerCritDamage, setPlayerStatSource } from "./player-stats.js";
import { createSkillRuntime, onBasicAttackUsedForSkills, onEnemyKilledForSkills, onPlayerDealtDamageForSkills, triggerSkillProc, tryUseSkillSlot, updateSkillRuntime } from "./skills.js";
import { applyStatusPayload, isEntityBlinded, updateStatusState } from "./status-manager.js";
import { createWeaponArtRuntime, handleWeaponArtPlayerProjectileCollision, triggerReactiveHitAssist, triggerWeaponArtAssist, triggerWeaponArtAttack, updateWeaponArtRuntime } from "./weapon-art-runtime.js";
import { UNDEAD_ENEMY_IDS } from "../data/undead-enemies.js";

const ENEMY_ATTACK_LOCKOUT_SECONDS = 2;
const ENEMY_DAMAGE_BURST_WINDOW_SECONDS = 1;
const ENEMY_DAMAGE_BURST_HP_RATIO = 0.3;
const ENEMY_DAMAGE_BURST_STAGGER_COOLDOWN_SECONDS = 1.2;
const PLAYER_CRIT_SHAKE_MAGNITUDE = 4;
const PLAYER_CRIT_SHAKE_DURATION = 0.12;
const NECROMANCER_LIFE_POTION_KILLS_PER_CHARGE = 40;
const ENEMY_HIT_AUDIO_PRESETS = Object.freeze({
  elementMageFireProjectile: Object.freeze({
    baseAsset: "elementMageFireProjectileHitSfx",
    fallbackBaseAsset: "enemyHurtSfx",
    baseVolumeDbJitter: 3,
    basePlaybackRateMin: 1.08,
    basePlaybackRateMax: 1.16,
    layerAsset: "elementMageFireProjectileHitLayerSfx",
    layerPlaybackRateMin: 0.94,
    layerPlaybackRateMax: 1.06
  }),
  elementMageIceProjectile: Object.freeze({
    baseAsset: "elementMageIceProjectileHitSfx",
    fallbackBaseAsset: "enemyHurtSfx",
    baseVolumeDbJitter: 3,
    basePlaybackRateMin: 0.98,
    basePlaybackRateMax: 1.06,
    layerAsset: "elementMageIceProjectileHitLayerSfx",
    layerPlaybackRateMin: 0.96,
    layerPlaybackRateMax: 1.04
  }),
  windVolley: Object.freeze({
    baseAsset: "windVolleyHitSfx",
    fallbackBaseAsset: "enemyHurtSfx",
    baseVolumeDbJitter: 4,
    basePlaybackRateMin: 0.94,
    basePlaybackRateMax: 1.14,
    layerAsset: "windVolleyHitLayerSfx",
    layerVolumeMult: 1,
    layerPlaybackRateMin: 0.9,
    layerPlaybackRateMax: 1.08
  })
});
const BARBARIAN_BLOOD_ENEMY_IDS = new Set([
  "m_bar_ogre_1",
  "m_bar_nomad_3",
  "m_bar_berserker_4",
  "m_bar_archer_5",
  "m_bar_barbarian_6",
  "m_bar_bowman_7",
  "m_bar_witchdoctor_8",
  "m_bar_shaman_9"
]);
const SLIME_ENEMY_IDS = new Set([
  "slime_green_1",
  "slime_green_2",
  "slime_green_3",
  "slime_green_4",
  "slime_green_5",
  "slime_green_6"
]);
const BLOOD_PIXEL_COLORS = Object.freeze(["#991b1b", "#7f1d1d", "#b91c1c", "#be123c"]);
const SLIME_GOO_COLORS = Object.freeze(["#5acd17", "#00692d"]);
const BLOOD_PIXEL_PATTERNS = Object.freeze([
  { weight: 12, pixels: [{ x: 0, y: 0, color: 2 }] },
  { weight: 10, pixels: [{ x: 0, y: 0, color: 2 }, { x: 1, y: 0, color: 3 }] },
  { weight: 8, pixels: [{ x: 0, y: 0, color: 1 }, { x: 1, y: 0, color: 0 }, { x: 2, y: 0, color: 2 }] },
  { weight: 6, pixels: [{ x: 0, y: 0, color: 1 }, { x: 1, y: 0, color: 1 }, { x: 0, y: 1, color: 0 }, { x: 1, y: 1, color: 3 }] },
  { weight: 4, pixels: [{ x: 0, y: 0, color: 2 }, { x: 1, y: 0, color: 3 }, { x: 2, y: 0, color: 2 }, { x: 0, y: 1, color: 1 }, { x: 1, y: 1, color: 0 }] },
  { weight: 2.5, pixels: [{ x: 0, y: 0, color: 0 }, { x: 1, y: 0, color: 1 }, { x: 2, y: 0, color: 1 }, { x: 0, y: 1, color: 0 }, { x: 1, y: 1, color: 3 }, { x: 2, y: 1, color: 1 }] },
  { weight: 1.25, pixels: [{ x: 0, y: 0, color: 1 }, { x: 1, y: 0, color: 1 }, { x: 2, y: 0, color: 0 }, { x: 0, y: 1, color: 1 }, { x: 1, y: 1, color: 1 }, { x: 2, y: 1, color: 0 }, { x: 3, y: 1, color: 3 }] }
]);
const SLIME_GOO_PATTERNS = Object.freeze([
  { weight: 12, pixels: [{ x: 0, y: 0, color: 0 }] },
  { weight: 10, pixels: [{ x: 0, y: 0, color: 0 }, { x: 1, y: 0, color: 1 }] },
  { weight: 8, pixels: [{ x: 0, y: 0, color: 1 }, { x: 1, y: 0, color: 0 }, { x: 0, y: 1, color: 0 }] },
  { weight: 6, pixels: [{ x: 0, y: 0, color: 0 }, { x: 1, y: 0, color: 1 }, { x: 0, y: 1, color: 1 }, { x: 1, y: 1, color: 0 }] },
  { weight: 4, pixels: [{ x: 0, y: 0, color: 1 }, { x: 1, y: 0, color: 0 }, { x: 2, y: 0, color: 1 }, { x: 1, y: 1, color: 0 }] }
]);
const BONE_SPLINTER_COLORS = Object.freeze(["#f5f5f4", "#d6d3d1", "#a8a29e", "#78716c"]);
const BONE_SPLINTER_PATTERNS = Object.freeze([
  { weight: 12, pixels: [{ x: 0, y: 0, color: 1 }] },
  { weight: 10, pixels: [{ x: 0, y: 0, color: 0 }, { x: 1, y: 0, color: 2 }] },
  { weight: 7, pixels: [{ x: 0, y: 0, color: 2 }, { x: 1, y: 0, color: 1 }, { x: 2, y: 0, color: 3 }] },
  { weight: 4.5, pixels: [{ x: 0, y: 0, color: 0 }, { x: 1, y: 0, color: 2 }, { x: 2, y: 0, color: 3 }, { x: 1, y: 1, color: 1 }] },
  { weight: 2.5, pixels: [{ x: 0, y: 0, color: 1 }, { x: 1, y: 0, color: 2 }, { x: 2, y: 0, color: 3 }, { x: 3, y: 0, color: 0 }] },
  { weight: 1.25, pixels: [{ x: 0, y: 0, color: 2 }, { x: 1, y: 0, color: 0 }, { x: 2, y: 0, color: 1 }, { x: 3, y: 0, color: 3 }, { x: 2, y: 1, color: 1 }] }
]);
const GROUND_DIRT_COLORS = Object.freeze(["#33211a", "#4b362d", "#6b7280", "#9ca3af", "#5b4638"]);
const GROUND_DIRT_PATTERNS = Object.freeze([
  { weight: 12, pixels: [{ x: 0, y: 0, color: 1 }] },
  { weight: 10, pixels: [{ x: 0, y: 0, color: 0 }, { x: 1, y: 0, color: 2 }] },
  { weight: 8, pixels: [{ x: 0, y: 0, color: 4 }, { x: 1, y: 0, color: 1 }, { x: 1, y: 1, color: 3 }] },
  { weight: 6, pixels: [{ x: 0, y: 0, color: 1 }, { x: 1, y: 0, color: 4 }, { x: 2, y: 0, color: 2 }, { x: 1, y: 1, color: 0 }] },
  { weight: 4.5, pixels: [{ x: 0, y: 0, color: 2 }, { x: 1, y: 0, color: 3 }, { x: 2, y: 0, color: 4 }, { x: 0, y: 1, color: 1 }, { x: 1, y: 1, color: 0 }] },
  { weight: 3.5, pixels: [{ x: 0, y: 0, color: 0 }, { x: 1, y: 0, color: 4 }, { x: 2, y: 0, color: 2 }, { x: 1, y: 1, color: 3 }, { x: 2, y: 1, color: 1 }] },
  { weight: 2.25, pixels: [{ x: 0, y: 0, color: 1 }, { x: 1, y: 0, color: 2 }, { x: 2, y: 0, color: 4 }, { x: 0, y: 1, color: 0 }, { x: 1, y: 1, color: 3 }, { x: 2, y: 1, color: 2 }] }
]);
const PLATE_SHARD_COLORS = Object.freeze(["#ffffff", "#f3f4f6", "#cbd5e1", "#9ca3af", "#6b7280"]);
const PLATE_SHARD_PATTERNS = Object.freeze([
  { weight: 12, pixels: [{ x: 0, y: 0, color: 2 }] },
  { weight: 10, pixels: [{ x: 0, y: 0, color: 0 }, { x: 1, y: 0, color: 3 }] },
  { weight: 8, pixels: [{ x: 0, y: 0, color: 1 }, { x: 0, y: 1, color: 3 }] },
  { weight: 7, pixels: [{ x: 0, y: 0, color: 2 }, { x: 1, y: 0, color: 0 }, { x: 1, y: 1, color: 4 }] },
  { weight: 5, pixels: [{ x: 0, y: 0, color: 0 }, { x: 1, y: 0, color: 1 }, { x: 2, y: 0, color: 4 }] },
  { weight: 4.5, pixels: [{ x: 0, y: 0, color: 1 }, { x: 1, y: 0, color: 2 }, { x: 0, y: 1, color: 3 }, { x: 1, y: 1, color: 0 }] },
  { weight: 3.5, pixels: [{ x: 0, y: 0, color: 1 }, { x: 1, y: 0, color: 2 }, { x: 1, y: 1, color: 0 }, { x: 2, y: 1, color: 4 }] },
  { weight: 2.5, pixels: [{ x: 0, y: 0, color: 0 }, { x: 1, y: 0, color: 2 }, { x: 2, y: 0, color: 4 }, { x: 1, y: 1, color: 1 }, { x: 2, y: 1, color: 3 }] }
]);
const ENEMY_PLATE_CONSUME_ICD = 0.1;

function pickWeightedPixelPattern(weightedPatterns) {
  const totalWeight = weightedPatterns.reduce((sum, entry) => sum + (entry.weight || 0), 0);
  let roll = Math.random() * Math.max(0.0001, totalWeight);
  for (const entry of weightedPatterns) {
    roll -= entry.weight || 0;
    if (roll <= 0) return entry.pixels;
  }
  return weightedPatterns[weightedPatterns.length - 1]?.pixels || [];
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

function segmentIntersectsRect(ax, ay, bx, by, rect) {
  const dx = bx - ax;
  const dy = by - ay;
  let entry = 0;
  let exit = 1;

  const clip = (p, q) => {
    if (Math.abs(p) < 0.000001) return q >= 0;
    const ratio = q / p;
    if (p < 0) {
      if (ratio > exit) return false;
      if (ratio > entry) entry = ratio;
      return true;
    }
    if (ratio < entry) return false;
    if (ratio < exit) exit = ratio;
    return true;
  };

  return clip(-dx, ax - rect.x)
    && clip(dx, rect.x + rect.w - ax)
    && clip(-dy, ay - rect.y)
    && clip(dy, rect.y + rect.h - ay);
}

function getCachedPlayerCenter(game) {
  return game.getPlayerCenter?.() || centerOf(game.player);
}

function getLivingEnemies(game) {
  return game.getLivingEnemies?.() || game.enemies || [];
}

export function createCombatState(skillIds = []) {
  return {
    attackCooldown: 0,
    assistCooldown: 0,
    castTimer: 0,
    contactCooldown: 0,
    hitStopTimer: 0,
    overrideAimPointOnce: null,
    playerAction: null,
    playerBeam: null,
    playerProjectiles: [],
    enemyProjectiles: [],
    enemyAreaHitboxes: [],
    impactVfx: [],
    damagePopups: [],
    critBursts: [],
    enemyHitParticles: [],
    enemyBloodDecals: [],
    skillRuntime: createSkillRuntime(skillIds),
    weaponArtRuntime: createWeaponArtRuntime()
  };
}

function pushDamagePopup(game, x, y, text, options = {}) {
  game.combat.damagePopups.push({
    x,
    y,
    text,
    age: 0,
    duration: options.duration ?? 0.55,
    riseSpeed: options.riseSpeed ?? 42,
    color: options.color ?? null,
    strokeColor: options.strokeColor ?? null,
    scale: options.scale ?? 1,
    isCrit: !!options.isCrit
  });
}

export function spawnDamagePopup(game, x, y, text, options = {}) {
  pushDamagePopup(game, x, y, text, options);
}

function pushCritBurst(game, x, y) {
  game.combat.critBursts.push({
    x,
    y,
    age: 0,
    duration: 0.18,
    radius: 18
  });
}

function getNecromancerLifePotionKillValue(enemy) {
  if (enemy?.isMiniBoss || enemy?.enemyTier === "miniBoss") return 5;
  if (enemy?.isElite || enemy?.enemyTier === "elite") return 2;
  return 1;
}

function awardNecromancerLifePotionCharge(game, enemy) {
  if (game.heroDef?.id !== "dark_mage") return;
  const player = game.player;
  if (!player) return;
  const maxCharges = Math.max(0, player.lifePotionMaxCharges || 0);
  const currentCharges = Math.max(0, player.lifePotionCharges || 0);
  if (maxCharges <= 0 || currentCharges >= maxCharges) return;

  const killValue = getNecromancerLifePotionKillValue(enemy);
  player.lifePotionKillProgress = Math.max(0, player.lifePotionKillProgress || 0) + killValue;
  while (player.lifePotionKillProgress >= NECROMANCER_LIFE_POTION_KILLS_PER_CHARGE && player.lifePotionCharges < maxCharges) {
    player.lifePotionKillProgress -= NECROMANCER_LIFE_POTION_KILLS_PER_CHARGE;
    player.lifePotionCharges = Math.min(maxCharges, player.lifePotionCharges + 1);
    const playerCenter = centerOf(player);
    pushDamagePopup(game, playerCenter.x, player.y - 18, "Potion +1", {
      color: "#93c5fd",
      strokeColor: "#0f172a",
      duration: 0.8,
      riseSpeed: 28,
      scale: 0.95
    });
  }
}

function playAudioClone(audio, options = {}) {
  return playThrottledAudio(audio, options);
}

function playPlayerHitAudio(game) {
  const knightHitSfx = game.assets?.knightEnemyHitSfx;
  const enemyHurtSfx = game.assets?.enemyHurtSfx;
  if (knightHitSfx) {
    playAudioClone(knightHitSfx, {
      volume: Math.min(1, (knightHitSfx.volume || 0.24) * randomRange(0.92, 1.08)),
      playbackRate: randomRange(0.94, 1.08)
    });
  }
  if (enemyHurtSfx) {
    playAudioClone(enemyHurtSfx, {
      volume: Math.min(1, (enemyHurtSfx.volume || 0.2) * randomRange(0.9, 1.12)),
      playbackRate: randomRange(0.96, 1.1)
    });
  }
}

function randomRange(min = 0, max = 1) {
  return min + Math.random() * Math.max(0, max - min);
}

function spawnGroundImpactDirtParticles(game, hitbox) {
  if (!game?.combat?.enemyHitParticles || !Number.isFinite(hitbox?.x) || !Number.isFinite(hitbox?.y)) return;
  const baseRadius = Math.max(28, hitbox.radius ?? 0);
  const rowScales = [0.45, 0.72, 1];
  for (let rowIndex = 0; rowIndex < rowScales.length; rowIndex += 1) {
    const rowScale = rowScales[rowIndex];
    const count = 4 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i += 1) {
      const laneT = count === 1 ? 0.5 : i / (count - 1);
      const horizontalBias = (laneT - 0.5) * 2;
      const angle = (-Math.PI / 2) + horizontalBias * 1.05 + randomRange(-0.18, 0.18);
      const speed = randomRange(155, 250) * (0.94 + rowScale * 0.22);
      const vx = Math.cos(angle) * speed * randomRange(1.05, 1.35);
      const vy = Math.sin(angle) * speed - randomRange(28, 72);
      const pattern = pickWeightedPixelPattern(GROUND_DIRT_PATTERNS);
      const patternWidth = pattern.reduce((max, pixel) => Math.max(max, pixel.x + 1), 1);
      const patternHeight = pattern.reduce((max, pixel) => Math.max(max, pixel.y + 1), 1);
      const spawnSpreadX = baseRadius * rowScale * 0.85;
      const spawnX = hitbox.x + horizontalBias * spawnSpreadX + randomRange(-8, 8);
      const spawnY = hitbox.y + randomRange(-8, 5) + rowIndex * 4;
      const velocityAngle = Math.atan2(vy, vx);
      game.combat.enemyHitParticles.push({
        kind: "groundDirt",
        x: spawnX,
        y: spawnY,
        vx,
        vy,
        gravity: randomRange(280, 420),
        drag: randomRange(0.65, 1.05),
        age: 0,
        duration: randomRange(0.24, 0.38),
        rotation: velocityAngle,
        angularVelocity: randomRange(-7.5, 7.5),
        velocityFollow: 0.28,
        pixelSize: 2 + Math.floor(Math.random() * 2),
        pattern,
        patternWidth,
        patternHeight,
        colors: GROUND_DIRT_COLORS
      });
    }
  }
}

function playEnemyHitAudioPreset(game, presetKey) {
  if (!presetKey) return false;
  const preset = ENEMY_HIT_AUDIO_PRESETS[presetKey];
  if (!preset) return false;
  const baseAudio = game.assets?.[preset.baseAsset] || game.assets?.[preset.fallbackBaseAsset] || null;
  if (!baseAudio) return false;
  const dbJitterRange = preset.baseVolumeDbJitter ?? 3;
  const dbJitter = randomRange(-dbJitterRange * 0.5, dbJitterRange * 0.5);
  const gainJitter = 10 ** (dbJitter / 20);
  playAudioClone(baseAudio, {
    volume: Math.min(1, (baseAudio.volume || 0.24) * gainJitter),
    playbackRate: randomRange(preset.basePlaybackRateMin ?? 1, preset.basePlaybackRateMax ?? 1),
    currentTime: preset.baseCurrentTime ?? 0
  });
  const layerAudio = preset.layerAsset ? game.assets?.[preset.layerAsset] : null;
  if (layerAudio) {
    playAudioClone(layerAudio, {
      volume: Math.min(1, (layerAudio.volume || 0.16) * (preset.layerVolumeMult ?? 1)),
      playbackRate: randomRange(preset.layerPlaybackRateMin ?? 1, preset.layerPlaybackRateMax ?? 1),
      currentTime: preset.layerCurrentTime ?? 0
    });
  }
  return true;
}

function createEnemyDamageResult(overrides = {}) {
  return {
    hit: false,
    damage: 0,
    killed: false,
    guarded: false,
    plateBlocked: false,
    plateBroken: false,
    brokeLastPlate: false,
    preventedDeath: false,
    ...overrides
  };
}

export function enemyHasPlates(enemy) {
  return Math.max(0, Math.floor(enemy?.plates || 0)) > 0;
}

function getEnemyPlateMaxDurability(enemy) {
  return Math.max(1, enemy?.plateMaxDurability || (enemy?.maxHp || 1) * 0.1);
}

function ensureEnemyPlateDurability(enemy) {
  if (!enemyHasPlates(enemy)) {
    enemy.plateDurability = 0;
    return 0;
  }
  const maxDurability = getEnemyPlateMaxDurability(enemy);
  if (!Number.isFinite(enemy.plateDurability) || enemy.plateDurability <= 0) {
    enemy.plateDurability = maxDurability;
  }
  return enemy.plateDurability;
}

export function consumeEnemyPlate(game, enemy, options = {}) {
  if (!enemy || enemy.dead || !enemyHasPlates(enemy)) return false;
  if (options.respectCooldown !== false && (enemy.plateConsumeCooldownTimer || 0) > 0) return true;
  const previousPlates = Math.max(0, Math.floor(enemy.plates || 0));
  enemy.plates = Math.max(0, Math.floor(enemy.plates || 0) - 1);
  const brokeLastPlate = previousPlates > 0 && enemy.plates <= 0;
  enemy.plateDurability = enemyHasPlates(enemy) ? getEnemyPlateMaxDurability(enemy) : 0;
  if (options.applyCooldown !== false && enemyHasPlates(enemy)) {
    enemy.plateConsumeCooldownTimer = Math.max(enemy.plateConsumeCooldownTimer || 0, ENEMY_PLATE_CONSUME_ICD);
  }
  enemy.showHealthBar = true;
  const enemyCenter = centerOf(enemy);
  pushPlateBreakParticles(game, enemy, {
    count: brokeLastPlate ? 16 : 10,
    pixelSize: brokeLastPlate ? 4 : 3,
    finalBreak: brokeLastPlate
  });
  const plateHitSfx = brokeLastPlate
    ? game.assets?.enemyPlateHitShieldSfx
    : game.assets?.enemyPlateHitArmorSfx;
  if (plateHitSfx) {
    const dbJitter = Math.random() * 4 - 2;
    const gainJitter = 10 ** (dbJitter / 20);
    playAudioClone(plateHitSfx, {
      volume: Math.min(1, (plateHitSfx.volume || 0.2) * gainJitter),
      playbackRate: 0.94 + (Math.random() * 0.18),
      currentTime: Math.random() * 0.02
    });
  }
  pushDamagePopup(game, enemyCenter.x, enemyCenter.y - enemy.h * 0.42, options.text || "BLOCK", {
    color: options.color ?? "#cbd5e1",
    strokeColor: options.strokeColor ?? "#0f172a",
    duration: options.duration ?? 0.42,
    riseSpeed: options.riseSpeed ?? 32,
    scale: options.scale ?? 0.9
  });
  if (brokeLastPlate) {
    applyEnemyPlateBreakStagger(game, enemy, options.breakMeta || {});
  }
  return true;
}

function pushPlateHitFeedback(game, enemy, options = {}) {
  const enemyCenter = centerOf(enemy);
  const plateHitSfx = options.brokePlate
    ? game.assets?.enemyPlateHitShieldSfx
    : game.assets?.enemyPlateHitArmorSfx;
  if (plateHitSfx) {
    const dbJitter = Math.random() * 4 - 2;
    const gainJitter = 10 ** (dbJitter / 20);
    playAudioClone(plateHitSfx, {
      volume: Math.min(1, (plateHitSfx.volume || 0.2) * gainJitter),
      playbackRate: options.brokePlate ? 0.94 + (Math.random() * 0.18) : 0.98 + (Math.random() * 0.12),
      currentTime: Math.random() * 0.02
    });
  }
  pushDamagePopup(game, enemyCenter.x, enemyCenter.y - enemy.h * 0.42, options.text || "BLOCK", {
    color: options.color ?? "#cbd5e1",
    strokeColor: options.strokeColor ?? "#0f172a",
    duration: options.duration ?? 0.42,
    riseSpeed: options.riseSpeed ?? 32,
    scale: options.scale ?? 0.9
  });
}

function absorbDamageWithEnemyPlates(game, enemy, amount, options = {}) {
  if (!enemyHasPlates(enemy) || amount <= 0) {
    return { remainingDamage: amount, blocked: false, plateBroken: false, brokeLastPlate: false };
  }
  if ((enemy.plateConsumeCooldownTimer || 0) > 0) {
    return { remainingDamage: 0, blocked: true, plateBroken: false, brokeLastPlate: false };
  }

  let remainingDamage = amount;
  let plateBroken = false;
  let brokeLastPlate = false;

  while (remainingDamage > 0.0001 && enemyHasPlates(enemy)) {
    const plateDurability = ensureEnemyPlateDurability(enemy);
    const absorbedDamage = Math.min(remainingDamage, plateDurability);
    enemy.plateDurability = Math.max(0, plateDurability - absorbedDamage);
    remainingDamage -= absorbedDamage;
    enemy.showHealthBar = true;

    if (enemy.plateDurability > 0.0001) break;

    plateBroken = true;
    const hadMultiplePlates = Math.max(0, Math.floor(enemy.plates || 0)) > 1;
    consumeEnemyPlate(game, enemy, {
      ...options,
      respectCooldown: false,
      applyCooldown: false
    });
    brokeLastPlate = !enemyHasPlates(enemy);
    if (hadMultiplePlates && enemyHasPlates(enemy)) {
      continue;
    }
  }

  if (plateBroken) {
    if (enemyHasPlates(enemy)) {
      enemy.plateConsumeCooldownTimer = Math.max(enemy.plateConsumeCooldownTimer || 0, ENEMY_PLATE_CONSUME_ICD);
    }
    return {
      remainingDamage,
      blocked: remainingDamage <= 0,
      plateBroken: true,
      brokeLastPlate
    };
  }

  if (remainingDamage < amount) {
    pushPlateHitFeedback(game, enemy, options);
    return { remainingDamage: 0, blocked: true, plateBroken: false, brokeLastPlate: false };
  }

  return { remainingDamage, blocked: false, plateBroken: false, brokeLastPlate: false };
}

function pushPlateBreakParticles(game, enemy, options = {}) {
  const center = centerOf(enemy);
  const count = Math.max(1, Math.floor(options.count ?? 6));
  const pixelSize = Math.max(2, options.pixelSize ?? 3);
  const finalBreak = !!options.finalBreak;
  for (let index = 0; index < count; index += 1) {
    const pattern = pickWeightedPixelPattern(PLATE_SHARD_PATTERNS);
    const patternWidth = pattern.reduce((max, pixel) => Math.max(max, pixel.x + 1), 1);
    const patternHeight = pattern.reduce((max, pixel) => Math.max(max, pixel.y + 1), 1);
    const angle = Math.random() * Math.PI * 2;
    const speed = 130 + Math.random() * 170 + (finalBreak ? 55 : 0);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - (28 + Math.random() * (finalBreak ? 46 : 34));
    game.combat.enemyHitParticles.push({
      kind: "plateShard",
      x: center.x + (Math.random() - 0.5) * Math.max(14, enemy.w * (finalBreak ? 0.38 : 0.28)),
      y: center.y - enemy.h * 0.12 + (Math.random() - 0.5) * Math.max(12, enemy.h * (finalBreak ? 0.28 : 0.2)),
      vx,
      vy,
      gravity: 180 + Math.random() * 110,
      drag: 0.45 + Math.random() * 0.45,
      age: 0,
      duration: 0.44 + Math.random() * (finalBreak ? 0.34 : 0.24),
      rotation: Math.random() * Math.PI * 2,
      angularVelocity: (Math.random() - 0.5) * (finalBreak ? 16 : 13),
      velocityFollow: 0.46,
      pixelSize: pixelSize + (finalBreak && index < Math.ceil(count * 0.35) ? 1 : 0),
      pattern,
      patternWidth,
      patternHeight,
      colors: PLATE_SHARD_COLORS
    });
  }
}

function isFleshBarbarian(enemy) {
  return BARBARIAN_BLOOD_ENEMY_IDS.has(enemy?.type);
}

function isSlimeEnemyParticleTarget(enemy) {
  return SLIME_ENEMY_IDS.has(enemy?.type);
}

function isUndeadEnemyParticleTarget(enemy) {
  return UNDEAD_ENEMY_IDS.includes(enemy?.type);
}

function pushSlimeDeathParticles(game, enemy, meta = {}) {
  if (!isSlimeEnemyParticleTarget(enemy)) return;
  const center = centerOf(enemy);
  const count = 10 + (meta.isCrit ? 4 : 0);
  for (let i = 0; i < count; i += 1) {
    const pattern = pickWeightedPixelPattern(SLIME_GOO_PATTERNS);
    const patternWidth = pattern.reduce((max, pixel) => Math.max(max, pixel.x + 1), 1);
    const patternHeight = pattern.reduce((max, pixel) => Math.max(max, pixel.y + 1), 1);
    const angle = Math.random() * Math.PI * 2;
    const speed = 64 + Math.random() * 128 + (meta.isCrit ? 24 : 0);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - (16 + Math.random() * 28);
    game.combat.enemyHitParticles.push({
      kind: "slimeGoo",
      x: center.x + (Math.random() - 0.5) * Math.max(16, enemy.w * 0.34),
      y: center.y - enemy.h * 0.08 + (Math.random() - 0.5) * Math.max(14, enemy.h * 0.26),
      vx,
      vy,
      gravity: 230 + Math.random() * 130,
      drag: 1 + Math.random() * 1.1,
      age: 0,
      duration: 0.42 + Math.random() * 0.3,
      rotation: (Math.random() - 0.5) * 0.45,
      angularVelocity: -2.8 + Math.random() * 5.6,
      velocityFollow: 0.14,
      pixelSize: Math.random() < 0.35 ? 3 : 2,
      pattern,
      patternWidth,
      patternHeight,
      colors: SLIME_GOO_COLORS
    });
  }
}

function playSlimeDeathAudio(game, enemy) {
  if (!isSlimeEnemyParticleTarget(enemy)) return;
  const slimeDeathSfx = game.assets?.slimeDeathSfx;
  if (!slimeDeathSfx) return;
  playAudioClone(slimeDeathSfx, {
    volume: Math.min(1, (slimeDeathSfx.volume || 0.22) * (0.86 + Math.random() * 0.28)),
    playbackRate: 0.88 + Math.random() * 0.24
  });
}

function playUndeadDeathAudio(game, enemy) {
  if (!isUndeadEnemyParticleTarget(enemy)) return;
  const candidates = [
    game.assets?.undeadDeathBoneBreakSfxA,
    game.assets?.undeadDeathBoneBreakSfxB
  ].filter(Boolean);
  if (!candidates.length) return;
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  playAudioClone(chosen, {
    volume: Math.min(1, (chosen.volume || 0.23) * (0.84 + Math.random() * 0.3)),
    playbackRate: 0.86 + Math.random() * 0.26
  });
}

function playBarbarianDeathAudio(game, enemy) {
  if (!isFleshBarbarian(enemy)) return;
  const candidates = [
    game.assets?.barbarianDeathFleshSfxA,
    game.assets?.barbarianDeathFleshSfxB
  ].filter(Boolean);
  if (!candidates.length) return;
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  playAudioClone(chosen, {
    volume: Math.min(1, (chosen.volume || 0.23) * (0.84 + Math.random() * 0.3)),
    playbackRate: 0.86 + Math.random() * 0.24
  });
}

function pushEnemyHitParticles(game, enemy, hitDir, meta = {}) {
  let kind = null;
  let colors = null;
  let patterns = null;
  let pixelSize = 2;
  let minSpeed = 0;
  let maxSpeed = 0;
  let gravityMin = 0;
  let gravityMax = 0;
  let dragMin = 0;
  let dragMax = 0;
  let durationMin = 0;
  let durationMax = 0;
  let spreadScale = 0;
  let upwardLiftMin = 0;
  let upwardLiftMax = 0;
  let spinMin = 0;
  let spinMax = 0;
  let followVelocity = 0;
  if (isFleshBarbarian(enemy)) {
    kind = "barbarianBlood";
    colors = BLOOD_PIXEL_COLORS;
    patterns = BLOOD_PIXEL_PATTERNS;
    minSpeed = 44;
    maxSpeed = 112;
    gravityMin = 240;
    gravityMax = 340;
    dragMin = 1.2;
    dragMax = 2.1;
    durationMin = 0.34;
    durationMax = 0.52;
    spreadScale = 1.1;
    upwardLiftMin = 8;
    upwardLiftMax = 24;
    spinMin = -2.8;
    spinMax = 2.8;
    followVelocity = 0.12;
  } else if (isSlimeEnemyParticleTarget(enemy)) {
    kind = "slimeGoo";
    colors = SLIME_GOO_COLORS;
    patterns = SLIME_GOO_PATTERNS;
    minSpeed = 36;
    maxSpeed = 92;
    gravityMin = 220;
    gravityMax = 310;
    dragMin = 1.1;
    dragMax = 1.9;
    durationMin = 0.32;
    durationMax = 0.56;
    spreadScale = 1;
    upwardLiftMin = 10;
    upwardLiftMax = 22;
    spinMin = -2.2;
    spinMax = 2.2;
    followVelocity = 0.16;
  } else if (isUndeadEnemyParticleTarget(enemy)) {
    kind = "undeadBoneSplinter";
    colors = BONE_SPLINTER_COLORS;
    patterns = BONE_SPLINTER_PATTERNS;
    minSpeed = 78;
    maxSpeed = 156;
    gravityMin = 180;
    gravityMax = 260;
    dragMin = 0.7;
    dragMax = 1.35;
    durationMin = 0.26;
    durationMax = 0.42;
    spreadScale = 0.62;
    upwardLiftMin = 4;
    upwardLiftMax = 16;
    spinMin = -8.5;
    spinMax = 8.5;
    followVelocity = 0.45;
  } else {
    return;
  }
  const center = centerOf(enemy);
  const particleDirX = -hitDir.x;
  const particleDirY = -hitDir.y;
  for (let i = 0; i < 4; i += 1) {
    const useRandomBurst = true;
    const spread = (Math.random() - 0.5) * spreadScale;
    const speed = minSpeed + Math.random() * (maxSpeed - minSpeed) + (meta.isCrit ? 18 : 0);
    const angle = useRandomBurst
      ? Math.random() * Math.PI * 2
      : Math.atan2(particleDirY, particleDirX) + spread;
    const pattern = pickWeightedPixelPattern(patterns);
    const patternWidth = pattern.reduce((max, pixel) => Math.max(max, pixel.x + 1), 1);
    const patternHeight = pattern.reduce((max, pixel) => Math.max(max, pixel.y + 1), 1);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - (upwardLiftMin + Math.random() * (upwardLiftMax - upwardLiftMin));
    const velocityAngle = Math.atan2(vy, vx);
    const spin = spinMin + Math.random() * (spinMax - spinMin);
    game.combat.enemyHitParticles.push({
      kind,
      x: center.x + (useRandomBurst ? (Math.random() - 0.5) * 8 : particleDirX * Math.max(6, enemy.w * 0.1)) + (Math.random() - 0.5) * 5,
      y: center.y + (useRandomBurst ? (Math.random() - 0.5) * 8 : particleDirY * Math.max(4, enemy.h * 0.08)) - enemy.h * 0.08 + (Math.random() - 0.5) * 5,
      vx,
      vy,
      gravity: gravityMin + Math.random() * (gravityMax - gravityMin),
      drag: dragMin + Math.random() * (dragMax - dragMin),
      age: 0,
      duration: durationMin + Math.random() * (durationMax - durationMin),
      rotation: kind === "barbarianBlood" || kind === "slimeGoo" ? (Math.random() - 0.5) * 0.45 : velocityAngle,
      angularVelocity: spin,
      velocityFollow: followVelocity,
      pixelSize,
      pattern,
      patternWidth,
      patternHeight,
      colors
    });
  }
}

export function spawnEnemyProjectile(game, enemy, directionOrConfig) {
  const config = "dirX" in directionOrConfig
    ? directionOrConfig
    : {
        dirX: directionOrConfig.x,
        dirY: directionOrConfig.y,
        damage: enemy.damage,
        speed: enemy.projectileSpeed || 300,
        radius: 10,
        size: 20,
        color: "#f59e0b"
      };
  const baseOrigin = centerOf(enemy);
  const origin = {
    x: config.x ?? baseOrigin.x,
    y: config.y ?? baseOrigin.y
  };
  const length = Math.hypot(config.dirX, config.dirY) || 1;
  const dirX = config.dirX / length;
  const dirY = config.dirY / length;
  const projectile = {
    x: origin.x,
    y: origin.y,
    radius: config.radius ?? 10,
    drawSize: config.size ?? (config.radius ?? 10) * 2,
    damage: config.damage ?? enemy.damage,
    speed: config.speed || 300,
    vx: dirX * (config.speed || 300),
    vy: dirY * (config.speed || 300),
    traveled: 0,
    maxRange: config.maxRange ?? 560,
    lifetime: config.lifetime ?? null,
    age: 0,
    color: config.color ?? "#f59e0b",
    sourceEnemyId: enemy.id,
    spriteAsset: config.spriteAsset ?? null,
    spriteFrames: config.spriteFrames ?? null,
    spriteFrameWidth: config.spriteFrameWidth ?? null,
    spriteFrameHeight: config.spriteFrameHeight ?? null,
    spriteFps: config.spriteFps ?? null,
    spriteFrameOffset: config.spriteFrameOffset ?? 0,
    spriteLoopStart: config.spriteLoopStart ?? null,
    spriteLoopEnd: config.spriteLoopEnd ?? null,
    spriteEndStart: config.spriteEndStart ?? null,
    spriteEndFrames: config.spriteEndFrames ?? null,
    spriteEndDistance: config.spriteEndDistance ?? null,
    spriteCropWidth: config.spriteCropWidth ?? null,
    spriteCropHeight: config.spriteCropHeight ?? null,
    sourceAttackId: config.sourceAttackId ?? null,
    impactSprite: config.impactSprite ?? null,
    impactFrames: config.impactFrames ?? null,
    impactFrameWidth: config.impactFrameWidth ?? null,
    impactFrameHeight: config.impactFrameHeight ?? null,
    impactFps: config.impactFps ?? null,
    impactSize: config.impactSize ?? null,
    trailInterval: config.trailInterval ?? null,
    trailTimer: config.trailInterval ?? 0,
    trailChild: config.trailChild ?? null,
    gravityX: config.gravityX ?? 0,
    gravityY: config.gravityY ?? 0,
    verticalWaveAmplitude: config.verticalWaveAmplitude ?? 0,
    verticalWaveFrequency: config.verticalWaveFrequency ?? 0,
    verticalWavePhase: config.verticalWavePhase ?? 0,
    speedRampDuration: config.speedRampDuration ?? 0,
    speedRampMaxMult: config.speedRampMaxMult ?? 1,
    baseSpeed: config.baseSpeed ?? (config.speed || 300),
    homingRadius: config.homingRadius ?? 0,
    homingTurnRate: config.homingTurnRate ?? 0,
    knockback: config.knockback ?? 0,
    slowMult: config.slowMult ?? 1,
    slowDuration: config.slowDuration ?? 0,
    stunDuration: config.stunDuration ?? 0,
    poisonDps: config.poisonDps ?? 0,
    poisonDuration: config.poisonDuration ?? 0,
    boomerang: !!config.boomerang,
    returnAfter: config.returnAfter ?? null,
    returnSpeedMult: config.returnSpeedMult ?? 1.1,
    outbound: true,
    ownerX: origin.x,
    ownerY: origin.y
  };
  syncProjectileRangeToSpeed(projectile, {
    baseSpeed: config.baseSpeed ?? projectile.speed,
    baseMaxRange: config.baseMaxRange ?? projectile.maxRange
  });
  game.combat.enemyProjectiles.push(projectile);
}

export function spawnEnemyAreaHitbox(game, hitbox) {
  const activeDuration = hitbox.duration ?? 0.1;
  const visualDuration = hitbox.visualDuration ?? activeDuration;
  if (hitbox.shape === "circle" && hitbox.groundImpactSprite && !hitbox.suppressGroundImpactParticles) {
    spawnGroundImpactDirtParticles(game, hitbox);
  }
  game.combat.enemyAreaHitboxes.push({
    ...hitbox,
    radiusY: hitbox.radiusY ?? (Number.isFinite(hitbox.radius) ? hitbox.radius * 0.75 : hitbox.radiusY),
    duration: activeDuration,
    visualDuration,
    lifetime: Math.max(activeDuration, visualDuration),
    age: 0,
    hit: false
  });
}

function tryMoveEnemyWithCollision(game, enemy, dx, dy) {
  const world = game.world;
  const blockers = game.getCollisionBlockers
    ? game.getCollisionBlockers({ includeBreakables: true })
    : [
        ...(world?.collisionRects || []),
        ...getBlockingBreakableRects(game)
      ];
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) return;

  const stepSize = 8;
  const steps = Math.max(1, Math.ceil(distance / stepSize));
  const stepX = dx / steps;
  const stepY = dy / steps;

  for (let index = 0; index < steps; index += 1) {
    const previousX = enemy.x;
    const previousY = enemy.y;
    const nextX = Math.max(0, Math.min(world.width - enemy.w, enemy.x + stepX));
    const nextY = Math.max(0, Math.min(world.height - enemy.h, enemy.y + stepY));
    const testX = { x: nextX, y: enemy.y, w: enemy.w, h: enemy.h };
    const testY = { x: enemy.x, y: nextY, w: enemy.w, h: enemy.h };
    let moveX = nextX;
    let moveY = nextY;
    for (const wall of blockers) {
      if (rectsOverlap(testX, wall)) moveX = enemy.x;
      if (rectsOverlap(testY, wall)) moveY = enemy.y;
    }
    enemy.x = moveX;
    enemy.y = moveY;
    if (enemy.x === previousX && enemy.y === previousY) break;
  }
}

function shouldApplyEnemyHitReaction(meta = {}) {
  if (meta.source === "basic") return true;
  if (meta.source === "skill" && meta.isDirect === true) return true;
  return false;
}

function getEnemyHitDirection(game, enemy, meta = {}) {
  const enemyCenter = centerOf(enemy);
  const playerCenter = getCachedPlayerCenter(game);
  return normalize(
    meta.hitDirX ?? (enemyCenter.x - playerCenter.x),
    meta.hitDirY ?? (enemyCenter.y - playerCenter.y),
    { x: 1, y: 0 }
  );
}

function applyEnemyHitReaction(game, enemy, meta = {}) {
  if (!shouldApplyEnemyHitReaction(meta) || enemy.dead) return;
  if (enemy.ignoreStagger) return;
  if (enemyHasPlates(enemy)) return;
  if (!enemyCanBeDisplaced(enemy)) return;
  const poise = enemy.poiseMult ?? 1;
  if (poise <= 0) return;
  const hitDir = getEnemyHitDirection(game, enemy, meta);
  const hitDuration = Math.max(0, meta.hitDuration ?? (0.08 + 0.04 * poise));
  const staggerPause = Math.max(0, meta.staggerPause ?? (0.04 + 0.03 * poise));
  const staggerDuration = Math.max(0.01, meta.staggerDuration ?? (0.1 + 0.06 * poise));
  const recoilDistance = Math.max(0, meta.recoilDistance ?? ((meta.source === "skill" ? 10 : 6) * poise));

  enemy.hitDuration = Math.max(enemy.hitDuration || 0, hitDuration);
  enemy.hitTimer = Math.max(enemy.hitTimer || 0, hitDuration);
  enemy.staggerDuration = Math.max(enemy.staggerDuration || 0, staggerDuration);
  enemy.staggerTimer = Math.max(enemy.staggerTimer || 0, staggerDuration);
  enemy.staggerPauseTimer = Math.max(enemy.staggerPauseTimer || 0, staggerPause);
  enemy.hitDirX = hitDir.x;
  enemy.hitDirY = hitDir.y;
  enemy.staggerMoveSpeed = recoilDistance / Math.max(0.001, staggerDuration);
  enemy.hitInterruptPending = true;
  enemy.hitInterruptPauseDuration = staggerPause;
  enemy.hitInterruptStaggerDuration = staggerDuration;
  enemy.hitInterruptBeforeWindupCommitOnly = !!meta.hitInterruptBeforeWindupCommitOnly;
}

function getEnemyAnimationDuration(sheet, fallback = 0) {
  if (!sheet) return fallback;
  const frames = Math.max(1, Number(sheet.frames) || 1);
  const fps = Math.max(0.001, Number(sheet.fps) || 1);
  return frames / fps;
}

function noteEnemyRecentDamage(game, enemy, damage) {
  enemy.recentDamageEvents ||= [];
  const now = game.time || 0;
  const cutoff = now - ENEMY_DAMAGE_BURST_WINDOW_SECONDS;
  enemy.recentDamageEvents = enemy.recentDamageEvents.filter((entry) => entry.time >= cutoff);
  const totalBeforeHit = enemy.recentDamageEvents.reduce((total, entry) => total + entry.damage, 0);
  enemy.recentDamageEvents.push({ time: now, damage });
  return {
    now,
    totalBeforeHit,
    totalAfterHit: totalBeforeHit + damage
  };
}

function getBurstHitReactionMeta(enemy, meta, recentDamageWindow) {
  if (!(enemy?.maxHp > 0)) return meta;
  const threshold = enemy.maxHp * ENEMY_DAMAGE_BURST_HP_RATIO;
  if (!(recentDamageWindow?.totalBeforeHit <= threshold && recentDamageWindow?.totalAfterHit > threshold)) return meta;
  const now = recentDamageWindow?.now ?? 0;
  if ((enemy.burstHeavyStaggerCooldownUntil ?? -Infinity) > now) return meta;
  const hitDuration = getEnemyAnimationDuration(enemy.sprite?.hit, 0);
  if (hitDuration <= 0) return meta;
  if ((enemy.burstHeavyStaggerActiveUntil ?? -Infinity) > now) return meta;
  enemy.burstHeavyStaggerActiveUntil = now + hitDuration;
  enemy.burstHeavyStaggerCooldownUntil = now + ENEMY_DAMAGE_BURST_STAGGER_COOLDOWN_SECONDS;
  enemy.recentDamageEvents = [];
  return {
    ...meta,
    hitDuration,
    staggerDuration: hitDuration,
    hitInterruptBeforeWindupCommitOnly: true
  };
}

function applyEnemyPlateBreakStagger(game, enemy, meta = {}) {
  if (!enemy || enemy.dead) return;
  applyEnemyHitReaction(game, enemy, {
    source: "basic",
    hitDirX: meta.hitDirX,
    hitDirY: meta.hitDirY,
    hitDuration: meta.hitDuration ?? 0.24,
    staggerPause: meta.staggerPause ?? 0.14,
    staggerDuration: meta.staggerDuration ?? 0.46,
    recoilDistance: meta.recoilDistance ?? 72,
    instantRecoil: meta.instantRecoil ?? true
  });
}

export function damageEnemy(game, enemy, amount, meta = {}) {
  const guard = enemy.attackRuntime?.guard;
  if (guard?.active) {
    const enemyCenter = centerOf(enemy);
    const playerCenter = getEnemyTargetCenter(game);
    const toPlayer = normalize(playerCenter.x - enemyCenter.x, playerCenter.y - enemyCenter.y, { x: 1, y: 0 });
    const front = normalize(guard.dirX, guard.dirY, { x: 1, y: 0 });
    const dot = toPlayer.x * front.x + toPlayer.y * front.y;
    if (dot >= 0) return createEnemyDamageResult({ guarded: true });
  }
  if (!meta.bypassPlates && enemyHasPlates(enemy)) {
    const plateResult = absorbDamageWithEnemyPlates(game, enemy, amount, {
      ...(meta.plateBlockOptions || {}),
      breakMeta: {
        hitDirX: meta.hitDirX,
        hitDirY: meta.hitDirY,
        ...(meta.plateBlockOptions?.breakMeta || {})
      }
    });
    if (plateResult.blocked) {
      return createEnemyDamageResult({
        plateBlocked: true,
        plateBroken: plateResult.plateBroken,
        brokeLastPlate: plateResult.brokeLastPlate
      });
    }
    amount = plateResult.remainingDamage;
    meta = plateResult.brokeLastPlate
      ? { ...meta, suppressHitReaction: true }
      : meta;
  }
  let resolvedMeta = { ...meta };
  const canAutoCrit = resolvedMeta.isCrit == null && resolvedMeta.source !== "ring" && resolvedMeta.source !== "burn";
  if (canAutoCrit && rollLuckyChance(game, getPlayerCritChance(game.player))) {
    resolvedMeta.isCrit = true;
    amount *= getPlayerCritDamage(game.player);
  } else if (resolvedMeta.isCrit == null) {
    resolvedMeta.isCrit = false;
  }
  const ringAdjusted = modifyOutgoingPlayerDamage(game, enemy, amount, resolvedMeta);
  const appliedDamage = modifyDamageAgainstEnemy(enemy, ringAdjusted);
  if (appliedDamage <= 0) return createEnemyDamageResult();

  const now = game.time || 0;
  const feedbackCooldown = meta.feedbackCooldown ?? 0;
  const hasFeedbackCooldown = feedbackCooldown > 0;
  const feedbackExpired = (enemy.hitFeedbackTimer ?? 0) <= now;
  const shouldSuppressFeedback = hasFeedbackCooldown && !feedbackExpired && !resolvedMeta.isCrit;

  if (!shouldSuppressFeedback && hasFeedbackCooldown) {
    enemy.hitFeedbackTimer = now + feedbackCooldown;
  }

  const wasFullHp = enemy.hp >= enemy.maxHp;
  const enemyCenter = centerOf(enemy);
  enemy.hp -= appliedDamage;
  const recentDamageWindow = noteEnemyRecentDamage(game, enemy, appliedDamage);
  enemy.showHealthBar = true;

  const showPopup = !meta.suppressDamagePopup && (!shouldSuppressFeedback || (enemy.hp <= 0));
  if (showPopup) {
    pushDamagePopup(game, enemyCenter.x, enemyCenter.y - enemy.h * 0.3, `${Math.round(appliedDamage)}`, {
      color: resolvedMeta.color || (resolvedMeta.isCrit ? "#fde047" : "#f8fafc"),
      scale: resolvedMeta.scale || (resolvedMeta.isCrit ? 1.22 : 1),
      duration: resolvedMeta.isCrit ? 0.68 : 0.55,
      riseSpeed: resolvedMeta.isCrit ? 52 : 42,
      isCrit: !!resolvedMeta.isCrit
    });
  }

  if (resolvedMeta.isCrit) {
    enemy.critFlashDuration = Math.max(enemy.critFlashDuration || 0, 0.2);
    enemy.critFlashTimer = Math.max(enemy.critFlashTimer || 0, enemy.critFlashDuration);
    pushCritBurst(game, enemyCenter.x, enemyCenter.y);
    game.camera?.triggerShake?.(PLAYER_CRIT_SHAKE_MAGNITUDE, PLAYER_CRIT_SHAKE_DURATION);
    game.triggerCritHitSlow?.();
  }

  if (!resolvedMeta.suppressHitAudio && !shouldSuppressFeedback) {
    if (!playEnemyHitAudioPreset(game, resolvedMeta.enemyHitAudioPreset)) {
      const enemyHurtSfx =
        game.heroDef?.id === "dark_mage"
          ? (game.assets?.darkMageEnemyHitSfx || game.assets?.enemyHurtSfx)
          : game.heroDef?.id === "knight" || game.heroDef?.id === "death_knight"
            ? (game.assets?.knightEnemyHitSfx || game.assets?.enemyHurtSfx)
            : game.assets?.enemyHurtSfx;
      if (enemyHurtSfx) {
        const isKnightSlice = enemyHurtSfx === game.assets?.knightEnemyHitSfx;
        const isDarkMageHit = enemyHurtSfx === game.assets?.darkMageEnemyHitSfx;
        const dbJitter = Math.random() * 3 - 1.5;
        const gainJitter = 10 ** (dbJitter / 20);
        playAudioClone(enemyHurtSfx, {
          volume: Math.min(1, (enemyHurtSfx.volume || 0.24) * gainJitter),
          playbackRate: isKnightSlice
            ? 1.12 + (Math.random() * 0.12 - 0.06)
            : isDarkMageHit
              ? 1.04 + (Math.random() * 0.18 - 0.09)
              : 1 + (Math.random() * 0.2 - 0.1),
          currentTime: isKnightSlice ? 0.05 : 0
        });
        if (isDarkMageHit && game.assets?.darkMageEnemyHitLayerSfx) {
          playAudioClone(game.assets.darkMageEnemyHitLayerSfx, {
            volume: game.assets.darkMageEnemyHitLayerSfx.volume,
            playbackRate: 1.08 + (Math.random() * 0.12 - 0.06)
          });
        }
        if (isKnightSlice && game.assets?.knightEnemyHitLayerSfx) {
          playAudioClone(game.assets.knightEnemyHitLayerSfx, {
            volume: game.assets.knightEnemyHitLayerSfx.volume,
            playbackRate: 1.06 + (Math.random() * 0.14 - 0.07)
          });
        }
      }
    }
  }
  if (meta.source === "projectile" && game.assets?.enemyHurtSfx) {
    playAudioClone(game.assets.enemyHurtSfx, {
      volume: game.assets.enemyHurtSfx.volume,
      playbackRate: 1 + (Math.random() * 0.2 - 0.1)
    });
  }
  pushEnemyHitParticles(game, enemy, getEnemyHitDirection(game, enemy, resolvedMeta), resolvedMeta);
  applyInfernoBurnOnHit(game, enemy, resolvedMeta);
  onPlayerDealtDamageForSkills(game, appliedDamage);
  onRingHit(game, enemy, { ...resolvedMeta, damage: appliedDamage });
  onFingerHit(game, enemy, resolvedMeta);
  if (enemy.hp > 0) {
    if (!resolvedMeta.suppressHitReaction) {
      applyEnemyHitReaction(game, enemy, getBurstHitReactionMeta(enemy, { ...resolvedMeta, game }, recentDamageWindow));
    }
    onEnemyDamagedByPlayer(game, enemy, appliedDamage);
    return createEnemyDamageResult({ hit: true, damage: appliedDamage });
  }
  if (tryPreventEnemyDeath(game, enemy)) {
    return createEnemyDamageResult({ hit: true, damage: appliedDamage, preventedDeath: true });
  }
  pushSlimeDeathParticles(game, enemy, meta);
  playSlimeDeathAudio(game, enemy);
  playUndeadDeathAudio(game, enemy);
  playBarbarianDeathAudio(game, enemy);
  if (enemy.isMiniBoss) {
    const enemyCenter = centerOf(enemy);
    game.lastMinibossDeathPosition = { x: enemyCenter.x, y: enemyCenter.y };
  }
  if (tryReviveEnemyOnKill(game, enemy, resolvedMeta)) {
    onEnemyDamagedByPlayer(game, enemy, appliedDamage);
    game.markEnemiesDirty?.();
    return createEnemyDamageResult({ hit: true, damage: appliedDamage });
  }
  enemy.dead = true;
  game.markEnemiesDirty?.();
  onEnemyKilledByPlayer(game, enemy);
  onEnemyKilledForSkills(game);
  awardNecromancerLifePotionCharge(game, enemy);
  onRingEnemyKilled(game, enemy, { wasFullHp, meta: resolvedMeta });
  onFingerEnemyKilled(game, enemy, { wasFullHp });
  spawnGoldDropsForEnemy(game, enemy);
  spawnExperienceDropsForEnemy(game, enemy);
  maybeSpawnMaterialDropForEnemy(game, enemy);
  game.kills += 1;
  game.roomKills += 1;
  game.player.damageBonus = Math.min(0.2, game.player.damageBonus + 0.01);
  game.player.damageBonusTimer = 5;
  return createEnemyDamageResult({ hit: true, damage: appliedDamage, killed: true });
}

function damageEnemyTestTarget(game, target, amount) {
  if (game.combat.contactCooldown > 0 || game.state !== "running" || amount <= 0) return false;
  target.hp = Math.max(0, target.hp - amount);
  target.showHealthBar = true;
  target.hitTimer = Math.max(target.hitTimer || 0, 0.2);
  game.combat.contactCooldown = 0.2;
  if (target.hp <= 0) {
    target.dead = true;
    game.markEnemiesDirty?.();
    if (game.enemyTest) {
      game.enemyTest.dummyRespawnTimer = Math.max(game.enemyTest.dummyRespawnTimer || 0, 0.75);
    }
  }
  return true;
}

export function damagePlayer(game, amount, sourceEnemy = null) {
  if (game.combat.contactCooldown > 0 || game.state !== "running") return false;
  if (game.player.isInvisible || game.player.spiritMode?.active) return false;
  const reactiveHitAssistCooldown = game.combat.weaponArtRuntime?.reactiveHitAssistCooldown || 0;
  const canTriggerReactiveAssist =
    game.heroDef?.id === "death_knight" &&
    game.weaponArt?.id === "bladeBlast" &&
    reactiveHitAssistCooldown <= 0 &&
    !game.combat.playerAction;
  const incoming = modifyIncomingPlayerDamage(game, amount, sourceEnemy);
  amount = incoming.damage ?? 0;
  if (amount <= 0) return false;
  const shield = Math.max(0, game.player.damageShield || 0);
  let shieldBroken = false;
  if (shield > 0) {
    if (incoming.negateShieldOverflow && amount > shield) amount = shield;
    const absorbed = Math.min(shield, amount);
    game.player.damageShield = shield - absorbed;
    amount -= absorbed;
    shieldBroken = shield > 0 && game.player.damageShield <= 0 && absorbed > 0;
    if (shieldBroken && incoming.shieldBreakShockwave) {
      const shockwave = incoming.shieldBreakShockwave;
      const origin = centerOf(game.player);
      for (const enemy of game.getLivingEnemies?.() || game.enemies || []) {
        if (!enemyCanBeDisplaced(enemy)) continue;
        const enemyCenter = centerOf(enemy);
        const dist = distance(origin.x, origin.y, enemyCenter.x, enemyCenter.y);
        if (dist > (shockwave.radius || 120)) continue;
        const dirX = dist > 0.001 ? (enemyCenter.x - origin.x) / dist : 1;
        const dirY = dist > 0.001 ? (enemyCenter.y - origin.y) / dist : 0;
        
        applyEnemyHitReaction(game, enemy, {
          source: "basic",
          hitDirX: dirX,
          hitDirY: dirY,
          recoilDistance: shockwave.knockback || 56,
          staggerDuration: 0.22
        });
      }
      game.combat.enemyProjectiles = (game.combat.enemyProjectiles || []).filter((projectile) => distance(origin.x, origin.y, projectile.x, projectile.y) > (shockwave.radius || 120));
    }
    if (amount <= 0) {
      onRingPlayerDamaged(game, sourceEnemy);
      return false;
    }
  }
  game.player.hp = Math.max(0, game.player.hp - amount);
  onRingPlayerDamaged(game, sourceEnemy);
  if (sourceEnemy?.affixes?.includes("cursing")) {
    applyStatusPayload(game.player, { curseDuration: 3 });
  }
  if (!game.combat.playerAction?.animationKey) {
    game.player.hitDuration = 0.34;
    game.player.hitTimer = game.player.hitDuration;
  }
  playPlayerHitAudio(game);
  game.player.damageFlashDuration = 0.18;
  game.player.damageFlashTimer = game.player.damageFlashDuration;
  game.triggerPlayerHitCameraZoom?.();
  game.triggerPlayerHitSlow?.();
  game.combat.contactCooldown = 0.5;
  notePlayerDamagedByEnemyMelee(game, sourceEnemy);
  if (canTriggerReactiveAssist && game.player.hp > 0) {
    const triggeredCooldown = triggerReactiveHitAssist(game, sourceEnemy);
    if (triggeredCooldown > 0) {
      game.combat.weaponArtRuntime.reactiveHitAssistCooldown = 1;
    }
  }
  if (game.player.hp <= 0 && !tryChaosRebirth(game)) game.startDefeatSequence?.();
  return true;
}

export function damageEnemyTarget(game, amount, sourceEnemy = null) {
  const target = getEnemyTargetEntity(game);
  if (isEnemyTestDummy(game, target)) return damageEnemyTestTarget(game, target, amount);
  return damagePlayer(game, amount, sourceEnemy);
}

function tryMovePlayerWithCollision(game, dx, dy) {
  const player = game.player;
  const world = game.world;
  const nextX = Math.max(0, Math.min(world.width - player.w, player.x + dx));
  const nextY = Math.max(0, Math.min(world.height - player.h, player.y + dy));
  const testX = { x: nextX, y: player.y, w: player.w, h: player.h };
  const testY = { x: player.x, y: nextY, w: player.w, h: player.h };
  let moveX = nextX;
  let moveY = nextY;
  const blockers = game.getCollisionBlockers
    ? game.getCollisionBlockers({ includeBreakables: true })
    : [
        ...(world?.collisionRects || []),
        ...getBlockingBreakableRects(game)
      ];
  for (const wall of blockers) {
    if (rectsOverlap(testX, wall)) moveX = player.x;
    if (rectsOverlap(testY, wall)) moveY = player.y;
  }
  player.x = moveX;
  player.y = moveY;
}

function applyPlayerHitEffects(game, payload = {}) {
  const player = game.player;
  if (game.state !== "running" || player.isInvisible) return;
  applyStatusPayload(player, payload);
  if (payload.knockback > 0) {
    let dirX = payload.dirX ?? 0;
    let dirY = payload.dirY ?? 0;
    if (Math.abs(dirX) < 0.001 && Math.abs(dirY) < 0.001) {
      const playerCenter = centerOf(player);
      const fromX = payload.fromX ?? playerCenter.x;
      const fromY = payload.fromY ?? playerCenter.y;
      const length = Math.hypot(playerCenter.x - fromX, playerCenter.y - fromY) || 1;
      dirX = (playerCenter.x - fromX) / length;
      dirY = (playerCenter.y - fromY) / length;
    }
    
    // Smooth knockback: store intent, let updatePlayerMovement handle the push
    player.knockbackTimer = 0.25; // 250ms push duration
    player.knockbackStartDuration = 0.25;
    player.knockbackTotal = payload.knockback;
    player.knockbackDirX = dirX;
    player.knockbackDirY = dirY;
  }
}

export function applyEnemyTargetStatus(game, payload = {}) {
  const target = getEnemyTargetEntity(game);
  if (!isEnemyTestDummy(game, target)) {
    applyPlayerHitEffects(game, payload);
    return;
  }
  applyStatusPayload(target, payload);
}

function projectileHitsWall(game, projectile, room) {
  const bounds = {
    x: projectile.x - projectile.radius,
    y: projectile.y - projectile.radius,
    w: projectile.radius * 2,
    h: projectile.radius * 2
  };
  const blockers = game.getCollisionBlockers
    ? game.getCollisionBlockers({ includeBreakables: false })
    : room.collisionRects;
  return blockers.some((wall) => rectsOverlap(bounds, wall));
}

function reflectProjectileFromWall(projectile, room, previousX, previousY) {
  const nextBounds = {
    x: projectile.x - projectile.radius,
    y: projectile.y - projectile.radius,
    w: projectile.radius * 2,
    h: projectile.radius * 2
  };
  const previousBoundsX = {
    x: previousX - projectile.radius,
    y: projectile.y - projectile.radius,
    w: projectile.radius * 2,
    h: projectile.radius * 2
  };
  const previousBoundsY = {
    x: projectile.x - projectile.radius,
    y: previousY - projectile.radius,
    w: projectile.radius * 2,
    h: projectile.radius * 2
  };
  let bouncedX = false;
  let bouncedY = false;
  for (const wall of room.collisionRects) {
    if (!rectsOverlap(nextBounds, wall)) continue;
    if (!rectsOverlap(previousBoundsX, wall)) bouncedX = true;
    if (!rectsOverlap(previousBoundsY, wall)) bouncedY = true;
  }
  if (!bouncedX && !bouncedY) {
    bouncedX = true;
    bouncedY = true;
  }
  if (bouncedX) {
    projectile.vx *= -1;
    projectile.x = previousX;
  }
  if (bouncedY) {
    projectile.vy *= -1;
    projectile.y = previousY;
  }
  return bouncedX || bouncedY;
}

function findProjectileHomingTarget(game, projectile) {
  if (!projectile.homingRadius || !projectile.homingTurnRate) return null;
  let nearest = null;
  let nearestDistance = projectile.homingRadius;
  for (const enemy of getLivingEnemies(game)) {
    const center = centerOf(enemy);
    const dist = distance(projectile.x, projectile.y, center.x, center.y);
    if (dist >= nearestDistance) continue;
    nearest = enemy;
    nearestDistance = dist;
  }
  return nearest;
}

function updateProjectileHoming(game, projectile, dt) {
  const target = findProjectileHomingTarget(game, projectile);
  if (!target) return;
  const center = centerOf(target);
  const desiredX = center.x - projectile.x;
  const desiredY = center.y - projectile.y;
  const desiredLength = Math.hypot(desiredX, desiredY) || 1;
  const speed = projectile.speed || Math.hypot(projectile.vx, projectile.vy) || 1;
  const nextVx = (desiredX / desiredLength) * speed;
  const nextVy = (desiredY / desiredLength) * speed;
  const turn = Math.min(1, projectile.homingTurnRate * dt);
  projectile.vx += (nextVx - projectile.vx) * turn;
  projectile.vy += (nextVy - projectile.vy) * turn;
}

function updateEnemyProjectileHoming(game, projectile, dt) {
  if (!projectile.homingRadius || !projectile.homingTurnRate) return;
  const target = getEnemyTargetEntity(game);
  if (!target) return;
  const center = centerOf(target);
  const targetDistance = distance(projectile.x, projectile.y, center.x, center.y);
  if (targetDistance >= projectile.homingRadius) return;
  const desiredX = center.x - projectile.x;
  const desiredY = center.y - projectile.y;
  const desiredLength = Math.hypot(desiredX, desiredY) || 1;
  const speed = projectile.speed || Math.hypot(projectile.vx, projectile.vy) || 1;
  const nextVx = (desiredX / desiredLength) * speed;
  const nextVy = (desiredY / desiredLength) * speed;
  const turn = Math.min(1, projectile.homingTurnRate * dt);
  projectile.vx += (nextVx - projectile.vx) * turn;
  projectile.vy += (nextVy - projectile.vy) * turn;
}

function pushProjectileImpactVfx(game, projectile) {
  if (!projectile.impactSprite) return;
  game.combat.impactVfx.push({
    x: projectile.x,
    y: projectile.y,
    sprite: projectile.impactSprite,
    frames: projectile.impactFrames ?? 1,
    frameWidth: projectile.impactFrameWidth ?? 64,
    frameHeight: projectile.impactFrameHeight ?? 64,
    fps: projectile.impactFps ?? 12,
    size: projectile.impactSize ?? 32,
    age: 0,
    currentFrame: 0
  });
}

function explodePlayerProjectile(game, projectile) {
  if (!projectile.explosionRadius || !projectile.explosionDamage) return;
  for (const enemy of getLivingEnemies(game)) {
    const center = centerOf(enemy);
    const radius = (enemy.collisionRadius ?? 0.32) * enemy.w;
    if (distance(projectile.x, projectile.y, center.x, center.y) > projectile.explosionRadius + radius) continue;
    damageEnemy(game, enemy, projectile.explosionDamage);
  }
  damageBreakablesInRadius(game, projectile.x, projectile.y, projectile.explosionRadius, projectile.explosionDamage);
  game.combat.enemyAreaHitboxes.push({
    x: projectile.x,
    y: projectile.y,
    radius: projectile.explosionRadius,
    damage: 0,
    shape: "circle",
    duration: 0.18,
    age: 0,
    hit: true,
    telegraphOnly: true,
    color: projectile.explosionColor || "#f97316"
  });
}

function updatePlayerAction(game, dt) {
  const action = game.combat.playerAction;
  if (!action) return;
  action.elapsed += dt;
  game.combat.castTimer = Math.max(0, action.duration - action.elapsed);

  const stateDef = game.heroDef?.sprite?.states?.[action.animationKey] || null;
  const frameCount = Math.max(1, stateDef?.frames || 1);
  const progress = clamp(action.elapsed / Math.max(0.001, action.duration || 0.001), 0, 0.999);
  const currentFrame = Math.min(frameCount - 1, Math.floor(progress * frameCount));
  const triggerFrames = action.hitFrames?.length
    ? action.hitFrames.map((frame) => clamp(frame, 0, frameCount - 1))
    : Number.isFinite(action.hitboxTrigger)
      ? [clamp(action.hitboxTrigger, 0, frameCount - 1)]
      : null;

  if (triggerFrames?.length) {
    for (const hitFrame of triggerFrames) {
      if (currentFrame >= hitFrame && !action.firedFrames?.has(hitFrame)) {
        action.firedFrames?.add(hitFrame);
        if (!action.triggered) {
          action.triggered = true;
          action.onTrigger?.();
        }
        action.onHitFrame?.(hitFrame, currentFrame);
      }
    }
  } else if (!action.triggered && action.elapsed >= action.triggerTime) {
    action.triggered = true;
    action.onTrigger?.();
  }

  if (action.elapsed >= action.duration) {
    game.combat.playerAction = null;
    game.combat.castTimer = 0;
  }
}

function updatePlayerProjectiles(game, dt) {
  const room = game.world;
  const remaining = [];
  for (const projectile of game.combat.playerProjectiles) {
    if (projectile._destroyed) continue;
    projectile.age = (projectile.age || 0) + dt;
    projectile.onUpdate?.(game, projectile, dt);
    updateProjectileHoming(game, projectile, dt);
    if (projectile.lifetime != null && projectile.age >= projectile.lifetime) {
      pushProjectileImpactVfx(game, projectile);
      explodePlayerProjectile(game, projectile);
      continue;
    }
    const previousX = projectile.x;
    const previousY = projectile.y;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;

    // --- BOOMERANG RETURN LOGIC ---
    if (projectile.boomerang) {
      if (projectile.isReturning) {
        // Return Leg: Constant tracking, ignore bounds/walls
        const playerCenter = centerOf(game.player);
        const distToPlayer = distance(projectile.x, projectile.y, playerCenter.x, playerCenter.y);
        
        if (distToPlayer < 32) {
          projectile._destroyed = true;
          continue;
        }

        // Update velocity toward moving player
        const dir = normalize(playerCenter.x - projectile.x, playerCenter.y - projectile.y, { x: 0, y: 0 });
        projectile.vx = dir.x * projectile.speed;
        projectile.vy = dir.y * projectile.speed;
        
        // Allow return leg to continue to collision checks below
      } else {
        // Outbound Leg: Check for halfway point of the doubled range
        projectile.traveled += projectile.speed * dt;
        if (projectile.traveled >= projectile.maxRange * 0.5) {
          projectile.isReturning = true;
          projectile.hitEnemyIds?.clear();
          
          if (projectile.sharedTargetHits && typeof projectile.sharedTargetHits.clear === 'function') {
            projectile.sharedTargetHits.clear();
          } else {
            projectile.sharedTargetHits = new Map();
          }

          projectile.speed *= 2.0; // Doubled return speed
          // Keep projectile alive this frame
          remaining.push(projectile);
          continue;
        }
      }
    } else {
      // Normal projectile logic
      projectile.traveled += projectile.speed * dt;
      if (projectile.traveled >= projectile.maxRange) {
        pushProjectileImpactVfx(game, projectile);
        explodePlayerProjectile(game, projectile);
        continue;
      }
    }
    // --- END BOOMERANG LOGIC ---

    if (projectile.x < 0 || projectile.y < 0 || projectile.x > room.width || projectile.y > room.height) {
      pushProjectileImpactVfx(game, projectile);
      explodePlayerProjectile(game, projectile);
      continue;
    }
    if (projectileHitsWall(game, projectile, room)) {
      if (projectile.bounceOnWall && reflectProjectileFromWall(projectile, room, previousX, previousY)) {
        remaining.push(projectile);
        continue;
      }
      pushProjectileImpactVfx(game, projectile);
      if (projectile.detonateOnWall) explodePlayerProjectile(game, projectile);
      continue;
    }

    let hitPlayerProjectile = false;
    for (const otherProjectile of game.combat.playerProjectiles) {
      if (otherProjectile === projectile || otherProjectile._destroyed) continue;
      if (distance(projectile.x, projectile.y, otherProjectile.x, otherProjectile.y) > projectile.radius + otherProjectile.radius) continue;
      if (
        projectile.projectileClass === "knife" &&
        otherProjectile.projectileClass === "knife" &&
        (projectile.ringKnifeCollisionExplosion || otherProjectile.ringKnifeCollisionExplosion)
      ) {
        const explosionSource = projectile.ringKnifeCollisionExplosion ? projectile : otherProjectile;
        const explosionX = (projectile.x + otherProjectile.x) * 0.5;
        const explosionY = (projectile.y + otherProjectile.y) * 0.5;
        const explosionDamage = getPlayerAttackStat(game.player) * (explosionSource.ringKnifeCollisionExplosionDamageRatio || 1);
        const explosionRadius = explosionSource.ringKnifeCollisionExplosionRadius || 80;
        for (const enemy of getLivingEnemies(game)) {
          const center = centerOf(enemy);
          const radius = (enemy.collisionRadius ?? 0.32) * enemy.w;
          if (distance(explosionX, explosionY, center.x, center.y) > explosionRadius + radius) continue;
          damageEnemy(game, enemy, explosionDamage, {
            source: "ring",
            isDirect: false,
            noAttackExplosion: true,
            noDeathExplosionChain: true
          });
        }
        game.combat.enemyAreaHitboxes.push({
          x: explosionX,
          y: explosionY,
          radius: explosionRadius,
          damage: 0,
          shape: "circle",
          duration: 0.18,
          age: 0,
          hit: true,
          telegraphOnly: true,
          color: "#fb7185"
        });
        projectile._destroyed = true;
        otherProjectile._destroyed = true;
        hitPlayerProjectile = true;
        break;
      }
      if (!handleWeaponArtPlayerProjectileCollision(game, projectile, otherProjectile)) continue;
      pushProjectileImpactVfx(game, projectile);
      hitPlayerProjectile = true;
      break;
    }
    if (hitPlayerProjectile) continue;

    let hitBreakable = false;
    for (const breakable of game.breakables || []) {
      if (breakable.isDestroyed) continue;
      if (!circleHitsRect(projectile.x, projectile.y, projectile.radius, breakable.x, breakable.y, breakable.w, breakable.h)) continue;
      damageBreakable(game, breakable, projectile.damage);
      pushProjectileImpactVfx(game, projectile);
      if (projectile.detonateOnEnemy) explodePlayerProjectile(game, projectile);
      hitBreakable = true;
      break;
    }
    if (hitBreakable) continue;

    const mirrorClone = getMirrorClone(game);
    if (mirrorClone && circleHitsRect(projectile.x, projectile.y, projectile.radius, mirrorClone)) {
      damageMirrorClone(game, projectile.damage, {
        source: projectile.source || "projectile",
        effectiveness: projectile.source === "skill" ? 0.75 : 1
      });
      pushProjectileImpactVfx(game, projectile);
      if (projectile.detonateOnEnemy) explodePlayerProjectile(game, projectile);
      let remainingPierce = projectile.pierce ?? 0;
      if (remainingPierce <= 0) continue;
      remainingPierce -= 1;
      projectile.pierce = remainingPierce;
    }

    let hitsRemaining = projectile.pierce ?? 0;
    let consumed = false;
    for (const enemy of getLivingEnemies(game)) {
      if (projectile.hitEnemyIds?.has(enemy.id)) continue;
      const center = centerOf(enemy);
      const radiusFactor = enemy.collisionRadius ?? 0.32;
      const enemyRadius = enemy.w * radiusFactor;
      const hitDistance = pointSegmentDistance(center.x, center.y, previousX, previousY, projectile.x, projectile.y);
      if (hitDistance > projectile.radius + enemyRadius) continue;
      const priorTargetHits = projectile.sharedTargetHits?.get(enemy.id) ?? 0;
      const damageMultiplier = priorTargetHits > 0
        ? (projectile.repeatHitDamageMultiplier ?? 1)
        : 1;
      const result = damageEnemy(game, enemy, projectile.damage * damageMultiplier, {
        source: projectile.source || "projectile",
        isDirect: !!projectile.isDirect,
        ...(projectile.hitMeta || {})
      });
      projectile.hitEnemyIds?.add(enemy.id);
      if (result.hit) {
        projectile.sharedTargetHits?.set(enemy.id, priorTargetHits + 1);
      }
      if (result.hit) projectile.onHitEnemy?.(game, enemy, projectile);
      pushProjectileImpactVfx(game, projectile);
      if (projectile.detonateOnEnemy) explodePlayerProjectile(game, projectile);
      if (hitsRemaining <= 0) {
        consumed = true;
        break;
      }
      hitsRemaining -= 1;
      projectile.pierce = hitsRemaining;
    }
    if (!consumed && !projectile._destroyed) remaining.push(projectile);
  }
  game.combat.playerProjectiles = remaining.filter((projectile) => !projectile._destroyed);
}

function updateEnemyProjectiles(game, dt) {
  const room = game.world;
  const remaining = [];
  for (const projectile of game.combat.enemyProjectiles) {
    updateEnemyProjectileHoming(game, projectile, dt);
    if (projectile.speedRampDuration > 0 && projectile.speedRampMaxMult > 1) {
      const speedProgress = Math.min(1, Math.max(0, (projectile.age || 0) / projectile.speedRampDuration));
      const targetSpeed = projectile.baseSpeed * (1 + (projectile.speedRampMaxMult - 1) * speedProgress);
      const velocityLength = Math.hypot(projectile.vx, projectile.vy) || 1;
      projectile.vx = (projectile.vx / velocityLength) * targetSpeed;
      projectile.vy = (projectile.vy / velocityLength) * targetSpeed;
      projectile.speed = targetSpeed;
    }
    if (projectile.boomerang && projectile.outbound) {
      const returnAfter = projectile.returnAfter ?? Math.max(120, (projectile.maxRange ?? 560) * 0.55);
      if (projectile.traveled >= returnAfter) {
        projectile.outbound = false;
      }
    }
    if (projectile.boomerang && !projectile.outbound) {
      const targetX = projectile.ownerX ?? projectile.x;
      const targetY = projectile.ownerY ?? projectile.y;
      const toOwnerX = targetX - projectile.x;
      const toOwnerY = targetY - projectile.y;
      const length = Math.hypot(toOwnerX, toOwnerY) || 1;
      const speed = (projectile.speed || 300) * (projectile.returnSpeedMult || 1.1);
      projectile.vx = (toOwnerX / length) * speed;
      projectile.vy = (toOwnerY / length) * speed;
      projectile.speed = speed;
      if (length <= projectile.radius + 12) continue;
    }
    if (projectile.gravityX || projectile.gravityY) {
      projectile.vx += (projectile.gravityX || 0) * dt;
      projectile.vy += (projectile.gravityY || 0) * dt;
    }
    if (projectile.verticalWaveAmplitude && projectile.verticalWaveFrequency) {
      const previousWave = Math.sin(
        ((projectile.age || 0) * projectile.verticalWaveFrequency) + (projectile.verticalWavePhase || 0)
      ) * projectile.verticalWaveAmplitude;
      const nextWave = Math.sin(
        (((projectile.age || 0) + dt) * projectile.verticalWaveFrequency) + (projectile.verticalWavePhase || 0)
      ) * projectile.verticalWaveAmplitude;
      projectile.y += nextWave - previousWave;
    }
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.traveled += Math.hypot(projectile.vx, projectile.vy) * dt;
    projectile.age += dt;
    if (projectile.lifetime != null && projectile.age >= projectile.lifetime) {
      pushProjectileEndVfx(game, projectile);
      if (projectile.impactSprite) {
        game.combat.impactVfx.push({
          x: projectile.x,
          y: projectile.y,
          sprite: projectile.impactSprite,
          frames: projectile.impactFrames ?? 1,
          frameWidth: projectile.impactFrameWidth ?? 64,
          frameHeight: projectile.impactFrameHeight ?? 64,
          fps: projectile.impactFps ?? 12,
          size: projectile.impactSize ?? 32,
          age: 0,
          currentFrame: 0
        });
      }
      continue;
    }
    if (!projectile.boomerang && projectile.traveled >= projectile.maxRange) {
      pushProjectileEndVfx(game, projectile);
      if (projectile.impactSprite) {
        game.combat.impactVfx.push({
          x: projectile.x,
          y: projectile.y,
          sprite: projectile.impactSprite,
          frames: projectile.impactFrames ?? 1,
          frameWidth: projectile.impactFrameWidth ?? 64,
          frameHeight: projectile.impactFrameHeight ?? 64,
          fps: projectile.impactFps ?? 12,
          size: projectile.impactSize ?? 32,
          age: 0,
          currentFrame: 0
        });
      }
      continue;
    }
    if (projectile.x < 0 || projectile.y < 0 || projectile.x > room.width || projectile.y > room.height) {
      pushProjectileEndVfx(game, projectile);
      continue;
    }
    if (projectileHitsWall(game, projectile, room)) {
      pushProjectileEndVfx(game, projectile);
      continue;
    }
    const target = getEnemyTargetEntity(game);
    if (game.player.knightChargeState?.active && circleHitsRect(projectile.x, projectile.y, projectile.radius, target)) {
      pushProjectileEndVfx(game, projectile);
      if (projectile.impactSprite) {
        game.combat.impactVfx.push({
          x: projectile.x,
          y: projectile.y,
          sprite: projectile.impactSprite,
          frames: projectile.impactFrames ?? 1,
          frameWidth: projectile.impactFrameWidth ?? 64,
          frameHeight: projectile.impactFrameHeight ?? 64,
          fps: projectile.impactFps ?? 12,
          size: projectile.impactSize ?? 32,
          age: 0,
          currentFrame: 0
        });
      }
      continue;
    }
    if (circleHitsRect(projectile.x, projectile.y, projectile.radius, target)) {
      pushProjectileEndVfx(game, projectile);
      const sourceEnemy = game.enemies.find((enemy) => enemy.id === projectile.sourceEnemyId) || null;
      damageEnemyTarget(game, projectile.damage, sourceEnemy);
      applyEnemyTargetStatus(game, {
        knockback: projectile.knockback,
        slowMult: projectile.slowMult,
        slowDuration: projectile.slowDuration,
        stunDuration: projectile.stunDuration,
        poisonDps: projectile.poisonDps,
        poisonDuration: projectile.poisonDuration,
        dirX: projectile.vx,
        dirY: projectile.vy,
        fromX: projectile.x,
        fromY: projectile.y
      });
      if (projectile.impactSprite) {
        game.combat.impactVfx.push({
          x: projectile.x,
          y: projectile.y,
          sprite: projectile.impactSprite,
          frames: projectile.impactFrames ?? 1,
          frameWidth: projectile.impactFrameWidth ?? 64,
          frameHeight: projectile.impactFrameHeight ?? 64,
          fps: projectile.impactFps ?? 12,
          size: projectile.impactSize ?? 32,
          age: 0,
          currentFrame: 0
        });
      }
      continue;
    }
    remaining.push(projectile);
  }
  game.combat.enemyProjectiles = remaining;
}

function pointInCone(px, py, hitbox) {
  const dx = px - hitbox.x;
  const dy = py - hitbox.y;
  const length = Math.hypot(dx, dy);
  if (length > hitbox.range) return false;
  const dirLength = Math.hypot(hitbox.dirX, hitbox.dirY) || 1;
  const nx = hitbox.dirX / dirLength;
  const ny = hitbox.dirY / dirLength;
  const dot = (dx / Math.max(length, 0.0001)) * nx + (dy / Math.max(length, 0.0001)) * ny;
  return dot >= Math.cos(((hitbox.arcDeg ?? 90) * Math.PI) / 360);
}

function conePathBlocked(game, hitbox, targetX, targetY) {
  const blockers = game.getCollisionBlockers
    ? game.getCollisionBlockers({ includeBreakables: true })
    : [
        ...(game.world?.collisionRects || []),
        ...getBlockingBreakableRects(game)
      ];
  for (const blocker of blockers) {
    if (segmentIntersectsRect(hitbox.x, hitbox.y, targetX, targetY, blocker)) return true;
  }
  return false;
}

function pointInEllipse(px, py, hitbox, padding = 0) {
  const radiusX = Math.max(1, hitbox.radius);
  const radiusY = Math.max(1, (hitbox.radiusY ?? hitbox.radius * 0.75));
  const dx = px - hitbox.x;
  const dy = py - hitbox.y;
  const nx = dx / (radiusX + padding);
  const ny = dy / (radiusY + padding);
  return nx * nx + ny * ny <= 1;
}

function pointHitsLine(px, py, hitbox, padding = 0) {
  const x2 = hitbox.x2 ?? hitbox.x;
  const y2 = hitbox.y2 ?? hitbox.y;
  const halfWidth = Math.max(1, (hitbox.lineWidth ?? hitbox.softLineWidth ?? 8) * 0.5 + padding);
  return pointSegmentDistance(px, py, hitbox.x, hitbox.y, x2, y2) <= halfWidth;
}

function hitboxHitsPlayer(game, hitbox, player) {
  const center = centerOf(player);
  if (hitbox.shape === "circle") {
    return pointInEllipse(center.x, center.y, hitbox, Math.min(player.w, player.h) * 0.33);
  }
  if (hitbox.shape === "cone") {
    return pointInCone(center.x, center.y, hitbox) && !conePathBlocked(game, hitbox, center.x, center.y);
  }
  if (hitbox.shape === "line") {
    return pointHitsLine(center.x, center.y, hitbox, Math.min(player.w, player.h) * 0.28);
  }
  return false;
}

function pushProjectileEndVfx(game, projectile) {
  if (!projectile?.spriteAsset || !projectile.spriteEndFrames || !game.assets?.[projectile.spriteAsset]) return;
  const image = game.assets[projectile.spriteAsset];
  const frameWidth = projectile.spriteFrameWidth ?? image.naturalWidth;
  const frameHeight = projectile.spriteFrameHeight ?? image.naturalHeight;
  const cropWidth = Math.min(frameWidth, projectile.spriteCropWidth || frameWidth);
  const cropHeight = Math.min(frameHeight, projectile.spriteCropHeight || frameHeight);
  game.combat.impactVfx.push({
    x: projectile.x,
    y: projectile.y,
    sprite: projectile.spriteAsset,
    frames: projectile.spriteEndFrames,
    frameWidth,
    frameHeight,
    fps: projectile.spriteFps ?? 12,
    size: projectile.projectileEndSize ?? projectile.drawSize ?? projectile.radius * 2,
    age: 0,
    currentFrame: 0,
    startFrame: projectile.spriteEndStart ?? 0,
    cropWidth,
    cropHeight,
    angle: Math.atan2(projectile.vy || 0, projectile.vx || 1)
  });
}

function updateEnemyAreaHitboxes(game, dt) {
  const remaining = [];
  for (const hitbox of game.combat.enemyAreaHitboxes) {
    hitbox.age += dt;
    const target = getEnemyTargetEntity(game);
    if (!hitbox.telegraphOnly && !hitbox.hit && hitbox.age <= hitbox.duration && hitboxHitsPlayer(game, hitbox, target)) {
      const sourceEnemy = game.enemies.find((enemy) => enemy.id === hitbox.sourceId) || null;
      damageEnemyTarget(game, hitbox.damage, sourceEnemy);
      applyEnemyTargetStatus(game, {
        knockback: hitbox.knockback,
        slowMult: hitbox.slowMult,
        slowDuration: hitbox.slowDuration,
        stunDuration: hitbox.stunDuration,
        poisonDps: hitbox.poisonDps,
        poisonDuration: hitbox.poisonDuration,
        dirX: hitbox.dirX,
        dirY: hitbox.dirY,
        fromX: hitbox.x,
        fromY: hitbox.y
      });
      hitbox.hit = true;
    }
    if (hitbox.age < (hitbox.lifetime ?? hitbox.duration)) remaining.push(hitbox);
  }
  game.combat.enemyAreaHitboxes = remaining;
}

function updateImpactVfx(game, dt) {
  const remaining = [];
  for (const vfx of game.combat.impactVfx) {
    vfx.age += dt;
    vfx.currentFrame = Math.floor(vfx.age * vfx.fps);
    if (vfx.currentFrame < vfx.frames) {
      remaining.push(vfx);
    }
  }
  game.combat.impactVfx = remaining;
}

export function updateCombatFeedback(game, dt) {
  const remainingPopups = [];
  for (const popup of game.combat.damagePopups || []) {
    popup.age += dt;
    if (popup.age < popup.duration) remainingPopups.push(popup);
  }
  game.combat.damagePopups = remainingPopups;

  const remainingBursts = [];
  for (const burst of game.combat.critBursts || []) {
    burst.age += dt;
    if (burst.age < burst.duration) remainingBursts.push(burst);
  }
  game.combat.critBursts = remainingBursts;

  const remainingParticles = [];
  for (const particle of game.combat.enemyHitParticles || []) {
    particle.age += dt;
    if (particle.age >= particle.duration) {
      if (particle.kind === "barbarianBlood") {
        game.combat.enemyBloodDecals.push({
          x: particle.x,
          y: particle.y,
          age: 0,
          duration: 4.5 + Math.random() * 2,
          rotation: particle.rotation || 0,
          pixelSize: Math.max(2, particle.pixelSize * 0.9),
          pattern: particle.pattern,
          patternWidth: particle.patternWidth,
          patternHeight: particle.patternHeight,
          colors: particle.colors
        });
      }
      continue;
    }
    const drag = Math.max(0, 1 - particle.drag * dt);
    particle.vx *= drag;
    particle.vy = particle.vy * drag + particle.gravity * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.rotation += (particle.angularVelocity || 0) * dt;
    particle.angularVelocity *= Math.max(0, 1 - 1.8 * dt);
    const velocityAngle = Math.atan2(particle.vy, particle.vx || 0.0001);
    const follow = particle.velocityFollow || 0;
    if (follow > 0) {
      const delta = Math.atan2(Math.sin(velocityAngle - particle.rotation), Math.cos(velocityAngle - particle.rotation));
      particle.rotation += delta * follow * Math.min(1, dt * 60);
    }
    remainingParticles.push(particle);
  }
  game.combat.enemyHitParticles = remainingParticles;

  const remainingDecals = [];
  for (const decal of game.combat.enemyBloodDecals || []) {
    decal.age += dt;
    if (decal.age < decal.duration) remainingDecals.push(decal);
  }
  game.combat.enemyBloodDecals = remainingDecals;

  game.combat.hitStopTimer = Math.max(0, (game.combat.hitStopTimer || 0) - dt);
  for (const enemy of game.enemies || []) {
    enemy.critFlashTimer = Math.max(0, (enemy.critFlashTimer || 0) - dt);
  }
}

export function updateEnemyThreats(game, dt) {
  updateEnemyProjectiles(game, dt);
  updateEnemyAreaHitboxes(game, dt);
  updateImpactVfx(game, dt);
}

function interruptPlayerSprint(game) {
  const movement = game.player?.movement;
  if (!movement || movement.sprintTimer <= 0) return;
  movement.sprintTimer = 0;
  if (movement.state === "sprint" && movement.dashTimer <= 0 && movement.slideTimer <= 0) {
    movement.state = "walk";
  }
}

export function tryHeroAttack(game) {
  const combat = game.combat;
  const movement = game.player.movement;
  const isWindArcher = game.heroDef?.id === "wind_archer";
  const dashLockActive = movement.dashTimer > (game.heroDef.dash.duration || 0) * 0.5;
  const slideLockActive = !isWindArcher && !canAttackWhileSliding(game) && movement.slideTimer > (game.heroDef.slide.duration || 0) * 0.5;
  if (dashLockActive || slideLockActive) return false;
  if (combat.attackCooldown > 0 || combat.playerAction || game.state !== "running") return false;
  combat.attackCooldown = 1 / getCurrentAttackRate(game);
  const triggered = triggerWeaponArtAttack(game);
  if (triggered) {
    interruptPlayerSprint(game);
    game.cancelDashAndSlideMomentum?.({ preserveSlide: isWindArcher });
    onBasicAttackUsedForSkills(game);
    onRingBasicAttackUsed(game);
    onFingerBasicAttackUsed(game);
  }
  return triggered;
}

function tryTriggerQueuedFingerAttack(game, target = null) {
  if (game.state !== "running") return false;
  if (game.combat.playerAction) return false;
  if (target) game.combat.overrideAimPointOnce = target;
  const triggered = triggerWeaponArtAttack(game);
  if (!triggered) return false;
  onBasicAttackUsedForSkills(game);
  onRingBasicAttackUsed(game);
  return true;
}

export function tryHeroAssist(game) {
  const combat = game.combat;
  if (combat.assistCooldown > 0 || combat.playerAction || game.state !== "running") return false;
  const triggeredCooldown = triggerWeaponArtAssist(game);
  if (!triggeredCooldown) return false;
  combat.assistCooldown = triggeredCooldown / getTotalAttackSpeedMultiplier(game);
  return true;
}

export function updateCombat(game, dt) {
  game.tryHeroAttack = () => tryHeroAttack(game);
  game.tryHeroAssist = () => tryHeroAssist(game);
  game.tryTriggerSkillProc = (slotIndex, damageScale = 1) => triggerSkillProc(game, slotIndex, damageScale);
  const combat = game.combat;
  combat.attackCooldown = Math.max(0, combat.attackCooldown - dt);
  combat.assistCooldown = Math.max(0, combat.assistCooldown - dt);
  combat.contactCooldown = Math.max(0, combat.contactCooldown - dt);
  game.player.damageBonusTimer = Math.max(0, game.player.damageBonusTimer - dt);
  if (game.player.damageBonusTimer <= 0) game.player.damageBonus = 0;
  setPlayerStatSource(game.player, "runtime", {
    globalDamage: { add: game.player.damageBonus || 0 }
  });

  updateStatusState(game.player, dt, {
    onTickDamage(amount, kind) {
      if (amount <= 0) return;
      game.player.hp = Math.max(0, game.player.hp - amount);
      if (kind === "poison") {
        game.player.damageFlashDuration = 0.18;
        game.player.damageFlashTimer = game.player.damageFlashDuration;
      }
      if (game.player.hp <= 0) game.state = "defeat";
    }
  });

  updateWeaponArtRuntime(game, dt);
  updateSkillRuntime(game, dt);
  refreshRingDerivedStats(game);

  if (game.input.wasPressed("1")) tryUseSkillSlot(game, 0);
  if (game.input.wasPressed("2")) tryUseSkillSlot(game, 1);
  if (game.input.wasPressed("3")) tryUseSkillSlot(game, 2);

  if (game.input.mouse.down && game.state === "running") {
    tryHeroAttack(game);
  }
  if (game.input.mouse.rightClicked && game.state === "running") {
    tryHeroAssist(game);
  }

  updatePlayerAction(game, dt);
  const fingerEffects = game.fingerState?.activeEffects;
  const queuedSlideAttackTarget = fingerEffects?.pendingSlideAttackTarget || null;
  if (queuedSlideAttackTarget) {
    if (tryTriggerQueuedFingerAttack(game, queuedSlideAttackTarget)) {
      fingerEffects.pendingSlideAttackTarget = null;
    }
  } else if (fingerEffects?.pendingEchoAttack) {
    if (tryTriggerQueuedFingerAttack(game)) {
      fingerEffects.pendingEchoAttack = false;
    }
  }
  updatePlayerProjectiles(game, dt);
  updateEnemyThreats(game, dt);
}

export function resolveEnemyBodyDamage(game) {
  if (game.combat.contactCooldown > 0 || game.state !== "running") return;
  const target = getEnemyTargetEntity(game);
  if (target === game.player && isPlayerIgnoringEnemyCollision(target)) return;
  for (const enemy of getLivingEnemies(game)) {
    if (
      isEntityBlinded(enemy) ||
      enemy.role === "ranged" ||
      enemy.attackRuntime ||
      enemy.cooldown > 0 ||
      (enemy.state?.spawnGrace ?? 0) > 0
    ) continue;
    const enemyCenter = centerOf(enemy);
    const playerCenter = centerOf(target);
    if (distance(playerCenter.x, playerCenter.y, enemyCenter.x, enemyCenter.y) > (enemy.w + target.w) * 0.33) continue;
    enemy.cooldown = Math.max(enemy.cooldown || 0, ENEMY_ATTACK_LOCKOUT_SECONDS);
    damageEnemyTarget(game, enemy.damage, enemy);
    break;
  }
}
