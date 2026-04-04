const ITEM_ATLAS_TILE = 32;

export const RING_SPRITE_TO_CELL = {
  gold_emerald_ring: { row: 17, col: 0 },
  gold_band_ring: { row: 17, col: 1 },
  green_signet_ring: { row: 17, col: 2 },
  ruby_ring: { row: 17, col: 3 },
  sapphire_ring: { row: 17, col: 4 },
  onyx_ring: { row: 17, col: 5 },
  gold_signet_ring: { row: 18, col: 0 },
  silver_signet_ring: { row: 18, col: 1 },
  jade_ring: { row: 18, col: 2 },
  silver_signet_ring_2: { row: 18, col: 3 },
  twisted_gold_ring: { row: 18, col: 4 },
  twisted_metal_ring: { row: 18, col: 5 }
};

const RARITY_TO_DROP_RARITY = Object.freeze({
  White: "normal",
  Uncommon: "uncommon",
  Rare: "rare"
});

function createStatEffect(stat, value, op = "add") {
  return { type: "stat", stat, value, op };
}

function createSpecialEffect(effect, config = {}) {
  return { type: "special", effect, ...config };
}

const RAW_RING_DEFS = [
  {
    ringId: "ring_attack_speed",
    name: "Attack Speed Ring",
    rarity: "White",
    sprite: "sapphire_ring",
    maxLevel: 5,
    levels: [
      {
        description: "+10% attack speed",
        effects: [createStatEffect("attackSpeed", 0.1, "multAdd")]
      },
      {
        description: "+10% attack speed",
        effects: [createStatEffect("attackSpeed", 0.1, "multAdd")]
      },
      {
        description: "+10% crit chance. Crits grant +10% attack speed for 2s, up to 3 stacks.",
        effects: [
          createStatEffect("critChance", 0.1, "add"),
          createSpecialEffect("critAttackSpeedBuff", { attackSpeedBonus: 0.1, duration: 2, maxStacks: 3 })
        ]
      },
      {
        description: "+10% attack speed",
        effects: [createStatEffect("attackSpeed", 0.1, "multAdd")]
      },
      {
        description: "+15% attack speed. If attack speed exceeds 2.0, attacks can be used while sliding.",
        effects: [
          createStatEffect("attackSpeed", 0.15, "multAdd"),
          createSpecialEffect("slideAttackUnlock", { minimumAttackRate: 2 })
        ]
      }
    ]
  },
  {
    ringId: "ring_critical",
    name: "Critical Ring",
    rarity: "White",
    sprite: "ruby_ring",
    maxLevel: 5,
    levels: [
      {
        description: "+10% crit chance",
        effects: [createStatEffect("critChance", 0.1, "add")]
      },
      {
        description: "+10% crit chance",
        effects: [createStatEffect("critChance", 0.1, "add")]
      },
      {
        description: "Critical hits inflict bleed for 3s.",
        effects: [createSpecialEffect("critBleed", { duration: 3, stacks: 1, damagePerStack: 3 })]
      },
      {
        description: "+15% crit chance",
        effects: [createStatEffect("critChance", 0.15, "add")]
      },
      {
        description: "+10% crit chance per nearby bleeding enemy, up to +30%.",
        effects: [createSpecialEffect("nearbyBleedingCrit", { perEnemy: 0.1, maxBonus: 0.3, radius: 180 })]
      }
    ]
  },
  {
    ringId: "ring_movement",
    name: "Movement Ring",
    rarity: "White",
    sprite: "gold_emerald_ring",
    maxLevel: 5,
    levels: [
      {
        description: "+10% move speed",
        effects: [createStatEffect("moveSpeed", 0.1, "multAdd")]
      },
      {
        description: "+10% move speed",
        effects: [createStatEffect("moveSpeed", 0.1, "multAdd")]
      },
      {
        description: "+20% sprint speed",
        effects: [createSpecialEffect("sprintSpeed", { sprintSpeedBonus: 0.2 })]
      },
      {
        description: "+10% move speed",
        effects: [createStatEffect("moveSpeed", 0.1, "multAdd")]
      },
      {
        description: "While sprinting, gain +10% sprint speed per second up to +30%. Buff lingers 2s after sprint ends.",
        effects: [createSpecialEffect("sprintMomentum", { perSecond: 0.1, maxBonus: 0.3, lingerDuration: 2 })]
      }
    ]
  },
  {
    ringId: "ring_berserker",
    name: "Attack Ring (Berserker)",
    rarity: "White",
    sprite: "onyx_ring",
    maxLevel: 5,
    levels: [
      {
        description: "+10% damage",
        effects: [createStatEffect("outgoingDamage", 0.1, "multAdd")]
      },
      {
        description: "+10% damage",
        effects: [createStatEffect("outgoingDamage", 0.1, "multAdd")]
      },
      {
        description: "+20% max HP",
        effects: [createStatEffect("maxHp", 0.2, "multAdd")]
      },
      {
        description: "+10% damage",
        effects: [createStatEffect("outgoingDamage", 0.1, "multAdd")]
      },
      {
        description: "+10% damage per 10% missing HP, up to +50%.",
        effects: [createSpecialEffect("missingHpDamage", { perTenPercent: 0.1, maxBonus: 0.5 })]
      }
    ]
  },
  {
    ringId: "ring_health",
    name: "Health Ring",
    rarity: "White",
    sprite: "jade_ring",
    maxLevel: 5,
    levels: [
      {
        description: "+10% max HP",
        effects: [createStatEffect("maxHp", 0.1, "multAdd")]
      },
      {
        description: "+10% max HP",
        effects: [createStatEffect("maxHp", 0.1, "multAdd")]
      },
      {
        description: "Gain +2 permanent max HP on kill, up to +30.",
        effects: [createSpecialEffect("killMaxHp", { gain: 2, maxBonus: 30 })]
      },
      {
        description: "+15% max HP",
        effects: [createStatEffect("maxHp", 0.15, "multAdd")]
      },
      {
        description: "Regenerate 2% max HP per second.",
        effects: [createStatEffect("hpRegenRatio", 0.02, "add")]
      }
    ]
  },
  {
    ringId: "ring_recovery",
    name: "Recovery Ring",
    rarity: "White",
    sprite: "silver_signet_ring",
    maxLevel: 5,
    levels: [
      {
        description: "Heal 3% max HP on kill.",
        effects: [createSpecialEffect("healOnKill", { healRatio: 0.03 })]
      },
      {
        description: "Additional 2% max HP on kill.",
        effects: [createSpecialEffect("healOnKill", { healRatio: 0.02 })]
      },
      {
        description: "+50% healing effectiveness.",
        effects: [createStatEffect("healingEffectiveness", 0.5, "multAdd")]
      },
      {
        description: "Regenerate 1% max HP per second.",
        effects: [createStatEffect("hpRegenRatio", 0.01, "add")]
      },
      {
        description: "On hit, heal 5 HP. 2s cooldown.",
        effects: [createSpecialEffect("healOnHit", { amount: 5, cooldown: 2 })]
      }
    ]
  },
  {
    ringId: "ring_defense",
    name: "Defense Ring",
    rarity: "White",
    sprite: "gold_band_ring",
    maxLevel: 5,
    levels: [
      {
        description: "-6% damage taken",
        effects: [createStatEffect("damageTaken", -0.06, "multAdd")]
      },
      {
        description: "-6% damage taken",
        effects: [createStatEffect("damageTaken", -0.06, "multAdd")]
      },
      {
        description: "-3 flat damage taken, minimum 1 damage still applies.",
        effects: [createStatEffect("damageReduction", 3, "add")]
      },
      {
        description: "-8% damage taken",
        effects: [createStatEffect("damageTaken", -0.08, "multAdd")]
      },
      {
        description: "Heal 10% of prevented damage.",
        effects: [createSpecialEffect("healPreventedDamage", { healRatio: 0.1 })]
      }
    ]
  },
  {
    ringId: "ring_gold",
    name: "Gold Ring",
    rarity: "White",
    sprite: "gold_signet_ring",
    maxLevel: 5,
    levels: [
      {
        description: "+10% gold",
        effects: [createStatEffect("goldGain", 0.1, "multAdd")]
      },
      {
        description: "+10% gold. Increased pickup radius.",
        effects: [
          createStatEffect("goldGain", 0.1, "multAdd"),
          createStatEffect("pickupRadius", 0.35, "multAdd")
        ]
      },
      {
        description: "+10% uncommon ring drop rate.",
        effects: [createStatEffect("uncommonDropRate", 0.1, "multAdd")]
      },
      {
        description: "+10% gold",
        effects: [createStatEffect("goldGain", 0.1, "multAdd")]
      },
      {
        description: "+5% rare ring drop rate.",
        effects: [createStatEffect("rareDropRate", 0.05, "multAdd")]
      }
    ]
  },
  {
    ringId: "ring_lifesteal",
    name: "Lifesteal Ring",
    rarity: "Uncommon",
    sprite: "jade_ring",
    maxLevel: 5,
    levels: [
      {
        description: "Gain 12% lifesteal.",
        effects: [createStatEffect("lifestealRatio", 0.12, "add")]
      },
      {
        description: "Gain 8% lifesteal. After taking damage, lifesteal is increased by 50% for 1s.",
        effects: [
          createStatEffect("lifestealRatio", 0.08, "add"),
          createSpecialEffect("lifestealSurge", { multiplier: 1.5, duration: 1 })
        ]
      },
      {
        description: "After restoring 50 HP through lifesteal, enter Bloodlust for 3s: +20% movement speed, +20% attack speed, +10% lifesteal. Lifesteal extends Bloodlust by 0.5s, up to 3 additional seconds.",
        effects: [createSpecialEffect("bloodlustLifesteal", {
          threshold: 50,
          duration: 3,
          moveSpeedBonus: 0.2,
          attackSpeedBonus: 0.2,
          lifestealBonus: 0.1,
          extensionPerLifesteal: 0.5,
          maxExtension: 3
        })]
      },
      {
        description: "Excess lifesteal is converted into Shield, up to 30% of max HP. Shield decays over time.",
        effects: [createSpecialEffect("lifestealOverhealShield", { maxShieldRatio: 0.3, decayPerSecondRatio: 0.04 })]
      },
      {
        description: "When entering Bloodlust, convert 50% of current HP into Shield. For every 10 HP converted, gain +1% lifesteal up to +15%.",
        effects: [createSpecialEffect("bloodlustHpToShield", { hpRatio: 0.5, lifestealPerTenHp: 0.01, maxLifestealBonus: 0.15 })]
      }
    ]
  },
  {
    ringId: "ring_shield",
    name: "Shield Ring",
    rarity: "Uncommon",
    sprite: "silver_signet_ring_2",
    maxLevel: 5,
    levels: [
      {
        description: "Gain 20 Shield. Shield regenerates while out of combat.",
        effects: [createSpecialEffect("shieldCore", { baseShield: 20, regenDelay: 2, regenPerSecond: 10 })]
      },
      {
        description: "When your Shield breaks, release a shockwave that knocks back nearby enemies and destroys nearby projectiles.",
        effects: [createSpecialEffect("shieldBreakShockwave", { radius: 120, knockback: 56 })]
      },
      {
        description: "Attacks have a 10% chance to generate 10 Shield, up to 30 bonus Shield. Can occur at most once every 0.5s.",
        effects: [createSpecialEffect("shieldOnAttack", { chance: 0.1, shield: 10, maxBonusShield: 30, cooldown: 0.5 })]
      },
      {
        description: "When your Shield breaks, any excess damage is negated.",
        effects: [createSpecialEffect("shieldBreakNegateOverflow")]
      },
      {
        description: "When damage would reduce HP below 20%, gain 50 Shield instead once per biome.",
        effects: [createSpecialEffect("shieldEmergencyBarrier", { thresholdRatio: 0.2, shield: 50 })]
      }
    ]
  },
  {
    ringId: "ring_counterattack",
    name: "Counterattack Ring",
    rarity: "Uncommon",
    sprite: "twisted_metal_ring",
    maxLevel: 5,
    levels: [
      {
        description: "When hit, fire 8 knives in all directions. 2s cooldown.",
        effects: [createSpecialEffect("counterKnives", { count: 8, cooldown: 2 })]
      },
      {
        description: "When hit, perform a basic attack on the nearest enemy. 1s cooldown.",
        effects: [createSpecialEffect("counterBasicStrike", { cooldown: 1 })]
      },
      {
        description: "When hit, gain 0.1s invulnerability.",
        effects: [createSpecialEffect("counterInvulnerability", { duration: 0.1 })]
      },
      {
        description: "When hit, gain +20% movement speed and +20% attack speed for 2s.",
        effects: [createSpecialEffect("counterHaste", { duration: 2, moveSpeedBonus: 0.2, attackSpeedBonus: 0.2 })]
      },
      {
        description: "Every 4s, take 1 damage to trigger on-hit effects at 50% effectiveness.",
        effects: [createSpecialEffect("counterSelfTrigger", { interval: 4, selfDamage: 1, effectiveness: 0.5 })]
      }
    ]
  },
  {
    ringId: "ring_chain_explosion",
    name: "Chain Explosion Ring",
    rarity: "Uncommon",
    sprite: "gold_signet_ring",
    maxLevel: 5,
    levels: [
      {
        description: "Attacks have a 10% chance to explode, dealing 50% of hit damage to nearby enemies.",
        effects: [createSpecialEffect("attackExplosion", { chance: 0.1, damageRatio: 0.5, radius: 90 })]
      },
      {
        description: "Enemies have a 10% chance to explode on death, dealing 100% ATK damage to nearby enemies. Death explosions cannot chain.",
        effects: [createSpecialEffect("deathExplosion", { chance: 0.1, damageRatio: 1, radius: 100 })]
      },
      {
        description: "If you kill 5 enemies within 2s, gain +30% movement speed and +30% attack speed for 2s.",
        effects: [createSpecialEffect("killMomentum", { killsRequired: 5, window: 2, duration: 2, moveSpeedBonus: 0.3, attackSpeedBonus: 0.3 })]
      },
      {
        description: "While 5 or more enemies are nearby, gain +20% ATK and 20% damage reduction.",
        effects: [createSpecialEffect("crowdPower", { nearbyRequired: 5, radius: 180, damageBonus: 0.2, damageReduction: 0.2 })]
      },
      {
        description: "On kill, 10% chance to revive the enemy with 5% HP. Revived enemies cannot be revived again.",
        effects: [createSpecialEffect("enemyRevive", { chance: 0.1, hpRatio: 0.05 })]
      }
    ]
  },
  {
    ringId: "ring_critical_damage",
    name: "Critical Damage Ring",
    rarity: "Uncommon",
    sprite: "ruby_ring",
    maxLevel: 3,
    levels: [
      {
        description: "Gain 20% critical damage.",
        effects: [createStatEffect("critDamage", 0.2, "multAdd")]
      },
      {
        description: "Gain 10% critical chance. Critical hits grant 10% critical damage for 2s, stacking up to 4 times. Each stack refreshes duration.",
        effects: [
          createStatEffect("critChance", 0.1, "add"),
          createSpecialEffect("critDamageStacks", { critDamageBonus: 0.1, duration: 2, maxStacks: 4 })
        ]
      },
      {
        description: "After dashing, gain 20% critical chance and 40% critical damage until your next critical hit.",
        effects: [createSpecialEffect("dashCritWindow", { critChanceBonus: 0.2, critDamageBonus: 0.4 })]
      }
    ]
  },
  {
    ringId: "ring_dagger",
    name: "Dagger Ring",
    rarity: "Uncommon",
    sprite: "silver_signet_ring",
    maxLevel: 5,
    levels: [
      {
        description: "When you attack, 10% chance to shoot a knife.",
        effects: [createSpecialEffect("daggerKnifeProc", { chance: 0.1 })]
      },
      {
        description: "When you shoot a knife, 10% chance to shoot another knife.",
        effects: [createSpecialEffect("daggerKnifeChain", { chance: 0.1 })]
      },
      {
        description: "Your knives gain 10% damage per second while flying, up to 50%.",
        effects: [createSpecialEffect("daggerKnifeRamp", { damagePerSecond: 0.1, maxBonus: 0.5 })]
      },
      {
        description: "Your knives slightly home.",
        effects: [createSpecialEffect("daggerKnifeHoming", { homingRadius: 220, homingTurnRate: 4 })]
      },
      {
        description: "When your knife hits another knife, they create an explosion dealing 100% ATK damage.",
        effects: [createSpecialEffect("daggerKnifeCollisionExplosion", { damageRatio: 1, radius: 80 })]
      }
    ]
  },
  {
    ringId: "ring_of_mirror",
    name: "Ring of Mirror",
    rarity: "Uncommon",
    sprite: "silver_signet_ring_2",
    maxLevel: 1,
    levels: [
      {
        description: "Select this ring, then click any owned non-rare ring to upgrade it by 1 level. Consumed on use.",
        effects: [createSpecialEffect("mirrorUpgradeCatalyst")]
      }
    ]
  },
  {
    ringId: "ring_lucky",
    name: "Lucky Ring",
    rarity: "Rare",
    sprite: "gold_signet_ring",
    maxLevel: 1,
    levels: [
      {
        description: "All chance-based effects are Lucky: roll twice and take the better result.",
        effects: [createSpecialEffect("luckyChance")]
      }
    ]
  },
  {
    ringId: "ring_inferno",
    name: "Inferno Ring",
    rarity: "Rare",
    sprite: "ruby_ring",
    maxLevel: 1,
    levels: [
      {
        description: "Your attacks always apply Burn. Burning enemies explode on death for 30% ATK per Burn stack. Inferno explosions cannot chain.",
        effects: [createSpecialEffect("infernoBurn", { duration: 4, burnStacks: 1, burnDamageRatio: 0.2, explosionDamageRatioPerStack: 0.3, explosionRadius: 110 })]
      }
    ]
  },
  {
    ringId: "ring_mirror",
    name: "Mirror Ring",
    rarity: "Rare",
    sprite: "silver_signet_ring_2",
    maxLevel: 1,
    levels: [
      {
        description: "Every 10s, summon a clone with 50% of your max HP. You can damage your own clone, and damaging it triggers your on-hit ring effects. Clones do not create clones.",
        effects: [createSpecialEffect("mirrorClone", { interval: 10, hpRatio: 0.5 })]
      }
    ]
  },
  {
    ringId: "ring_dragon",
    name: "Dragon Ring",
    rarity: "Rare",
    sprite: "twisted_gold_ring",
    maxLevel: 1,
    levels: [
      {
        description: "For every 100 max HP you have, summon a Dragon ally, up to 4. Dragons scale modestly with your power.",
        effects: [createSpecialEffect("dragonLegion", { hpPerDragon: 100, maxDragons: 4, contactDamageRatio: 0.35, projectileDamageRatio: 0.35 })]
      }
    ]
  },
  {
    ringId: "ring_chaos_rebirth",
    name: "Chaos Rebirth Ring",
    rarity: "Rare",
    sprite: "onyx_ring",
    maxLevel: 1,
    levels: [
      {
        description: "On death, revive once and transform all owned rings into different rings of the same rarity.",
        effects: [createSpecialEffect("chaosRebirth", { healRatio: 0.5 })]
      }
    ]
  },
  {
    ringId: "ring_phantom_knife",
    name: "Phantom Knife Ring",
    rarity: "Rare",
    sprite: "twisted_metal_ring",
    maxLevel: 1,
    levels: [
      {
        description: "Your knives pierce up to 5 enemies, gain infinite range, and fly at double speed.",
        effects: [createSpecialEffect("phantomKnife", { pierce: 5, speedMultiplier: 2, rangeMultiplier: 999 })]
      }
    ]
  }
];

