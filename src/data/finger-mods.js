/**
 * REGISTRY OF ALL FINGER MODS
 * 
 * Each mod belongs to one of 4 slots:
 * 1. MAIN_GLOBAL: Build-defining anchor (1 active).
 * 2. SECONDARY_GLOBAL: Stat/Utility smoothing (All 4 active).
 * 3. HERO_MOD: Skill mutations (All 4 active).
 * 4. CURSE: Tactical constraints (1-2 active).
 */

export const MAIN_GLOBAL_MODS = Object.freeze({
  // --- Offensive ---
  crit_status: {
    id: "crit_status",
    name: "Elemental Critical",
    description: "Critical strikes apply a random debuff: Bleed, Burn, or Poison.",
    tags: ["combat", "debuff"],
    hooks: { onCrit: "apply_random_status" }
  },
  skill_followup: {
    id: "skill_followup",
    name: "Skill Resonance",
    description: "After using a skill, your next attack deals +40% damage and has +40% Crit Chance.",
    tags: ["combat", "skill"],
    hooks: { onSkillUse: "empower_next_attack" }
  },
  combo_scaling: {
    id: "combo_scaling",
    name: "Rhythm of War",
    description: "Consecutive attacks grant +5% DMG and +5% Crit Chance per stack (up to +30%). Resets on pause.",
    tags: ["combat", "ramp"],
    hooks: { onAttack: "increment_combo" }
  },
  dash_resource_scaling: {
    id: "dash_resource_scaling",
    name: "Momentum Transfer",
    description: "Gain +10% damage per missing Dash Charge.",
    tags: ["mobility", "damage"],
    hooks: { onUpdate: "apply_dash_dmg_scaling" }
  },
  execute_bonus: {
    id: "execute_bonus",
    name: "Executioner",
    description: "Deal +50% damage to enemies below 30% HP.",
    tags: ["combat", "finisher"],
    hooks: { onCalculateDamage: "apply_execute_bonus" }
  },
  bleed_synergy: {
    id: "bleed_synergy",
    name: "Bloodthirst",
    description: "Deal +20% damage to Bleeding enemies.",
    tags: ["combat", "synergy"],
    hooks: { onCalculateDamage: "apply_bleed_synergy" }
  },
  periodic_empowerment: {
    id: "periodic_empowerment",
    name: "Focused Strike",
    description: "Every 3 seconds, your next attack deals +50% damage.",
    tags: ["combat", "timed"],
    hooks: { onUpdate: "handle_periodic_empowerment" }
  },
  close_range_damage: {
    id: "close_range_damage",
    name: "Point Blank",
    description: "Deal +30% damage to nearby enemies.",
    tags: ["combat", "range"],
    hooks: { onCalculateDamage: "apply_close_range_bonus" }
  },
  kill_streak_surge: {
    id: "kill_streak_surge",
    name: "Berserker's Rush",
    description: "Killing 6 enemies within 1s grants +30% Move Speed and Damage for 4s.",
    tags: ["combat", "utility"],
    hooks: { onKill: "track_kill_streak" }
  },
  debuff_amplification: {
    id: "debuff_amplification",
    name: "Catalyst",
    description: "Damage-over-time effects you apply deal +50% increased damage.",
    tags: ["combat", "debuff"],
    stats: { dotDamageMultiplier: { multAdd: 0.50 } }
  },
  // --- Survival ---
  gold_mitigation: {
    id: "gold_mitigation",
    name: "Gilded Guard",
    description: "When hit, lose 1% gold to reduce incoming damage by 20% (Max 50%).",
    tags: ["survival", "gold"],
    hooks: { onTakeDamage: "apply_gold_mitigation" }
  },
  gold_scaling_speed: {
    id: "gold_scaling_speed",
    name: "Greed's Pace",
    description: "Gain +1% movement speed per 100 gold (Capped at +25%).",
    tags: ["mobility", "gold"],
    hooks: { onUpdate: "apply_gold_speed_scaling" }
  }
});

