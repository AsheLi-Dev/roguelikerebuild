/**
 * Finger Experiment - Auxiliary Mod Pool
 * 
 * SANITY CHECK: Only using stats that exist in player-stats.js or mapping them safely.
 */

export const AUXILIARY_MOD_POOL = [
  // --- ATTACK ---
  { 
    id: 'aux_attack_speed_8', 
    name: 'Quickened Pulse', 
    category: 'attack',
    tags: ['attack', 'tempo'],
    type: 'stat', 
    stat: 'attackSpeed', 
    op: 'mult', 
    value: 1.08, 
    description: '+8% Attack Speed' 
  },
  { 
    id: 'aux_crit_chance_8', 
    name: 'Precision', 
    category: 'attack',
    tags: ['attack', 'crit'],
    type: 'stat', 
    stat: 'critChance', 
    op: 'add', 
    value: 0.08, 
    description: '+8% Crit Chance' 
  },
  { 
    id: 'aux_crit_damage_20', 
    name: 'Lethal Force', 
    category: 'attack',
    tags: ['attack', 'crit'],
    type: 'stat', 
    stat: 'critDamage', 
    op: 'add', 
    value: 0.20, 
    description: '+20% Crit Damage' 
  },
  { 
    id: 'aux_dot_damage_20', 
    name: 'Corrosive Touch', 
    category: 'attack',
    tags: ['attack', 'dot'],
    type: 'stat', 
    stat: 'globalDamage', // Remapped from dotDamage for safety
    op: 'mult', 
    value: 1.20, 
    description: '+20% DoT Damage (Applied as Global)' 
  },
  { 
    id: 'aux_elite_damage_15', 
    name: 'Giant Slayer', 
    category: 'attack',
    tags: ['attack', 'elite'],
    type: 'stat', 
    stat: 'globalDamage', // Remapped from eliteDamage for safety
    op: 'mult', 
    value: 1.15, 
    description: '+15% Damage to Elites (Applied as Global)' 
  },

  // --- SURVIVAL ---
  { 
    id: 'aux_max_hp_15', 
    name: 'Fortitude', 
    category: 'survival',
    tags: ['defense', 'sustain'],
    type: 'stat', 
    stat: 'maxHp', 
    op: 'add', 
    value: 15, 
    description: '+15 Max HP' 
  },
  { 
    id: 'aux_projectile_damage_taken_down_10', 
    name: 'Deflection', 
    category: 'survival',
    tags: ['defense'],
    type: 'stat', 
    stat: 'damageTaken', // Remapped from incomingProjectileDamage
    op: 'mult', 
    value: 0.90, 
    description: '-10% Damage Taken' 
  },
  { 
    id: 'aux_sprint_speed_12', 
    name: 'Wind Runner', 
    category: 'survival',
    tags: ['mobility'],
    type: 'stat', 
    stat: 'moveSpeed', // Remapped from sprintSpeed
    op: 'mult', 
    value: 1.12, 
    description: '+12% Movement Speed' 
  },
  { 
    id: 'aux_healing_10', 
    name: 'Rejuvenation', 
    category: 'survival',
    tags: ['sustain'],
    type: 'stat', 
    stat: 'healingEffectiveness', 
    op: 'mult', 
    value: 1.10, 
    description: '+10% Healing Effectiveness' 
  },
  { 
    id: 'aux_nearby_damage_reduction_10', 
    name: 'Close Guard', 
    category: 'survival',
    tags: ['defense'],
    type: 'stat', 
    stat: 'damageTaken', // Remapped from nearbyDamageReduction
    op: 'mult', 
    value: 0.90, 
    description: '-10% Damage Taken (Nearby)' 
  },

  // --- ECONOMY ---
  { 
    id: 'aux_free_first_chest', 
    name: 'Locksmith', 
    category: 'economy',
    tags: ['gold', 'luck'],
    type: 'special', 
    description: 'First chest in each biome is free' 
  },
  { 
    id: 'aux_xp_gain_50_penalty', 
    name: 'Risky Wisdom', 
    category: 'economy',
    tags: ['xp'],
    type: 'special', 
    description: '+50% XP gained, lose 5% current XP when damaged (2s CD)' 
  },
  { 
    id: 'aux_crit_gold_40', 
    name: 'Bounty Hunter', 
    category: 'economy',
    tags: ['gold', 'crit'],
    type: 'special', 
    description: 'Enemies killed by crit drop +40% gold' 
  },
  { 
    id: 'aux_level_gold', 
    name: 'Scholarship', 
    category: 'economy',
    tags: ['gold', 'xp'],
    type: 'special', 
    description: 'Level up grants gold based on current level' 
  },
];

export function getModById(id) {
  return AUXILIARY_MOD_POOL.find(m => m.id === id);
}
