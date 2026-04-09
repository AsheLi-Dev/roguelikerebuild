import { centerOf, createSeededRandom, distance, getCanvasDiameterRadius, playThrottledAudio, rectsOverlap } from "../core/runtime-utils.js";
import { getRingDefById, getRingDefsByDropRarity, getRingRarityColor } from "../data/rings.js";
import { SEARCHABLE_ARCHETYPE_PLANS, SEARCHABLE_DEFS, SEARCHABLE_INTERACT_RANGE } from "../data/searchables.js";
import { clearPlayerStatSource, setPlayerStatSource } from "./player-stats.js";
import { getDropRateMultiplier, getModifiedChestCost, getRingPickupRadiusMultiplier, hasLuckyRing } from "./rings.js";
import { scaleGoldPrice } from "./economy.js";
import { spawnDamagePopup } from "./combat.js";
import { activateTreasureSpirit } from "./treasure-spirit.js";
import { activateDevilMerchant } from "./devil-merchant.js";
import { grantAffinityXp } from "./interactable-affinity.js";
import { onFingerChestOpened } from "./finger-experiment-runtime.js";

const RING_DROP_PICKUP_RANGE = 24;
const RING_DROP_MAGNET_SPEED = 340;
const RING_DROP_PICKUP_DELAY = 0.5;
const RING_DROP_MAGNET_DELAY = 0.5;
const YELLOW_WELL_SPEED_BUFF_SOURCE = "yellowWellBuff";
const YELLOW_WELL_SPEED_BUFF_MULT = 1.3;
const YELLOW_WELL_SPEED_BUFF_DURATION = 20;
const RED_WELL_HEAL_RATIO = 0.2;
const LIFE_SPRING_HEAL_RATIO = 0.4;
const PORTAL_OPEN_POPUP_TEXT = "Portal Open";
const UNKNOWN_WELL_STAT_SOURCE = "unknownWell";
const UNKNOWN_WELL_MAX_INTERACTIONS = 3;
const UNKNOWN_WELL_COSTS = [500, 1000, 1500];
const CHEST_COST_VARIANCE = 5;
const RING_SELECTION_UNCOMMON_CHANCE = 0.2;
const RING_SELECTION_CHOICES = 3;
const RING_SELECTION_PRICE_MULT = 1.2;
const CHEST_BASE_COSTS = Object.freeze({
  smallChest: 30,
  largeChest: 55
});
const CHEST_COST_MULTIPLIER_ANCHORS = Object.freeze([1.0, 1.22, 1.46, 1.72, 2.0, 2.31, 2.66]);

function playAudioClone(audio) {
  return playThrottledAudio(audio);
}

function isFreeInteractionType(interactionType) {
  return interactionType === "redWell"
    || interactionType === "yellowWell"
    || interactionType === "lifeSpring"
    || interactionType === "portal"
    || interactionType === "alchemyWorkshop"
    || interactionType === "blacksmith"
    || interactionType === "cursedAnvil"
    || interactionType === "treasureSpirit"
    || interactionType === "devilMerchant";
}

function getChestCostMultiplier(progressionIndex = 0) {
  const index = Math.max(0, Math.floor(progressionIndex));
  if (index < CHEST_COST_MULTIPLIER_ANCHORS.length) {
    return CHEST_COST_MULTIPLIER_ANCHORS[index];
  }
  const lastAnchor = CHEST_COST_MULTIPLIER_ANCHORS[CHEST_COST_MULTIPLIER_ANCHORS.length - 1];
  const extraSteps = index - (CHEST_COST_MULTIPLIER_ANCHORS.length - 1);
  return lastAnchor + extraSteps * 0.24;
}

export function isChestSearchable(searchable) {
  return searchable?.typeId === "smallChest" || searchable?.typeId === "largeChest";
}

export function chooseRingDropRarity(game, def, random) {
  const weightedEntries = (def.rarityChances || []).map((entry) => ({
    rarity: entry.rarity,
    chance: Math.max(0, (entry.chance || 0) * getDropRateMultiplier(game, entry.rarity))
  }));
  const chooseWeighted = () => {
    const totalChance = weightedEntries.reduce((sum, entry) => sum + entry.chance, 0);
    if (totalChance <= 0) return def.rarityChances?.[0]?.rarity || "normal";
    let roll = random() * totalChance;
    for (const entry of weightedEntries) {
      roll -= entry.chance;
      if (roll <= 0) return entry.rarity;
    }
    return weightedEntries[weightedEntries.length - 1]?.rarity || "normal";
  };
  const totalChance = weightedEntries.reduce((sum, entry) => sum + entry.chance, 0);
  if (totalChance <= 0) return def.rarityChances?.[0]?.rarity || "normal";
  const rarityRank = { normal: 0, uncommon: 1, rare: 2 };
  const first = chooseWeighted();
  if (!hasLuckyRing(game)) return first;
  const second = chooseWeighted();
  return (rarityRank[second] || 0) > (rarityRank[first] || 0) ? second : first;
}

