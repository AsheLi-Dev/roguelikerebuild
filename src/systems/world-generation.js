import { createSeededRandom, rectsOverlap } from "../core/runtime-utils.js";
import { createBiomeObstacle, getBiomeObstaclePlacementSize, getBiomeObstacleType } from "../data/biome-obstacles.js";
import { ROOM0_PREFABS } from "../data/prefab-room0.js";
import { FOREST_VARIANTS, getForestVariantConfig } from "../data/forest-biome-variants.js";
import {
  buildOpenWorldCosmeticFloor,
  buildOpenWorldCosmeticFloorFromPrefab,
  serializeOpenWorldCosmeticFloor
} from "./biome-floor.js";
import { buildUpperCliffForBiomeWorld } from "./biome-upper-cliff.js";

const TILE_SIZE = 32;
export const BIOME_GRID_COLS = 5;
export const BIOME_GRID_ROWS = 5;
export const BIOME_INFLUENCE_COLS = 7;
export const BIOME_INFLUENCE_ROWS = 4;
export const BIOME_CELL_TILES_W = 30;
export const BIOME_CELL_TILES_H = 30;
const BREAK_ROOM_TILES_W = 30;
const BREAK_ROOM_TILES_H = 20;
const GRID_W = BIOME_GRID_COLS * BIOME_CELL_TILES_W;
const GRID_H = BIOME_GRID_ROWS * BIOME_CELL_TILES_H;
const USE_PREFAB_ROOM0 = true;
const ROOM0_PREFAB_EXPORT_SEEDS = Object.freeze([
  0x1a2b3c4d,
  0x5e6f7788,
  0x90abc123
]);

// ─── Generation performance debug ────────────────────────────────────────────
// Set to true to print a per-stage timing breakdown to the console after each
// generateRoom() call.  Flip to false (or remove) before shipping.
const GEN_PERF_DEBUG = false;
// Module-level slot — holds an attempt-counter object during a generateRoom()
// call so spawn helpers can increment counters without changing their signatures.
// Always null when GEN_PERF_DEBUG is false.
let _genPerfStats = null;
// ─────────────────────────────────────────────────────────────────────────────

export const BIOME_ARCHETYPE = {
  START: "start",
  OPEN_SPACE: "openSpace",
  MINIBOSS: "miniboss",
  RUINS: "ruins",
  VAULT: "vault",
  WOODS: "woods",
  DEEP_WOODS: "deepWoods",
  EMPTY: "empty"
};

const BIOME_ARCHETYPE_POOL = [
  BIOME_ARCHETYPE.MINIBOSS,
  BIOME_ARCHETYPE.OPEN_SPACE,
  BIOME_ARCHETYPE.RUINS,
  BIOME_ARCHETYPE.WOODS
];

const INFLUENCE_FALLOFF = 2.4;
const INFLUENCE_BLEED_ROWS = 0.24;
const INFLUENCE_HORIZONTAL_OVERLAP = 1.22;
const INFLUENCE_VERTICAL_OVERLAP = 1.28;
const INFLUENCE_CENTER_JITTER = 0.18;

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
const BIOME_ROOM_THEME_BY_INDEX = Object.freeze({
  0: FOREST_VARIANTS.WOODS,
  1: FOREST_VARIANTS.SWAMP,
  2: FOREST_VARIANTS.MAGIC_FOREST,
  3: FOREST_VARIANTS.DEAD_FOREST,
  4: FOREST_VARIANTS.MAGIC_FOREST
});

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
      [BIOME_ARCHETYPE.RUINS]: Object.freeze({ min: 1, max: 2, margin: 104 }),
      [BIOME_ARCHETYPE.WOODS]: Object.freeze({ min: 0, max: 1, margin: 112 }),
      [BIOME_ARCHETYPE.DEEP_WOODS]: Object.freeze({ min: 0, max: 1, margin: 112 })
    })
  })
});

function isBreakableOnlyDecoration(value) {
  return /crystal/i.test(String(value || ""));
}

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
  [BIOME_ARCHETYPE.WOODS]: Object.freeze({
    min: 1,
    max: 2,
    margin: 104,
    pool: Object.freeze([
      Object.freeze({ typeId: "giantRock", weight: 1 })
    ])
  }),
  [BIOME_ARCHETYPE.DEEP_WOODS]: Object.freeze({
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

function assetKeyFromSpriteSource(src) {
  const fileName = String(src).split("/").pop() || String(src);
  return fileName.replace(/\.[^.]+$/, "");
}

function getRoomForestVariant(roomIndex) {
  return getForestVariantConfig(BIOME_ROOM_THEME_BY_INDEX[roomIndex] || FOREST_VARIANTS.WOODS);
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
  const middlePlayableRows = [1, 2, 3];
  const startCell = { col: 0, row: middlePlayableRows[Math.floor(random() * middlePlayableRows.length)] };
  const exitCell = { col: BIOME_GRID_COLS - 1, row: middlePlayableRows[Math.floor(random() * middlePlayableRows.length)] };
  const topActiveCols = [Math.floor(random() * BIOME_GRID_COLS)];
  const bottomActiveCols = Array.from({ length: BIOME_GRID_COLS }, (_, col) => col)
    .sort(() => random() - 0.5)
    .slice(0, random() < 0.5 ? 1 : 2);
  const middleCandidates = [];
  for (let row = 1; row <= BIOME_GRID_ROWS - 2; row += 1) {
    for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
      if (col === startCell.col && row === startCell.row) continue;
      if (col === exitCell.col && row === exitCell.row) continue;
      middleCandidates.push({ col, row });
    }
  }
  const minibossCandidates = Array.from({ length: BIOME_GRID_ROWS - 1 }, (_, index) => index + 1)
    .map((row) => ({ col: BIOME_GRID_COLS - 1, row }))
    .filter((candidate) => !(candidate.col === exitCell.col && candidate.row === exitCell.row));
  const minibossPick = minibossCandidates[Math.floor(random() * minibossCandidates.length)];

  const COLUMN_ARCHETYPE_WEIGHTS = {
    0: { openSpace: 6, ruins: 2, woods: 2 },
    1: { openSpace: 2, ruins: 4, woods: 4 },
    2: { openSpace: 3, ruins: 4, woods: 3 },
    3: { openSpace: 5, ruins: 1, woods: 4 },
    4: { openSpace: 4, ruins: 2, woods: 4 },
  };

  const grid = [];
  for (let row = 0; row < BIOME_GRID_ROWS; row += 1) {
    const nextRow = [];
    for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
      if (col === startCell.col && row === startCell.row) nextRow.push(BIOME_ARCHETYPE.START);
      else if (col === exitCell.col && row === exitCell.row) nextRow.push(BIOME_ARCHETYPE.OPEN_SPACE);
      else if (minibossPick && col === minibossPick.col && row === minibossPick.row) nextRow.push(BIOME_ARCHETYPE.MINIBOSS);
      else if (row === 0) nextRow.push(topActiveCols.includes(col) ? BIOME_ARCHETYPE.OPEN_SPACE : BIOME_ARCHETYPE.EMPTY);
      else if (row === BIOME_GRID_ROWS - 1) {
        nextRow.push(
          bottomActiveCols.includes(col)
            ? BIOME_ARCHETYPE.DEEP_WOODS
            : BIOME_ARCHETYPE.EMPTY
        );
      }
      else {
        const weights = COLUMN_ARCHETYPE_WEIGHTS[col] ?? COLUMN_ARCHETYPE_WEIGHTS[0];
        const entries = Object.entries(weights);
        const total = entries.reduce((s, [, w]) => s + w, 0);
        let roll = random() * total;
        let picked = entries[entries.length - 1][0];
        for (const [arch, w] of entries) { roll -= w; if (roll <= 0) { picked = arch; break; } }
        nextRow.push(picked);
      }
    }
    grid.push(nextRow);
  }
  return { grid, startCell, exitCell, minibossCell: minibossPick };
}

