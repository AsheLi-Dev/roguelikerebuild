import { createSeededRandom } from "../core/runtime-utils.js";

export const OPENWORLD_GROUND_TYPES = {
  grassA: {
    id: "grassA",
    baseImageKey: "biomeGroundBase",
    baseTileWidth: 960,
    baseTileHeight: 960,
    baseColumns: 2,
    baseRows: 2,
    overlayLayers: [
      {
        id: "grassA_1",
        imageKey: "biomeGroundGrassA1",
        defsKey: "biomeGroundGrassA1Defs",
        targetCoverage: 0.7,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 22000,
        drawTarget: "base"
      },
      {
        id: "grassA_2",
        imageKey: "biomeGroundGrassA2",
        defsKey: "biomeGroundGrassA2Defs",
        targetCoverage: 0.11,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 8000,
        drawTarget: "detail"
      },
      {
        id: "rocksA",
        imageKey: "biomeGroundRocksA",
        defsKey: "biomeGroundRocksADefs",
        targetCoverage: 0.05,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 6000,
        drawTarget: "detail"
      }
    ],
    flowerLayer: {
      imageKey: "biomeGroundFlowers",
      defsKey: "biomeGroundFlowerDefs",
      minPerZone: 8,
      maxPerZone: 20,
      mixNeighborChance: 0.1
    }
  }
};

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  return canvas;
}

function normalizePatchDefs(input = {}) {
  const objects = Array.isArray(input.objects) ? input.objects : [];
  return objects
    .map((entry, index) => ({
      id: String(entry.id || `patch_${index + 1}`),
      x: Math.floor(Number(entry.x) || 0),
      y: Math.floor(Number(entry.y) || 0),
      w: Math.max(1, Math.floor(Number(entry.w) || 1)),
      h: Math.max(1, Math.floor(Number(entry.h) || 1)),
      weight: Math.max(1, Math.floor(Number(entry.weight) || 1))
    }))
    .filter((entry) => entry.w > 0 && entry.h > 0);
}

function normalizeFlowerFamilies(input = {}) {
  const families = Array.isArray(input.families) ? input.families : [];
  return families
    .map((family, familyIndex) => ({
      id: String(family?.id || `family_${familyIndex + 1}`),
      tiles: Array.isArray(family?.tiles)
        ? family.tiles
            .map((tile, tileIndex) => ({
              id: String(tile?.id || `${family?.id || `family_${familyIndex + 1}`}_${tileIndex + 1}`),
              x: Math.floor(Number(tile?.x) || 0),
              y: Math.floor(Number(tile?.y) || 0),
              w: Math.max(1, Math.floor(Number(tile?.w) || 32)),
              h: Math.max(1, Math.floor(Number(tile?.h) || 32)),
              weight: Math.max(1, Math.floor(Number(tile?.weight) || 1))
            }))
            .filter((tile) => tile.w > 0 && tile.h > 0)
        : []
    }))
    .filter((family) => family.tiles.length > 0);
}

function overlapsTooMuch(candidate, accepted, maxOverlapRatio) {
  const candidateArea = candidate.w * candidate.h;
  for (const existing of accepted) {
    const x0 = Math.max(candidate.x, existing.x);
    const y0 = Math.max(candidate.y, existing.y);
    const x1 = Math.min(candidate.x + candidate.w, existing.x + existing.w);
    const y1 = Math.min(candidate.y + candidate.h, existing.y + existing.h);
    if (x1 <= x0 || y1 <= y0) continue;
    const overlap = (x1 - x0) * (y1 - y0);
    const ratio = overlap / Math.min(candidateArea, existing.w * existing.h);
    if (ratio > maxOverlapRatio) return true;
  }
  return false;
}

function rectFitsWalkableTiles(world, rect) {
  const tileSize = world.tileSize;
  const gx0 = Math.floor(rect.x / tileSize);
  const gy0 = Math.floor(rect.y / tileSize);
  const gx1 = Math.ceil((rect.x + rect.w) / tileSize) - 1;
  const gy1 = Math.ceil((rect.y + rect.h) / tileSize) - 1;
  for (let gy = gy0; gy <= gy1; gy += 1) {
    if (gy < 0 || gy >= world.rows) return false;
    for (let gx = gx0; gx <= gx1; gx += 1) {
      if (gx < 0 || gx >= world.cols) return false;
      if (world.grid[gy][gx] !== 0) return false;
    }
  }
  return true;
}

function rectIntersectsTileSet(rect, tileKeys, tileSize, padding = 0) {
  if (!tileKeys?.size) return false;
  const gx0 = Math.floor(rect.x / tileSize) - padding;
  const gy0 = Math.floor(rect.y / tileSize) - padding;
  const gx1 = Math.ceil((rect.x + rect.w) / tileSize) - 1 + padding;
  const gy1 = Math.ceil((rect.y + rect.h) / tileSize) - 1 + padding;
  for (let gy = gy0; gy <= gy1; gy += 1) {
    for (let gx = gx0; gx <= gx1; gx += 1) {
      if (tileKeys.has(`${gx},${gy}`)) return true;
    }
  }
  return false;
}

