import { createSeededRandom } from "../core/runtime-utils.js";

const CLIFF_AVOID_TILE_PADDING = 3;
const INFLUENCE_MIN_OVERLAY_WEIGHT = 0.44;
const INFLUENCE_MIN_ACCENT_WEIGHT = 0.26;
const ARCHETYPE_FLOWER_STRIDE = 2;
const USE_LOW_RES_FLOOR = false;
const LOW_RES_FLOOR_SCALE = 0.5;
const FLOWER_PLACEMENT_TUNING = Object.freeze({
  singlesShare: 0.2,
  clustersShare: 0.55,
  patchesShare: 0.25,
  openSpacePatchBonus: 1,
  openSpacePatchFlowerMultiplier: 1.5,
  clusterRadiusMin: 20,
  clusterRadiusMax: 90,
  patchRadiusXMin: 100,
  patchRadiusXMax: 220,
  patchRadiusYMin: 70,
  patchRadiusYMax: 170,
  clusterFlowersMin: 4,
  clusterFlowersMax: 12,
  patchFlowersMin: 14,
  patchFlowersMax: 34,
  dominantFamilyMin: 0.7,
  dominantFamilyMax: 0.85,
  clusterFalloffExponent: 1.5,
  patchFalloffExponent: 1.8,
  maxPlacementAttemptsPerFlower: 4,
  maxFlowerOverlapRatio: 0.08
});
const FLOWER_LIVING_DECOR = Object.freeze({
  enabled: true,
  sliceCount: 4,
  swayAmplitudeMin: 1.25,
  swayAmplitudeMax: 3.25,
  swaySpeedMin: 1.0,
  swaySpeedMax: 1.9,
  sliceWeight0: 0,
  sliceWeight1: 0,
  sliceWeight2: 0.2,
  sliceWeight3: 1,
  rootedBandRatio: 0.35,
  shimmerAlphaMin: 0.03,
  shimmerAlphaMax: 0.06,
  globalWindCycleSeconds: 3.8,
  shimmerBandRatio: 0.42
});
const GROUND_GRASS_VARIATION = Object.freeze({
  enabled: true,
  brightnessRange: 0.18,
  saturationRange: 0.22,
  hueRotateRange: 12,
  variantMixEnabled: true,
  regionFreqX: 0.0017,
  regionFreqY: 0.0013,
  detailFreqA: 0.0008,
  detailFreqB: 0.001
});
const VEGETATION_GRASS_VARIATION = Object.freeze({
  enabled: true,
  brightnessRange: 0.18,
  saturationRange: 0.22,
  hueRotateRange: 12,
  variantMixEnabled: false,
  scaleJitter: 0.1,
  yJitter: 2,
  swayEnabled: true,
  swayAmplitudeMin: 0.55,
  swayAmplitudeMax: 1.4,
  swaySpeedMin: 0.65,
  swaySpeedMax: 1.1,
  globalWindCycleSeconds: 5.6,
  topSliceWeight: 0.45,
  midSliceWeight: 1,
  bottomSliceWeight: 0.22
});

function getFloorRenderScale() {
  return USE_LOW_RES_FLOOR ? LOW_RES_FLOOR_SCALE : 1;
}

const BIOME_STYLE_BY_ARCHETYPE = Object.freeze({
  openSpace: "grassA",
  start: "grassA",
  woods: "grass_woods",
  deepWoods: "grass_woods",
  ruins: "grass_swamp",
  vault: "grass_magic",
  miniboss: "grass_dead"
});

function isBreakableOnlyCosmeticId(value) {
  return /crystal/i.test(String(value || ""));
}

function shouldAvoidUpperCliffForOverlay(layerId) {
  if (!layerId) return false;
  if (layerId === "rocksA") return true;
  return /^grass.*_(1|2)$/.test(layerId);
}

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
  },
  grass_woods: {
    id: "grass_woods",
    baseImageKey: "biomeGroundBase",
    baseTileWidth: 960,
    baseTileHeight: 960,
    baseColumns: 2,
    baseRows: 2,
    overlayLayers: [
      {
        id: "grass_woods_1",
        imageKey: "biomeGroundGrassA1",
        defsKey: "biomeGroundGrassA1Defs",
        targetCoverage: 0.7,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 22000,
        drawTarget: "base"
      },
      {
        id: "grass_woods_2",
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
  },
  grass_swamp: {
    id: "grass_swamp",
    baseImageKey: "biomeGroundBase",
    baseTileWidth: 960,
    baseTileHeight: 960,
    baseColumns: 2,
    baseRows: 2,
    overlayLayers: [
      {
        id: "grass_swamp_1",
        imageKey: "biomeGroundGrassB1",
        defsKey: "biomeGroundGrassA1Defs",
        targetCoverage: 0.72,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 22000,
        drawTarget: "base"
      },
      {
        id: "grass_swamp_2",
        imageKey: "biomeGroundGrassB2",
        defsKey: "biomeGroundGrassA2Defs",
        targetCoverage: 0.13,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 8000,
        drawTarget: "detail"
      },
      {
        id: "rocksA",
        imageKey: "biomeGroundRocksA",
        defsKey: "biomeGroundRocksADefs",
        targetCoverage: 0.035,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 5000,
        drawTarget: "detail"
      }
    ],
    flowerLayer: {
      imageKey: "biomeGroundFlowers",
      defsKey: "biomeGroundFlowerDefs",
      minPerZone: 5,
      maxPerZone: 14,
      mixNeighborChance: 0.08
    }
  },
  grass_magic: {
    id: "grass_magic",
    baseImageKey: "biomeGroundBase",
    baseTileWidth: 960,
    baseTileHeight: 960,
    baseColumns: 2,
    baseRows: 2,
    overlayLayers: [
      {
        id: "grass_magic_1",
        imageKey: "biomeGroundGrassE1",
        defsKey: "biomeGroundGrassA1Defs",
        targetCoverage: 0.7,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 22000,
        drawTarget: "base"
      },
      {
        id: "grass_magic_2",
        imageKey: "biomeGroundGrassE2",
        defsKey: "biomeGroundGrassA2Defs",
        targetCoverage: 0.13,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 8000,
        drawTarget: "detail"
      },
      {
        id: "rocksA",
        imageKey: "biomeGroundRocksA",
        defsKey: "biomeGroundRocksADefs",
        targetCoverage: 0.06,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 6000,
        drawTarget: "detail"
      }
    ],
    flowerLayer: {
      imageKey: "biomeGroundFlowers",
      defsKey: "biomeGroundFlowerDefs",
      minPerZone: 7,
      maxPerZone: 18,
      mixNeighborChance: 0.18
    }
  },
  grass_dead: {
    id: "grass_dead",
    baseImageKey: "biomeGroundBase",
    baseTileWidth: 960,
    baseTileHeight: 960,
    baseColumns: 2,
    baseRows: 2,
    overlayLayers: [
      {
        id: "grass_dead_1",
        imageKey: "biomeGroundGrassC1",
        defsKey: "biomeGroundGrassA1Defs",
        targetCoverage: 0.68,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 22000,
        drawTarget: "base"
      },
      {
        id: "grass_dead_2",
        imageKey: "biomeGroundGrassC2",
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
        targetCoverage: 0.08,
        maxOverlapRatio: 0,
        maxPlacementAttempts: 6500,
        drawTarget: "detail"
      }
    ],
    flowerLayer: {
      imageKey: "biomeGroundFlowers",
      defsKey: "biomeGroundFlowerDefs",
      minPerZone: 3,
      maxPerZone: 9,
      mixNeighborChance: 0.04
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
              weight: Math.max(1, Math.floor(Number(tile?.weight) || 1)),
              trimX: Math.max(0, Math.floor(Number(tile?.trimX) || 0)),
              trimY: Math.max(0, Math.floor(Number(tile?.trimY) || 0)),
              trimW: Math.max(1, Math.floor(Number(tile?.trimW) || Number(tile?.w) || 32)),
              trimH: Math.max(1, Math.floor(Number(tile?.trimH) || Number(tile?.h) || 32)),
              pivotX: Number.isFinite(Number(tile?.pivotX)) ? Number(tile.pivotX) : (Number.isFinite(Number(tile?.baseX)) ? Number(tile.baseX) : 16),
              pivotY: Number.isFinite(Number(tile?.pivotY)) ? Number(tile.pivotY) : (Number.isFinite(Number(tile?.baseY)) ? Number(tile.baseY) : 31),
              baseX: Number.isFinite(Number(tile?.baseX)) ? Number(tile.baseX) : null,
              baseY: Number.isFinite(Number(tile?.baseY)) ? Number(tile.baseY) : null
            }))
            .filter((tile) => tile.w > 0 && tile.h > 0)
        : []
    }))
    .filter((family) => family.tiles.length > 0);
}

