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
  },

  // ─── ATTACK MAIN MODS (data only – not yet implemented) ───────────────────

  {
    id: 'main_critical_infliction',
    name: 'Critical Infliction',
    category: 'main',
    group: 'attack',
    type: 'special',
    implemented: true,
    tags: ['attack', 'crit', 'debuff'],
    description: 'Critically hitting an enemy applies one random stack of Bleed, Burning, or Poison.',
    effects: {
      onCrit: { applyRandomDebuff: ['bleed', 'burning', 'poison'], stacks: 1 }
    }
  },
  {
    id: 'main_skill_followup_strike',
    name: 'Skill Follow-up Strike',
    category: 'main',
    group: 'attack',
    type: 'special',
    implemented: false,
    tags: ['attack', 'skill', 'follow_up'],
    description: 'Your next attack after using a skill gains +40% damage and +40% crit chance.',
    effects: {
      afterSkill: { damageBonus: 0.40, critChanceBonus: 0.40, duration: 'next_attack' }
    }
  },
  {
    id: 'main_combo_scaling',
    name: 'Combo Scaling',
    category: 'main',
    group: 'attack',
    type: 'special',
    implemented: false,
    tags: ['attack', 'combo', 'crit'],
    description: 'Consecutive attacks grant +5% damage and +5% crit chance per stack, up to +30% total.',
    effects: {
      perConsecutiveAttack: { damageBonus: 0.05, critChanceBonus: 0.05 },
      maxStacks: 6
    }
  },
  {
    id: 'main_dash_consumption_power',
    name: 'Dash Consumption Power',
    category: 'main',
    group: 'attack',
    type: 'special',
    implemented: true,
    tags: ['attack', 'dash', 'scaling'],
    description: 'Gain +10% damage for each missing dash charge.',
    effects: {
      perMissingDashCharge: { damageBonus: 0.10 }
    }
  },
  {
    id: 'main_execute_pressure',
    name: 'Execute Pressure',
    category: 'main',
    group: 'attack',
    type: 'special',
    implemented: true,
    tags: ['attack', 'execute'],
    description: 'Deal +50% damage to enemies below 30% HP.',
    effects: {
      vsEnemyHpBelow: 0.30,
      damageBonus: 0.50
    }
  },
  {
    id: 'main_bleed_synergy',
    name: 'Bleed Synergy',
    category: 'main',
    group: 'attack',
    type: 'special',
    implemented: true,
    tags: ['attack', 'bleed', 'synergy'],
    description: 'Deal +20% damage to bleeding enemies.',
    effects: {
      vsBleedingEnemies: { damageBonus: 0.20 }
    }
  },
  {
    id: 'main_close_range_dominance',
    name: 'Close Range Dominance',
    category: 'main',
    group: 'attack',
    type: 'special',
    implemented: true,
    tags: ['attack', 'close_range'],
    description: 'Deal +30% damage to nearby enemies.',
    effects: {
      nearbyDamageBonus: 0.30
    }
  },
  {
    id: 'main_killing_spree',
    name: 'Killing Spree',
    category: 'main',
    group: 'attack',
    type: 'special',
    implemented: false,
    tags: ['attack', 'kill_chain', 'tempo'],
    description: 'After killing 6 enemies within 1 second, gain +30% movement speed and +30% damage for 4s.',
    effects: {
      killsRequired: 6,
      timeWindow: 1.0,
      onTrigger: { moveSpeedBonus: 0.30, damageBonus: 0.30, duration: 4.0 }
    }
  },
  {
    id: 'main_debuff_amplifier',
    name: 'Debuff Amplifier',
    category: 'main',
    group: 'attack',
    type: 'special',
    implemented: false,
    tags: ['attack', 'debuff', 'dot'],
    description: 'Damage-over-time and damage debuffs you apply deal +50% extra damage.',
    effects: {
      dotDamageBonus: 0.50
    }
  },

  // ─── SURVIVAL MAIN MODS (data only – not yet implemented) ─────────────────

  {
    id: 'main_crit_recharge_dash',
    name: 'Crit Recharge Dash',
    category: 'main',
    group: 'survival',
    type: 'special',
    implemented: true,
    tags: ['survival', 'crit', 'dash'],
    description: 'Critical hits restore 2 dash charges.',
    effects: {
      onCrit: { restoreDashCharges: 2 }
    }
  },
  {
    id: 'main_sprint_damage_reduction',
    name: 'Sprint Damage Reduction',
    category: 'main',
    group: 'survival',
    type: 'special',
    implemented: true,
    tags: ['survival', 'sprint', 'mitigation'],
    description: 'While sprinting, take 30% less damage.',
    effects: {
      whileSprinting: { damageReduction: 0.30 }
    }
  },
  {
    id: 'main_chest_healing',
    name: 'Chest Healing',
    category: 'main',
    group: 'survival',
    type: 'special',
    implemented: true,
    tags: ['survival', 'chest', 'healing'],
    description: 'Opening a chest restores 10 HP.',
    effects: {
      onChestOpen: { healAmount: 10 }
    }
  },
  {
    id: 'main_hit_slow_field',
    name: 'Hit Slow Field',
    category: 'main',
    group: 'survival',
    type: 'special',
    implemented: true,
    tags: ['survival', 'on_hit', 'slow'],
    description: 'When you take damage, nearby enemies are slowed by 70% for 2s.',
    effects: {
      onTakeDamage: { nearbySlowMultiplier: 0.30, slowDuration: 2.0 }
    }
  },
  {
    id: 'main_hp_to_dash_scaling',
    name: 'HP to Dash Scaling',
    category: 'main',
    group: 'survival',
    type: 'special',
    implemented: true,
    tags: ['survival', 'hp', 'dash'],
    description: 'Gain +1 dash charge for every 100 maximum HP.',
    effects: {
      perMaxHp: 100,
      extraDashCharges: 1
    }
  },
  {
    id: 'main_crit_sustain_window',
    name: 'Crit Sustain Window',
    category: 'main',
    group: 'survival',
    type: 'special',
    implemented: true,
    tags: ['survival', 'crit', 'heal', 'mitigation'],
    description: 'After a critical hit, recover 5% max HP over 5s and gain 20% damage reduction. Cannot stack.',
    effects: {
      onCrit: {
        healOverTime: { percentMaxHp: 0.05, duration: 5.0 },
        damageReduction: 0.20,
        stacks: false
      }
    }
  },
  {
    id: 'main_slide_replacement',
    name: 'Slide Replacement',
    category: 'main',
    group: 'survival',
    type: 'special',
    implemented: false,
    tags: ['survival', 'mobility', 'dash_replace'],
    description: 'Dash is replaced by a slide. Slide speed +50%, slide distance +50%.',
    effects: {
      replaceDashWithSlide: true,
      slideSpeedMultiplier: 1.50,
      slideDistanceMultiplier: 1.50
    }
  },
  {
    id: 'main_chest_max_hp_scaling',
    name: 'Chest Max HP Scaling',
    category: 'main',
    group: 'survival',
    type: 'special',
    implemented: true,
    tags: ['survival', 'chest', 'hp_scaling'],
    description: 'Opening chests grants +5 max HP, up to +100 max HP total.',
    effects: {
      onChestOpen: { maxHpGain: 5, cap: 100 }
    }
  },
  {
    id: 'main_level_up_sustain',
    name: 'Level Up Sustain',
    category: 'main',
    group: 'survival',
    type: 'special',
    implemented: true,
    tags: ['survival', 'level_up', 'heal', 'speed'],
    description: 'On level up, restore 10% max HP and gain a movement speed bonus for 3s.',
    effects: {
      onLevelUp: { healPercentMaxHp: 0.10, moveSpeedBonusDuration: 3.0 }
    }
  },
  {
    id: 'main_gold_shield',
    name: 'Gold Shield',
    category: 'main',
    group: 'survival',
    type: 'special',
    implemented: true,
    tags: ['survival', 'gold', 'mitigation'],
    description: 'When taking damage, consume 1% of current gold to reduce incoming damage by 10% of that consumed amount.',
    effects: {
      onTakeDamage: { consumeGoldPercent: 0.01, damageReductionPerGoldConsumed: 0.10 }
    }
  },
  {
    id: 'main_gold_to_move_speed',
    name: 'Gold to Movement Speed',
    category: 'main',
    group: 'survival',
    type: 'special',
    implemented: true,
    tags: ['survival', 'gold', 'speed_scaling'],
    description: 'Gain +1% movement speed per 100 gold held.',
    effects: {
      perGold: 100,
      moveSpeedBonus: 0.01
    }
  },

  // ─── ECONOMY MAIN MODS (data only – not yet implemented) ──────────────────

  {
    id: 'main_chest_refund',
    name: 'Chest Refund',
    category: 'main',
    group: 'economy',
    type: 'special',
    implemented: true,
    tags: ['economy', 'chest', 'refund'],
    description: 'Opening a chest has a 10% chance to refund 100% of the cost.',
    effects: {
      onChestOpen: { refundChance: 0.10, refundPercent: 1.00 }
    }
  },
  {
    id: 'main_free_first_chest',
    name: 'Free First Chest',
    category: 'main',
    group: 'economy',
    type: 'special',
    implemented: false,
    tags: ['economy', 'chest', 'biome'],
    description: 'The first chest in each biome is free.',
    effects: {
      firstChestPerBiome: { free: true }
    }
  },
  {
    id: 'main_minion_elite_conversion',
    name: 'Minion Elite Conversion',
    category: 'main',
    group: 'economy',
    type: 'special',
    implemented: true,
    tags: ['economy', 'loot', 'elite'],
    description: 'Minion enemies you kill have a 10% chance to count as Elite for loot purposes.',
    effects: {
      onMinionKill: { eliteConversionChance: 0.10 }
    }
  },
  {
    id: 'main_crit_gold_drop',
    name: 'Crit Gold Drop',
    category: 'main',
    group: 'economy',
    type: 'special',
    implemented: true,
    tags: ['economy', 'crit', 'gold'],
    description: 'Enemies killed by critical-hit damage drop +40% gold.',
    effects: {
      onCritKill: { goldDropBonus: 0.40 }
    }
  },
  {
    id: 'main_xp_to_gold_conversion',
    name: 'XP to Gold Conversion',
    category: 'main',
    group: 'economy',
    type: 'special',
    implemented: true,
    tags: ['economy', 'xp', 'gold_conversion'],
    description: 'You no longer gain XP from experience orbs. Picking up experience orbs grants +10 gold instead.',
    effects: {
      disableXpGain: true,
      onXpOrbPickup: { goldGain: 10 }
    }
  },
  {
    id: 'main_xp_risk_reward',
    name: 'XP Risk-Reward',
    category: 'main',
    group: 'economy',
    type: 'special',
    implemented: true,
    tags: ['economy', 'xp', 'risk_reward'],
    description: 'Gain +50% XP. Taking damage causes you to lose 10% current XP.',
    effects: {
      xpGainMultiplier: 1.50,
      onTakeDamage: { loseCurrentXpPercent: 0.10 }
    }
  },
  {
    id: 'main_level_gold_burst',
    name: 'Level Gold Burst',
    category: 'main',
    group: 'economy',
    type: 'special',
    implemented: true,
    tags: ['economy', 'level_up', 'gold'],
    description: 'On level up, gain 100 × current level gold.',
    effects: {
      onLevelUp: { goldGain: '100 * currentLevel' }
    }
  },
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
  },
  {
    id: "mage_dash_orb_spawn",
    modType: "hero",
    heroId: "element_mage",
    tags: ["movement", "lightning", "orb", "setup"],
    type: "hero",
    description: "Your Lightning Dash leaves behind static Lightning Orbs.",
    effects: {
      orbCount: 2
    }
  },
  {
    id: "mage_full_fire_conversion",
    modType: "hero",
    heroId: "element_mage",
    tags: ["fire", "conversion", "burning", "stacking"],
    type: "hero",
    description: "Ice is replaced by fire, Lightning Orb becomes Sun Orb, and your Burning stacks infinitely but each stack is weaker.",
    effects: {
      replaceIceProjectileWithFireball: true,
      replaceLightningOrbWithSunOrb: true,
      burningDuration: 3.0,
      burningUnlimitedStacks: true,
      burningPerStackDamageMultiplier: 1.0,
      fireballHitsSunOrbSplits: true,
      sunOrbSplitProjectileCount: 8,
      sunOrbSplitProjectileDamageMultiplier: 0.7,
      fireBreathDetonatesSunOrbIntoFireballBurst: true,
      sunOrbDetonationFireballCount: 8
    }
  }
];

