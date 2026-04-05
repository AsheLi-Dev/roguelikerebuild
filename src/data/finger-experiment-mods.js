/**
 * Finger Experiment - Mod Pools
 * 
 * Pilot Phase: Exactly one Main Mod, one Hero Mod, and empty Curse pool.
 */

export const MAIN_MOD_POOL = [
  { 
    id: 'main_empowered_strike', 
    name: 'Empowered Strike', 
    category: 'main', 
    type: 'special', 
    description: 'Every 3 seconds, your next attack deals +50% damage.' 
  }
];

export const AUXILIARY_MOD_POOL = [
  { id: 'aux_attack_speed_8', name: 'Quickened Pulse', category: 'auxiliary', tags: ['attack', 'tempo'], type: 'stat', stat: 'attackSpeed', op: 'mult', value: 1.08, description: '+8% Attack Speed' },
  { id: 'aux_crit_chance_8', name: 'Precision', category: 'auxiliary', tags: ['attack', 'crit'], type: 'stat', stat: 'critChance', op: 'add', value: 0.08, description: '+8% Crit Chance' },
  { id: 'aux_crit_damage_20', name: 'Lethal Force', category: 'auxiliary', tags: ['attack', 'crit'], type: 'stat', stat: 'critDamage', op: 'add', value: 0.20, description: '+20% Crit Damage' },
  { id: 'aux_max_hp_15', name: 'Fortitude', category: 'auxiliary', tags: ['defense', 'sustain'], type: 'stat', stat: 'maxHp', op: 'add', value: 15, description: '+15 Max HP' },
  { id: 'aux_move_speed_12', name: 'Wind Runner', category: 'auxiliary', tags: ['mobility'], type: 'stat', stat: 'moveSpeed', op: 'mult', value: 1.12, description: '+12% Movement Speed' },
  { id: 'aux_healing_10', name: 'Rejuvenation', category: 'auxiliary', tags: ['sustain'], type: 'stat', stat: 'healingEffectiveness', op: 'mult', value: 1.10, description: '+10% Healing Effectiveness' },
];

export const HERO_MOD_POOL = [
  {
    id: "necro_twin_spirits",
    name: "Twin Spirits",
    category: "hero",
    heroId: "dark_mage",
    tags: ["summon", "multi_spirit"],
    type: "hero",
    description: "You summon 2 Spirits, but each Spirit deals 30% less damage.",
    effects: { spiritCount: 2, perSpiritDamageMultiplier: 0.7 }
  },
  {
    id: "dk_piercing_stance",
    name: "Piercing Stance",
    category: "hero",
    heroId: "death_knight",
    tags: ["melee", "precision", "thrust"],
    type: "hero",
    description: "Your attacks become thrusts with increased range and speed, but reduced width.",
    effects: {
      attackSpeedMultiplier: 1.2,
      rangeMultiplier: 1.35,
      widthMultiplier: 0.5,
      attackShape: "thrust",
      waveSlashShape: "forward_line"
    }
  },
  {
    id: "dk_grasp_of_the_legion",
    name: "Grasp of the Legion",
    category: "hero",
    heroId: "death_knight",
    tags: ["mobility", "hook", "pull", "control"],
    type: "hero",
    description: "Death Grip fires 2 additional chains and pulls enemies to you instead of pulling you to them.",
    effects: {
      additionalChains: 2,
      totalChains: 3,
      enemyHitMode: "pull_enemy_to_player",
      terrainHitMode: "pull_player_to_terrain",
      slowMultiplier: 0.7, // 30% slow = 0.7 multiplier
      slowDuration: 1.5
    }
  }
];

export const CURSE_MOD_POOL = [
  { 
    id: 'curse_fragile', 
    name: 'Brittle', 
    category: 'curse', 
    type: 'stat', 
    stat: 'maxHp', 
    op: 'mult', 
    value: 0.90, 
    description: '-10% Max HP' 
  }
];

export function getModById(id) {
  return [...MAIN_MOD_POOL, ...AUXILIARY_MOD_POOL, ...HERO_MOD_POOL, ...CURSE_MOD_POOL].find(m => m.id === id);
}