export const SECONDARY_GLOBAL_MODS = Object.freeze({
  // --- Offensive ---
  attack_speed: {
    id: "attack_speed",
    name: "Quickness",
    description: "Gain +Attack Speed.",
    tags: ["combat", "speed"],
    valueRange: { min: 0.05, max: 0.10, stat: "attackSpeed", op: "multAdd" }
  },
  crit_chance: {
    id: "crit_chance",
    name: "Precision",
    description: "Gain +Critical Strike Chance.",
    tags: ["combat", "precision"],
    valueRange: { min: 0.05, max: 0.10, stat: "critChance", op: "add" }
  },
  crit_damage: {
    id: "crit_damage",
    name: "Ferocity",
    description: "Gain +Critical Strike Damage.",
    tags: ["combat", "ferocity"],
    valueRange: { min: 0.15, max: 0.20, stat: "critDamage", op: "multAdd" }
  },
  elite_damage: {
    id: "elite_damage",
    name: "Giant Slayer",
    description: "Deal increased damage to Elite enemies.",
    tags: ["combat", "elite"],
    valueRange: { min: 0.10, max: 0.15, stat: "eliteDamage", op: "multAdd" }
  },
  dot_damage: {
    id: "dot_damage",
    name: "Viper's Tongue",
    description: "Your DoT effects deal increased damage.",
    tags: ["combat", "debuff"],
    valueRange: { min: 0.15, max: 0.20, stat: "dotDamageMultiplier", op: "multAdd" }
  },
  type_damage_undead: {
    id: "type_damage_undead",
    name: "Exorcist",
    description: "Deal increased damage to Undead enemies.",
    tags: ["combat", "slayer"],
    valueRange: { min: 0.10, max: 0.15, stat: "undeadDamageMultiplier", op: "multAdd" }
  },
  // --- Survival ---
  sprint_speed: {
    id: "sprint_speed",
    name: "Runner's High",
    description: "Gain movement speed while sprinting.",
    tags: ["mobility"],
    valueRange: { min: 0.10, max: 0.15, stat: "sprintSpeedMultiplier", op: "multAdd" }
  },
  proj_reduction: {
    id: "proj_reduction",
    name: "Arrow Catch",
    description: "Take less damage from projectiles.",
    tags: ["survival"],
    valueRange: { min: 0.05, max: 0.10, stat: "projectileDamageReduction", op: "add" }
  },
  sprint_reduction: {
    id: "sprint_reduction",
    name: "Evasive Sprint",
    description: "Gain damage reduction while sprinting.",
    tags: ["survival", "mobility"],
    valueRange: { min: 0.05, max: 0.10, stat: "sprintDamageReduction", op: "add" }
  },
  max_hp: {
    id: "max_hp",
    name: "Vitality",
    description: "Gain maximum HP.",
    tags: ["survival"],
    valueRange: { min: 10, max: 20, stat: "maxHp", op: "add" }
  },
  healing_effectiveness: {
    id: "healing_effectiveness",
    name: "Recovery",
    description: "Increase all healing received.",
    tags: ["survival"],
    valueRange: { min: 0.05, max: 0.10, stat: "healingEffectiveness", op: "multAdd" }
  },
  nearby_reduction: {
    id: "nearby_reduction",
    name: "Intimidation",
    description: "Enemies near you deal less damage.",
    tags: ["survival", "aura"],
    valueRange: { min: 0.05, max: 0.10, stat: "nearbyDamageReduction", op: "add" }
  }
});

export const NECRO_SKILL_IDS = Object.freeze({
  BEAM: "beam_attack",
  SPIRIT: "spirit_summon",
  SLOW_FIELD: "slow_field",
  SPIRIT_DASH: "spirit_dash"
});

export const DEATH_KNIGHT_SKILL_IDS = Object.freeze({
  BASIC_ATTACK_COMBO: "basic_attack_combo",
  WAVE_SLASH: "wave_slash",
  THIRD_STRIKE_WAVE: "third_strike_wave",
  DEATH_GRIP: "death_grip",
  PASSIVE: "passive"
});

export const STATUS_IDS = Object.freeze({
  SLOW: "slow",
  CURSE: "curse",
  BURN: "burn"
});