function mixSeed(seed) {
  let value = seed >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0;
}

function unitFloatFromSeed(seed) {
  return (mixSeed(seed) >>> 0) / 4294967295;
}

function getPlacementVariationSeed(placement, seed = 0) {
  let value = seed >>> 0;
  value = mixSeed(value ^ (placement.x | 0));
  value = mixSeed(value ^ ((placement.y | 0) << 1));
  value = mixSeed(value ^ ((placement.sx | 0) << 2));
  value = mixSeed(value ^ ((placement.sy | 0) << 3));
  return value >>> 0;
}

function getFlowerPlacementAnimSeed(placement, seed = 0) {
  return getPlacementVariationSeed(placement, seed);
}

function initializeFlowerPlacementAnimation(placements, seed = 0) {
  if (!placements?.length) return placements;
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index];
    if (
      Number.isFinite(placement?.swaySeed)
      && Number.isFinite(placement?.swaySpeed)
      && Number.isFinite(placement?.swayAmplitude)
      && Number.isFinite(placement?.shimmerSeed)
      && Number.isFinite(placement?.shimmerAlpha)
    ) continue;
    const animSeed = getFlowerPlacementAnimSeed(placement, seed + index * 131);
    const swaySeed = unitFloatFromSeed(animSeed ^ 0x68bc21eb) * Math.PI * 2;
    const swaySpeed = FLOWER_LIVING_DECOR.swaySpeedMin
      + unitFloatFromSeed(animSeed ^ 0x02e5be93) * (FLOWER_LIVING_DECOR.swaySpeedMax - FLOWER_LIVING_DECOR.swaySpeedMin);
    const swayAmplitude = FLOWER_LIVING_DECOR.swayAmplitudeMin
      + unitFloatFromSeed(animSeed ^ 0x967a889b) * (FLOWER_LIVING_DECOR.swayAmplitudeMax - FLOWER_LIVING_DECOR.swayAmplitudeMin);
    const shimmerSeed = unitFloatFromSeed(animSeed ^ 0x5a17c9e3) * Math.PI * 2;
    const shimmerAlpha = FLOWER_LIVING_DECOR.shimmerAlphaMin
      + unitFloatFromSeed(animSeed ^ 0x4f9939f5) * (FLOWER_LIVING_DECOR.shimmerAlphaMax - FLOWER_LIVING_DECOR.shimmerAlphaMin);
    placement.swaySeed = swaySeed;
    placement.swaySpeed = swaySpeed;
    placement.swayAmplitude = swayAmplitude;
    placement.shimmerSeed = shimmerSeed;
    placement.shimmerAlpha = shimmerAlpha;
  }
  return placements;
}

function clampUnit(value) {
  return Math.max(0, Math.min(1, value));
}

function isGroundGrassCoverageLayer(layer) {
  return !!layer
    && layer.drawTarget === "base"
    && /^grass.*_1$/.test(String(layer.id || ""));
}

function isVegetationGrassLayer(layer) {
  return !!layer
    && layer.drawTarget === "detail"
    && /^grass.*_2$/.test(String(layer.id || ""));
}

function getGrassVariantImageKeys(layer) {
  if (!isGroundGrassCoverageLayer(layer) && !isVegetationGrassLayer(layer)) return null;
  return layer?.imageKey ? [layer.imageKey] : null;
}

function createVariantImageMap(assets, keys) {
  if (!keys?.length) return null;
  const imageMap = {};
  let hasImage = false;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const image = assets?.[key] || null;
    if (!image) continue;
    imageMap[key] = image;
    hasImage = true;
  }
  return hasImage ? imageMap : null;
}

function formatPlacementFilter(brightness = 1, saturation = 1, hueRotate = 0) {
  const clampedBrightness = Math.max(0.72, brightness);
  const clampedSaturation = Math.max(0.72, saturation);
  const roundedHue = Math.round(hueRotate * 10) / 10;
  if (
    Math.abs(clampedBrightness - 1) < 0.01
    && Math.abs(clampedSaturation - 1) < 0.01
    && Math.abs(roundedHue) < 0.2
  ) {
    return "none";
  }
  return `brightness(${clampedBrightness.toFixed(3)}) saturate(${clampedSaturation.toFixed(3)}) hue-rotate(${roundedHue.toFixed(1)}deg)`;
}

function sampleGrassRegionField(x, y, seed = 0) {
  const phaseA = unitFloatFromSeed(seed ^ 0x28f1b39d) * Math.PI * 2;
  const phaseB = unitFloatFromSeed(seed ^ 0x9b05688c) * Math.PI * 2;
  const phaseC = unitFloatFromSeed(seed ^ 0x510e527f) * Math.PI * 2;
  const phaseD = unitFloatFromSeed(seed ^ 0x1f83d9ab) * Math.PI * 2;
  const waveA = Math.sin(x * GROUND_GRASS_VARIATION.regionFreqX + phaseA);
  const waveB = Math.cos(y * GROUND_GRASS_VARIATION.regionFreqY + phaseB);
  const waveC = Math.sin((x + y) * GROUND_GRASS_VARIATION.detailFreqA + phaseC);
  const waveD = Math.cos((x - y) * GROUND_GRASS_VARIATION.detailFreqB + phaseD);
  return clampUnit((waveA * 0.34 + waveB * 0.3 + waveC * 0.2 + waveD * 0.16) * 0.5 + 0.5);
}

function initializeGroundGrassVariation(placements, seed = 0) {
  if (!GROUND_GRASS_VARIATION.enabled || !placements?.length) return placements;
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index];
    if (typeof placement.drawFilter === "string") continue;
    const sampleX = placement.x + placement.w * 0.5;
    const sampleY = placement.y + placement.h * 0.5;
    const toneField = sampleGrassRegionField(sampleX, sampleY, seed ^ 0x21f0aaad);
    const warmthField = sampleGrassRegionField(sampleX + 173, sampleY - 91, seed ^ 0x735a2d97);
    const brightness = 1 + (toneField * 2 - 1) * GROUND_GRASS_VARIATION.brightnessRange;
    const saturation = 1 + (warmthField * 2 - 1) * GROUND_GRASS_VARIATION.saturationRange;
    const hueRotate = (warmthField * 2 - 1) * GROUND_GRASS_VARIATION.hueRotateRange;
    placement.drawFilter = formatPlacementFilter(brightness, saturation, hueRotate);
    if (GROUND_GRASS_VARIATION.variantMixEnabled && placement.variantImageKeys?.length) {
      const variantField = sampleGrassRegionField(sampleX - 247, sampleY + 131, seed ^ 0x98badcfe);
      const variantIndex = Math.max(0, Math.min(placement.variantImageKeys.length - 1, Math.floor(variantField * placement.variantImageKeys.length)));
      placement.variantImageKey = placement.variantImageKeys[variantIndex];
    }
  }
  return placements;
}

