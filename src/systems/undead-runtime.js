import { centerOf, clamp, distance, normalize, rectsOverlap, toDirectionKey } from "../core/runtime-utils.js";
import { applyEnemyTargetStatus } from "./combat.js";
import { getEnemyAwareness } from "./enemy-awareness.js";
import { getEnemyTargetCenter, getEnemyTargetEntity } from "./enemy-targeting.js";
import { getTacticalMovementCommand, noteEnemyAttackFinished } from "./tactical-movement.js";

const ENEMY_ATTACK_LOCKOUT_SECONDS = 2;

const ROLL_INTO_PLAYER_IDS = new Set([
  "m_ud_brute",
  "m_ud_dark_lord_2",
  "m_ud_dark_knight_3",
  "m_ud_berserker_4",
  "m_ud_warrior",
  "m_bar_ogre_1",
  "m_bar_golem_2",
  "m_bar_nomad_3",
  "m_bar_berserker_4",
  "m_bar_barbarian_6"
]);

function scheduleNextRoll(runtime, now) {
  runtime.roll.nextAt = now + 3 + Math.random() * 4;
}

function randomAngleInRange(min, max) {
  return min + Math.random() * (max - min);
}

function chooseRollDirection(enemy, dirToPlayer) {
  const baseAngle = Math.atan2(dirToPlayer.y, dirToPlayer.x);
  const halfArc = Math.PI / 6;
  let angle = baseAngle;
  if (ROLL_INTO_PLAYER_IDS.has(enemy.type)) {
    angle = baseAngle + randomAngleInRange(-halfArc, halfArc);
  } else {
    const sign = Math.random() < 0.5 ? -1 : 1;
    angle = baseAngle + sign * randomAngleInRange(halfArc, Math.PI);
  }
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function maybeStartRoll(game, enemy, dirToPlayer) {
  const runtime = enemy.attackRuntime;
  if (!enemy.sprite.roll) return false;
  if (runtime.state !== "idle") return false;
  if (runtime.roll.active) return false;
  if (game.time < runtime.roll.nextAt) return false;
  const dir = chooseRollDirection(enemy, dirToPlayer);
  runtime.roll.active = true;
  runtime.roll.elapsed = 0;
  runtime.roll.duration = 1;
  runtime.roll.dirX = dir.x;
  runtime.roll.dirY = dir.y;
  syncFacing(enemy, dir);
  return true;
}

function updateRoll(game, enemy, dt) {
  const runtime = enemy.attackRuntime;
  if (!runtime.roll.active) return false;
  runtime.roll.elapsed += dt;
  const progress = clamp(runtime.roll.elapsed / Math.max(0.001, runtime.roll.duration), 0, 1);
  const speedScale = 2 - progress;
  tryMoveEnemy(enemy, game.world, runtime.roll.dirX * enemy.speed * speedScale * dt, runtime.roll.dirY * enemy.speed * speedScale * dt);
  syncFacing(enemy, { x: runtime.roll.dirX, y: runtime.roll.dirY });
  enemy.isMoving = true;
  if (runtime.roll.elapsed >= runtime.roll.duration) {
    runtime.roll.active = false;
    runtime.roll.elapsed = 0;
    scheduleNextRoll(runtime, game.time);
  }
  return true;
}

function weightedPick(attacks) {
  let total = 0;
  for (const attack of attacks) total += attack.weight ?? 1;
  let roll = Math.random() * Math.max(total, 0.0001);
  for (const attack of attacks) {
    roll -= attack.weight ?? 1;
    if (roll <= 0) return attack;
  }
  return attacks[0] || null;
}

function getEnemyAttackBucket(enemy) {
  if (enemy?.enemyTier === "miniBoss") return "miniBoss";
  if (enemy?.enemyTier === "elite") return "elite";
  return "minion";
}

function canTierUseAttack(enemy, attack) {
  const rarity = String(attack?.rarity || "normal").toLowerCase();
  const bucket = getEnemyAttackBucket(enemy);
  if (bucket === "minion") return rarity === "normal";
  if (bucket === "elite") return rarity === "normal" || rarity === "uncommon";
  if (bucket === "miniBoss") return rarity === "uncommon" || rarity === "rare";
  return true;
}

function tryMoveEnemy(enemy, room, dx, dy) {
  const previousX = enemy.x;
  const previousY = enemy.y;
  const nextX = clamp(enemy.x + dx, 0, room.width - enemy.w);
  const nextY = clamp(enemy.y + dy, 0, room.height - enemy.h);
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
  return moveX !== previousX || moveY !== previousY;
}

function getAttackTriggerFrame(attack) {
  if (Number.isFinite(attack.hitboxTrigger)) return Math.max(0, Math.floor(attack.hitboxTrigger));
  const animFps = Number(attack.animFps) || 14;
  const totalFrames = Math.max(1, Math.round((Number(attack.activeAnimDuration) || 15 / 14) * animFps));
  return Math.floor(totalFrames * 0.5);
}

function getAttackTotalFrames(attack) {
  if (Number.isFinite(attack.totalFrames)) return Math.max(1, Math.floor(attack.totalFrames));
  const animFps = Number(attack.animFps) || 14;
  const activeAnimDuration = Number(attack.activeAnimDuration) || 15 / 14;
  return Math.max(1, Math.round(activeAnimDuration * animFps));
}

function getAttackActiveDuration(attack) {
  if (Number.isFinite(attack.activeDurationSec)) return Math.max(0.01, Number(attack.activeDurationSec));
  const animFps = Math.max(1, Number(attack.animFps) || 14);
  const totalFrames = getAttackTotalFrames(attack);
  const trigger = Math.min(totalFrames - 1, getAttackTriggerFrame(attack));
  const remainingFrames = Math.max(1, totalFrames - trigger);
  return remainingFrames / animFps;
}

function getAttackWindupStopFrame(attack, triggerFrame) {
  if (!Number.isFinite(attack.windupStop)) return null;
  const stopFrame = clamp(Math.floor(attack.windupStop), 0, triggerFrame);
  if (triggerFrame <= 0 || stopFrame >= triggerFrame) return null;
  return stopFrame;
}

function getWindupFrameAtProgress(attack, progress, maxFrame) {
  const triggerFrame = Math.min(maxFrame, getAttackTriggerFrame(attack));
  const clampedProgress = clamp(progress, 0, 0.9999);
  const stopFrame = getAttackWindupStopFrame(attack, triggerFrame);
  if (stopFrame == null) {
    return Math.min(triggerFrame, Math.floor(clampedProgress * (triggerFrame + 1)));
  }

  // Windup uses frames before the trigger, with one extra slot spent holding the stop frame.
  const windupSlots = triggerFrame + 1;
  const slot = Math.min(windupSlots - 1, Math.floor(clampedProgress * windupSlots));
  if (slot <= stopFrame) return slot;
  return Math.min(triggerFrame - 1, slot - 1);
}

function computeDamage(enemy, attack, scale = attack.damageScale ?? 1) {
  return Math.max(1, Math.round(enemy.damage * scale));
}

function createEffect(kind, payload) {
  return { kind, ...payload };
}

function enemyCenter(enemy) {
  return centerOf(enemy);
}

function directionVectorFromKey(direction) {
  switch (direction) {
    case "right": return { x: 1, y: 0 };
    case "right_down": return { x: 0.7071, y: 0.7071 };
    case "down": return { x: 0, y: 1 };
    case "left_down": return { x: -0.7071, y: 0.7071 };
    case "left": return { x: -1, y: 0 };
    case "left_up": return { x: -0.7071, y: -0.7071 };
    case "up": return { x: 0, y: -1 };
    case "right_up": return { x: 0.7071, y: -0.7071 };
    default: return { x: 1, y: 0 };
  }
}

function rotateDir(dir, degrees) {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: dir.x * cos - dir.y * sin,
    y: dir.x * sin + dir.y * cos
  };
}

function directionAngle(dir, fallback = { x: 1, y: 0 }) {
  const normalized = normalize(dir.x, dir.y, fallback);
  return Math.atan2(normalized.y, normalized.x);
}

function syncFacing(enemy, dir) {
  enemy.direction = toDirectionKey(dir.x, dir.y, enemy.direction || "down");
  enemy.facing = dir.x >= 0 ? 1 : -1;
}

function currentTargetPoint(game, enemy) {
  const playerCenter = getEnemyTargetCenter(game);
  return { x: playerCenter.x, y: playerCenter.y };
}

function windupFrameForAttack(enemy) {
  const runtime = enemy.attackRuntime;
  const attack = runtime.currentAttack;
  if (!attack || runtime.state !== "windup") return null;
  const sprite = enemy.sprite[getAttackSpriteKey(enemy)];
  if (!sprite) return null;
  const total = Math.max(0.001, runtime.windupDuration);
  const progress = clamp(1 - runtime.timer / total, 0, 0.9999);
  return getWindupFrameAtProgress(attack, progress, sprite.frames - 1);
}

function activeAttack(enemy) {
  return enemy.attackRuntime.currentAttack;
}

function getAttackSpriteKey(enemy) {
  const runtime = enemy.attackRuntime;
  const attack = runtime.currentAttack;
  if (runtime.roll.active) return enemy.sprite.roll ? "roll" : "move";
  if (runtime.swiftStep.active) return runtime.swiftStep.phase === "run" ? "crouchRun" : "crouchIdle";
  if (runtime.guard.active) return runtime.guard.phase === "start" ? "guardStart" : "guardHold";
  if (enemy.awakenBehavior && !runtime.awaken.finished) return enemy.awakenBehavior.sprite || "idle";
  const locomotionKey = enemy.isMoving
    ? (enemy.awarenessState === "alerted" && enemy.sprite.walk ? "walk" : "move")
    : "idle";
  if (!attack) return locomotionKey;
  if (runtime.state === "recover") return locomotionKey;
  if (attack.id === "ud_necromancer_basic_orb" || attack.id === "ud_wizard_basic_bolt") {
    if ((runtime.windupCycle ?? 0) % 2 === 0 && attack.alternateSprite) return attack.alternateSprite;
  }
  return attack.sprite || locomotionKey;
}

