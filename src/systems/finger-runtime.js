/**
 * FINGER RUNTIME SYSTEM
 * 
 * Logic for resolving equipped fingers into a single run build.
 */

import { getModById } from "../data/finger-mods.js";
import { getPlayerStat, getPlayerAttackStat, setPlayerStatSource } from "./player-stats.js";
import { distance, clamp, centerOf, normalize } from "../core/runtime-utils.js";
import { applyStatusPayload } from "./status-manager.js";
import { spawnDamagePopup } from "./combat.js";

/**
 * Creates initial runtime state for a finger build.
 */
export function createFingerBuildRuntime() {
  return {
    comboCount: 0,
    comboTimer: 0,
    killCounter: 0,
    hellhounds: [],
    nextEmpoweredAttackAt: 0,
    isEmpoweredReady: false,
    skillFollowupActive: false,
    killStreakCount: 0,
    killStreakTimer: 0,
    surgeActiveUntil: 0
  };
}

/**
 * Resolves up to 4 fingers into a single build object.
 * @param {Array} equippedFingers - Array of Finger instances.
 */
export function resolveActiveFingerBuild(equippedFingers = []) {
  const build = {
    mainGlobal: null,
    secondaryGlobals: [],
    heroMods: [],
    curses: [],
    combinedStats: {}
  };

  if (!equippedFingers.length) return build;

  // 1. Pick Main Global (Dominant - from first slot)
  const dominantFinger = equippedFingers[0];
  build.mainGlobal = getModById(dominantFinger.mainModId);

  // 2. Collect all Secondary Globals
  for (const finger of equippedFingers) {
    const mod = getModById(finger.secondaryModId);
    if (mod) build.secondaryGlobals.push(mod);
  }

  // 3. Collect all Hero Mods
  for (const finger of equippedFingers) {
    const mod = getModById(finger.heroModId);
    if (mod) build.heroMods.push(mod);
  }

  // 4. Select first 2 Curses
  for (let i = 0; i < Math.min(2, equippedFingers.length); i++) {
    const mod = getModById(equippedFingers[i].curseId);
    if (mod) build.curses.push(mod);
  }

  // 5. Aggregate Stats
  const statSource = {};
  const allActiveMods = [
    build.mainGlobal,
    ...build.secondaryGlobals,
    ...build.heroMods,
    ...build.curses
  ].filter(Boolean);

  // Apply Secondary rolled values first
  equippedFingers.forEach(finger => {
    const mod = getModById(finger.secondaryModId);
    if (!mod || !mod.valueRange) return;
    
    const statId = mod.valueRange.stat;
    const op = mod.valueRange.op;
    const value = finger.secondaryValue;

    if (!statSource[statId]) statSource[statId] = { add: 0, mult: 1 };
    if (op === "multAdd") statSource[statId].mult *= (1 + value);
    else statSource[statId].add += value;
  });

  // Apply other fixed mod stats
  for (const mod of allActiveMods) {
    if (!mod.stats) continue;
    for (const [statId, bonus] of Object.entries(mod.stats)) {
      if (!statSource[statId]) {
        statSource[statId] = { add: 0, mult: 1 };
      }
      if (bonus.add) statSource[statId].add += bonus.add;
      if (bonus.multAdd) statSource[statId].mult *= (1 + bonus.multAdd);
    }
  }
  build.combinedStats = statSource;

  return build;
}

/**
 * LOGIC HOOKS
 */

export function onFingerBuildHit(game, enemy, meta) {
  const build = game.activeFingerBuild;
  const runtime = game.fingerBuildRuntime;
  if (!build || !runtime) return;

  // 1. Combo Scaling
  if (buildHasMod(build, "combo_scaling")) {
    runtime.comboCount = Math.min(6, runtime.comboCount + 1);
    runtime.comboTimer = 1.5; // Reset if 1.5s passes without hit
    applyFingerRuntimeStats(game);
  }

  // 2. Skill Followup Consumption
  if (runtime.skillFollowupActive) {
    runtime.skillFollowupActive = false;
    applyFingerRuntimeStats(game);
  }

  // 3. Periodic Empowerment Consumption
  if (runtime.isEmpoweredReady) {
    runtime.isEmpoweredReady = false;
    runtime.nextEmpoweredAttackAt = game.time + 3;
    applyFingerRuntimeStats(game);
  }
}

export function onFingerBuildCrit(game, enemy, meta) {
  const build = game.activeFingerBuild;
  if (!build) return;

  // 1. Elemental Critical
  if (buildHasMod(build, "crit_status")) {
    const roll = Math.random();
    const payload = roll < 0.33 ? { bleedDuration: 4, bleedDps: 5 } :
                    roll < 0.66 ? { burnDuration: 3, burnDps: 8 } :
                    { poisonDuration: 5, poisonDps: 4 };
    applyStatusPayload(enemy, payload);
  }
}

