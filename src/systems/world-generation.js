import { createSeededRandom, rectsOverlap } from "../core/runtime-utils.js";
import { createBiomeObstacle, getBiomeObstaclePlacementSize, getBiomeObstacleType } from "../data/biome-obstacles.js";
import { buildOpenWorldCosmeticFloor } from "./biome-floor.js";
import { buildUpperCliffForBiomeWorld } from "./biome-upper-cliff.js";

const TILE_SIZE = 32;
export const BIOME_GRID_COLS = 4;
export const BIOME_GRID_ROWS = 4;
export const BIOME_CELL_TILES_W = 30;
export const BIOME_CELL_TILES_H = 30;
const BREAK_ROOM_TILES_W = 30;
const BREAK_ROOM_TILES_H = 20;
const GRID_W = BIOME_GRID_COLS * BIOME_CELL_TILES_W;
const GRID_H = BIOME_GRID_ROWS * BIOME_CELL_TILES_H;

export const BIOME_ARCHETYPE = {
  START: "start",
  OPEN_SPACE: "openSpace",
  MINIBOSS: "miniboss",
  LOST_CAMPS: "lostCamps",
  RUINS: "ruins",
  VAULT: "vault",
  WOODS: "woods",
  EMPTY: "empty"
};

const BIOME_ARCHETYPE_POOL = [
  BIOME_ARCHETYPE.MINIBOSS,
  BIOME_ARCHETYPE.OPEN_SPACE,
  BIOME_ARCHETYPE.LOST_CAMPS,
  BIOME_ARCHETYPE.RUINS,
  BIOME_ARCHETYPE.VAULT,
  BIOME_ARCHETYPE.WOODS
];

export const COBBLE_VARIANTS = [
  { sx: 256, sy: 0 }, { sx: 288, sy: 0 }, { sx: 320, sy: 0 }, { sx: 352, sy: 0 }, { sx: 384, sy: 0 }, { sx: 416, sy: 0 },
  { sx: 256, sy: 32 }, { sx: 288, sy: 32 }, { sx: 320, sy: 32 }, { sx: 352, sy: 32 }, { sx: 384, sy: 32 }, { sx: 416, sy: 32 },
  { sx: 352, sy: 64 }, { sx: 384, sy: 64 }, { sx: 416, sy: 64 }
];

const BLOCKER_CHUNK_TILES = 30;
const BLOCKER_CHUNK_PX = BLOCKER_CHUNK_TILES * TILE_SIZE;
const BLOCKER_CHUNKS = Object.freeze([
  { id: "chunk_0", x: 0 * BLOCKER_CHUNK_PX, y: 0, width: BLOCKER_CHUNK_PX, height: BLOCKER_CHUNK_PX },
  { id: "chunk_1", x: 1 * BLOCKER_CHUNK_PX, y: 0, width: BLOCKER_CHUNK_PX, height: BLOCKER_CHUNK_PX },
  { id: "chunk_2", x: 2 * BLOCKER_CHUNK_PX, y: 0, width: BLOCKER_CHUNK_PX, height: BLOCKER_CHUNK_PX },
  { id: "chunk_3", x: 3 * BLOCKER_CHUNK_PX, y: 0, width: BLOCKER_CHUNK_PX, height: BLOCKER_CHUNK_PX },
  { id: "chunk_4", x: 4 * BLOCKER_CHUNK_PX, y: 0, width: BLOCKER_CHUNK_PX, height: BLOCKER_CHUNK_PX },
  { id: "chunk_5", x: 5 * BLOCKER_CHUNK_PX, y: 0, width: BLOCKER_CHUNK_PX, height: BLOCKER_CHUNK_PX },
  { id: "chunk_6", x: 6 * BLOCKER_CHUNK_PX, y: 0, width: BLOCKER_CHUNK_PX, height: BLOCKER_CHUNK_PX },
  { id: "chunk_7", x: 7 * BLOCKER_CHUNK_PX, y: 0, width: BLOCKER_CHUNK_PX, height: BLOCKER_CHUNK_PX },
  { id: "chunk_8", x: 8 * BLOCKER_CHUNK_PX, y: 0, width: BLOCKER_CHUNK_PX, height: BLOCKER_CHUNK_PX }
]);

const BLOCKER_CHUNK_GROUPS = Object.freeze([
  [0, 1, 2, 3],
  [4, 5],
  [6, 7, 8]
]);

const ANCIENT_TREE_ASSET_KEYS = Object.freeze([
  "treeBB01",
  "treeBB02",
  "treeBB03",
  "treeBB04",
  "treeBB05",
  "treeBB06",
  "treeBB07",
  "treeBB08"
]);