const RING_ID_TO_ICON_KEY = Object.freeze({
  ring_attack_speed: "ringIconAttackSpeed",
  ring_critical: "ringIconCriticalChance",
  ring_movement: "ringIconMovementSpeed",
  ring_berserker: "ringIconAttack",
  ring_health: "ringIconHealth",
  ring_recovery: "ringIconRecovery",
  ring_defense: "ringIconDefense",
  ring_gold: "ringIconGold",
  ring_lifesteal: "ringIconLifesteal",
  ring_counterattack: "ringIconCounterattack",
  ring_critical_damage: "ringIconCriticalDamage",
  ring_dagger: "ringIconDagger",
  ring_lucky: "ringIconLucky",
  ring_inferno: "ringIconInferno",
  ring_mirror: "ringIconMirror",
  ring_dragon: "ringIconDragon",
  ring_chaos_rebirth: "ringIconChaosRebirth",
  ring_phantom_knife: "ringIconPhantomKnife",
  ring_of_mirror: "ringIconMirror" // Using Mirror as fallback for of_mirror
});

const PROCESSED_RING_DEFS = RAW_RING_DEFS.map((ring, index) => ({
  ...ring,
  sortOrder: index,
  description: ring.levels.map((level, levelIndex) => `Lv${levelIndex + 1}: ${level.description}`).join(" "),
  dropRarity: RARITY_TO_DROP_RARITY[ring.rarity] || "normal",
  spriteCell: RING_SPRITE_TO_CELL[ring.sprite] || RING_SPRITE_TO_CELL.gold_band_ring,
  iconAssetKey: RING_ID_TO_ICON_KEY[ring.ringId] || null
}));

