export const UPGRADE_CATEGORIES = Object.freeze([
  "damage",
  "rhythm",
  "control",
  "onhit",
  "elemental",
  "spiritcraft"
]);

export const ATTACK_UPGRADE_DEFS = Object.freeze({
  elementalShot: {
    standardUpgrades: [
      { id: "elemental_damage", name: "Elemental Damage", rarity: "common", category: "damage", description: "Elemental Shot damage +10%.", maxLevel: 5, valueRange: { min: 10, max: 10, percent: true }, buildSelectable: true },
      { id: "burning_power", name: "Burning Power", rarity: "common", category: "damage", description: "Burn damage +20%.", maxLevel: 4, valueRange: { min: 20, max: 20, percent: true }, buildSelectable: true },
      { id: "burn_hunter", name: "Burn Hunter", rarity: "common", category: "damage", description: "Deal 10% increased damage to burning enemies.", maxLevel: 4, valueRange: { min: 10, max: 10, percent: true }, buildSelectable: true },
      { id: "attack_speed", name: "Attack Speed", rarity: "common", category: "rhythm", description: "Attack speed +8%.", maxLevel: 5, valueRange: { min: 8, max: 8, percent: true }, buildSelectable: true },
      { id: "projectile_speed", name: "Projectile Speed", rarity: "common", category: "rhythm", description: "Projectile speed +12%.", maxLevel: 4, valueRange: { min: 12, max: 12, percent: true }, buildSelectable: true },
      { id: "elemental_charge", name: "Elemental Charge", rarity: "common", category: "rhythm", description: "Fire hits generate +1 additional elemental charge.", maxLevel: 2, buildSelectable: true },
      { id: "range_boost", name: "Range Boost", rarity: "common", category: "control", description: "Projectile range +15%.", maxLevel: 4, valueRange: { min: 15, max: 15, percent: true }, buildSelectable: true },
      { id: "spread_reduction", name: "Spread Reduction", rarity: "common", category: "control", description: "Projectile spread -15%.", maxLevel: 4, valueRange: { min: 15, max: 15, percent: true }, buildSelectable: true },
      { id: "crit_chance", name: "Crit Chance", rarity: "common", category: "elemental", description: "+5% crit chance.", maxLevel: 4, valueRange: { min: 5, max: 5, percent: true }, buildSelectable: true },
      { id: "lightning_conduction", name: "Lightning Conduction", rarity: "common", category: "elemental", description: "Lightning attacks have 10% chance to stun enemies.", maxLevel: 3, valueRange: { min: 10, max: 10, percent: true }, buildSelectable: true },
      { id: "wind_bleed", name: "Wind Bleed", rarity: "common", category: "elemental", description: "Wind attacks have 10% chance to inflict bleed.", maxLevel: 3, valueRange: { min: 10, max: 10, percent: true }, buildSelectable: true },
      { id: "extra_projectile", name: "Extra Projectile", rarity: "uncommon", category: "rhythm", description: "Fire +1 projectile.", maxLevel: 2, buildSelectable: true },
      { id: "faster_charge", name: "Faster Charge", rarity: "uncommon", category: "rhythm", description: "Elemental charge requirement -2.", maxLevel: 2, valueRange: { min: 2, max: 2, integer: true }, buildSelectable: true },
      { id: "fire_explosion", name: "Fire Explosion", rarity: "uncommon", category: "damage", description: "Fire explosion damage increased.", maxLevel: 2, valueRange: { min: 25, max: 25, percent: true }, buildSelectable: true },
      { id: "detonation_boost", name: "Detonation Boost", rarity: "uncommon", category: "damage", description: "Lightning burn detonation damage +50%.", maxLevel: 2, valueRange: { min: 50, max: 50, percent: true }, buildSelectable: true },
      { id: "wind_force", name: "Wind Force", rarity: "uncommon", category: "control", description: "Wind attacks knock enemies back.", maxLevel: 1, buildSelectable: true },
      { id: "seeking", name: "Seeking", rarity: "uncommon", category: "control", description: "Projectiles gain light homing.", maxLevel: 1, buildSelectable: true },
      { id: "chain_lightning", name: "Chain Lightning", rarity: "uncommon", category: "elemental", description: "Lightning chains +1 additional target.", maxLevel: 2, buildSelectable: true },
      { id: "explosive_burn", name: "Explosive Burn", rarity: "uncommon", category: "elemental", description: "Burning enemies explode when killed.", maxLevel: 1, buildSelectable: true },
      { id: "inferno", name: "Inferno", rarity: "rare", category: "damage", description: "Burn spreads to nearby enemies.", maxLevel: 1, buildSelectable: true },
      { id: "elemental_overdrive", name: "Elemental Overdrive", rarity: "rare", category: "rhythm", description: "Surge duration increased from 3s to 5s.", maxLevel: 1, buildSelectable: true },
      { id: "storm_wind", name: "Storm Wind", rarity: "rare", category: "control", description: "Wind arcs become much larger.", maxLevel: 1, buildSelectable: true },
      { id: "superstorm", name: "Superstorm", rarity: "rare", category: "elemental", description: "Lightning chain count doubles during surge.", maxLevel: 1, buildSelectable: true }
    ],
    standardPenalties: [
      { id: "slowShot", name: "Slow Shot", description: "Reduces projectile speed by 10%.", valueRange: { min: 10, max: 10, percent: true } },
      { id: "damageReduction", name: "Damage Reduction", description: "Reduces attack damage by 5% to 8%.", valueRange: { min: 5, max: 8, percent: true } },
      { id: "speedPenalty", name: "Speed Penalty", description: "Reduces attack speed by 5% to 8%.", valueRange: { min: 5, max: 8, percent: true } },
      { id: "fewerProjectiles", name: "Fewer Projectiles", description: "Reduces simultaneous projectiles by 1 (minimum 1).", valueRange: { min: 1, max: 1 } },
      { id: "reducedRange", name: "Reduced Range", description: "Reduces Elemental Shot max range by 10% to 15%.", valueRange: { min: 10, max: 15, percent: true } },
      { id: "widerSpread", name: "Wider Spread", description: "Increases projectile spread, making shots less accurate.", valueRange: { min: 15, max: 25, percent: true } },
      { id: "cooldown", name: "Cooldown", description: "Adds 0.1 seconds to attack cooldown.", valueRange: { min: 0.1, max: 0.1 } }
    ],
    uniqueUpgrades: [],
    uniquePenalties: [
      { id: "randomDirection", name: "Random Direction", description: "Fires projectiles in a completely random direction." },
      { id: "oppositeFire", name: "Opposite Fire", description: "Fires projectiles in the exact opposite direction of the cursor." },
      { id: "misfire", name: "Misfire", description: "10% chance to fire nothing, consuming the attack but dealing no damage." },
      { id: "shrinking", name: "Shrinking", description: "Projectile hitbox shrinks by 5% every 0.5s in flight." },
      { id: "redirect", name: "Redirect", description: "Projectile direction randomly changes after 0.8s in flight." },
      { id: "selfKnockback", name: "Self Knockback", description: "Propels the player slightly backward on each shot." },
      { id: "delayedFire", name: "Delayed Fire", description: "0.3s delay between clicking and the projectile firing." },
      { id: "reducedProjectiles", name: "Reduced Projectiles", description: "Reduces max simultaneous projectiles by 1 (minimum 1)." },
      { id: "fragileShot", name: "Fragile Shot", description: "Decreases projectile penetration targets by 3." }
    ]
  },
  projectile: {
    standardUpgrades: [
      { id: "extraProjectile", name: "Extra Projectile", category: "rhythm", description: "Adds 1 to simultaneous projectiles fired.", valueRange: null, buildSelectable: true },
      { id: "flatDamage", name: "Flat Damage", category: "damage", description: "Adds 1 to 2 flat damage to base attack.", valueRange: { min: 1, max: 2, integer: true }, buildSelectable: true },
      { id: "damageBoost", name: "Damage Boost", category: "damage", description: "Increases attack damage by 5% to 10%.", valueRange: { min: 5, max: 10, percent: true }, buildSelectable: true },
      { id: "attackSpeed", name: "Attack Speed", category: "rhythm", description: "Increases attack speed by 5% to 10%.", valueRange: { min: 5, max: 10, percent: true }, buildSelectable: true },
      { id: "projectileSpeed", name: "Projectile Speed", category: "rhythm", description: "Increases projectile speed by 10% to 15%.", valueRange: { min: 10, max: 15, percent: true }, buildSelectable: true },
      { id: "rangeBoost", name: "Range Boost", category: "control", description: "Increases projectile max range by 15% to 20%.", valueRange: { min: 15, max: 20, percent: true }, buildSelectable: true },
      { id: "spreadReduction", name: "Spread Reduction", category: "control", description: "Tightens projectile spread for more accuracy.", valueRange: { min: 15, max: 25, percent: true }, buildSelectable: true },
      { id: "critChance", name: "Crit Chance", category: "onhit", description: "5% chance for projectiles to deal 150% damage.", valueRange: { min: 5, max: 5, percent: true }, buildSelectable: true }
    ],
    standardPenalties: [
      { id: "slowShot", name: "Slow Shot", description: "Reduces projectile speed by 10%.", valueRange: { min: 10, max: 10, percent: true } },
      { id: "damageReduction", name: "Damage Reduction", description: "Reduces attack damage by 5% to 8%.", valueRange: { min: 5, max: 8, percent: true } },
      { id: "speedPenalty", name: "Speed Penalty", description: "Reduces attack speed by 5% to 8%.", valueRange: { min: 5, max: 8, percent: true } },
      { id: "fewerProjectiles", name: "Fewer Projectiles", description: "Reduces simultaneous projectiles by 1 (minimum 1).", valueRange: { min: 1, max: 1 } },
      { id: "reducedRange", name: "Reduced Range", description: "Reduces projectile max range by 10% to 15%.", valueRange: { min: 10, max: 15, percent: true } },
      { id: "widerSpread", name: "Wider Spread", description: "Increases projectile spread, making shots less accurate.", valueRange: { min: 15, max: 25, percent: true } },
      { id: "cooldown", name: "Cooldown", description: "Adds 0.1 seconds to attack cooldown.", valueRange: { min: 0.1, max: 0.1 } }
    ],
    uniqueUpgrades: [
      { id: "piercing", name: "Piercing", category: "control", description: "Projectiles pierce up to 3 enemies (default is 2).", maxLevel: 1, buildSelectable: false },
      { id: "splitting", name: "Splitting", category: "onhit", description: "Projectiles that travel 1s without hitting split into 2, up to 4 times (max 16).", maxLevel: 1, buildSelectable: false },
      { id: "momentum", name: "Momentum", category: "damage", description: "Projectile damage +10% per second in flight, up to +100%.", maxLevel: 1, buildSelectable: false },
      { id: "seeking", name: "Seeking", category: "control", description: "Projectiles curve toward the nearest enemy after 0.5s in flight.", maxLevel: 1, buildSelectable: false },
      { id: "chainLightning", name: "Chain Lightning", category: "onhit", description: "On hit, up to 3 nearby enemies take 33% of the attack damage.", maxLevel: 1, buildSelectable: false },
      { id: "explosive", name: "Explosive", category: "onhit", description: "Projectiles explode on impact, dealing 60% damage in a small area.", maxLevel: 1, buildSelectable: false },
      { id: "ghostProjectile", name: "Ghost Projectile", category: "control", description: "Projectiles pass through all obstacles and walls.", maxLevel: 1, buildSelectable: false },
      { id: "overdrive", name: "Overdrive", category: "rhythm", description: "Every 5th projectile deals 300% damage at 2x size.", maxLevel: 1, buildSelectable: false }
    ],
    uniquePenalties: [
      { id: "randomDirection", name: "Random Direction", description: "Fires projectiles in a completely random direction." },
      { id: "oppositeFire", name: "Opposite Fire", description: "Fires projectiles in the exact opposite direction of the cursor." },
      { id: "misfire", name: "Misfire", description: "10% chance to fire nothing, consuming the attack but dealing no damage." },
      { id: "shrinking", name: "Shrinking", description: "Projectile hitbox shrinks by 5% every 0.5s in flight." },
      { id: "redirect", name: "Redirect", description: "Projectile direction randomly changes after 0.8s in flight." },
      { id: "selfKnockback", name: "Self Knockback", description: "Propels the player slightly backward on each shot." },
      { id: "delayedFire", name: "Delayed Fire", description: "0.3s delay between clicking and the projectile firing." },
      { id: "reducedProjectiles", name: "Reduced Projectiles", description: "Reduces max simultaneous projectiles by 1 (minimum 1)." },
      { id: "fragileShot", name: "Fragile Shot", description: "Decreases projectile penetration targets by 3." }
    ]
  },
  windVolley: { standardUpgrades: [], standardPenalties: [], uniqueUpgrades: [], uniquePenalties: [] },
  bladeBlast: {
    standardUpgrades: [
      { id: "blade_blast_damage", name: "Blade Damage", rarity: "common", category: "damage", description: "Blade & Blast damage +10%.", maxLevel: 5, valueRange: { min: 10, max: 10, percent: true }, buildSelectable: true },
      { id: "blast_payload", name: "Blast Payload", rarity: "common", category: "damage", description: "Blast damage +12%.", maxLevel: 4, valueRange: { min: 12, max: 12, percent: true }, buildSelectable: true },
      { id: "keen_edges", name: "Keen Edges", rarity: "common", category: "damage", description: "Blade crit damage +15%.", maxLevel: 4, valueRange: { min: 15, max: 15, percent: true }, buildSelectable: true },
      { id: "blade_blast_attack_speed", name: "Blade Tempo", rarity: "common", category: "rhythm", description: "Blade & Blast attack speed +8%.", maxLevel: 5, valueRange: { min: 8, max: 8, percent: true }, buildSelectable: true },
      { id: "return_speed", name: "Return Speed", rarity: "common", category: "rhythm", description: "Returning blades move 12% faster.", maxLevel: 4, valueRange: { min: 12, max: 12, percent: true }, buildSelectable: true },
      { id: "combo_window", name: "Combo Window", rarity: "common", category: "rhythm", description: "Combo timing is 10% more forgiving.", maxLevel: 4, valueRange: { min: 10, max: 10, percent: true }, buildSelectable: true },
      { id: "blast_radius", name: "Blast Radius", rarity: "common", category: "control", description: "Blast radius +15%.", maxLevel: 4, valueRange: { min: 15, max: 15, percent: true }, buildSelectable: true },
      { id: "orbit_control", name: "Orbit Control", rarity: "common", category: "control", description: "Blade reach +12%.", maxLevel: 4, valueRange: { min: 12, max: 12, percent: true }, buildSelectable: true },
      { id: "impact_slow", name: "Impact Slow", rarity: "common", category: "control", description: "Blast hits slow enemies by 10%.", maxLevel: 3, valueRange: { min: 10, max: 10, percent: true }, buildSelectable: true },
      { id: "runic_sparks", name: "Runic Sparks", rarity: "common", category: "onhit", description: "Blade hits have a 10% chance to trigger a small burst.", maxLevel: 4, valueRange: { min: 10, max: 10, percent: true }, buildSelectable: true },
      { id: "chain_fragments", name: "Chain Fragments", rarity: "common", category: "onhit", description: "Explosions release 1 additional fragment.", maxLevel: 3, valueRange: { min: 1, max: 1, integer: true }, buildSelectable: true },
      { id: "finisher_mark", name: "Finisher Mark", rarity: "common", category: "onhit", description: "Marked enemies take 10% more blast damage.", maxLevel: 4, valueRange: { min: 10, max: 10, percent: true }, buildSelectable: true },
      { id: "whirl_finisher", name: "Whirl Finisher", rarity: "uncommon", category: "damage", description: "Finishers deal 25% more damage.", maxLevel: 2, valueRange: { min: 25, max: 25, percent: true }, buildSelectable: true },
      { id: "rapid_recall", name: "Rapid Recall", rarity: "uncommon", category: "rhythm", description: "Blade recall speed +20%.", maxLevel: 2, valueRange: { min: 20, max: 20, percent: true }, buildSelectable: true },
      { id: "stagger_blast", name: "Stagger Blast", rarity: "uncommon", category: "control", description: "Blasts briefly stagger enemies.", maxLevel: 1, buildSelectable: true },
      { id: "volatile_chain", name: "Volatile Chain", rarity: "uncommon", category: "onhit", description: "On-hit bursts can chain one additional time.", maxLevel: 2, buildSelectable: true },
      { id: "storm_lattice", name: "Storm Lattice", rarity: "rare", category: "damage", description: "Blade storms gain a powerful finishing detonation.", maxLevel: 1, buildSelectable: true },
      { id: "tempo_breaker", name: "Tempo Breaker", rarity: "rare", category: "rhythm", description: "Every third combo is dramatically faster.", maxLevel: 1, buildSelectable: true },
      { id: "gravity_well", name: "Gravity Well", rarity: "rare", category: "control", description: "Blasts pull nearby enemies inward before detonating.", maxLevel: 1, buildSelectable: true },
      { id: "overload_mark", name: "Overload Mark", rarity: "rare", category: "onhit", description: "Marked enemies erupt in a larger chain blast on death.", maxLevel: 1, buildSelectable: true }
    ],
    standardPenalties: [
      { id: "blade_blast_slow", name: "Slow Tempo", description: "Reduces Blade & Blast attack speed by 5% to 8%.", valueRange: { min: 5, max: 8, percent: true } },
      { id: "blade_blast_weaken", name: "Weak Blades", description: "Reduces Blade & Blast damage by 5% to 8%.", valueRange: { min: 5, max: 8, percent: true } },
      { id: "short_orbit", name: "Short Orbit", description: "Reduces blade reach by 10% to 15%.", valueRange: { min: 10, max: 15, percent: true } },
      { id: "small_blast", name: "Small Blast", description: "Reduces blast radius by 10% to 15%.", valueRange: { min: 10, max: 15, percent: true } }
    ],
    uniqueUpgrades: [],
    uniquePenalties: []
  },
  guardCombo: { standardUpgrades: [], standardPenalties: [], uniqueUpgrades: [], uniquePenalties: [] },
  soulSiphon: {
    standardUpgrades: [
      { id: "soul_pressure", name: "Soul Pressure", rarity: "common", category: "damage", description: "Soul Siphon damage +12%.", maxLevel: 5, valueRange: { min: 12, max: 12, percent: true }, buildSelectable: true },
      { id: "condensed_beam", name: "Condensed Beam", rarity: "common", category: "damage", description: "Beam width +16 px, damage +8%.", maxLevel: 4, valueRange: { min: 16, max: 16, integer: true }, buildSelectable: true },
      { id: "execution_drain", name: "Execution Drain", rarity: "common", category: "damage", description: "+20% damage to enemies below 35% health.", maxLevel: 3, buildSelectable: true },
      { id: "energy_recycling", name: "Energy Recycling", rarity: "common", category: "rhythm", description: "Spirit gains 1 charge per 260 px moved.", maxLevel: 3, buildSelectable: true },
      { id: "spiritual_conduit", name: "Spiritual Conduit", rarity: "common", category: "rhythm", description: "+8% chance to charge the Spirit twice when siphoning.", maxLevel: 4, buildSelectable: true },
      { id: "rhythmic_siphon", name: "Rhythmic Siphon", rarity: "common", category: "rhythm", description: "Soul Siphon attack speed +8%.", maxLevel: 5, buildSelectable: true },
      { id: "long_reach", name: "Long Reach", rarity: "common", category: "control", description: "Beam length +15%.", maxLevel: 4, valueRange: { min: 50, max: 50, integer: true }, buildSelectable: true },
      { id: "wide_siphon", name: "Wide Siphon", rarity: "common", category: "control", description: "Beam width +15%.", maxLevel: 4, valueRange: { min: 30, max: 30, integer: true }, buildSelectable: true },
      { id: "shockwave", name: "Shockwave", rarity: "common", category: "control", description: "Ground Slam area +12%.", maxLevel: 4, buildSelectable: true },
      { id: "soul_magnet", name: "Soul Magnet", rarity: "common", category: "spiritcraft", description: "8% chance to grant an extra soul when collecting.", maxLevel: 5, buildSelectable: true },
      { id: "spiritual_resonance", name: "Spiritual Resonance", rarity: "common", category: "spiritcraft", description: "On Soul Siphon evolve, gain 8 souls.", maxLevel: 2, buildSelectable: true },
      { id: "soul_burst", name: "Soul Burst", rarity: "uncommon", category: "damage", description: "Enemies killed by Soul Siphon explode for 25% attack damage.", maxLevel: 3, buildSelectable: true },
      { id: "focused_channel", name: "Focused Channel", rarity: "uncommon", category: "damage", description: "Damage increases while channeling by +15% per second, up to +45%.", maxLevel: 3, buildSelectable: true },
      { id: "soul_rend", name: "Soul Rend", rarity: "uncommon", category: "damage", description: "Also deals 0.8% of enemy max health as damage.", maxLevel: 3, buildSelectable: true },
      { id: "twin_fireball", name: "Twin Fireball", rarity: "uncommon", category: "damage", description: "Spirit fires an additional fireball.", maxLevel: 1, buildSelectable: true },
      { id: "fluid_channel", name: "Fluid Channel", rarity: "uncommon", category: "rhythm", description: "Channeling reduces movement speed 20% less.", maxLevel: 3, buildSelectable: true },
      { id: "spirit_reflex", name: "Spirit Reflex", rarity: "uncommon", category: "rhythm", description: "Spirit ability trigger reduces a random skill cooldown by 0.35 s.", maxLevel: 3, buildSelectable: true },
      { id: "charging_beam", name: "Charging Beam", rarity: "uncommon", category: "control", description: "Beam grows 2.5% per second while channeling, up to +25%.", maxLevel: 2, buildSelectable: true },
      { id: "seismic_slow", name: "Seismic Slow", rarity: "uncommon", category: "control", description: "Enemies hit by Ground Slam are slowed by 10% for 1 second.", maxLevel: 3, buildSelectable: true },
      { id: "jagged_land", name: "Jagged Land", rarity: "uncommon", category: "control", description: "Ground Slam slow duration +0.75 s.", maxLevel: 3, buildSelectable: true },
      { id: "restless_souls", name: "Restless Souls", rarity: "uncommon", category: "control", description: "8% chance on soul collect to restore 4 health.", maxLevel: 3, buildSelectable: true },
      { id: "soul_catalyst", name: "Soul Catalyst", rarity: "uncommon", category: "spiritcraft", description: "15% chance on kill to charge the Spirit.", maxLevel: 3, buildSelectable: true },
      { id: "lingering_souls", name: "Lingering Souls", rarity: "uncommon", category: "spiritcraft", description: "Soul Siphon kills release homing spirit projectile, 40% attack damage.", maxLevel: 3, buildSelectable: true },
      { id: "mini_boss_harvest", name: "Mini-Boss Harvest", rarity: "uncommon", category: "spiritcraft", description: "Killing a mini-boss grants 5 souls.", maxLevel: 1, buildSelectable: true },
      { id: "chest_spirits", name: "Chest Spirits", rarity: "uncommon", category: "spiritcraft", description: "12% chance when opening a chest to grant a soul.", maxLevel: 3, buildSelectable: true },
      { id: "spirit_overload", name: "Spirit Overload", rarity: "rare", category: "damage", description: "20% chance on beam hit to trigger Spirit's fireball.", maxLevel: 1, buildSelectable: true },
      { id: "devouring_beam", name: "Devouring Beam", rarity: "rare", category: "damage", description: "Damage +0.5% per soul collected this run.", maxLevel: 1, buildSelectable: true },
      { id: "echoing_beam", name: "Echoing Beam", rarity: "rare", category: "rhythm", description: "20% chance for a second hit at 20% damage.", maxLevel: 1, buildSelectable: true },
      { id: "twin_siphon", name: "Twin Siphon", rarity: "rare", category: "control", description: "Two beams at 30 degree angle, each 35% reduced width.", maxLevel: 1, buildSelectable: true },
      { id: "ancient_spirit", name: "Ancient Spirit", rarity: "rare", category: "spiritcraft", description: "Spirit kills grant 40% more XP.", maxLevel: 1, buildSelectable: true },
      { id: "ancestral_awakening", name: "Ancestral Awakening", rarity: "rare", category: "spiritcraft", description: "The Spirit triggers two assist abilities instead of one.", maxLevel: 1, buildSelectable: true },
      { id: "soul_mastery", name: "Soul Mastery", rarity: "rare", category: "rhythm", description: "1% skill cooldown reduction per 8 souls.", maxLevel: 1, buildSelectable: true }
    ],
    standardPenalties: [],
    uniqueUpgrades: [],
    uniquePenalties: []
  }
});

export function resolveWeaponArtUpgradePoolType(weaponArtId) {
  if (weaponArtId === "projectile") return "elementalShot";
  if (ATTACK_UPGRADE_DEFS[weaponArtId]) return weaponArtId;
  return "projectile";
}

export function getWeaponArtUpgradeDefs(weaponArtId) {
  return ATTACK_UPGRADE_DEFS[resolveWeaponArtUpgradePoolType(weaponArtId)] || ATTACK_UPGRADE_DEFS.projectile;
}

export function getWeaponArtUpgradeDefById(weaponArtId, upgradeId) {
  if (!upgradeId) return null;
  const defs = getWeaponArtUpgradeDefs(weaponArtId);
  const pool = [...(defs.standardUpgrades || []), ...(defs.uniqueUpgrades || [])];
  return pool.find((entry) => entry.id === upgradeId) || null;
}

export function getWeaponArtBuildSelectableUpgrades(weaponArtId) {
  const defs = getWeaponArtUpgradeDefs(weaponArtId);
  return (defs.standardUpgrades || []).filter((entry) => entry.buildSelectable !== false);
}