export function onFingerBuildKill(game, enemy) {
  const build = game.activeFingerBuild;
  const runtime = game.fingerBuildRuntime;
  if (!build || !runtime) return;

  // 1. Kill Streak Surge
  if (buildHasMod(build, "kill_streak_surge")) {
    const now = performance.now() / 1000;
    if (now - runtime.killStreakTimer > 1.0) {
      runtime.killStreakCount = 1;
    } else {
      runtime.killStreakCount += 1;
    }
    runtime.killStreakTimer = now;

    if (runtime.killStreakCount >= 6) {
      runtime.surgeActiveUntil = game.time + 4;
      runtime.killStreakCount = 0;
      applyFingerRuntimeStats(game);
      
      const px = game.player.x + game.player.w * 0.5;
      spawnDamagePopup(game, px, game.player.y - 40, "KILL SURGE!", {
        color: "#f87171",
        duration: 1.5,
        scale: 1.2
      });
    }
  }

  // 2. Hellhound Pact
  if (buildHasMod(build, "dk_hellhound_pact")) {
    const mod = getModById("dk_hellhound_pact");
    runtime.killCounter += 1;
    if (runtime.killCounter >= (mod.values.threshold ?? 10)) {
      runtime.killCounter = 0;
      summonHellhound(game, mod);
    }
  }
}

function summonHellhound(game, mod) {
  const runtime = game.fingerBuildRuntime;
  if (runtime.hellhounds.length >= (mod.values.maxActive ?? 3)) {
    // Remove oldest hellhound
    runtime.hellhounds.shift();
  }

  const playerCenter = centerOf(game.player);
  const angle = Math.random() * Math.PI * 2;
  const dist = 48;
  
  runtime.hellhounds.push({
    id: `hellhound_${Math.random().toString(36).slice(2, 8)}`,
    x: playerCenter.x + Math.cos(angle) * dist,
    y: playerCenter.y + Math.sin(angle) * dist,
    targetX: playerCenter.x,
    targetY: playerCenter.y,
    vx: 0,
    vy: 0,
    animClock: Math.random() * 10,
    attackTimer: 0,
    activeUntil: game.time + (mod.values.duration ?? 10.0),
    mod: mod
  });

  const px = game.player.x + game.player.w * 0.5;
  spawnDamagePopup(game, px, game.player.y - 60, "HELLHOUND SUMMONED!", {
    color: "#f97316",
    duration: 1.2,
    scale: 1.1
  });
}

export function onFingerBuildSkillUse(game, skillId) {
  const build = game.activeFingerBuild;
  const runtime = game.fingerBuildRuntime;
  if (!build || !runtime) return;

  // 1. Skill Followup
  if (buildHasMod(build, "skill_followup")) {
    runtime.skillFollowupActive = true;
    applyFingerRuntimeStats(game);
  }
}

export function onFingerBuildUpdate(game, dt) {
  const build = game.activeFingerBuild;
  const runtime = game.fingerBuildRuntime;
  if (!build || !runtime) return;

  // 1. Combo Timer
  if (runtime.comboCount > 0) {
    runtime.comboTimer -= dt;
    if (runtime.comboTimer <= 0) {
      runtime.comboCount = 0;
      applyFingerRuntimeStats(game);
    }
  }

  // 2. Periodic Empowerment Timer
  if (buildHasMod(build, "periodic_empowerment") && !runtime.isEmpoweredReady) {
    if (game.time >= (runtime.nextEmpoweredAttackAt || 0)) {
      runtime.isEmpoweredReady = true;
      applyFingerRuntimeStats(game);
    }
  }

  // 3. Kill Surge Expiry
  if (runtime.surgeActiveUntil > 0 && game.time >= runtime.surgeActiveUntil) {
    runtime.surgeActiveUntil = 0;
    applyFingerRuntimeStats(game);
  }
  
  // 4. Update Gold-based speed (Dynamic update via refresh stats)
  if (buildHasMod(build, "gold_scaling_speed")) {
    applyFingerRuntimeStats(game);
  }

  // 5. Update Hellhounds
  if (runtime.hellhounds.length > 0) {
    updateHellhounds(game, runtime, dt);
  }
}

