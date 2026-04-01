function weightedPick(entries, random) {
  if (!Array.isArray(entries) || !entries.length) return null;
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry?.weight) || 0), 0);
  if (!(totalWeight > 0)) {
    return entries[Math.floor(random() * entries.length)] || null;
  }
  let cursor = random() * totalWeight;
  for (const entry of entries) {
    cursor -= Math.max(0, Number(entry?.weight) || 0);
    if (cursor <= 0) return entry;
  }
  return entries[entries.length - 1] || null;
}

export const GIANT_ROCK_ASSET_KEYS = Object.freeze([
  "biomeGiantRock01",
  "biomeGiantRock02",
  "biomeGiantRock03",
  "biomeGiantRock04",
  "biomeGiantRock05",
  "biomeGiantRock06",
  "biomeGiantRock07",
  "biomeGiantRock08"
]);

export const BIOME_OBSTACLE_IMAGE_ASSET_SPECS = Object.freeze([
  ["biomeMagicPillarsSmall", "./assets/biomes/openworld/magic-pillars/2 Small Magic Pillars.png"],
  ["biomeMagicPillarsMedium", "./assets/biomes/openworld/magic-pillars/3 medium magic pillars.png"],
  ["biomeMagicPillarsLarge", "./assets/biomes/openworld/magic-pillars/2 Large Magic Pillars.png"],
  ["biomeGiantRock01", "./assets/biomes/openworld/rocks/rockAA_01.png"],
  ["biomeGiantRock02", "./assets/biomes/openworld/rocks/rockAA_02.png"],
  ["biomeGiantRock03", "./assets/biomes/openworld/rocks/rockAA_03.png"],
  ["biomeGiantRock04", "./assets/biomes/openworld/rocks/rockAA_04.png"],
  ["biomeGiantRock05", "./assets/biomes/openworld/rocks/rockAA_05.png"],
  ["biomeGiantRock06", "./assets/biomes/openworld/rocks/rockAA_06.png"],
  ["biomeGiantRock07", "./assets/biomes/openworld/rocks/rockAA_07.png"],
  ["biomeGiantRock08", "./assets/biomes/openworld/rocks/rockAA_08.png"]
]);

export const BIOME_OBSTACLE_JSON_ASSET_SPECS = Object.freeze([
  ["biomeMagicPillarsSmallDefs", "./assets/biomes/openworld/magic-pillars/magicPillars_small.json"],
  ["biomeMagicPillarsMediumDefs", "./assets/biomes/openworld/magic-pillars/magicPillars_medium.json"],
  ["biomeMagicPillarsLargeDefs", "./assets/biomes/openworld/magic-pillars/magicPillars_large.json"]
]);

export const BIOME_OBSTACLE_TYPES = Object.freeze({
  giantRock: Object.freeze({
    id: "giantRock",
    size: Object.freeze({ w: 72, h: 74 }),
    placementSize: Object.freeze({ w: 72, h: 74 }),
    collisionMode: "bottomScale",
    collisionScale: 0.7,
    shadowColor: "rgba(0, 0, 0, 0.3)",
    spriteAssetKeys: GIANT_ROCK_ASSET_KEYS
  }),
  magicPillarSmall: Object.freeze({
    id: "magicPillarSmall",
    size: Object.freeze({ w: 49, h: 132 }),
    placementSize: Object.freeze({ w: 49, h: 132 }),
    collisionMode: "bottomHalf",
    shadowColor: "rgba(0, 0, 0, 0.22)",
    atlasAssetKey: "biomeMagicPillarsSmall",
    defsAssetKey: "biomeMagicPillarsSmallDefs",
    frameIds: Object.freeze(["magic_pillar_small_1", "magic_pillar_small_2"])
  }),
  magicPillarMedium: Object.freeze({
    id: "magicPillarMedium",
    size: Object.freeze({ w: 103, h: 165 }),
    placementSize: Object.freeze({ w: 103, h: 165 }),
    collisionMode: "bottomHalf",
    shadowColor: "rgba(0, 0, 0, 0.24)",
    atlasAssetKey: "biomeMagicPillarsMedium",
    defsAssetKey: "biomeMagicPillarsMediumDefs",
    frameIds: Object.freeze(["magic_pillar_medium_1", "magic_pillar_medium_2", "magic_pillar_medium_3"])
  }),
  magicPillarLarge: Object.freeze({
    id: "magicPillarLarge",
    size: Object.freeze({ w: 66, h: 289 }),
    placementSize: Object.freeze({ w: 66, h: 289 }),
    collisionMode: "bottomHalf",
    shadowColor: "rgba(0, 0, 0, 0.26)",
    atlasAssetKey: "biomeMagicPillarsLarge",
    defsAssetKey: "biomeMagicPillarsLargeDefs",
    frameIds: Object.freeze(["magic_pillar_large_1", "magic_pillar_large_2"])
  })
});