export const HERO_MODS = Object.freeze({
  // --- Necromancer ---
  necro_execute_detonation: {
    id: "necro_execute_detonation",
    heroId: "necromancer",
    name: "Execution Detonation",
    rarity: "rare",
    tags: ["execute", "aoe", "chain", "slow_field"],
    description: "Enemies executed by your slowing field explode, dealing 80% ATK as area damage. Execution threshold reduced to 10%.",
    affects: { skillIds: [NECRO_SKILL_IDS.SLOW_FIELD] },
    values: { executeThreshold: 0.10, explosionDamageAtkRatio: 0.80, explosionRadius: 100, explosionCanChainExecute: true }, // 2.5m = 100px
    hooks: { onExecuteInSlowField: "spawn_aoe_blast" }
  },
  necro_assassin_spirit: {
    id: "necro_assassin_spirit",
    heroId: "necromancer",
    name: "Assassin Spirit",
    rarity: "rare",
    tags: ["spirit", "summon", "teleport", "finisher"],
    description: "Your Spirit teleports to enemies below 30% HP every 0.8s, dealing 120% ATK. Consumes 1 charge.",
    affects: { skillIds: [NECRO_SKILL_IDS.SPIRIT, NECRO_SKILL_IDS.BEAM] },
    values: { targetHpThreshold: 0.30, teleportInterval: 0.8, teleportDamageRatio: 1.20 },
    hooks: { modifySpiritBehavior: "assassin" }
  },
  necro_guardian_spirit: {
    id: "necro_guardian_spirit",
    heroId: "necromancer",
    name: "Guardian Spirit",
    rarity: "rare",
    tags: ["spirit", "summon", "defense", "aoe"],
    description: "Spirit emits shockwaves every 1.5s (70% ATK, 3m radius, knockback) instead of fireballs.",
    affects: { skillIds: [NECRO_SKILL_IDS.SPIRIT] },
    values: { replaceFireball: true, interval: 1.5, damageRatio: 0.70, radius: 120, knockback: 24 }, // 3m = 120px, 0.6m = 24px
    hooks: { modifySpiritBehavior: "guardian" }
  },
  necro_channeling_beam: {
    id: "necro_channeling_beam",
    heroId: "necromancer",
    name: "Channeling Beam",
    rarity: "rare",
    tags: ["beam", "channel", "ramp", "penalty"],
    description: "Beam becomes a continuous channel (40% to 140% ATK/s). Range increases to 7m. -40% move speed.",
    affects: { skillIds: [NECRO_SKILL_IDS.BEAM] },
    values: { startingDpsRatio: 0.40, maxDpsRatio: 1.40, rampDuration: 2.0, maxRange: 280, movePenalty: 0.40 }, // 7m = 280px
    hooks: { overrideBeamBehavior: "channel_beam" }
  },
  necro_cursed_dash: {
    id: "necro_cursed_dash",
    heroId: "necromancer",
    name: "Cursed Dash",
    rarity: "magic",
    tags: ["dash", "spirit_form", "slow", "curse"],
    description: "In Spirit form, enemies you pass through are slowed by 40% and cursed (taking +15% damage).",
    affects: { skillIds: [NECRO_SKILL_IDS.SPIRIT_DASH] },
    values: { slowMult: 0.40, slowDuration: 2.0, curseDuration: 4.0, curseDamageMult: 0.15 },
    hooks: { onSpiritDashPassThroughEnemy: "apply_statuses" }
  },
  necro_twin_spirits: {
    id: "necro_twin_spirits",
    heroId: "necromancer",
    name: "Twin Spirits",
    rarity: "rare",
    tags: ["spirit", "multi_summon"],
    description: "Summon two Spirits, but each deals 30% less damage.",
    affects: { skillIds: [NECRO_SKILL_IDS.SPIRIT] },
    values: { spiritCount: 2, damageMultiplier: 0.70 },
    hooks: { modifySpiritBehavior: "multi_spirit" }
  },

  // --- Death Knight ---
  dk_piercing_stance: {
    id: "dk_piercing_stance",
    heroId: "death_knight",
    name: "Piercing Stance",
    rarity: "rare",
    tags: ["melee", "precision", "thrust", "range"],
    description: "Your slashes become thrusts. Basic attack speed +20%, range +35%, width -50%. Wave slash becomes a narrow line.",
    affects: { skillIds: [DEATH_KNIGHT_SKILL_IDS.BASIC_ATTACK_COMBO, DEATH_KNIGHT_SKILL_IDS.WAVE_SLASH] },
    values: { attackSpeedMultiplier: 1.20, rangeMultiplier: 1.35, widthMultiplier: 0.50, waveWidthMultiplier: 0.45 },
    hooks: { overrideBasicAttackPattern: "thrust_combo", overrideWaveSlashBehavior: "forward_line" }
  },
  dk_reaping_cyclone: {
    id: "dk_reaping_cyclone",
    heroId: "death_knight",
    name: "Reaping Cyclone",
    rarity: "rare",
    tags: ["melee", "aoe", "spin"],
    description: "Basic attacks become 360° spins (85% DMG, 2.8m radius). Third strike fires 4 waves in cardinal directions (70% DMG).",
    affects: { skillIds: [DEATH_KNIGHT_SKILL_IDS.BASIC_ATTACK_COMBO, DEATH_KNIGHT_SKILL_IDS.THIRD_STRIKE_WAVE] },
    values: { damageMultiplier: 0.85, aoeRadius: 112, waveCount: 4, waveDamageMultiplier: 0.70 }, // 2.8m = 112px
    hooks: { overrideBasicAttackPattern: "spin_combo", overrideThirdStrikeWave: "spawn_multiple_projectiles" }
  },
  dk_grasp_of_the_legion: {
    id: "dk_grasp_of_the_legion",
    heroId: "death_knight",
    name: "Grasp of the Legion",
    rarity: "rare",
    tags: ["mobility", "hook", "pull"],
    description: "Death Grip fires 2 additional chains. Pulls enemies to you. Pulled enemies slowed 30% for 1.5s.",
    affects: { skillIds: [DEATH_KNIGHT_SKILL_IDS.DEATH_GRIP] },
    values: { additionalChains: 2, chainCount: 3, slowMultiplier: 0.30, slowDuration: 1.5 },
    hooks: { overrideDeathGripBehavior: "multi_chain_grip", onDeathGripPullEnemy: "apply_statuses" }
  },
  dk_hellhound_pact: {
    id: "dk_hellhound_pact",
    heroId: "death_knight",
    name: "Hellhound Pact",
    rarity: "rare",
    tags: ["summon", "burn", "kill_trigger"],
    description: "Every 10 kills, summon a Hellhound for 10s. Bites deal 60% ATK and apply Burn. Up to 3 active.",
    affects: { skillIds: [DEATH_KNIGHT_SKILL_IDS.PASSIVE] },
    values: { threshold: 10, duration: 10.0, maxActive: 3, attackInterval: 0.8, damageRatio: 0.60, radius: 88, burnDuration: 3.0, burnDpsRatio: 0.20 }, // 2.2m = 88px
    hooks: { onPlayerKillCounterThreshold: "summon_minion", modifySummonedMinionBehavior: "bite_nearby_enemies" }
  },
  dk_spectral_pursuit: {
    id: "dk_spectral_pursuit",
    heroId: "death_knight",
    name: "Spectral Pursuit",
    rarity: "rare",
    tags: ["wave_slash", "projectile", "homing"],
    description: "Wave slash fires 2 additional projectiles with 50% more range. Projectiles home toward enemies. Width reduced by 65%.",
    affects: { skillIds: [DEATH_KNIGHT_SKILL_IDS.WAVE_SLASH] },
    values: { totalProjectiles: 3, distanceMultiplier: 1.50, homingRadius: 180, homingTurnRate: 2.4, widthMultiplier: 0.35 }, // 4.5m = 180px
    hooks: { overrideWaveSlashBehavior: "multi_homing_projectiles" }
  },

  // --- Elementalist ---
  elem_returning_frost_bolt: {
    id: "elem_returning_frost_bolt",
    heroId: "element_mage",
    name: "Returning Frost Bolt",
    rarity: "rare",
    tags: ["ice", "projectile", "returning", "combo"],
    description: "Frost Bolt returns to you after reaching max distance. Return speed +20%, but initial distance -15%. Hits again on return.",
    affects: { skillIds: ["frost_bolt"] },
    values: { returnSpeedMultiplier: 1.20, initialDistanceMultiplier: 0.85 },
    hooks: { overrideProjectileBehavior: "returning_projectile" }
  },
  elem_thunder_trace_dash: {
    id: "elem_thunder_trace_dash",
    heroId: "element_mage",
    name: "Thunder Trace",
    rarity: "rare",
    tags: ["lightning", "dash", "setup", "combo"],
    description: "Lightning Dash creates 2 stationary Lightning Orbs along its path (4s lifetime, 75% arc damage).",
    affects: { skillIds: ["lightning_dash"] },
    values: { orbCount: 2, orbLifetime: 4.0, arcDamageMultiplier: 0.75 },
    hooks: { onLightningDashPathResolved: "spawn_path_objects" }
  },
  elem_frost_thunder_core: {
    id: "elem_frost_thunder_core",
    heroId: "element_mage",
    name: "Frost Thunder Core",
    rarity: "rare",
    tags: ["ice", "lightning", "hybrid", "orb", "combo_core"],
    description: "Lightning Orb is replaced by Frost Thunder Core: slow moving, fires Frost Bolts every 0.8s. Fire Breath triggers a Steam Explosion.",
    affects: { skillIds: ["frost_bolt", "lightning_orb", "fire_breath"] },
    values: { autoFrostBoltInterval: 0.8, autoFrostBoltDamageMultiplier: 0.70, steamExplosionDamageRatio: 0.80, steamExplosionRadius: 112, extraFrostBolts: 6 }, // 2.8m = 112px
    hooks: { overrideProjectileBehavior: "replace_with_hybrid_orb", onFireBreathIgniteHybridOrb: "explode_and_spawn_projectiles" }
  },
  elem_nova_frost_pursuit: {
    id: "elem_nova_frost_pursuit",
    heroId: "element_mage",
    name: "Nova Frost Pursuit",
    rarity: "rare",
    tags: ["ice", "nova", "trigger", "aoe", "combo"],
    description: "Ice Nova fires 1 Frost Bolt (85% damage) at each enemy it hits (Max 8).",
    affects: { skillIds: ["ice_nova", "frost_bolt"] },
    values: { maxProjectiles: 8, damageMultiplier: 0.85 },
    hooks: { onIceNovaHitEnemies: "spawn_targeted_projectiles" }
  },
  elem_solar_conversion: {
    id: "elem_solar_conversion",
    heroId: "element_mage",
    name: "Solar Conversion",
    rarity: "rare",
    tags: ["fire", "burning", "dot", "conversion", "stacking"],
    description: "Frost Bolt -> Fireball, Lightning Orb -> Sun Orb. Burning has no stack limit but -35% base damage.",
    affects: { skillIds: ["frost_bolt", "lightning_orb", "burning"] },
    values: { burningBaseDamageMultiplier: 0.65, burningDuration: 3.0, burningDpsRatio: 0.06 },
    hooks: { overrideProjectileBehavior: "replace_projectile", overrideStatusBehavior: "burning_no_limit" }
  }
});

export const CURSES = Object.freeze({});

export function getModById(id) {
  return MAIN_GLOBAL_MODS[id] || SECONDARY_GLOBAL_MODS[id] || HERO_MODS[id] || CURSES[id] || null;
}

export function getModsByCategory(category) {
  switch (category) {
    case "main": return Object.values(MAIN_GLOBAL_MODS);
    case "secondary": return Object.values(SECONDARY_GLOBAL_MODS);
    case "hero": return Object.values(HERO_MODS);
    case "curse": return Object.values(CURSES);
    default: return [];
  }
}

/**
 * Utility to check if a resolved build object contains a specific mod ID.
 */
export function buildHasMod(build, modId) {
  if (!build) return false;
  if (build.mainGlobal?.id === modId) return true;
  if (build.secondaryGlobals?.some(m => m.id === modId)) return true;
  if (build.heroMods?.some(m => m.id === modId)) return true;
  if (build.curses?.some(m => m.id === modId)) return true;
  return false;
}