function initializeVegetationGrassVariation(placements, seed = 0) {
  if (!VEGETATION_GRASS_VARIATION.enabled || !placements?.length) return placements;
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index];
    if (
      typeof placement.drawFilter === "string"
      && Number.isFinite(placement.drawScale)
      && Number.isFinite(placement.drawOffsetY)
      && Number.isFinite(placement.swaySeed)
      && Number.isFinite(placement.swaySpeed)
      && Number.isFinite(placement.swayAmplitude)
    ) continue;
    const animSeed = getPlacementVariationSeed(placement, seed + index * 197);
    const brightness = 1 + (unitFloatFromSeed(animSeed ^ 0x243f6a88) * 2 - 1) * VEGETATION_GRASS_VARIATION.brightnessRange;
    const saturation = 1 + (unitFloatFromSeed(animSeed ^ 0x85a308d3) * 2 - 1) * VEGETATION_GRASS_VARIATION.saturationRange;
    const hueRotate = (unitFloatFromSeed(animSeed ^ 0x13198a2e) * 2 - 1) * VEGETATION_GRASS_VARIATION.hueRotateRange;
    placement.drawFilter = formatPlacementFilter(brightness, saturation, hueRotate);
    if (VEGETATION_GRASS_VARIATION.variantMixEnabled && placement.variantImageKeys?.length) {
      placement.variantImageKey = placement.variantImageKeys[
        Math.floor(unitFloatFromSeed(animSeed ^ 0xd1310ba6) * placement.variantImageKeys.length)
      ] || placement.variantImageKeys[0];
    }
    placement.drawScale = 1 + (unitFloatFromSeed(animSeed ^ 0xa4093822) * 2 - 1) * VEGETATION_GRASS_VARIATION.scaleJitter;
    placement.drawOffsetY = (unitFloatFromSeed(animSeed ^ 0x299f31d0) * 2 - 1) * VEGETATION_GRASS_VARIATION.yJitter;
    placement.swaySeed = unitFloatFromSeed(animSeed ^ 0x082efa98) * Math.PI * 2;
    placement.swaySpeed = VEGETATION_GRASS_VARIATION.swaySpeedMin
      + unitFloatFromSeed(animSeed ^ 0xec4e6c89) * (VEGETATION_GRASS_VARIATION.swaySpeedMax - VEGETATION_GRASS_VARIATION.swaySpeedMin);
    placement.swayAmplitude = VEGETATION_GRASS_VARIATION.swayAmplitudeMin
      + unitFloatFromSeed(animSeed ^ 0x452821e6) * (VEGETATION_GRASS_VARIATION.swayAmplitudeMax - VEGETATION_GRASS_VARIATION.swayAmplitudeMin);
  }
  return placements;
}

