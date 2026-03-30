import { centerOf, createSeededRandom, distance, rectsOverlap } from "../core/runtime-utils.js";
import { createRingInstance, getRingDefById, getRingDefsByDropRarity } from "../data/rings.js";
import { SEARCHABLE_ARCHETYPE_PLANS, SEARCHABLE_DEFS, SEARCHABLE_INTERACT_RANGE } from "../data/searchables.js";
import { getModifiedChestCost } from "./rings.js";

const RING_DROP_PICKUP_RANGE = 24;
const RING_DROP_MAGNET_RANGE = 120;
const RING_DROP_MAGNET_SPEED = 340;

export function chooseRingDropRarity(def, random) {
  const roll = random();
  let threshold = 0;
  for (const entry of def.rarityChances || []) {
    threshold += entry.chance;
    if (roll < threshold) return entry.rarity;
  }
  return def.rarityChances?.[def.rarityChances.length - 1]?.rarity || "normal";
}

function getSearchableCost(costBase, roomIndex, random) {
  return costBase + roomIndex * 4 + Math.floor(random() * 5) * 2;
}

function buildChestCandidateOffsets(random) {
  const base = [
    [0.5, 0.5],
    [0.34, 0.34],
    [0.66, 0.34],
    [0.34, 0.66],
    [0.66, 0.66],
    [0.5, 0.24],
    [0.5, 0.76],
    [0.24, 0.5],
    [0.76, 0.5]
  ];
  return [...base].sort(() => random() - 0.5);
}

function overlapsAny(rect, rects) {
  return rects.some((other) => rectsOverlap(rect, other));
}

function findChestPlacement(world, chestDef, cellBounds, existingRects, random) {
  const margin = 96;
  for (const [nx, ny] of buildChestCandidateOffsets(random)) {
    const x = Math.round(cellBounds.x + margin + (cellBounds.w - margin * 2 - chestDef.width) * nx);
    const y = Math.round(cellBounds.y + margin + (cellBounds.h - margin * 2 - chestDef.height) * ny);
    const rect = { x, y, w: chestDef.width, h: chestDef.height };
    if (overlapsAny(rect, world.collisionRects || [])) continue;
    if (overlapsAny(rect, existingRects)) continue;
    if (rectsOverlap(rect, world.start) || rectsOverlap(rect, world.exit)) continue;
    return rect;
  }
  return null;
}

export function spawnRoomSearchables(world, roomIndex, seed) {
  const random = createSeededRandom(seed + roomIndex * 5147 + 77);
  const searchables = [];
  const placedRects = [world.start, world.exit];
  let nextId = 1;

  function spawnChestsForType(cellBounds, archetype, chestTypeId, count, costBase) {
    const chestDef = SEARCHABLE_DEFS[chestTypeId];
    if (!chestDef) return;
    for (let index = 0; index < count; index += 1) {
      const placement = findChestPlacement(world, chestDef, cellBounds, placedRects, random);
      if (!placement) continue;
      const searchable = {
        id: `searchable_${nextId}`,
        typeId: chestTypeId,
        cellArchetype: archetype,
        baseGoldCost: getSearchableCost(costBase, roomIndex, random),
        isOpen: false,
        openTimer: 0,
        ...placement
      };
      nextId += 1;
      searchables.push(searchable);
      placedRects.push(placement);
    }
  }

  for (let row = 0; row < world.archetypeGrid.grid.length; row += 1) {
    for (let col = 0; col < world.archetypeGrid.grid[row].length; col += 1) {
      const archetype = world.archetypeGrid.grid[row][col];
      const plan = SEARCHABLE_ARCHETYPE_PLANS[archetype] || SEARCHABLE_ARCHETYPE_PLANS.empty;
      const totalChests = (plan.smallChestCount || 0) + (plan.largeChestCount || 0);
      if (!totalChests) continue;
      if (plan.chance && random() > plan.chance) continue;
      const cellBounds = world.biomeCellBounds(col, row);
      spawnChestsForType(cellBounds, archetype, "smallChest", plan.smallChestCount || 0, plan.costBase);
      spawnChestsForType(cellBounds, archetype, "largeChest", plan.largeChestCount || 0, plan.costBase);
    }
  }

  return searchables;
}