function attackFrameForState(enemy) {
  const runtime = enemy.attackRuntime;
  if (runtime.swiftStep.active) {
    const sprite = enemy.sprite[getAttackSpriteKey(enemy)];
    if (!sprite) return null;
    return Math.floor(enemy.animClock * (sprite.fps || 14)) % sprite.frames;
  }
  if (enemy.awakenBehavior && !runtime.awaken.finished) {
    const sprite = enemy.sprite[getAttackSpriteKey(enemy)];
    if (!sprite) return null;
    if (!runtime.awaken.active) return 0;
    const total = Math.max(0.001, runtime.awaken.duration || enemy.awakenBehavior.duration || 15 / 14);
    const progress = clamp(1 - runtime.awaken.timer / total, 0, 0.9999);
    return Math.min(sprite.frames - 1, Math.floor(progress * sprite.frames));
  }
  if (runtime.guard.active) {
    const sprite = enemy.sprite[getAttackSpriteKey(enemy)];
    if (!sprite) return null;
    if (runtime.guard.phase === "start") {
      const total = Math.max(0.001, runtime.guard.startDuration || 15 / 14);
      const progress = clamp((runtime.guard.startDuration - runtime.guard.timer) / total, 0, 0.9999);
      return Math.min(sprite.frames - 1, Math.floor(progress * sprite.frames));
    }
    return Math.floor(enemy.animClock * (sprite.fps || 14)) % sprite.frames;
  }
  const attack = runtime.currentAttack;
  if (!attack || runtime.state === "recover") return null;
  const sprite = enemy.sprite[getAttackSpriteKey(enemy)];
  if (!sprite) return null;
  const trigger = Math.min(sprite.frames - 1, getAttackTriggerFrame(attack));
  if (runtime.state === "windup") {
    const total = Math.max(0.001, runtime.windupDuration);
    const progress = clamp(1 - runtime.timer / total, 0, 0.9999);
    return getWindupFrameAtProgress(attack, progress, trigger);
  }
  if (runtime.state === "active") {
    if (attack.loopDuringActive) {
      return Math.floor(enemy.animClock * (sprite.fps || attack.animFps || 14)) % sprite.frames;
    }
    const total = Math.max(0.001, runtime.activeDuration);
    const progress = clamp(1 - runtime.timer / total, 0, 0.9999);
    const remainingFrames = Math.max(1, sprite.frames - trigger);
    return Math.min(sprite.frames - 1, trigger + Math.floor(progress * remainingFrames));
  }
  return null;
}

function beginAttack(game, enemy, attack) {
  const runtime = enemy.attackRuntime;
  runtime.state = "windup";
  runtime.currentAttack = attack;
  runtime.timer = attack.telegraph;
  runtime.windupDuration = attack.telegraph;
  runtime.activeDuration = getAttackActiveDuration(attack);
  runtime.recoverDuration = attack.recover ?? 0;
  runtime.windupCycle += 1;
  runtime.effectFired = false;
  runtime.lastFrame = -1;
  runtime.telegraphTarget = currentTargetPoint(game, enemy);
  const origin = enemyCenter(enemy);
  const lockedDir = normalize(
    runtime.telegraphTarget.x - origin.x,
    runtime.telegraphTarget.y - origin.y,
    { x: 1, y: 0 }
  );
  runtime.telegraphDirX = lockedDir.x;
  runtime.telegraphDirY = lockedDir.y;
  if (attack.kind === "running_shot") {
    const target = runtime.telegraphTarget || currentTargetPoint(game, enemy);
    const baseDir = normalize(target.x - origin.x, target.y - origin.y, { x: 1, y: 0 });
    const sign = Math.random() < 0.5 ? -1 : 1;
    const runDir = rotateDir(baseDir, (attack.runAngleDeg ?? 20) * sign);
    runtime.runningShot.moveDirX = runDir.x;
    runtime.runningShot.moveDirY = runDir.y;
    runtime.runningShot.shotDirX = baseDir.x;
    runtime.runningShot.shotDirY = baseDir.y;
    syncFacing(enemy, runDir);
  }
  if (attack.kind === "run_spread_shot") {
    const origin = enemyCenter(enemy);
    const target = runtime.telegraphTarget || currentTargetPoint(game, enemy);
    const baseDir = normalize(target.x - origin.x, target.y - origin.y, { x: 1, y: 0 });
    runtime.runningShot.moveDirX = baseDir.x;
    runtime.runningShot.moveDirY = baseDir.y;
    runtime.runningShot.shotDirX = baseDir.x;
    runtime.runningShot.shotDirY = baseDir.y;
    runtime.runningShot.speedMult = attack.runSpeedMult ?? 1.5;
    syncFacing(enemy, baseDir);
  }
  runtime.comboShotsRemaining = attack.comboShots ?? attack.sameStripComboHits ?? 0;
  runtime.nextAttackAt = Math.max(runtime.nextAttackAt || 0, game.time + ENEMY_ATTACK_LOCKOUT_SECONDS);
}

function finishAttack(game, enemy) {
  const runtime = enemy.attackRuntime;
  const attack = runtime.currentAttack;
  if (attack) {
    runtime.cooldowns[attack.id] = attack.cooldown ?? 1;
  }
  noteEnemyAttackFinished(game, enemy);
  runtime.state = "recover";
  runtime.timer = runtime.recoverDuration;
  runtime.effectFired = true;
}

function clearAttack(enemy) {
  const runtime = enemy.attackRuntime;
  runtime.state = "idle";
  runtime.currentAttack = null;
  runtime.timer = 0;
  runtime.windupDuration = 0;
  runtime.activeDuration = 0;
  runtime.recoverDuration = 0;
  runtime.effectFired = false;
  runtime.lastFrame = -1;
  runtime.telegraphTarget = null;
  runtime.telegraphDirX = 0;
  runtime.telegraphDirY = 0;
  runtime.runningShot.moveDirX = 0;
  runtime.runningShot.moveDirY = 0;
  runtime.runningShot.shotDirX = 0;
  runtime.runningShot.shotDirY = 0;
  runtime.runningShot.speedMult = 1;
}

function consumePendingHitInterrupt(enemy) {
  if (!enemy.hitInterruptPending) return;
  enemy.hitInterruptPending = false;
  const runtime = enemy.attackRuntime;
  const tier = enemy.enemyTier || "minion";
  const pauseDuration = enemy.hitInterruptPauseDuration || 0;
  const staggerDuration = enemy.hitInterruptStaggerDuration || 0;
  enemy.hitInterruptPauseDuration = 0;
  enemy.hitInterruptStaggerDuration = 0;

  if (!runtime.currentAttack) return;
  if (runtime.state === "active") return;

  if (runtime.state === "windup") {
    if (tier === "minion") {
      clearAttack(enemy);
      return;
    }
    if (tier === "elite") {
      runtime.timer += pauseDuration * 0.75;
      runtime.windupDuration += pauseDuration * 0.75;
    }
    return;
  }

  if (runtime.state === "recover" && tier === "minion") {
    runtime.timer = Math.min(runtime.timer, Math.max(staggerDuration, 0.06));
  }
}

function maybeStartSwiftStep(enemy, dirToPlayer) {
  const runtime = enemy.attackRuntime;
  const step = enemy.swiftStep;
  if (!step || runtime.swiftStep.triggered || runtime.swiftStep.active) return false;
  if (!(enemy.hp > 0) || !(enemy.maxHp > 0)) return false;
  if (enemy.hp / enemy.maxHp > (step.threshold ?? 0.5)) return false;
  runtime.swiftStep.triggered = true;
  runtime.swiftStep.active = true;
  runtime.swiftStep.phase = "run";
  runtime.swiftStep.timer = step.runDuration ?? 2;
  runtime.swiftStep.runDuration = step.runDuration ?? 2;
  runtime.swiftStep.holdDuration = step.holdDuration ?? 1;
  runtime.swiftStep.dirX = -dirToPlayer.x;
  runtime.swiftStep.dirY = -dirToPlayer.y;
  clearAttack(enemy);
  runtime.roll.active = false;
  runtime.activeEffects = [];
  runtime.queuedAttackId = null;
  syncFacing(enemy, { x: runtime.swiftStep.dirX, y: runtime.swiftStep.dirY });
  return true;
}

function updateSwiftStep(game, enemy, dt) {
  const runtime = enemy.attackRuntime;
  const step = enemy.swiftStep;
  if (!runtime.swiftStep.active || !step) return false;
  if (runtime.swiftStep.phase === "run") {
    const dir = normalize(runtime.swiftStep.dirX, runtime.swiftStep.dirY, { x: 1, y: 0 });
    syncFacing(enemy, dir);
    tryMoveEnemy(enemy, game.world, dir.x * enemy.speed * (step.speedMult ?? 1.5) * dt, dir.y * enemy.speed * (step.speedMult ?? 1.5) * dt);
    enemy.isMoving = true;
    const total = Math.max(0.001, runtime.swiftStep.runDuration || 2);
    const elapsed = total - runtime.swiftStep.timer;
    const targetAlpha = step.targetAlpha ?? 0.5;
    const t = clamp((elapsed + dt) / total, 0, 1);
    enemy.renderAlpha = 1 + (targetAlpha - 1) * t;
    runtime.swiftStep.timer = Math.max(0, runtime.swiftStep.timer - dt);
    if (runtime.swiftStep.timer <= 0) {
      runtime.swiftStep.phase = "hold";
      runtime.swiftStep.timer = runtime.swiftStep.holdDuration;
      enemy.renderAlpha = targetAlpha;
    }
    return true;
  }
  enemy.isMoving = false;
  enemy.renderAlpha = step.targetAlpha ?? 0.5;
  runtime.swiftStep.timer = Math.max(0, runtime.swiftStep.timer - dt);
  if (runtime.swiftStep.timer <= 0) {
    runtime.swiftStep.active = false;
    runtime.swiftStep.phase = "none";
    enemy.renderAlpha = 1;
    runtime.queuedAttackId = step.followupAttackId || null;
  }
  return true;
}