function initializeOverlayLayerVariation(layer, placements, seed = 0) {
  const variantImageKeys = getGrassVariantImageKeys(layer);
  if (variantImageKeys?.length) {
    for (let index = 0; index < placements.length; index += 1) {
      placements[index].variantImageKeys = variantImageKeys;
    }
  }
  if (isGroundGrassCoverageLayer(layer)) return initializeGroundGrassVariation(placements, seed);
  if (isVegetationGrassLayer(layer)) return initializeVegetationGrassVariation(placements, seed);
  return placements;
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

function addPlacementTilesToSet(tileKeys, placements, tileSize) {
  if (!tileKeys || !placements?.length || !tileSize) return;
  for (const placement of placements) {
    const gx0 = Math.floor(placement.x / tileSize);
    const gy0 = Math.floor(placement.y / tileSize);
    const gx1 = Math.ceil((placement.x + placement.w) / tileSize) - 1;
    const gy1 = Math.ceil((placement.y + placement.h) / tileSize) - 1;
    for (let gy = gy0; gy <= gy1; gy += 1) {
      for (let gx = gx0; gx <= gx1; gx += 1) {
        tileKeys.add(`${gx},${gy}`);
      }
    }
  }
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

function getArchetypeGroundTypeId(archetype, defaultGroundTypeId = "grassA") {
  return OPENWORLD_GROUND_TYPES[BIOME_STYLE_BY_ARCHETYPE[archetype]]
    ? BIOME_STYLE_BY_ARCHETYPE[archetype]
    : defaultGroundTypeId;
}

function sampleInfluence(world, x, y, fallbackGroundTypeId = "grassA") {
  const sample = world?.sampleBiomeInfluence?.(x, y) || null;
  const primaryArchetype = sample?.primaryArchetype || "openSpace";
  const secondary = sample?.weights?.[1] || null;
  return {
    primaryArchetype,
    secondaryArchetype: secondary?.archetype || null,
    secondaryWeight: secondary?.weight || 0,
    primaryGroundTypeId: getArchetypeGroundTypeId(primaryArchetype, fallbackGroundTypeId),
    secondaryGroundTypeId: getArchetypeGroundTypeId(secondary?.archetype, fallbackGroundTypeId),
    sourceIds: sample?.sourceIds || []
  };
}

function filterFamiliesByArchetype(families, archetype) {
  if (!families.length) return [];
  const archetypeKey = String(archetype || "openSpace");
  let hash = 0;
  for (let index = 0; index < archetypeKey.length; index += 1) hash = ((hash * 31) + archetypeKey.charCodeAt(index)) >>> 0;
  const start = hash % families.length;
  const selected = [];
  for (let offset = 0; offset < Math.min(ARCHETYPE_FLOWER_STRIDE, families.length); offset += 1) {
    selected.push(families[(start + offset) % families.length]);
  }
  return selected;
}

function getFloorTileCount(world) {
  return world._floorTileCount
    ?? (() => {
      let count = 0;
      for (let gy = 0; gy < world.rows; gy += 1) {
        for (let gx = 0; gx < world.cols; gx += 1) {
          if (world.grid[gy][gx] === 0) count += 1;
        }
      }
      return count;
    })();
}

function estimateFloorPlacementCap(world, targetCoverage, options = {}) {
  const floorTileCount = getFloorTileCount(world);
  const densityPerTile = Math.max(0, Number(options.densityPerTile) || (1 / 28));
  const minPlacements = Math.max(1, Math.floor(options.minPlacements || 24));
  const coverage = Math.max(0, Math.min(1, Number(targetCoverage) || 0));
  return Math.max(minPlacements, Math.round(floorTileCount * coverage * densityPerTile));
}

function clampPlacementAttempts(maxPlacements, fallbackAttempts, attemptsPerPlacement = 12) {
  const fallback = Math.max(1, Math.floor(fallbackAttempts || 5000));
  if (!(maxPlacements > 0)) return fallback;
  return Math.min(fallback, Math.max(400, Math.round(maxPlacements * attemptsPerPlacement)));
}

function createFlowerPlacementRecord(family, tile, x, y, zoneId, tileSize) {
  return {
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
    trimX: tile.trimX,
    trimY: tile.trimY,
    trimW: tile.trimW,
    trimH: tile.trimH,
    pivotX: tile.pivotX,
    pivotY: tile.pivotY,
    baseX: tile.baseX,
    baseY: tile.baseY,
    zoneId,
    gx: Math.floor(x / tileSize),
    gy: Math.floor(y / tileSize)
  };
}

function chooseFlowerGroupFamilies(primaryFamily, secondaryPool, allFamilies, random) {
  const dominantFamily = primaryFamily || pickFlowerFamily(allFamilies, random);
  const secondaryCandidates = (secondaryPool || []).filter((family) => family.id !== dominantFamily?.id);
  const fallbackCandidates = allFamilies.filter((family) => family.id !== dominantFamily?.id);
  const secondaryFamily = pickFlowerFamily(
    secondaryCandidates.length ? secondaryCandidates : fallbackCandidates,
    random
  );
  const dominantShare = FLOWER_PLACEMENT_TUNING.dominantFamilyMin
    + random() * (FLOWER_PLACEMENT_TUNING.dominantFamilyMax - FLOWER_PLACEMENT_TUNING.dominantFamilyMin);
  return {
    dominantFamily,
    secondaryFamily,
    dominantShare
  };
}

function pickFlowerTileForGroup(groupFamilies, influenceFamilyPool, fallbackFamily, random) {
  const useDominant = !groupFamilies.secondaryFamily || random() <= groupFamilies.dominantShare;
  const family = useDominant
    ? groupFamilies.dominantFamily
    : groupFamilies.secondaryFamily;
  return {
    family: family
      || pickFlowerFamily(influenceFamilyPool, random)
      || fallbackFamily,
    tile: weightedPick(
      (family || pickFlowerFamily(influenceFamilyPool, random) || fallbackFamily)?.tiles || [],
      random
    )
  };
}

function tryPlaceFlower(world, placements, family, tile, x, y, zoneId, tileSize) {
  if (!family || !tile) return false;
  const rect = { x, y, w: tile.w, h: tile.h };
  if (!rectFitsWalkableTiles(world, rect)) return false;
  if (overlapsTooMuch(rect, placements, FLOWER_PLACEMENT_TUNING.maxFlowerOverlapRatio)) return false;
  placements.push(createFlowerPlacementRecord(family, tile, x, y, zoneId, tileSize));
  return true;
}

function sampleFlowerScatterPoint(zone, centerX, centerY, radiusX, radiusY, random) {
  const angle = random() * Math.PI * 2;
  const distance = Math.sqrt(random());
  const jitter = 0.82 + random() * 0.36;
  const x = Math.floor(centerX + Math.cos(angle) * radiusX * distance * jitter);
  const y = Math.floor(centerY + Math.sin(angle) * radiusY * distance * jitter);
  if (x < zone.x || y < zone.y || x > zone.x + zone.w || y > zone.y + zone.h) return null;
  return { x, y };
}

function spawnFlowerSingles(world, zone, count, groupFamilies, allFamilies, placements, tileSize, random, defaultGroundTypeId) {
  const attempts = Math.max(1, count * FLOWER_PLACEMENT_TUNING.maxPlacementAttemptsPerFlower);
  for (let attempt = 0, placed = 0; attempt < attempts && placed < count; attempt += 1) {
    const x = Math.floor(zone.x + random() * Math.max(1, zone.w));
    const y = Math.floor(zone.y + random() * Math.max(1, zone.h));
    const influence = sampleInfluence(world, x, y, defaultGroundTypeId);
    const influencePool = filterFamiliesByArchetype(allFamilies, influence.primaryArchetype);
    const picked = pickFlowerTileForGroup(groupFamilies, influencePool, groupFamilies.dominantFamily, random);
    const tile = picked.tile || weightedPick((picked.family || groupFamilies.dominantFamily)?.tiles || [], random);
    if (tryPlaceFlower(world, placements, picked.family, tile, x, y, zone.id, tileSize)) placed += 1;
  }
}

function spawnFlowerCluster(world, zone, count, groupFamilies, allFamilies, placements, tileSize, random, defaultGroundTypeId, isPatch = false) {
  const centerX = Math.floor(zone.x + random() * Math.max(1, zone.w));
  const centerY = Math.floor(zone.y + random() * Math.max(1, zone.h));
  const radiusX = isPatch
    ? FLOWER_PLACEMENT_TUNING.patchRadiusXMin + random() * (FLOWER_PLACEMENT_TUNING.patchRadiusXMax - FLOWER_PLACEMENT_TUNING.patchRadiusXMin)
    : FLOWER_PLACEMENT_TUNING.clusterRadiusMin + random() * (FLOWER_PLACEMENT_TUNING.clusterRadiusMax - FLOWER_PLACEMENT_TUNING.clusterRadiusMin);
  const radiusY = isPatch
    ? FLOWER_PLACEMENT_TUNING.patchRadiusYMin + random() * (FLOWER_PLACEMENT_TUNING.patchRadiusYMax - FLOWER_PLACEMENT_TUNING.patchRadiusYMin)
    : FLOWER_PLACEMENT_TUNING.clusterRadiusMin + random() * (FLOWER_PLACEMENT_TUNING.clusterRadiusMax - FLOWER_PLACEMENT_TUNING.clusterRadiusMin);
  const falloffExponent = isPatch
    ? FLOWER_PLACEMENT_TUNING.patchFalloffExponent
    : FLOWER_PLACEMENT_TUNING.clusterFalloffExponent;
  const maxAttempts = Math.max(count * FLOWER_PLACEMENT_TUNING.maxPlacementAttemptsPerFlower * 3, count + 4);

  for (let attempt = 0, placed = 0; attempt < maxAttempts && placed < count; attempt += 1) {
    const point = sampleFlowerScatterPoint(zone, centerX, centerY, radiusX, radiusY, random);
    if (!point) continue;
    const dx = (point.x - centerX) / Math.max(1, radiusX);
    const dy = (point.y - centerY) / Math.max(1, radiusY);
    const normalizedDistance = Math.sqrt(dx * dx + dy * dy);
    if (normalizedDistance > 1) continue;
    const spawnChance = Math.max(0, 1 - Math.pow(normalizedDistance, falloffExponent));
    if (random() > spawnChance) continue;
    const influence = sampleInfluence(world, point.x, point.y, defaultGroundTypeId);
    const influencePool = filterFamiliesByArchetype(allFamilies, influence.primaryArchetype);
    const picked = pickFlowerTileForGroup(groupFamilies, influencePool, groupFamilies.dominantFamily, random);
    const tile = picked.tile || weightedPick((picked.family || groupFamilies.dominantFamily)?.tiles || [], random);
    if (tryPlaceFlower(world, placements, picked.family, tile, point.x, point.y, zone.id, tileSize)) placed += 1;
  }
}

function buildGroundPlacements(world, patchDefs, seed, options = {}) {
  if (!patchDefs.length) return [];
  const random = createSeededRandom(seed >>> 0);
  const tileSize = world.tileSize;
  // Fix 1: use pre-computed count (set in generateRoom) — avoids grid.flat().filter() per call
  const floorTileCount = world._floorTileCount
    ?? (() => { let n = 0; for (let gy = 0; gy < world.rows; gy++) for (let gx = 0; gx < world.cols; gx++) if (world.grid[gy][gx] === 0) n++; return n; })();
  const targetArea = floorTileCount * tileSize * tileSize * Math.max(0, Math.min(1, options.targetCoverage || 0));
  const avoidTileKeys = options.avoidTileKeys instanceof Set ? options.avoidTileKeys : null;
  const avoidTilePadding = Math.max(0, Math.floor(options.avoidTilePadding ?? 2));
  const placementFilter = typeof options.placementFilter === "function" ? options.placementFilter : null;
  const sampleBounds = options.sampleBounds || null;
  const maxPlacements = Math.max(0, Math.floor(options.maxPlacements || 0));
  const perfStats = options.perfStats || null;
  const accepted = [];
  let coveredArea = 0;

  for (
    let attempt = 0;
    attempt < (options.maxPlacementAttempts || 5000)
      && coveredArea < targetArea
      && (!maxPlacements || accepted.length < maxPlacements);
    attempt += 1
  ) {
    if (perfStats) perfStats.groundAttempts += 1;
    const patchDef = weightedPick(patchDefs, random);
    if (!patchDef) break;
    const widthLimit = sampleBounds?.w ?? world.width;
    const heightLimit = sampleBounds?.h ?? world.height;
    const originX = sampleBounds?.x ?? 0;
    const originY = sampleBounds?.y ?? 0;
    const rect = {
      x: Math.floor(originX + random() * Math.max(1, widthLimit - patchDef.w)),
      y: Math.floor(originY + random() * Math.max(1, heightLimit - patchDef.h)),
      w: patchDef.w,
      h: patchDef.h
    };
    if (!rectFitsWalkableTiles(world, rect)) continue;
    if (avoidTileKeys && rectIntersectsTileSet(rect, avoidTileKeys, tileSize, avoidTilePadding)) continue;
    if (placementFilter && !placementFilter(rect, random)) continue;
    if (overlapsTooMuch(rect, accepted, options.maxOverlapRatio || 0)) continue;
    accepted.push({
      ...rect,
      sx: patchDef.x,
      sy: patchDef.y,
      sw: patchDef.w,
      sh: patchDef.h
    });
    if (perfStats) perfStats.groundAccepted += 1;
    coveredArea += rect.w * rect.h;
  }

  return accepted;
}

function buildFlowerPlacements(world, flowerFamilies, seed, options = {}) {
  if (!flowerFamilies.length) return [];
  const zones = world?.biomeInfluenceField?.cells?.length
    ? world.biomeInfluenceField.cells.map((cell) => ({
        id: cell.id,
        archetype: cell.archetype,
        x: cell.nominalBounds.x,
        y: cell.nominalBounds.y,
        w: cell.nominalBounds.w,
        h: cell.nominalBounds.h
      }))
    : getWorldZoneBounds(world);
  if (!zones.length) return [];
  const random = createSeededRandom((seed ^ 0x6d2b79f5) >>> 0);
  const minPerZone = Math.max(1, Math.floor(Number(options.minPerZone) || 8));
  const maxPerZone = Math.max(minPerZone, Math.floor(Number(options.maxPerZone) || 20));
  const mixNeighborChance = Math.max(0, Math.min(1, Number(options.mixNeighborChance) || 0.1));
  const placements = [];
  const tileSize = world.tileSize;

  for (const zone of zones) {
    const isOpenSpaceZone = zone.archetype === "openSpace";
    const centerInfluence = sampleInfluence(
      world,
      zone.x + zone.w * 0.5,
      zone.y + zone.h * 0.5,
      options.defaultGroundTypeId || "grassA"
    );
    const primaryFamilyPool = filterFamiliesByArchetype(flowerFamilies, centerInfluence.primaryArchetype);
    const secondaryFamilyPool = filterFamiliesByArchetype(flowerFamilies, centerInfluence.secondaryArchetype);
    const primaryFamily = pickFlowerFamily(primaryFamilyPool.length ? primaryFamilyPool : flowerFamilies, random);
    if (!primaryFamily) continue;
    const count = minPerZone + Math.floor(random() * (maxPerZone - minPerZone + 1));
    const singlesCount = Math.max(1, Math.round(count * FLOWER_PLACEMENT_TUNING.singlesShare));
    const clusterBudget = Math.max(0, Math.round(count * FLOWER_PLACEMENT_TUNING.clustersShare));
    const patchBudget = Math.max(0, count - singlesCount - clusterBudget);
    const clusterCount = clusterBudget > 0 ? Math.max(1, Math.round(clusterBudget / 7)) : 0;
    const patchCount = patchBudget > 0
      ? Math.max(1, Math.round(patchBudget / 18)) + (isOpenSpaceZone ? FLOWER_PLACEMENT_TUNING.openSpacePatchBonus : 0)
      : (isOpenSpaceZone ? FLOWER_PLACEMENT_TUNING.openSpacePatchBonus : 0);
    const clusterBaseCount = clusterCount > 0 ? Math.max(1, Math.floor(clusterBudget / clusterCount)) : 0;
    const patchBaseCount = patchCount > 0 ? Math.max(1, Math.floor(patchBudget / patchCount)) : 0;
    const defaultGroundTypeId = options.defaultGroundTypeId || "grassA";
    const zoneSecondaryPool = secondaryFamilyPool.length
      ? secondaryFamilyPool
      : [pickNeighborFlowerFamily(flowerFamilies, primaryFamily, random)].filter(Boolean);
    const singletonFamilies = chooseFlowerGroupFamilies(primaryFamily, zoneSecondaryPool, flowerFamilies, random);

    spawnFlowerSingles(
      world,
      zone,
      singlesCount,
      singletonFamilies,
      flowerFamilies,
      placements,
      tileSize,
      random,
      defaultGroundTypeId
    );

    for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex += 1) {
      const localInfluence = sampleInfluence(
        world,
        zone.x + random() * Math.max(1, zone.w),
        zone.y + random() * Math.max(1, zone.h),
        defaultGroundTypeId
      );
      const localPrimaryPool = filterFamiliesByArchetype(flowerFamilies, localInfluence.primaryArchetype);
      const localSecondaryPool = filterFamiliesByArchetype(flowerFamilies, localInfluence.secondaryArchetype);
      const groupFamilies = chooseFlowerGroupFamilies(
        pickFlowerFamily(localPrimaryPool.length ? localPrimaryPool : [primaryFamily], random) || primaryFamily,
        localSecondaryPool.length ? localSecondaryPool : zoneSecondaryPool,
        flowerFamilies,
        random
      );
      const flowersInCluster = Math.max(
        1,
        Math.min(
          FLOWER_PLACEMENT_TUNING.clusterFlowersMax,
          Math.max(
            FLOWER_PLACEMENT_TUNING.clusterFlowersMin,
            clusterBaseCount + Math.floor(random() * 3) - 1
          )
        )
      );
      spawnFlowerCluster(
        world,
        zone,
        flowersInCluster,
        groupFamilies,
        flowerFamilies,
        placements,
        tileSize,
        random,
        defaultGroundTypeId,
        false
      );
    }

    for (let patchIndex = 0; patchIndex < patchCount; patchIndex += 1) {
      const localInfluence = sampleInfluence(
        world,
        zone.x + random() * Math.max(1, zone.w),
        zone.y + random() * Math.max(1, zone.h),
        defaultGroundTypeId
      );
      const localPrimaryPool = filterFamiliesByArchetype(flowerFamilies, localInfluence.primaryArchetype);
      const localSecondaryPool = filterFamiliesByArchetype(flowerFamilies, localInfluence.secondaryArchetype);
      const groupFamilies = chooseFlowerGroupFamilies(
        pickFlowerFamily(localPrimaryPool.length ? localPrimaryPool : [primaryFamily], random) || primaryFamily,
        localSecondaryPool.length ? localSecondaryPool : zoneSecondaryPool,
        flowerFamilies,
        random
      );
      const flowersInPatch = Math.max(
        1,
        Math.min(
          FLOWER_PLACEMENT_TUNING.patchFlowersMax,
          Math.max(
            FLOWER_PLACEMENT_TUNING.patchFlowersMin,
            Math.round(
              (patchBaseCount + Math.floor(random() * 5) - 2)
              * (isOpenSpaceZone ? FLOWER_PLACEMENT_TUNING.openSpacePatchFlowerMultiplier : 1)
            )
          )
        )
      );
      spawnFlowerCluster(
        world,
        zone,
        flowersInPatch,
        groupFamilies,
        flowerFamilies,
        placements,
        tileSize,
        random,
        defaultGroundTypeId,
        true
      );
    }
  }

  return placements;
}

function buildInfluenceOverlayPlacements(world, seed, assets, groundTypeId, options = {}) {
  const config = OPENWORLD_GROUND_TYPES[groundTypeId];
  if (!config) return [];
  const placementsByLayer = [];
  const fieldBand = world?.biomeInfluenceField?.band || null;
  for (let index = 0; index < config.overlayLayers.length; index += 1) {
    const layerConfig = config.overlayLayers[index];
    const image = assets[layerConfig.imageKey];
    const defs = normalizePatchDefs(assets[layerConfig.defsKey]);
    const targetCoverage = Math.max(0, Math.min(1, (layerConfig.targetCoverage || 0) * (options.coverageScale || 1)));
    const maxPlacements = estimateFloorPlacementCap(world, targetCoverage, {
      densityPerTile: options.densityPerTile || (1 / 30),
      minPlacements: options.minPlacements || 12
    });
    const placements = buildGroundPlacements(world, defs, seed + index * 4099, {
      targetCoverage,
      maxOverlapRatio: layerConfig.maxOverlapRatio,
      maxPlacements,
      maxPlacementAttempts: clampPlacementAttempts(
        maxPlacements,
        Math.max(600, Math.round((layerConfig.maxPlacementAttempts || 4000) * (options.attemptScale || 1))),
        options.attemptsPerPlacement || 14
      ),
      avoidTileKeys: options.avoidTileKeys || null,
      avoidTilePadding: options.avoidTilePadding ?? CLIFF_AVOID_TILE_PADDING,
      perfStats: options.perfStats || null,
      sampleBounds: fieldBand,
      placementFilter: (rect) => {
        const centerX = rect.x + rect.w * 0.5;
        const centerY = rect.y + rect.h * 0.5;
        const influence = sampleInfluence(world, centerX, centerY, groundTypeId);
        if (options.targetArchetype && influence.primaryArchetype !== options.targetArchetype) {
          return (world.sampleBiomeInfluence?.(centerX, centerY)?.weights || [])
            .some((entry) => entry.archetype === options.targetArchetype && entry.weight >= (options.minWeight ?? INFLUENCE_MIN_ACCENT_WEIGHT));
        }
        return influence.primaryGroundTypeId === groundTypeId || influence.secondaryWeight >= (options.minWeight ?? INFLUENCE_MIN_OVERLAY_WEIGHT);
      }
    });
    placementsByLayer.push({
      ...layerConfig,
      image,
      placements
    });
  }
  return placementsByLayer;
}

// scale: fraction of world resolution to draw at (e.g. 0.5 = half-res).
// All draw coords are world-space; ctx.scale handles mapping to canvas pixels.
function buildBaseCanvas(world, seed, baseImage, config, scale = 1) {
  const canvas = createCanvas(
    Math.max(1, Math.floor(world.width * scale)),
    Math.max(1, Math.floor(world.height * scale))
  );
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.scale(scale, scale); // world-space draw calls → canvas pixels
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

function stampPlacements(ctx, image, placements, scale = 1, imageMap = null) {
  if (!image || !placements.length) return;
  const previousSmoothing = ctx.imageSmoothingEnabled;
  const previousFilter = ctx.filter;
  ctx.imageSmoothingEnabled = false;
  for (const placement of placements) {
    const placementImage = imageMap?.[placement.variantImageKey] || image;
    ctx.filter = placement.drawFilter || "none";
    const scaledX = Math.floor(placement.x * scale);
    const scaledY = Math.floor(placement.y * scale);
    const scaledW = Math.max(1, Math.ceil(placement.w * scale));
    const scaledH = Math.max(1, Math.ceil(placement.h * scale));
    ctx.drawImage(
      placementImage,
      placement.sx,
      placement.sy,
      placement.sw,
      placement.sh,
      scaledX,
      scaledY,
      scaledW,
      scaledH
    );
  }
  ctx.filter = previousFilter;
  ctx.imageSmoothingEnabled = previousSmoothing;
}

function drawVegetationGrassLayers(ctx, layers, camera, time = 0) {
  if (!VEGETATION_GRASS_VARIATION.enabled || !layers?.length) return;
  const previousSmoothing = ctx.imageSmoothingEnabled;
  const previousFilter = ctx.filter;
  const visibleLeft = camera.x - 8;
  const visibleTop = camera.y - 8;
  const visibleRight = camera.x + camera.viewWidth + 8;
  const visibleBottom = camera.y + camera.viewHeight + 8;
  const swayEnabled = VEGETATION_GRASS_VARIATION.swayEnabled;
  const timeSeconds = swayEnabled ? Math.max(0, Number(time) || 0) : 0;
  const globalWindPhase = swayEnabled
    ? timeSeconds * ((Math.PI * 2) / Math.max(0.001, VEGETATION_GRASS_VARIATION.globalWindCycleSeconds))
    : 0;
  const globalWind = swayEnabled
    ? Math.sin(globalWindPhase) * 0.72 + Math.sin(globalWindPhase * 0.53 + 1.41) * 0.28
    : 0;

  ctx.imageSmoothingEnabled = false;
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    const layer = layers[layerIndex];
    if (!isVegetationGrassLayer(layer) || !layer?.image || !layer.placements?.length) continue;
    for (let index = 0; index < layer.placements.length; index += 1) {
      const placement = layer.placements[index];
      const image = layer.variantImages?.[placement.variantImageKey] || layer.image;
      const drawScale = placement.drawScale || 1;
      const sourceW = placement.sw || placement.w;
      const sourceH = placement.sh || placement.h;
      const drawW = Math.max(1, Math.round(placement.w * drawScale));
      const drawH = Math.max(1, Math.round(placement.h * drawScale));
      const widthSwayScale = Math.max(0.35, Math.min(1, placement.w / 28));
      const swayOffsetX = swayEnabled
        ? (globalWind * 0.45 + Math.sin(timeSeconds * placement.swaySpeed + placement.swaySeed) * 0.55) * placement.swayAmplitude * widthSwayScale
        : 0;
      const screenX = placement.x - camera.x - (drawW - placement.w) * 0.5 + swayOffsetX;
      const screenY = Math.round(placement.y - camera.y - (drawH - placement.h) + (placement.drawOffsetY || 0));
      if (
        screenX + drawW < -8
        || screenY + drawH < -8
        || screenX > camera.viewWidth + 8
        || screenY > camera.viewHeight + 8
        || placement.x + placement.w < visibleLeft
        || placement.y + placement.h < visibleTop
        || placement.x > visibleRight
        || placement.y > visibleBottom
      ) {
        continue;
      }
      ctx.filter = placement.drawFilter || "none";
      if (!swayEnabled || Math.abs(swayOffsetX) < 0.001) {
        ctx.drawImage(
          image,
          placement.sx,
          placement.sy,
          sourceW,
          sourceH,
          screenX,
          screenY,
          drawW,
          drawH
        );
        continue;
      }

      for (let sliceIndex = 0; sliceIndex < 3; sliceIndex += 1) {
        const sourceSliceY = Math.floor((sourceH * sliceIndex) / 3);
        const nextSourceSliceY = Math.floor((sourceH * (sliceIndex + 1)) / 3);
        const sourceSliceH = nextSourceSliceY - sourceSliceY;
        if (sourceSliceH <= 0) continue;
        const drawSliceY = Math.floor((drawH * sliceIndex) / 3);
        const nextDrawSliceY = Math.floor((drawH * (sliceIndex + 1)) / 3);
        const drawSliceH = nextDrawSliceY - drawSliceY;
        if (drawSliceH <= 0) continue;
        const sliceWeight = sliceIndex === 0
          ? VEGETATION_GRASS_VARIATION.topSliceWeight
          : sliceIndex === 1
            ? VEGETATION_GRASS_VARIATION.midSliceWeight
            : VEGETATION_GRASS_VARIATION.bottomSliceWeight;
        ctx.drawImage(
          image,
          placement.sx,
          placement.sy + sourceSliceY,
          sourceW,
          sourceSliceH,
          screenX - swayOffsetX + swayOffsetX * sliceWeight,
          screenY + drawSliceY,
          drawW,
          drawSliceH
        );
      }
    }
  }
  ctx.filter = previousFilter;
  ctx.imageSmoothingEnabled = previousSmoothing;
}

function drawCanvasSlice(ctx, canvas, camera, scale = 1) {
  if (!canvas) return;
  const sourceX = Math.max(0, Math.floor(camera.x * scale));
  const sourceY = Math.max(0, Math.floor(camera.y * scale));
  const sourceW = Math.min(Math.ceil(camera.viewWidth * scale), canvas.width - sourceX);
  const sourceH = Math.min(Math.ceil(camera.viewHeight * scale), canvas.height - sourceY);
  if (sourceW <= 0 || sourceH <= 0) return;
  const previousSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    canvas,
    sourceX,
    sourceY,
    sourceW,
    sourceH,
    sourceX / scale - camera.x,
    sourceY / scale - camera.y,
    sourceW / scale,
    sourceH / scale
  );
  ctx.imageSmoothingEnabled = previousSmoothing;
}