function weightedPick(entries, random) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1] || null;
}

function getWorldZoneBounds(world) {
  const grid = world?.archetypeGrid?.grid;
  if (!Array.isArray(grid) || !grid.length || !Array.isArray(grid[0]) || !grid[0].length) return [];
  const rows = grid.length;
  const cols = grid[0].length;
  const zoneWidth = world.width / cols;
  const zoneHeight = world.height / rows;
  const zones = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (grid[row][col] == null || grid[row][col] === "empty") continue;
      zones.push({
        id: `${row}_${col}`,
        x: col * zoneWidth,
        y: row * zoneHeight,
        w: zoneWidth,
        h: zoneHeight
      });
    }
  }

  return zones;
}

function pickFlowerFamily(families, random) {
  if (!families.length) return null;
  return families[Math.floor(random() * families.length)] || families[0];
}

function pickNeighborFlowerFamily(families, primaryFamily, random) {
  const index = families.findIndex((family) => family.id === primaryFamily?.id);
  if (index < 0) return primaryFamily;
  const neighborIndexes = [index - 1, index + 1].filter((candidate) => candidate >= 0 && candidate < families.length);
  if (!neighborIndexes.length) return primaryFamily;
  return families[neighborIndexes[Math.floor(random() * neighborIndexes.length)]] || primaryFamily;
}

function buildGroundPlacements(world, patchDefs, seed, options = {}) {
  if (!patchDefs.length) return [];
  const random = createSeededRandom(seed >>> 0);
  const tileSize = world.tileSize;
  const floorTileCount = world.grid.flat().filter((cell) => cell === 0).length;
  const targetArea = floorTileCount * tileSize * tileSize * Math.max(0, Math.min(1, options.targetCoverage || 0));
  const avoidTileKeys = options.avoidTileKeys instanceof Set ? options.avoidTileKeys : null;
  const accepted = [];
  let coveredArea = 0;

  for (let attempt = 0; attempt < (options.maxPlacementAttempts || 5000) && coveredArea < targetArea; attempt += 1) {
    const patchDef = weightedPick(patchDefs, random);
    if (!patchDef) break;
    const rect = {
      x: Math.floor(random() * Math.max(1, world.width - patchDef.w)),
      y: Math.floor(random() * Math.max(1, world.height - patchDef.h)),
      w: patchDef.w,
      h: patchDef.h
    };
    if (!rectFitsWalkableTiles(world, rect)) continue;
    if (avoidTileKeys && rectIntersectsTileSet(rect, avoidTileKeys, tileSize, 2)) continue;
    if (overlapsTooMuch(rect, accepted, options.maxOverlapRatio || 0)) continue;
    accepted.push({
      ...rect,
      sx: patchDef.x,
      sy: patchDef.y,
      sw: patchDef.w,
      sh: patchDef.h
    });
    coveredArea += rect.w * rect.h;
  }

  return accepted;
}

function buildFlowerPlacements(world, flowerFamilies, seed, options = {}) {
  if (!flowerFamilies.length) return [];
  const zones = getWorldZoneBounds(world);
  if (!zones.length) return [];
  const random = createSeededRandom((seed ^ 0x6d2b79f5) >>> 0);
  const minPerZone = Math.max(1, Math.floor(Number(options.minPerZone) || 8));
  const maxPerZone = Math.max(minPerZone, Math.floor(Number(options.maxPerZone) || 20));
  const mixNeighborChance = Math.max(0, Math.min(1, Number(options.mixNeighborChance) || 0.1));
  const placements = [];
  const tileSize = world.tileSize;

  for (const zone of zones) {
    const primaryFamily = pickFlowerFamily(flowerFamilies, random);
    if (!primaryFamily) continue;
    const count = minPerZone + Math.floor(random() * (maxPerZone - minPerZone + 1));
    for (let index = 0; index < count; index += 1) {
      const family = random() < mixNeighborChance
        ? pickNeighborFlowerFamily(flowerFamilies, primaryFamily, random)
        : primaryFamily;
      const tile = weightedPick(family.tiles, random);
      if (!tile) continue;
      const maxX = Math.max(zone.x, zone.x + zone.w - tile.w);
      const maxY = Math.max(zone.y, zone.y + zone.h - tile.h);
      const x = Math.floor(zone.x + random() * Math.max(1, maxX - zone.x + 1));
      const y = Math.floor(zone.y + random() * Math.max(1, maxY - zone.y + 1));
      const rect = { x, y, w: tile.w, h: tile.h };
      if (!rectFitsWalkableTiles(world, rect)) continue;
      placements.push({
        familyId: family.id,
        tileId: tile.id,
        x,
        y,
        w: tile.w,
        h: tile.h,
        sx: tile.x,
        sy: tile.y,
        sw: tile.w,
        sh: tile.h,
        zoneId: zone.id,
        gx: Math.floor(x / tileSize),
        gy: Math.floor(y / tileSize)
      });
    }
  }

  return placements;
}

