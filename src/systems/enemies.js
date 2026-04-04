import { centerOf, clamp, createSeededRandom, distance, normalize, rectsOverlap, sample } from "../core/runtime-utils.js";
import { getBiomeSpawnPlan, getRowSpawnModifier, getColumnSpawnModifier } from "../data/enemy-spawn-plans.js";
import { getEnemyTierDef, getValidAffixIds, normalizeEnemyTier, pickRandomAffixIds } from "../data/enemy-affixes.js";
import { BARBARIAN_ENEMY_IDS, BARBARIAN_ROOM_ROSTER, getBarbarianEnemyDef } from "../data/barbarian-enemies.js";
import { ROOM_ENEMY_TABLE, getEnemyDef } from "../data/enemies.js";
import { getShepardEnemyDef, SHEPARD_ENEMY_IDS, SHEPARD_ROOM_ROSTER } from "../data/shepard-enemies.js";
import { UNDEAD_ENEMY_IDS, UNDEAD_ROOM_ROSTER, getUndeadEnemyDef } from "../data/undead-enemies.js";
import { getEnemyAwareness } from "./enemy-awareness.js";
import { applyEnemyAuraSources, beginEnemyAffixFrame, updateEnemyAffixes } from "./enemy-affixes.js";
import { spawnEnemyProjectile } from "./combat.js";
import {
  initializeEnemyAnimationDirection,
  setEnemyAnimationDirection,
  updateEnemyAnimationDirection
} from "./enemy-animation-direction.js";
import {
  computeEnemyMoveVector,
  createEnemyNavState,
  resolveEnemyWallOverlap as sharedResolveEnemyWallOverlap,
  tryMoveEnemy as sharedTryMoveEnemy
} from "./enemy-navigation.js";
import { applyEnemyMovementCollider, refreshEnemyMovementCollider } from "./enemy-movement-collider.js";
import { releaseEnemyMeleeAttackToken } from "./melee-attack-tokens.js";
import { getEntitySlowMultiplier, updateStatusState } from "./status-manager.js";
import { createUndeadRuntime, isUndeadEnemy, updateUndeadEnemy } from "./undead-runtime.js";

const ENEMY_ATTACK_LOCKOUT_SECONDS = 2;
const ENEMY_TIER_POISE_MULT = Object.freeze({
  minion: 1,
  elite: 0.5,
  miniBoss: 0.15
});
const DEFAULT_MOVEMENT_TACTIC = "Balance";
const DEFAULT_ROLE = "melee";
const MINI_BOSS_TACTIC_WEIGHT = Object.freeze({
  Brave: 2.2,
  Balance: 1.8,
  Coward: 0.45,
  Swarmer: 0.35
});
const MINI_BOSS_ROLE_WEIGHT = Object.freeze({
  melee: 1.7,
  ranged: 0.65
});
const MINION_TACTIC_BUCKETS = Object.freeze([
  Object.freeze({
    tactic: "Swarmer",
    min: 3,
    max: 4,
    replacements: Object.freeze([
      Object.freeze({ tactic: "Brave", min: 1, max: 2 })
    ])
  }),
  Object.freeze({
    tactic: "Brave",
    min: 1,
    max: 2,
    replacements: Object.freeze([
      Object.freeze({ tactic: "Balance", min: 1, max: 2 })
    ])
  }),
  Object.freeze({
    tactic: "Balance",
    min: 1,
    max: 2,
    replacements: Object.freeze([
      Object.freeze({ tactic: "Brave", min: 1, max: 2 }),
      Object.freeze({ tactic: "Swarmer", min: 3, max: 4 }),
      Object.freeze({ tactic: "Coward", min: 1, max: 2 })
    ])
  }),
  Object.freeze({
    tactic: "Coward",
    min: 1,
    max: 2,
    replacements: Object.freeze([
      Object.freeze({ tactic: "Balance", min: 1, max: 2 }),
      Object.freeze({ tactic: "Swarmer", min: 3, max: 4 })
    ])
  })
]);
const ELITE_PRIMARY_TACTICS = Object.freeze(["Coward", "Brave", "Balance"]);
const ELITE_PRIMARY_MIN = 3;
const ELITE_PRIMARY_MAX = 4;
const ELITE_SWARMER_TWIST_COUNT = 2;
const ELITE_OTHER_TWIST_COUNT = 1;
const PLAYER_SPAWN_SAFE_RADIUS = 280;
const GUARANTEED_SLIME_MIN_DISTANCE = 100;
const GUARANTEED_SLIME_MAX_DISTANCE = 224;
const ENEMY_VOID_SPAWN_PADDING = 40;
const MINIBOSS_DASH_INTERVAL_MIN = 3;
const MINIBOSS_DASH_INTERVAL_MAX = 5;
const MINIBOSS_DASH_DURATION = 0.5;
const MINIBOSS_DASH_SPEED_MULT = 2;
const MINIBOSS_DASH_AFTERIMAGE_INTERVAL = 0.06;
const MINIBOSS_DASH_AFTERIMAGE_DURATION = 0.24;
const MINIBOSS_DASH_AFTERIMAGE_ALPHA = 0.2;
const SLIME_ENEMY_POOL = Object.freeze([...new Set(ROOM_ENEMY_TABLE.flat())]);
const SLIME_POOL_BIOME_0 = Object.freeze([
  "slime_green_1",
  "slime_green_2"
]);
const SLIME_POOL_BIOME_1 = Object.freeze([
  "slime_green_1",
  "slime_green_2",
  "slime_green_3",
  "slime_green_4"
]);
const SLIME_POOL_BIOME_4 = Object.freeze([
  "slime_green_4",
  "slime_green_5"
]);
const SWARMER_BEAST_POOL = Object.freeze([
  "m_for_raptor_14"
]);
const ALL_BEAST_POOL = Object.freeze([
  "m_for_raptor_14",
  "m_for_kicker_15",
  "m_for_stegosaurus_16",
  "m_for_triceratops_17"
]);
const BASIC_BARBARIAN_POOL = Object.freeze([
  "m_bar_ogre_1",
  "m_bar_nomad_3"
]);
const ADVANCED_BARBARIAN_POOL = Object.freeze([
  "m_bar_berserker_4",
  "m_bar_archer_5",
  "m_bar_barbarian_6",
  "m_bar_bowman_7",
  "m_bar_witchdoctor_8",
  "m_bar_shaman_9",
  "m_bar_golem_2"
]);
const BASIC_UNDEAD_POOL = Object.freeze([
  "m_ud_brute",
  "m_ud_warrior"
]);
const ADVANCED_UNDEAD_POOL = Object.freeze([
  "m_ud_archer_5",
  "m_ud_berserker_4",
  "m_ud_dark_archer_7",
  "m_ud_necromancer_8",
  "m_ud_wizard_9",
  "m_ud_dark_lord_2",
  "m_ud_dark_knight_3"
]);

function resolveEnemyWallOverlap(enemy, room, game = null) {
  return sharedResolveEnemyWallOverlap(game, enemy, room);
}

function tryMoveEnemy(enemy, room, dx, dy, game = null) {
  return sharedTryMoveEnemy(game, enemy, room, dx, dy);
}

function randomMinibossDashCooldown() {
  return MINIBOSS_DASH_INTERVAL_MIN + Math.random() * (MINIBOSS_DASH_INTERVAL_MAX - MINIBOSS_DASH_INTERVAL_MIN);
}

function ensureMinibossDashState(enemy) {
  enemy.state ||= {};
  enemy.state.minibossDash ||= {
    active: false,
    timer: 0,
    cooldown: randomMinibossDashCooldown(),
    dirX: 1,
    dirY: 0,
    lastMoveDirX: 1,
    lastMoveDirY: 0,
    afterimageTimer: 0,
    afterimages: []
  };
  return enemy.state.minibossDash;
}

function noteEnemyMoveDirection(enemy, dir) {
  if (!enemy || !dir) return;
  const normalized = normalize(dir.x, dir.y, null);
  if (!normalized) return;
  const dash = ensureMinibossDashState(enemy);
  dash.lastMoveDirX = normalized.x;
  dash.lastMoveDirY = normalized.y;
}

function recordMinibossDashAfterimage(enemy) {
  const dash = ensureMinibossDashState(enemy);
  dash.afterimages.push({
    x: enemy.x,
    y: enemy.y,
    elapsed: 0,
    duration: MINIBOSS_DASH_AFTERIMAGE_DURATION,
    alpha: MINIBOSS_DASH_AFTERIMAGE_ALPHA,
    sheetKey: enemy.sprite.roll ? "roll" : "move",
    frame: enemy.render?.frame ?? 0,
    displayDirection: enemy.displayDirection || enemy.direction || "down",
    facing: enemy.facing || 1,
    drawSize: enemy.drawSize || enemy.w
  });
  if (dash.afterimages.length > 10) {
    dash.afterimages.splice(0, dash.afterimages.length - 10);
  }
}

function updateMinibossDashVisuals(enemy, dt) {
  const dash = enemy?.state?.minibossDash;
  if (!dash) return;
  dash.afterimages = (dash.afterimages || []).filter((afterimage) => {
    afterimage.elapsed += dt;
    return afterimage.elapsed < afterimage.duration;
  });
}