function maybeStartGuard(enemy, dirToPlayer) {
  const runtime = enemy.attackRuntime;
  const stance = enemy.guardStance;
  if (!stance || runtime.guard.triggered || runtime.guard.active) return false;
  if (!(enemy.hp > 0) || !(enemy.maxHp > 0)) return false;
  if (enemy.hp / enemy.maxHp > (stance.threshold ?? 0.3)) return false;
  runtime.guard.triggered = true;
  runtime.guard.active = true;
  runtime.guard.phase = "start";
  runtime.guard.remaining = stance.duration ?? 4;
  runtime.guard.startDuration = Math.min(runtime.guard.remaining, stance.startDuration ?? (15 / 14));
  runtime.guard.timer = runtime.guard.startDuration;
  clearAttack(enemy);
  runtime.roll.active = false;
  runtime.activeEffects = [];
  const lockedDir = directionVectorFromKey(enemy.direction) || dirToPlayer;
  runtime.guard.dirX = lockedDir.x;
  runtime.guard.dirY = lockedDir.y;
  syncFacing(enemy, lockedDir);
  return true;
}

function updateGuard(enemy, dt) {
  const runtime = enemy.attackRuntime;
  const stance = enemy.guardStance;
  if (!runtime.guard.active) return false;
  enemy.isMoving = false;
  if ((stance?.healPerSecond ?? 0) > 0 && enemy.hp > 0) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * stance.healPerSecond * dt);
  }
  runtime.guard.remaining = Math.max(0, runtime.guard.remaining - dt);
  if (runtime.guard.phase === "start") {
    runtime.guard.timer = Math.max(0, runtime.guard.timer - dt);
    if (runtime.guard.timer <= 0) {
      runtime.guard.phase = "hold";
    }
  }
  if (runtime.guard.remaining <= 0) {
    runtime.guard.active = false;
    runtime.guard.phase = "none";
    runtime.guard.timer = 0;
  }
  return true;
}

function updateAwaken(enemy, awareness, dt) {
  const runtime = enemy.attackRuntime;
  const awaken = enemy.awakenBehavior;
  if (!awaken || runtime.awaken.finished) return false;
  enemy.isMoving = false;
  runtime.roll.active = false;
  if (!runtime.awaken.active) {
    if (awareness.state !== "detected") return true;
    runtime.awaken.active = true;
    runtime.awaken.duration = awaken.duration ?? 15 / 14;
    runtime.awaken.timer = runtime.awaken.duration;
    return true;
  }
  runtime.awaken.timer = Math.max(0, runtime.awaken.timer - dt);
  if (runtime.awaken.timer <= 0) {
    runtime.awaken.active = false;
    runtime.awaken.finished = true;
  }
  return true;
}

function spawnCircle(game, enemy, attack, x, y, radius, damageScale = attack.damageScale ?? 1, duration = 0.12, overrides = {}) {
  const groundImpactSprite = overrides.groundImpactSprite ?? attack.groundImpactSprite ?? null;
  game.spawnEnemyAreaHitbox?.({
    sourceId: enemy.id,
    x,
    y,
    radius,
    shape: "circle",
    damage: computeDamage(enemy, attack, damageScale),
    duration,
    slowMult: overrides.slowMult ?? attack.slowMult ?? 1,
    slowDuration: overrides.slowDuration ?? attack.slowDuration ?? 0,
    stunDuration: overrides.stunDuration ?? attack.stunDuration ?? 0,
    poisonDps: overrides.poisonDps ?? attack.poisonDps ?? 0,
    poisonDuration: overrides.poisonDuration ?? attack.poisonDuration ?? 0,
    tint: overrides.tint ?? (attack.kind === "fire_cleanse" ? "#fb923c" : "#ef4444"),
    visualDuration: overrides.visualDuration ?? attack.groundImpactDuration ?? (groundImpactSprite ? 0.32 : duration),
    groundImpactSprite,
    groundImpactFrames: overrides.groundImpactFrames ?? attack.groundImpactFrames ?? 6,
    groundImpactScale: overrides.groundImpactScale ?? attack.groundImpactScale ?? 1,
    groundImpactYOffset: overrides.groundImpactYOffset ?? attack.groundImpactYOffset ?? 0,
    groundImpactAnchorX: overrides.groundImpactAnchorX ?? (enemy.x + enemy.w * 0.5),
    groundImpactAnchorY: overrides.groundImpactAnchorY ?? (enemy.y + enemy.h)
  });
}

function spawnCone(game, enemy, attack, origin, dir, range = attack.range, arc = attack.arc, damageScale = attack.damageScale ?? 1, duration = 0.1, overrides = {}) {
  game.spawnEnemyAreaHitbox?.({
    sourceId: enemy.id,
    x: origin.x,
    y: origin.y,
    dirX: dir.x,
    dirY: dir.y,
    range,
    arcDeg: arc,
    shape: "cone",
    damage: computeDamage(enemy, attack, damageScale),
    duration,
    knockback: overrides.knockback ?? attack.knockback ?? 0,
    slowMult: overrides.slowMult ?? attack.slowMult ?? 1,
    slowDuration: overrides.slowDuration ?? attack.slowDuration ?? 0,
    stunDuration: overrides.stunDuration ?? attack.stunDuration ?? 0,
    poisonDps: overrides.poisonDps ?? attack.poisonDps ?? 0,
    poisonDuration: overrides.poisonDuration ?? attack.poisonDuration ?? 0,
    tint: attack.kind === "fire_thrower" ? "#fb923c" : "#ef4444"
  });
}

function spawnProjectile(game, enemy, attack, dir, overrides = {}) {
  game.spawnEnemyProjectile?.(enemy, {
    dirX: dir.x,
    dirY: dir.y,
    speed: overrides.speed ?? attack.speedValue ?? 280,
    radius: overrides.radius ?? attack.projectileRadius ?? Math.max(8, (attack.projectileSize ?? 12) * 0.5),
    size: overrides.size ?? attack.projectileDrawSize ?? attack.projectileSize ?? 12,
    damage: overrides.damage ?? computeDamage(enemy, attack, overrides.damageScale ?? attack.damageScale ?? 1),
    color: overrides.color ?? attack.projectileColor ?? "#f59e0b",
    spriteAsset: overrides.spriteAsset ?? attack.projectileSprite ?? null,
    spriteFrames: overrides.spriteFrames ?? attack.projectileSpriteFrames ?? null,
    spriteFrameWidth: overrides.spriteFrameWidth ?? attack.projectileSpriteFrameWidth ?? null,
    spriteFrameHeight: overrides.spriteFrameHeight ?? attack.projectileSpriteFrameHeight ?? null,
    spriteFps: overrides.spriteFps ?? attack.projectileSpriteFps ?? null,
    spriteLoopStart: overrides.spriteLoopStart ?? attack.projectileSpriteLoopStart ?? null,
    spriteLoopEnd: overrides.spriteLoopEnd ?? attack.projectileSpriteLoopEnd ?? null,
    spriteCropWidth: overrides.spriteCropWidth ?? attack.projectileSpriteCropWidth ?? null,
    spriteCropHeight: overrides.spriteCropHeight ?? attack.projectileSpriteCropHeight ?? null,
    maxRange: overrides.maxRange ?? 520,
    lifetime: overrides.lifetime ?? attack.projectileLifetime ?? null,
    trailInterval: overrides.trailInterval ?? null,
    trailChild: overrides.trailChild ?? null,
    sourceAttackId: attack.id,
    knockback: overrides.knockback ?? attack.knockback ?? 0,
    slowMult: overrides.slowMult ?? attack.slowMult ?? 1,
    slowDuration: overrides.slowDuration ?? attack.slowDuration ?? 0,
    stunDuration: overrides.stunDuration ?? attack.stunDuration ?? 0,
    poisonDps: overrides.poisonDps ?? attack.poisonDps ?? 0,
    poisonDuration: overrides.poisonDuration ?? attack.poisonDuration ?? 0,
    gravityX: overrides.gravityX ?? attack.projectileGravityX ?? 0,
    gravityY: overrides.gravityY ?? attack.projectileGravityY ?? 0,
    boomerang: overrides.boomerang ?? attack.boomerang ?? false,
    returnAfter: overrides.returnAfter ?? attack.returnAfter ?? null,
    returnSpeedMult: overrides.returnSpeedMult ?? attack.returnSpeedMult ?? 1.1
  });
}

