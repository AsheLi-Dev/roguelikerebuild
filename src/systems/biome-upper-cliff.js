/**
 * Upper-half cliff decoration driven by 4×4 macro playable cells (not tile walls).
 * Gameplay bounds stay on the procedural grid; rock sprites also append `tileWallRects` with `_upperCliffRockCollision`.
 *
 * Phases 1–2: playable layout + boundary + layout targets (world.upperCliff.*)
 * Phases 3–5: placeholders and/or rock-border sprites along macro edges (upper half only)
 * Phases 6–7: hooks / TODOs (gameplay inset, backdrop) — see UPPER_CLIFF_* constants
 */

import { ROCK_BORDER_ATLAS } from '../data/terrain-rock-border-atlas.js';
import { createSeededRandom } from '../core/runtime-utils.js';
import {
  buildRockBorderFromBounds,
  drawRockBorder,
  ROCK_BORDER_ISLAND_TOP_BUILD_OPTIONS,
} from './map-rock-border.js';
import {
  buildIslandRow0GroundClipRects,
  buildRow01BoundaryMidStripMaskRects,
  buildRow01TopSpriteBottomToRow1BottomClipRects,
  UPPER_CLIFF_MASK_DESIGN_ROW01_MIDSTRIP_DOWN_PX,
  UPPER_CLIFF_MASK_DESIGN_SIDE5_COLUMN_TRIM_PX,
  UPPER_CLIFF_MASK_DESIGN_SIDE5_OFFSET_PX,
} from './upper-cliff-ground-mask.js';

/** Archetype id for non-playable macro cells (must match maps.js BIOME_ARCHETYPE.EMPTY). */
const MACRO_EMPTY = 'empty';

function mulberry32(seed) {
  return createSeededRandom(seed);
}

// --- Phase 8: centralized tuning (adjust here) ---
export const UPPER_CLIFF_DEBUG_BOUNDARY = false;
export const UPPER_CLIFF_DEBUG_TARGETS = false;
/** Phase 3: draw colored strips from layout targets instead of/in addition to sprites */
export const UPPER_CLIFF_PLACEHOLDER_VISUALS = false;
/** Phase 6: coarse inset (px) applied as metadata only until collision consumes it */
export const UPPER_CLIFF_GAMEPLAY_INSET_TOP_PX = 0;
export const UPPER_CLIFF_GAMEPLAY_INSET_SIDE_PX = 0;
/** Debug: log exactly one buildRockBorderFromBounds island invocation. */
export const UPPER_CLIFF_DEBUG_LOG_ONE_BORDER_BUILD = true;
/** Debug: `console.log` each row 0–1 top-strip piece (left→right): id, position, size. Set `true` to enable. */
export const UPPER_CLIFF_DEBUG_ROW01_PIECE_LOG = false;
/** Phase 4: slightly tighter overlap along top spans (multiplier on advance inside map-rock-border) */
export const UPPER_CLIFF_TOP_SPAN_LENGTH_SCALE = 1;
/** Vertical raise of the main cliff strip vs first macro row bottom (reference at 32px tile). */
const TOP_CLIFF_RAISE_PX = 120;
/** Tri-part “middle band” macro columns — must match `biome-upper-cliff-test.js` ROW1_PLAYABLE_MIN/MAX. */
const UPPER_CLIFF_TEST_ROW1_MIN_COL = 1;
const UPPER_CLIFF_TEST_ROW1_MAX_COL = 3;
/** Left/right wing regions extend this far into the row-1 middle band (reference px at 32px tile). */
const UPPER_CLIFF_WING_INTO_MIDDLE_PX = 160;
/** Design px at 32px tile: world-X offset from macro cell (0,0) left for first `top_left` center when that cell is playable. */
const UPPER_CLIFF_LEFT_FIRST_TOP_INTO_PLAYABLE_COL_PX = 160;
/** Top-edge wing chaining (same rules as biome-upper-cliff-test + map-rock-border computeTopPlacements). */
const TEST_STYLE_TOP_FLAT_IDS = new Set(['top_flat_8', 'top_flat_9']);
const TEST_STYLE_TOP_SLOPE_DOWN_ID = 'top_5';
const TEST_STYLE_TOP_SLOPE_UP_ID = 'top_6';
/**
 * When RNG picks a slope, use this order (656 × 3). Flats are still random between steps and do not advance
 * the index; `slopeState.idx` wraps after 9 slopes.
 */
const ROW01_SLOPE_PATTERN_656x3 = [
  TEST_STYLE_TOP_SLOPE_UP_ID,
  TEST_STYLE_TOP_SLOPE_DOWN_ID,
  TEST_STYLE_TOP_SLOPE_UP_ID,
  TEST_STYLE_TOP_SLOPE_UP_ID,
  TEST_STYLE_TOP_SLOPE_DOWN_ID,
  TEST_STYLE_TOP_SLOPE_UP_ID,
  TEST_STYLE_TOP_SLOPE_UP_ID,
  TEST_STYLE_TOP_SLOPE_DOWN_ID,
  TEST_STYLE_TOP_SLOPE_UP_ID,
];
let upperCliffBorderBuildLogged = false;

function macroCellSizePx(world, cols, rows) {
  return {
    cellW: world.width / cols,
    cellH: world.height / rows,
  };
}

/** World tile size in px (biome worlds set this; default matches debug test / atlas). */
function worldTilePx(world) {
  const ts = world?.tileSize;
  return typeof ts === 'number' && ts > 0 ? ts : 32;
}

/**
 * Scale a value authored for a 32px-tile world to the current tile size
 * (cliff insets, cut padding, stitch cursor, min spans — not sprite-atlas internals).
 */
function upperPx(world, designPxAt32Tile) {
  return Math.round((designPxAt32Tile * worldTilePx(world)) / 32);
}

function isPlayableArchetype(archetype) {
  return archetype && archetype !== MACRO_EMPTY;
}

/**
 * Phase 1 — Playable macro layout (source of truth mirror; cells come from archetypeGrid).
 */
export function buildPlayableMacroCellLayout(world, archetypeGrid) {
  const grid = archetypeGrid?.grid;
  if (!Array.isArray(grid) || !grid.length || !Array.isArray(grid[0])) return null;
  const rows = grid.length;
  const cols = grid[0].length;
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const archetype = grid[row][col];
      cells.push({
        row,
        col,
        playable: isPlayableArchetype(archetype),
        archetype,
      });
    }
  }
  return {
    rows,
    cols,
    cells,
    worldWidthPx: world.width,
    worldHeightPx: world.height,
  };
}

