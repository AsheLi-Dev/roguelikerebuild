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