function emitAttack(game, enemy, attack, dir) {
  const runtime = enemy.attackRuntime;
  const origin = enemyCenter(enemy);
  const target = runtime.telegraphTarget || currentTargetPoint(game, enemy);
  const lockedDir = normalize(runtime.telegraphDirX, runtime.telegraphDirY, dir);

  if (attack.kind === "cone") {
    spawnCone(game, enemy, attack, origin, lockedDir);
    return;
  }

  if (attack.kind === "circle") {
    const atTarget = attack.minRange > 40 && attack.maxRange > 300 && enemy.role === "ranged";
    const impact = atTarget ? target : origin;
    spawnCircle(game, enemy, attack, impact.x, impact.y, attack.radius);
    return;
  }

  if (attack.kind === "frame_synced_circle") {
    runtime.activeEffects.push(createEffect("frame_synced_circle", {
      attack,
      firedFrames: new Set()
    }));
    return;
  }

  if (attack.kind === "frame_synced_cone") {
    runtime.activeEffects.push(createEffect("frame_synced_cone", {
      attack,
      dirX: lockedDir.x,
      dirY: lockedDir.y,
      firedFrames: new Set()
    }));
    return;
  }

  if (attack.kind === "frame_synced_projectile") {
    runtime.activeEffects.push(createEffect("frame_synced_projectile", {
      attack,
      dirX: dir.x,
      dirY: dir.y,
      firedFrames: new Set()
    }));
    return;
  }

  if (attack.kind === "frame_synced_random_projectile_burst") {
    runtime.activeEffects.push(createEffect("frame_synced_random_projectile_burst", {
      attack,
      dirX: dir.x,
      dirY: dir.y,
      firedFrames: new Set()
    }));
    return;
  }

  if (attack.kind === "fire_circle_expand") {
    runtime.activeEffects.push(createEffect("fire_circle_expand", {
      attack,
      startedAt: game.time,
      endAt: game.time + (attack.expandDurationSec ?? 1),
      nextAt: game.time
    }));
    return;
  }

  if (attack.kind === "whirlwind") {
    spawnCircle(game, enemy, attack, origin.x, origin.y, attack.radius, attack.damageScale, Math.max(0.08, (attack.circleDurationMs || 100) / 1000));
    if (!attack.omitBlade) {
      runtime.activeEffects.push(createEffect("whirlwind_bursts", {
        attack,
        burstsRemaining: attack.burstCount ?? 1,
        nextAt: game.time + (attack.burstGap ?? 0.2),
        dirAngle: Math.atan2(dir.y, dir.x)
      }));
    }
    return;
  }

  if (attack.kind === "rolling_attack") {
    runtime.activeEffects.push(createEffect("rolling_attack", {
      attack,
      startedAt: game.time,
      until: game.time + runtime.activeDuration,
      dirX: dir.x,
      dirY: dir.y,
      nextHitAt: game.time
    }));
    return;
  }

  if (attack.kind === "projectile") {
    spawnProjectile(game, enemy, attack, dir);
    return;
  }

  if (attack.kind === "cone_followup_blast") {
    spawnCone(game, enemy, attack, origin, lockedDir, attack.range, attack.arc, attack.damageScale, attack.hitDuration ?? 0.1);
    const animFps = Math.max(1, Number(attack.animFps) || 14);
    const triggerFrame = getAttackTriggerFrame(attack);
    const followupFrame = Math.max(triggerFrame, Math.floor(attack.followupFrame ?? triggerFrame));
    runtime.activeEffects.push(createEffect("scheduled_circle", {
      attack,
      triggerAt: game.time + Math.max(0, (followupFrame - triggerFrame) / animFps),
      x: origin.x + lockedDir.x * (attack.followupOffset ?? (attack.range ?? 120) * 0.5),
      y: origin.y + lockedDir.y * (attack.followupOffset ?? (attack.range ?? 120) * 0.5),
      radius: attack.followupRadius ?? attack.radius ?? 40,
      damageScale: attack.followupDamageScale ?? attack.damageScale ?? 1,
      duration: attack.followupHitDuration ?? 0.12,
      poisonDps: attack.followupPoisonDps ?? 0,
      poisonDuration: attack.followupPoisonDuration ?? 0,
      tint: attack.followupTint ?? "#84cc16"
    }));
    return;
  }

  if (attack.kind === "projectile_burst") {
    if (Number.isFinite(attack.radius) && attack.radius > 0) {
      spawnCircle(game, enemy, attack, origin.x, origin.y, attack.radius, attack.damageScale, attack.hitDuration ?? 0.12);
    }
    const count = attack.projectileCount ?? 8;
    for (let index = 0; index < count; index += 1) {
      const angle = attack.random360
        ? (Math.PI * 2 * index) / count
        : Math.atan2(dir.y, dir.x);
      spawnProjectile(game, enemy, attack, { x: Math.cos(angle), y: Math.sin(angle) });
    }
    return;
  }

  if (attack.kind === "sacrifice_burst") {
    const sacrificeAmount = Math.max(0, enemy.maxHp * (attack.hpSacrificePct ?? 0.3));
    enemy.hp = Math.max(1, enemy.hp - sacrificeAmount);
    const healRadius = attack.healRadius ?? 180;
    for (const other of game.enemies || []) {
      if (other.dead || other === enemy) continue;
      const otherCenter = centerOf(other);
      if (distance(origin.x, origin.y, otherCenter.x, otherCenter.y) > healRadius) continue;
      other.hp = Math.min(other.maxHp, other.hp + sacrificeAmount);
    }
    const count = Math.max(1, Math.floor(attack.projectileCount ?? 10));
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count;
      spawnProjectile(game, enemy, attack, { x: Math.cos(angle), y: Math.sin(angle) }, {
        speed: attack.projectileSpeed ?? attack.speedValue ?? 180,
        size: attack.projectileSize ?? 10,
        radius: attack.projectileRadius ?? Math.max(5, (attack.projectileSize ?? 10) * 0.5),
        damageScale: attack.projectileDamageScale ?? attack.damageScale ?? 0.5,
        lifetime: attack.projectileLifetime ?? 1,
        gravityX: attack.projectileGravityX ?? 0,
        gravityY: attack.projectileGravityY ?? 560
      });
    }
    return;
  }

  if (attack.kind === "projectile_spin") {
    const count = attack.spinCount ?? 8;
    const startDeg = attack.spinStartDeg ?? 0;
    const stepDeg = attack.spinStepDeg ?? 45;
    const baseAngle = directionAngle(dir);
    for (let index = 0; index < count; index += 1) {
      const degrees = startDeg + stepDeg * index;
      const angle = baseAngle + (degrees * Math.PI) / 180;
      spawnProjectile(game, enemy, attack, { x: Math.cos(angle), y: Math.sin(angle) });
    }
    return;
  }

  if (attack.kind === "projectile_trail") {
    spawnProjectile(game, enemy, attack, dir, {
      radius: attack.projectileRadius ?? Math.max(20, (attack.projectileSize ?? 32) * 0.5),
      size: attack.projectileSize ?? 32,
      lifetime: attack.projectileLifetime ?? 3,
      trailInterval: attack.trailInterval ?? 0.4,
      trailChild: attack.trailChild
    });
    return;
  }

  if (attack.kind === "projectile_backstep") {
    spawnProjectile(game, enemy, attack, dir);
    runtime.activeEffects.push(createEffect("backstep", {
      until: game.time + (attack.backstepDuration ?? 0.5),
      speed: attack.backstepSpeed ?? 320,
      dirX: -dir.x,
      dirY: -dir.y
    }));
    return;
  }

  if (attack.kind === "cone_projectile") {
    spawnCone(game, enemy, attack, origin, lockedDir, attack.range, attack.arc, attack.damageScale, attack.hitDuration ?? 0.1);
    spawnProjectile(game, enemy, attack, lockedDir, {
      speed: attack.projectileSpeed ?? attack.speedValue ?? 280,
      size: attack.projectileDrawSize ?? attack.projectileSize ?? 16,
      radius: attack.projectileRadius ?? Math.max(8, (attack.projectileSize ?? 16) * 0.5),
      damageScale: attack.projectileDamageScale ?? attack.damageScale ?? 1,
      boomerang: !!attack.boomerang,
      returnAfter: attack.returnAfter ?? null,
      returnSpeedMult: attack.returnSpeedMult ?? 1.1
    });
    return;
  }

  if (attack.kind === "cone_arc_projectiles") {
    spawnCone(game, enemy, attack, origin, lockedDir, attack.range, attack.arc, attack.damageScale, attack.hitDuration ?? 0.1);
    const projectileCount = Math.max(1, Math.floor(attack.projectileCount ?? 8));
    const spread = attack.projectileSpreadDeg ?? 90;
    const offsets = projectileCount === 1
      ? [0]
      : Array.from({ length: projectileCount }, (_, index) => {
          const t = projectileCount === 1 ? 0.5 : index / (projectileCount - 1);
          return -spread * 0.5 + spread * t;
        });
    for (const offset of offsets) {
      spawnProjectile(game, enemy, attack, rotateDir(lockedDir, offset), {
        speed: attack.projectileSpeed ?? attack.speedValue ?? 180,
        size: attack.projectileSize ?? 10,
        radius: attack.projectileRadius ?? Math.max(4, (attack.projectileSize ?? 10) * 0.5),
        damageScale: attack.projectileDamageScale ?? attack.damageScale ?? 1,
        lifetime: attack.projectileLifetime ?? 1,
        gravityX: attack.projectileGravityX ?? 0,
        gravityY: attack.projectileGravityY ?? 520
      });
    }
    return;
  }

  if (attack.kind === "running_shot") {
    const shotDir = normalize(runtime.runningShot.shotDirX, runtime.runningShot.shotDirY, dir);
    const spread = attack.spreadDeg ?? 30;
    const projectileCount = Math.max(1, Math.floor(attack.projectileCount ?? 3));
    const offsets = projectileCount === 1
      ? [0]
      : Array.from({ length: projectileCount }, (_, index) => {
          const t = projectileCount === 1 ? 0.5 : index / (projectileCount - 1);
          return -spread * 0.5 + spread * t;
        });
    for (const offset of offsets) {
      const arrowDir = rotateDir(shotDir, offset);
      spawnProjectile(game, enemy, attack, arrowDir, {
        speed: attack.speedValue ?? 520,
        size: attack.projectileSize ?? 12,
        radius: attack.projectileRadius ?? Math.max(8, (attack.projectileSize ?? 12) * 0.5)
      });
    }
    return;
  }

  if (attack.kind === "run_spread_shot") {
    const shotDir = normalize(runtime.runningShot.shotDirX, runtime.runningShot.shotDirY, dir);
    const spread = attack.spreadDeg ?? 20;
    const projectileCount = Math.max(1, Math.floor(attack.projectileCount ?? 6));
    const offsets = projectileCount === 1
      ? [0]
      : Array.from({ length: projectileCount }, (_, index) => {
          const t = projectileCount === 1 ? 0.5 : index / (projectileCount - 1);
          return -spread * 0.5 + spread * t;
        });
    for (const offset of offsets) {
      const projectileDir = rotateDir(shotDir, offset);
      spawnProjectile(game, enemy, attack, projectileDir, {
        speed: attack.speedValue ?? 210,
        size: attack.projectileSize ?? 10,
        radius: attack.projectileRadius ?? Math.max(5, (attack.projectileSize ?? 10) * 0.5),
        poisonDps: attack.poisonDps ?? 3,
        poisonDuration: attack.poisonDuration ?? 4
      });
    }
    return;
  }

  if (attack.kind === "summon") {
    let spawnX;
    let spawnY;
    if (attack.summonAroundSelf) {
      const angle = Math.random() * Math.PI * 2;
      const distanceFromSelf = attack.summonRadius ?? attack.spawnForward ?? 120;
      spawnX = origin.x + Math.cos(angle) * distanceFromSelf - 0.5 * 68;
      spawnY = origin.y + Math.sin(angle) * distanceFromSelf - 0.5 * 68;
    } else {
      spawnX = origin.x + dir.x * (attack.spawnForward ?? 180) - 0.5 * 68;
      spawnY = origin.y + dir.y * (attack.spawnForward ?? 180) - 0.5 * 68;
    }
    game.spawnEnemyByType?.(attack.spawnType, spawnX, spawnY, { summonedBy: enemy.id });
    return;
  }

  if (attack.kind === "engage") {
    const until = game.time + (attack.buffDuration ?? 5);
    const hpLoss = Math.max(0, enemy.hp * (attack.hpSacrificePct ?? 0.2));
    enemy.hp = Math.max(1, enemy.hp - hpLoss);
    enemy.attackRuntime.buffs.speedUntil = until;
    enemy.attackRuntime.buffs.speedMult = Math.max(enemy.attackRuntime.buffs.speedMult || 1, attack.speedMult ?? 1.5);
    enemy.damageBuffUntil = Math.max(enemy.damageBuffUntil || 0, until);
    enemy.damageBuffMult = Math.max(enemy.damageBuffMult || 1, 1);
    return;
  }

  if (attack.kind === "warcry") {
    const radius = attack.radius ?? 260;
    const until = game.time + (attack.buffDuration ?? 3);
    if (attack.buffMode === "ally_damage") {
      for (const other of game.enemies || []) {
        if (other.dead || other === enemy) continue;
        const otherCenter = centerOf(other);
        if (distance(origin.x, origin.y, otherCenter.x, otherCenter.y) > radius) continue;
        other.damageBuffUntil = Math.max(other.damageBuffUntil || 0, until);
        other.damageBuffMult = Math.max(other.damageBuffMult || 1, attack.damageMult ?? 1.2);
      }
      return;
    }
    enemy.attackRuntime.buffs.speedUntil = until;
    enemy.attackRuntime.buffs.speedMult = attack.speedMult ?? 1.2;
    return;
  }

  if (attack.kind === "arrow_rain") {
    runtime.activeEffects.push(createEffect("arrow_rain", {
      attack,
      endAt: game.time + (attack.rainDurationSec ?? 2),
      nextAt: game.time,
      centerX: target.x,
      centerY: target.y
    }));
    return;
  }

  if (attack.kind === "targeted_rain_zone") {
    runtime.activeEffects.push(createEffect("targeted_rain_zone", {
      attack,
      endAt: game.time + (attack.zoneDurationSec ?? 3),
      nextAt: game.time,
      centerX: target.x,
      centerY: target.y
    }));
    return;
  }

  if (attack.kind === "poisonous_blessing") {
    const radius = attack.radius ?? 180;
    const until = game.time + (attack.blessingDuration ?? 5);
    for (const other of game.enemies || []) {
      if (other.dead || other === enemy) continue;
      const otherCenter = centerOf(other);
      if (distance(origin.x, origin.y, otherCenter.x, otherCenter.y) > radius) continue;
      other.state ||= {};
      other.state.poisonBlessingUntil = Math.max(other.state.poisonBlessingUntil || 0, until);
      other.state.poisonBlessingSpeedMult = Math.max(other.state.poisonBlessingSpeedMult || 1, attack.allySpeedMult ?? 1.3);
      other.state.poisonBlessingSourceId = enemy.id;
      other.state.poisonBlessingProjectile = {
        speed: attack.deathProjectileSpeed ?? 240,
        size: attack.deathProjectileSize ?? 10,
        radius: attack.deathProjectileRadius ?? 6,
        damageScale: attack.deathProjectileDamageScale ?? 0.5,
        poisonDps: attack.deathProjectilePoisonDps ?? 3,
        poisonDuration: attack.deathProjectilePoisonDuration ?? 4
      };
      other.state.poisonBlessingDeathBurstDone = false;
    }
    return;
  }

  if (attack.kind === "poison_pool") {
    runtime.activeEffects.push(createEffect("poison_pool", {
      attack,
      endAt: game.time + (attack.zoneDurationSec ?? 4),
      nextVisualAt: game.time,
      nextPoisonAt: game.time,
      nextBuffAt: game.time
    }));
    return;
  }

  if (attack.kind === "darkfire_pillar") {
    for (let index = 0; index < (attack.pillarCount ?? 5); index += 1) {
      const angle = (Math.PI * 2 * index) / Math.max(1, attack.pillarCount ?? 5);
      const x = target.x + Math.cos(angle) * (attack.pillarRingOffset ?? 72);
      const y = target.y + Math.sin(angle) * (attack.pillarRingOffset ?? 72);
      spawnCircle(game, enemy, attack, x, y, attack.pillarHitRadius ?? 28, attack.pillarDamageScale ?? 0.35, Math.max(0.08, (attack.pillarDurationMs ?? 140) / 1000));
    }
    return;
  }

  if (attack.kind === "necro_explosion") {
    spawnCircle(game, enemy, attack, origin.x, origin.y, attack.radius);
    const burstCount = attack.burstProjectileCount ?? 8;
    for (let index = 0; index < burstCount; index += 1) {
      const angle = (Math.PI * 2 * index) / burstCount;
      spawnProjectile(game, enemy, attack, { x: Math.cos(angle), y: Math.sin(angle) }, {
        speed: attack.burstProjectileSpeed ?? 280,
        size: attack.burstProjectileSize ?? 12,
        damageScale: attack.burstProjectileDamageScale ?? 0.45,
        color: "#7c3aed"
      });
    }
    return;
  }

  if (attack.kind === "volcano") {
    runtime.activeEffects.push(createEffect("volcano", {
      attack,
      centerX: target.x,
      centerY: target.y,
      remaining: attack.eruptionHits ?? 8,
      nextAt: game.time
    }));
    return;
  }

  if (attack.kind === "earthquake") {
    runtime.activeEffects.push(createEffect("earthquake", {
      attack,
      centerX: origin.x,
      centerY: origin.y,
      index: 0,
      nextAt: game.time
    }));
    return;
  }

  if (attack.kind === "fire_thrower") {
    const vfxFps = attack.fireVfxFps ?? 15;
    const endFrames = Math.max(0, attack.fireVfxEndFrames ?? 0);
    runtime.activeEffects.push(createEffect("fire_thrower", {
      attack,
      startedAt: game.time,
      damageUntil: game.time + (attack.fireThrowerDurationSec ?? 2),
      visualEndAt: game.time + (attack.fireThrowerDurationSec ?? 2) + (endFrames / Math.max(1, vfxFps)),
      nextAt: game.time,
      dirX: dir.x,
      dirY: dir.y
    }));
    spawnCone(game, enemy, attack, origin, dir, attack.range, attack.arc, attack.damageScale, 0.18);
    return;
  }

  if (attack.kind === "fire_cleanse") {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + (attack.healFlat ?? 12));
    spawnCircle(game, enemy, attack, origin.x, origin.y, attack.radius, attack.damageScale, 0.14);
    return;
  }

  if (attack.kind === "fire_leap") {
    runtime.activeEffects.push(createEffect("fire_leap_land", {
      attack,
      landAt: game.time,
      x: origin.x,
      y: origin.y
    }));
    return;
  }

  if (attack.kind === "circle_combo") {
    spawnCircle(game, enemy, attack, origin.x, origin.y, attack.radius);
    runtime.activeEffects.push(createEffect("circle_combo", {
      attack,
      remaining: Math.max(0, (attack.comboShots ?? 1) - 1),
      nextAt: game.time + (attack.comboGap ?? 0.05)
    }));
    return;
  }

  if (attack.kind === "cone_combo") {
    spawnCone(game, enemy, attack, origin, dir);
    runtime.activeEffects.push(createEffect("cone_combo", {
      attack,
      remaining: Math.max(0, (attack.sameStripComboHits ?? 1) - 1),
      nextAt: game.time + (attack.sameStripComboGap ?? 0.05),
      dirX: dir.x,
      dirY: dir.y
    }));
  }
}