function setMinibossDashRender(enemy) {
  const dash = ensureMinibossDashState(enemy);
  const sheetKey = enemy.sprite.roll ? "roll" : "move";
  const sheet = enemy.sprite[sheetKey] || enemy.sprite.move || enemy.sprite.idle;
  enemy.render.sheetKey = sheetKey;
  if (sheetKey === "roll" && sheet?.frames) {
    const progress = clamp(1 - dash.timer / MINIBOSS_DASH_DURATION, 0, 0.9999);
    enemy.render.frame = clamp(Math.floor(progress * sheet.frames), 0, Math.max(0, sheet.frames - 1));
    return;
  }
  enemy.render.frame = Math.floor(enemy.animClock * (sheet?.fps || 8)) % Math.max(1, sheet?.frames || 1);
}

export function updateMinibossDash(game, enemy, dt, options = {}) {
  if (!enemy?.isMiniBoss) return false;
  const dash = ensureMinibossDashState(enemy);
  const awarenessState = options.awarenessState || enemy.awarenessState || "idle";
  const canStart = options.canStart ?? awarenessState !== "idle";
  const fallbackDir = options.fallbackDir || { x: 1, y: 0 };

  if (dash.active) {
    dash.timer = Math.max(0, dash.timer - dt);
    const dir = normalize(dash.dirX, dash.dirY, fallbackDir);
    noteEnemyMoveDirection(enemy, dir);
    enemy.facing = dir.x >= 0 ? 1 : -1;
    setEnemyAnimationDirection(enemy, dir.x >= 0 ? "right" : "left");
    enemy.isMoving = tryMoveEnemy(
      enemy,
      game.world,
      dir.x * enemy.speed * MINIBOSS_DASH_SPEED_MULT * dt,
      dir.y * enemy.speed * MINIBOSS_DASH_SPEED_MULT * dt,
      game
    );
    dash.afterimageTimer -= dt;
    while (dash.afterimageTimer <= 0) {
      recordMinibossDashAfterimage(enemy);
      dash.afterimageTimer += MINIBOSS_DASH_AFTERIMAGE_INTERVAL;
    }
    setMinibossDashRender(enemy);
    if (dash.timer <= 0) {
      dash.active = false;
      dash.cooldown = randomMinibossDashCooldown();
      dash.afterimageTimer = 0;
    }
    return true;
  }

  dash.cooldown = Math.max(0, dash.cooldown - dt);
  if (!canStart || dash.cooldown > 0) return false;

  const dashDir = normalize(dash.lastMoveDirX, dash.lastMoveDirY, fallbackDir);
  dash.active = true;
  dash.timer = MINIBOSS_DASH_DURATION;
  dash.dirX = dashDir.x;
  dash.dirY = dashDir.y;
  dash.afterimageTimer = 0;
  noteEnemyMoveDirection(enemy, dashDir);
  enemy.facing = dashDir.x >= 0 ? 1 : -1;
  setEnemyAnimationDirection(enemy, dashDir.x >= 0 ? "right" : "left");
  enemy.isMoving = tryMoveEnemy(
    enemy,
    game.world,
    dashDir.x * enemy.speed * MINIBOSS_DASH_SPEED_MULT * dt,
    dashDir.y * enemy.speed * MINIBOSS_DASH_SPEED_MULT * dt,
    game
  );
  dash.afterimageTimer = MINIBOSS_DASH_AFTERIMAGE_INTERVAL;
  recordMinibossDashAfterimage(enemy);
  setMinibossDashRender(enemy);
  return true;
}

function rerollBlindWander(enemy) {
  enemy.state ||= {};
  const angle = Math.random() * Math.PI * 2;
  enemy.state.blindWanderDirX = Math.cos(angle);
  enemy.state.blindWanderDirY = Math.sin(angle);
  enemy.state.blindWanderTimer = 0.45 + Math.random() * 0.55;
}

function updateBlindedBaseEnemy(game, enemy, dt) {
  enemy.state.dragonBreath = null;
  enemy.state.skeletonDash = null;
  enemy.state.skeletonDashCooldown = Math.max(enemy.state.skeletonDashCooldown || 0, 0.8);
  enemy.state.blindWanderTimer = Math.max(0, (enemy.state.blindWanderTimer || 0) - dt);
  if (
    (enemy.state.blindWanderTimer || 0) <= 0 ||
    !Number.isFinite(enemy.state.blindWanderDirX) ||
    !Number.isFinite(enemy.state.blindWanderDirY)
  ) {
    rerollBlindWander(enemy);
  }
  const dir = normalize(enemy.state.blindWanderDirX || 1, enemy.state.blindWanderDirY || 0, { x: 1, y: 0 });
  const moved = tryMoveEnemy(enemy, game.world, dir.x * enemy.speed * 0.5 * dt, dir.y * enemy.speed * 0.5 * dt, game);
  if (!moved) rerollBlindWander(enemy);
  enemy.facing = dir.x >= 0 ? 1 : -1;
  setEnemyAnimationDirection(enemy, dir.x >= 0 ? "right" : "left");
  enemy.isMoving = moved;
  enemy.render.sheetKey = moved && enemy.sprite.move ? "move" : "idle";
  enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite[enemy.render.sheetKey]?.fps || 8)) % Math.max(1, enemy.sprite[enemy.render.sheetKey]?.frames || 1);
}

function tickEnemyHitReaction(enemy, dt) {
  enemy.hitTimer = Math.max(0, (enemy.hitTimer || 0) - dt);
  enemy.collisionBounceTimer = Math.max(0, (enemy.collisionBounceTimer || 0) - dt);
  enemy.collisionBounceCooldownTimer = Math.max(0, (enemy.collisionBounceCooldownTimer || 0) - dt);
  if ((enemy.collisionBounceTimer || 0) <= 0) {
    enemy.collisionBounceOffsetX = 0;
    enemy.collisionBounceOffsetY = 0;
  }
  enemy.plateConsumeCooldownTimer = Math.max(0, (enemy.plateConsumeCooldownTimer || 0) - dt);
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
  tryMoveEnemy(enemy, game.world, (enemy.hitDirX || 0) * speed * dt, (enemy.hitDirY || 0) * speed * dt, game);
  enemy.isMoving = false;
  return true;
}

function setEnemyHitRenderFrame(enemy) {
  if (enemy?.movementProfile?.kind === "slimeHop") return false;
  const sheet = enemy?.sprite?.hit;
  if (!sheet) return false;
  const total = Math.max(0.001, enemy.hitDuration || (sheet.frames / Math.max(0.001, sheet.fps || 1)));
  const progress = clamp(1 - (enemy.hitTimer || 0) / total, 0, 0.9999);
  enemy.render.sheetKey = "hit";
  enemy.render.frame = clamp(Math.floor(progress * sheet.frames), 0, Math.max(0, sheet.frames - 1));
  return true;
}

function steerEnemyMovement(game, enemy, desiredDir, targetPoint, dt, options = {}) {
  const movement = computeEnemyMoveVector(game, enemy, desiredDir, targetPoint, dt, options);
  noteEnemyMoveDirection(enemy, movement.dir);
  return tryMoveEnemy(
    enemy,
    game.world,
    movement.dir.x * enemy.speed * movement.speedMult * dt,
    movement.dir.y * enemy.speed * movement.speedMult * dt,
    game
  );
}

function randomizeEnemyAnimClock(sprite, random = Math.random) {
  const candidates = [sprite?.idle, sprite?.move].filter(Boolean);
  let maxCycleDuration = 0;
  for (const sheet of candidates) {
    const frames = Math.max(1, Number(sheet.frames) || 1);
    const fps = Math.max(0.001, Number(sheet.fps) || 8);
    maxCycleDuration = Math.max(maxCycleDuration, frames / fps);
  }
  return maxCycleDuration > 0 ? random() * maxCycleDuration : 0;
}

function randomizeEnemyAnimationSpeed(def, random = Math.random) {
  if (!def?.sprite?.move) return 1;
  return 0.9 + random() * 0.22;
}

function getMovementSheetFrame(enemy) {
  const moveSheet = enemy?.sprite?.move;
  if (!moveSheet) return 0;
  const frames = Math.max(1, Number(moveSheet.frames) || 1);
  const fps = Math.max(0.001, Number(moveSheet.fps) || 8);
  return Math.floor((enemy.animClock || 0) * fps) % frames;
}

function getBaseEnemyMovementSpeedMultiplier(enemy) {
  const profile = enemy?.movementProfile;
  if (profile?.kind !== "slimeHop") return 1;
  const moveSheet = enemy?.sprite?.move;
  if (!moveSheet) return 1;
  const frames = Math.max(1, Number(moveSheet.frames) || 1);
  if (frames <= 1) return profile.peakSpeedMult ?? 1;
  const minSpeedMult = profile.minSpeedMult ?? 0.3;
  const peakSpeedMult = profile.peakSpeedMult ?? 1;
  const peakFrameIndex = clamp((profile.peakFrame ?? 1) - 1, 0, frames - 1);
  const currentFrame = getMovementSheetFrame(enemy);
  if (currentFrame <= peakFrameIndex) {
    const t = peakFrameIndex <= 0 ? 1 : currentFrame / peakFrameIndex;
    return minSpeedMult + (peakSpeedMult - minSpeedMult) * t;
  }
  const trailingFrames = Math.max(1, (frames - 1) - peakFrameIndex);
  const t = (currentFrame - peakFrameIndex) / trailingFrames;
  return peakSpeedMult + (minSpeedMult - peakSpeedMult) * t;
}