function normalizeInfluenceArchetype(archetype) {
  if (!archetype || archetype === BIOME_ARCHETYPE.EMPTY) return BIOME_ARCHETYPE.OPEN_SPACE;
  if (archetype === BIOME_ARCHETYPE.START) return BIOME_ARCHETYPE.OPEN_SPACE;
  return archetype;
}

function getPlayableBandBounds(world) {
  const macroCellH = world.height / BIOME_GRID_ROWS;
  const top = Math.max(0, macroCellH - macroCellH * INFLUENCE_BLEED_ROWS);
  const bottom = Math.min(world.height, macroCellH * (BIOME_GRID_ROWS - 1) + macroCellH * INFLUENCE_BLEED_ROWS);
  return {
    x: 0,
    y: top,
    w: world.width,
    h: Math.max(1, bottom - top)
  };
}

function buildBiomeInfluenceField(world, random) {
  const band = getPlayableBandBounds(world);
  const nominalCellW = band.w / BIOME_INFLUENCE_COLS;
  const nominalCellH = band.h / BIOME_INFLUENCE_ROWS;
  const radiusX = nominalCellW * INFLUENCE_HORIZONTAL_OVERLAP;
  const radiusY = nominalCellH * INFLUENCE_VERTICAL_OVERLAP;
  const macroCandidates = [];
  const grid = world?.archetypeGrid?.grid || [];

  for (let row = 1; row <= BIOME_GRID_ROWS - 2; row += 1) {
    for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
      const archetype = normalizeInfluenceArchetype(grid?.[row]?.[col]);
      if (!archetype || archetype === BIOME_ARCHETYPE.EMPTY) continue;
      const bounds = getBiomeCellBounds(world, col, row);
      macroCandidates.push({
        row,
        col,
        archetype,
        centerX: bounds.x + bounds.w * 0.5,
        centerY: bounds.y + bounds.h * 0.5
      });
    }
  }

  const cells = [];
  for (let row = 0; row < BIOME_INFLUENCE_ROWS; row += 1) {
    for (let col = 0; col < BIOME_INFLUENCE_COLS; col += 1) {
      const jitterX = (random() * 2 - 1) * nominalCellW * INFLUENCE_CENTER_JITTER;
      const jitterY = (random() * 2 - 1) * nominalCellH * INFLUENCE_CENTER_JITTER;
      const centerX = band.x + (col + 0.5) * nominalCellW + jitterX;
      const centerY = band.y + (row + 0.5) * nominalCellH + jitterY;
      const rankedSources = macroCandidates
        .map((candidate) => {
          const dx = candidate.centerX - centerX;
          const dy = candidate.centerY - centerY;
          const distSq = dx * dx + dy * dy;
          return {
            row: candidate.row,
            col: candidate.col,
            archetype: candidate.archetype,
            distSq,
            weight: 1 / Math.max(1, distSq)
          };
        })
        .sort((a, b) => a.distSq - b.distSq)
        .slice(0, 4);
      const sourceWeights = new Map();
      for (const source of rankedSources) {
        sourceWeights.set(source.archetype, (sourceWeights.get(source.archetype) || 0) + source.weight);
      }
      let totalWeight = 0;
      for (const value of sourceWeights.values()) totalWeight += value;
      let roll = random() * Math.max(totalWeight, 1);
      let archetype = rankedSources[0]?.archetype || BIOME_ARCHETYPE.OPEN_SPACE;
      for (const [candidateArchetype, weight] of sourceWeights.entries()) {
        roll -= weight;
        if (roll <= 0) {
          archetype = candidateArchetype;
          break;
        }
      }
      const sourceIds = rankedSources.map((source) => `${source.col},${source.row}`);
      cells.push({
        id: `${col}_${row}`,
        col,
        row,
        archetype,
        centerX,
        centerY,
        radiusX,
        radiusY,
        nominalBounds: {
          x: band.x + col * nominalCellW,
          y: band.y + row * nominalCellH,
          w: nominalCellW,
          h: nominalCellH
        },
        sourceIds
      });
    }
  }

  return {
    cols: BIOME_INFLUENCE_COLS,
    rows: BIOME_INFLUENCE_ROWS,
    band,
    nominalCellW,
    nominalCellH,
    cells
  };
}