function getSearchableCost(chestTypeId, progressionIndex, random) {
  const baseCost = CHEST_BASE_COSTS[chestTypeId] ?? 0;
  const biomeScaledCost = Math.round(baseCost * getChestCostMultiplier(progressionIndex));
  const variance = Math.floor(random() * (CHEST_COST_VARIANCE * 2 + 1)) - CHEST_COST_VARIANCE;
  return Math.max(0, biomeScaledCost + variance);
}

function buildUniqueRingOfferPool(pool, random, count = RING_SELECTION_CHOICES) {
  const remaining = [...pool];
  const offers = [];
  while (remaining.length > 0 && offers.length < count) {
    const index = Math.floor(random() * remaining.length);
    const [picked] = remaining.splice(index, 1);
    if (picked) offers.push(picked);
  }
  return offers;
}

function createRingSelectionOffers(random) {
  const rarity = random() < RING_SELECTION_UNCOMMON_CHANCE ? "uncommon" : "normal";
  const pool = getRingDefsByDropRarity(rarity);
  if (!pool.length) {
    return { rarity: "normal", offers: [] };
  }
  return {
    rarity,
    offers: buildUniqueRingOfferPool(pool, random)
  };
}

function createRingSelectionSearchable(world, roomIndex, placedRects, random, nextIdRef) {
  const searchableDef = SEARCHABLE_DEFS.ringSelectionShop;
  if (!searchableDef) return null;
  const placement = findPlacementInBiomeColumns(world, searchableDef, placedRects, random, [1, 2, 3])
    || findRandomPlacement(world, searchableDef, placedRects, random);
  if (!placement) return null;
  const offerSeed = createSeededRandom(seedHash(roomIndex, placement.x, placement.y));
  const selection = createRingSelectionOffers(offerSeed);
  const chestReferenceCost = getSearchableCost("smallChest", roomIndex, offerSeed);
  const searchable = {
    id: `searchable_${nextIdRef.value}`,
    typeId: "ringSelectionShop",
    cellArchetype: "openSpace",
    baseGoldCost: Math.max(1, Math.round(chestReferenceCost * RING_SELECTION_PRICE_MULT)),
    ringOfferRarity: selection.rarity,
    ringOffers: selection.offers.map((ringDef) => ringDef.ringId),
    isOpen: false,
    openTimer: 0,
    ...placement
  };
  nextIdRef.value += 1;
  placedRects.push(placement);
  return searchable;
}

function seedHash(roomIndex, x, y) {
  let value = ((roomIndex + 1) * 73856093) ^ ((x + 11) * 19349663) ^ ((y + 17) * 83492791);
  value ^= value >>> 13;
  value ^= value << 17;
  value ^= value >>> 5;
  return value >>> 0;
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

function findChestPlacementInBand(world, chestDef, cellBounds, existingRects, random, options = {}) {
  const margin = options.margin ?? 96;
  const innerX = cellBounds.x + margin;
  const innerY = cellBounds.y + margin;
  const innerW = Math.max(0, cellBounds.w - margin * 2);
  const innerH = Math.max(0, cellBounds.h - margin * 2);
  const xMin = options.xMin ?? 0;
  const xMax = options.xMax ?? 1;
  const yMin = options.yMin ?? 0;
  const yMax = options.yMax ?? 1;
  const band = {
    x: innerX + innerW * xMin,
    y: innerY + innerH * yMin,
    w: Math.max(0, innerW * Math.max(0, xMax - xMin)),
    h: Math.max(0, innerH * Math.max(0, yMax - yMin))
  };
  if (band.w < chestDef.width || band.h < chestDef.height) return null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const x = Math.round(band.x + random() * Math.max(0, band.w - chestDef.width));
    const y = Math.round(band.y + random() * Math.max(0, band.h - chestDef.height));
    const rect = { x, y, w: chestDef.width, h: chestDef.height };
    if (overlapsAny(rect, world.collisionRects || [])) continue;
    if (overlapsAny(rect, existingRects)) continue;
    if (rectsOverlap(rect, world.start) || rectsOverlap(rect, world.exit)) continue;
    return rect;
  }
  return null;
}