function isEvasiveRetreatActive(enemy) {
  return (enemy?.affixState?.evasiveRetreatTimer || 0) > 0;
}

function getErraticMoveDir(enemy) {
  if ((enemy?.affixState?.erraticBurstAt || 0) <= 0) return null;
  return normalize(enemy.affixState.erraticMoveDirX, enemy.affixState.erraticMoveDirY, { x: 1, y: 0 });
}

function resolveDirectionalEnemyDef(def, random = Math.random) {
  if (!def?.spriteVariants?.length) return def;
  const variants = def.spriteVariants;
  const index = Math.max(0, Math.min(variants.length - 1, Math.floor(random() * variants.length)));
  const variant = variants[index];
  if (!variant) return def;
  return {
    ...def,
    sprite: variant.sprite || def.sprite,
    tint: variant.tint ?? def.tint,
    movementCollider: variant.movementCollider ?? def.movementCollider,
    movementColliderRadiusScale: variant.movementColliderRadiusScale ?? def.movementColliderRadiusScale,
    movementColliderOffsetX: variant.movementColliderOffsetX ?? def.movementColliderOffsetX,
    movementColliderOffsetY: variant.movementColliderOffsetY ?? def.movementColliderOffsetY,
    movementColliderMinRadius: variant.movementColliderMinRadius ?? def.movementColliderMinRadius
  };
}

function buildBaseEnemy(def, x, y, random = Math.random) {
  const enemy = {
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
    animClock: randomizeEnemyAnimClock(def.sprite, random),
    animationSpeedMult: randomizeEnemyAnimationSpeed(def, random),
    dead: false,
    facing: 1,
    direction: "down",
    sprite: def.sprite,
    color: def.color,
    movementProfile: def.movementProfile || null,
    render: { sheetKey: "idle", frame: 0 },
    collisionRadius: def.collisionRadius,
    ignoreWalls: !!def.ignoreWalls,
    baseIgnoreWalls: !!def.ignoreWalls,
    specialBehavior: def.specialBehavior || null,
    projectileColor: def.projectileColor || null,
    state: {
      nav: createEnemyNavState()
    },
    enemyTier: "minion",
    tierXpMult: 1,
    affixes: [],
    affixState: {},
    renderAlpha: 1,
    showHealthBar: false,
    ignoreStagger: !!def.ignoreStagger,
    ignoreKnockback: !!def.ignoreKnockback,
    plates: Math.max(0, def.plates || 0),
    maxPlates: Math.max(0, def.plates || 0),
    plateMaxDurability: 0,
    plateDurability: 0,
    plateConsumeCooldownTimer: 0,
    hitTimer: 0,
    hitDuration: 0.1,
    staggerTimer: 0,
    staggerDuration: 0.14,
    hitDirX: 0,
    hitDirY: 0,
    collisionBounceOffsetX: 0,
    collisionBounceOffsetY: 0,
    collisionBounceTimer: 0,
    collisionBounceDuration: 0.1,
    collisionBounceCooldownTimer: 0,
    staggerMoveSpeed: 0,
    staggerPauseTimer: 0,
    poiseMult: ENEMY_TIER_POISE_MULT.minion,
    hitInterruptPending: false,
    hitInterruptPauseDuration: 0,
    hitInterruptStaggerDuration: 0,
    hitInterruptBeforeWindupCommitOnly: false,
    recentDamageEvents: [],
    burstHeavyStaggerActiveUntil: -Infinity,
    burstHeavyStaggerCooldownUntil: -Infinity
  };
  applyEnemyMovementCollider(enemy, def);
  initializeEnemyAnimationDirection(enemy, "right");
  return enemy;
}

function buildUndeadEnemy(def, x, y, random = Math.random) {
  const resolvedDef = resolveDirectionalEnemyDef(def, random);
  const enemy = {
    id: `${resolvedDef.id}_${Math.random().toString(36).slice(2, 8)}`,
    type: resolvedDef.id,
    name: resolvedDef.name,
    role: resolvedDef.role,
    x,
    y,
    w: resolvedDef.size,
    h: resolvedDef.size,
    drawSize: resolvedDef.drawSize || resolvedDef.size,
    hp: resolvedDef.hp,
    maxHp: resolvedDef.hp,
    damage: resolvedDef.damage,
    baseDamage: resolvedDef.damage,
    speed: resolvedDef.speed,
    baseSpeed: resolvedDef.speed,
    preferredRange: resolvedDef.preferredRange || 0,
    movementTactic: resolvedDef.movementTactic || "Balance",
    dead: false,
    facing: 1,
    direction: "down",
    rowOrder: resolvedDef.rowOrder,
    sprite: resolvedDef.sprite,
    attacks: resolvedDef.attacks,
    guardStance: resolvedDef.guardStance || null,
    awakenBehavior: resolvedDef.awakenBehavior || null,
    swiftStep: resolvedDef.swiftStep || null,
    sneakBehavior: resolvedDef.sneakBehavior || null,
    shoutBehavior: resolvedDef.shoutBehavior || null,
    animClock: 0,
    color: resolvedDef.tint,
    render: { sheetKey: "idle", frame: 0 },
    attackRuntime: createUndeadRuntime(),
    state: {
      nav: createEnemyNavState()
    },
    collisionRadius: resolvedDef.collisionRadius,
    enemyTier: "minion",
    tierXpMult: 1,
    affixes: [],
    affixState: {},
    renderAlpha: 1,
    showHealthBar: false,
    ignoreStagger: !!resolvedDef.ignoreStagger,
    ignoreKnockback: !!resolvedDef.ignoreKnockback,
    plates: Math.max(0, resolvedDef.plates || 0),
    maxPlates: Math.max(0, resolvedDef.plates || 0),
    plateMaxDurability: 0,
    plateDurability: 0,
    plateConsumeCooldownTimer: 0,
    hitTimer: 0,
    hitDuration: 0.1,
    staggerTimer: 0,
    staggerDuration: 0.14,
    hitDirX: 0,
    hitDirY: 0,
    collisionBounceOffsetX: 0,
    collisionBounceOffsetY: 0,
    collisionBounceTimer: 0,
    collisionBounceDuration: 0.1,
    collisionBounceCooldownTimer: 0,
    staggerMoveSpeed: 0,
    staggerPauseTimer: 0,
    poiseMult: ENEMY_TIER_POISE_MULT.minion,
    hitInterruptPending: false,
    hitInterruptPauseDuration: 0,
    hitInterruptStaggerDuration: 0,
    hitInterruptBeforeWindupCommitOnly: false,
    recentDamageEvents: [],
    burstHeavyStaggerActiveUntil: -Infinity,
    burstHeavyStaggerCooldownUntil: -Infinity,
    sourceDef: resolvedDef
  };
  applyEnemyMovementCollider(enemy, resolvedDef);
  initializeEnemyAnimationDirection(enemy, "down");
  return enemy;
}

function buildDirectionalEnemy(def, x, y, random = Math.random) {
  return buildUndeadEnemy(def, x, y, random);
}

function resolveTierAffixes(tier, affixes, random = Math.random) {
  const tierDef = getEnemyTierDef(tier);
  const bannedAffixes = tier === "miniBoss" ? ["evasive", "wall"] : [];
  const selected = getValidAffixIds(affixes || []).filter((id) => !bannedAffixes.includes(id));

  if (selected.length >= tierDef.affixCount) {
    return selected.slice(0, tierDef.affixCount);
  }

  const rerolled = pickRandomAffixIds(
    random,
    tierDef.affixCount - selected.length,
    [...selected, ...bannedAffixes]
  );
  return [...selected, ...rerolled];
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
  if (enemy.isMiniBoss) {
    enemy.baseSpeed = Math.max(12, Math.round(enemy.baseSpeed * 1.15));
  }
  enemy.damage = enemy.baseDamage;
  enemy.speed = enemy.baseSpeed;
  enemy.affixes = resolveTierAffixes(
    tier,
    options.affixes?.length ? options.affixes : pickRandomAffixIds(random, tierDef.affixCount),
    random
  );
  if (enemy.affixes.includes("plated")) {
    enemy.plates = Math.max(0, enemy.plates || 0) + 3;
    enemy.maxPlates = Math.max(enemy.plates, (enemy.maxPlates || 0) + 3);
  }
  enemy.plateMaxDurability = Math.max(1, enemy.maxHp * 0.1);
  enemy.plateDurability = enemy.plates > 0 ? enemy.plateMaxDurability : 0;
  if (enemy.affixes.includes("phantom") || enemy.affixes.includes("flying")) {
    enemy.ignoreWalls = true;
  }
  refreshEnemyMovementCollider(enemy);
  return enemy;
}