function updateActiveEffects(game, enemy, dt) {
  const runtime = enemy.attackRuntime;
  if (!runtime.activeEffects.length) return;
  const origin = enemyCenter(enemy);
  const remaining = [];

  for (const effect of runtime.activeEffects) {
    if (effect.kind === "backstep") {
      if (game.time < effect.until) {
        tryMoveEnemy(enemy, game.world, effect.dirX * effect.speed * dt, effect.dirY * effect.speed * dt);
        remaining.push(effect);
      }
      continue;
    }

    if (effect.kind === "scheduled_circle") {
      if (game.time >= effect.triggerAt) {
        spawnCircle(
          game,
          enemy,
          effect.attack,
          effect.x,
          effect.y,
          effect.radius,
          effect.damageScale,
          effect.duration,
          {
            poisonDps: effect.poisonDps,
            poisonDuration: effect.poisonDuration,
            tint: effect.tint
          }
        );
      } else {
        remaining.push(effect);
      }
      continue;
    }

    if (effect.kind === "frame_synced_circle") {
      const attack = activeAttack(enemy);
      if (!attack) continue;
      if (runtime.state === "active" && Number.isFinite(attack.moveSpeedMultDuringActive) && attack.moveSpeedMultDuringActive > 0) {
        const target = currentTargetPoint(game, enemy);
        const currentCenter = enemyCenter(enemy);
        const moveDir = normalize(target.x - currentCenter.x, target.y - currentCenter.y, { x: effect.dirX ?? 1, y: effect.dirY ?? 0 });
        effect.dirX = moveDir.x;
        effect.dirY = moveDir.y;
        syncFacing(enemy, moveDir);
        tryMoveEnemy(
          enemy,
          game.world,
          moveDir.x * enemy.speed * attack.moveSpeedMultDuringActive * dt,
          moveDir.y * enemy.speed * attack.moveSpeedMultDuringActive * dt
        );
        enemy.isMoving = true;
      }
      const frame = attackFrameForState(enemy);
      for (const hitFrame of attack.hitFrames || []) {
        if (frame >= hitFrame && !effect.firedFrames.has(hitFrame)) {
          effect.firedFrames.add(hitFrame);
          spawnCircle(game, enemy, attack, origin.x, origin.y, attack.radius);
        }
      }
      if (runtime.state === "active") remaining.push(effect);
      continue;
    }

    if (effect.kind === "frame_synced_cone") {
      const attack = activeAttack(enemy);
      if (!attack) continue;
      const frame = attackFrameForState(enemy);
      for (const hitFrame of attack.hitFrames || []) {
        if (frame >= hitFrame && !effect.firedFrames.has(hitFrame)) {
          effect.firedFrames.add(hitFrame);
          const hitIndex = (attack.hitFrames || []).indexOf(hitFrame);
          const hitConfig = attack.hitConfigs?.[hitIndex] || null;
          spawnCone(
            game,
            enemy,
            attack,
            origin,
            { x: effect.dirX, y: effect.dirY },
            hitConfig?.range ?? attack.range,
            hitConfig?.arc ?? attack.arc,
            hitConfig?.damageScale ?? attack.damageScale,
            hitConfig?.hitDuration ?? attack.hitDuration ?? 0.1,
            hitConfig || {}
          );
        }
      }
      if (runtime.state === "active") remaining.push(effect);
      continue;
    }

    if (effect.kind === "frame_synced_projectile") {
      const attack = activeAttack(enemy);
      if (!attack) continue;
      const frame = attackFrameForState(enemy);
      const baseDir = normalize(effect.dirX, effect.dirY, { x: 1, y: 0 });
      for (const hitFrame of attack.hitFrames || []) {
        if (frame >= hitFrame && !effect.firedFrames.has(hitFrame)) {
          effect.firedFrames.add(hitFrame);
          const hitIndex = (attack.hitFrames || []).indexOf(hitFrame);
          const shotAngle = attack.shotAnglesDeg?.[hitIndex];
          const dir = Number.isFinite(shotAngle)
            ? rotateDir(baseDir, shotAngle)
            : baseDir;
          spawnProjectile(game, enemy, attack, dir, {
            speed: attack.speedValue ?? 280,
            size: attack.projectileSize ?? 14,
            radius: attack.projectileRadius ?? Math.max(8, (attack.projectileSize ?? 14) * 0.5)
          });
        }
      }
      if (runtime.state === "active") remaining.push(effect);
      continue;
    }

    if (effect.kind === "frame_synced_random_projectile_burst") {
      const attack = activeAttack(enemy);
      if (!attack) continue;
      const frame = attackFrameForState(enemy);
      for (const hitFrame of attack.hitFrames || []) {
        if (frame >= hitFrame && !effect.firedFrames.has(hitFrame)) {
          effect.firedFrames.add(hitFrame);
          const burstCount = Math.max(1, Math.floor(attack.projectilesPerFrame ?? 4));
          for (let index = 0; index < burstCount; index += 1) {
            const angle = Math.random() * Math.PI * 2;
            spawnProjectile(game, enemy, attack, { x: Math.cos(angle), y: Math.sin(angle) }, {
              speed: attack.speedValue ?? 220,
              size: attack.projectileSize ?? 10,
              radius: attack.projectileRadius ?? Math.max(5, (attack.projectileSize ?? 10) * 0.5),
              lifetime: attack.projectileLifetime ?? null,
              gravityX: attack.projectileGravityX ?? 0,
              gravityY: attack.projectileGravityY ?? 0
            });
          }
        }
      }
      if (runtime.state === "active") remaining.push(effect);
      continue;
    }

    if (effect.kind === "fire_circle_expand") {
      if (game.time < effect.endAt) {
        if (game.time >= effect.nextAt) {
          effect.nextAt += effect.attack.expandTickSec ?? 0.1;
          const total = Math.max(0.001, (effect.attack.expandDurationSec ?? 1));
          const elapsed = clamp(game.time - effect.startedAt, 0, total);
          const t = elapsed / total;
          const radius = (effect.attack.startRadius ?? 50) + ((effect.attack.endRadius ?? 150) - (effect.attack.startRadius ?? 50)) * t;
          spawnCircle(
            game,
            enemy,
            effect.attack,
            origin.x,
            origin.y,
            radius,
            effect.attack.damageScale,
            effect.attack.hitDuration ?? 0.12,
            {
              knockback: effect.attack.knockback ?? 90,
              tint: "#fb923c"
            }
          );
        }
        remaining.push(effect);
      }
      continue;
    }

    if (effect.kind === "whirlwind_bursts") {
      if (effect.burstsRemaining > 0 && game.time >= effect.nextAt) {
        effect.burstsRemaining -= 1;
        effect.nextAt += effect.attack.burstGap ?? 0.2;
        const angle = effect.dirAngle + effect.burstsRemaining * 0.8;
        spawnProjectile(game, enemy, effect.attack, { x: Math.cos(angle), y: Math.sin(angle) }, {
          speed: effect.attack.bladeSpeed ?? 400,
          size: effect.attack.bladeSize ?? 14,
          damageScale: effect.attack.bladeDamageScale ?? 0.9,
          color: "#93c5fd"
        });
      }
      if (effect.burstsRemaining > 0) remaining.push(effect);
      continue;
    }

    if (effect.kind === "rolling_attack") {
      if (game.time < effect.until) {
        const target = currentTargetPoint(game, enemy);
        const currentCenter = enemyCenter(enemy);
        const desired = normalize(target.x - currentCenter.x, target.y - currentCenter.y, { x: effect.dirX, y: effect.dirY });
        const turn = Math.min(1, (effect.attack.turnResponse ?? 2) * dt);
        const nextDir = normalize(
          effect.dirX + (desired.x - effect.dirX) * turn,
          effect.dirY + (desired.y - effect.dirY) * turn,
          desired
        );
        effect.dirX = nextDir.x;
        effect.dirY = nextDir.y;
        const elapsed = Math.max(0, game.time - effect.startedAt);
        const accelDuration = Math.max(0.001, effect.attack.accelDurationSec ?? 3);
        const accelT = clamp(elapsed / accelDuration, 0, 1);
        const speedMult = accelT < 1
          ? (effect.attack.startSpeedMult ?? 1) + ((effect.attack.endSpeedMult ?? 1.5) - (effect.attack.startSpeedMult ?? 1)) * accelT
          : (effect.attack.endSpeedMult ?? 1.5);
        syncFacing(enemy, nextDir);
        tryMoveEnemy(enemy, game.world, nextDir.x * enemy.speed * speedMult * dt, nextDir.y * enemy.speed * speedMult * dt);
        enemy.isMoving = true;
        if (game.time >= effect.nextHitAt) {
          effect.nextHitAt += effect.attack.hitIntervalSec ?? 0.12;
          spawnCircle(game, enemy, effect.attack, enemyCenter(enemy).x, enemyCenter(enemy).y, effect.attack.radius, effect.attack.damageScale, 0.14);
        }
        remaining.push(effect);
      }
      continue;
    }

    if (effect.kind === "arrow_rain") {
      if (game.time < effect.endAt) {
        if (game.time >= effect.nextAt) {
          effect.nextAt += effect.attack.rainIntervalSec ?? 0.2;
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * effect.attack.radius;
          spawnCircle(
            game,
            enemy,
            effect.attack,
            effect.centerX + Math.cos(angle) * dist,
            effect.centerY + Math.sin(angle) * dist,
            36,
            0.5,
            0.12
          );
        }
        remaining.push(effect);
      }
      continue;
    }

    if (effect.kind === "targeted_rain_zone") {
      if (game.time < effect.endAt) {
        if (game.time >= effect.nextAt) {
          effect.nextAt += effect.attack.zoneTickSec ?? 0.5;
          spawnCircle(
            game,
            enemy,
            effect.attack,
            effect.centerX,
            effect.centerY,
            effect.attack.radius,
            effect.attack.damageScale,
            Math.max(0.08, effect.attack.tickHitDuration ?? 0.12)
          );
        }
        remaining.push(effect);
      }
      continue;
    }

    if (effect.kind === "poison_pool") {
      if (game.time < effect.endAt) {
        const poolCenter = enemyCenter(enemy);
        const radius = effect.attack.radius ?? 120;
        if (game.time >= effect.nextVisualAt) {
          effect.nextVisualAt += effect.attack.visualTickSec ?? 0.12;
          game.spawnEnemyAreaHitbox?.({
            sourceId: enemy.id,
            x: poolCenter.x,
            y: poolCenter.y,
            radius,
            shape: "circle",
            damage: 0,
            duration: effect.attack.visualDurationSec ?? 0.2,
            age: 0,
            hit: true,
            telegraphOnly: true,
            color: effect.attack.poolColor ?? "#84cc16",
            groundImpactSprite: effect.attack.groundImpactSprite ?? null,
            groundImpactFrames: effect.attack.groundImpactFrames ?? 6,
            groundImpactScale: effect.attack.groundImpactScale ?? 1,
            groundImpactYOffset: effect.attack.groundImpactYOffset ?? 0,
            groundImpactAnchorX: poolCenter.x,
            groundImpactAnchorY: poolCenter.y
          });
        }
        if (game.time >= effect.nextPoisonAt) {
          effect.nextPoisonAt += effect.attack.zoneTickSec ?? 0.5;
          const target = getEnemyTargetEntity(game);
          const playerCenter = centerOf(target);
          if (distance(playerCenter.x, playerCenter.y, poolCenter.x, poolCenter.y) <= radius + Math.min(target.w, target.h) * 0.33) {
            applyEnemyTargetStatus(game, {
              poisonDuration: effect.attack.poisonDuration ?? 4,
              poisonDps: effect.attack.poisonDps ?? 3
            });
          }
        }
        if (game.time >= effect.nextBuffAt) {
          effect.nextBuffAt += effect.attack.buffTickSec ?? 0.15;
          const speedUntil = game.time + (effect.attack.allyBuffRefreshSec ?? 0.24);
          for (const other of game.enemies || []) {
            if (other.dead || !other.attackRuntime) continue;
            const otherCenter = centerOf(other);
            if (distance(otherCenter.x, otherCenter.y, poolCenter.x, poolCenter.y) > radius) continue;
            other.attackRuntime.buffs.speedUntil = Math.max(other.attackRuntime.buffs.speedUntil || 0, speedUntil);
            other.attackRuntime.buffs.speedMult = Math.max(other.attackRuntime.buffs.speedMult || 1, effect.attack.allySpeedMult ?? 1.35);
          }
        }
        remaining.push(effect);
      }
      continue;
    }

    if (effect.kind === "volcano") {
      if (effect.remaining > 0 && game.time >= effect.nextAt) {
        effect.remaining -= 1;
        effect.nextAt += effect.attack.eruptionGapSec ?? 0.08;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (effect.attack.eruptionSpawnRadius ?? 220);
        spawnCircle(game, enemy, effect.attack, effect.centerX + Math.cos(angle) * dist, effect.centerY + Math.sin(angle) * dist, effect.attack.radius, effect.attack.damageScale, 0.1);
      }
      if (effect.remaining > 0) remaining.push(effect);
      continue;
    }

    if (effect.kind === "earthquake") {
      if (effect.index < (effect.attack.earthquakeRadii?.length || 0) && game.time >= effect.nextAt) {
        const radius = effect.attack.earthquakeRadii[effect.index];
        spawnCircle(game, enemy, effect.attack, effect.centerX, effect.centerY, radius, effect.attack.damageScale, 0.14);
        effect.index += 1;
        effect.nextAt += effect.attack.earthquakeGapSec ?? 0.3;
      }
      if (effect.index < (effect.attack.earthquakeRadii?.length || 0)) remaining.push(effect);
      continue;
    }

    if (effect.kind === "fire_thrower") {
      if (game.time < effect.damageUntil) {
        if (game.time >= effect.nextAt) {
          effect.nextAt += effect.attack.fireThrowerIntervalSec ?? 0.2;
          spawnCone(game, enemy, effect.attack, origin, { x: effect.dirX, y: effect.dirY }, effect.attack.range, effect.attack.arc, effect.attack.damageScale, 0.16);
        }
      }
      if (game.time < effect.visualEndAt) {
        remaining.push(effect);
      }
      continue;
    }

    if (effect.kind === "circle_combo") {
      if (effect.remaining > 0 && game.time >= effect.nextAt) {
        effect.remaining -= 1;
        effect.nextAt += effect.attack.comboGap ?? 0.05;
        spawnCircle(game, enemy, effect.attack, origin.x, origin.y, effect.attack.radius);
      }
      if (effect.remaining > 0) remaining.push(effect);
      continue;
    }

    if (effect.kind === "cone_combo") {
      if (effect.remaining > 0 && game.time >= effect.nextAt) {
        effect.remaining -= 1;
        effect.nextAt += effect.attack.sameStripComboGap ?? 0.05;
        spawnCone(game, enemy, effect.attack, origin, { x: effect.dirX, y: effect.dirY });
      }
      if (effect.remaining > 0) remaining.push(effect);
      continue;
    }

    if (effect.kind === "fire_leap_land") {
      spawnCircle(game, enemy, effect.attack, effect.x, effect.y, effect.attack.radius, effect.attack.damageScale, 0.14);
      continue;
    }
  }

  runtime.activeEffects = remaining;
}