function findRandomPlacement(world, searchableDef, existingRects, random) {
  const margin = 80;
  const maxX = Math.max(margin, world.width - searchableDef.width - margin);
  const maxY = Math.max(margin, world.height - searchableDef.height - margin);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const x = Math.round(margin + random() * Math.max(0, maxX - margin));
    const y = Math.round(margin + random() * Math.max(0, maxY - margin));
    const rect = { x, y, w: searchableDef.width, h: searchableDef.height };
    if (overlapsAny(rect, world.collisionRects || [])) continue;
    if (overlapsAny(rect, existingRects)) continue;
    if (rectsOverlap(rect, world.start) || rectsOverlap(rect, world.exit)) continue;
    return rect;
  }
  return null;
}

function findPlacementInBiomeColumns(world, searchableDef, existingRects, random, allowedCols = []) {
  const candidateCells = [];
  for (let row = 0; row < world.archetypeGrid.grid.length; row += 1) {
    for (const col of allowedCols) {
      const archetype = world.archetypeGrid.grid[row]?.[col];
      if (archetype == null || archetype === "empty" || archetype === "start") continue;
      candidateCells.push(world.biomeCellBounds(col, row));
    }
  }
  if (!candidateCells.length) return null;

  const shuffledCells = [...candidateCells].sort(() => random() - 0.5);
  const margin = 80;
  for (const cellBounds of shuffledCells) {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const x = Math.round(
        cellBounds.x + margin + random() * Math.max(0, cellBounds.w - margin * 2 - searchableDef.width)
      );
      const y = Math.round(
        cellBounds.y + margin + random() * Math.max(0, cellBounds.h - margin * 2 - searchableDef.height)
      );
      const rect = { x, y, w: searchableDef.width, h: searchableDef.height };
      if (overlapsAny(rect, world.collisionRects || [])) continue;
      if (overlapsAny(rect, existingRects)) continue;
      if (rectsOverlap(rect, world.start) || rectsOverlap(rect, world.exit)) continue;
      return rect;
    }
  }

  return null;
}

function spawnSpecialWell(searchables, world, placedRects, searchableDef, typeId, random, nextIdRef, options = {}) {
  if (random() > 0.5) return;
  const placement = Array.isArray(options.allowedCols) && options.allowedCols.length
    ? findPlacementInBiomeColumns(world, searchableDef, placedRects, random, options.allowedCols)
    : findRandomPlacement(world, searchableDef, placedRects, random);
  if (!placement) return;
  const searchable = {
    id: `searchable_${nextIdRef.value}`,
    typeId,
    cellArchetype: "openSpace",
    isOpen: false,
    openTimer: 0,
    ...placement
  };
  nextIdRef.value += 1;
  searchables.push(searchable);
  placedRects.push(placement);
}