export function spawnEnemyByType(typeId, x, y, options = {}) {
  const undead = getUndeadEnemyDef(typeId);
  if (undead) {
    const enemy = applyTierAndAffixes(buildDirectionalEnemy(undead, x, y, options.random), options, options.random);
    if (options.assets) applyEnemyMovementCollider(enemy, enemy.sourceDef || undead, options.assets);
    return enemy;
  }
  const barbarian = getBarbarianEnemyDef(typeId);
  if (barbarian) {
    const enemy = applyTierAndAffixes(buildDirectionalEnemy(barbarian, x, y, options.random), options, options.random);
    if (options.assets) applyEnemyMovementCollider(enemy, enemy.sourceDef || barbarian, options.assets);
    return enemy;
  }
  const shepard = getShepardEnemyDef(typeId);
  if (shepard) {
    const enemy = applyTierAndAffixes(buildDirectionalEnemy(shepard, x, y, options.random), options, options.random);
    if (options.assets) applyEnemyMovementCollider(enemy, enemy.sourceDef || shepard, options.assets);
    return enemy;
  }
  const def = getEnemyDef(typeId);
  if (def) {
    const enemy = applyTierAndAffixes(buildBaseEnemy(def, x, y, options.random), options, options.random);
    if (options.assets) applyEnemyMovementCollider(enemy, def, options.assets);
    return enemy;
  }
  return null;
}

function inflateRect(rect, padding) {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    w: rect.w + padding * 2,
    h: rect.h + padding * 2
  };
}

function getEnemySpawnVoidPadding(room, enemy) {
  const enemySize = Math.max(enemy?.w || enemy?.size || 0, enemy?.h || enemy?.size || 0);
  const sizePadding = Math.round(enemySize * 0.2);
  return Math.max(ENEMY_VOID_SPAWN_PADDING, sizePadding);
}

export function isEnemySpawnRectSafe(room, rect, enemy = null) {
  if (!room || !rect) return true;
  const padding = getEnemySpawnVoidPadding(room, enemy);
  if ((room.voidRects || []).some((voidRect) => rectsOverlap(rect, inflateRect(voidRect, padding)))) return false;
  if ((room.invisibleBarrierRects || []).some((barrier) => rectsOverlap(rect, inflateRect(barrier, padding)))) return false;
  const collisionPadding = Math.max(4, Math.round(Math.max(rect.w, rect.h) * 0.25));
  if ((room.collisionRects || []).some((cr) => rectsOverlap(rect, inflateRect(cr, collisionPadding)))) return false;
  return true;
}

function isRectOnPlayerStartCell(rect, room) {
  if (!rect || !room?.start) return false;
  return rectsOverlap(rect, room.start);
}

export function findSafeEnemySpawnPosition(room, enemy, x = enemy?.x || 0, y = enemy?.y || 0) {
  if (!room || !enemy) return { x, y };
  const maxX = Math.max(0, room.width - enemy.w);
  const maxY = Math.max(0, room.height - enemy.h);
  const baseX = clamp(x, 0, maxX);
  const baseY = clamp(y, 0, maxY);
  const baseRect = { x: baseX, y: baseY, w: enemy.w, h: enemy.h };
  if (isEnemySpawnRectSafe(room, baseRect, enemy) && !isRectOnPlayerStartCell(baseRect, room)) {
    return { x: baseX, y: baseY };
  }

  const step = Math.max(8, Math.floor((room.tileSize || 32) * 0.25));
  const maxRadius = Math.max(step * 12, getEnemySpawnVoidPadding(room, enemy) * 4);
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 }
  ];

  for (let radius = step; radius <= maxRadius; radius += step) {
    for (const direction of directions) {
      const nextX = clamp(baseX + direction.x * radius, 0, maxX);
      const nextY = clamp(baseY + direction.y * radius, 0, maxY);
      const nextRect = { x: nextX, y: nextY, w: enemy.w, h: enemy.h };
      if (isEnemySpawnRectSafe(room, nextRect, enemy) && !isRectOnPlayerStartCell(nextRect, room)) {
        return { x: nextX, y: nextY };
      }
    }
  }

  return { x: baseX, y: baseY };
}

function placeEnemy(typeId, tile, room, options = {}) {
  const def = getUndeadEnemyDef(typeId) || getBarbarianEnemyDef(typeId) || getShepardEnemyDef(typeId) || getEnemyDef(typeId);
  if (!def || !tile) return null;
  const size = def.size;
  const x = tile.x * room.tileSize + (room.tileSize - size) * 0.5;
  const y = tile.y * room.tileSize + (room.tileSize - size) * 0.5;
  const cliffCollisionRects = room?.tileWallRects?.filter((rect) => rect?._upperCliffRockCollision) || [];
  const enemy = spawnEnemyByType(typeId, x, y, options);
  if (!enemy) return null;
  const safePosition = findSafeEnemySpawnPosition(room, enemy, enemy.x, enemy.y);
  enemy.x = safePosition.x;
  enemy.y = safePosition.y;
  const spawnRect = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
  if (!isEnemySpawnRectSafe(room, spawnRect, enemy)) return null;
  if (cliffCollisionRects.some((rect) => rectsOverlap(spawnRect, rect))) return null;
  return enemy;
}

function canPlace(rect, usedRects) {
  return !usedRects.some((other) => rectsOverlap(rect, { x: other.x - 24, y: other.y - 24, w: other.w + 48, h: other.h + 48 }));
}

function isRectNearPlayerSpawn(rect, room, minDistance = PLAYER_SPAWN_SAFE_RADIUS) {
  if (!rect || !room?.start) return false;
  const spawnCenter = centerOf(room.start);
  const rectCenter = centerOf(rect);
  return distance(spawnCenter.x, spawnCenter.y, rectCenter.x, rectCenter.y) < minDistance;
}

function getCellBandTiles(room, col, row, options = {}) {
  const minTileX = col * 30;
  const minTileY = row * 30;
  const maxTileX = minTileX + 29;
  const maxTileY = minTileY + 29;
  const xMin = options.xMin ?? 0;
  const xMax = options.xMax ?? 1;
  const yMin = options.yMin ?? 0;
  const yMax = options.yMax ?? 1;
  const bandMinX = minTileX + Math.floor(30 * xMin);
  const bandMaxX = minTileX + Math.min(29, Math.ceil(30 * xMax) - 1);
  const bandMinY = minTileY + Math.floor(30 * yMin);
  const bandMaxY = minTileY + Math.min(29, Math.ceil(30 * yMax) - 1);
  return room.spawnTiles.filter((tile) => (
    tile.x >= minTileX
    && tile.x <= maxTileX
    && tile.y >= minTileY
    && tile.y <= maxTileY
    && tile.x >= Math.max(minTileX, bandMinX)
    && tile.x <= Math.min(maxTileX, bandMaxX)
    && tile.y >= Math.max(minTileY, bandMinY)
    && tile.y <= Math.min(maxTileY, bandMaxY)
  ));
}

function getEnemySpawnDef(typeId) {
  return getUndeadEnemyDef(typeId) || getBarbarianEnemyDef(typeId) || getShepardEnemyDef(typeId) || getEnemyDef(typeId) || null;
}

function getEnemyMovementTactic(def) {
  return def?.movementTactic || DEFAULT_MOVEMENT_TACTIC;
}

function getEnemyRole(def) {
  return def?.role || DEFAULT_ROLE;
}

function getEnemyCategory(def) {
  return String(def?.category || "Uncategorized");
}

function createSpawnCategoryStats() {
  return {
    categoryCounts: Object.create(null),
    roleCounts: Object.create(null),
    tacticCounts: Object.create(null),
    typeCounts: Object.create(null)
  };
}

function recordSpawnCategory(stats, def) {
  if (!stats || !def) return;
  const category = getEnemyCategory(def);
  const role = getEnemyRole(def);
  const tactic = getEnemyMovementTactic(def);
  stats.categoryCounts[category] = (stats.categoryCounts[category] || 0) + 1;
  stats.roleCounts[role] = (stats.roleCounts[role] || 0) + 1;
  stats.tacticCounts[tactic] = (stats.tacticCounts[tactic] || 0) + 1;
  stats.typeCounts[def.id] = (stats.typeCounts[def.id] || 0) + 1;
}

function getUnderrepresentedWeight(count) {
  if (!count) return 2.4;
  return Math.max(0.4, 1.4 - count * 0.18);
}

function chooseWeightedEnemyType(candidates, stats, tier, random) {
  if (!candidates.length) return null;
  const weighted = candidates.map((typeId) => {
    const def = getEnemySpawnDef(typeId);
    if (!def) return { typeId, weight: 0 };
    const role = getEnemyRole(def);
    const tactic = getEnemyMovementTactic(def);
    const roleWeight = getUnderrepresentedWeight(stats.roleCounts[role] || 0);
    const tacticWeight = getUnderrepresentedWeight(stats.tacticCounts[tactic] || 0);
    const repetitionPenalty = 1 / (1 + (stats.typeCounts[def.id] || 0) * 0.75);
    let weight = roleWeight * tacticWeight * repetitionPenalty;

    if (tier === "miniBoss") {
      weight *= MINI_BOSS_ROLE_WEIGHT[role] ?? 1;
      weight *= MINI_BOSS_TACTIC_WEIGHT[tactic] ?? 1;
    } else if (tier === "elite") {
      if (tactic === "Brave" || tactic === "Balance") weight *= 1.2;
      if (role === "ranged" && (stats.roleCounts.melee || 0) === 0) weight *= 0.8;
    } else {
      if (tactic === "Swarmer") weight *= 1.25;
      if (role === "ranged" && (stats.roleCounts.ranged || 0) > (stats.roleCounts.melee || 0) + 1) weight *= 0.75;
    }

    return { typeId, weight };
  }).filter((entry) => entry.weight > 0);

  if (!weighted.length) return sample(candidates, random);
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * totalWeight;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.typeId;
  }
  return weighted[weighted.length - 1]?.typeId || sample(candidates, random);
}

