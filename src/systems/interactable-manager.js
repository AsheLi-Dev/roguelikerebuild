import { createSeededRandom, rectsOverlap } from "../core/runtime-utils.js";
import { spawnRoomBreakables } from "./breakables.js";
import { spawnRoomSearchables } from "./searchables.js";
import { SEARCHABLE_DEFS } from "../data/searchables.js";
import { getAffinitySpawnWeight } from "./interactable-affinity.js";

// ---------------------------------------------------------------------------
// Budget — how many interactable slots each biome archetype gets per cell.
// Adjust counts and chances here before touching spawn logic.
// ---------------------------------------------------------------------------
const INTERACTABLE_BUDGET = {
  openSpace:  { total: 3, chance: 1.0 },
  deepWoods:  { total: 3, chance: 1.0 },
  combat:     { total: 2, chance: 0.8 },
  vault:      { total: 4, chance: 1.0 },
  miniboss:   { total: 2, chance: 0.6 },
  start:      { total: 0, chance: 0   },
  empty:      { total: 0, chance: 0   },
};

// Column 3 (Recovery) always gets 4 interactable slots regardless of archetype.
const COLUMN_BUDGET_OVERRIDES = {
  3: { total: 4, chance: 1.0 },
};

// ---------------------------------------------------------------------------
// Registry — one entry per interactable type the manager knows about.
// Add new types here; the spawn loop will pick them up automatically.
//
// Each entry:
//   id        — unique string key
//   category  — "searchable" | "breakable" | "prop"  (for future filtering)
//   weight    — relative spawn weight within a budget slot
//   maxPerRoom — hard cap across the whole room (0 = unlimited)
//   spawn(world, roomIndex, seed, placedRects, nextIdRef, random)
//             — returns a placed object or null if placement failed
// ---------------------------------------------------------------------------
const INTERACTABLE_REGISTRY = [
  // Existing systems — delegate to their own spawn helpers so nothing breaks.
  {
    id: "searchables_batch",
    category: "searchable",
    weight: 0,           // weight 0 = managed externally, not drawn from budget
    maxPerRoom: 0,
    spawn: null,         // handled by spawnRoomSearchables directly
  },
  {
    id: "breakables_batch",
    category: "breakable",
    weight: 0,
    maxPerRoom: 0,
    spawn: null,         // handled by spawnRoomBreakables directly
  },

  // -------------------------------------------------------------------------
  // Cursed Anvil — 50/50 ring upgrade or curse for the next biome
  // -------------------------------------------------------------------------
  {
    id: "cursedAnvil",
    category: "prop",
    weight: 15,
    getWeight() { return getAffinitySpawnWeight("cursedAnvil"); },
    maxPerRoom: 1,
    spawn(world, _roomIndex, _seed, placedRects, nextIdRef, random, cellBounds) {
      const def = SEARCHABLE_DEFS.cursedAnvil;
      if (!def) return null;
      const rect = findFreePlacementInCell(world, cellBounds, def.width, def.height, placedRects, random);
      if (!rect) return null;
      return {
        id: `cursed_anvil_${nextIdRef.value}`,
        typeId: "cursedAnvil",
        isOpen: false,
        openTimer: 0,
        ...rect
      };
    }
  },

  // -------------------------------------------------------------------------
  // Treasure Spirit — rare event that guides the player through 3 stops
  // -------------------------------------------------------------------------
  {
    id: "treasureSpirit",
    category: "prop",
    weight: 8,
    getWeight() { return getAffinitySpawnWeight("treasureSpirit"); },
    maxPerRoom: 1,
    spawn(world, _roomIndex, _seed, placedRects, nextIdRef, random, cellBounds) {
      const def = SEARCHABLE_DEFS.treasureSpirit;
      if (!def) return null;
      const rect = findFreePlacementInCell(world, cellBounds, def.width, def.height, placedRects, random);
      if (!rect) return null;
      return {
        id: `treasure_spirit_${nextIdRef.value}`,
        typeId: "treasureSpirit",
        isOpen: false,
        openTimer: 0,
        ...rect
      };
    }
  },

  // -------------------------------------------------------------------------
  // Devil Merchant — rare sinister shop: buy rings with HP, sell for max HP
  // -------------------------------------------------------------------------
  {
    id: "devilMerchant",
    category: "prop",
    weight: 6,
    getWeight() { return getAffinitySpawnWeight("devilMerchant"); },
    maxPerRoom: 1,
    spawn(world, _roomIndex, _seed, placedRects, nextIdRef, random, cellBounds) {
      const def = SEARCHABLE_DEFS.devilMerchant;
      if (!def) return null;
      const rect = findFreePlacementInCell(world, cellBounds, def.width, def.height, placedRects, random);
      if (!rect) return null;
      return {
        id: `devil_merchant_${nextIdRef.value}`,
        typeId: "devilMerchant",
        isOpen: false,
        openTimer: 0,
        ...rect
      };
    }
  },

  // -------------------------------------------------------------------------
  // Stub slots — fill these in as you add new interactable types.
  // -------------------------------------------------------------------------
  // {
  //   id: "shrine_of_power",
  //   category: "prop",
  //   weight: 10,
  //   maxPerRoom: 1,
  //   spawn(world, roomIndex, seed, placedRects, nextIdRef, random) {
  //     // find a placement, build the object, push rect, return object or null
  //     return null;
  //   },
  // },
];