function updateAttackState(game, enemy, dt, dirToPlayer, distanceToPlayer, awareness = null, options = {}) {
  const runtime = enemy.attackRuntime;

  for (const [id, value] of Object.entries(runtime.cooldowns)) {
    runtime.cooldowns[id] = Math.max(0, value - dt);
  }
  if (runtime.buffs.speedUntil > 0 && game.time >= runtime.buffs.speedUntil) {
    runtime.buffs.speedUntil = 0;
    runtime.buffs.speedMult = 1;
  }

  updateActiveEffects(game, enemy, dt);

  if (runtime.currentAttack?.kind === "running_shot" && (runtime.state === "windup" || runtime.state === "active")) {
    const moveDir = normalize(runtime.runningShot.moveDirX, runtime.runningShot.moveDirY, dirToPlayer);
    const shotDir = normalize(runtime.runningShot.shotDirX, runtime.runningShot.shotDirY, dirToPlayer);
    syncFacing(enemy, shotDir);
    tryMoveEnemy(enemy, game.world, moveDir.x * enemy.speed * (runtime.currentAttack.runSpeedMult ?? 2) * dt, moveDir.y * enemy.speed * (runtime.currentAttack.runSpeedMult ?? 2) * dt);
    enemy.isMoving = true;
  }
  if (runtime.currentAttack?.kind === "run_spread_shot" && runtime.state !== "idle") {
    const moveDir = normalize(runtime.runningShot.moveDirX, runtime.runningShot.moveDirY, dirToPlayer);
    const shotDir = normalize(runtime.runningShot.shotDirX, runtime.runningShot.shotDirY, dirToPlayer);
    syncFacing(enemy, shotDir);
    let speedMult = runtime.currentAttack.runSpeedMult ?? 1.5;
    if (runtime.state === "active" || runtime.state === "recover") {
      const current = runtime.runningShot.speedMult ?? speedMult;
      const target = runtime.currentAttack.endSpeedMult ?? 1;
      const lerp = Math.min(1, (runtime.currentAttack.slowdownLerpPerSec ?? 3) * dt);
      speedMult = current + (target - current) * lerp;
      runtime.runningShot.speedMult = speedMult;
    } else {
      runtime.runningShot.speedMult = speedMult;
    }
    tryMoveEnemy(enemy, game.world, moveDir.x * enemy.speed * speedMult * dt, moveDir.y * enemy.speed * speedMult * dt);
    enemy.isMoving = true;
  }

  if (runtime.state === "windup" && runtime.currentAttack?.kind === "fire_leap") {
    const leapSpeed = (runtime.currentAttack.leapDistance ?? 240) / Math.max(0.001, runtime.windupDuration);
    tryMoveEnemy(enemy, game.world, dirToPlayer.x * leapSpeed * dt, dirToPlayer.y * leapSpeed * dt);
  }
  if (runtime.state === "windup" && Number.isFinite(runtime.currentAttack?.leapStartFrame) && Number.isFinite(runtime.currentAttack?.leapEndFrame)) {
    const frame = windupFrameForAttack(enemy);
    const startFrame = Math.max(0, Math.floor(runtime.currentAttack.leapStartFrame));
    const endFrame = Math.max(startFrame, Math.floor(runtime.currentAttack.leapEndFrame));
    if (frame != null && frame >= startFrame && frame <= endFrame) {
      const target = runtime.telegraphTarget || currentTargetPoint(game, enemy);
      const origin = enemyCenter(enemy);
      const leapDir = normalize(target.x - origin.x, target.y - origin.y, dirToPlayer);
      const leapSpeed = enemy.speed * (runtime.currentAttack.leapSpeedMult ?? 1);
      syncFacing(enemy, leapDir);
      tryMoveEnemy(enemy, game.world, leapDir.x * leapSpeed * dt, leapDir.y * leapSpeed * dt);
    }
  }

  if (runtime.state === "idle") {
    if (game.time < (runtime.nextAttackAt || 0)) return;
    if (runtime.tactical?.mode === "feint") return;
    if (runtime.queuedAttackId) {
      const queuedAttack = enemy.attacks.find((candidate) => candidate.id === runtime.queuedAttackId) || null;
      if (queuedAttack && (runtime.cooldowns[queuedAttack.id] ?? 0) <= 0) {
        runtime.queuedAttackId = null;
        beginAttack(game, enemy, queuedAttack);
        return;
      }
    }
    if (options.manualOnly) return;
    const inRangeCandidates = enemy.attacks.filter((attack) => {
      const cooldown = runtime.cooldowns[attack.id] ?? 0;
      if (cooldown > 0) return false;
      if (distanceToPlayer < (attack.minRange ?? 0) || distanceToPlayer > (attack.maxRange ?? 999)) return false;
      if (attack.allowAlerted !== true && awareness?.state === "alerted") return false;
      if (attack.requireOutsideDetectionRange === true && distanceToPlayer <= (awareness?.detectionRange ?? Infinity)) return false;
      return true;
    });
    const candidates = inRangeCandidates.filter((attack) => canTierUseAttack(enemy, attack));
    const pool = candidates.length ? candidates : inRangeCandidates;
    if (pool.length > 0) {
      beginAttack(game, enemy, weightedPick(pool));
      return;
    }
    return;
  }

  runtime.timer = Math.max(0, runtime.timer - dt);
  const attack = runtime.currentAttack;
  if (!attack) {
    clearAttack(enemy);
    return;
  }

  if (runtime.state === "windup") {
    const earlySpawnAt = Number(attack.projectileSpawnWindupT);
    if (!runtime.effectFired && Number.isFinite(earlySpawnAt)) {
      const threshold = runtime.windupDuration * (1 - earlySpawnAt);
      if (runtime.timer <= threshold + 0.0001) {
        emitAttack(game, enemy, attack, dirToPlayer);
        runtime.effectFired = true;
      }
    }
    if (runtime.timer <= 0) {
      runtime.state = "active";
      runtime.timer = runtime.activeDuration;
      runtime.lastFrame = getAttackTriggerFrame(attack) - 1;
    }
    return;
  }

  if (runtime.state === "active") {
    const frame = attackFrameForState(enemy);
    if (!runtime.effectFired) {
      const trigger = getAttackTriggerFrame(attack);
      if ((frame ?? trigger) >= trigger) {
        emitAttack(game, enemy, attack, dirToPlayer);
        runtime.effectFired = true;
      }
    }
    runtime.lastFrame = frame ?? runtime.lastFrame;
    if (runtime.timer <= 0) {
      finishAttack(game, enemy);
    }
    return;
  }

  if (runtime.state === "recover" && runtime.timer <= 0) {
    clearAttack(enemy);
  }
}

