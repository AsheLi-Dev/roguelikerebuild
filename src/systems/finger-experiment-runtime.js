import { getModById } from '../data/finger-experiment-mods.js';
import { getEquippedFingers } from './finger-experiment-meta.js';
import { getPlayerStat, getPlayerAttackStat, setPlayerStatSource } from './player-stats.js';
import { getMaxDashCharges } from './rings.js';
import { createGoldDrop } from './gold.js';
import { applyStatusPayload } from './status-manager.js';

export function resolveModValue(mod, fixedValue = null) {
  if (mod && typeof mod.valueMin === 'number' && typeof mod.valueMax === 'number') {
    const resolvedValue = (fixedValue !== null) ? fixedValue : (mod.valueMin + Math.random() * (mod.valueMax - mod.valueMin));
    const newMod = { ...mod, value: resolvedValue };
    
    // Dynamically update description with the rolled value
    const percentage = Math.round((1 - newMod.value) * 100);
    const statToName = {
      moveSpeed: 'movement speed',
      globalDamage: 'damage',
      attackSpeed: 'attack speed',
      maxHp: 'max hp'
    };
    const statName = statToName[newMod.stat] || newMod.stat;
    newMod.description = `Reduces your ${statName} by ${percentage}%.`;
    
    return newMod;
  }
  return mod;
}

/**
 * Applies the Finger Experiment meta-progression to the current game session.
 * 
 * Aggregates all mods (Main, Aux, Hero, Curse) from equipped fingers.
 * Uses the stabilized schema: { mainMod, auxiliaryMod, heroMod, curseMod }
 */
export function applyFingerExperimentToRun(game) {
  if (!game || !game.player) return;

  const equipped = getEquippedFingers();
  const statAggregate = {};
  game.heroModState = {};
  game.resolvedFingerMods = {};
  
  // Initialize system-level state for Main mods
  game.fingerExperimentState = {
    activeMainMod: null,
    empoweredStrikeTimer: 0,
    empoweredStrikeReady: false,
    levelUpSpeedTimer: 0,
    chestHpGained: 0,
    lastHitWasCrit: false,
    hpDashBonusCharges: 0,
    critSustainTimer: 0,
    critSustainDrActive: false,
  };

  const equippedList = Object.values(equipped);
  if (equippedList.length === 0) {
    setPlayerStatSource(game.player, 'fingerExperiment', {});
    return;
  }

  const currentHeroId = game.heroDef?.id;

  for (const finger of equippedList) {
    const modSlots = ['mainMod', 'auxiliaryMod', 'heroMod', 'curseMod'];
    
    for (const slotKey of modSlots) {
      const modId = finger[slotKey];
      if (!modId) continue;

      let mod = getModById(modId);
      if (!mod) continue;
      
      const fixedValue = (slotKey === 'curseMod') ? finger.curseValue : null;
      mod = resolveModValue(mod, fixedValue);
      game.resolvedFingerMods[modId] = mod;

      // Special rule: Only ONE Main Mod can be active.
      if (slotKey === 'mainMod') {
        if (!game.fingerExperimentState.activeMainMod) {
          game.fingerExperimentState.activeMainMod = mod;
        } else {
          continue; // Ignore subsequent Main mods
        }
      }

      // Handle Stat-based mods (Main, Aux, Curse)
      if (mod.type === 'stat') {
        const statId = mod.stat;
        if (!statAggregate[statId]) {
          statAggregate[statId] = { add: 0, mult: 1, baseMult: 1 };
        }

        if (mod.op === 'add') {
          statAggregate[statId].add += mod.value || 0;
        } else if (mod.op === 'mult') {
          statAggregate[statId].mult *= mod.value || 1;
        }
      }
      
      // Handle Hero mods
      if (mod.type === 'hero' && mod.heroId === currentHeroId) {
        game.heroModState[mod.id] = {
          active: true,
          ...mod.effects
        };

        // Hero Stat Multipliers act as base multipliers
        if (mod.effects.attackSpeedMultiplier) {
          if (!statAggregate.attackSpeed) statAggregate.attackSpeed = { add: 0, mult: 1, baseMult: 1 };
          statAggregate.attackSpeed.baseMult *= mod.effects.attackSpeedMultiplier;
        }
      }
    }
  }

  // Final application to the player
  setPlayerStatSource(game.player, 'fingerExperiment', statAggregate);
}