// ---------------------------------------------------------------------------
// Placement helpers (shared across all spawn callbacks)
// ---------------------------------------------------------------------------

export function findFreePlacement(world, w, h, placedRects, random, margin = 80) {
  const maxX = Math.max(margin, world.width - w - margin);
  const maxY = Math.max(margin, world.height - h - margin);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const x = Math.round(margin + random() * Math.max(0, maxX - margin));
    const y = Math.round(margin + random() * Math.max(0, maxY - margin));
    const rect = { x, y, w, h };
    if (rectsOverlap(rect, world.start) || rectsOverlap(rect, world.exit)) continue;
    if ((world.collisionRects || []).some((wall) => rectsOverlap(rect, wall))) continue;
    if (placedRects.some((other) => rectsOverlap(rect, other))) continue;
    return rect;
  }
  return null;
}

export function findFreePlacementInCell(world, cellBounds, w, h, placedRects, random, margin = 72) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const x = Math.round(cellBounds.x + margin + random() * Math.max(0, cellBounds.w - margin * 2 - w));
    const y = Math.round(cellBounds.y + margin + random() * Math.max(0, cellBounds.h - margin * 2 - h));
    const rect = { x, y, w, h };
    if (rectsOverlap(rect, world.start) || rectsOverlap(rect, world.exit)) continue;
    if ((world.collisionRects || []).some((wall) => rectsOverlap(rect, wall))) continue;
    if (placedRects.some((other) => rectsOverlap(rect, other))) continue;
    return rect;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Weighted random pick from registry (skips weight-0 entries)
// ---------------------------------------------------------------------------
function pickRegistryEntry(entries, random) {
  const pool = entries.filter((e) => {
    const w = e.getWeight?.() ?? e.weight;
    return w > 0 && typeof e.spawn === "function";
  });
  if (!pool.length) return null;
  const total = pool.reduce((sum, e) => sum + (e.getWeight?.() ?? e.weight), 0);
  let roll = random() * total;
  for (const entry of pool) {
    roll -= entry.getWeight?.() ?? entry.weight;
    if (roll <= 0) return entry;
  }
  return pool[pool.length - 1];
}

// ---------------------------------------------------------------------------
// Main entry point — replaces the two direct calls in roguelike-game.js.
//
// Returns { searchables, breakables, props }
// roguelike-game.js can spread these onto its own state as needed.
// ---------------------------------------------------------------------------
export function spawnRoomInteractables(world, roomIndex, seed, progressionIndex = roomIndex) {
  // --- existing systems (unchanged behaviour) ---
  const searchables = spawnRoomSearchables(world, roomIndex, seed, progressionIndex);
  const breakables  = spawnRoomBreakables(world, searchables, roomIndex, seed, progressionIndex);

  // --- new budget-driven props ---
  const props = spawnBudgetedProps(world, roomIndex, seed, searchables, breakables);

  return { searchables, breakables, props };
}

// ---------------------------------------------------------------------------
// Budget-driven spawn pass for new interactable types.
// Iterates every biome cell, draws from INTERACTABLE_BUDGET, and calls the
// matching registry entry's spawn() callback.
// ---------------------------------------------------------------------------
function spawnBudgetedProps(world, roomIndex, seed, searchables, breakables) {
  const random = createSeededRandom(seed + roomIndex * 6271 + 919);
  const props = [];

  // Build the shared exclusion list from already-placed objects.
  const placedRects = [
    world.start,
    world.exit,
    ...searchables.map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h })),
    ...breakables.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })),
  ];

  // Per-type room caps tracker.
  const spawnedCounts = {};

  const nextIdRef = { value: 1 };

  for (let row = 0; row < world.archetypeGrid.grid.length; row += 1) {
    for (let col = 0; col < world.archetypeGrid.grid[row].length; col += 1) {
      const archetype = world.archetypeGrid.grid[row][col];
      const budget = COLUMN_BUDGET_OVERRIDES[col] ?? INTERACTABLE_BUDGET[archetype];
      if (!budget || budget.total <= 0) continue;
      if (random() > budget.chance) continue;

      const cellBounds = world.biomeCellBounds(col, row);

      for (let slot = 0; slot < budget.total; slot += 1) {
        const entry = pickRegistryEntry(INTERACTABLE_REGISTRY, random);
        if (!entry) continue;

        // Enforce per-room cap.
        if (entry.maxPerRoom > 0) {
          spawnedCounts[entry.id] = spawnedCounts[entry.id] || 0;
          if (spawnedCounts[entry.id] >= entry.maxPerRoom) continue;
        }

        const obj = entry.spawn(world, roomIndex, seed, placedRects, nextIdRef, random, cellBounds);
        if (!obj) continue;

        props.push(obj);
        placedRects.push({ x: obj.x, y: obj.y, w: obj.w, h: obj.h });
        spawnedCounts[entry.id] = (spawnedCounts[entry.id] || 0) + 1;
        nextIdRef.value += 1;
      }
    }
  }

  return props;
}