const CANONICAL_RING_ID_BY_SPRITE = Object.freeze({
  sapphire_ring: "ring_attack_speed",
  ruby_ring: "ring_critical",
  gold_emerald_ring: "ring_movement",
  onyx_ring: "ring_berserker",
  jade_ring: "ring_health",
  silver_signet_ring: "ring_recovery",
  gold_band_ring: "ring_defense",
  gold_signet_ring: "ring_gold",
  silver_signet_ring_2: "ring_of_mirror",
  twisted_gold_ring: "ring_dragon",
  twisted_metal_ring: "ring_counterattack"
});

export const RING_DEFS = PROCESSED_RING_DEFS.map((ring) => ({
  ...ring,
  canonicalKey: ring.ringId
}));

const RING_DEF_BY_CANONICAL_KEY = new Map(RING_DEFS.map((ring) => [ring.canonicalKey, ring]));
const RING_DEF_BY_ID = new Map(RING_DEFS.map((ring) => [ring.ringId, ring]));
const RING_CANONICAL_KEY_BY_ID = new Map();

for (const ring of PROCESSED_RING_DEFS) {
  RING_CANONICAL_KEY_BY_ID.set(ring.ringId, ring.ringId);
}
for (const ring of RING_DEFS) {
  RING_CANONICAL_KEY_BY_ID.set(ring.canonicalKey, ring.canonicalKey);
}