function dedupeCorners(corners) {
  const seen = new Set();
  let w = 0;
  for (let i = 0; i < corners.length; i++) {
    const c = corners[i];
    const key = `${c.role}|${Math.round(c.x)}|${Math.round(c.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    corners[w++] = c;
  }
  corners.length = w;
}

function playableAt(layout, col, row) {
  if (row < 0 || col < 0 || row >= layout.rows || col >= layout.cols) return false;
  return layout.cells[row * layout.cols + col].playable;
}

/** First row-0 playable macro column, or `null` if none (test uses a single random col for the cut). */
function findFirstRow0PlayableCol(layout) {
  if (!layout) return null;
  for (let col = 0; col < layout.cols; col++) {
    if (playableAt(layout, col, 0)) return col;
  }
  return null;
}

/**
 * Row 0 → row 1 bridge mask for top playable macro cells:
 * rect from row-0 bottom edge down to row-1 bottom.
 */
function buildRow01PlayableBottomBridgeRects(world, layout) {
  if (!world || !layout || layout.rows <= 0 || layout.cols <= 0) return [];
  const cellW = world.width / layout.cols;
  const cellH = world.height / layout.rows;
  const y = cellH;
  const h = cellH;
  if (h <= 0) return [];
  const rects = [];
  for (let col = 0; col < layout.cols; col++) {
    if (!playableAt(layout, col, 0)) continue;
    rects.push({
      x: col * cellW,
      y,
      w: cellW,
      h,
    });
  }
  return rects;
}

/** Center-X of the rightmost row-0 island `bottom_right` piece; used as strict right-wing start floor. */
function rightWingStartXFromRow0IslandBottomRightPiece(world, layout, seedBase = 9001) {
  if (!layout) return null;
  const { cellW, cellH } = macroCellSizePx(world, layout.cols, layout.rows);
  const inset = worldTilePx(world);
  const minInner = Math.max(2 * inset, upperPx(world, 64));
  let rightmostCenter = -Infinity;
  for (const c of layout.cells) {
    if (!c.playable || c.row !== 0) continue;
    const x = c.col * cellW;
    const y = c.row * cellH;
    const islandBounds = {
      x: x + inset,
      y: y + inset,
      w: Math.max(minInner, cellW - 2 * inset),
      h: Math.max(minInner, cellH - 2 * inset),
    };
    const islandSeed = seedBase + c.col * 31 + c.row * 7;
    const rock = buildRockBorderFromBounds(islandBounds, islandSeed, ROCK_BORDER_ISLAND_TOP_BUILD_OPTIONS);
    for (const p of rock?.placements || []) {
      if (p.spriteId !== 'bottom_right') continue;
      const cx = p.x + p.sw * 0.5;
      rightmostCenter = Math.max(rightmostCenter, cx);
    }
  }
  return rightmostCenter > -Infinity ? rightmostCenter : null;
}

/** World X where the left wing’s first `top_left` should be centered: x=0 if (0,0) is empty; else scaled offset into cell (0,0). */
function leftWingFirstTopLeftCenterWorldX(world, layout) {
  if (!layout || layout.rows < 1 || layout.cols < 1) return 0;
  if (!playableAt(layout, 0, 0)) return 0;
  const { cellW } = macroCellSizePx(world, layout.cols, layout.rows);
  const into = upperPx(world, UPPER_CLIFF_LEFT_FIRST_TOP_INTO_PLAYABLE_COL_PX);
  return Math.min(into, Math.max(0, cellW - 1));
}

/**
 * Phase 1 — Exposed edges for upper cliff only (north / west / east of playable macro cells
 * that lie in the upper half: rows 0–1). South edges omitted (lower boundary handled later).
 */
export function computeUpperCliffExposedBoundary(world, layout) {
  if (!layout) return null;
  const { cellW, cellH } = macroCellSizePx(world, layout.cols, layout.rows);
  const yMid = world.height * 0.5;
  const topSegments = [];
  const leftSegments = [];
  const rightSegments = [];
  const corners = [];

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      if (!playableAt(layout, col, row)) continue;
      if (row > 1) continue;

      const x0 = col * cellW;
      const y0 = row * cellH;
      const x1 = (col + 1) * cellW;
      const y1 = (row + 1) * cellH;

      const northExposed = !playableAt(layout, col, row - 1);
      if (northExposed && y0 < yMid) {
        topSegments.push({
          x0,
          y0,
          x1,
          y1: y0,
          cellRow: row,
          cellCol: col,
        });
      }

      const westExposed = !playableAt(layout, col - 1, row);
      if (westExposed && y0 < yMid) {
        leftSegments.push({
          x0,
          y0,
          x1: x0,
          y1,
          cellRow: row,
          cellCol: col,
        });
      }

      const eastExposed = !playableAt(layout, col + 1, row);
      if (eastExposed && y0 < yMid) {
        rightSegments.push({
          x0: x1,
          y0,
          x1: x1,
          y1,
          cellRow: row,
          cellCol: col,
        });
      }

      if (northExposed && westExposed && y0 < yMid) {
        corners.push({
          role: 'outerCornerTL',
          x: x0,
          y: y0,
          cellRow: row,
          cellCol: col,
        });
      }
      if (northExposed && eastExposed && y0 < yMid) {
        corners.push({
          role: 'outerCornerTR',
          x: x1,
          y: y0,
          cellRow: row,
          cellCol: col,
        });
      }
    }
  }

  dedupeCorners(corners);

  mergeHorizontalRuns(topSegments);
  mergeVerticalRuns(leftSegments);
  mergeVerticalRuns(rightSegments);

  return {
    topSegments,
    leftSegments,
    rightSegments,
    corners,
    cellW,
    cellH,
    yMid,
  };
}

function mergeHorizontalRuns(segs) {
  segs.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const out = [];
  const eps = 0.5;
  for (const s of segs) {
    const prev = out[out.length - 1];
    if (
      prev &&
      Math.abs(prev.y0 - s.y0) < eps &&
      s.x0 <= prev.x1 + eps
    ) {
      prev.x1 = Math.max(prev.x1, s.x1);
    } else {
      out.push({ ...s });
    }
  }
  segs.length = 0;
  for (const s of out) segs.push(s);
}

function mergeVerticalRuns(segs) {
  segs.sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
  const out = [];
  const eps = 0.5;
  for (const s of segs) {
    const prev = out[out.length - 1];
    if (
      prev &&
      Math.abs(prev.x0 - s.x0) < eps &&
      s.y0 <= prev.y1 + eps
    ) {
      prev.y1 = Math.max(prev.y1, s.y1);
    } else {
      out.push({ ...s });
    }
  }
  segs.length = 0;
  for (const s of out) segs.push(s);
}

/**
 * Phase 2 — Layout targets for art placement (world px, macro span level).
 */
export function buildUpperCliffLayoutTargets(boundary) {
  if (!boundary) return [];
  const out = [];
  const eps = 0.5;
  for (const s of boundary.topSegments) {
    const len = s.x1 - s.x0;
    if (len > eps) {
      out.push({
        role: 'top',
        x: s.x0,
        y: s.y0,
        length: len,
        cellRow: s.cellRow,
        cellCol: s.cellCol,
        x1: s.x1,
        y1: s.y0,
      });
    }
  }
  for (const s of boundary.leftSegments) {
    const len = s.y1 - s.y0;
    if (len > eps) {
      out.push({
        role: 'left',
        x: s.x0,
        y: s.y0,
        length: len,
        cellRow: s.cellRow,
        cellCol: s.cellCol,
        x1: s.x0,
        y1: s.y1,
      });
    }
  }
  for (const s of boundary.rightSegments) {
    const len = s.y1 - s.y0;
    if (len > eps) {
      out.push({
        role: 'right',
        x: s.x0,
        y: s.y0,
        length: len,
        cellRow: s.cellRow,
        cellCol: s.cellCol,
        x1: s.x0,
        y1: s.y1,
      });
    }
  }
  for (const c of boundary.corners) {
    out.push({
      role: c.role,
      x: c.x,
      y: c.y,
      length: 0,
      cellRow: c.cellRow,
      cellCol: c.cellCol,
      x1: c.x,
      y1: c.y,
    });
  }
  return out;
}

function boundarySegmentsToRockPath(boundary, tileSize) {
  const pad = tileSize || 32;
  const segments = [];
  for (const s of boundary.topSegments) {
    const len = s.x1 - s.x0;
    if (len < 1) continue;
    let x0 = s.x0;
    let x1 = s.x1;
    if (UPPER_CLIFF_TOP_SPAN_LENGTH_SCALE !== 1) {
      const extra = (len * (UPPER_CLIFF_TOP_SPAN_LENGTH_SCALE - 1)) * 0.5;
      x0 -= extra;
      x1 += extra;
    }
    segments.push({ role: 'top', x0, y0: s.y0, x1, y1: s.y0 });
  }
  for (const s of boundary.leftSegments) {
    if (s.y1 - s.y0 < 1) continue;
    segments.push({ role: 'left', x0: s.x0, y0: s.y0, x1: s.x0, y1: s.y1 });
  }
  for (const s of boundary.rightSegments) {
    if (s.y1 - s.y0 < 1) continue;
    segments.push({ role: 'right', x0: s.x0, y0: s.y0, x1: s.x0, y1: s.y1 });
  }
  const corners = [];
  for (const c of boundary.corners) {
    let cx = c.x;
    let cy = c.y;
    if (c.role === 'outerCornerTL') {
      cx = c.x + pad;
      cy = c.y + pad;
    } else if (c.role === 'outerCornerTR') {
      cx = c.x - pad;
      cy = c.y + pad;
    }
    corners.push({
      role: c.role,
      cx,
      cy,
      tileKey: `macro-${c.cellCol},${c.cellRow}-${c.role}`,
    });
  }
  return { segments, corners };
}

function computeUpperCliffBoundsFromBoundary(world, boundary) {
  const xs = [];
  const ys = [];
  for (const s of boundary.topSegments) {
    xs.push(s.x0, s.x1);
    ys.push(s.y0);
  }
  for (const s of boundary.leftSegments) {
    xs.push(s.x0);
    ys.push(s.y0, s.y1);
  }
  for (const s of boundary.rightSegments) {
    xs.push(s.x0);
    ys.push(s.y0, s.y1);
  }
  if (!xs.length || !ys.length) return null;
  const minX = Math.max(0, Math.min(...xs));
  const maxX = Math.min(world.width, Math.max(...xs));
  const minY = Math.max(0, Math.min(...ys));
  const maxY = Math.min(world.height * 0.5, Math.max(...ys));
  const ts = worldTilePx(world);
  const w = Math.max(2 * ts, maxX - minX);
  const h = Math.max(3 * ts, maxY - minY);
  return { x: minX, y: minY, w, h };
}

/**
 * Same geometry as biome-upper-cliff-test: one tile inset on sides / below first row,
 * scaled with `world.tileSize` (test is fixed 32px).
 */
function makeCliffBoundsLikeUpperCliffTest(world, layout) {
  const { cellH } = macroCellSizePx(world, layout.cols, layout.rows);
  const inset = worldTilePx(world);
  return {
    x: inset,
    y: Math.max(0, cellH - upperPx(world, TOP_CLIFF_RAISE_PX)),
    w: world.width - 2 * inset,
    h: world.height - cellH - inset,
  };
}

/** Same as test `getPlayableGridXSpan` using `UPPER_CLIFF_TEST_ROW1_*` and layout `cellW`. */
function getPlayableGridXSpanLikeTest(world, layout) {
  const { cellW } = macroCellSizePx(world, layout.cols, layout.rows);
  const x0 = UPPER_CLIFF_TEST_ROW1_MIN_COL * cellW;
  const x1 = (UPPER_CLIFF_TEST_ROW1_MAX_COL + 1) * cellW;
  return { x0, x1 };
}

/** Port of test `cutTopBoundaryForVerticalPlayableConnection` (`cellW` + pad 48 at 32px tile). */
function cutTopBoundaryForVerticalPlayableConnection(placements, layout, world, col) {
  const { cellW } = macroCellSizePx(world, layout.cols, layout.rows);
  const cellLeft = col * cellW;
  const cellRight = (col + 1) * cellW;
  const pad = upperPx(world, 48);
  const cutLeft = cellLeft + pad;
  const cutRight = cellRight - pad;
  return placements.filter((p) => {
    const px0 = p.x;
    const px1 = p.x + p.sw;
    return px1 <= cutLeft || px0 >= cutRight;
  });
}

/** Horizontal overlap with any playable macro cell in rows 0–1 (cliff must not run over walkable floor). */
function topPieceOverlapsPlayableMacroPx(x0, x1, layout, world) {
  if (!layout?.cells?.length || !world) return false;
  const { cellW } = macroCellSizePx(world, layout.cols, layout.rows);
  const xl = Math.min(x0, x1);
  const xr = Math.max(x0, x1);
  for (const c of layout.cells) {
    if (!c.playable || c.row > 1) continue;
    const cl = c.col * cellW;
    const cr = (c.col + 1) * cellW;
    if (xr > cl && xl < cr) return true;
  }
  return false;
}

function pickDifferentRandomIdRow01(ids, prevId, rng) {
  if (!ids.length) return null;
  if (ids.length === 1) return ids[0] === prevId ? null : ids[0];
  let pick = ids[Math.floor(rng() * ids.length)];
  if (pick === prevId) {
    const alt = ids.filter((id) => id !== prevId);
    if (!alt.length) return null;
    pick = alt[Math.floor(rng() * alt.length)];
  }
  return pick;
}

/**
 * Flats vs slopes still random (`pSlope`); when a slope is chosen, id is `ROW01_SLOPE_PATTERN_656x3[slopeState.idx]`
 * then `slopeState.idx` advances (wrap 9).
 */
function pickNextRow01TopId(prevId, flatIds, byId, rng, slopeState) {
  if (rng() < 0.32) {
    const id = ROW01_SLOPE_PATTERN_656x3[slopeState.idx % ROW01_SLOPE_PATTERN_656x3.length];
    if (byId.get(id)) {
      slopeState.idx = (slopeState.idx + 1) % ROW01_SLOPE_PATTERN_656x3.length;
      return id;
    }
  }
  return pickDifferentRandomIdRow01(flatIds, prevId, rng) || flatIds[0];
}

/**
 * One non-overlapping top strip: `top_left` → flats/slopes with `computeTopPlacementsLocalLikeTest` snap Y,
 * then `top_right` when the next middle would overlap playable rows 0–1 or leave `[spanMinX, spanMaxX]`.
 */
function buildSequentialRow01TopStrip(world, spanMinX, spanMaxX, layout, seed, yAlign, options = {}) {
  const top = ROCK_BORDER_ATLAS.top || [];
  const topFlat = ROCK_BORDER_ATLAS.topFlat || [];
  const byId = new Map([...top, ...topFlat].map((sp) => [sp.id, sp]));
  const flatIds = (topFlat || []).map((s) => s.id).filter((id) => byId.has(id));
  const tl = byId.get('top_left');
  const tr = byId.get('top_right');
  if (!tl || !tr || !flatIds.length) return [];

  const spanW = spanMaxX - spanMinX;
  if (spanW < tl.w + tr.w - 0.5) return [];

  const cxOpt = options.firstTopLeftCenterWorldX;
  let anchorX =
    typeof cxOpt === 'number' && Number.isFinite(cxOpt) ? cxOpt - tl.w / 2 : spanMinX;
  anchorX = Math.max(spanMinX, Math.min(anchorX, spanMaxX - tl.w));

  const rng = mulberry32((seed ^ 0x5e77f019) >>> 0);
  const slopeState = { idx: 0 };
  /** @type {string[]} */
  let ids = ['top_left'];
  let guard = 0;
  while (ids[ids.length - 1] !== 'top_right' && guard++ < 600) {
    const plNow = chainToRockPlacementsLikeTest(computeTopPlacementsLocalLikeTest(ids), anchorX, yAlign);
    const edgeNow = plNow.length ? Math.max(...plNow.map((p) => p.x + p.sw)) : anchorX;
    if (edgeNow + tr.w > spanMaxX + 0.5) {
      ids.push('top_right');
      break;
    }
    const prevId = ids[ids.length - 1];
    const nextId = pickNextRow01TopId(prevId, flatIds, byId, rng, slopeState);
    const testIds = [...ids, nextId];
    const testPl = chainToRockPlacementsLikeTest(computeTopPlacementsLocalLikeTest(testIds), anchorX, yAlign);
    const last = testPl[testPl.length - 1];
    if (last.x + last.sw + tr.w > spanMaxX + 0.5) {
      ids.push('top_right');
      break;
    }
    if (topPieceOverlapsPlayableMacroPx(last.x, last.x + last.sw, layout, world)) {
      ids.push('top_right');
      break;
    }
    ids = testIds;
  }
  if (ids[ids.length - 1] !== 'top_right') ids.push('top_right');
  return chainToRockPlacementsLikeTest(computeTopPlacementsLocalLikeTest(ids), anchorX, yAlign);
}

/** Port of biome-upper-cliff-test `computeTopPlacementsLocal`. */
function computeTopPlacementsLocalLikeTest(sequenceIds) {
  const top = ROCK_BORDER_ATLAS.top || [];
  const topFlat = ROCK_BORDER_ATLAS.topFlat || [];
  const byId = new Map([...top, ...topFlat].map((sp) => [sp.id, sp]));
  const placements = [];
  let x = 0;
  for (const id of sequenceIds) {
    const sprite = byId.get(id);
    if (!sprite) continue;
    let y = 0;
    if (placements.length) {
      const prev = placements[placements.length - 1];
      const prevId = prev.sprite.id;
      const prevBottom = prev.y + prev.sprite.h;
      const nextIsFlat = TEST_STYLE_TOP_FLAT_IDS.has(sprite.id);
      const prevIsFlat = TEST_STYLE_TOP_FLAT_IDS.has(prevId);
      if (sprite.id === TEST_STYLE_TOP_SLOPE_DOWN_ID) y = prevBottom - sprite.h + 32;
      else if (prevId === TEST_STYLE_TOP_SLOPE_DOWN_ID) y = prevBottom - sprite.h + 32;
      else if (sprite.id === TEST_STYLE_TOP_SLOPE_UP_ID && prevIsFlat) y = prevBottom - sprite.h - 32;
      else if (prevId === TEST_STYLE_TOP_SLOPE_UP_ID && nextIsFlat) y = prevBottom - sprite.h;
      else if (prevId === TEST_STYLE_TOP_SLOPE_UP_ID && sprite.id === TEST_STYLE_TOP_SLOPE_UP_ID) {
        y = prevBottom - sprite.h - 32;
      } else y = prevBottom - sprite.h;
    }
    placements.push({ sprite, x, y });
    x += sprite.w;
  }
  const minY = placements.length ? Math.min(...placements.map((p) => p.y)) : 0;
  return { placements, width: x, minY };
}

/** Wing caps with fields required by `drawRockBorder` (incl. `pass: 0`). */
function chainToRockPlacementsLikeTest(chain, anchorX, yAlign) {
  return chain.placements.map((p) => {
    const sp = p.sprite;
    const px = Math.round(anchorX + p.x);
    const py = Math.round(yAlign + (p.y - chain.minY));
    return {
      role: sp.id,
      tileKey: null,
      pass: 0,
      spriteId: sp.id,
      sx: sp.x,
      sy: sp.y,
      sw: sp.w,
      sh: sp.h,
      x: px,
      y: py,
      contactX: px + Math.floor(sp.w * 0.5),
      contactY: py + Math.floor(sp.h * 0.5),
      anchorX: px + Math.floor(sp.w * 0.5),
      anchorY: py + Math.floor(sp.h * 0.5),
      effAnchorX: Math.floor(sp.w * 0.5),
      effAnchorY: Math.floor(sp.h * 0.5),
      depthHint: sp.depthHint || 0,
      jitterX: 0,
      jitterY: 0,
      lastAdvance: null,
    };
  });
}

/**
 * Vertical snap when placing a new piece to the **left** of `prev` (prev is immediately to the right).
 * Uses scaled ±32px-at-32px-tile offsets via `upperPx`.
 */
function snapYLeftwardPiece(world, prevId, prevBottom, currentId, spriteH) {
  const off32 = upperPx(world, 32);
  const isFlat = (id) => TEST_STYLE_TOP_FLAT_IDS.has(id);
  if (prevId === TEST_STYLE_TOP_SLOPE_UP_ID && currentId === TEST_STYLE_TOP_SLOPE_DOWN_ID) {
    return prevBottom - spriteH;
  }
  if (prevId === TEST_STYLE_TOP_SLOPE_UP_ID && currentId === TEST_STYLE_TOP_SLOPE_UP_ID) {
    return prevBottom - spriteH + off32;
  }
  if (isFlat(prevId)) {
    if (isFlat(currentId)) return prevBottom - spriteH;
    if (currentId === TEST_STYLE_TOP_SLOPE_DOWN_ID) return prevBottom - spriteH - off32;
    if (currentId === TEST_STYLE_TOP_SLOPE_UP_ID) return prevBottom - spriteH;
  }
  if (prevId === TEST_STYLE_TOP_SLOPE_DOWN_ID) {
    return prevBottom - spriteH - off32;
  }
  if (prevId === TEST_STYLE_TOP_SLOPE_UP_ID) {
    if (isFlat(currentId)) return prevBottom - spriteH + off32;
    if (currentId === TEST_STYLE_TOP_SLOPE_DOWN_ID) return prevBottom - spriteH;
  }
  return prevBottom - spriteH;
}

/**
 * Left → right vertical snap, same as `map-rock-border.js` / rock-border-atlas-debug `computeTopPlacements`
 * (32px steps scaled with `upperPx`).
 */
function snapYTopRightwardLikeAtlas(world, prevId, prevBottom, currentId, spriteH) {
  const off32 = upperPx(world, 32);
  if (prevId === TEST_STYLE_TOP_SLOPE_UP_ID && currentId === TEST_STYLE_TOP_SLOPE_UP_ID) {
    return prevBottom - spriteH - off32;
  }
  const nextIsFlat = TEST_STYLE_TOP_FLAT_IDS.has(currentId);
  const prevIsFlat = TEST_STYLE_TOP_FLAT_IDS.has(prevId);
  if (currentId === TEST_STYLE_TOP_SLOPE_DOWN_ID) return prevBottom - spriteH + off32;
  if (prevId === TEST_STYLE_TOP_SLOPE_DOWN_ID) return prevBottom - spriteH + off32;
  if (currentId === TEST_STYLE_TOP_SLOPE_UP_ID && prevIsFlat) return prevBottom - spriteH - off32;
  if (prevId === TEST_STYLE_TOP_SLOPE_UP_ID && nextIsFlat) return prevBottom - spriteH;
  return prevBottom - spriteH;
}

function makeRockPlacementFromSprite(sp, x, y) {
  const px = Math.round(x);
  const py = Math.round(y);
  return {
    role: sp.id,
    tileKey: null,
    pass: 0,
    spriteId: sp.id,
    sx: sp.x,
    sy: sp.y,
    sw: sp.w,
    sh: sp.h,
    x: px,
    y: py,
    contactX: px + Math.floor(sp.w * 0.5),
    contactY: py + Math.floor(sp.h * 0.5),
    anchorX: px + Math.floor(sp.w * 0.5),
    anchorY: py + Math.floor(sp.h * 0.5),
    effAnchorX: Math.floor(sp.w * 0.5),
    effAnchorY: Math.floor(sp.h * 0.5),
    depthHint: sp.depthHint || 0,
    jitterX: 0,
    jitterY: 0,
    lastAdvance: null,
  };
}

/**
 * Port of test `buildWingPlacements` — sequential top strip for one horizontal span (no chunk overlap).
 * @param {{ firstTopLeftCenterWorldX?: number }} [wingOpts]
 */
function buildWingPlacementsLikeTest(world, partLeft, partRight, cliffY, cliffH, seed, yAlign, layout, wingOpts = {}) {
  void cliffY;
  void cliffH;
  return buildSequentialRow01TopStrip(world, partLeft, partRight, layout, seed, yAlign, {
    firstTopLeftCenterWorldX: wingOpts.firstTopLeftCenterWorldX,
  });
}

/** Port of test `buildRow01BorderTriPart` (`playLeft`/`playRight` = row-1 middle band in world px). */
function buildRow01BorderTriPartLikeTest(world, cliffBounds, seed, playLeft, playRight, layout, islandSeedBase = 9001) {
  void cliffBounds;
  void playLeft;
  void playRight;
  void islandSeedBase;
  if (!world || !layout) return [];

  // Step 1 of rebuild:
  // - find row-0 playable cell
  // - column 0: no left anchor / leftward strip (would sit on world edge); still add right-edge pair below when col is not the last column
  // - col ≠ 0: bottom-left anchor + leftward chain to x <= 0
  // - non-terminal col: `top_left` + `top_flat` at cell bottom-right (+20px raise), then extend right with atlas snap
  const row0Col = findFirstRow0PlayableCol(layout);
  if (row0Col == null) return [];

  const { cellW, cellH } = macroCellSizePx(world, layout.cols, layout.rows);
  const cellLeft = row0Col * cellW;
  const cellBottom = cellH;
  const cornerRaisePx = upperPx(world, 20);

  const top = ROCK_BORDER_ATLAS.top || [];
  const topFlat = ROCK_BORDER_ATLAS.topFlat || [];
  const byId = new Map([...top, ...topFlat].map((sp) => [sp.id, sp]));
  const flatIds = (topFlat || []).map((s) => s.id).filter((id) => byId.has(id));
  const topRight = byId.get('top_right');
  const topLeft = byId.get('top_left');
  const flat = byId.get('top_flat_8') || topFlat[0];
  if (!flat || !flatIds.length) return [];

  /** @type {ReturnType<typeof makeRockPlacementFromSprite>[]} */
  const chain = [];

  if (row0Col !== 0) {
    if (!topRight) return [];
    const rightX = cellLeft;
    const rightY = cellBottom - cornerRaisePx;
    const flatX = rightX - flat.w;
    const flatY = rightY;
    chain.push(
      makeRockPlacementFromSprite(flat, flatX, flatY),
      makeRockPlacementFromSprite(topRight, rightX, rightY)
    );

    const rng = mulberry32((seed ^ (row0Col * 131)) >>> 0);
    const slopeState = { idx: 0 };
    let guard = 0;
    while (chain[0].x > 0 && guard++ < 600) {
      const prev = chain[0];
      const prevId = prev.spriteId;
      const prevBottom = prev.y + prev.sh;
      let nextId = pickNextRow01TopId(prevId, flatIds, byId, rng, slopeState);
      const sp = byId.get(nextId);
      if (!sp) break;
      const nx = prev.x - sp.w;
      const ny = snapYLeftwardPiece(world, prevId, prevBottom, nextId, sp.h);
      chain.unshift(makeRockPlacementFromSprite(sp, nx, ny));
    }
  }

  if (row0Col !== layout.cols - 1 && topLeft) {
    const cellRight = (row0Col + 1) * cellW;
    const tlx = cellRight - topLeft.w;
    const tly = cellBottom - cornerRaisePx;
    chain.push(makeRockPlacementFromSprite(topLeft, tlx, tly));
    const flatAfterTopLeft = byId.get('top_flat_9') || flat;
    if (flatAfterTopLeft) {
      chain.push(
        makeRockPlacementFromSprite(
          flatAfterTopLeft,
          tlx + topLeft.w,
          tly + topLeft.h - flatAfterTopLeft.h
        )
      );
    }

    let rightMost = chain[chain.length - 1];
    const rngRight = mulberry32((seed ^ 0xface ^ (row0Col * 17)) >>> 0);
    const slopeStateRight = { idx: 0 };
    let guardRight = 0;
    // Stop after 600 steps (no world-width cap).
    while (guardRight++ < 600) {
      const prevId = rightMost.spriteId;
      const prevBottom = rightMost.y + rightMost.sh;
      let nextId = pickNextRow01TopId(prevId, flatIds, byId, rngRight, slopeStateRight);
      const sp = byId.get(nextId);
      if (!sp) break;
      const nx = rightMost.x + rightMost.sw;
      const ny = snapYTopRightwardLikeAtlas(world, prevId, prevBottom, nextId, sp.h);
      const np = makeRockPlacementFromSprite(sp, nx, ny);
      chain.push(np);
      rightMost = np;
    }
  }

  return chain;
}

function buildTopRowIslandCliffs(world, layout, seedBase = 9001) {
  const out = [];
  const islandMaskJobs = [];
  /** Macro columns (row 0) with island cliff — ground clip uses island rects only, not full-cell top playables. */
  const row0IslandGroundMaskMacroCols = new Set();
  const { cellW, cellH } = macroCellSizePx(world, layout.cols, layout.rows);
  const inset = worldTilePx(world);
  const minInner = Math.max(2 * inset, upperPx(world, 64));
  for (const c of layout.cells) {
    if (!c.playable || c.row !== 0) continue;
    const x = c.col * cellW;
    const y = c.row * cellH;
    const w = cellW;
    const h = cellH;
    const islandBounds = {
      x: x + inset,
      y: y + inset,
      w: Math.max(minInner, w - 2 * inset),
      h: Math.max(minInner, h - 2 * inset),
    };
    const islandSeed = seedBase + c.col * 31 + c.row * 7;
    const rock = buildRockBorderFromBounds(islandBounds, islandSeed, ROCK_BORDER_ISLAND_TOP_BUILD_OPTIONS);
    if (UPPER_CLIFF_DEBUG_LOG_ONE_BORDER_BUILD && !upperCliffBorderBuildLogged) {
      upperCliffBorderBuildLogged = true;
      const placements = rock?.placements || [];
      console.log('[upper-cliff] buildRockBorderFromBounds sample', {
        cell: { row: c.row, col: c.col },
        bounds: islandBounds,
        seed: islandSeed,
        placementCount: placements.length,
        placementsPreview: placements.slice(0, 12).map((p) => ({
          id: p.spriteId,
          x: p.x,
          y: p.y,
          w: p.sw,
          h: p.sh,
        })),
      });
    }
    // Use every piece from the island border (outer corners, sides, etc.). The old preview-id filter
    // dropped most atlas ids; with row 0–1 strip removed that left empty `rockBorder` and no visible island.
    for (const p of rock?.placements || []) out.push(p);
    row0IslandGroundMaskMacroCols.add(c.col);
    islandMaskJobs.push({
      bounds: islandBounds,
      placements: rock?.placements || [],
    });
  }
  return { placements: out, islandMaskJobs, row0IslandGroundMaskMacroCols };
}

function mergePlacementsNoIslandOverlap(topPlacements, islandPlacements) {
  // Overlap culling disabled: keep all top strips and islands (draw order: tops then islands per pass).
  return [...(topPlacements || []), ...(islandPlacements || [])];
}

/** Remove stale upper-cliff collision rects before rebuilding. */
function stripUpperCliffCollisionFromTileWalls(world) {
  if (!world?.tileWallRects?.length) return;
  world.tileWallRects = world.tileWallRects.filter((w) => !w?._upperCliffRockCollision);
}

/**
 * Which cliff edge rules apply (corners combine two axes; `outer_*` mapped like atlas corners).
 * @returns {{ top: boolean, bottom: boolean, left: boolean, right: boolean }}
 */
function upperCliffCollisionCategories(spriteId) {
  const id = spriteId || '';
  if (id.startsWith('outer_tl')) return { top: true, bottom: false, left: true, right: false };
  if (id.startsWith('outer_tr')) return { top: true, bottom: false, left: false, right: true };
  if (id.startsWith('outer_bl')) return { top: false, bottom: true, left: true, right: false };
  if (id.startsWith('outer_br')) return { top: false, bottom: true, left: false, right: true };
  if (id === 'top_left') return { top: true, bottom: false, left: true, right: false };
  if (id === 'top_right') return { top: true, bottom: false, left: false, right: true };
  if (id === 'bottom_left') return { top: false, bottom: true, left: true, right: false };
  if (id === 'bottom_right') return { top: false, bottom: true, left: false, right: true };
  const z = { top: false, bottom: false, left: false, right: false };
  if (id.startsWith('top_')) z.top = true;
  else if (id.startsWith('bottom_')) z.bottom = true;
  if (id.startsWith('left_')) z.left = true;
  else if (id.startsWith('right_')) z.right = true;
  return z;
}

/** Main rock-border corners: use full placement bounds for collision (not half-edge insets). */
const UPPER_CLIFF_FULL_COLLISION_CORNER_IDS = new Set([
  'top_left',
  'top_right',
  'bottom_left',
  'bottom_right',
]);

/**
 * Axis-aligned collision from placement bounds + edge rules (half thickness on inward axis).
 */
function upperCliffPlacementCollisionRect(p) {
  const x = p.x ?? 0;
  const y = p.y ?? 0;
  const w = p.sw ?? 0;
  const h = p.sh ?? 0;
  if (w < 1 || h < 1) return null;
  if (UPPER_CLIFF_FULL_COLLISION_CORNER_IDS.has(p.spriteId || '')) {
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }
  const { top, bottom, left, right } = upperCliffCollisionCategories(p.spriteId);
  if (!top && !bottom && !left && !right) {
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }
  let xmin = x;
  let xmax = x + w;
  let ymin = y;
  let ymax = y + h;
  if (left) xmax = x + w / 2;
  if (right) xmin = x + w / 2;
  if (top) ymax = y + h / 2;
  if (bottom) {
    const hh = h / 2;
    ymin = y + (h - hh) / 2;
    ymax = ymin + hh;
  }
  const cw = Math.max(1, Math.round(xmax - xmin));
  const ch = Math.max(1, Math.round(ymax - ymin));
  return { x: Math.round(xmin), y: Math.round(ymin), w: cw, h: ch };
}

/**
 * One axis-aligned box per rock-border placement (world px). Wired into `tileWallRects` + `getWallCollisionRect`.
 */
function appendUpperCliffCollisionRects(world, placements) {
  if (!world) return;
  if (!Array.isArray(world.tileWallRects)) world.tileWallRects = [];
  stripUpperCliffCollisionFromTileWalls(world);
  for (const p of placements || []) {
    const r = upperCliffPlacementCollisionRect(p);
    if (!r) continue;
    world.tileWallRects.push({
      ...r,
      _upperCliffRockCollision: true,
    });
  }
}

function buildOccludeTilesFromPlacements(world, placements) {
  const set = new Set();
  const ts = world.tileSize || 32;
  for (const p of placements || []) {
    const gx0 = Math.floor(p.x / ts);
    const gy0 = Math.floor(p.y / ts);
    const gx1 = Math.floor((p.x + p.sw - 1) / ts);
    const gy1 = Math.floor((p.y + p.sh - 1) / ts);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        if (gx < 0 || gy < 0) continue;
        set.add(`${gx},${gy}`);
      }
    }
  }
  return set;
}

function drawPlaceholderTargets(ctx, ox, oy, camera, targets) {
  const vl = camera.position?.x ?? camera.x ?? 0;
  const vt = camera.position?.y ?? camera.y ?? 0;
  const vr = vl + camera.viewWidth;
  const vb = vt + camera.viewHeight;
  ctx.save();
  ctx.font = '10px system-ui,sans-serif';
  for (const t of targets) {
    if (t.x > vr + 200 || t.x + t.length < vl - 200) continue;
    if (t.role === 'top' && t.length > 0) {
      ctx.fillStyle = 'rgba(45, 35, 30, 0.85)';
      ctx.fillRect(ox + t.x, oy + t.y - 14, t.length, 18);
      ctx.strokeStyle = '#8b7355';
      ctx.strokeRect(ox + t.x, oy + t.y - 14, t.length, 18);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('top', ox + t.x + 2, oy + t.y - 16);
    } else if ((t.role === 'left' || t.role === 'right') && t.length > 0) {
      ctx.fillStyle =
        t.role === 'left' ? 'rgba(55, 48, 40, 0.88)' : 'rgba(48, 42, 55, 0.88)';
      const w = 16;
      ctx.fillRect(
        ox + (t.role === 'left' ? t.x - w : t.x),
        oy + t.y,
        w,
        t.length
      );
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(t.role[0], ox + t.x + (t.role === 'left' ? -w + 2 : 4), oy + t.y + 10);
    } else if (t.role?.startsWith('outerCorner')) {
      ctx.fillStyle = 'rgba(120, 60, 40, 0.95)';
      ctx.beginPath();
      ctx.arc(ox + t.x, oy + t.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText('C', ox + t.x - 4, oy + t.y + 3);
    }
  }
  ctx.restore();
}

function drawDebugBoundary(ctx, ox, oy, camera, boundary) {
  if (!boundary) return;
  const { topSegments, leftSegments, rightSegments, corners } = boundary;
  ctx.save();
  ctx.lineWidth = 2;
  for (const s of topSegments) {
    ctx.strokeStyle = 'cyan';
    ctx.beginPath();
    ctx.moveTo(ox + s.x0, oy + s.y0);
    ctx.lineTo(ox + s.x1, oy + s.y1);
    ctx.stroke();
  }
  for (const s of leftSegments) {
    ctx.strokeStyle = 'yellow';
    ctx.beginPath();
    ctx.moveTo(ox + s.x0, oy + s.y0);
    ctx.lineTo(ox + s.x1, oy + s.y1);
    ctx.stroke();
  }
  for (const s of rightSegments) {
    ctx.strokeStyle = 'orange';
    ctx.beginPath();
    ctx.moveTo(ox + s.x0, oy + s.y0);
    ctx.lineTo(ox + s.x1, oy + s.y1);
    ctx.stroke();
  }
  for (const c of corners) {
    ctx.fillStyle = 'magenta';
    ctx.fillRect(ox + c.x - 3, oy + c.y - 3, 6, 6);
  }
  ctx.restore();
}

function drawDebugTargets(ctx, ox, oy, camera, targets) {
  if (!targets?.length) return;
  ctx.save();
  ctx.font = '9px monospace';
  for (const t of targets) {
    ctx.strokeStyle = 'rgba(0,255,200,0.7)';
    ctx.strokeRect(ox + t.x - 1, oy + t.y - 1, Math.max(t.length, 4) + 2, 6);
    ctx.fillStyle = 'rgba(226,232,240,0.95)';
    ctx.fillText(`${t.role}`, ox + t.x, oy + t.y - 4);
  }
  ctx.restore();
}

/**
 * Phases 1–5: build all upper-cliff data and optional rock placements on world.upperCliff
 */
export function buildUpperCliffForBiomeWorld(world, seed, options = {}) {
  const ag = world?.archetypeGrid;
  const layout = buildPlayableMacroCellLayout(world, ag);
  if (!layout) {
    stripUpperCliffCollisionFromTileWalls(world);
    world.upperCliff = null;
    return null;
  }

  const boundary = computeUpperCliffExposedBoundary(world, layout);
  const layoutTargets = buildUpperCliffLayoutTargets(boundary);
  const useSprites = options.useSprites !== false;
  let rockBorder = null;
  let occludeTiles = null;
  /** @type {{ x: number, y: number, w: number, h: number }[]} */
  let groundClipRects = [];
  /** @type {{ x: number, y: number, w: number, h: number }[]} — row 0–1 per–top-sprite strip (sprite bottom → row 1 bottom); island-only clips are in `groundClipRects`. */
  let row01GroundMaskRects = [];
  /** @type {{ x: number, y: number, w: number, h: number }[]} */
  let midStripFillRects = [];
  /** @type {number[]} */
  let row0IslandGroundMaskMacroCols = [];
  if (useSprites) {
    const islandSeedBase = seed ^ 0x77ab;
    const cliffBounds = makeCliffBoundsLikeUpperCliffTest(world, layout);
    const { x0: playLeft, x1: playRight } = getPlayableGridXSpanLikeTest(world, layout);
    let topPlacements = buildRow01BorderTriPartLikeTest(
      world,
      cliffBounds,
      seed ^ 0x51f4c1,
      playLeft,
      playRight,
      layout,
      islandSeedBase
    );
    // Do not run `cutTopBoundaryForVerticalPlayableConnection` here while row 0–1 uses cell-corner
    // anchors: that cut keeps only pieces fully outside the column’s inner band, which removes
    // anything placed from the cell’s left edge (e.g. `top_right` at bottom-left corner).
    if (UPPER_CLIFF_DEBUG_ROW01_PIECE_LOG && topPlacements.length) {
      const row = [...topPlacements].sort((a, b) => a.x - b.x || a.y - b.y);
      console.log(
        `[upper-cliff] row 0–1 top strip: ${row.length} piece(s), left → right (world px)`
      );
      for (let i = 0; i < row.length; i++) {
        const p = row[i];
        const id = p.spriteId ?? p.role ?? '?';
        console.log(
          `  ${String(i + 1).padStart(2, ' ')}. ${id}  pos (${Math.round(p.x)}, ${Math.round(p.y)})  size ${Math.round(p.sw)}×${Math.round(p.sh)}`
        );
      }
    }
    const {
      placements: islandPlacements,
      islandMaskJobs,
      row0IslandGroundMaskMacroCols: islandMaskCols,
    } = buildTopRowIslandCliffs(world, layout, islandSeedBase);
    row0IslandGroundMaskMacroCols = Array.from(islandMaskCols);
    const placements = mergePlacementsNoIslandOverlap(topPlacements, islandPlacements);
    if (placements.length) {
      rockBorder = {
        image: world.assetRefs?.biomeRockBorder || null,
        placements,
        occludeTiles: null,
        debugPoints: [],
      };
      occludeTiles = buildOccludeTilesFromPlacements(world, placements);
      appendUpperCliffCollisionRects(world, placements);
    } else {
      stripUpperCliffCollisionFromTileWalls(world);
    }
    const maskPx = {
      row01MidDown: upperPx(world, UPPER_CLIFF_MASK_DESIGN_ROW01_MIDSTRIP_DOWN_PX),
      side5Offset: upperPx(world, UPPER_CLIFF_MASK_DESIGN_SIDE5_OFFSET_PX),
      columnTrim: upperPx(world, UPPER_CLIFF_MASK_DESIGN_SIDE5_COLUMN_TRIM_PX),
    };
    const row0BottomY = world.height / layout.rows;
    midStripFillRects = buildRow01BoundaryMidStripMaskRects(topPlacements, maskPx.row01MidDown);
    groundClipRects = buildIslandRow0GroundClipRects(islandMaskJobs, maskPx, row0BottomY);
    row01GroundMaskRects = [
      ...buildRow01TopSpriteBottomToRow1BottomClipRects(
        placements,
        world.height,
        layout.rows
      ),
      ...buildRow01PlayableBottomBridgeRects(world, layout),
    ];
  } else {
    stripUpperCliffCollisionFromTileWalls(world);
  }

  world.upperCliff = {
    enabled: true,
    playableLayout: layout,
    boundary,
    layoutTargets,
    groundClipRects,
    row01GroundMaskRects,
    midStripFillRects,
    row0IslandGroundMaskMacroCols,
    rockBorder,
    occludeTiles,
    visualMode: useSprites && rockBorder?.placements?.length ? 'sprites' : 'none',
    gameplayInsetPx: {
      top: UPPER_CLIFF_GAMEPLAY_INSET_TOP_PX,
      left: UPPER_CLIFF_GAMEPLAY_INSET_SIDE_PX,
      right: UPPER_CLIFF_GAMEPLAY_INSET_SIDE_PX,
    },
  };

  return world.upperCliff;
}

/**
 * Draw upper cliff: optional debug, placeholders, then rock sprites (pass 0 / 1).
 */
export function drawUpperCliffDecor(ctx, world, ox, oy, camera) {
  const uc = world?.upperCliff;
  if (!uc?.enabled) return;

  if (UPPER_CLIFF_DEBUG_BOUNDARY) {
    drawDebugBoundary(ctx, ox, oy, camera, uc.boundary);
  }
  if (UPPER_CLIFF_DEBUG_TARGETS) {
    drawDebugTargets(ctx, ox, oy, camera, uc.layoutTargets);
  }

  if (UPPER_CLIFF_PLACEHOLDER_VISUALS && uc.layoutTargets?.length) {
    drawPlaceholderTargets(ctx, ox, oy, camera, uc.layoutTargets);
  }

  if (uc.rockBorder?.placements?.length) {
    drawRockBorder(ctx, { rockBorder: uc.rockBorder }, ox, oy, camera, 0);
    drawRockBorder(ctx, { rockBorder: uc.rockBorder }, ox, oy, camera, 1);
  }
}

export function drawUpperCliffGroundCap(ctx, world, ox, oy) {
  // Ground strip removed by request.
}

export function shouldUseUpperCliffForMap(mapDef, world) {
  if (!mapDef || !world?.archetypeGrid?.grid) return false;
  if (mapDef.upperCliff === false) return false;
  if (mapDef.upperCliff === true) return true;
  return mapDef.floorPattern === 'grass';
}
