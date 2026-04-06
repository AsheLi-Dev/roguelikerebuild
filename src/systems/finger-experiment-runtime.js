import { getModById } from '../data/finger-experiment-mods.js';
import { getEquippedFingers } from './finger-experiment-meta.js';
import { setPlayerStatSource } from './player-stats.js';

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
    empoweredStrikeReady: false
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
}