export function spawnRoomSearchables(world, roomIndex, seed, progressionIndex = roomIndex) {
  const random = createSeededRandom(seed + roomIndex * 5147 + 77);
  const searchables = [];
  const placedRects = [world.start, world.exit];
  const nextIdRef = { value: 1 };

  function spawnChestsForType(cellBounds, archetype, chestTypeId, count) {
    const chestDef = SEARCHABLE_DEFS[chestTypeId];
    if (!chestDef) return;
    for (let index = 0; index < count; index += 1) {
      const placement = findChestPlacement(world, chestDef, cellBounds, placedRects, random);
      if (!placement) continue;
      const searchable = {
        id: `searchable_${nextIdRef.value}`,
        typeId: chestTypeId,
        cellArchetype: archetype,
        baseGoldCost: getSearchableCost(chestTypeId, progressionIndex, random),
        isOpen: false,
        openTimer: 0,
        ...placement
      };
      nextIdRef.value += 1;
      searchables.push(searchable);
      placedRects.push(placement);
    }
  }

  for (let row = 0; row < world.archetypeGrid.grid.length; row += 1) {
    for (let col = 0; col < world.archetypeGrid.grid[row].length; col += 1) {
      const archetype = world.archetypeGrid.grid[row][col];
      if (archetype === "deepWoods") {
        if (random() > 0.5) continue;
        const chestDef = SEARCHABLE_DEFS.largeChest;
        if (!chestDef) continue;
        const cellBounds = world.biomeCellBounds(col, row);
        const placement = findChestPlacementInBand(world, chestDef, cellBounds, placedRects, random, {
          xMin: 0.12,
          xMax: 0.88,
          yMin: 0.72,
          yMax: 0.94
        });
        if (!placement) continue;
        const searchable = {
          id: `searchable_${nextIdRef.value}`,
          typeId: "largeChest",
          cellArchetype: archetype,
          baseGoldCost: getSearchableCost("largeChest", progressionIndex, random),
          isOpen: false,
          openTimer: 0,
          ...placement
        };
        nextIdRef.value += 1;
        searchables.push(searchable);
        placedRects.push(placement);
        continue;
      }
      const plan = SEARCHABLE_ARCHETYPE_PLANS[archetype] || SEARCHABLE_ARCHETYPE_PLANS.empty;
      const totalChests = (plan.smallChestCount || 0) + (plan.largeChestCount || 0);
      if (!totalChests) continue;
      if (plan.chance && random() > plan.chance) continue;
      const cellBounds = world.biomeCellBounds(col, row);
      spawnChestsForType(cellBounds, archetype, "smallChest", (plan.smallChestCount || 0));
      spawnChestsForType(cellBounds, archetype, "largeChest", (plan.largeChestCount || 0));
    }
  }

  spawnSpecialWell(searchables, world, placedRects, SEARCHABLE_DEFS.redWell, "redWell", random, nextIdRef, {
    allowedCols: [1, 2]
  });
  spawnSpecialWell(searchables, world, placedRects, SEARCHABLE_DEFS.yellowWell, "yellowWell", random, nextIdRef, {
    allowedCols: [0, 1]
  });
  spawnSpecialWell(searchables, world, placedRects, SEARCHABLE_DEFS.unknownWell, "unknownWell", random, nextIdRef, {
    allowedCols: [2, 3]
  });

  const numRingShops = 1 + Math.floor(random() * 3);
  for (let i = 0; i < numRingShops; i++) {
    const ringSelection = createRingSelectionSearchable(world, roomIndex, placedRects, createSeededRandom(seed + roomIndex * 9127 + 401 + i * 1337), nextIdRef);
    if (ringSelection) {
      searchables.push(ringSelection);
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
    pickupDelay: RING_DROP_PICKUP_DELAY,
    magnetDelay: RING_DROP_MAGNET_DELAY,
    spriteCell: ringDef.spriteCell,
    rarity: ringDef.dropRarity
  });
  game.nextRingInstanceId += 1;
}

function pushRingPickupPopup(game, playerCenter, ringDef) {
  game.combat.damagePopups.push({
    x: playerCenter.x + (Math.random() - 0.5) * 28,
    y: playerCenter.y - game.player.h * 0.42 + (Math.random() - 0.5) * 8,
    text: ringDef.name,
    age: 0,
    duration: 0.9,
    riseSpeed: 28,
    color: getRingRarityColor(ringDef.dropRarity),
    strokeColor: "rgba(2, 6, 23, 0.98)",
    scale: 0.9,
    isCrit: false
  });
}

export function getSearchableGoldCost(game, searchable) {
  if (searchable.typeId === "unknownWell") {
    const interactionCount = searchable.interactionCount || 0;
    return UNKNOWN_WELL_COSTS[Math.min(UNKNOWN_WELL_COSTS.length - 1, interactionCount)] || 0;
  }
  return scaleGoldPrice(getModifiedChestCost(game, searchable.baseGoldCost ?? searchable.goldCost ?? 0));
}

export function spawnBiomePortal(game) {
  return spawnPortal(game, {
    target: "breakRoom",
    origin: game?.lastMinibossDeathPosition || null,
    cellArchetype: "miniboss"
  });
}

export function spawnLifeSpring(game, origin = null) {
  if (!game?.world) return null;
  const existingSpring = (game.searchables || []).find((searchable) => searchable.typeId === "lifeSpring" && !searchable.isOpen);
  if (existingSpring) return existingSpring;
  const searchableDef = SEARCHABLE_DEFS.lifeSpring;
  if (!searchableDef) return null;
  const center = origin || {
    x: game.world.width * 0.5,
    y: game.world.height * 0.5
  };
  const spring = {
    id: `life_spring_${game.roomIndex}_${(game.searchables || []).length + 1}`,
    typeId: "lifeSpring",
    cellArchetype: "openSpace",
    isOpen: false,
    openTimer: 0,
    x: Math.round(center.x - searchableDef.width * 0.5),
    y: Math.round(center.y - searchableDef.height * 0.5),
    w: searchableDef.width,
    h: searchableDef.height
  };
  game.searchables.push(spring);
  return spring;
}

