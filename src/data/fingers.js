/**
 * FINGER INSTANCE SYSTEM
 * 
 * Fingers are no longer static definitions. They are instances
 * with 4 modular affix slots.
 */

import { getModById } from "./finger-mods.js";

function rollRange(range) {
  if (!range) return 0;
  return range.min + Math.random() * (range.max - range.min);
}

/**
 * Creates a unique Finger instance.
 * @param {string} id - Unique identifier for the instance.
 * @param {Object} mods - Map of slot to mod ID { main, secondary, hero, curse }.
 */
export function createFingerInstance(id, mods = {}) {
  const secondaryModId = mods.secondary || "attack_speed";
  const secondaryDef = getModById(secondaryModId);
  const secondaryValue = secondaryDef?.valueRange ? rollRange(secondaryDef.valueRange) : 0;

  return {
    id,
    mainModId: mods.main || "crit_status",
    secondaryModId,
    secondaryValue, // Rolled value stored on instance
    heroModId: mods.hero || "fireball_nova",
    curseId: mods.curse || "glass_cannon",
    
    // Modification state
    tuningUses: 0,
    imprintUses: 0,
    reforgeCount: 0,
    lockedSlots: new Set()
  };
}

/**
 * Returns the fully resolved mods for a Finger instance.
 */
export function getFingerResolvedMods(finger) {
  return {
    main: getModById(finger.mainModId),
    secondary: getModById(finger.secondaryModId),
    hero: getModById(finger.heroModId),
    curse: getModById(finger.curseId)
  };
}

/**
 * Starter Fingers for new players.
 */
export const STARTER_FINGERS = [
  createFingerInstance("starter_1", {
    main: "dash_echo",
    secondary: "atk_up",
    hero: "fireball_nova",
    curse: "glass_cannon"
  }),
  createFingerInstance("starter_2", {
    main: "crit_haste",
    secondary: "proj_speed",
    hero: "wind_pierce",
    curse: "static_drain"
  })
];

// ---------------------------------------------------------------------------
// LEGACY COMPATIBILITY
// The following section preserves the old static finger system data
// to prevent breaking existing game logic while the new system is integrated.
// ---------------------------------------------------------------------------

const FINGER_RARITY_ORDER = Object.freeze({
  normal: 0,
  uncommon: 1,
  rare: 2
});

function createLegacyFingerDef(id, rarity, name, description, config = {}) {
  return Object.freeze({
    id,
    rarity,
    name,
    description,
    slotScoped: !!config.slotScoped,
    effects: Object.freeze(config.effects ? [...config.effects] : [])
  });
}

export const FINGER_DEFS = Object.freeze([
  createLegacyFingerDef("finger_normal_attack_speed", "normal", "Normal Finger: Speed", "+10% Attack Speed.", {
    effects: [{ type: "stat", stat: "attackSpeed", op: "multAdd", value: 0.1 }]
  }),
  createLegacyFingerDef("finger_normal_attack", "normal", "Normal Finger: ATK", "+10% ATK.", {
    effects: [{ type: "stat", stat: "attack", op: "multAdd", value: 0.1 }]
  }),
  createLegacyFingerDef("finger_normal_hp", "normal", "Normal Finger: HP", "+10% HP.", {
    effects: [{ type: "stat", stat: "maxHp", op: "multAdd", value: 0.1 }]
  }),
  createLegacyFingerDef("finger_normal_bleed", "normal", "Normal Finger: Bleed", "+10% chance to apply bleeding.", {
    effects: [{ type: "special", effect: "bleedChanceOnHit", chance: 0.1, duration: 4, damagePerStack: 3, stacks: 1 }]
  }),
  createLegacyFingerDef("finger_uncommon_kill_boost", "uncommon", "Uncommon Finger: Hunter's Rush", "Every 10 kills, restore 10 HP and gain 20% move speed and attack speed for 4s.", {
    effects: [{ type: "special", effect: "killThresholdBuff", killThreshold: 10, healAmount: 10, moveSpeedBonus: 0.2, attackSpeedBonus: 0.2, duration: 4 }]
  }),
  createLegacyFingerDef("finger_uncommon_attack_flux", "uncommon", "Uncommon Finger: Frenzy Flux", "Every 10s, randomly gain -10% to -30% attack speed for 10s.", {
    effects: [{ type: "special", effect: "periodicAttackSpeedPenalty", interval: 10, duration: 10, minPenalty: 0.1, maxPenalty: 0.3 }]
  }),
  createLegacyFingerDef("finger_uncommon_biome_reward", "uncommon", "Uncommon Finger: Trail Tribute", "When you enter a new biome, restore 20 HP and gain 80 gold.", {
    effects: [{ type: "special", effect: "biomeEntryReward", healAmount: 20, goldAmount: 80 }]
  }),
  createLegacyFingerDef("finger_uncommon_double_attack", "uncommon", "Uncommon Finger: Echo Strike", "Your attacks have a 10% chance to fire twice.", {
    effects: [{ type: "special", effect: "doubleAttackChance", chance: 0.1 }]
  }),
  createLegacyFingerDef("finger_uncommon_empty_boon", "uncommon", "Uncommon Finger: Bare Grace", "If this finger has no ring, gain 10% lifesteal and move speed.", {
    slotScoped: true,
    effects: [{ type: "special", effect: "emptySlotBoon", lifesteal: 0.1, moveSpeedBonus: 0.1 }]
  }),
  createLegacyFingerDef("finger_rare_empty_explosion", "rare", "Rare Finger: Hollow Blast", "If this finger has no ring, your attacks explode on hit for 50% ATK damage.", {
    slotScoped: true,
    effects: [{ type: "special", effect: "emptySlotExplosion", damageRatio: 0.5, radius: 56 }]
  }),
  createLegacyFingerDef("finger_rare_double_ring", "rare", "Rare Finger: Ring Resonance", "Double the effect of the ring on this finger.", {
    slotScoped: true,
    effects: [{ type: "special", effect: "doubleRingEffect", multiplier: 2 }]
  }),
  createLegacyFingerDef("finger_rare_slide_attack", "rare", "Rare Finger: Slide Snap", "Fire an auto attack at a nearby enemy when you slide.", {
    effects: [{ type: "special", effect: "slideAutoAttack", range: 280 }]
  }),
  createLegacyFingerDef("finger_rare_dragon", "rare", "Rare Finger: Dragon Pact", "Every 15s summon dragons for 8s.", {
    effects: [{ type: "special", effect: "periodicDragonSummon", interval: 15, duration: 8 }]
  })
]);

export function getFingerDefById(fingerId) {
  return FINGER_DEFS.find((finger) => finger.id === String(fingerId || "")) || null;
}

export function getFingerDefsByRarity(rarity) {
  return FINGER_DEFS
    .filter((finger) => finger.rarity === rarity)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getFingerRarityOrder(rarity) {
  return FINGER_RARITY_ORDER[String(rarity || "").toLowerCase()] ?? 99;
}
