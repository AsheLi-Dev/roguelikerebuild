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
    id: "necro_chained_execution",
    name: "Chained Execution",
    category: "hero",
    heroId: "dark_mage",
    tags: ["execute", "assist", "burst"],
    type: "hero",
    description: "When the execution is triggered in the assist attack, the next tick deals an extra 80% ATK damage.",
    effects: { executionBonusDamageScale: 0.8 }
  },
  {
    id: "necro_assassin_spirit",
    name: "Assassin Spirit",
    category: "hero",
    heroId: "dark_mage",
    tags: ["summon", "assassin", "teleport", "execute"],
    type: "hero",
    description: "Your Spirit hunts low-health enemies, teleporting to strike with high-damage, short-range fireballs (200% ATK, 100px range).",
    effects: {
      hpThreshold: 0.5,
      teleportToTarget: true,
      autonomousBehavior: true,
      targetingRange: 100,
      projectileRange: 100,
      damageMultiplier: 2.0
    }
  },
  {
    id: "necro_channel_beam",
    name: "Channel Beam",
    category: "hero",
    modType: "hero",
    heroId: "dark_mage",
    tags: ["beam", "channel", "ramp", "range", "mobility_penalty"],
    type: "hero",
    description: "Your beam becomes a continuous channel that grows stronger and longer over time, but slows you while active.",
    effects: {
      beamMode: "channel",
      startingDpsMultiplier: 0.4,
      maxDpsMultiplier: 1.4,
      rampDuration: 2.0,
      startRangePx: 160,
      maxRangePx: 280,
      movementSpeedMultiplierWhileChanneling: 0.6
    }
  },
  {
    id: "necro_guardian_spirit",
    name: "Guardian Spirit (V1)",
    category: "hero",
    modType: "hero",
    heroId: "dark_mage",
    tags: ["summon", "aoe", "control", "knockback"],
    type: "hero",
    description: "Your Spirit becomes a guardian, using a shockwave similar to Ice Nova.",
    effects: {
      useIceNovaBehavior: true
    }
  },
  {
    id: "necro_spirit_dash_curse",
    name: "Spirit Dash Curse",
    category: "hero",
    modType: "hero",
    heroId: "dark_mage",
    tags: ["movement", "debuff", "curse", "contact"],
    type: "hero",
    description: "Your spirit form movement curses and slows enemies you pass through. Each new enemy slowed increases dash duration by 0.2s (up to 1s).",
    effects: {
      slowMultiplier: 0.3,
      slowDuration: 2.0,
      applyCurse: true
    }
  },
  {
    id: "hero_ice_thunder_core",
    name: "Ice-Thunder Core",
    category: "hero",
    heroId: "element_mage",
    tags: ["fire", "ice", "lightning", "orb", "detonate", "conversion"],
    type: "hero",
    description: "You no longer cast Ice Projectiles directly. Lightning Orb emits Ice Projectiles, and Fire Breath detonation triggers a Steam Explosion that blinds and bursts Ice Projectiles outward.",
    effects: {
      removeDirectIceProjectile: true,
      orbIceProjectileInterval: 0.8,
      detonationSteamExplosionRadiusPx: 100,
      detonationSteamExplosionDamageMultiplier: 0.8,
      blindDuration: 2.5,
      detonationIceProjectileCount: 8,
      detonationIceProjectileDamageMultiplier: 0.7
    }
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
  },
  {
    id: "hero_ice_nova_frost_pursuit",
    name: "Frost Pursuit",
    category: "hero",
    heroId: "element_mage",
    tags: ["ice", "nova", "projectile", "trigger"],
    type: "hero",
    description: "Ice Nova fires an ice projectile at each enemy it hits.",
    effects: {
      projectilesPerTarget: 1,
      maxProjectilesPerCast: 8,
      damageMultiplier: 0.85
    }
  },
  {
    id: "elem_returning_ice",
    name: "Returning Ice",
    category: "hero",
    heroId: "element_mage",
    tags: ["ice", "projectile", "boomerang"],
    type: "hero",
    description: "Ice projectiles pierce enemies and return to you at double speed.",
    effects: {
      isBoomerang: true,
      pierce: 99
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