function drawAnimatedFlowerLayer(ctx, flowerLayer, camera, time = 0) {
  if (!FLOWER_LIVING_DECOR.enabled || !flowerLayer?.image || !flowerLayer.placements?.length) return;
  const placements = flowerLayer.placements;
  const image = flowerLayer.image;
  const visibleLeft = camera.x - 4;
  const visibleTop = camera.y - 4;
  const visibleRight = camera.x + camera.viewWidth + 4;
  const visibleBottom = camera.y + camera.viewHeight + 4;
  const sliceCount = Math.max(1, FLOWER_LIVING_DECOR.sliceCount | 0);
  const sliceWeight0 = FLOWER_LIVING_DECOR.sliceWeight0;
  const sliceWeight1 = FLOWER_LIVING_DECOR.sliceWeight1;
  const sliceWeight2 = FLOWER_LIVING_DECOR.sliceWeight2;
  const sliceWeight3 = FLOWER_LIVING_DECOR.sliceWeight3;
  const rootedBandRatio = FLOWER_LIVING_DECOR.rootedBandRatio;
  const shimmerBandRatio = FLOWER_LIVING_DECOR.shimmerBandRatio;
  const timeSeconds = Math.max(0, Number(time) || 0);
  const globalWindPhase = timeSeconds * ((Math.PI * 2) / Math.max(0.001, FLOWER_LIVING_DECOR.globalWindCycleSeconds));
  const globalWind = Math.sin(globalWindPhase) * 0.7 + Math.sin(globalWindPhase * 0.47 + 1.31) * 0.3;
  const previousSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;

  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index];
    const px = placement.x;
    const py = placement.y;
    const pw = placement.w;
    const ph = placement.h;
    if (px + pw < visibleLeft || py + ph < visibleTop || px > visibleRight || py > visibleBottom) continue;

    const screenX = px - camera.x;
    const screenY = py - camera.y;
    const sourceX = placement.sx;
    const sourceY = placement.sy;
    const sourceW = placement.sw || placement.w;
    const sourceH = placement.sh || placement.h;
    const baseY = Math.max(0, Math.min(sourceH - 1, Math.floor(
      Number.isFinite(placement.baseY) ? placement.baseY : (sourceH - 1)
    )));
    const rootedBandHeight = Math.max(1, Math.floor(sourceH * rootedBandRatio));
    const bendStartY = Math.max(0, baseY - rootedBandHeight);
    const localPhase = timeSeconds * placement.swaySpeed + placement.swaySeed;
    const localWind = Math.sin(localPhase) * 0.65 + Math.sin(localPhase * 0.51 + placement.shimmerSeed) * 0.35;
    const swayOffset = (globalWind * 0.55 + localWind * 0.45) * placement.swayAmplitude;

    for (let sliceIndex = 0; sliceIndex < sliceCount; sliceIndex += 1) {
      const localY = Math.floor((sourceH * sliceIndex) / sliceCount);
      const nextLocalY = Math.floor((sourceH * (sliceIndex + 1)) / sliceCount);
      const sliceH = nextLocalY - localY;
      if (sliceH <= 0) continue;
      const reversedSliceIndex = sliceCount - 1 - sliceIndex;
      const weight = reversedSliceIndex === 0
        ? sliceWeight0
        : reversedSliceIndex === 1
          ? sliceWeight1
          : reversedSliceIndex === 2
            ? sliceWeight2
            : sliceWeight3;
      const sliceCenterY = localY + sliceH * 0.5;
      const anchoredWeight = sliceCenterY >= bendStartY
        ? 0
        : (bendStartY <= 0 ? 1 : (bendStartY - sliceCenterY) / bendStartY);
      const sliceOffsetX = swayOffset * weight * Math.max(0, Math.min(1, anchoredWeight));
      ctx.drawImage(
        image,
        sourceX,
        sourceY + localY,
        sourceW,
        sliceH,
        screenX + sliceOffsetX,
        screenY + localY,
        sourceW,
        sliceH
      );
    }

    const shimmerWave = Math.sin(timeSeconds * (placement.swaySpeed * 0.7 + 0.35) + placement.shimmerSeed);
    const shimmerAlpha = Math.max(0, shimmerWave) * placement.shimmerAlpha;
    if (shimmerAlpha > 0.003) {
      const shimmerH = Math.max(1, Math.min(sourceH, Math.round(sourceH * shimmerBandRatio)));
      ctx.globalAlpha = shimmerAlpha;
      for (let sliceIndex = 0; sliceIndex < sliceCount; sliceIndex += 1) {
        const localY = Math.floor((shimmerH * sliceIndex) / sliceCount);
        const nextLocalY = Math.floor((shimmerH * (sliceIndex + 1)) / sliceCount);
        const sliceH = nextLocalY - localY;
        if (sliceH <= 0) continue;
        const reversedSliceIndex = sliceCount - 1 - sliceIndex;
        const weight = reversedSliceIndex === 0
          ? sliceWeight0
          : reversedSliceIndex === 1
            ? sliceWeight1
            : reversedSliceIndex === 2
              ? sliceWeight2
              : sliceWeight3;
        const sliceCenterY = localY + sliceH * 0.5;
        const anchoredWeight = sliceCenterY >= bendStartY
          ? 0
          : (bendStartY <= 0 ? 1 : (bendStartY - sliceCenterY) / bendStartY);
        const sliceOffsetX = swayOffset * weight * Math.max(0, Math.min(1, anchoredWeight));
        ctx.drawImage(
          image,
          sourceX,
          sourceY + localY,
          sourceW,
          sliceH,
          screenX + sliceOffsetX,
          screenY + localY,
          sourceW,
          sliceH
        );
      }
      ctx.globalAlpha = 1;
    }
  }

  ctx.imageSmoothingEnabled = previousSmoothing;
}

