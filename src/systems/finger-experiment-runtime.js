import { getModById } from '../data/finger-experiment-mods.js';
import { getEquippedFingers } from './finger-experiment-meta.js';
import { getPlayerStat, setPlayerStatSource } from './player-stats.js';
import { getMaxDashCharges } from './rings.js';
import { createGoldDrop } from './gold.js';

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
}