function sampleBiomeInfluenceField(world, x, y) {
  const field = world?.biomeInfluenceField;
  if (!field?.cells?.length) {
    return {
      x,
      y,
      primaryArchetype: BIOME_ARCHETYPE.OPEN_SPACE,
      weights: [{ archetype: BIOME_ARCHETYPE.OPEN_SPACE, weight: 1 }],
      cellWeights: [],
      sourceIds: []
    };
  }

  const cellWeights = [];
  const archetypeWeights = new Map();
  for (const cell of field.cells) {
    const dx = (x - cell.centerX) / Math.max(1, cell.radiusX);
    const dy = (y - cell.centerY) / Math.max(1, cell.radiusY);
    const distSq = dx * dx + dy * dy;
    const weight = Math.exp(-distSq * INFLUENCE_FALLOFF);
    if (weight <= 0.0015) continue;
    cellWeights.push({
      cellId: cell.id,
      archetype: cell.archetype,
      weight,
      sourceIds: cell.sourceIds
    });
    archetypeWeights.set(cell.archetype, (archetypeWeights.get(cell.archetype) || 0) + weight);
  }

  if (!cellWeights.length) {
    const fallback = field.cells.reduce((best, cell) => {
      if (!best) return cell;
      const bestDistSq = (best.centerX - x) ** 2 + (best.centerY - y) ** 2;
      const cellDistSq = (cell.centerX - x) ** 2 + (cell.centerY - y) ** 2;
      return cellDistSq < bestDistSq ? cell : best;
    }, null);
    return {
      x,
      y,
      primaryArchetype: fallback?.archetype || BIOME_ARCHETYPE.OPEN_SPACE,
      weights: [{ archetype: fallback?.archetype || BIOME_ARCHETYPE.OPEN_SPACE, weight: 1 }],
      cellWeights: fallback ? [{ cellId: fallback.id, archetype: fallback.archetype, weight: 1, sourceIds: fallback.sourceIds }] : [],
      sourceIds: fallback?.sourceIds || []
    };
  }

  const totalWeight = cellWeights.reduce((sum, entry) => sum + entry.weight, 0);
  const weights = [...archetypeWeights.entries()]
    .map(([archetype, weight]) => ({
      archetype,
      weight: totalWeight > 0 ? weight / totalWeight : 0
    }))
    .sort((a, b) => b.weight - a.weight);

  cellWeights.sort((a, b) => b.weight - a.weight);
  const sourceIds = [...new Set(cellWeights.flatMap((entry) => entry.sourceIds || []))];

  return {
    x,
    y,
    primaryArchetype: weights[0]?.archetype || BIOME_ARCHETYPE.OPEN_SPACE,
    weights,
    cellWeights,
    sourceIds
  };
}