const BIOME_DECOR_TYPES = Object.freeze({
  ragWindA: Object.freeze({
    id: "ragWindA",
    assetKey: "biomeRagWindA",
    frameWidth: 32,
    frameHeight: 80,
    frameDuration: 0.12,
    scale: 0.5,
    baseFootprintWidth: 12,
    baseFootprintHeight: 10,
    ySortOffset: -2,
    spawnByArchetype: Object.freeze({
      [BIOME_ARCHETYPE.OPEN_SPACE]: Object.freeze({ min: 1, max: 2, margin: 96 }),
      [BIOME_ARCHETYPE.LOST_CAMPS]: Object.freeze({ min: 1, max: 2, margin: 104 }),
      [BIOME_ARCHETYPE.RUINS]: Object.freeze({ min: 1, max: 2, margin: 104 }),
      [BIOME_ARCHETYPE.WOODS]: Object.freeze({ min: 0, max: 1, margin: 112 })
    })
  })
});

const BIOME_OBSTACLE_SPAWN_CONFIG = Object.freeze({
  [BIOME_ARCHETYPE.OPEN_SPACE]: Object.freeze({
    min: 0,
    max: 1,
    margin: 120,
    pool: Object.freeze([
      Object.freeze({ typeId: "giantRock", weight: 1 })
    ])
  }),
  [BIOME_ARCHETYPE.MINIBOSS]: Object.freeze({
    min: 1,
    max: 2,
    margin: 132,
    pool: Object.freeze([
      Object.freeze({ typeId: "giantRock", weight: 3 }),
      Object.freeze({ typeId: "magicPillarMedium", weight: 1 })
    ])
  }),
  [BIOME_ARCHETYPE.LOST_CAMPS]: Object.freeze({
    min: 1,
    max: 2,
    margin: 112,
    pool: Object.freeze([
      Object.freeze({ typeId: "giantRock", weight: 4 }),
      Object.freeze({ typeId: "magicPillarSmall", weight: 1 })
    ])
  }),
  [BIOME_ARCHETYPE.RUINS]: Object.freeze({
    min: 1,
    max: 2,
    margin: 96,
    pool: Object.freeze([
      Object.freeze({ typeId: "magicPillarSmall", weight: 4 }),
      Object.freeze({ typeId: "magicPillarMedium", weight: 3 }),
      Object.freeze({ typeId: "magicPillarLarge", weight: 1 }),
      Object.freeze({ typeId: "giantRock", weight: 1 })
    ])
  }),
  [BIOME_ARCHETYPE.VAULT]: Object.freeze({
    min: 2,
    max: 3,
    margin: 120,
    pool: Object.freeze([
      Object.freeze({ typeId: "magicPillarSmall", weight: 2 }),
      Object.freeze({ typeId: "magicPillarMedium", weight: 3 }),
      Object.freeze({ typeId: "magicPillarLarge", weight: 2 })
    ])
  }),
  [BIOME_ARCHETYPE.WOODS]: Object.freeze({
    min: 1,
    max: 2,
    margin: 104,
    pool: Object.freeze([
      Object.freeze({ typeId: "giantRock", weight: 1 })
    ])
  })
});

function fillRect(grid, x, y, w, h, value) {
  for (let gy = y; gy < y + h; gy += 1) {
    for (let gx = x; gx < x + w; gx += 1) {
      if (gy < 0 || gx < 0 || gy >= grid.length || gx >= grid[0].length) continue;
      grid[gy][gx] = value;
    }
  }
}

function seededHash(a, b, seed) {
  let hash = (((seed || 0) ^ 0x9e37) + a * 31 + b) >>> 0;
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return hash >>> 0;
}

function chooseBlockerChunkInGroup(groupChunkIndices, cellX, cellY, mapSeed) {
  const hash = seededHash(cellX, cellY, mapSeed);
  const index = groupChunkIndices[hash % groupChunkIndices.length];
  return BLOCKER_CHUNKS[index];
}

function findBlockerCellComponents(cells) {
  const set = new Set(cells.map((cell) => `${cell.col},${cell.row}`));
  const visited = new Set();
  const components = [];
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  for (const cell of cells) {
    const key = `${cell.col},${cell.row}`;
    if (visited.has(key)) continue;
    const stack = [cell];
    const component = [];
    visited.add(key);
    while (stack.length > 0) {
      const current = stack.pop();
      component.push(current);
      for (const [dc, dr] of dirs) {
        const ncol = current.col + dc;
        const nrow = current.row + dr;
        const nkey = `${ncol},${nrow}`;
        if (!set.has(nkey) || visited.has(nkey)) continue;
        visited.add(nkey);
        stack.push({ col: ncol, row: nrow });
      }
    }
    components.push(component);
  }
  return components;
}

export function getBiomeCellBounds(world, col, row) {
  return {
    x: (world.width / BIOME_GRID_COLS) * col,
    y: (world.height / BIOME_GRID_ROWS) * row,
    w: world.width / BIOME_GRID_COLS,
    h: world.height / BIOME_GRID_ROWS
  };
}

