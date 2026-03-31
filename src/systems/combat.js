import { centerOf, circleHitsRect, clamp, distance, normalize, rectsOverlap } from "../core/runtime-utils.js";
import { damageBreakable, damageBreakablesInRadius, getBlockingBreakableRects } from "./breakables.js";
import { modifyDamageAgainstEnemy, onEnemyDamagedByPlayer, onEnemyKilledByPlayer, tryPreventEnemyDeath } from "./enemy-affixes.js";
import { getEnemyTargetCenter, getEnemyTargetEntity, isEnemyTestDummy } from "./enemy-targeting.js";
import { spawnGoldDropsForEnemy } from "./gold.js";
import { modifyIncomingPlayerDamage, modifyOutgoingPlayerDamage, onRingBasicAttackHit, onRingBasicAttackUsed, onRingEnemyKilled, onRingPlayerDamaged, onRingSkillHit, updateRingRuntime, getCurrentAttackRate, getTotalAttackSpeedMultiplier } from "./rings.js";
import { setPlayerStatSource } from "./player-stats.js";
import { createSkillRuntime, onBasicAttackUsedForSkills, onEnemyKilledForSkills, onPlayerDealtDamageForSkills, triggerSkillProc, tryUseSkillSlot, updateSkillRuntime } from "./skills.js";
import { applyStatusPayload, updateStatusState } from "./status-manager.js";
import { createWeaponArtRuntime, triggerWeaponArtAssist, triggerWeaponArtAttack, updateWeaponArtRuntime } from "./weapon-art-runtime.js";
import { UNDEAD_ENEMY_IDS } from "../data/undead-enemies.js";