function chooseWeightedEnemyCategory(candidates, stats, tier, random) {
  if (!candidates.length) return null;
  const categoryWeights = new Map();
  const categoryTactics = new Map();
  for (const typeId of candidates) {
    const def = getEnemySpawnDef(typeId);
    if (!def) continue;
    const category = getEnemyCategory(def);
    let tactics = categoryTactics.get(category);
    if (!tactics) {
      tactics = new Set();
      categoryTactics.set(category, tactics);
    }
    tactics.add(getEnemyMovementTactic(def));
  }
  for (const typeId of candidates) {
    const def = getEnemySpawnDef(typeId);
    if (!def) continue;
    const category = getEnemyCategory(def);
    const role = getEnemyRole(def);
    const tactic = getEnemyMovementTactic(def);
    const categoryCount = stats.categoryCounts[category] || 0;
    let weight = getUnderrepresentedWeight(categoryCount);
    if (tier === "minion") {
      const tactics = new Set(
        candidates
          .map((candidateTypeId) => getEnemySpawnDef(candidateTypeId))
          .filter((candidateDef) => getEnemyCategory(candidateDef) === category)
          .map((candidateDef) => getEnemyMovementTactic(candidateDef))
      );
      weight *= 1 + Math.max(0, tactics.size - 1) * 0.18;
    }

    if (tier === "miniBoss") {
      weight *= MINI_BOSS_ROLE_WEIGHT[role] ?? 1;
      weight *= MINI_BOSS_TACTIC_WEIGHT[tactic] ?? 1;
    } else if (tier === "elite") {
      const tactics = categoryTactics.get(category) || new Set();
      const hasPreferredPrimary = ELITE_PRIMARY_TACTICS.some((primaryTactic) => tactics.has(primaryTactic));
      const hasTwist = [...tactics].some((availableTactic) => !ELITE_PRIMARY_TACTICS.includes(availableTactic) || tactics.size > 1);
      weight *= hasPreferredPrimary ? 1.75 : 0.08;
      if (hasTwist) weight *= 1.18;
      if (tactic === "Brave" || tactic === "Balance") weight *= 1.1;
      if (role === "melee") weight *= 1.05;
    } else if (tactic === "Swarmer") {
      weight *= 1.1;
    }

    categoryWeights.set(category, (categoryWeights.get(category) || 0) + weight);
  }

  if (!categoryWeights.size) return null;
  const weighted = [...categoryWeights.entries()];
  const totalWeight = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * totalWeight;
  for (const [category, weight] of weighted) {
    roll -= weight;
    if (roll <= 0) return category;
  }
  return weighted[weighted.length - 1]?.[0] || null;
}

function getGroupSizeForBehavior(typeId, tier, random) {
  const def = getEnemySpawnDef(typeId);
  const role = getEnemyRole(def);
  const tactic = getEnemyMovementTactic(def);
  if (tier === "miniBoss") return 1;
  if (tier === "elite") {
    if (tactic === "Swarmer") return 2 + Math.floor(random() * 2);
    if (role === "ranged" || tactic === "Coward") return 1 + Math.floor(random() * 2);
    if (tactic === "Brave" || role === "melee") return 1 + Math.floor(random() * 2);
    return 1 + Math.floor(random() * 2);
  }
  if (tactic === "Swarmer") return 3 + Math.floor(random() * 3);
  if (role === "ranged" || tactic === "Coward") return 1 + Math.floor(random() * 2);
  if (tactic === "Brave" || role === "melee") return 2 + Math.floor(random() * 2);
  return 2 + Math.floor(random() * 2);
}

function buildCategoryTacticPools(typeIds) {
  const categoryPools = new Map();
  for (const typeId of typeIds) {
    const def = getEnemySpawnDef(typeId);
    if (!def) continue;
    const category = getEnemyCategory(def);
    const tactic = getEnemyMovementTactic(def);
    let tacticPools = categoryPools.get(category);
    if (!tacticPools) {
      tacticPools = new Map();
      categoryPools.set(category, tacticPools);
    }
    let entries = tacticPools.get(tactic);
    if (!entries) {
      entries = [];
      tacticPools.set(tactic, entries);
    }
    entries.push(typeId);
  }
  return categoryPools;
}

function rollCountInRange(min, max, random) {
  const safeMin = Math.max(0, Math.floor(min || 0));
  const safeMax = Math.max(safeMin, Math.floor(max || safeMin));
  return safeMin + Math.floor(random() * (safeMax - safeMin + 1));
}

function chooseAvailableBucket(bucket, tacticPools, random) {
  const directEntries = tacticPools.get(bucket.tactic) || [];
  if (directEntries.length) {
    return {
      tactic: bucket.tactic,
      min: bucket.min,
      max: bucket.max
    };
  }
  const remaining = [...(bucket.replacements || [])];
  while (remaining.length) {
    const index = Math.floor(random() * remaining.length);
    const replacement = remaining.splice(index, 1)[0];
    if (!replacement) continue;
    const replacementEntries = tacticPools.get(replacement.tactic) || [];
    if (!replacementEntries.length) continue;
    return replacement;
  }
  return null;
}

function chooseTypeForTacticBucket(typeIds, stats, random) {
  if (!typeIds.length) return null;
  return chooseWeightedEnemyType(typeIds, stats, "minion", random) || sample(typeIds, random);
}

function chooseDistinctTypeSequence(typeIds, count, stats, tier, random) {
  const sequence = [];
  const remainingUnique = [...typeIds];
  while (sequence.length < count && remainingUnique.length) {
    const picked = chooseWeightedEnemyType(remainingUnique, stats, tier, random) || sample(remainingUnique, random);
    if (!picked) break;
    sequence.push(picked);
    const index = remainingUnique.indexOf(picked);
    if (index >= 0) remainingUnique.splice(index, 1);
  }
  while (sequence.length < count && typeIds.length) {
    const picked = chooseWeightedEnemyType(typeIds, stats, tier, random) || sample(typeIds, random);
    if (!picked) break;
    sequence.push(picked);
  }
  return sequence;
}

function buildMinionSquadPlan(category, categoryPools, stats, random) {
  if (!category) return [];
  const tacticPools = categoryPools.get(category);
  if (!tacticPools) return [];
  const plan = [];
  for (const bucket of MINION_TACTIC_BUCKETS) {
    const resolvedBucket = chooseAvailableBucket(bucket, tacticPools, random);
    if (!resolvedBucket) continue;
    const typeIds = tacticPools.get(resolvedBucket.tactic) || [];
    if (!typeIds.length) continue;
    const typeId = chooseTypeForTacticBucket(typeIds, stats, random);
    if (!typeId) continue;
    const count = rollCountInRange(resolvedBucket.min, resolvedBucket.max, random);
    if (count <= 0) continue;
    plan.push({
      tactic: resolvedBucket.tactic,
      typeId,
      count
    });
  }
  return plan;
}

function chooseElitePrimaryTactic(tacticPools, random) {
  const available = ELITE_PRIMARY_TACTICS.filter((tactic) => (tacticPools.get(tactic) || []).length > 0);
  if (available.length) return sample(available, random);
  const swarmerOnly = (tacticPools.get("Swarmer") || []).length > 0 ? "Swarmer" : null;
  return swarmerOnly;
}

function chooseEliteTwistTactic(tacticPools, primaryTactic, random) {
  const available = [...tacticPools.entries()]
    .filter(([, typeIds]) => Array.isArray(typeIds) && typeIds.length > 0)
    .map(([tactic]) => tactic)
    .filter((tactic) => tactic !== primaryTactic);
  if (!available.length) return null;
  const nonSwarmer = available.filter((tactic) => tactic !== "Swarmer");
  return sample(nonSwarmer.length ? nonSwarmer : available, random);
}

function buildEliteSquadPlan(category, categoryPools, stats, random) {
  if (!category) return [];
  const tacticPools = categoryPools.get(category);
  if (!tacticPools) return [];
  const primaryTactic = chooseElitePrimaryTactic(tacticPools, random);
  if (!primaryTactic) return [];

  const primaryTypeIds = tacticPools.get(primaryTactic) || [];
  if (!primaryTypeIds.length) return [];
  const primaryCount = rollCountInRange(ELITE_PRIMARY_MIN, ELITE_PRIMARY_MAX, random);
  const primarySequence = chooseDistinctTypeSequence(primaryTypeIds, primaryCount, stats, "elite", random);
  const plan = [];
  for (const typeId of primarySequence) {
    plan.push({
      tactic: primaryTactic,
      typeId,
      count: 1
    });
  }

  const twistTactic = chooseEliteTwistTactic(tacticPools, primaryTactic, random);
  if (!twistTactic) return plan;
  const twistTypeIds = tacticPools.get(twistTactic) || [];
  if (!twistTypeIds.length) return plan;
  const twistCount = twistTactic === "Swarmer" ? ELITE_SWARMER_TWIST_COUNT : ELITE_OTHER_TWIST_COUNT;
  const twistSequence = chooseDistinctTypeSequence(twistTypeIds, twistCount, stats, "elite", random);
  for (const typeId of twistSequence) {
    plan.push({
      tactic: twistTactic,
      typeId,
      count: 1
    });
  }

  return plan;
}