function getBiomeCellTileBounds(col, row) {
  return {
    x: BIOME_CELL_TILES_W * col,
    y: BIOME_CELL_TILES_H * row,
    w: BIOME_CELL_TILES_W,
    h: BIOME_CELL_TILES_H
  };
}

function buildArchetypeGrid(random) {
  const startCell = { col: 0, row: random() < 0.5 ? 1 : 2 };
  const exitCell = { col: 3, row: random() < 0.5 ? 1 : 2 };
  const topActiveCols = [Math.floor(random() * BIOME_GRID_COLS)];
  const bottomActiveCols = [0, 1, 2, 3].sort(() => random() - 0.5).slice(0, random() < 0.5 ? 1 : 2);
  const middleCandidates = [];
  for (let row = 1; row <= 2; row += 1) {
    for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
      if (col === startCell.col && row === startCell.row) continue;
      if (col === exitCell.col && row === exitCell.row) continue;
      middleCandidates.push({ col, row });
    }
  }
  const minibossCandidates = [1, 2, 3]
    .map((row) => ({ col: BIOME_GRID_COLS - 1, row }))
    .filter((candidate) => !(candidate.col === exitCell.col && candidate.row === exitCell.row));
  const minibossPick = minibossCandidates[Math.floor(random() * minibossCandidates.length)];
  const vaultCandidates = middleCandidates.filter((candidate) => !(candidate.col === minibossPick.col && candidate.row === minibossPick.row));
  const vaultPick = vaultCandidates[Math.floor(random() * vaultCandidates.length)];
  const generalPool = BIOME_ARCHETYPE_POOL.filter((id) => id !== BIOME_ARCHETYPE.MINIBOSS && id !== BIOME_ARCHETYPE.VAULT);

  const grid = [];
  for (let row = 0; row < BIOME_GRID_ROWS; row += 1) {
    const nextRow = [];
    for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
      if (col === startCell.col && row === startCell.row) nextRow.push(BIOME_ARCHETYPE.START);
      else if (col === exitCell.col && row === exitCell.row) nextRow.push(BIOME_ARCHETYPE.OPEN_SPACE);
      else if (minibossPick && col === minibossPick.col && row === minibossPick.row) nextRow.push(BIOME_ARCHETYPE.MINIBOSS);
      else if (vaultPick && col === vaultPick.col && row === vaultPick.row) nextRow.push(BIOME_ARCHETYPE.VAULT);
      else if (row === 0) nextRow.push(topActiveCols.includes(col) ? BIOME_ARCHETYPE.OPEN_SPACE : BIOME_ARCHETYPE.EMPTY);
      else if (row === 3) nextRow.push(bottomActiveCols.includes(col) ? BIOME_ARCHETYPE.OPEN_SPACE : BIOME_ARCHETYPE.EMPTY);
      else nextRow.push(generalPool[Math.floor(random() * generalPool.length)]);
    }
    grid.push(nextRow);
  }
  return { grid, startCell, exitCell, minibossCell: minibossPick };
}

function stampArchetypeLayout(grid, archetype, bounds, random) {
  const margin = 2;
  const inner = {
    x: bounds.x + margin,
    y: bounds.y + margin,
    w: Math.max(4, bounds.w - margin * 2),
    h: Math.max(4, bounds.h - margin * 2)
  };
  if (archetype === BIOME_ARCHETYPE.START || archetype === BIOME_ARCHETYPE.OPEN_SPACE || archetype === BIOME_ARCHETYPE.MINIBOSS) return;

  if (archetype === BIOME_ARCHETYPE.RUINS) {
    for (const pillar of [
      [inner.x + 3, inner.y + 2], [inner.x + inner.w - 5, inner.y + 2],
      [inner.x + 3, inner.y + inner.h - 4], [inner.x + inner.w - 5, inner.y + inner.h - 4]
    ]) fillRect(grid, pillar[0], pillar[1], 2, 2, 1);
    return;
  }

  if (archetype === BIOME_ARCHETYPE.WOODS) {
    for (let index = 0; index < 6; index += 1) {
      fillRect(grid, inner.x + 1 + Math.floor(random() * Math.max(2, inner.w - 4)), inner.y + 1 + Math.floor(random() * Math.max(2, inner.h - 4)), 2, 2, 1);
    }
    return;
  }

  if (archetype === BIOME_ARCHETYPE.VAULT) {
    fillRect(grid, inner.x + Math.floor(inner.w * 0.35), inner.y + Math.floor(inner.h * 0.35), 5, 4, 1);
    fillRect(grid, inner.x + 2, inner.y + 2, 2, 2, 1);
    fillRect(grid, inner.x + inner.w - 4, inner.y + inner.h - 4, 2, 2, 1);
    return;
  }

  if (archetype === BIOME_ARCHETYPE.LOST_CAMPS) {
    fillRect(grid, inner.x + Math.floor(inner.w * 0.4), inner.y + 2, 3, 2, 1);
    fillRect(grid, inner.x + Math.floor(inner.w * 0.4), inner.y + inner.h - 4, 3, 2, 1);
    fillRect(grid, inner.x + 2, inner.y + Math.floor(inner.h * 0.45), 2, 3, 1);
    fillRect(grid, inner.x + inner.w - 4, inner.y + Math.floor(inner.h * 0.45), 2, 3, 1);
  }
}