function moveEnemyByRole(game, enemy, dirToPlayer, distanceToPlayer, dt, speedMultiplier = 1) {
  const runtime = enemy.attackRuntime;
  if (runtime.state !== "idle") {
    enemy.isMoving = false;
    return;
  }
  const speed = enemy.speed * speedMultiplier * (runtime.buffs.speedMult || 1);
  const tacticalMove = getTacticalMovementCommand(game, enemy, dirToPlayer, distanceToPlayer, dt);
  if (tacticalMove && (Math.abs(tacticalMove.dir.x) > 0.001 || Math.abs(tacticalMove.dir.y) > 0.001)) {
    syncFacing(enemy, tacticalMove.facingDir || tacticalMove.dir);
    tryMoveEnemy(
      enemy,
      game.world,
      tacticalMove.dir.x * speed * (tacticalMove.speedMult || 1) * dt,
      tacticalMove.dir.y * speed * (tacticalMove.speedMult || 1) * dt
    );
    enemy.isMoving = true;
    return;
  }
  if (enemy.role === "ranged") {
    if (distanceToPlayer > enemy.preferredRange + 35) {
      tryMoveEnemy(enemy, game.world, dirToPlayer.x * speed * dt, dirToPlayer.y * speed * dt);
      enemy.isMoving = true;
      return;
    }
    if (distanceToPlayer < enemy.preferredRange - 45) {
      tryMoveEnemy(enemy, game.world, -dirToPlayer.x * speed * dt, -dirToPlayer.y * speed * dt);
      enemy.isMoving = true;
      return;
    }
    enemy.isMoving = false;
    return;
  }
  tryMoveEnemy(enemy, game.world, dirToPlayer.x * speed * dt, dirToPlayer.y * speed * dt);
  enemy.isMoving = true;
}