function getUnlockedRosterEntries(roster, roomIndex) {
  const unlocked = [];
  const lastIndex = Math.min(roomIndex, roster.length - 1);
  for (let index = 0; index <= lastIndex; index += 1) {
    unlocked.push(...(roster[index] || []));
  }
  return unlocked;
}

function getBiomeEnemyPool(roomIndex) {
  switch (roomIndex) {
    case 0:
      return [
        ...SLIME_POOL_BIOME_0,
        ...SWARMER_BEAST_POOL,
        ...BASIC_BARBARIAN_POOL
      ];
    case 1:
      return [
        ...SLIME_POOL_BIOME_1,
        ...ALL_BEAST_POOL,
        ...ADVANCED_BARBARIAN_POOL
      ];
    case 2:
      return [
        ...BASIC_UNDEAD_POOL,
        ...ADVANCED_BARBARIAN_POOL
      ];
    case 3:
      return [
        ...BASIC_UNDEAD_POOL,
        ...SLIME_ENEMY_POOL,
        ...ADVANCED_UNDEAD_POOL
      ];
    case 4:
      return [
        ...SLIME_POOL_BIOME_4
      ];
    default: {
      const table = getUnlockedRosterEntries(ROOM_ENEMY_TABLE, roomIndex);
      const undeadRoster = getUnlockedRosterEntries(UNDEAD_ROOM_ROSTER, roomIndex);
      const barbarianRoster = getUnlockedRosterEntries(BARBARIAN_ROOM_ROSTER, roomIndex);
      const shepardRoster = getUnlockedRosterEntries(SHEPARD_ROOM_ROSTER, roomIndex);
      return [...table, ...undeadRoster, ...barbarianRoster, ...shepardRoster];
    }
  }
}

function getGuaranteedSlimePool(roomIndex) {
  const unlockedSlimes = [...new Set(getUnlockedRosterEntries(ROOM_ENEMY_TABLE, roomIndex))];
  return unlockedSlimes.length ? unlockedSlimes : [...SLIME_ENEMY_POOL];
}