function buildCobblestonePath(world, random) {
  const toCenterTile = (cell) => ({
    x: Math.floor(cell.col * BIOME_CELL_TILES_W + BIOME_CELL_TILES_W * 0.5),
    y: Math.floor(cell.row * BIOME_CELL_TILES_H + BIOME_CELL_TILES_H * 0.5)
  });
  const start = toCenterTile(world.archetypeGrid.startCell);
  const exit = toCenterTile(world.archetypeGrid.exitCell);
  const tiles = new Map();
  const add = (gx, gy) => {
    if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) return;
    if (world.grid[gy][gx] === 1 || world.grid[gy][gx] === 2) return;
    tiles.set(`${gx},${gy}`, Math.floor(random() * COBBLE_VARIANTS.length));
  };
  const steps = Math.max(Math.abs(exit.x - start.x), Math.abs(exit.y - start.y));
  for (let step = 0; step <= steps; step += 1) {
    const t = steps === 0 ? 0 : step / steps;
    const gx = Math.round(start.x + (exit.x - start.x) * t);
    const gy = Math.round(start.y + (exit.y - start.y) * t);
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        add(gx + ox, gy + oy);
        fillRect(world.grid, gx + ox, gy + oy, 1, 1, 0);
      }
    }
  }
  world.cobblestonePathTiles = tiles;
  world.cobblestonePathVariants = COBBLE_VARIANTS;
}

function rebuildTileWallRects(world) {
  world.tileWallRects = [];
  for (let gy = 0; gy < world.rows; gy += 1) {
    for (let gx = 0; gx < world.cols; gx += 1) {
      if (world.grid[gy][gx] !== 1) continue;
      world.tileWallRects.push({ x: gx * world.tileSize, y: gy * world.tileSize, w: world.tileSize, h: world.tileSize });
    }
  }
}

function collectSpawnTiles(world) {
  const tiles = [];
  for (let gy = 1; gy < world.rows - 1; gy += 1) {
    for (let gx = 1; gx < world.cols - 1; gx += 1) {
      if (world.grid[gy][gx] !== 0) continue;
      const macroCol = Math.floor(gx / BIOME_CELL_TILES_W);
      const macroRow = Math.floor(gy / BIOME_CELL_TILES_H);
      // Row 0 uses upper-cliff/island presentation and should not contribute
      // full-cell enemy spawn positions.
      if (macroRow === 0) continue;
      if (world.archetypeGrid.grid[macroRow][macroCol] === BIOME_ARCHETYPE.EMPTY) continue;
      tiles.push({ x: gx, y: gy });
    }
  }
  return tiles;
}

function buildPlayableMacroRects(world) {
  world.playableMacroRects = [];
  world.voidRects = [];
  for (let row = 0; row < BIOME_GRID_ROWS; row += 1) {
    for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
      const bounds = getBiomeCellBounds(world, col, row);
      if (world.archetypeGrid.grid[row][col] === BIOME_ARCHETYPE.EMPTY) world.voidRects.push(bounds);
      else world.playableMacroRects.push(bounds);
    }
  }
}

function buildInvisibleBarrierRects(world) {
  const rects = [];
  for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
    if (world.archetypeGrid.grid[0][col] !== BIOME_ARCHETYPE.EMPTY) continue;
    rects.push({ ...getBiomeCellBounds(world, col, 0), invisible: true });
  }
  return rects;
}

function rectOverlapsAny(rect, rects) {
  return rects.some((other) => rectsOverlap(rect, other));
}

function chooseWeightedEntry(entries, random) {
  if (!Array.isArray(entries) || !entries.length) return null;
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry?.weight) || 0), 0);
  if (!(totalWeight > 0)) return entries[Math.floor(random() * entries.length)] || null;
  let cursor = random() * totalWeight;
  for (const entry of entries) {
    cursor -= Math.max(0, Number(entry?.weight) || 0);
    if (cursor <= 0) return entry;
  }
  return entries[entries.length - 1] || null;
}