const CHEST_MAX_HP_CAP = 100;
const CHEST_MAX_HP_PER_OPEN = 5;

/**
 * Called by openSearchable() in searchables.js when a chest is successfully opened.
 * Handles Chest Refund, Chest Healing, and Chest Max HP Scaling main mods.
 *
 * @param {object} game
 * @param {number} goldCost - Gold actually spent on this chest (0 if free)
 * @returns {{ refunded: number, healed: number, maxHpGained: number }}
 */
export function onFingerChestOpened(game, goldCost) {
  const result = { refunded: 0, healed: 0, maxHpGained: 0 };
  const mod = game.fingerExperimentState?.activeMainMod;
  if (!mod) return result;

  if (mod.id === 'main_chest_refund') {
    if (goldCost > 0 && Math.random() < 0.10) {
      const refund = goldCost;
      game.gold = (game.gold || 0) + refund;
      result.refunded = refund;
    }
  }

  if (mod.id === 'main_chest_healing') {
    const maxHp = getPlayerStat(game.player, 'maxHp');
    const healed = Math.min(10, maxHp - (game.player.hp || 0));
    if (healed > 0) {
      game.player.hp = (game.player.hp || 0) + healed;
      result.healed = healed;
    }
  }

  if (mod.id === 'main_chest_max_hp_scaling') {
    const state = game.fingerExperimentState;
    if (state.chestHpGained < CHEST_MAX_HP_CAP) {
      state.chestHpGained = Math.min(CHEST_MAX_HP_CAP, state.chestHpGained + CHEST_MAX_HP_PER_OPEN);
      setPlayerStatSource(game.player, 'finger_chest_hp', { maxHp: { add: state.chestHpGained } });
      result.maxHpGained = CHEST_MAX_HP_PER_OPEN;
    }
  }

  return result;
}

const LEVEL_UP_SPEED_BONUS = 1.20; // +20% move speed on level up
const LEVEL_UP_SPEED_DURATION = 3.0; // seconds

/**
 * Called by onLevelUp() in experience.js.
 * Handles Level Gold Burst and Level Up Sustain main mods.
 */
export function onFingerLevelUp(game) {
  const mod = game.fingerExperimentState?.activeMainMod;
  if (!mod) return;

  if (mod.id === 'main_level_gold_burst') {
    const level = game.player.level || 1;
    const totalGold = 100 * level;
    const dropCount = 8;
    const valuePerDrop = Math.ceil(totalGold / dropCount);
    const cx = game.player.x + game.player.w * 0.5;
    const cy = game.player.y + game.player.h * 0.5;
    for (let i = 0; i < dropCount; i++) {
      const angle = (i / dropCount) * Math.PI * 2;
      game.goldDrops.push(createGoldDrop({
        id: `gold_lvlburst_${Date.now()}_${i}`,
        type: 'elite',
        value: valuePerDrop,
        x: cx,
        y: cy,
        radius: 10,
        color: '#facc15',
        collectDelay: 0.25,
        lifetime: 18,
        burstAngle: angle,
        burstSpeed: 180 + Math.random() * 80,
        launchHeight: 20 + Math.random() * 10,
        launchVelocity: 200 + Math.random() * 100,
      }));
    }
  }

  if (mod.id === 'main_level_up_sustain') {
    // Heal 10% max HP
    const maxHp = getPlayerStat(game.player, 'maxHp');
    game.player.hp = Math.min((game.player.hp || 0) + maxHp * 0.10, maxHp);
    // Start the speed buff timer (re-arms on every level up, doesn't stack)
    game.fingerExperimentState.levelUpSpeedTimer = LEVEL_UP_SPEED_DURATION;
    setPlayerStatSource(game.player, 'finger_level_speed', {
      moveSpeed: { mult: LEVEL_UP_SPEED_BONUS }
    });
  }
}

/**
 * Called by damagePlayer() in combat.js.
 * Handles Hit Slow Field main mod.
 */
/**
 * Modifies incoming damage amount based on the active Main Mod.
 * Called in damagePlayer() after modifyIncomingPlayerDamage, before shield absorption.
 *
 * @param {object} game
 * @param {number} amount - Incoming damage amount
 * @returns {number} Modified damage amount
 */