function stampArchetypeLayout(grid, archetype, bounds, random) {
  if (archetype === BIOME_ARCHETYPE.START || archetype === BIOME_ARCHETYPE.OPEN_SPACE || archetype === BIOME_ARCHETYPE.MINIBOSS) return;

  if (archetype === BIOME_ARCHETYPE.RUINS) {
    return;
  }

  if (archetype === BIOME_ARCHETYPE.WOODS) {
    return;
  }

  if (archetype === BIOME_ARCHETYPE.DEEP_WOODS) {
    return;
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

function sampleWorldInfluence(world, x, y, fallbackArchetype = BIOME_ARCHETYPE.OPEN_SPACE) {
  const sample = world?.sampleBiomeInfluence?.(x, y);
  if (!sample) {
    return {
      primaryArchetype: normalizeInfluenceArchetype(fallbackArchetype),
      secondaryArchetype: null,
      secondaryWeight: 0,
      sourceIds: []
    };
  }
  return {
    primaryArchetype: sample.primaryArchetype || normalizeInfluenceArchetype(fallbackArchetype),
    secondaryArchetype: sample.weights?.[1]?.archetype || null,
    secondaryWeight: sample.weights?.[1]?.weight || 0,
    sourceIds: sample.sourceIds || []
  };
}

function spawnDensityMultiplierFromInfluence(influence) {
  return 0.8 + Math.min(0.35, (influence?.secondaryWeight || 0) * 0.5);
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

function buildNormalizedCellBand(bounds, xMin = 0, xMax = 1, yMin = 0, yMax = 1, margin = 104) {
  const innerX = bounds.x + margin;
  const innerY = bounds.y + margin;
  const innerW = Math.max(0, bounds.w - margin * 2);
  const innerH = Math.max(0, bounds.h - margin * 2);
  return {
    x: innerX + innerW * xMin,
    y: innerY + innerH * yMin,
    w: Math.max(0, innerW * Math.max(0, xMax - xMin)),
    h: Math.max(0, innerH * Math.max(0, yMax - yMin))
  };
}

function createBiomeDecoration(typeId, x, y, assets) {
  if (isBreakableOnlyDecoration(typeId)) return null;
  const typeDef = BIOME_DECOR_TYPES[typeId];
  if (!typeDef) return null;
  if (isBreakableOnlyDecoration(typeDef.id) || isBreakableOnlyDecoration(typeDef.assetKey)) return null;
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
      const rawArchetype = world.archetypeGrid.grid[row][col];
      if (rawArchetype === BIOME_ARCHETYPE.EMPTY || rawArchetype === BIOME_ARCHETYPE.START) continue;
      const archetype = normalizeInfluenceArchetype(rawArchetype);
      const centerInfluence = sampleWorldInfluence(
        world,
        (col + 0.5) * (world.width / BIOME_GRID_COLS),
        (row + 0.5) * (world.height / BIOME_GRID_ROWS),
        archetype
      );
      const configArchetype = centerInfluence.primaryArchetype || archetype;
      const config = BIOME_OBSTACLE_SPAWN_CONFIG[configArchetype] || BIOME_OBSTACLE_SPAWN_CONFIG[archetype];
      if (!config) continue;
      const baseCount = config.min + Math.floor(random() * (config.max - config.min + 1));
      const count = Math.max(0, Math.round(baseCount * spawnDensityMultiplierFromInfluence(centerInfluence)));
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
          if (_genPerfStats) _genPerfStats.obstacleAttempts++;
          const sampleX = Math.round(inner.x + random() * Math.max(0, inner.w));
          const sampleY = Math.round(inner.y + random() * Math.max(0, inner.h));
          const localInfluence = sampleWorldInfluence(world, sampleX, sampleY, configArchetype);
          const localConfig = BIOME_OBSTACLE_SPAWN_CONFIG[localInfluence.primaryArchetype] || config;
          const pick = chooseWeightedEntry(localConfig.pool, random);
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

function spawnBiomeTreeObstacles(world, random, assets, forestVariant) {
  const trees = [];
  const occupiedRects = [world.start, world.exit];
  const themedTreeAssetKeys = (forestVariant?.treeSpriteSet?.spriteSources || []).map(assetKeyFromSpriteSource);
  const treeAssetKeys = themedTreeAssetKeys.length ? themedTreeAssetKeys : ANCIENT_TREE_ASSET_KEYS;
  for (const wall of world.tileWallRects || []) occupiedRects.push(wall);
  for (const wall of world.invisibleBarrierRects || []) occupiedRects.push(wall);
  for (const obstacle of world.biomeObstacles || []) {
    if (obstacle.placementRect) occupiedRects.push(obstacle.placementRect);
    if (obstacle.collisionRect) occupiedRects.push(obstacle.collisionRect);
  }

  for (let row = 0; row < BIOME_GRID_ROWS; row += 1) {
    for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
      const rawArchetype = world.archetypeGrid.grid[row][col];
      if (rawArchetype === BIOME_ARCHETYPE.EMPTY || rawArchetype === BIOME_ARCHETYPE.START) continue;
      const macroArchetype = normalizeInfluenceArchetype(rawArchetype);
      const centerInfluence = sampleWorldInfluence(
        world,
        (col + 0.5) * (world.width / BIOME_GRID_COLS),
        (row + 0.5) * (world.height / BIOME_GRID_ROWS),
        macroArchetype
      );
      const archetype = centerInfluence.primaryArchetype || macroArchetype;
      if (
        archetype !== BIOME_ARCHETYPE.WOODS
        && archetype !== BIOME_ARCHETYPE.OPEN_SPACE
        && archetype !== BIOME_ARCHETYPE.DEEP_WOODS
      ) continue;
      const bounds = getBiomeCellBounds(world, col, row);
      if (rawArchetype === BIOME_ARCHETYPE.DEEP_WOODS) {
        const inner = buildNormalizedCellBand(bounds, 0, 1, 0, 0.5, 104);
        const targetCount = 10;
        const treeAttemptLimit = 20;
        const maxFailedPlacements = 3;
        const minHealthyPlacements = Math.max(7, Math.ceil(targetCount * 0.7));
        const healthyFailureLimit = 2;
        let failedPlacements = 0;
        let placedInCell = 0;
        for (let index = 0; index < targetCount; index += 1) {
          let placed = false;
          for (let attempt = 0; attempt < treeAttemptLimit; attempt += 1) {
            if (_genPerfStats) _genPerfStats.treeAttempts++;
            const assetKey = treeAssetKeys[Math.floor(random() * treeAssetKeys.length)];
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
            placedInCell += 1;
            placed = true;
            break;
          }
          if (placed) {
            failedPlacements = 0;
            continue;
          }
          failedPlacements += 1;
          if (placedInCell >= minHealthyPlacements && failedPlacements >= healthyFailureLimit) break;
          if (failedPlacements >= 3) break;
        }
        continue;
      }
      const baseTargetCount = archetype === BIOME_ARCHETYPE.WOODS
        ? 23 + Math.floor(random() * 8)
        : 1 + Math.floor(random() * 2);
      const targetCount = Math.max(0, Math.round(baseTargetCount * spawnDensityMultiplierFromInfluence(centerInfluence)));
      const margin = 104;
      const inner = {
        x: bounds.x + margin,
        y: bounds.y + margin,
        w: Math.max(0, bounds.w - margin * 2),
        h: Math.max(0, bounds.h - margin * 2)
      };
      const treeAttemptLimit = archetype === BIOME_ARCHETYPE.WOODS ? 16 : 8;
      const maxFailedPlacements = archetype === BIOME_ARCHETYPE.WOODS ? 3 : 2;
      const minHealthyPlacements = Math.max(
        archetype === BIOME_ARCHETYPE.WOODS ? 10 : 1,
        Math.ceil(targetCount * (archetype === BIOME_ARCHETYPE.WOODS ? 0.72 : 0.75))
      );
      const healthyFailureLimit = archetype === BIOME_ARCHETYPE.WOODS ? 2 : 1;
      let failedPlacements = 0;
      let placedInCell = 0;
      for (let index = 0; index < targetCount; index += 1) {
        let placed = false;
        for (let attempt = 0; attempt < treeAttemptLimit; attempt += 1) {
          if (_genPerfStats) _genPerfStats.treeAttempts++;
          const sampleX = Math.round(inner.x + random() * Math.max(0, inner.w));
          const sampleY = Math.round(inner.y + random() * Math.max(0, inner.h));
          const localInfluence = sampleWorldInfluence(world, sampleX, sampleY, archetype);
          if (localInfluence.primaryArchetype !== BIOME_ARCHETYPE.WOODS && localInfluence.primaryArchetype !== BIOME_ARCHETYPE.OPEN_SPACE) continue;
          const assetKey = treeAssetKeys[Math.floor(random() * treeAssetKeys.length)];
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
          placedInCell += 1;
          placed = true;
          break;
        }
        if (placed) {
          failedPlacements = 0;
          continue;
        }
        failedPlacements += 1;
        if (placedInCell >= minHealthyPlacements && failedPlacements >= healthyFailureLimit) break;
        if (failedPlacements >= maxFailedPlacements) break;
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
    if (isBreakableOnlyDecoration(typeDef.id) || isBreakableOnlyDecoration(typeDef.assetKey)) continue;
    // Fix 5: probe is position-independent — hoist outside the cell loop
    const decorProbe = createBiomeDecoration(typeDef.id, 0, 0, assets);
    if (!decorProbe) continue;
    for (let row = 0; row < BIOME_GRID_ROWS; row += 1) {
      for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
        const rawArchetype = world.archetypeGrid.grid[row][col];
        if (rawArchetype === BIOME_ARCHETYPE.EMPTY || rawArchetype === BIOME_ARCHETYPE.START) continue;
        const cx = (col + 0.5) * (world.width / BIOME_GRID_COLS);
        const cy = (row + 0.5) * (world.height / BIOME_GRID_ROWS);
        // Fix 2: sample center once, reuse for both archetype lookup and density multiplier
        const centerSample = sampleWorldInfluence(world, cx, cy, rawArchetype);
        const archetype = centerSample.primaryArchetype;
        const spawnConfig = typeDef.spawnByArchetype?.[archetype];
        if (!spawnConfig) continue;
        const count = Math.max(
          0,
          Math.round(
            (spawnConfig.min + Math.floor(random() * (spawnConfig.max - spawnConfig.min + 1)))
            * spawnDensityMultiplierFromInfluence(centerSample)
          )
        );
        if (count <= 0) continue;
        const bounds = getBiomeCellBounds(world, col, row);
        const margin = spawnConfig.margin ?? 96;
        const inner = {
          x: bounds.x + margin,
          y: bounds.y + margin,
          w: Math.max(0, bounds.w - margin * 2),
          h: Math.max(0, bounds.h - margin * 2)
        };
        if (inner.w < decorProbe.w || inner.h < decorProbe.h) continue;

        for (let index = 0; index < count; index += 1) {
          for (let attempt = 0; attempt < 48; attempt += 1) {
            if (_genPerfStats) _genPerfStats.decorAttempts++;
            const x = Math.round(inner.x + random() * Math.max(0, inner.w - decorProbe.w));
            const y = Math.round(inner.y + random() * Math.max(0, inner.h - decorProbe.h));
            const localInfluence = sampleWorldInfluence(world, x + decorProbe.w * 0.5, y + decorProbe.h * 0.5, archetype);
            if ((typeDef.spawnByArchetype?.[localInfluence.primaryArchetype] || null) !== spawnConfig) continue;
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
    // Fix 4: integer key — avoids string allocation per tile (900 tiles per blocker cell)
    for (let gy = 0; gy < tileBounds.h; gy += 1) {
      const absGy = tileBounds.y + gy;
      for (let gx = 0; gx < tileBounds.w; gx += 1) {
        world.blockerChunkTileSet.add(absGy * 10000 + (tileBounds.x + gx));
      }
    }
  }
}

export function rebuildWorldCollisionRects(world, extraRects = []) {
  if (!world) return [];
  // Fix 6: concat() instead of spread — avoids repeated iterator overhead on large arrays
  const staticCollisionRectsNoTrees = (world.tileWallRects || [])
    .concat(world.invisibleBarrierRects || [], world.biomeObstacleCollisionRects || []);
  const staticCollisionRects = staticCollisionRectsNoTrees
    .concat(world.treeCollisionRects || []);
  const dynamicCollisionRects = extraRects?.length ? extraRects.slice() : [];
  world.staticCollisionRectsNoTrees = staticCollisionRectsNoTrees;
  world.staticCollisionRects = staticCollisionRects;
  world.dynamicCollisionRects = dynamicCollisionRects;
  world.collisionRectsNoTrees = staticCollisionRectsNoTrees.concat(dynamicCollisionRects);
  world.collisionRects = staticCollisionRects.concat(dynamicCollisionRects);
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

function clonePlain(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function serializeUpperCliff(upperCliff) {
  if (!upperCliff?.enabled) return null;
  return {
    enabled: true,
    playableLayout: clonePlain(upperCliff.playableLayout),
    boundary: clonePlain(upperCliff.boundary),
    layoutTargets: clonePlain(upperCliff.layoutTargets),
    groundClipRects: clonePlain(upperCliff.groundClipRects || []),
    row01GroundMaskRects: clonePlain(upperCliff.row01GroundMaskRects || []),
    midStripFillRects: clonePlain(upperCliff.midStripFillRects || []),
    row0IslandGroundMaskMacroCols: clonePlain(upperCliff.row0IslandGroundMaskMacroCols || []),
    rockBorder: upperCliff.rockBorder
      ? {
        placements: clonePlain(upperCliff.rockBorder.placements || []),
        debugPoints: clonePlain(upperCliff.rockBorder.debugPoints || [])
      }
      : null,
    occludeTiles: upperCliff.occludeTiles ? Array.from(upperCliff.occludeTiles) : [],
    visualMode: upperCliff.visualMode || "none",
    gameplayInsetPx: clonePlain(upperCliff.gameplayInsetPx || null)
  };
}

function hydrateUpperCliff(prefabUpperCliff, assets) {
  if (!prefabUpperCliff?.enabled) return null;
  return {
    enabled: true,
    playableLayout: clonePlain(prefabUpperCliff.playableLayout),
    boundary: clonePlain(prefabUpperCliff.boundary),
    layoutTargets: clonePlain(prefabUpperCliff.layoutTargets),
    groundClipRects: clonePlain(prefabUpperCliff.groundClipRects || []),
    row01GroundMaskRects: clonePlain(prefabUpperCliff.row01GroundMaskRects || []),
    midStripFillRects: clonePlain(prefabUpperCliff.midStripFillRects || []),
    row0IslandGroundMaskMacroCols: clonePlain(prefabUpperCliff.row0IslandGroundMaskMacroCols || []),
    rockBorder: prefabUpperCliff.rockBorder
      ? {
        image: assets?.biomeRockBorder || null,
        placements: clonePlain(prefabUpperCliff.rockBorder.placements || []),
        occludeTiles: null,
        debugPoints: clonePlain(prefabUpperCliff.rockBorder.debugPoints || [])
      }
      : null,
    occludeTiles: new Set(prefabUpperCliff.occludeTiles || []),
    visualMode: prefabUpperCliff.visualMode || "none",
    gameplayInsetPx: clonePlain(prefabUpperCliff.gameplayInsetPx || null)
  };
}

export function serializeRoomPrefab(world, meta = {}) {
  if (!world) return null;
  return {
    id: meta.id || null,
    prefabSeed: meta.prefabSeed ?? world.seed ?? 0,
    roomIndex: meta.roomIndex ?? 0,
    width: world.width,
    height: world.height,
    tileSize: world.tileSize,
    cols: world.cols,
    rows: world.rows,
    grid: clonePlain(world.grid),
    start: clonePlain(world.start),
    exit: clonePlain(world.exit),
    archetypeGrid: clonePlain(world.archetypeGrid),
    biomeInfluenceField: clonePlain(world.biomeInfluenceField),
    playableMacroRects: clonePlain(world.playableMacroRects || []),
    voidRects: clonePlain(world.voidRects || []),
    blockerChunkSpaces: clonePlain(world.blockerChunkSpaces || []),
    tileWallRects: clonePlain(world.tileWallRects || []),
    invisibleBarrierRects: clonePlain(world.invisibleBarrierRects || []),
    biomeObstacles: clonePlain(world.biomeObstacles || []),
    treeObstacles: clonePlain(world.treeObstacles || []),
    decor: clonePlain(world.decor || []),
    upperCliff: serializeUpperCliff(world.upperCliff),
    cosmeticFloor: serializeOpenWorldCosmeticFloor(world.cosmeticFloor)
  };
}

function rebuildBlockerChunkTileSet(world) {
  world.blockerChunkTileSet = new Set();
  for (const space of world.blockerChunkSpaces || []) {
    const tileBounds = getBiomeCellTileBounds(space.col, space.row);
    for (let gy = 0; gy < tileBounds.h; gy += 1) {
      const absGy = tileBounds.y + gy;
      for (let gx = 0; gx < tileBounds.w; gx += 1) {
        world.blockerChunkTileSet.add(absGy * 10000 + (tileBounds.x + gx));
      }
    }
  }
}

function countFloorTiles(world) {
  let floorTileCount = 0;
  for (let gy = 0; gy < world.rows; gy += 1) {
    const row = world.grid[gy];
    for (let gx = 0; gx < world.cols; gx += 1) {
      if (row[gx] === 0) floorTileCount += 1;
    }
  }
  world._floorTileCount = floorTileCount;
}

function buildWorldFromPrefab(prefab, seed, roomIndex, assets) {
  if (!prefab) return null;
  const roomSeed = seed + roomIndex * 997;
  const forestVariant = getRoomForestVariant(roomIndex);
  const world = {
    seed: roomSeed,
    tileSize: prefab.tileSize,
    cols: prefab.cols,
    rows: prefab.rows,
    width: prefab.width,
    height: prefab.height,
    grid: clonePlain(prefab.grid),
    assetRefs: assets,
    forestVariantId: forestVariant.id,
    start: clonePlain(prefab.start),
    exit: clonePlain(prefab.exit),
    archetypeGrid: clonePlain(prefab.archetypeGrid),
    biomeInfluenceField: clonePlain(prefab.biomeInfluenceField),
    playableMacroRects: clonePlain(prefab.playableMacroRects || []),
    voidRects: clonePlain(prefab.voidRects || []),
    blockerChunkSpaces: clonePlain(prefab.blockerChunkSpaces || []),
    tileWallRects: clonePlain(prefab.tileWallRects || []),
    invisibleBarrierRects: clonePlain(prefab.invisibleBarrierRects || []),
    biomeObstacles: clonePlain(prefab.biomeObstacles || []),
    treeObstacles: clonePlain(prefab.treeObstacles || []),
    decor: clonePlain(prefab.decor || []),
    upperCliff: hydrateUpperCliff(prefab.upperCliff, assets)
  };
  world.tileGrid = world.grid;
  rebuildBlockerChunkTileSet(world);
  world.sampleBiomeInfluence = (x, y) => sampleBiomeInfluenceField(world, x, y);
  world.biomeObstaclePlacementRects = world.biomeObstacles.map((obstacle) => obstacle.placementRect).filter(Boolean);
  world.biomeObstacleCollisionRects = world.biomeObstacles.map((obstacle) => obstacle.collisionRect).filter(Boolean);
  world.treeCollisionRects = world.treeObstacles.map((tree) => tree.collisionRect).filter(Boolean);
  rebuildWorldCollisionRects(world);
  rebuildSortedRenderLists(world);
  world.spawnTiles = collectSpawnTiles(world);
  world.biomeCellBounds = (col, row) => getBiomeCellBounds(world, col, row);
  world.cobblestonePathAtlas = assets?.biomeCobble || null;
  world.blockerChunkAtlas = assets?.biomeBlockerChunks || null;
  countFloorTiles(world);
  world.cosmeticFloor = buildOpenWorldCosmeticFloorFromPrefab(world, assets, clonePlain(prefab.cosmeticFloor));
  return world;
}

function pickRoom0Prefab(seed) {
  if (!ROOM0_PREFABS.length) return null;
  const random = createSeededRandom((seed ^ 0x70fabb1) >>> 0);
  return ROOM0_PREFABS[Math.floor(random() * ROOM0_PREFABS.length)] || ROOM0_PREFABS[0] || null;
}

export function buildRoom0PrefabVariants(assets, seeds = ROOM0_PREFAB_EXPORT_SEEDS) {
  return seeds.map((prefabSeed, index) =>
    serializeRoomPrefab(generateRoomProcedural(prefabSeed, 0, assets), {
      id: `room0_variant_${index + 1}`,
      prefabSeed,
      roomIndex: 0
    })
  );
}

export function buildRoom0PrefabModuleSource(assets, seeds = ROOM0_PREFAB_EXPORT_SEEDS) {
  const prefabs = buildRoom0PrefabVariants(assets, seeds);
  return [
    "export const ROOM0_PREFAB_SEEDS = " + JSON.stringify(seeds, null, 2) + ";",
    "",
    "export const ROOM0_PREFABS = " + JSON.stringify(prefabs, null, 2) + ";",
    ""
  ].join("\n");
}

export function downloadRoom0PrefabModule(assets, seeds = ROOM0_PREFAB_EXPORT_SEEDS) {
  const source = buildRoom0PrefabModuleSource(assets, seeds);
  if (typeof document === "undefined") return source;
  const blob = new Blob([source], { type: "text/javascript;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "prefab-room0.js";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
  return source;
}

export async function saveRoom0PrefabModule(assets, seeds = ROOM0_PREFAB_EXPORT_SEEDS) {
  const source = buildRoom0PrefabModuleSource(assets, seeds);
  if (typeof fetch !== "function") return source;
  const response = await fetch("/api/prefab-room0", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source })
  });
  if (!response.ok) {
    if (response.status === 404) {
      downloadRoom0PrefabModule(assets, seeds);
      return {
        ok: false,
        downloaded: true,
        reason: "prefab save endpoint unavailable; restart the dev server to enable direct writes",
        file: "src/data/prefab-room0.js"
      };
    }
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.error ? `: ${payload.error}` : "";
    } catch {
      // Ignore JSON parsing failures and keep the status-only message.
    }
    throw new Error(`Failed to save prefab-room0.js (${response.status})${detail}`);
  }
  return response.json();
}

function generateRoomProcedural(seed, roomIndex, assets) {
  const _totalT0 = GEN_PERF_DEBUG ? performance.now() : 0;

  // Set up per-call stats object for spawn helpers to increment
  if (GEN_PERF_DEBUG) {
    _genPerfStats = { obstacleAttempts: 0, treeAttempts: 0, decorAttempts: 0 };
  }

  const roomSeed = seed + roomIndex * 997;
  const random = createSeededRandom(roomSeed);
  const forestVariant = getRoomForestVariant(roomIndex);
  const world = {
    seed: roomSeed,
    tileSize: TILE_SIZE,
    cols: GRID_W,
    rows: GRID_H,
    width: GRID_W * TILE_SIZE,
    height: GRID_H * TILE_SIZE,
    grid: Array.from({ length: GRID_H }, () => Array.from({ length: GRID_W }, () => 0)),
    assetRefs: assets,
    forestVariantId: forestVariant.id
  };
  world.tileGrid = world.grid;

  let _t0;

  _t0 = GEN_PERF_DEBUG ? performance.now() : 0;
  world.archetypeGrid = buildArchetypeGrid(random);
  if (GEN_PERF_DEBUG) console.log(`[gen] buildArchetypeGrid:       ${(performance.now() - _t0).toFixed(2)}ms`);

  _t0 = GEN_PERF_DEBUG ? performance.now() : 0;
  world.biomeInfluenceField = buildBiomeInfluenceField(world, random);
  // Fix 3: memoize influence samples at 64 px resolution.
  // Influence cells are ~685 px wide so 64 px quantisation is imperceptible,
  // but eliminates most redundant Math.exp × 28-cell work during spawn loops.
  const _influenceCache = new Map();
  world.sampleBiomeInfluence = (x, y) => {
    const key = Math.round(x / 64) * 100000 + Math.round(y / 64);
    let cached = _influenceCache.get(key);
    if (cached === undefined) {
      cached = sampleBiomeInfluenceField(world, x, y);
      _influenceCache.set(key, cached);
    }
    return cached;
  };
  if (GEN_PERF_DEBUG) console.log(`[gen] buildBiomeInfluenceField: ${(performance.now() - _t0).toFixed(2)}ms`);

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

  _t0 = GEN_PERF_DEBUG ? performance.now() : 0;
  buildCobblestonePath(world, random);
  if (GEN_PERF_DEBUG) console.log(`[gen] buildCobblestonePath:     ${(performance.now() - _t0).toFixed(2)}ms`);

  _t0 = GEN_PERF_DEBUG ? performance.now() : 0;
  rebuildTileWallRects(world);
  if (GEN_PERF_DEBUG) console.log(`[gen] rebuildTileWallRects #1:  ${(performance.now() - _t0).toFixed(2)}ms`);

  _t0 = GEN_PERF_DEBUG ? performance.now() : 0;
  applyBiomeTopBottomWalls(world, roomSeed);
  if (GEN_PERF_DEBUG) console.log(`[gen] applyBiomeTopBottomWalls: ${(performance.now() - _t0).toFixed(2)}ms`);

  _t0 = GEN_PERF_DEBUG ? performance.now() : 0;
  rebuildTileWallRects(world);
  if (GEN_PERF_DEBUG) console.log(`[gen] rebuildTileWallRects #2:  ${(performance.now() - _t0).toFixed(2)}ms`);

  _t0 = GEN_PERF_DEBUG ? performance.now() : 0;
  buildUpperCliffForBiomeWorld(world, roomSeed, { useSprites: true });
  if (GEN_PERF_DEBUG) console.log(`[gen] buildUpperCliff:          ${(performance.now() - _t0).toFixed(2)}ms`);

  world.invisibleBarrierRects = buildInvisibleBarrierRects(world);
  const startBounds = getBiomeCellBounds(world, world.archetypeGrid.startCell.col, world.archetypeGrid.startCell.row);
  const exitBounds = getBiomeCellBounds(world, world.archetypeGrid.exitCell.col, world.archetypeGrid.exitCell.row);
  world.start = {
    x: Math.round(startBounds.x + startBounds.w * 0.5 - TILE_SIZE * 0.5),
    y: Math.round(startBounds.y + startBounds.h * 0.5 - TILE_SIZE * 0.5),
    w: TILE_SIZE,
    h: TILE_SIZE
  };
  world.exit = { x: exitBounds.x + exitBounds.w - 128, y: exitBounds.y + exitBounds.h * 0.5 - 16, w: TILE_SIZE, h: TILE_SIZE };

  _t0 = GEN_PERF_DEBUG ? performance.now() : 0;
  world.biomeObstacles = spawnBiomeObstacles(world, random, assets);
  world.biomeObstaclePlacementRects = world.biomeObstacles.map((obstacle) => obstacle.placementRect).filter(Boolean);
  world.biomeObstacleCollisionRects = world.biomeObstacles.map((obstacle) => obstacle.collisionRect).filter(Boolean);
  if (GEN_PERF_DEBUG) console.log(`[gen] spawnBiomeObstacles:      ${(performance.now() - _t0).toFixed(2)}ms  (${_genPerfStats.obstacleAttempts} attempts, ${world.biomeObstacles.length} placed)`);

  _t0 = GEN_PERF_DEBUG ? performance.now() : 0;
  world.treeObstacles = spawnBiomeTreeObstacles(world, random, assets, forestVariant);
  if (GEN_PERF_DEBUG) console.log(`[gen] spawnBiomeTreeObstacles:  ${(performance.now() - _t0).toFixed(2)}ms  (${_genPerfStats.treeAttempts} attempts, ${world.treeObstacles.length} placed)`);

  _t0 = GEN_PERF_DEBUG ? performance.now() : 0;
  world.decor = spawnBiomeDecorations(world, random, assets);
  if (GEN_PERF_DEBUG) console.log(`[gen] spawnBiomeDecorations:    ${(performance.now() - _t0).toFixed(2)}ms  (${_genPerfStats.decorAttempts} attempts, ${world.decor.length} placed)`);

  world.treeCollisionRects = world.treeObstacles.map((tree) => tree.collisionRect);

  _t0 = GEN_PERF_DEBUG ? performance.now() : 0;
  rebuildWorldCollisionRects(world);
  if (GEN_PERF_DEBUG) console.log(`[gen] rebuildWorldCollision:    ${(performance.now() - _t0).toFixed(2)}ms`);

  rebuildSortedRenderLists(world);

  _t0 = GEN_PERF_DEBUG ? performance.now() : 0;
  world.spawnTiles = collectSpawnTiles(world);
  if (GEN_PERF_DEBUG) console.log(`[gen] collectSpawnTiles:        ${(performance.now() - _t0).toFixed(2)}ms`);

  world.biomeCellBounds = (col, row) => getBiomeCellBounds(world, col, row);
  world.cobblestonePathAtlas = assets?.biomeCobble || null;
  world.blockerChunkAtlas = assets?.biomeBlockerChunks || null;

  // Fix 1: count floor tiles once so buildGroundPlacements doesn't grid.flat().filter() per call
  let _floorTileCount = 0;
  for (let gy = 0; gy < world.rows; gy++) {
    const row = world.grid[gy];
    for (let gx = 0; gx < world.cols; gx++) {
      if (row[gx] === 0) _floorTileCount++;
    }
  }
  world._floorTileCount = _floorTileCount;

  _t0 = GEN_PERF_DEBUG ? performance.now() : 0;
  world.cosmeticFloor = buildOpenWorldCosmeticFloor(
    world,
    roomSeed,
    assets,
    forestVariant?.grassPatchSpriteSet?.groundTypeId || "grassA"
  );
  if (GEN_PERF_DEBUG) {
    const floorStats = world.cosmeticFloor?.groundLayer?.generationStats || null;
    const floorStatsSuffix = floorStats
      ? `  (${floorStats.groundAttempts} attempts, ${floorStats.groundAccepted} patches, ${floorStats.flowerPlacements} flowers)`
      : "";
    console.log(`[gen] buildCosmeticFloor:       ${(performance.now() - _t0).toFixed(2)}ms${floorStatsSuffix}`);
  }

  if (GEN_PERF_DEBUG) {
    const total = performance.now() - _totalT0;
    const cacheHits = _influenceCache.size;
    console.log(`[gen] ─────────────────────────────────────────`);
    console.log(`[gen] TOTAL room ${roomIndex}:              ${total.toFixed(2)}ms  (influence cache: ${cacheHits} unique entries)`);
    _genPerfStats = null;
  }

  return world;
}

export function generateRoom(seed, roomIndex, assets) {
  if (USE_PREFAB_ROOM0 && roomIndex === 0) {
    const prefab = pickRoom0Prefab(seed);
    if (prefab) {
      return buildWorldFromPrefab(prefab, seed, roomIndex, assets);
    }
  }
  return generateRoomProcedural(seed, roomIndex, assets);
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
  world.biomeInfluenceField = {
    cols: 1,
    rows: 1,
    band: { x: 0, y: 0, w: world.width, h: world.height },
    nominalCellW: world.width,
    nominalCellH: world.height,
    cells: [{
      id: "0_0",
      col: 0,
      row: 0,
      archetype: BIOME_ARCHETYPE.OPEN_SPACE,
      centerX: world.width * 0.5,
      centerY: world.height * 0.5,
      radiusX: world.width,
      radiusY: world.height,
      nominalBounds: { x: 0, y: 0, w: world.width, h: world.height },
      sourceIds: ["0,0"]
    }]
  };
  world.sampleBiomeInfluence = (x, y) => sampleBiomeInfluenceField(world, x, y);
  world.playableMacroRects = [{ x: 0, y: 0, w: world.width, h: world.height }];
  world.voidRects = [];
  world.blockerChunkSpaces = [];
  world.blockerChunkTileSet = new Set();
  world.upperCliff = { enabled: false };
  world.invisibleBarrierRects = [];
  world.start = {
    x: Math.round(world.width * 0.5 - TILE_SIZE * 0.5),
    y: Math.round(world.height * 0.5 - TILE_SIZE * 0.5),
    w: TILE_SIZE,
    h: TILE_SIZE
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