function createAncientTreeObstacle(x, y, assetKey, assets) {
  const image = assets?.[assetKey];
  if (!image?.naturalWidth || !image?.naturalHeight) return null;
  const w = Math.max(1, Math.round(image.naturalWidth * 0.5));
  const h = Math.max(1, Math.round(image.naturalHeight * 0.5));
  const collisionW = Math.max(1, Math.round(w * 0.3));
  const collisionH = Math.max(1, Math.round(h * 0.1));
  const collisionLift = 32;
  const collisionY = Math.max(y, y + h - collisionH - collisionLift);
  return {
    type: "ancientTree",
    assetKey,
    x,
    y,
    w,
    h,
    blocksMovement: true,
    blocksProjectiles: true,
    collisionRect: {
      x: x + (w - collisionW) * 0.5,
      y: collisionY,
      w: collisionW,
      h: collisionH
    },
    canopyFadeRadius: 130,
    canopyFadeMinAlpha: 0.4,
    canopyFadeMaxAlpha: 1,
    ySortHeightRatio: 1.2,
    shadowHeight: 12
  };
}

function createBiomeDecoration(typeId, x, y, assets) {
  const typeDef = BIOME_DECOR_TYPES[typeId];
  if (!typeDef) return null;
  const image = assets?.[typeDef.assetKey];
  const imageW = image?.naturalWidth || image?.width || 0;
  const imageH = image?.naturalHeight || image?.height || 0;
  if (!imageW || !imageH) return null;
  const frameCount = Math.max(1, Math.floor(imageW / typeDef.frameWidth));
  const drawW = Math.max(1, Math.round(typeDef.frameWidth * (typeDef.scale || 1)));
  const drawH = Math.max(1, Math.round(typeDef.frameHeight * (typeDef.scale || 1)));
  const baseW = Math.max(1, Math.round(typeDef.baseFootprintWidth || drawW));
  const baseH = Math.max(1, Math.round(typeDef.baseFootprintHeight || Math.min(12, drawH)));
  const baseX = x + Math.round((drawW - baseW) * 0.5);
  const baseY = y + drawH - baseH;
  return {
    kind: "animatedSprite",
    type: typeDef.id,
    assetKey: typeDef.assetKey,
    x,
    y,
    w: drawW,
    h: drawH,
    frameWidth: typeDef.frameWidth,
    frameHeight: typeDef.frameHeight,
    frameCount,
    frameDuration: typeDef.frameDuration,
    sortY: baseY + baseH + (typeDef.ySortOffset || 0),
    placementRect: { x, y, w: drawW, h: drawH },
    baseRect: { x: baseX, y: baseY, w: baseW, h: baseH }
  };
}

function spawnBiomeObstacles(world, random, assets) {
  const obstacles = [];
  const occupiedRects = [world.start, world.exit];
  for (const wall of world.tileWallRects || []) occupiedRects.push(wall);
  for (const wall of world.invisibleBarrierRects || []) occupiedRects.push(wall);

  for (let row = 0; row < BIOME_GRID_ROWS; row += 1) {
    for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
      const archetype = world.archetypeGrid.grid[row][col];
      const config = BIOME_OBSTACLE_SPAWN_CONFIG[archetype];
      if (!config) continue;
      const count = config.min + Math.floor(random() * (config.max - config.min + 1));
      if (count <= 0) continue;
      const bounds = getBiomeCellBounds(world, col, row);
      const margin = config.margin ?? 96;
      const inner = {
        x: bounds.x + margin,
        y: bounds.y + margin,
        w: Math.max(0, bounds.w - margin * 2),
        h: Math.max(0, bounds.h - margin * 2)
      };

      for (let index = 0; index < count; index += 1) {
        for (let attempt = 0; attempt < 64; attempt += 1) {
          const pick = chooseWeightedEntry(config.pool, random);
          const typeDef = getBiomeObstacleType(pick?.typeId);
          if (!typeDef) break;
          const placeSize = getBiomeObstaclePlacementSize(typeDef);
          if (inner.w < placeSize.w || inner.h < placeSize.h) break;
          const x = Math.round(inner.x + random() * Math.max(0, inner.w - placeSize.w));
          const y = Math.round(inner.y + random() * Math.max(0, inner.h - placeSize.h));
          const obstacle = createBiomeObstacle(typeDef.id, x, y, assets, random);
          if (!obstacle?.collisionRect || !obstacle?.placementRect) continue;
          if (rectOverlapsAny(obstacle.placementRect, occupiedRects)) continue;
          if (rectOverlapsAny(obstacle.collisionRect, occupiedRects)) continue;
          obstacles.push(obstacle);
          occupiedRects.push(obstacle.placementRect);
          occupiedRects.push(obstacle.collisionRect);
          break;
        }
      }
    }
  }

  return obstacles;
}

