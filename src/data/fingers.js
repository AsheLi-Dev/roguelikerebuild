const FINGER_RARITY_ORDER = Object.freeze({
  normal: 0,
  uncommon: 1,
  rare: 2
});

function createFingerDef(id, rarity, name, description, config = {}) {
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
  createFingerDef("finger_normal_attack_speed", "normal", "Normal Finger: Speed", "+10% Attack Speed.", {
    effects: [{ type: "stat", stat: "attackSpeed", op: "multAdd", value: 0.1 }]
  }),
  createFingerDef("finger_normal_attack", "normal", "Normal Finger: ATK", "+10% ATK.", {
    effects: [{ type: "stat", stat: "attack", op: "multAdd", value: 0.1 }]
  }),
  createFingerDef("finger_normal_hp", "normal", "Normal Finger: HP", "+10% HP.", {
    effects: [{ type: "stat", stat: "maxHp", op: "multAdd", value: 0.1 }]
  }),
  createFingerDef("finger_normal_bleed", "normal", "Normal Finger: Bleed", "+10% chance to apply bleeding.", {
    effects: [{ type: "special", effect: "bleedChanceOnHit", chance: 0.1, duration: 4, damagePerStack: 3, stacks: 1 }]
  }),
  createFingerDef("finger_uncommon_kill_boost", "uncommon", "Uncommon Finger: Hunter's Rush", "Every 10 kills, restore 10 HP and gain 20% move speed and attack speed for 4s.", {
    effects: [{ type: "special", effect: "killThresholdBuff", killThreshold: 10, healAmount: 10, moveSpeedBonus: 0.2, attackSpeedBonus: 0.2, duration: 4 }]
  }),
  createFingerDef("finger_uncommon_attack_flux", "uncommon", "Uncommon Finger: Frenzy Flux", "Every 10s, randomly gain -10% to -30% attack speed for 10s.", {
    effects: [{ type: "special", effect: "periodicAttackSpeedPenalty", interval: 10, duration: 10, minPenalty: 0.1, maxPenalty: 0.3 }]
  }),
  createFingerDef("finger_uncommon_biome_reward", "uncommon", "Uncommon Finger: Trail Tribute", "When you enter a new biome, restore 20 HP and gain 80 gold.", {
    effects: [{ type: "special", effect: "biomeEntryReward", healAmount: 20, goldAmount: 80 }]
  }),
  createFingerDef("finger_uncommon_double_attack", "uncommon", "Uncommon Finger: Echo Strike", "Your attacks have a 10% chance to fire twice.", {
    effects: [{ type: "special", effect: "doubleAttackChance", chance: 0.1 }]
  }),
  createFingerDef("finger_uncommon_empty_boon", "uncommon", "Uncommon Finger: Bare Grace", "If this finger has no ring, gain 10% lifesteal and move speed.", {
    slotScoped: true,
    effects: [{ type: "special", effect: "emptySlotBoon", lifesteal: 0.1, moveSpeedBonus: 0.1 }]
  }),
  createFingerDef("finger_rare_empty_explosion", "rare", "Rare Finger: Hollow Blast", "If this finger has no ring, your attacks explode on hit for 50% ATK damage.", {
    slotScoped: true,
    effects: [{ type: "special", effect: "emptySlotExplosion", damageRatio: 0.5, radius: 56 }]
  }),
  createFingerDef("finger_rare_double_ring", "rare", "Rare Finger: Ring Resonance", "Double the effect of the ring on this finger.", {
    slotScoped: true,
    effects: [{ type: "special", effect: "doubleRingEffect", multiplier: 2 }]
  }),
  createFingerDef("finger_rare_slide_attack", "rare", "Rare Finger: Slide Snap", "Fire an auto attack at a nearby enemy when you slide.", {
    effects: [{ type: "special", effect: "slideAutoAttack", range: 280 }]
  }),
  createFingerDef("finger_rare_dragon", "rare", "Rare Finger: Dragon Pact", "Every 15s summon dragons for 8s.", {
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
