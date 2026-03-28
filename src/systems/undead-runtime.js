import { centerOf, clamp, distance, normalize, rectsOverlap, toDirectionKey } from "../core/runtime-utils.js";
import { getEnemyAwareness } from "./enemy-awareness.js";

const ROLL_INTO_PLAYER_IDS = new Set(["m_ud_brute", "m_ud_dark_lord_2", "m_ud_dark_knight_3", "m_ud_berserker_4", "m_ud_warrior"]);

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

function tryMoveEnemy(enemy, room, dx, dy) {
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
  return moveX !== enemy.x || moveY !== enemy.y;
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
  const animFps = Math.max(1, Number(attack.animFps) || 14);
  const totalFrames = getAttackTotalFrames(attack);
  const trigger = Math.min(totalFrames - 1, getAttackTriggerFrame(attack));
  const remainingFrames = Math.max(1, totalFrames - trigger);
  return remainingFrames / animFps;
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

function syncFacing(enemy, dir) {
  enemy.direction = toDirectionKey(dir.x, dir.y, enemy.direction || "down");
  enemy.facing = dir.x >= 0 ? 1 : -1;
}

function currentTargetPoint(game, enemy) {
  const playerCenter = centerOf(game.player);
  return { x: playerCenter.x, y: playerCenter.y };
}

function activeAttack(enemy) {
  return enemy.attackRuntime.currentAttack;
}

function getAttackSpriteKey(enemy) {
  const runtime = enemy.attackRuntime;
  const attack = runtime.currentAttack;
  if (runtime.roll.active) return enemy.sprite.roll ? "roll" : "move";
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
  const attack = runtime.currentAttack;
  if (!attack || runtime.state === "recover") return null;
  const sprite = enemy.sprite[getAttackSpriteKey(enemy)];
  if (!sprite) return null;
  const trigger = Math.min(sprite.frames - 1, getAttackTriggerFrame(attack));
  if (runtime.state === "windup") {
    const total = Math.max(0.001, runtime.windupDuration);
    const progress = clamp(1 - runtime.timer / total, 0, 0.9999);
    return Math.min(trigger, Math.floor(progress * (trigger + 1)));
  }
  if (runtime.state === "active") {
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
  runtime.comboShotsRemaining = attack.comboShots ?? attack.sameStripComboHits ?? 0;
}

function finishAttack(enemy) {
  const runtime = enemy.attackRuntime;
  const attack = runtime.currentAttack;
  if (attack) {
    runtime.cooldowns[attack.id] = attack.cooldown ?? 1;
  }
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
}

function spawnCircle(game, enemy, attack, x, y, radius, damageScale = attack.damageScale ?? 1, duration = 0.12) {
  game.spawnEnemyAreaHitbox?.({
    sourceId: enemy.id,
    x,
    y,
    radius,
    shape: "circle",
    damage: computeDamage(enemy, attack, damageScale),
    duration,
    tint: attack.kind === "fire_cleanse" ? "#fb923c" : "#ef4444"
  });
}

function spawnCone(game, enemy, attack, origin, dir, range = attack.range, arc = attack.arc, damageScale = attack.damageScale ?? 1, duration = 0.1) {
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
    knockback: attack.knockback || 0,
    tint: attack.kind === "fire_thrower" ? "#fb923c" : "#ef4444"
  });
}

function spawnProjectile(game, enemy, attack, dir, overrides = {}) {
  game.spawnEnemyProjectile?.(enemy, {
    dirX: dir.x,
    dirY: dir.y,
    speed: overrides.speed ?? attack.speedValue ?? 280,
    radius: overrides.radius ?? attack.projectileRadius ?? Math.max(8, (attack.projectileSize ?? 12) * 0.5),
    size: overrides.size ?? attack.projectileSize ?? 12,
    damage: overrides.damage ?? computeDamage(enemy, attack, overrides.damageScale ?? attack.damageScale ?? 1),
    color: overrides.color ?? attack.projectileColor ?? "#f59e0b",
    spriteAsset: overrides.spriteAsset ?? attack.projectileSprite ?? null,
    maxRange: overrides.maxRange ?? 520,
    lifetime: overrides.lifetime ?? attack.projectileLifetime ?? null,
    trailInterval: overrides.trailInterval ?? null,
    trailChild: overrides.trailChild ?? null,
    sourceAttackId: attack.id
  });
}