function spawnBiomeTreeObstacles(world, random, assets) {
  const trees = [];
  const occupiedRects = [world.start, world.exit];
  for (const wall of world.tileWallRects || []) occupiedRects.push(wall);
  for (const wall of world.invisibleBarrierRects || []) occupiedRects.push(wall);
  for (const obstacle of world.biomeObstacles || []) {
    if (obstacle.placementRect) occupiedRects.push(obstacle.placementRect);
    if (obstacle.collisionRect) occupiedRects.push(obstacle.collisionRect);
  }

  for (let row = 0; row < BIOME_GRID_ROWS; row += 1) {
    for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
      const archetype = world.archetypeGrid.grid[row][col];
      if (archetype !== BIOME_ARCHETYPE.WOODS && archetype !== BIOME_ARCHETYPE.OPEN_SPACE) continue;
      const targetCount = archetype === BIOME_ARCHETYPE.WOODS
        ? 23 + Math.floor(random() * 8)
        : 1 + Math.floor(random() * 2);
      const bounds = getBiomeCellBounds(world, col, row);
      const margin = 104;
      const inner = {
        x: bounds.x + margin,
        y: bounds.y + margin,
        w: Math.max(0, bounds.w - margin * 2),
        h: Math.max(0, bounds.h - margin * 2)
      };
      for (let index = 0; index < targetCount; index += 1) {
        for (let attempt = 0; attempt < (archetype === BIOME_ARCHETYPE.WOODS ? 80 : 32); attempt += 1) {
          const assetKey = ANCIENT_TREE_ASSET_KEYS[Math.floor(random() * ANCIENT_TREE_ASSET_KEYS.length)];
          const image = assets?.[assetKey];
          if (!image?.naturalWidth || !image?.naturalHeight) break;
          const w = Math.max(1, Math.round(image.naturalWidth * 0.5));
          const h = Math.max(1, Math.round(image.naturalHeight * 0.5));
          if (inner.w < w || inner.h < h) break;
          const x = Math.round(inner.x + random() * Math.max(0, inner.w - w));
          const y = Math.round(inner.y + random() * Math.max(0, inner.h - h));
          const placementRect = { x, y, w, h };
          const tree = createAncientTreeObstacle(x, y, assetKey, assets);
          if (!tree) continue;
          if (rectOverlapsAny(placementRect, occupiedRects)) continue;
          if (rectOverlapsAny(tree.collisionRect, occupiedRects)) continue;
          trees.push(tree);
          occupiedRects.push(placementRect);
          occupiedRects.push(tree.collisionRect);
          break;
        }
      }
    }
  }

  return trees;
}

function spawnBiomeDecorations(world, random, assets) {
  const decorations = [];
  const occupiedRects = [world.start, world.exit];
  for (const wall of world.tileWallRects || []) occupiedRects.push(wall);
  for (const wall of world.invisibleBarrierRects || []) occupiedRects.push(wall);
  for (const obstacle of world.biomeObstacles || []) {
    if (obstacle.placementRect) occupiedRects.push(obstacle.placementRect);
    if (obstacle.collisionRect) occupiedRects.push(obstacle.collisionRect);
  }
  for (const tree of world.treeObstacles || []) {
    if (tree.collisionRect) occupiedRects.push(tree.collisionRect);
  }

  for (const typeDef of Object.values(BIOME_DECOR_TYPES)) {
    for (let row = 0; row < BIOME_GRID_ROWS; row += 1) {
      for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
        const archetype = world.archetypeGrid.grid[row][col];
        const spawnConfig = typeDef.spawnByArchetype?.[archetype];
        if (!spawnConfig) continue;
        const count = spawnConfig.min + Math.floor(random() * (spawnConfig.max - spawnConfig.min + 1));
        if (count <= 0) continue;
        const bounds = getBiomeCellBounds(world, col, row);
        const margin = spawnConfig.margin ?? 96;
        const decorProbe = createBiomeDecoration(typeDef.id, 0, 0, assets);
        if (!decorProbe) continue;
        const inner = {
          x: bounds.x + margin,
          y: bounds.y + margin,
          w: Math.max(0, bounds.w - margin * 2),
          h: Math.max(0, bounds.h - margin * 2)
        };
        if (inner.w < decorProbe.w || inner.h < decorProbe.h) continue;

        for (let index = 0; index < count; index += 1) {
          for (let attempt = 0; attempt < 48; attempt += 1) {
            const x = Math.round(inner.x + random() * Math.max(0, inner.w - decorProbe.w));
            const y = Math.round(inner.y + random() * Math.max(0, inner.h - decorProbe.h));
            const decor = createBiomeDecoration(typeDef.id, x, y, assets);
            if (!decor?.placementRect || !decor?.baseRect) continue;
            if (rectOverlapsAny(decor.baseRect, occupiedRects)) continue;
            decorations.push(decor);
            occupiedRects.push(decor.baseRect);
            break;
          }
        }
      }
    }
  }

  return decorations;
}