export function spawnAlchemyWorkshop(game) {
  const searchableDef = SEARCHABLE_DEFS.alchemyWorkshop;
  if (!searchableDef || !game?.world) return null;
  const searchable = {
    id: `alchemy_workshop_${game.roomIndex}`,
    typeId: "alchemyWorkshop",
    cellArchetype: "openSpace",
    isOpen: false,
    openTimer: 0,
    x: Math.round(game.world.width * 0.5 - searchableDef.width * 0.5),
    y: Math.round(game.world.height * 0.5 - searchableDef.height * 0.5),
    w: searchableDef.width,
    h: searchableDef.height
  };
  game.searchables.push(searchable);
  return searchable;
}

export function spawnBlacksmith(game) {
  const searchableDef = SEARCHABLE_DEFS.blacksmith;
  if (!searchableDef || !game?.world) return null;
  const searchable = {
    id: `blacksmith_${game.roomIndex}`,
    typeId: "blacksmith",
    cellArchetype: "openSpace",
    isOpen: false,
    openTimer: 0,
    x: Math.round(game.world.width * 0.5 + 68),
    y: Math.round(game.world.height * 0.5 - searchableDef.height * 0.5),
    w: searchableDef.width,
    h: searchableDef.height
  };
  game.searchables.push(searchable);
  return searchable;
}

export function spawnPortal(game, options = {}) {
  if (!game?.world?.exit) return null;
  const target = options.target || "nextBiome";
  const existingPortal = (game.searchables || []).find(
    (searchable) => searchable.typeId === "biomePortal"
      && !searchable.isOpen
      && !searchable.introOnly
      && (searchable.portalTarget || "nextBiome") === target
  );
  if (existingPortal) return existingPortal;
  const portalDef = SEARCHABLE_DEFS.biomePortal;
  if (!portalDef) return null;
  const portalOrigin = options.origin || {
    x: game.world.exit.x + game.world.exit.w * 0.5,
    y: game.world.exit.y + game.world.exit.h * 0.5
  };
  const x = Math.round(portalOrigin.x - portalDef.width * 0.5);
  const y = Math.round(portalOrigin.y - portalDef.height * 0.5 - 8);
  const portal = {
    id: `biome_portal_${game.roomIndex}_${(game.searchables || []).length + 1}`,
    typeId: "biomePortal",
    cellArchetype: options.cellArchetype || "openSpace",
    portalTarget: target,
    introOnly: options.introOnly === true,
    introAlpha: options.introOnly ? 0 : 1,
    isOpen: false,
    openTimer: 0,
    x,
    y,
    w: portalDef.width,
    h: portalDef.height
  };
  game.searchables.push(portal);
  if (!options.silent) {
    spawnDamagePopup(game, x + portal.w * 0.5, y - 10, PORTAL_OPEN_POPUP_TEXT, {
      color: "#93c5fd",
      strokeColor: "rgba(8, 47, 73, 0.96)",
      duration: 1,
      riseSpeed: 24,
      scale: 1
    });
  }
  return portal;
}