export function spawnRoomEnemies(room, roomIndex, seed, searchables = [], assets = null) {
  const random = createSeededRandom(seed + roomIndex * 41);
  const pool = [...new Set(getBiomeEnemyPool(roomIndex))];
  const usedRects = [
    room.start,
    room.exit,
    ...((room.biomeObstaclePlacementRects || []).map((rect) => ({ x: rect.x, y: rect.y, w: rect.w, h: rect.h }))),
    ...((room.treeObstacles || []).map((tree) => ({ x: tree.x, y: tree.y, w: tree.w, h: tree.h })))
  ];
  const enemies = [];
  const spawnStats = createSpawnCategoryStats();
  const clusterCategoryByKey = new Map();
  const categoryTacticPools = buildCategoryTacticPools(pool);
  const maxEnemies = Number.POSITIVE_INFINITY;
  const exitCellKey = `${room.archetypeGrid.exitCell.col},${room.archetypeGrid.exitCell.row}`;

  function getCellTiles(col, row) {
    const minX = col * 30;
    const maxX = minX + 29;
    const minY = row * 30;
    const maxY = minY + 29;
    return room.spawnTiles.filter((tile) => tile.x >= minX && tile.x <= maxX && tile.y >= minY && tile.y <= maxY);
  }

  function getRowZeroCenterTiles(col) {
    const minX = col * 30;
    const minY = 0;
    const centerX = minX + 15;
    const centerY = minY + 15;
    const offsets = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ];
    return offsets
      .map(([ox, oy]) => ({ x: centerX + ox, y: centerY + oy }))
      .filter((tile) => (
        tile.x >= 0
        && tile.y >= 0
        && tile.x < room.cols
        && tile.y < room.rows
        && room.grid?.[tile.y]?.[tile.x] === 0
      ));
  }

  function getTilesNearRect(rect, radiusTiles = 8) {
    if (!rect) return [];
    const centerX = Math.floor((rect.x + rect.w * 0.5) / room.tileSize);
    const centerY = Math.floor((rect.y + rect.h * 0.5) / room.tileSize);
    return room.spawnTiles.filter((tile) => (
      Math.abs(tile.x - centerX) <= radiusTiles
      && Math.abs(tile.y - centerY) <= radiusTiles
    ));
  }

  function filterTilesAwayFromPlayerSpawn(tiles, minDistance = PLAYER_SPAWN_SAFE_RADIUS) {
    if (!Array.isArray(tiles) || !tiles.length) return [];
    return tiles.filter((tile) => {
      const rect = {
        x: tile.x * room.tileSize,
        y: tile.y * room.tileSize,
        w: room.tileSize,
        h: room.tileSize
      };
      return !isRectNearPlayerSpawn(rect, room, minDistance);
    });
  }

  function filterTilesByPlayerSpawnDistance(tiles, minDistance = 0, maxDistance = Infinity) {
    if (!Array.isArray(tiles) || !tiles.length || !room?.start) return [];
    const spawnCenter = centerOf(room.start);
    return tiles.filter((tile) => {
      const rect = {
        x: tile.x * room.tileSize,
        y: tile.y * room.tileSize,
        w: room.tileSize,
        h: room.tileSize
      };
      const rectCenter = centerOf(rect);
      const tileDistance = distance(spawnCenter.x, spawnCenter.y, rectCenter.x, rectCenter.y);
      return tileDistance >= minDistance && tileDistance <= maxDistance;
    });
  }

  function getClusterCategory(tier, clusterKey = null) {
    const filtered = pool.filter((typeId) => {
      const def = getEnemySpawnDef(typeId);
      if (!def) return false;
      if (tier === "miniBoss" && getEnemyMovementTactic(def) === "Swarmer") return false;
      return true;
    });
    if (!filtered.length) return null;

    let category = clusterKey ? clusterCategoryByKey.get(clusterKey) : null;
    if (!category) {
      category = chooseWeightedEnemyCategory(filtered, spawnStats, tier, random)
        || getEnemyCategory(getEnemySpawnDef(sample(filtered, random)));
      if (clusterKey && category) clusterCategoryByKey.set(clusterKey, category);
    }

    return category;
  }

  function pickTypeIdForCluster(tier, clusterKey = null) {
    const filtered = pool.filter((typeId) => {
      const def = getEnemySpawnDef(typeId);
      if (!def) return false;
      if (tier === "miniBoss" && getEnemyMovementTactic(def) === "Swarmer") return false;
      return true;
    });
    if (!filtered.length) return null;
    const category = getClusterCategory(tier, clusterKey);
    if (!category) return chooseWeightedEnemyType(filtered, spawnStats, tier, random);

    const categoryFiltered = filtered.filter((typeId) => getEnemyCategory(getEnemySpawnDef(typeId)) === category);
    return chooseWeightedEnemyType(categoryFiltered.length ? categoryFiltered : filtered, spawnStats, tier, random);
  }

  function getGroupSize(typeId, tier) {
    return getGroupSizeForBehavior(typeId, tier, random);
  }

  function spawnPlannedBuckets(candidateTiles, tier, affixes, spawnGroupId, plan) {
    if (!candidateTiles.length || !plan.length || enemies.length >= maxEnemies) return;
    for (const bucket of plan) {
      const targetCount = Math.min(bucket.count, maxEnemies - enemies.length);
      for (let index = 0; index < targetCount; index += 1) {
        for (let attempt = 0; attempt < 28; attempt += 1) {
          const tile = sample(candidateTiles, random);
          const enemy = placeEnemy(bucket.typeId, tile, room, { tier, affixes, random, spawnGroupId, assets });
          if (!enemy) break;
          const rect = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
          if (!canPlace(rect, usedRects)) continue;
          enemy.spawnGroupId = spawnGroupId;
          enemies.push(enemy);
          recordSpawnCategory(spawnStats, getEnemySpawnDef(bucket.typeId));
          usedRects.push(rect);
          break;
        }
        if (enemies.length >= maxEnemies) break;
      }
      if (enemies.length >= maxEnemies) break;
    }
  }

  function spawnGroupInCell(col, row, tier) {
    const cellTiles = filterTilesAwayFromPlayerSpawn(getCellTiles(col, row));
    if (!cellTiles.length || enemies.length >= maxEnemies) return;
    const clusterKey = `cell:${col},${row}`;
    const affixes = pickRandomAffixIds(random, getEnemyTierDef(tier).affixCount);
    const spawnGroupId = `${col}_${row}_${tier}_${Math.floor(random() * 99999)}`;
    if (tier === "minion") {
      const category = getClusterCategory(tier, clusterKey);
      const squadPlan = buildMinionSquadPlan(category, categoryTacticPools, spawnStats, random);
      spawnPlannedBuckets(cellTiles, tier, affixes, spawnGroupId, squadPlan);
      return;
    }
    if (tier === "elite") {
      const category = getClusterCategory(tier, clusterKey);
      const squadPlan = buildEliteSquadPlan(category, categoryTacticPools, spawnStats, random);
      spawnPlannedBuckets(cellTiles, tier, affixes, spawnGroupId, squadPlan);
      return;
    }
    const typeId = pickTypeIdForCluster(tier, clusterKey);
    const targetCount = Math.min(getGroupSize(typeId, tier), maxEnemies - enemies.length);
    for (let index = 0; index < targetCount; index += 1) {
      for (let attempt = 0; attempt < 28; attempt += 1) {
        const tile = sample(cellTiles, random);
        const enemy = placeEnemy(typeId, tile, room, { tier, affixes, random, spawnGroupId, assets });
        if (!enemy) return;
        const rect = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
        if (!canPlace(rect, usedRects)) continue;
        enemy.spawnGroupId = spawnGroupId;
        enemies.push(enemy);
        recordSpawnCategory(spawnStats, getEnemySpawnDef(typeId));
        usedRects.push(rect);
        break;
      }
    }
  }

  function spawnGroupAtPreferredTiles(candidateTiles, col, row, tier, groupLabel = tier) {
    candidateTiles = filterTilesAwayFromPlayerSpawn(candidateTiles);
    if (!candidateTiles.length || enemies.length >= maxEnemies) return;
    const clusterKey = col >= 0 && row >= 0
      ? `cell:${col},${row}`
      : `cluster:${col},${row}:${groupLabel}`;
    const affixes = pickRandomAffixIds(random, getEnemyTierDef(tier).affixCount);
    const spawnGroupId = `${col}_${row}_${groupLabel}_${Math.floor(random() * 99999)}`;
    if (tier === "minion") {
      const category = getClusterCategory(tier, clusterKey);
      const squadPlan = buildMinionSquadPlan(category, categoryTacticPools, spawnStats, random);
      spawnPlannedBuckets(candidateTiles, tier, affixes, spawnGroupId, squadPlan);
      return;
    }
    if (tier === "elite") {
      const category = getClusterCategory(tier, clusterKey);
      const squadPlan = buildEliteSquadPlan(category, categoryTacticPools, spawnStats, random);
      spawnPlannedBuckets(candidateTiles, tier, affixes, spawnGroupId, squadPlan);
      return;
    }
    const typeId = pickTypeIdForCluster(tier, clusterKey);
    const targetCount = Math.min(getGroupSize(typeId, tier), maxEnemies - enemies.length);
    for (let index = 0; index < targetCount; index += 1) {
      for (let attempt = 0; attempt < 28; attempt += 1) {
        const tile = sample(candidateTiles, random);
        const enemy = placeEnemy(typeId, tile, room, { tier, affixes, random, spawnGroupId, assets });
        if (!enemy) return;
        const rect = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
        if (!canPlace(rect, usedRects)) continue;
        enemy.spawnGroupId = spawnGroupId;
        enemies.push(enemy);
        recordSpawnCategory(spawnStats, getEnemySpawnDef(typeId));
        usedRects.push(rect);
        break;
      }
    }
  }

  const cells = [];
  const rowZeroPlayableCells = [];
  for (let row = 0; row < room.archetypeGrid.grid.length; row += 1) {
    for (let col = 0; col < room.archetypeGrid.grid[row].length; col += 1) {
      const cellKey = `${col},${row}`;
      const archetype = room.archetypeGrid.grid[row][col];
      if (archetype === "empty" || archetype === "start" || cellKey === exitCellKey) continue;
      if (row === 0) {
        rowZeroPlayableCells.push({ col, row, archetype });
        continue;
      }
      cells.push({ col, row, archetype });
    }
  }
  cells.sort((a, b) => (a.archetype === "miniboss" ? -1 : 0) - (b.archetype === "miniboss" ? -1 : 0));

  for (const cell of rowZeroPlayableCells) {
    const centerTiles = getRowZeroCenterTiles(cell.col);
    spawnGroupAtPreferredTiles(centerTiles, cell.col, cell.row, "elite", "row0_elite_a");
    spawnGroupAtPreferredTiles(centerTiles, cell.col, cell.row, "elite", "row0_elite_b");
  }

  for (const searchable of searchables || []) {
    if (enemies.length >= maxEnemies) break;
    if (searchable?.typeId !== "smallChest" && searchable?.typeId !== "largeChest") continue;
    const guardTiles = getTilesNearRect(searchable, 7);
    if (!guardTiles.length) continue;
    const guardTier = searchable.typeId === "largeChest" ? "elite" : "minion";
    const groupLabel = searchable.typeId === "largeChest" ? "large_chest_guard" : "small_chest_guard";
    spawnGroupAtPreferredTiles(guardTiles, -1, -1, guardTier, `${groupLabel}_${searchable.id}`);
  }

  for (const cell of cells) {
    if (cell.archetype === "deepWoods") {
      const deepWoodsBands = [
        { xMin: 0.05, xMax: 0.31, yMin: 0.6, yMax: 1.0, label: "deep_woods_elite_a" },
        { xMin: 0.35, xMax: 0.65, yMin: 0.6, yMax: 1.0, label: "deep_woods_elite_b" },
        { xMin: 0.69, xMax: 0.95, yMin: 0.6, yMax: 1.0, label: "deep_woods_elite_c" }
      ];
      for (const band of deepWoodsBands) {
        if (enemies.length >= maxEnemies) break;
        const bandTiles = getCellBandTiles(room, cell.col, cell.row, band);
        spawnGroupAtPreferredTiles(bandTiles, cell.col, cell.row, "elite", band.label);
      }
      continue;
    }
    const plan = getBiomeSpawnPlan(cell.archetype);
    for (const entry of plan) {
      if (enemies.length >= maxEnemies) break;
      const baseChance = entry.chance ?? 1.0;
      const effectiveChance = Math.min(1.0, baseChance * getRowSpawnModifier(cell.row, entry.tier) * getColumnSpawnModifier(cell.col, entry.tier));
      if (random() > effectiveChance) continue;
      spawnGroupInCell(cell.col, cell.row, entry.tier);
    }
    if (cell.archetype === "miniboss") {
      room.minibossBounds = room.biomeCellBounds?.(cell.col, cell.row) || null;
    }
  }

  if (enemies.length < maxEnemies) {
    const guaranteedSlimePool = getGuaranteedSlimePool(roomIndex);
    const nearbySpawnTiles = filterTilesByPlayerSpawnDistance(
      room.spawnTiles,
      GUARANTEED_SLIME_MIN_DISTANCE,
      GUARANTEED_SLIME_MAX_DISTANCE
    );
    const fallbackSpawnTiles = filterTilesByPlayerSpawnDistance(
      room.spawnTiles,
      GUARANTEED_SLIME_MIN_DISTANCE
    );
    const slimeTiles = nearbySpawnTiles.length ? nearbySpawnTiles : fallbackSpawnTiles;
    for (let tileAttempt = 0; tileAttempt < 48 && slimeTiles.length; tileAttempt += 1) {
      const tile = sample(slimeTiles, random);
      const typeId = sample(guaranteedSlimePool, random);
      const slime = placeEnemy(typeId, tile, room, {
        tier: "minion",
        random,
        assets
      });
      if (!slime) continue;
      const rect = { x: slime.x, y: slime.y, w: slime.w, h: slime.h };
      if (!canPlace(rect, usedRects)) continue;
      enemies.push(slime);
      recordSpawnCategory(spawnStats, getEnemySpawnDef(typeId));
      usedRects.push(rect);
      break;
    }
  }

  // Final filtering step: remove enemies based on their column position
  const filtered = [];
  for (const enemy of enemies) {
    const centerX = enemy.x + (enemy.w || 0) * 0.5;
    const col = Math.floor(centerX / (room.tileSize * 30));

    let removalChance = 0;
    if (col === 0) removalChance = 0.5;
    else if (col === 1) removalChance = 0.3;
    else if (col === 3) removalChance = 0.5;

    if (removalChance > 0 && random() < removalChance) {
      continue;
    }
    filtered.push(enemy);
  }

  return filtered;
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
  const movementSpeedMult = getBaseEnemyMovementSpeedMultiplier(enemy);
  enemy.awarenessState = awareness.state;
  enemy.facing = dir.x >= 0 ? 1 : -1;
  setEnemyAnimationDirection(enemy, dir.x >= 0 ? "right" : "left");

  if (awareness.state === "blinded") {
    updateBlindedBaseEnemy(game, enemy, dt);
    return;
  }

  if (updateMinibossDash(game, enemy, dt, { awarenessState: awareness.state, fallbackDir: dir })) {
    return;
  }

  const erraticMoveDir = getErraticMoveDir(enemy);
  if (awareness.state !== "idle" && erraticMoveDir) {
    enemy.facing = erraticMoveDir.x >= 0 ? 1 : -1;
    setEnemyAnimationDirection(enemy, erraticMoveDir.x >= 0 ? "right" : "left");
    enemy.isMoving = steerEnemyMovement(game, enemy, erraticMoveDir, playerCenter, dt, {
      speedMult: movementSpeedMult * (awareness.speedMultiplier || 1) * 1.3,
      behavior: "hold"
    });
    enemy.render.sheetKey = enemy.isMoving ? "move" : "idle";
    enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite[enemy.render.sheetKey]?.fps || 8)) % (enemy.sprite[enemy.render.sheetKey]?.frames || 1);
    return;
  }

  if (awareness.state !== "idle" && isEvasiveRetreatActive(enemy)) {
    const retreatDir = { x: -dir.x, y: -dir.y };
    enemy.facing = retreatDir.x >= 0 ? 1 : -1;
    setEnemyAnimationDirection(enemy, retreatDir.x >= 0 ? "right" : "left");
    enemy.isMoving = steerEnemyMovement(game, enemy, retreatDir, playerCenter, dt, {
      speedMult: movementSpeedMult * (awareness.speedMultiplier || 1),
      behavior: "retreat",
      desiredRange: Math.max(enemy.preferredRange || 0, 220),
      clearDistanceThreshold: Math.max(enemy.preferredRange || 0, 220)
    });
    enemy.render.sheetKey = enemy.isMoving ? "move" : "idle";
    enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite[enemy.render.sheetKey]?.fps || 8)) % (enemy.sprite[enemy.render.sheetKey]?.frames || 1);
    return;
  }

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
      steerEnemyMovement(game, enemy, dir, playerCenter, dt, {
        speedMult: movementSpeedMult * awareness.speedMultiplier,
        behavior: "advance",
        clearDistanceThreshold: enemy.preferredRange + 20
      });
      enemy.render.sheetKey = "move";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.move?.fps || 10)) % (enemy.sprite.move?.frames || 1);
      return;
    }

    if (targetDistance > enemy.preferredRange + 20) {
      steerEnemyMovement(game, enemy, dir, playerCenter, dt, {
        speedMult: movementSpeedMult,
        behavior: "advance",
        clearDistanceThreshold: enemy.preferredRange + 20
      });
      enemy.render.sheetKey = "move";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.move?.fps || 10)) % (enemy.sprite.move?.frames || 1);
      return;
    }
    if (targetDistance < 60) {
      steerEnemyMovement(game, enemy, { x: -dir.x, y: -dir.y }, playerCenter, dt, {
        speedMult: movementSpeedMult,
        behavior: "retreat",
        desiredRange: 60,
        clearDistanceThreshold: 60
      });
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
      tryMoveEnemy(enemy, game.world, dash.dirX * dashDistance, dash.dirY * dashDistance, game);
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
      steerEnemyMovement(game, enemy, dir, playerCenter, dt, {
        speedMult: movementSpeedMult * awareness.speedMultiplier,
        behavior: "advance",
        clearDistanceThreshold: enemy.preferredRange + 30
      });
      enemy.render.sheetKey = "move";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.move?.fps || 8)) % (enemy.sprite.move?.frames || 1);
      return;
    }
    if (targetDistance > enemy.preferredRange + 30) {
      steerEnemyMovement(game, enemy, dir, playerCenter, dt, {
        speedMult: movementSpeedMult,
        behavior: "advance",
        clearDistanceThreshold: enemy.preferredRange + 30
      });
    } else if (targetDistance < enemy.preferredRange - 40) {
      steerEnemyMovement(game, enemy, { x: -dir.x, y: -dir.y }, playerCenter, dt, {
        speedMult: movementSpeedMult,
        behavior: "retreat",
        desiredRange: enemy.preferredRange,
        clearDistanceThreshold: enemy.preferredRange - 40
      });
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
    steerEnemyMovement(game, enemy, {
      x: dir.x * 0.6 + side.x * 0.5,
      y: dir.y * 0.6 + side.y * 0.5
    }, playerCenter, dt, {
      speedMult: movementSpeedMult * awareness.speedMultiplier,
      behavior: "advance"
    });
  } else {
    steerEnemyMovement(game, enemy, dir, playerCenter, dt, {
      speedMult: movementSpeedMult * awareness.speedMultiplier,
      behavior: "advance"
    });
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
    spriteAsset: blessing.spriteAsset ?? null,
    spriteFrames: blessing.spriteFrames ?? null,
    spriteFrameWidth: blessing.spriteFrameWidth ?? null,
    spriteFrameHeight: blessing.spriteFrameHeight ?? null,
    spriteFps: blessing.spriteFps ?? null,
    spriteLoopStart: blessing.spriteLoopStart ?? null,
    spriteLoopEnd: blessing.spriteLoopEnd ?? null,
    spriteCropWidth: blessing.spriteCropWidth ?? null,
    spriteCropHeight: blessing.spriteCropHeight ?? null,
    poisonDps: blessing.poisonDps ?? 3,
    poisonDuration: blessing.poisonDuration ?? 4,
    sourceAttackId: "poisonous_blessing_death"
  });
  enemy.state.poisonBlessingDeathBurstDone = true;
}