function applyBiomeTopBottomWalls(world, mapSeed) {
  const blockerCells = [];
  const bottomRow = BIOME_GRID_ROWS - 1;
  for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
    if (world.archetypeGrid.grid[bottomRow][col] !== BIOME_ARCHETYPE.EMPTY) continue;
    blockerCells.push({ col, row: bottomRow });
  }

  const components = findBlockerCellComponents(blockerCells);
  const cellToGroup = new Map();
  components.forEach((component, index) => {
    const groupIndex = seededHash(index, component.length, (mapSeed || 0) ^ 0xb3a7) % BLOCKER_CHUNK_GROUPS.length;
    const group = BLOCKER_CHUNK_GROUPS[groupIndex];
    for (const cell of component) {
      cellToGroup.set(`${cell.col},${cell.row}`, group);
    }
  });

  world.blockerChunkSpaces = [];
  world.blockerChunkTileSet = new Set();
  for (const { col, row } of blockerCells) {
    const tileBounds = getBiomeCellTileBounds(col, row);
    fillRect(world.grid, tileBounds.x, tileBounds.y, tileBounds.w, tileBounds.h, 1);
    const group = cellToGroup.get(`${col},${row}`) || BLOCKER_CHUNK_GROUPS[0];
    const chunk = chooseBlockerChunkInGroup(group, col, row, mapSeed);
    world.blockerChunkSpaces.push({
      col,
      row,
      originGx: tileBounds.x,
      originGy: tileBounds.y,
      worldX: tileBounds.x * TILE_SIZE,
      worldY: tileBounds.y * TILE_SIZE,
      chunk
    });
    for (let gy = 0; gy < tileBounds.h; gy += 1) {
      for (let gx = 0; gx < tileBounds.w; gx += 1) {
        world.blockerChunkTileSet.add(`${tileBounds.x + gx},${tileBounds.y + gy}`);
      }
    }
  }
}

export function rebuildWorldCollisionRects(world, extraRects = []) {
  if (!world) return [];
  const staticCollisionRectsNoTrees = [
    ...(world.tileWallRects || []),
    ...(world.invisibleBarrierRects || []),
    ...(world.biomeObstacleCollisionRects || [])
  ];
  const staticCollisionRects = [
    ...staticCollisionRectsNoTrees,
    ...(world.treeCollisionRects || [])
  ];
  const dynamicCollisionRects = [...(extraRects || [])];
  world.staticCollisionRectsNoTrees = staticCollisionRectsNoTrees;
  world.staticCollisionRects = staticCollisionRects;
  world.dynamicCollisionRects = dynamicCollisionRects;
  world.collisionRectsNoTrees = [...staticCollisionRectsNoTrees, ...dynamicCollisionRects];
  world.collisionRects = [...staticCollisionRects, ...dynamicCollisionRects];
  world.collisionVersion = (world.collisionVersion || 0) + 1;
  return world.collisionRects;
}

function rebuildSortedRenderLists(world) {
  world.sortedBiomeObstacles = [...(world.biomeObstacles || [])].sort(
    (a, b) => (a.sortY || (a.y + a.h)) - (b.sortY || (b.y + b.h))
  );
  world.sortedTreeObstacles = [...(world.treeObstacles || [])].sort(
    (a, b) => (a.y + a.h * a.ySortHeightRatio) - (b.y + b.h * b.ySortHeightRatio)
  );
  world.sortedDecor = [...(world.decor || [])].sort(
    (a, b) => (a.sortY || (a.y + a.h)) - (b.sortY || (b.y + b.h))
  );
}