const ENEMY_ATTACK_LOCKOUT_SECONDS = 2;
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
const BLOOD_PIXEL_COLORS = Object.freeze(["#991b1b", "#7f1d1d", "#b91c1c", "#be123c"]);
const BLOOD_PIXEL_PATTERNS = Object.freeze([
  { weight: 12, pixels: [{ x: 0, y: 0, color: 2 }] },
  { weight: 10, pixels: [{ x: 0, y: 0, color: 2 }, { x: 1, y: 0, color: 3 }] },
  { weight: 8, pixels: [{ x: 0, y: 0, color: 1 }, { x: 1, y: 0, color: 0 }, { x: 2, y: 0, color: 2 }] },
  { weight: 6, pixels: [{ x: 0, y: 0, color: 1 }, { x: 1, y: 0, color: 1 }, { x: 0, y: 1, color: 0 }, { x: 1, y: 1, color: 3 }] },
  { weight: 4, pixels: [{ x: 0, y: 0, color: 2 }, { x: 1, y: 0, color: 3 }, { x: 2, y: 0, color: 2 }, { x: 0, y: 1, color: 1 }, { x: 1, y: 1, color: 0 }] },
  { weight: 2.5, pixels: [{ x: 0, y: 0, color: 0 }, { x: 1, y: 0, color: 1 }, { x: 2, y: 0, color: 1 }, { x: 0, y: 1, color: 0 }, { x: 1, y: 1, color: 3 }, { x: 2, y: 1, color: 1 }] },
  { weight: 1.25, pixels: [{ x: 0, y: 0, color: 1 }, { x: 1, y: 0, color: 1 }, { x: 2, y: 0, color: 0 }, { x: 0, y: 1, color: 1 }, { x: 1, y: 1, color: 1 }, { x: 2, y: 1, color: 0 }, { x: 3, y: 1, color: 3 }] }
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

function pickWeightedPixelPattern(weightedPatterns) {
  const totalWeight = weightedPatterns.reduce((sum, entry) => sum + (entry.weight || 0), 0);
  let roll = Math.random() * Math.max(0.0001, totalWeight);
  for (const entry of weightedPatterns) {
    roll -= entry.weight || 0;
    if (roll <= 0) return entry.pixels;
  }
  return weightedPatterns[weightedPatterns.length - 1]?.pixels || [];
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
    color: options.color ?? "#f8fafc",
    scale: options.scale ?? 1,
    isCrit: !!options.isCrit
  });
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

function isFleshBarbarian(enemy) {
  return BARBARIAN_BLOOD_ENEMY_IDS.has(enemy?.type);
}

function isUndeadEnemyParticleTarget(enemy) {
  return UNDEAD_ENEMY_IDS.includes(enemy?.type);
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
      rotation: kind === "barbarianBlood" ? (Math.random() - 0.5) * 0.45 : velocityAngle,
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
  const origin = centerOf(enemy);
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
  const length = Math.hypot(config.dirX, config.dirY) || 1;
  const dirX = config.dirX / length;
  const dirY = config.dirY / length;
  game.combat.enemyProjectiles.push({
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
    spriteLoopStart: config.spriteLoopStart ?? null,
    spriteLoopEnd: config.spriteLoopEnd ?? null,
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
  });
}

export function spawnEnemyAreaHitbox(game, hitbox) {
  const activeDuration = hitbox.duration ?? 0.1;
  const visualDuration = hitbox.visualDuration ?? activeDuration;
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
  const nextX = Math.max(0, Math.min(world.width - enemy.w, enemy.x + dx));
  const nextY = Math.max(0, Math.min(world.height - enemy.h, enemy.y + dy));
  const testX = { x: nextX, y: enemy.y, w: enemy.w, h: enemy.h };
  const testY = { x: enemy.x, y: nextY, w: enemy.w, h: enemy.h };
  let moveX = nextX;
  let moveY = nextY;
  for (const wall of world.collisionRects || []) {
    if (rectsOverlap(testX, wall)) moveX = enemy.x;
    if (rectsOverlap(testY, wall)) moveY = enemy.y;
  }
  enemy.x = moveX;
  enemy.y = moveY;
}

function shouldApplyEnemyHitReaction(meta = {}) {
  if (meta.source === "basic") return true;
  if (meta.source === "skill" && meta.isDirect === true) return true;
  return false;
}

function getEnemyHitDirection(game, enemy, meta = {}) {
  const enemyCenter = centerOf(enemy);
  const playerCenter = centerOf(game.player);
  return normalize(
    meta.hitDirX ?? (enemyCenter.x - playerCenter.x),
    meta.hitDirY ?? (enemyCenter.y - playerCenter.y),
    { x: 1, y: 0 }
  );
}

function applyEnemyHitReaction(game, enemy, meta = {}) {
  if (!shouldApplyEnemyHitReaction(meta) || enemy.dead) return;
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

  if (recoilDistance > 0) {
    tryMoveEnemyWithCollision(game, enemy, hitDir.x * recoilDistance, hitDir.y * recoilDistance);
  }
}

export function damageEnemy(game, enemy, amount, meta = {}) {
  const guard = enemy.attackRuntime?.guard;
  if (guard?.active) {
    const enemyCenter = centerOf(enemy);
    const playerCenter = getEnemyTargetCenter(game);
    const toPlayer = normalize(playerCenter.x - enemyCenter.x, playerCenter.y - enemyCenter.y, { x: 1, y: 0 });
    const front = normalize(guard.dirX, guard.dirY, { x: 1, y: 0 });
    const dot = toPlayer.x * front.x + toPlayer.y * front.y;
    if (dot >= 0) return;
  }
  const ringAdjusted = modifyOutgoingPlayerDamage(game, enemy, amount, meta);
  const appliedDamage = modifyDamageAgainstEnemy(enemy, ringAdjusted);
  if (appliedDamage <= 0) return;
  const wasFullHp = enemy.hp >= enemy.maxHp;
  const enemyCenter = centerOf(enemy);
  enemy.hp -= appliedDamage;
  enemy.showHealthBar = true;
  pushDamagePopup(game, enemyCenter.x, enemyCenter.y - enemy.h * 0.3, `${Math.round(appliedDamage)}`, {
    color: meta.isCrit ? "#fde047" : "#f8fafc",
    scale: meta.isCrit ? 1.22 : 1,
    duration: meta.isCrit ? 0.68 : 0.55,
    riseSpeed: meta.isCrit ? 52 : 42,
    isCrit: !!meta.isCrit
  });
  if (meta.isCrit) {
    enemy.critFlashDuration = Math.max(enemy.critFlashDuration || 0, 0.2);
    enemy.critFlashTimer = Math.max(enemy.critFlashTimer || 0, enemy.critFlashDuration);
    game.combat.hitStopTimer = Math.max(game.combat.hitStopTimer || 0, 0.045);
    pushCritBurst(game, enemyCenter.x, enemyCenter.y);
  }
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
  if (meta.source === "projectile" && game.assets?.enemyHurtSfx) {
    playAudioClone(game.assets.enemyHurtSfx, {
      volume: game.assets.enemyHurtSfx.volume,
      playbackRate: 1 + (Math.random() * 0.2 - 0.1)
    });
  }
  pushEnemyHitParticles(game, enemy, getEnemyHitDirection(game, enemy, meta), meta);
  onPlayerDealtDamageForSkills(game, appliedDamage);
  if (meta.source === "basic") onRingBasicAttackHit(game, enemy);
  if (meta.source === "skill") onRingSkillHit(game, appliedDamage);
  if (enemy.hp > 0) {
    applyEnemyHitReaction(game, enemy, meta);
    onEnemyDamagedByPlayer(game, enemy, appliedDamage);
    return;
  }
  if (tryPreventEnemyDeath(game, enemy)) return;
  enemy.dead = true;
  onEnemyKilledByPlayer(game, enemy);
  onEnemyKilledForSkills(game);
  onRingEnemyKilled(game, enemy, { wasFullHp });
  spawnGoldDropsForEnemy(game, enemy);
  game.kills += 1;
  game.roomKills += 1;
  game.player.damageBonus = Math.min(0.2, game.player.damageBonus + 0.01);
  game.player.damageBonusTimer = 5;
}

function damageEnemyTestTarget(game, target, amount) {
  if (game.combat.contactCooldown > 0 || game.state !== "running" || amount <= 0) return false;
  target.hp = Math.max(0, target.hp - amount);
  target.showHealthBar = true;
  target.hitTimer = Math.max(target.hitTimer || 0, 0.2);
  game.combat.contactCooldown = 0.2;
  if (target.hp <= 0) {
    target.dead = true;
    if (game.enemyTest) {
      game.enemyTest.dummyRespawnTimer = Math.max(game.enemyTest.dummyRespawnTimer || 0, 0.75);
    }
  }
  return true;
}

export function damagePlayer(game, amount, sourceEnemy = null) {
  if (game.combat.contactCooldown > 0 || game.state !== "running") return false;
  if (game.player.isInvisible || game.player.spiritMode?.active) return false;
  amount = modifyIncomingPlayerDamage(game, amount, sourceEnemy);
  if (amount <= 0) return false;
  const shield = Math.max(0, game.player.damageShield || 0);
  if (shield > 0) {
    const absorbed = Math.min(shield, amount);
    game.player.damageShield = shield - absorbed;
    amount -= absorbed;
    if (amount <= 0) return false;
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
  game.player.damageFlashDuration = 0.18;
  game.player.damageFlashTimer = game.player.damageFlashDuration;
  game.combat.contactCooldown = 0.5;
  if (game.player.hp <= 0) game.state = "defeat";
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
  const blockers = [
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
    tryMovePlayerWithCollision(game, dirX * payload.knockback, dirY * payload.knockback);
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

function projectileHitsWall(projectile, room) {
  const bounds = {
    x: projectile.x - projectile.radius,
    y: projectile.y - projectile.radius,
    w: projectile.radius * 2,
    h: projectile.radius * 2
  };
  return room.collisionRects.some((wall) => rectsOverlap(bounds, wall));
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
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
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

function explodePlayerProjectile(game, projectile) {
  if (!projectile.explosionRadius || !projectile.explosionDamage) return;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
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
    ? action.hitFrames
    : Number.isFinite(action.hitboxTrigger)
      ? [action.hitboxTrigger]
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
    projectile.age = (projectile.age || 0) + dt;
    updateProjectileHoming(game, projectile, dt);
    if (projectile.lifetime != null && projectile.age >= projectile.lifetime) {
      explodePlayerProjectile(game, projectile);
      continue;
    }
    const previousX = projectile.x;
    const previousY = projectile.y;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.traveled += projectile.speed * dt;
    if (projectile.traveled >= projectile.maxRange) {
      explodePlayerProjectile(game, projectile);
      continue;
    }
    if (projectile.x < 0 || projectile.y < 0 || projectile.x > room.width || projectile.y > room.height) {
      explodePlayerProjectile(game, projectile);
      continue;
    }
    if (projectileHitsWall(projectile, room)) {
      if (projectile.bounceOnWall && reflectProjectileFromWall(projectile, room, previousX, previousY)) {
        remaining.push(projectile);
        continue;
      }
      if (projectile.detonateOnWall) explodePlayerProjectile(game, projectile);
      continue;
    }

    let hitBreakable = false;
    for (const breakable of game.breakables || []) {
      if (breakable.isDestroyed) continue;
      if (!circleHitsRect(projectile.x, projectile.y, projectile.radius, breakable)) continue;
      damageBreakable(game, breakable, projectile.damage);
      if (projectile.detonateOnEnemy) explodePlayerProjectile(game, projectile);
      hitBreakable = true;
      break;
    }
    if (hitBreakable) continue;

    let hitsRemaining = projectile.pierce ?? 0;
    let consumed = false;
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      if (projectile.hitEnemyIds?.has(enemy.id)) continue;
      const center = centerOf(enemy);
      const radiusFactor = enemy.collisionRadius ?? 0.32;
      if (distance(projectile.x, projectile.y, center.x, center.y) > projectile.radius + enemy.w * radiusFactor) continue;
      damageEnemy(game, enemy, projectile.damage, {
        source: projectile.source || "projectile",
        isDirect: !!projectile.isDirect,
        ...(projectile.hitMeta || {})
      });
      projectile.hitEnemyIds?.add(enemy.id);
      projectile.onHitEnemy?.(game, enemy, projectile);
      if (projectile.detonateOnEnemy) explodePlayerProjectile(game, projectile);
      if (hitsRemaining <= 0) {
        consumed = true;
        break;
      }
      hitsRemaining -= 1;
      projectile.pierce = hitsRemaining;
    }
    if (!consumed) remaining.push(projectile);
  }
  game.combat.playerProjectiles = remaining;
}

function updateEnemyProjectiles(game, dt) {
  const room = game.world;
  const remaining = [];
  for (const projectile of game.combat.enemyProjectiles) {
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
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.traveled += Math.hypot(projectile.vx, projectile.vy) * dt;
    projectile.age += dt;
    if (projectile.lifetime != null && projectile.age >= projectile.lifetime) {
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
    if (projectile.x < 0 || projectile.y < 0 || projectile.x > room.width || projectile.y > room.height) continue;
    if (projectileHitsWall(projectile, room)) continue;
    const target = getEnemyTargetEntity(game);
    if (game.player.knightChargeState?.active && circleHitsRect(projectile.x, projectile.y, projectile.radius, target)) {
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

function pointInEllipse(px, py, hitbox, padding = 0) {
  const radiusX = Math.max(1, hitbox.radius);
  const radiusY = Math.max(1, (hitbox.radiusY ?? hitbox.radius * 0.75));
  const dx = px - hitbox.x;
  const dy = py - hitbox.y;
  const nx = dx / (radiusX + padding);
  const ny = dy / (radiusY + padding);
  return nx * nx + ny * ny <= 1;
}

function hitboxHitsPlayer(hitbox, player) {
  const center = centerOf(player);
  if (hitbox.shape === "circle") {
    return pointInEllipse(center.x, center.y, hitbox, Math.min(player.w, player.h) * 0.33);
  }
  if (hitbox.shape === "cone") return pointInCone(center.x, center.y, hitbox);
  return false;
}

function updateEnemyAreaHitboxes(game, dt) {
  const remaining = [];
  for (const hitbox of game.combat.enemyAreaHitboxes) {
    hitbox.age += dt;
    const target = getEnemyTargetEntity(game);
    if (!hitbox.hit && hitbox.age <= hitbox.duration && hitboxHitsPlayer(hitbox, target)) {
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

export function tryHeroAttack(game) {
  const combat = game.combat;
  if (combat.attackCooldown > 0 || combat.playerAction || game.state !== "running") return false;
  combat.attackCooldown = 1 / getCurrentAttackRate(game);
  const triggered = triggerWeaponArtAttack(game);
  if (triggered) {
    onBasicAttackUsedForSkills(game);
    onRingBasicAttackUsed(game);
  }
  return triggered;
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
  updateRingRuntime(game, 0);

  if (game.input.wasPressed("1")) tryUseSkillSlot(game, 0);
  if (game.input.wasPressed("2")) tryUseSkillSlot(game, 1);
  if (game.input.wasPressed("3")) tryUseSkillSlot(game, 2);

  if ((game.input.mouse.down || game.input.wasPressed("f")) && game.state === "running") {
    tryHeroAttack(game);
  }
  if (game.input.mouse.rightClicked && game.state === "running") {
    tryHeroAssist(game);
  }

  updatePlayerAction(game, dt);
  updatePlayerProjectiles(game, dt);
  updateEnemyThreats(game, dt);
}

export function resolveEnemyBodyDamage(game) {
  if (game.combat.contactCooldown > 0 || game.state !== "running") return;
  const target = getEnemyTargetEntity(game);
  for (const enemy of game.enemies) {
    if (
      enemy.dead ||
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