export function updateEnemies(game, dt) {
  beginEnemyAffixFrame(game);
  applyEnemyAuraSources(game);
  const introEnemyHoldActive = (game.runStartIntro?.active && (game.runStartIntro.elapsed || 0) < 2);
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    enemy.state ||= {};
    updateEnemyAnimationDirection(enemy, dt);
    resolveEnemyWallOverlap(enemy, game.world, game);
    const hitPauseActiveAtFrameStart = (enemy.staggerPauseTimer || 0) > 0;
    tickEnemyHitReaction(enemy, dt);
    if (!hitPauseActiveAtFrameStart) enemy.animClock += dt * (enemy.animationSpeedMult || 1);
    updateMinibossDashVisuals(enemy, dt);
    enemy.state.freezeTimer = Math.max(0, (enemy.state.freezeTimer || 0) - dt);
    enemy.state.skillSlowTimer = Math.max(0, (enemy.state.skillSlowTimer || 0) - dt);
    enemy.state.bleedTimer = Math.max(0, (enemy.state.bleedTimer || 0) - dt);
    enemy.state.bleedTickTimer = Math.max(0, (enemy.state.bleedTickTimer || 0) - dt);
    enemy.state.poisonBlessingUntil = Math.max(0, (enemy.state.poisonBlessingUntil || 0) - dt);
    if ((enemy.state.bleedStacks || 0) > 0 && (enemy.state.bleedTimer || 0) > 0 && enemy.state.bleedTickTimer <= 0) {
      enemy.state.bleedTickTimer = 1;
      game.damageEnemy(enemy, (enemy.state.bleedStacks || 0) * (enemy.state.bleedDamagePerStack || 1), {
        source: "skill",
        isDirect: false,
        bypassPlates: true
      });
      if (enemy.dead) continue;
    }
    if ((enemy.state.bleedTimer || 0) <= 0) {
      enemy.state.bleedStacks = 0;
      enemy.state.bleedDamagePerStack = 0;
    }
    updateEnemyAffixes(game, enemy, dt);
    updateStatusState(enemy, dt, {
      onTickDamage(amount, kind) {
        if (amount <= 0) return;
        game.damageEnemy(enemy, amount, {
          source: kind === "burn" ? "burn" : "skill",
          isDirect: false,
          bypassPlates: true
        });
      }
    });
    if (enemy.dead) continue;
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
      setEnemyHitRenderFrame(enemy);
      continue;
    }
    if (enemy.state.freezeTimer > 0) {
      enemy.speed = 0;
      if (!setEnemyHitRenderFrame(enemy)) {
        enemy.render.sheetKey = "idle";
        enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.idle?.fps || 8)) % (enemy.sprite.idle?.frames || 1);
      }
      continue;
    }
    if (applyEnemyStaggerMotion(game, enemy, dt)) {
      setEnemyHitRenderFrame(enemy);
      continue;
    }
    if (introEnemyHoldActive) {
      enemy.isMoving = false;
      enemy.render.sheetKey = "idle";
      enemy.render.frame = Math.floor(enemy.animClock * (enemy.sprite.idle?.fps || 8)) % Math.max(1, enemy.sprite.idle?.frames || 1);
      continue;
    }
    if (isUndeadEnemy(enemy)) {
      updateUndeadEnemy(game, enemy, dt);
      continue;
    }
    updateBaseEnemy(game, enemy, dt);
  }
  for (const enemy of game.enemies) {
    if (!enemy.dead) continue;
    releaseEnemyMeleeAttackToken(game, enemy);
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
  return [...new Set([...ROOM_ENEMY_TABLE.flat(), ...UNDEAD_ENEMY_IDS, ...BARBARIAN_ENEMY_IDS, ...SHEPARD_ENEMY_IDS])];
}

export function getControllableEnemyTypeIds() {
  return getAllEnemyTypeIds().filter((typeId) => {
    const def = getUndeadEnemyDef(typeId) || getBarbarianEnemyDef(typeId) || getShepardEnemyDef(typeId) || getEnemyDef(typeId);
    return Array.isArray(def?.attacks) && def.attacks.length > 0;
  });
}
