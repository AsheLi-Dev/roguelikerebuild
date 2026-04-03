import { BIOME_ARCHETYPE } from "../systems/world-generation.js";

export const BIOME_SPAWN_PLANS = Object.freeze({
  [BIOME_ARCHETYPE.OPEN_SPACE]: Object.freeze([
    { tier: "minion" },
    { tier: "minion" },
    { tier: "minion", chance: 0.7 },
    { tier: "elite", chance: 0.55 }
  ]),
  [BIOME_ARCHETYPE.MINIBOSS]: Object.freeze([
    { tier: "miniBoss" }
  ]),
  [BIOME_ARCHETYPE.VAULT]: Object.freeze([
    { tier: "elite" },
    { tier: "elite" },
    { tier: "minion" },
    { tier: "minion", chance: 0.75 }
  ]),
  [BIOME_ARCHETYPE.RUINS]: Object.freeze([
    { tier: "minion" },
    { tier: "minion", chance: 0.7 },
    { tier: "elite", chance: 0.7 },
    { tier: "elite", chance: 0.45 }
  ]),
  [BIOME_ARCHETYPE.WOODS]: Object.freeze([
    { tier: "minion" },
    { tier: "elite" },
    { tier: "minion", chance: 0.65 },
    { tier: "elite", chance: 0.4 }
  ])
});

export function getBiomeSpawnPlan(archetype) {
  return BIOME_SPAWN_PLANS[archetype] || [];
}

export const ROW_SPAWN_MODIFIERS = Object.freeze({
  1: { minion: 1.15, elite: 0.65 },
  2: { minion: 1.0,  elite: 1.0  },
  3: { minion: 0.75, elite: 1.35 },
});

export const COLUMN_SPAWN_MODIFIERS = Object.freeze({
  0: { minion: 0.7,  elite: 0.5  },
  1: { minion: 0.9,  elite: 0.8  },
  2: { minion: 1.2,  elite: 1.2  },
  3: { minion: 0.8,  elite: 0.85 },
  4: { minion: 0.9,  elite: 1.1  },
});

export function getRowSpawnModifier(row, tier) {
  return ROW_SPAWN_MODIFIERS[row]?.[tier] ?? 1;
}

export function getColumnSpawnModifier(col, tier) {
  return COLUMN_SPAWN_MODIFIERS[col]?.[tier] ?? 1;
}