export function getCanonicalRingKey(ringId) {
  const key = String(ringId || "");
  return RING_CANONICAL_KEY_BY_ID.get(key) || key;
}

export function getRingDefById(ringId) {
  const canonicalKey = getCanonicalRingKey(ringId);
  return RING_DEF_BY_CANONICAL_KEY.get(canonicalKey) || RING_DEF_BY_ID.get(String(ringId || "")) || null;
}

export function getAllRingDefs() {
  return [...RING_DEFS];
}

export function getRingDefsByDropRarity(rarity) {
  return RING_DEFS.filter((ring) => ring.dropRarity === rarity);
}

export function getRingRarityLabel(rarity) {
  return {
    normal: "White",
    uncommon: "Uncommon",
    rare: "Rare",
    white: "White"
  }[String(rarity || "").toLowerCase()] || "White";
}

export function getRingRarityColor(rarity) {
  return {
    normal: "#d1d5db",
    white: "#d1d5db",
    uncommon: "#60a5fa",
    rare: "#f59e0b"
  }[String(rarity || "").toLowerCase()] || "#d1d5db";
}

export function getRingScrapValueByRarity(rarity) {
  return {
    normal: 1,
    white: 1,
    uncommon: 2,
    rare: 3
  }[String(rarity || "").toLowerCase()] || 1;
}

export function getRingUpgradeCost(level) {
  return {
    1: 2,
    2: 3,
    3: 4,
    4: 5
  }[Math.max(1, Math.floor(level || 0))] || 0;
}

export const RING_ITEM_ATLAS = {
  assetKey: "itemsAtlas",
  src: "./assets/items/items.png",
  tileSize: ITEM_ATLAS_TILE,
  width: 352,
  height: 832
};