function buildBaseCanvas(world, seed, baseImage, config) {
  const canvas = createCanvas(world.width, world.height);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const cols = Math.max(1, config.baseColumns || 1);
  const rows = Math.max(1, config.baseRows || 1);
  const tileW = Math.max(1, config.baseTileWidth || 960);
  const tileH = Math.max(1, config.baseTileHeight || 960);
  const random = createSeededRandom((seed ^ 0x62d93b41) >>> 0);
  const floorRegions = [
    ...(world.playableMacroRects || []),
    ...((world.blockerChunkSpaces || []).map((space) => ({
      x: space.worldX,
      y: space.worldY,
      w: tileW,
      h: tileH
    })))
  ];

  for (const cell of floorRegions) {
    for (let y = cell.y; y < cell.y + cell.h; y += tileH) {
      for (let x = cell.x; x < cell.x + cell.w; x += tileW) {
        const variant = Math.floor(random() * (cols * rows));
        const sx = (variant % cols) * tileW;
        const sy = Math.floor(variant / cols) * tileH;
        const drawW = Math.min(tileW, cell.x + cell.w - x);
        const drawH = Math.min(tileH, cell.y + cell.h - y);
        ctx.drawImage(baseImage, sx, sy, drawW, drawH, x, y, drawW, drawH);
      }
    }
  }

  return canvas;
}

function stampPlacements(ctx, image, placements) {
  if (!image || !placements.length) return;
  ctx.imageSmoothingEnabled = false;
  for (const placement of placements) {
    ctx.drawImage(image, placement.sx, placement.sy, placement.sw, placement.sh, placement.x, placement.y, placement.w, placement.h);
  }
}

function drawCanvasSlice(ctx, canvas, camera) {
  if (!canvas) return;
  const sx = Math.max(0, Math.floor(camera.x));
  const sy = Math.max(0, Math.floor(camera.y));
  const sw = Math.min(Math.ceil(camera.viewWidth), canvas.width - sx);
  const sh = Math.min(Math.ceil(camera.viewHeight), canvas.height - sy);
  if (sw <= 0 || sh <= 0) return;
  ctx.drawImage(canvas, sx, sy, sw, sh, Math.round(-camera.x + sx), Math.round(-camera.y + sy), sw, sh);
}

export function buildOpenWorldCosmeticFloor(world, seed, assets, groundTypeId = "grassA") {
  const config = OPENWORLD_GROUND_TYPES[groundTypeId];
  if (!config) return null;
  const baseImage = assets[config.baseImageKey];
  if (!baseImage) return null;

  const baseCanvas = buildBaseCanvas(world, seed, baseImage, config);
  const detailCanvas = createCanvas(world.width, world.height);
  const decorCanvas = createCanvas(world.width, world.height);
  const baseCtx = baseCanvas.getContext("2d");
  const detailCtx = detailCanvas.getContext("2d");
  const decorCtx = decorCanvas.getContext("2d");
  const overlayLayers = [];
  const occludeTiles = world.upperCliff?.occludeTiles || new Set();

  for (let index = 0; index < config.overlayLayers.length; index += 1) {
    const layerConfig = config.overlayLayers[index];
    const image = assets[layerConfig.imageKey];
    const defs = normalizePatchDefs(assets[layerConfig.defsKey]);
    const placements = buildGroundPlacements(world, defs, seed + index * 4099, {
      targetCoverage: layerConfig.targetCoverage,
      maxOverlapRatio: layerConfig.maxOverlapRatio,
      maxPlacementAttempts: layerConfig.maxPlacementAttempts,
      avoidTileKeys: layerConfig.id === "grassA_1" ? null : occludeTiles
    });
    overlayLayers.push({ ...layerConfig, image, placements });
    stampPlacements(layerConfig.drawTarget === "base" ? baseCtx : detailCtx, image, placements);
  }

  let flowerLayer = null;
  if (config.flowerLayer) {
    const image = assets[config.flowerLayer.imageKey];
    const families = normalizeFlowerFamilies(assets[config.flowerLayer.defsKey]);
    const placements = buildFlowerPlacements(world, families, seed, config.flowerLayer);
    flowerLayer = { ...config.flowerLayer, image, families, placements };
    stampPlacements(decorCtx, image, placements);
  }

  return {
    groundTypeId,
    groundLayer: {
      baseCanvas,
      detailCanvas,
      decorCanvas,
      overlayLayers,
      flowerLayer
    }
  };
}

export function drawOpenWorldGroundBase(ctx, groundLayer, camera) {
  drawCanvasSlice(ctx, groundLayer?.baseCanvas, camera);
}

export function drawOpenWorldGroundDetails(ctx, groundLayer, camera) {
  drawCanvasSlice(ctx, groundLayer?.detailCanvas, camera);
}

export function drawOpenWorldGroundDecor(ctx, groundLayer, camera) {
  drawCanvasSlice(ctx, groundLayer?.decorCanvas, camera);
}