export function createRingDrop(game, ringId, x, y) {
  const ringDef = getRingDefById(ringId);
  if (!ringDef) return;
  game.ringDrops.push({
    id: `${ringId}_${game.nextRingInstanceId}`,
    ringId,
    x,
    y,
    bobClock: 0,
    spriteCell: ringDef.spriteCell,
    rarity: ringDef.dropRarity
  });
}

export function getSearchableGoldCost(game, searchable) {
  return getModifiedChestCost(game, searchable.baseGoldCost ?? searchable.goldCost ?? 0);
}

export function openSearchable(game, searchable, options = {}) {
  if (searchable.isOpen) return false;
  const free = !!options.free;
  const goldCost = getSearchableGoldCost(game, searchable);
  const searchableDef = SEARCHABLE_DEFS[searchable.typeId];
  if (!searchableDef) return false;
  searchable.goldCost = goldCost;
  if (!free && !game.spendGold(goldCost)) return false;
  const random = createSeededRandom(game.seed + searchable.x * 7 + searchable.y * 13 + game.roomIndex * 53);
  const rarity = chooseRingDropRarity(searchableDef, random);
  const pool = getRingDefsByDropRarity(rarity);
  if (!pool.length) return false;
  const ringDef = pool[Math.floor(random() * pool.length)];
  searchable.isOpen = true;
  searchable.openTimer = searchableDef.openAnimDuration || 0;
  createRingDrop(game, ringDef.ringId, searchable.x + searchable.w * 0.5, searchable.y - 6);
  return true;
}

function updateRingDrops(game, dt) {
  const playerCenter = centerOf(game.player);
  const remaining = [];
  for (const drop of game.ringDrops) {
    drop.bobClock += dt;
    const dist = distance(playerCenter.x, playerCenter.y, drop.x, drop.y);
    if (dist <= RING_DROP_PICKUP_RANGE) {
      game.addRingToInventory(drop.ringId);
      continue;
    }
    if (dist <= RING_DROP_MAGNET_RANGE && dist > 0.001) {
      const speed = Math.min(RING_DROP_MAGNET_SPEED * dt, dist);
      drop.x += ((playerCenter.x - drop.x) / dist) * speed;
      drop.y += ((playerCenter.y - drop.y) / dist) * speed;
    }
    remaining.push(drop);
  }
  game.ringDrops = remaining;
}

export function updateSearchables(game, dt) {
  for (const searchable of game.searchables || []) {
    searchable.openTimer = Math.max(0, (searchable.openTimer || 0) - dt);
  }
  updateRingDrops(game, dt);
  if (!game.input.wasPressed("e")) return;
  const playerCenter = centerOf(game.player);
  const interactable = game.searchables
    .filter((searchable) => !searchable.isOpen)
    .map((searchable) => ({
      searchable,
      dist: distance(playerCenter.x, playerCenter.y, searchable.x + searchable.w * 0.5, searchable.y + searchable.h * 0.5)
    }))
    .filter((entry) => entry.dist <= SEARCHABLE_INTERACT_RANGE)
    .sort((a, b) => a.dist - b.dist)[0];
  if (!interactable) return;
  openSearchable(game, interactable.searchable);
}

export function getSearchableInteractState(game, searchable) {
  const playerCenter = centerOf(game.player);
  const dist = distance(playerCenter.x, playerCenter.y, searchable.x + searchable.w * 0.5, searchable.y + searchable.h * 0.5);
  const goldCost = getSearchableGoldCost(game, searchable);
  return {
    inRange: dist <= SEARCHABLE_INTERACT_RANGE,
    affordable: game.gold >= goldCost,
    goldCost
  };
}

export function getRingItemIconStyle(ringDef, size = 22) {
  const scale = size / 32;
  return {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: "url('./assets/items/items.png')",
    backgroundRepeat: "no-repeat",
    backgroundPosition: `${-ringDef.spriteCell.col * 32 * scale}px ${-ringDef.spriteCell.row * 32 * scale}px`,
    backgroundSize: `${352 * scale}px ${832 * scale}px`
  };
}

export { SEARCHABLE_INTERACT_RANGE, createRingInstance };
