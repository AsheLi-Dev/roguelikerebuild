import { createSeededRandom } from "../core/runtime-utils.js";
import { buildOpenWorldCosmeticFloor } from "./biome-floor.js";
import { buildUpperCliffForBiomeWorld } from "./biome-upper-cliff.js";

const TILE_SIZE = 32;
export const BIOME_GRID_COLS = 4;
export const BIOME_GRID_ROWS = 4;
export const BIOME_CELL_TILES_W = 30;
export const BIOME_CELL_TILES_H = 30;
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
  const minibossPick = middleCandidates.find((candidate) => candidate.col === 3) || middleCandidates[0];
  const vaultCandidates = middleCandidates.filter((candidate) => candidate !== minibossPick);
  const vaultPick = vaultCandidates[Math.floor(random() * vaultCandidates.length)];
  const generalPool = BIOME_ARCHETYPE_POOL.filter((id) => id !== BIOME_ARCHETYPE.MINIBOSS && id !== BIOME_ARCHETYPE.VAULT);

  const grid = [];
  for (let row = 0; row < BIOME_GRID_ROWS; row += 1) {
    const nextRow = [];
    for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
      if (row === 0) nextRow.push(topActiveCols.includes(col) ? BIOME_ARCHETYPE.OPEN_SPACE : BIOME_ARCHETYPE.EMPTY);
      else if (row === 3) nextRow.push(bottomActiveCols.includes(col) ? BIOME_ARCHETYPE.OPEN_SPACE : BIOME_ARCHETYPE.EMPTY);
      else if (col === startCell.col && row === startCell.row) nextRow.push(BIOME_ARCHETYPE.START);
      else if (col === exitCell.col && row === exitCell.row) nextRow.push(BIOME_ARCHETYPE.OPEN_SPACE);
      else if (minibossPick && col === minibossPick.col && row === minibossPick.row) nextRow.push(BIOME_ARCHETYPE.MINIBOSS);
      else if (vaultPick && col === vaultPick.col && row === vaultPick.row) nextRow.push(BIOME_ARCHETYPE.VAULT);
      else nextRow.push(generalPool[Math.floor(random() * generalPool.length)]);
    }
    grid.push(nextRow);
  }
  return { grid, startCell, exitCell };
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
  world.collisionRects = [...world.tileWallRects, ...world.invisibleBarrierRects];
  world.spawnTiles = collectSpawnTiles(world);
  world.decor = [];
  world.biomeCellBounds = (col, row) => getBiomeCellBounds(world, col, row);
  world.cobblestonePathAtlas = assets?.biomeCobble || null;
  world.blockerChunkAtlas = assets?.biomeBlockerChunks || null;
  world.cosmeticFloor = buildOpenWorldCosmeticFloor(world, roomSeed, assets, "grassA");

  const startBounds = getBiomeCellBounds(world, world.archetypeGrid.startCell.col, world.archetypeGrid.startCell.row);
  const exitBounds = getBiomeCellBounds(world, world.archetypeGrid.exitCell.col, world.archetypeGrid.exitCell.row);
  world.start = { x: startBounds.x + 96, y: startBounds.y + startBounds.h * 0.5, w: 32, h: 32 };
  world.exit = { x: exitBounds.x + exitBounds.w - 128, y: exitBounds.y + exitBounds.h * 0.5 - 16, w: TILE_SIZE, h: TILE_SIZE };
  return world;
}