function updateVisualState(enemy) {
  if (enemy.hitTimer > 0 && enemy.sprite.hit) {
    const sheet = enemy.sprite.hit;
    const total = Math.max(0.001, enemy.hitDuration || 0.1);
    const progress = clamp(1 - enemy.hitTimer / total, 0, 0.9999);
    enemy.render.sheetKey = "hit";
    enemy.render.frame = clamp(Math.floor(progress * sheet.frames), 0, sheet.frames - 1);
    return;
  }
  const sheetKey = getAttackSpriteKey(enemy);
  const sheet = enemy.sprite[sheetKey] || enemy.sprite.idle;
  let frame = attackFrameForState(enemy);
  if (frame == null) {
    if (enemy.attackRuntime?.roll?.active && sheetKey === "roll") {
      const total = Math.max(0.001, enemy.attackRuntime.roll.duration || 1);
      const progress = clamp(enemy.attackRuntime.roll.elapsed / total, 0, 0.9999);
      frame = Math.floor(progress * sheet.frames);
    } else if (sheet.loop) {
      frame = Math.floor(enemy.animClock * sheet.fps) % sheet.frames;
    } else {
      frame = 0;
    }
  }
  enemy.render.sheetKey = sheetKey;
  enemy.render.frame = clamp(frame, 0, sheet.frames - 1);
}

export function isUndeadEnemy(enemy) {
  return !!enemy?.attackRuntime;
}

export function createUndeadRuntime() {
  return {
    state: "idle",
    currentAttack: null,
    timer: 0,
    windupDuration: 0,
    activeDuration: 0,
    recoverDuration: 0,
    windupCycle: 0,
    effectFired: false,
    lastFrame: -1,
    cooldowns: {},
    nextAttackAt: 0,
    queuedAttackId: null,
    telegraphTarget: null,
    activeEffects: [],
    comboShotsRemaining: 0,
    buffs: {
      speedUntil: 0,
      speedMult: 1
    },
    runningShot: {
      moveDirX: 0,
      moveDirY: 0,
      shotDirX: 0,
      shotDirY: 0
    },
    swiftStep: {
      active: false,
      triggered: false,
      phase: "none",
      timer: 0,
      runDuration: 0,
      holdDuration: 0,
      dirX: 0,
      dirY: 0
    },
    guard: {
      active: false,
      triggered: false,
      phase: "none",
      remaining: 0,
      timer: 0,
      startDuration: 0,
      dirX: 1,
      dirY: 0
    },
    awaken: {
      active: false,
      finished: false,
      timer: 0,
      duration: 0
    },
    roll: {
      active: false,
      elapsed: 0,
      duration: 1,
      dirX: 1,
      dirY: 0,
      nextAt: 3 + Math.random() * 4
    }
  };
}

export function updateUndeadEnemy(game, enemy, dt) {
  const playerCenter = centerOf(game.player);
  const enemyMid = enemyCenter(enemy);
  const dirToPlayer = normalize(playerCenter.x - enemyMid.x, playerCenter.y - enemyMid.y, { x: 1, y: 0 });
  const distToPlayer = distance(playerCenter.x, playerCenter.y, enemyMid.x, enemyMid.y);
  const awareness = getEnemyAwareness(game, enemy);
  enemy.awarenessState = awareness.state;
  consumePendingHitInterrupt(enemy);

  if (maybeStartSwiftStep(enemy, dirToPlayer) || enemy.attackRuntime.swiftStep.active) {
    updateSwiftStep(game, enemy, dt);
    updateVisualState(enemy);
    return;
  }

  if (updateAwaken(enemy, awareness, dt)) {
    updateVisualState(enemy);
    return;
  }

  if (maybeStartGuard(enemy, dirToPlayer) || enemy.attackRuntime.guard.active) {
    updateGuard(enemy, dt);
    updateVisualState(enemy);
    return;
  }

  syncFacing(enemy, dirToPlayer);
  if (enemy.attackRuntime.state !== "idle") {
    moveEnemyByRole(game, enemy, dirToPlayer, distToPlayer, dt, 1);
    updateAttackState(game, enemy, dt, dirToPlayer, distToPlayer, awareness);
    updateVisualState(enemy);
    return;
  }

  if (awareness.state === "idle") {
    enemy.isMoving = false;
    updateVisualState(enemy);
    return;
  }

  if (awareness.state === "alerted") {
    enemy.attackRuntime.roll.active = false;
    updateAttackState(game, enemy, dt, dirToPlayer, distToPlayer, awareness);
    if (enemy.attackRuntime.state === "idle") moveEnemyByRole(game, enemy, dirToPlayer, distToPlayer, dt, 0.5);
    updateVisualState(enemy);
    return;
  }

  if (updateRoll(game, enemy, dt)) {
    updateVisualState(enemy);
    return;
  }
  maybeStartRoll(game, enemy, dirToPlayer);
  if (updateRoll(game, enemy, dt)) {
    updateVisualState(enemy);
    return;
  }

  moveEnemyByRole(game, enemy, dirToPlayer, distToPlayer, dt, 1);
  updateAttackState(game, enemy, dt, dirToPlayer, distToPlayer, awareness);
  updateVisualState(enemy);
}

export function triggerEnemyAttackByIndex(game, enemy, index) {
  const runtime = enemy?.attackRuntime;
  const attack = enemy?.attacks?.[index] || null;
  if (!runtime || !attack) return false;
  if (runtime.state !== "idle") return false;
  if (game.time < (runtime.nextAttackAt || 0)) return false;
  if ((runtime.cooldowns[attack.id] ?? 0) > 0) return false;
  beginAttack(game, enemy, attack);
  return true;
}

export function updateManualControlledEnemy(game, enemy, dt) {
  if (!enemy?.attackRuntime) return;
  enemy.animClock += dt;
  enemy.isMoving = false;
  enemy.attackRuntime.awaken.finished = true;
  enemy.attackRuntime.awaken.active = false;
  enemy.attackRuntime.guard.triggered = true;
  enemy.attackRuntime.swiftStep.triggered = true;
  enemy.attackRuntime.roll.active = false;

  const enemyMid = enemyCenter(enemy);
  const moveAxis = game.input.getMoveAxis();
  const aim = game.input.getAimWorld(game.camera);
  const aimDir = normalize(aim.x - enemyMid.x, aim.y - enemyMid.y, { x: 1, y: 0 });
  syncFacing(enemy, aimDir);

  if (enemy.attackRuntime.state === "idle" && (Math.abs(moveAxis.x) > 0.001 || Math.abs(moveAxis.y) > 0.001)) {
    enemy.isMoving = tryMoveEnemy(enemy, game.world, moveAxis.x * enemy.speed * dt, moveAxis.y * enemy.speed * dt);
  }

  const targetCenter = getEnemyTargetCenter(game);
  const distToTarget = distance(targetCenter.x, targetCenter.y, enemyMid.x, enemyMid.y);
  enemy.awarenessState = "detected";
  updateAttackState(game, enemy, dt, aimDir, distToTarget, { state: "detected", detectionRange: Infinity }, { manualOnly: true });
  updateVisualState(enemy);
}