export const CURSE_MOD_POOL = [
  {
    id: 'curse_sluggish',
    name: 'Sluggish',
    category: 'curse',
    modType: 'curse',
    type: 'stat',
    tags: ['stat', 'movement'],
    description: 'A permanent curse that reduces your movement speed. The exact reduction is determined when the finger is crafted (5-10%).',
    stat: 'moveSpeed',
    op: 'mult',
    valueMin: 0.90,
    valueMax: 0.95
  },
  {
    id: 'curse_weakened',
    name: 'Weakened',
    category: 'curse',
    modType: 'curse',
    type: 'stat',
    tags: ['stat', 'damage'],
    description: 'A permanent curse that reduces your damage. The exact reduction is determined when the finger is crafted (5-10%).',
    stat: 'globalDamage',
    op: 'mult',
    valueMin: 0.90,
    valueMax: 0.95
  },
  {
    id: 'curse_lethargic',
    name: 'Lethargic',
    category: 'curse',
    modType: 'curse',
    type: 'stat',
    tags: ['stat', 'attack speed'],
    description: 'A permanent curse that reduces your attack speed. The exact reduction is determined when the finger is crafted (5-10%).',
    stat: 'attackSpeed',
    op: 'mult',
    valueMin: 0.90,
    valueMax: 0.95
  },
  {
    id: 'curse_frail',
    name: 'Frail',
    category: 'curse',
    modType: 'curse',
    type: 'stat',
    tags: ['stat', 'health'],
    description: 'A permanent curse that reduces your max hp. The exact reduction is determined when the finger is crafted (5-10%).',
    stat: 'maxHp',
    op: 'mult',
    valueMin: 0.90,
    valueMax: 0.95
  }
];

export function getModById(id) {
  return [...MAIN_MOD_POOL, ...AUXILIARY_MOD_POOL, ...HERO_MOD_POOL, ...CURSE_MOD_POOL].find(m => m.id === id);
}