export function getBiomeObstacleType(typeId) {
  return BIOME_OBSTACLE_TYPES[typeId] || null;
}

export function getBiomeObstaclePlacementSize(typeIdOrDef) {
  const typeDef = typeof typeIdOrDef === "string" ? getBiomeObstacleType(typeIdOrDef) : typeIdOrDef;
  if (!typeDef) return { w: 0, h: 0 };
  return typeDef.placementSize || typeDef.size;
}

function resolveAtlasFrame(typeDef, assets, random) {
  const defs = assets?.[typeDef.defsAssetKey];
  const objects = Array.isArray(defs?.objects) ? defs.objects : [];
  const frames = objects.filter((entry) => typeDef.frameIds.includes(entry.id));
  return weightedPick(frames, random);
}

export function createBiomeObstacle(typeId, x, y, assets, random) {
  const typeDef = getBiomeObstacleType(typeId);
  if (!typeDef) return null;
  const obstacle = {
    type: typeId,
    x,
    y,
    w: typeDef.size.w,
    h: typeDef.size.h,
    sortY: y + typeDef.size.h,
    shadowColor: typeDef.shadowColor || "rgba(0, 0, 0, 0.3)"
  };

  if (Array.isArray(typeDef.spriteAssetKeys) && typeDef.spriteAssetKeys.length) {
    obstacle.assetKey = typeDef.spriteAssetKeys[Math.floor(random() * typeDef.spriteAssetKeys.length)];
  } else if (typeDef.atlasAssetKey) {
    const frame = resolveAtlasFrame(typeDef, assets, random);
    if (!frame) return null;
    obstacle.assetKey = typeDef.atlasAssetKey;
    obstacle.atlasFrame = {
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h
    };
    obstacle.w = frame.w;
    obstacle.h = frame.h;
    obstacle.sortY = y + frame.h;
  }

  obstacle.placementRect = {
    x,
    y,
    w: getBiomeObstaclePlacementSize(typeDef).w,
    h: getBiomeObstaclePlacementSize(typeDef).h
  };
  obstacle.collisionRect = getBiomeObstacleCollisionRect(obstacle, typeDef);
  return obstacle;
}

export function getBiomeObstacleCollisionRect(obstacle, typeIdOrDef = null) {
  const typeDef = typeof typeIdOrDef === "string"
    ? getBiomeObstacleType(typeIdOrDef)
    : typeIdOrDef || getBiomeObstacleType(obstacle?.type);
  if (!obstacle || !typeDef) return null;
  const x = obstacle.x || 0;
  const y = obstacle.y || 0;
  const w = obstacle.w || typeDef.size.w;
  const h = obstacle.h || typeDef.size.h;

  if (typeDef.collisionMode === "bottomHalf") {
    return { x, y: y + h * 0.5, w, h: h * 0.5 };
  }

  if (typeDef.collisionMode === "bottomScale") {
    const scale = Number.isFinite(typeDef.collisionScale) ? typeDef.collisionScale : 0.7;
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    return {
      x: x + (w - cw) * 0.5,
      y: y + h - ch,
      w: cw,
      h: ch
    };
  }

  return { x, y, w, h };
}