export function applyFingerIncomingDamage(game, amount) {
  const mod = game.fingerExperimentState?.activeMainMod;
  if (!mod) return amount;

  if (mod.id === 'main_sprint_damage_reduction') {
    if ((game.player.movement?.sprintTimer || 0) > 0) {
      amount *= 0.70;
    }
  }

  if (mod.id === 'main_crit_sustain_window' && game.fingerExperimentState?.critSustainDrActive) {
    amount *= 0.80;
  }

  if (mod.id === 'main_gold_shield') {
    if ((game.gold || 0) > 0) {
      const consumed = Math.floor(game.gold * 0.01);
      if (consumed > 0) {
        game.gold -= consumed;
        amount = Math.max(0, amount - consumed * 0.10);
      }
    }
  }

  return amount;
}

export function onFingerPlayerDamaged(game) {
  const mod = game.fingerExperimentState?.activeMainMod;
  if (!mod || mod.id !== 'main_hit_slow_field') return;

  const px = game.player.x + game.player.w * 0.5;
  const py = game.player.y + game.player.h * 0.5;
  const enemies = game.getLivingEnemies?.() || game.enemies || [];

  for (const enemy of enemies) {
    if (enemy.dead) continue;
    const ex = enemy.x + enemy.w * 0.5;
    const ey = enemy.y + enemy.h * 0.5;
    const dist = Math.hypot(px - ex, py - ey);
    if (dist <= 150) {
      applyStatusPayload(enemy, { slowDuration: 2.0, slowMult: 0.30 });
    }
  }
}

/**
 * Called by damageEnemy() in combat.js when an enemy is killed.
 * Handles Minion Elite Conversion and resets lastHitWasCrit.
 *
 * @param {object} game
 * @param {object} enemy
 */
export function onFingerExperimentEnemyKilled(game, enemy) {
  const mod = game.fingerExperimentState?.activeMainMod;
  
  if (mod?.id === 'main_minion_elite_conversion') {
    // 10% chance to override drop tier to elite if it's a mob
    if (enemy.enemyTier === 'mob' && Math.random() < 0.10) {
      enemy.enemyTier = 'elite';
    }
  }

  // Reset crit flag for the next potential kill-event spawner (gold/xp)
  // This function is called before spawnGoldDropsForEnemy
}

/**
 * Applies outgoing damage multipliers from the active Main Mod.
 * Called inside damageEnemy() after crit resolution, before ring/resistance adjustments.
 * Only fires for player-sourced damage (not ring procs, DoT, or burn ticks).
 *
 * @param {object} game
 * @param {object} enemy - The enemy being damaged
 * @param {number} amount - Damage amount post-crit
 * @returns {number} Modified damage amount
 */
export function applyFingerOutgoingDamage(game, enemy, amount) {
  const mod = game.fingerExperimentState?.activeMainMod;
  if (!mod) return amount;

  switch (mod.id) {

    case 'main_execute_pressure': {
      // +50% damage to enemies below 30% HP
      if (enemy.maxHp > 0 && enemy.hp / enemy.maxHp < 0.30) {
        amount *= 1.50;
      }
      break;
    }

    case 'main_bleed_synergy': {
      // +20% damage to bleeding enemies.
      // Bleed lives on enemy.state (not status-manager) — written by knives skill, bleed finger, and crit-bleed ring.
      if ((enemy.state?.bleedStacks || 0) > 0 && (enemy.state?.bleedTimer || 0) > 0) {
        amount *= 1.20;
      }
      break;
    }

    case 'main_close_range_dominance': {
      // +30% damage to enemies within ~120px of the player
      const px = game.player.x + game.player.w * 0.5;
      const py = game.player.y + game.player.h * 0.5;
      const ex = enemy.x + enemy.w * 0.5;
      const ey = enemy.y + enemy.h * 0.5;
      const dist = Math.hypot(px - ex, py - ey);
      if (dist <= 120) {
        amount *= 1.30;
      }
      break;
    }

    case 'main_dash_consumption_power': {
      // +10% damage per missing dash charge
      const maxCharges = getMaxDashCharges(game);
      const currentCharges = game.player.movement?.dashCharges ?? maxCharges;
      const missing = Math.max(0, maxCharges - currentCharges);
      if (missing > 0) {
        amount *= (1 + missing * 0.10);
      }
      break;
    }

    default:
      break;
  }

  return amount;
}