export function openSearchable(game, searchable, options = {}) {
  if (searchable.isOpen) return false;
  const searchableDef = SEARCHABLE_DEFS[searchable.typeId];
  if (!searchableDef) return false;
  const isChest = isChestSearchable(searchable);
  if (searchableDef.interactionType === "cursedAnvil") {
    game.openCursedAnvilUi?.(searchable.id);
    return true;
  }
  if (searchableDef.interactionType === "treasureSpirit") {
    activateTreasureSpirit(game, searchable);
    return true;
  }
  if (searchableDef.interactionType === "devilMerchant") {
    game.openDevilMerchantUi?.(searchable.id);
    return true;
  }
  if (searchableDef.interactionType === "portal") {
    searchable.isOpen = true;
    searchable.openTimer = 0;
    game.roomCleared = true;
    if ((searchable.portalTarget || "nextBiome") === "breakRoom") {
      game.enterBreakRoom();
    } else {
      game.advanceRoom();
    }
    return true;
  }
  if (searchableDef.interactionType === "alchemyWorkshop") {
    game.openAlchemyWorkshop?.();
    return true;
  }
  if (searchableDef.interactionType === "blacksmith") {
    game.openBlacksmith?.();
    return true;
  }
  if (searchableDef.interactionType === "ringSelectionShop") {
    game.openRingSelectionShop?.(searchable.id);
    return true;
  }
  if (searchableDef.interactionType === "unknownWell") {
    const interactionCount = searchable.interactionCount || 0;
    if (interactionCount >= UNKNOWN_WELL_MAX_INTERACTIONS) return false;
    const goldCost = getSearchableGoldCost(game, searchable);
    if (!game.spendGold(goldCost)) return false;

    searchable.interactionCount = interactionCount + 1;
    if (searchable.interactionCount >= UNKNOWN_WELL_MAX_INTERACTIONS) {
      searchable.isOpen = true;
      searchable.openTimer = searchableDef.openAnimDuration || 0;
    }

    const options = [
      { id: "moveSpeed", label: "Speed Up", bonus: { moveSpeed: { multAdd: 0.1 } } },
      { id: "goldGain", label: "Wealthy", bonus: { goldGain: { multAdd: 0.1 } } },
      { id: "maxHp", label: "Healthy", bonus: { maxHp: { multAdd: 0.1 } } },
      { id: "attack", label: "Stronger", bonus: { attack: { multAdd: 0.1 } } },
      { id: "critChance", label: "Deadly", bonus: { critChance: { add: 0.1 } } },
      { id: "attackSpeed", label: "Faster", bonus: { attackSpeed: { multAdd: 0.1 } } }
    ];
    const pick = options[Math.floor(Math.random() * options.length)];
    
    // Merge into existing stat source
    const existing = game.player.statSources?.[UNKNOWN_WELL_STAT_SOURCE] || {};
    const merged = { ...existing };
    for (const [stat, mod] of Object.entries(pick.bonus)) {
      if (!merged[stat]) {
        merged[stat] = { ...mod };
      } else {
        if (mod.add) merged[stat].add = (merged[stat].add || 0) + mod.add;
        if (mod.multAdd) merged[stat].multAdd = (merged[stat].multAdd || 0) + mod.multAdd;
      }
    }
    setPlayerStatSource(game.player, UNKNOWN_WELL_STAT_SOURCE, merged);

    spawnDamagePopup(game, searchable.x + searchable.w * 0.5, searchable.y - 8, pick.label, {
      color: "#38bdf8",
      strokeColor: "#082f49",
      duration: 1.2,
      riseSpeed: 24,
      scale: 1.1
    });
    return true;
  }
  if (searchableDef.interactionType === "redWell") {
    searchable.isOpen = true;
    searchable.openTimer = searchableDef.openAnimDuration || 0;
    const healAmount = Math.max(1, Math.round(game.player.maxHp * RED_WELL_HEAL_RATIO));
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + healAmount);
    spawnDamagePopup(game, searchable.x + searchable.w * 0.5, searchable.y - 8, `+${healAmount} HP`, {
      color: "#f87171",
      strokeColor: "rgba(69, 10, 10, 0.95)",
      duration: 0.85,
      riseSpeed: 28,
      scale: 1
    });
    return true;
  }
  if (searchableDef.interactionType === "yellowWell") {
    searchable.isOpen = true;
    searchable.openTimer = searchableDef.openAnimDuration || 0;
    const expiresAt = game.time + YELLOW_WELL_SPEED_BUFF_DURATION;
    game.player.yellowWellSpeedBuffUntil = Math.max(game.player.yellowWellSpeedBuffUntil || 0, expiresAt);
    setPlayerStatSource(game.player, YELLOW_WELL_SPEED_BUFF_SOURCE, {
      moveSpeed: { mult: YELLOW_WELL_SPEED_BUFF_MULT }
    });
    spawnDamagePopup(game, searchable.x + searchable.w * 0.5, searchable.y - 8, "Speed Up", {
      color: "#facc15",
      strokeColor: "rgba(113, 63, 18, 0.95)",
      duration: 0.85,
      riseSpeed: 28,
      scale: 1
    });
    return true;
  }
  if (searchableDef.interactionType === "lifeSpring") {
    searchable.isOpen = true;
    searchable.openTimer = searchableDef.openAnimDuration || 0;
    const healAmount = Math.max(1, Math.round(game.player.maxHp * LIFE_SPRING_HEAL_RATIO));
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + healAmount);
    game.player.lifePotionCharges = Math.min(
      Math.max(0, game.player.lifePotionMaxCharges || 0),
      Math.max(0, game.player.lifePotionCharges || 0) + 1
    );
    spawnDamagePopup(game, searchable.x + searchable.w * 0.5, searchable.y - 10, `+${healAmount} HP`, {
      color: "#86efac",
      strokeColor: "rgba(20, 83, 45, 0.96)",
      duration: 0.9,
      riseSpeed: 28,
      scale: 1
    });
    spawnDamagePopup(game, searchable.x + searchable.w * 0.5, searchable.y - 28, "+1 Flask", {
      color: "#93c5fd",
      strokeColor: "rgba(30, 41, 59, 0.96)",
      duration: 0.9,
      riseSpeed: 22,
      scale: 0.96
    });

    grantAffinityXp(game, "lifeSpring");

    return true;
  }
  const free = !!options.free;
  const goldCost = getSearchableGoldCost(game, searchable);
  searchable.goldCost = goldCost;
  const random = createSeededRandom(game.seed + searchable.x * 7 + searchable.y * 13 + game.roomIndex * 53);
  const rarity = chooseRingDropRarity(game, searchableDef, random);
  const pool = getRingDefsByDropRarity(rarity);
  if (!pool.length) return false;
  const ringDef = pool[Math.floor(random() * pool.length)];
  if (!ringDef) return false;
  // Free First Chest mod: make the first chest of each biome free
  const mod = game.fingerExperimentState?.activeMainMod;
  if (mod?.id === 'main_free_first_chest' && !game.fingerExperimentState.firstChestOpenedThisBiome) {
    game.fingerExperimentState.firstChestOpenedThisBiome = true;
  } else if (!free && !game.spendGold(goldCost)) {
    return false;
  }
  searchable.isOpen = true;
  searchable.openTimer = searchableDef.openAnimDuration || 0;
  console.log('openSearchable', { typeId: searchable.typeId, isChest });
  if (isChest) {
    playAudioClone(game.assets?.openChestSfx);
    const chestResult = onFingerChestOpened(game, free ? 0 : goldCost);
    const cx = searchable.x + searchable.w * 0.5;
    const cy = searchable.y - 8;
    if (chestResult.refunded > 0) {
      spawnDamagePopup(game, cx, cy, `+${chestResult.refunded}g`, {
        color: '#facc15', strokeColor: 'rgba(28,17,0,0.9)', duration: 1.1, riseSpeed: 26, scale: 1.05
      });
    }
    if (chestResult.healed > 0) {
      spawnDamagePopup(game, cx, cy - 16, `+${chestResult.healed} HP`, {
        color: '#86efac', strokeColor: 'rgba(20,83,45,0.95)', duration: 1.1, riseSpeed: 26, scale: 1.0
      });
    }
    if (chestResult.maxHpGained > 0) {
      spawnDamagePopup(game, cx, cy - 16, `+${chestResult.maxHpGained} Max HP`, {
        color: '#f9a8d4', strokeColor: 'rgba(80,7,36,0.95)', duration: 1.2, riseSpeed: 24, scale: 1.0
      });
    }
  }
  createRingDrop(game, ringDef.ringId, searchable.x + searchable.w * 0.5, searchable.y - 6);
  return true;
}

