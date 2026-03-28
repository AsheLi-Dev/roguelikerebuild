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
    ]
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
  const baseCtx = baseCanvas.getContext("2d");
  const detailCtx = detailCanvas.getContext("2d");
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

  return {
    groundTypeId,
    groundLayer: {
      baseCanvas,
      detailCanvas,
      overlayLayers
    }
  };
}

export function drawOpenWorldGroundBase(ctx, groundLayer, camera) {
  drawCanvasSlice(ctx, groundLayer?.baseCanvas, camera);
}

export function drawOpenWorldGroundDetails(ctx, groundLayer, camera) {
  drawCanvasSlice(ctx, groundLayer?.detailCanvas, camera);
}
