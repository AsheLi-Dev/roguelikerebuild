import { getModById } from '../data/finger-experiment-mods.js';
import { getEquippedFingers } from './finger-experiment-meta.js';
import { setPlayerStatSource } from './player-stats.js';

/**
 * Applies the Finger Experiment meta-progression to the current game session.
 * 
 * Aggregates all auxiliary mods from equipped fingers.
 * 
 * @param {object} game The RoguelikeGame instance
 */
export function applyFingerExperimentToRun(game) {
  if (!game || !game.player) return;

  const equipped = getEquippedFingers();
  const aggregate = {
    // Stat contribution object compatible with player-stats.js
  };

  const equippedList = Object.values(equipped);
  if (equippedList.length === 0) {
    // Clear any previous source if empty
    setPlayerStatSource(game.player, 'fingerExperiment', {});
    return;
  }

  for (const finger of equippedList) {
    if (!finger.mods) continue;

    const modId = finger.mods.auxiliaryModId;
    if (!modId) continue;

    const mod = getModById(modId);
    if (!mod) continue;

    // Handle standard stat mods
    if (mod.type === 'stat') {
      const statId = mod.stat;
      if (!aggregate[statId]) {
        aggregate[statId] = { add: 0, mult: 1 };
      }

      if (mod.op === 'add') {
        aggregate[statId].add += mod.value || 0;
      } else if (mod.op === 'mult') {
        // Multipliers stack multiplicatively (e.g. 1.08 * 1.08)
        aggregate[statId].mult *= mod.value || 1;
      }
    }
    
    // TODO: Handle 'special' mods via additive hooks in their respective systems
    // Examples: 'Locksmith', 'Risky Wisdom', 'Bounty Hunter', 'Scholarship'
  }

  // Apply to player stats
  setPlayerStatSource(game.player, 'fingerExperiment', aggregate);
}