export function getRingSelectionOffers(searchable) {
  return (searchable?.ringOffers || [])
    .map((ringId) => getRingDefById(ringId))
    .filter(Boolean);
}

export function purchaseRingSelectionOffer(game, searchable, ringId) {
  if (!game || !searchable || searchable.isOpen || searchable.typeId !== "ringSelectionShop") return { ok: false, reason: "unavailable" };
  const ringOffers = new Set(searchable.ringOffers || []);
  if (!ringOffers.has(ringId)) return { ok: false, reason: "invalidRing" };
  const goldCost = getSearchableGoldCost(game, searchable);
  searchable.goldCost = goldCost;
  if (!game.spendGold?.(goldCost)) return { ok: false, reason: "insufficientGold", goldCost };
  const ringDef = getRingDefById(ringId);
  if (!ringDef) return { ok: false, reason: "invalidRing" };
  searchable.isOpen = true;
  searchable.openTimer = 0;
  const reward = game.addRingToInventory?.(ringId);
  spawnDamagePopup(game, searchable.x + searchable.w * 0.5, searchable.y - 12, ringDef.name, {
    color: getRingRarityColor(ringDef.dropRarity),
    strokeColor: "rgba(2, 6, 23, 0.98)",
    duration: 0.95,
    riseSpeed: 26,
    scale: 0.95
  });
  game.closeRingSelectionShop?.();
  return { ok: true, ringDef, reward, goldCost };
}