/**
 * Called by damageEnemy() in combat.js when a critical hit is confirmed.
 * Handles Crit Recharge Dash and Critical Infliction main mods.
 *
 * @param {object} game
 * @param {object} enemy - The enemy that was critically hit
 */
export function onFingerCrit(game, enemy) {
  const mod = game.fingerExperimentState?.activeMainMod;
  if (!mod) return;

  if (mod.id === 'main_crit_recharge_dash') {
    const maxCharges = getMaxDashCharges(game);
    const current = game.player.movement?.dashCharges ?? 0;
    game.player.movement.dashCharges = Math.min(current + 2, maxCharges);
  }

  if (mod.id === 'main_critical_infliction') {
    const atk = getPlayerAttackStat(game.player);
    const statusDmg = Math.max(1, Math.round(atk * 0.20));
    const pick = ['burn', 'poison', 'bleed'][Math.floor(Math.random() * 3)];

    if (pick === 'burn') {
      applyStatusPayload(enemy, { burnDuration: 4, burnDamagePerSecond: statusDmg });
    } else if (pick === 'poison') {
      applyStatusPayload(enemy, { poisonDuration: 4, poisonDps: statusDmg });
    } else if (pick === 'bleed') {
      enemy.state ||= {};
      enemy.state.bleedStacks = Math.min(99, (enemy.state.bleedStacks || 0) + 1);
      enemy.state.bleedTimer = Math.max(enemy.state.bleedTimer || 0, 4);
      enemy.state.bleedTickTimer = Math.min(enemy.state.bleedTickTimer || 1, 1);
      enemy.state.bleedDamagePerStack = Math.max(enemy.state.bleedDamagePerStack || 0, statusDmg);
    }
  }

  if (mod.id === 'main_crit_sustain_window') {
    const state = game.fingerExperimentState;
    if (!state.critSustainDrActive) {
      state.critSustainTimer = 5.0;
      state.critSustainDrActive = true;
    }
  }
}

/**
 * Handles per-frame logic for special mods like Empowered Strike.
 */
export function updateFingerExperimentRuntime(game, dt) {
  const state = game.fingerExperimentState;
  if (!state || !state.activeMainMod) return;

  if (state.activeMainMod.id === 'main_empowered_strike') {
    if (!state.empoweredStrikeReady) {
      state.empoweredStrikeTimer -= dt;
      if (state.empoweredStrikeTimer <= 0) {
        state.empoweredStrikeReady = true;
      }
    }
  }

  // Level Up Sustain: tick the speed buff timer down and clear it on expiry
  if (state.levelUpSpeedTimer > 0) {
    state.levelUpSpeedTimer -= dt;
    if (state.levelUpSpeedTimer <= 0) {
      state.levelUpSpeedTimer = 0;
      setPlayerStatSource(game.player, 'finger_level_speed', {});
    }
  }

  // Crit Sustain Window: tick HoT and DR timer
  if (state.critSustainDrActive) {
    const maxHp = getPlayerStat(game.player, 'maxHp');
    game.player.hp = Math.min(maxHp, (game.player.hp || 0) + (0.05 * maxHp / 5) * dt);
    state.critSustainTimer -= dt;
    if (state.critSustainTimer <= 0) {
      state.critSustainTimer = 0;
      state.critSustainDrActive = false;
    }
  }

  // HP to Dash Scaling: extra dash charges = floor(maxHp / 100)
  if (state.activeMainMod.id === 'main_hp_to_dash_scaling') {
    state.hpDashBonusCharges = Math.floor(getPlayerStat(game.player, 'maxHp') / 100);
  } else {
    state.hpDashBonusCharges = 0;
  }

  // Gold to Movement Speed: +1% move speed per 100 gold (only recompute when gold changes)
  if (state.activeMainMod.id === 'main_gold_to_move_speed') {
    const currentGold = game.gold || 0;
    if (currentGold !== state._lastGoldForSpeed) {
      state._lastGoldForSpeed = currentGold;
      const bonus = currentGold / 100 * 0.01;
      setPlayerStatSource(game.player, 'finger_gold_speed', { moveSpeed: { mult: 1 + bonus } });
    }
  }
}