export function buildOpenWorldCosmeticFloor(world, seed, assets, groundTypeId = "grassA") {
  const config = OPENWORLD_GROUND_TYPES[groundTypeId];
  if (!config) return null;
  if (isBreakableOnlyCosmeticId(config.id)) return null;
  const baseImage = assets[config.baseImageKey];
  if (!baseImage) return null;
  // Floor canvases can render at full resolution or a reduced internal scale.
  const FLOOR_SCALE = getFloorRenderScale();
  const scaledWidth = Math.max(1, Math.floor(world.width * FLOOR_SCALE));
  const scaledHeight = Math.max(1, Math.floor(world.height * FLOOR_SCALE));

  const baseCanvas = buildBaseCanvas(world, seed, baseImage, config, FLOOR_SCALE);
  const detailCanvas = createCanvas(scaledWidth, scaledHeight);
  const decorCanvas = createCanvas(scaledWidth, scaledHeight);
  const baseCtx = baseCanvas.getContext("2d");
  const detailCtx = detailCanvas.getContext("2d");
  const overlayLayers = [];
  const perfStats = {
    groundAttempts: 0,
    groundAccepted: 0,
    flowerPlacements: 0
  };
  const occludeTiles = world.upperCliff?.occludeTiles || new Set();
  const cliffPlacements = world.upperCliff?.rockBorder?.placements || [];
  let layer2AvoidTileKeys = null;
  if (occludeTiles.size || cliffPlacements.length) {
    layer2AvoidTileKeys = new Set(occludeTiles);
    // Match the archive behavior: avoid every current cliff sprite footprint,
    // not just the discrete occlusion tile set.
    addPlacementTilesToSet(layer2AvoidTileKeys, cliffPlacements, world.tileSize);
  }

  for (let index = 0; index < config.overlayLayers.length; index += 1) {
    const layerConfig = config.overlayLayers[index];
    if (
      isBreakableOnlyCosmeticId(layerConfig.id)
      || isBreakableOnlyCosmeticId(layerConfig.imageKey)
      || isBreakableOnlyCosmeticId(layerConfig.defsKey)
    ) continue;
    const image = assets[layerConfig.imageKey];
    const defs = normalizePatchDefs(assets[layerConfig.defsKey]);
    const maxPlacements = estimateFloorPlacementCap(world, layerConfig.targetCoverage, {
      densityPerTile: layerConfig.drawTarget === "base" ? (1 / 24) : (1 / 34),
      minPlacements: layerConfig.drawTarget === "base" ? 48 : 18
    });
    const shouldAvoidCliff =
      !!layer2AvoidTileKeys?.size &&
      shouldAvoidUpperCliffForOverlay(layerConfig.id || "");
    const placements = buildGroundPlacements(world, defs, seed + index * 4099, {
      targetCoverage: layerConfig.targetCoverage,
      maxOverlapRatio: layerConfig.maxOverlapRatio,
      maxPlacements,
      maxPlacementAttempts: clampPlacementAttempts(maxPlacements, layerConfig.maxPlacementAttempts, 12),
      avoidTileKeys: shouldAvoidCliff ? layer2AvoidTileKeys : null,
      avoidTilePadding: CLIFF_AVOID_TILE_PADDING,
      perfStats,
      placementFilter: (rect) => {
        const centerX = rect.x + rect.w * 0.5;
        const centerY = rect.y + rect.h * 0.5;
        const influence = sampleInfluence(world, centerX, centerY, groundTypeId);
        return influence.primaryGroundTypeId === groundTypeId
          || influence.secondaryGroundTypeId === groundTypeId
          || influence.secondaryWeight >= INFLUENCE_MIN_OVERLAY_WEIGHT;
      }
    });
    initializeOverlayLayerVariation(layerConfig, placements, seed + index * 4099);
    const variantImages = createVariantImageMap(assets, getGrassVariantImageKeys(layerConfig));
    overlayLayers.push({ ...layerConfig, image, variantImages, placements });
    if (!isVegetationGrassLayer(layerConfig)) {
      stampPlacements(layerConfig.drawTarget === "base" ? baseCtx : detailCtx, image, placements, FLOOR_SCALE, variantImages);
    }
  }

  const accentArchetypes = [...new Set(
    (world?.biomeInfluenceField?.cells || [])
      .map((cell) => cell.archetype)
      .filter((archetype) => getArchetypeGroundTypeId(archetype, groundTypeId) !== groundTypeId)
  )];
  const accentLayers = [];
  for (let index = 0; index < accentArchetypes.length; index += 1) {
    const archetype = accentArchetypes[index];
    const accentGroundTypeId = getArchetypeGroundTypeId(archetype, groundTypeId);
    const placementsByLayer = buildInfluenceOverlayPlacements(
      world,
      seed + 0x1701 + index * 7919,
      assets,
      accentGroundTypeId,
      {
        targetArchetype: archetype,
        minWeight: INFLUENCE_MIN_ACCENT_WEIGHT,
        coverageScale: 0.18,
        attemptScale: 0.35,
        densityPerTile: 1 / 30,
        minPlacements: 12,
        attemptsPerPlacement: 14,
        avoidTileKeys: layer2AvoidTileKeys,
        avoidTilePadding: CLIFF_AVOID_TILE_PADDING,
        perfStats
      }
    );
    accentLayers.push({
      archetype,
      groundTypeId: accentGroundTypeId,
      layers: placementsByLayer.map((layer) => ({
        ...layer,
        variantImages: createVariantImageMap(assets, getGrassVariantImageKeys(layer))
      }))
    });
    for (let layerIndex = 0; layerIndex < placementsByLayer.length; layerIndex += 1) {
      const layer = accentLayers[accentLayers.length - 1].layers[layerIndex];
      initializeOverlayLayerVariation(layer, layer.placements, seed + 0x1701 + index * 7919 + layerIndex * 313);
      if (isVegetationGrassLayer(layer)) continue;
      stampPlacements(
        layer.drawTarget === "base" ? baseCtx : detailCtx,
        layer.image,
        layer.placements,
        FLOOR_SCALE,
        layer.variantImages
      );
    }
  }

  let flowerLayer = null;
  if (config.flowerLayer) {
    if (
      isBreakableOnlyCosmeticId(config.flowerLayer.id)
      || isBreakableOnlyCosmeticId(config.flowerLayer.imageKey)
      || isBreakableOnlyCosmeticId(config.flowerLayer.defsKey)
    ) {
      flowerLayer = null;
    } else {
      const image = assets[config.flowerLayer.imageKey];
      const families = normalizeFlowerFamilies(assets[config.flowerLayer.defsKey]);
      const placements = buildFlowerPlacements(world, families, seed, {
        ...config.flowerLayer,
        defaultGroundTypeId: groundTypeId
      });
      initializeFlowerPlacementAnimation(placements, seed ^ 0x241c5a9d);
      perfStats.flowerPlacements = placements.length;
      flowerLayer = { ...config.flowerLayer, image, families, placements };
    }
  }

  return {
    groundTypeId,
    groundLayer: {
      buildSeed: seed,
      generationStats: perfStats,
      floorScale: FLOOR_SCALE,
      baseCanvas,
      detailCanvas,
      decorCanvas,
      overlayLayers,
      accentLayers,
      flowerLayer
    }
  };
}