function updateHellhounds(game, runtime, dt) {
  const playerCenter = centerOf(game.player);
  runtime.hellhounds = runtime.hellhounds.filter(hound => {
    if (game.time >= hound.activeUntil) return false;

    const mod = hound.mod;
    const values = mod.values;

    // AI: Follow player, but stay within orbit
    const distToPlayer = distance(hound.x, hound.y, playerCenter.x, playerCenter.y);
    const targetRange = 64;
    const followSpeed = 180;

    if (distToPlayer > targetRange) {
      const dir = normalize(playerCenter.x - hound.x, playerCenter.y - hound.y, { x: 1, y: 0 });
      hound.vx = dir.x * followSpeed;
      hound.vy = dir.y * followSpeed;
    } else {
      hound.vx *= 0.9;
      hound.vy *= 0.9;
    }

    hound.x += hound.vx * dt;
    hound.y += hound.vy * dt;
    hound.animClock += dt;
    hound.attackTimer -= dt;

    if (hound.attackTimer <= 0) {
      const target = findNearestEnemy(game, hound, values.radius ?? 88);
      if (target) {
        const dmg = getPlayerAttackStat(game.player) * (values.damageRatio ?? 0.6);
        game.damageEnemy(target, dmg, { source: "skill", isDirect: false });
        applyStatusPayload(target, {
          burnDuration: values.burnDuration ?? 3.0,
          burnDamagePerSecond: getPlayerAttackStat(game.player) * (values.burnDpsRatio ?? 0.2),
          burnStacks: 1
        });
        hound.attackTimer = values.attackInterval ?? 0.8;
      }
    }

    return true;
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

export function modifyDamageWithFingerBuild(game, amount, enemy, meta) {
  const build = game.activeFingerBuild;
  if (!build) return amount;

  let mult = 1;

  // 1. Stat-based Multipliers
  if (enemy.isElite) {
    mult *= getPlayerStat(game.player, "eliteDamage");
  }
  
  if (enemy.category === "Undead") {
    mult *= getPlayerStat(game.player, "undeadDamageMultiplier");
  }

  // 2. Main Mod Logic
  // Execute Bonus
  if (buildHasMod(build, "execute_bonus")) {
    if (enemy.hp / enemy.maxHp < 0.3) mult *= 1.5;
  }

  // Bleed Synergy
  if (buildHasMod(build, "bleed_synergy")) {
    if (enemy.state?.bleedTimer > 0) mult *= 1.2;
  }

  // Close Range Bonus
  if (buildHasMod(build, "close_range_damage")) {
    const dist = distance(game.player.x, game.player.y, enemy.x, enemy.y);
    if (dist < 120) mult *= 1.3;
  }

  return amount * mult;
}

export function handleFingerBuildMitigation(game, amount) {
  const build = game.activeFingerBuild;
  if (!build || !buildHasMod(build, "gold_mitigation")) return amount;

  const gold = game.gold || 0;
  if (gold <= 0) return amount;

  // Reduce damage by 20%
  const reduced = amount * 0.8;
  
  // Lose 1% gold
  const cost = Math.max(1, Math.floor(gold * 0.01));
  game.gold -= cost;

  return reduced;
}

/**
 * Recomputes runtime stat bonuses (Combo, Surge, Timers)
 */
export function applyFingerRuntimeStats(game) {
  const build = game.activeFingerBuild;
  const runtime = game.fingerBuildRuntime;
  if (!build || !runtime) return;

  const stats = {};

  // Combo: +5% dmg/crit per stack (up to 6 stacks = 30%)
  if (runtime.comboCount > 0) {
    stats.outgoingDamage = { multAdd: runtime.comboCount * 0.05 };
    stats.critChance = { add: runtime.comboCount * 0.05 };
  }

  // Surge: +30% move speed and damage
  if (runtime.surgeActiveUntil > game.time) {
    stats.moveSpeed = { multAdd: 0.3 };
    stats.outgoingDamage = { multAdd: 0.3 };
  }

  // Skill Followup: +40% dmg and crit
  if (runtime.skillFollowupActive) {
    stats.outgoingDamage = { multAdd: 0.4 };
    stats.critChance = { add: 0.4 };
  }

  // Periodic Empowerment: +50% dmg
  if (runtime.isEmpoweredReady) {
    stats.outgoingDamage = { multAdd: 0.5 };
  }

  // Gold Speed: +1% per 100g, cap 25%
  if (buildHasMod(build, "gold_scaling_speed")) {
    const goldBonus = Math.min(0.25, Math.floor((game.gold || 0) / 100) * 0.01);
    stats.moveSpeed = { multAdd: goldBonus };
  }

  // Missing Dash Scaling: +10% per missing charge
  if (buildHasMod(build, "dash_resource_scaling")) {
    const missing = Math.max(0, (game.player.maxDashCharges || 1) - (game.player.movement?.dashCharges || 0));
    stats.outgoingDamage = { multAdd: missing * 0.1 };
  }

  setPlayerStatSource(game.player, "finger_runtime", stats);
}

/**
 * Applies the build's aggregated stats to the player.
 */
export function applyFingerBuildStats(player, build) {
  setPlayerStatSource(player, "finger_build", build.combinedStats);
}

/**
 * Hook for logic based on mod presence.
 */
export function buildHasMod(build, modId) {
  if (build.mainGlobal?.id === modId) return true;
  if (build.secondaryGlobals.some(m => m.id === modId)) return true;
  if (build.heroMods.some(m => m.id === modId)) return true;
  if (build.curses.some(m => m.id === modId)) return true;
  return false;
}