export function generateRoom(seed, roomIndex, assets) {
  const roomSeed = seed + roomIndex * 997;
  const random = createSeededRandom(roomSeed);
  const world = {
    seed: roomSeed,
    tileSize: TILE_SIZE,
    cols: GRID_W,
    rows: GRID_H,
    width: GRID_W * TILE_SIZE,
    height: GRID_H * TILE_SIZE,
    grid: Array.from({ length: GRID_H }, () => Array.from({ length: GRID_W }, () => 0)),
    assetRefs: assets
  };
  world.tileGrid = world.grid;

  world.archetypeGrid = buildArchetypeGrid(random);
  buildPlayableMacroRects(world);
  world.blockerChunkSpaces = [];
  world.blockerChunkTileSet = new Set();

  for (let row = 0; row < BIOME_GRID_ROWS; row += 1) {
    for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
      const archetype = world.archetypeGrid.grid[row][col];
      const tileBounds = getBiomeCellTileBounds(col, row);
      if (archetype === BIOME_ARCHETYPE.EMPTY) {
        fillRect(world.grid, tileBounds.x, tileBounds.y, tileBounds.w, tileBounds.h, row === 0 ? 2 : 0);
        continue;
      }
      stampArchetypeLayout(world.grid, archetype, tileBounds, random);
    }
  }

  buildCobblestonePath(world, random);
  rebuildTileWallRects(world);
  applyBiomeTopBottomWalls(world, roomSeed);
  rebuildTileWallRects(world);
  buildUpperCliffForBiomeWorld(world, roomSeed, { useSprites: true });
  world.invisibleBarrierRects = buildInvisibleBarrierRects(world);
  const startBounds = getBiomeCellBounds(world, world.archetypeGrid.startCell.col, world.archetypeGrid.startCell.row);
  const exitBounds = getBiomeCellBounds(world, world.archetypeGrid.exitCell.col, world.archetypeGrid.exitCell.row);
  world.start = { x: startBounds.x + 96, y: startBounds.y + startBounds.h * 0.5, w: 32, h: 32 };
  world.exit = { x: exitBounds.x + exitBounds.w - 128, y: exitBounds.y + exitBounds.h * 0.5 - 16, w: TILE_SIZE, h: TILE_SIZE };
  world.biomeObstacles = spawnBiomeObstacles(world, random, assets);
  world.biomeObstaclePlacementRects = world.biomeObstacles.map((obstacle) => obstacle.placementRect).filter(Boolean);
  world.biomeObstacleCollisionRects = world.biomeObstacles.map((obstacle) => obstacle.collisionRect).filter(Boolean);
  world.treeObstacles = spawnBiomeTreeObstacles(world, random, assets);
  world.decor = spawnBiomeDecorations(world, random, assets);
  world.treeCollisionRects = world.treeObstacles.map((tree) => tree.collisionRect);
  rebuildWorldCollisionRects(world);
  rebuildSortedRenderLists(world);
  world.spawnTiles = collectSpawnTiles(world);
  world.biomeCellBounds = (col, row) => getBiomeCellBounds(world, col, row);
  world.cobblestonePathAtlas = assets?.biomeCobble || null;
  world.blockerChunkAtlas = assets?.biomeBlockerChunks || null;
  world.cosmeticFloor = buildOpenWorldCosmeticFloor(world, roomSeed, assets, "grassA");
  return world;
}

export function generateBreakRoom(seed, roomIndex, assets) {
  const roomSeed = seed + roomIndex * 997 + 0x5f3759df;
  const cols = BREAK_ROOM_TILES_W;
  const rows = BREAK_ROOM_TILES_H;
  const world = {
    seed: roomSeed,
    type: "breakRoom",
    tileSize: TILE_SIZE,
    cols,
    rows,
    width: cols * TILE_SIZE,
    height: rows * TILE_SIZE,
    grid: Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0)),
    assetRefs: assets
  };
  world.tileGrid = world.grid;

  for (let x = 0; x < cols; x += 1) {
    world.grid[0][x] = 1;
    world.grid[rows - 1][x] = 1;
  }
  for (let y = 0; y < rows; y += 1) {
    world.grid[y][0] = 1;
    world.grid[y][cols - 1] = 1;
  }

  world.archetypeGrid = {
    grid: [[BIOME_ARCHETYPE.OPEN_SPACE]],
    startCell: { col: 0, row: 0 },
    exitCell: { col: 0, row: 0 },
    minibossCell: null
  };
  world.playableMacroRects = [{ x: 0, y: 0, w: world.width, h: world.height }];
  world.voidRects = [];
  world.blockerChunkSpaces = [];
  world.blockerChunkTileSet = new Set();
  world.upperCliff = { enabled: false };
  world.invisibleBarrierRects = [];
  world.start = {
    x: TILE_SIZE * 2,
    y: Math.round(world.height * 0.5 - TILE_SIZE * 0.5),
    w: 32,
    h: 32
  };
  world.exit = {
    x: world.width - TILE_SIZE * 3,
    y: Math.round(world.height * 0.5 - TILE_SIZE * 0.5),
    w: TILE_SIZE,
    h: TILE_SIZE
  };
  rebuildTileWallRects(world);
  world.biomeObstacles = [];
  world.biomeObstaclePlacementRects = [];
  world.biomeObstacleCollisionRects = [];
  world.treeObstacles = [];
  world.treeCollisionRects = [];
  world.decor = [];
  rebuildWorldCollisionRects(world);
  rebuildSortedRenderLists(world);
  world.spawnTiles = [];
  world.biomeCellBounds = () => ({ x: 0, y: 0, w: world.width, h: world.height });
  world.cobblestonePathTiles = new Map();
  world.cobblestonePathVariants = COBBLE_VARIANTS;
  world.cobblestonePathAtlas = assets?.biomeCobble || null;
  world.blockerChunkAtlas = assets?.biomeBlockerChunks || null;
  world.cosmeticFloor = null;
  return world;
}