function clonePlacementList(placements = []) {
  return placements.map((placement) => ({ ...placement }));
}

function cloneSerializedFloorLayer(layer) {
  if (!layer) return null;
  return {
    ...layer,
    placements: clonePlacementList(layer.placements || [])
  };
}

export function serializeOpenWorldCosmeticFloor(cosmeticFloor) {
  if (!cosmeticFloor?.groundLayer) return null;
  const groundLayer = cosmeticFloor.groundLayer;
  return {
    groundTypeId: cosmeticFloor.groundTypeId,
    groundLayer: {
      buildSeed: groundLayer.buildSeed || 0,
      floorScale: groundLayer.floorScale || 1,
      generationStats: groundLayer.generationStats
        ? { ...groundLayer.generationStats }
        : null,
      overlayLayers: (groundLayer.overlayLayers || []).map((layer) => cloneSerializedFloorLayer({
        id: layer.id,
        imageKey: layer.imageKey,
        defsKey: layer.defsKey,
        targetCoverage: layer.targetCoverage,
        maxOverlapRatio: layer.maxOverlapRatio,
        maxPlacementAttempts: layer.maxPlacementAttempts,
        drawTarget: layer.drawTarget,
        placements: layer.placements || []
      })),
      accentLayers: (groundLayer.accentLayers || []).map((accent) => ({
        archetype: accent.archetype,
        groundTypeId: accent.groundTypeId,
        layers: (accent.layers || []).map((layer) => cloneSerializedFloorLayer({
          id: layer.id,
          imageKey: layer.imageKey,
          defsKey: layer.defsKey,
          targetCoverage: layer.targetCoverage,
          maxOverlapRatio: layer.maxOverlapRatio,
          maxPlacementAttempts: layer.maxPlacementAttempts,
          drawTarget: layer.drawTarget,
          placements: layer.placements || []
        }))
      })),
      flowerLayer: groundLayer.flowerLayer
        ? cloneSerializedFloorLayer({
          id: groundLayer.flowerLayer.id,
          imageKey: groundLayer.flowerLayer.imageKey,
          defsKey: groundLayer.flowerLayer.defsKey,
          minPerZone: groundLayer.flowerLayer.minPerZone,
          maxPerZone: groundLayer.flowerLayer.maxPerZone,
          mixNeighborChance: groundLayer.flowerLayer.mixNeighborChance,
          placements: groundLayer.flowerLayer.placements || []
        })
        : null
    }
  };
}