function updateRingDrops(game, dt) {
  const playerCenter = centerOf(game.player);
  const pickupRadiusMult = getRingPickupRadiusMultiplier(game);
  const pickupRange = RING_DROP_PICKUP_RANGE * pickupRadiusMult;
  const magnetRange = getCanvasDiameterRadius(game) * pickupRadiusMult;
  const remaining = [];
  for (const drop of game.ringDrops) {
    drop.bobClock += dt;
    drop.pickupDelay = Math.max(0, (drop.pickupDelay ?? 0) - dt);
    drop.magnetDelay = Math.max(0, (drop.magnetDelay ?? RING_DROP_MAGNET_DELAY) - dt);
    const dist = distance(playerCenter.x, playerCenter.y, drop.x, drop.y);
    if (drop.pickupDelay <= 0 && dist <= pickupRange) {
      const ring = game.addRingToInventory(drop.ringId);
      if (!ring) {
        remaining.push(drop);
        continue;
      }
      const ringDef = getRingDefById(drop.ringId);
      if (ringDef) pushRingPickupPopup(game, playerCenter, ringDef);
      continue;
    }
    if (drop.magnetDelay <= 0 && dist <= magnetRange && dist > 0.001) {
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
  if ((game.player.yellowWellSpeedBuffUntil || 0) > game.time) {
    setPlayerStatSource(game.player, YELLOW_WELL_SPEED_BUFF_SOURCE, {
      moveSpeed: { mult: YELLOW_WELL_SPEED_BUFF_MULT }
    });
  } else {
    clearPlayerStatSource(game.player, YELLOW_WELL_SPEED_BUFF_SOURCE);
  }
  updateRingDrops(game, dt);
  if (!game.input.wasPressed("e")) return;
  const playerCenter = centerOf(game.player);
  const interactable = game.searchables
    .filter((searchable) => !searchable.isOpen && !searchable.introOnly)
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
  const searchableDef = SEARCHABLE_DEFS[searchable.typeId];
  const isFreeInteract = isFreeInteractionType(searchableDef?.interactionType);
  const goldCost = getSearchableGoldCost(game, searchable);
  return {
    inRange: dist <= SEARCHABLE_INTERACT_RANGE,
    affordable: isFreeInteract || game.gold >= goldCost,
    goldCost: isFreeInteract ? 0 : goldCost,
    isFreeInteract
  };
}

export function getRingItemIconStyle(ringDef, size = 22) {
  if (ringDef?.iconAssetKey) {
    const filenameMap = {
      ringIconAttackSpeed: "Attack Speed Ring.png",
      ringIconChaosRebirth: "Chaos Rebirth Ring.png",
      ringIconCounterattack: "Counterattack Ring.png",
      ringIconCriticalDamage: "Critical Damage Ring.png",
      ringIconDagger: "Dagger Ring.png",
      ringIconDragon: "Dragon Ring.png",
      ringIconInferno: "Inferno Ring.png",
      ringIconLifesteal: "Lifesteal Ring.png",
      ringIconLucky: "Lucky Ring.png",
      ringIconMirror: "Mirror Ring.png",
      ringIconPhantomKnife: "Phantom Knife Ring.png",
      ringIconCriticalChance: "Critical Chance Ring.png",
      ringIconGold: "Gold Ring.png",
      ringIconDefense: "Defense Ring.png",
      ringIconRecovery: "Recovery Ring.png",
      ringIconAttack: "Attack Ring.png",
      ringIconHealth: "Health Ring.png",
      ringIconMovementSpeed: "Movement Speed Ring.png"
    };
    const filename = filenameMap[ringDef.iconAssetKey];
    if (filename) {
      return {
        width: `${size}px`,
        height: `${size}px`,
        backgroundImage: `url('./assets/items/Ring Sprites/${filename}')`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center"
      };
    }
  }
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
export { SEARCHABLE_INTERACT_RANGE };