function emitAttack(game, enemy, attack, dir) {
  const runtime = enemy.attackRuntime;
  const origin = enemyCenter(enemy);
  const target = runtime.telegraphTarget || currentTargetPoint(game, enemy);

  if (attack.kind === "cone") {
    spawnCone(game, enemy, attack, origin, dir);
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

  if (attack.kind === "projectile") {
    spawnProjectile(game, enemy, attack, dir);
    return;
  }

  if (attack.kind === "projectile_burst") {
    const count = attack.projectileCount ?? 8;
    for (let index = 0; index < count; index += 1) {
      const angle = attack.random360
        ? (Math.PI * 2 * index) / count
        : Math.atan2(dir.y, dir.x);
      spawnProjectile(game, enemy, attack, { x: Math.cos(angle), y: Math.sin(angle) });
    }
    return;
  }

  if (attack.kind === "projectile_spin") {
    const count = attack.spinCount ?? 8;
    const startDeg = attack.spinStartDeg ?? 0;
    const stepDeg = attack.spinStepDeg ?? 45;
    for (let index = 0; index < count; index += 1) {
      const degrees = startDeg + stepDeg * index;
      const angle = (degrees * Math.PI) / 180;
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

  if (attack.kind === "summon") {
    const spawnX = origin.x + dir.x * (attack.spawnForward ?? 180) - 0.5 * 68;
    const spawnY = origin.y + dir.y * (attack.spawnForward ?? 180) - 0.5 * 68;
    game.spawnEnemyByType?.(attack.spawnType, spawnX, spawnY, { summonedBy: enemy.id });
    return;
  }

  if (attack.kind === "warcry") {
    enemy.attackRuntime.buffs.speedUntil = game.time + (attack.buffDuration ?? 3);
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
    runtime.activeEffects.push(createEffect("fire_thrower", {
      attack,
      until: game.time + (attack.fireThrowerDurationSec ?? 2),
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

    if (effect.kind === "frame_synced_circle") {
      const attack = activeAttack(enemy);
      if (!attack) continue;
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
      if (game.time < effect.until) {
        if (game.time >= effect.nextAt) {
          effect.nextAt += effect.attack.fireThrowerIntervalSec ?? 0.2;
          spawnCone(game, enemy, effect.attack, origin, { x: effect.dirX, y: effect.dirY }, effect.attack.range, effect.attack.arc, effect.attack.damageScale, 0.16);
        }
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

function updateAttackState(game, enemy, dt, dirToPlayer, distanceToPlayer) {
  const runtime = enemy.attackRuntime;

  for (const [id, value] of Object.entries(runtime.cooldowns)) {
    runtime.cooldowns[id] = Math.max(0, value - dt);
  }
  if (runtime.buffs.speedUntil > 0 && game.time >= runtime.buffs.speedUntil) {
    runtime.buffs.speedUntil = 0;
    runtime.buffs.speedMult = 1;
  }

  updateActiveEffects(game, enemy, dt);

  if (runtime.state === "windup" && runtime.currentAttack?.kind === "fire_leap") {
    const leapSpeed = (runtime.currentAttack.leapDistance ?? 240) / Math.max(0.001, runtime.windupDuration);
    tryMoveEnemy(enemy, game.world, dirToPlayer.x * leapSpeed * dt, dirToPlayer.y * leapSpeed * dt);
  }

  if (runtime.state === "idle") {
    const candidates = enemy.attacks.filter((attack) => {
      const cooldown = runtime.cooldowns[attack.id] ?? 0;
      return cooldown <= 0 && distanceToPlayer >= (attack.minRange ?? 0) && distanceToPlayer <= (attack.maxRange ?? 999);
    });
    if (candidates.length > 0) {
      beginAttack(game, enemy, weightedPick(candidates));
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
      finishAttack(enemy);
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
    telegraphTarget: null,
    activeEffects: [],
    comboShotsRemaining: 0,
    buffs: {
      speedUntil: 0,
      speedMult: 1
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

  syncFacing(enemy, dirToPlayer);
  if (enemy.attackRuntime.state !== "idle") {
    moveEnemyByRole(game, enemy, dirToPlayer, distToPlayer, dt, 1);
    updateAttackState(game, enemy, dt, dirToPlayer, distToPlayer);
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
    moveEnemyByRole(game, enemy, dirToPlayer, distToPlayer, dt, 0.5);
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
  updateAttackState(game, enemy, dt, dirToPlayer, distToPlayer);
  updateVisualState(enemy);
}