function stampSerializedFloorLayer(ctx, assets, layer, scale, seed = 0) {
  if (!layer) return null;
  const image = assets?.[layer.imageKey] || null;
  const placements = clonePlacementList(layer.placements || []);
  const variantImages = createVariantImageMap(assets, getGrassVariantImageKeys(layer));
  initializeOverlayLayerVariation(layer, placements, seed);
  if (!isVegetationGrassLayer(layer)) {
    stampPlacements(ctx, image, placements, scale, variantImages);
  }
  return {
    ...layer,
    image,
    variantImages,
    placements
  };
}

export function buildOpenWorldCosmeticFloorFromPrefab(world, assets, prefabFloor) {
  if (!prefabFloor?.groundLayer) return null;
  const config = OPENWORLD_GROUND_TYPES[prefabFloor.groundTypeId];
  if (!config) return null;
  const baseImage = assets?.[config.baseImageKey];
  if (!baseImage) return null;

  // Prefab floors rebuild using the current runtime setting so quality can be
  // restored without regenerating placement data.
  const floorScale = getFloorRenderScale();
  const scaledWidth = Math.max(1, Math.floor(world.width * floorScale));
  const scaledHeight = Math.max(1, Math.floor(world.height * floorScale));
  const buildSeed = prefabFloor.groundLayer.buildSeed || world.seed || 0;

  const baseCanvas = buildBaseCanvas(world, buildSeed, baseImage, config, floorScale);
  const detailCanvas = createCanvas(scaledWidth, scaledHeight);
  const decorCanvas = createCanvas(scaledWidth, scaledHeight);
  const baseCtx = baseCanvas.getContext("2d");
  const detailCtx = detailCanvas.getContext("2d");

  const overlayLayers = (prefabFloor.groundLayer.overlayLayers || []).map((layer, index) =>
    stampSerializedFloorLayer(layer.drawTarget === "base" ? baseCtx : detailCtx, assets, layer, floorScale, buildSeed + index * 4099)
  );

  const accentLayers = (prefabFloor.groundLayer.accentLayers || []).map((accent) => ({
    archetype: accent.archetype,
    groundTypeId: accent.groundTypeId,
    layers: (accent.layers || []).map((layer, index) =>
      stampSerializedFloorLayer(layer.drawTarget === "base" ? baseCtx : detailCtx, assets, layer, floorScale, buildSeed + 0x1701 + index * 313)
    )
  }));

  const flowerLayer = prefabFloor.groundLayer.flowerLayer
    ? (() => {
      const layer = {
        ...prefabFloor.groundLayer.flowerLayer,
        image: assets?.[prefabFloor.groundLayer.flowerLayer.imageKey] || null,
        placements: clonePlacementList(prefabFloor.groundLayer.flowerLayer.placements || [])
      };
      initializeFlowerPlacementAnimation(layer.placements, buildSeed ^ 0x241c5a9d);
      return layer;
    })()
    : null;

  return {
    groundTypeId: prefabFloor.groundTypeId,
    groundLayer: {
      buildSeed,
      floorScale,
      generationStats: prefabFloor.groundLayer.generationStats
        ? { ...prefabFloor.groundLayer.generationStats }
        : null,
      baseCanvas,
      detailCanvas,
      decorCanvas,
      overlayLayers,
      accentLayers,
      flowerLayer
    }
  };
}

export function drawOpenWorldGroundBase(ctx, groundLayer, camera) {
  drawCanvasSlice(ctx, groundLayer?.baseCanvas, camera, groundLayer?.floorScale || 1);
}

export function drawOpenWorldGroundDetails(ctx, groundLayer, camera) {
  drawCanvasSlice(ctx, groundLayer?.detailCanvas, camera, groundLayer?.floorScale || 1);
}

export function drawOpenWorldGroundDecor(ctx, groundLayer, camera, time = 0) {
  drawCanvasSlice(ctx, groundLayer?.decorCanvas, camera, groundLayer?.floorScale || 1);
  drawVegetationGrassLayers(ctx, groundLayer?.overlayLayers, camera, time);
  for (let index = 0; index < (groundLayer?.accentLayers?.length || 0); index += 1) {
    drawVegetationGrassLayers(ctx, groundLayer.accentLayers[index]?.layers, camera, time);
  }
  drawAnimatedFlowerLayer(ctx, groundLayer?.flowerLayer, camera, time);
}
