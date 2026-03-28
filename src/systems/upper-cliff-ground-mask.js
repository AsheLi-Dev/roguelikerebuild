/**
 * Upper-cliff **ground visibility** mask rectangles (world px), shared by the game and biome-upper-cliff-test.
 * Union of these rects is clipped so floor/ground draws only where intended under the cliff art.
 */

/** Top sprites on row 0–1 strip and island tops (same as debug test `TOP_PREVIEW_IDS`). */
export const UPPER_CLIFF_MASK_TOP_PREVIEW_IDS = new Set([
  'top_left',
  'top_right',
  'top_5',
  'top_6',
  'top_flat_8',
  'top_flat_9',
]);

export const UPPER_CLIFF_MASK_ISLAND_TOP_IDS = new Set([
  'top_left',
  'top_right',
  'top_5',
  'top_6',
  'top_flat_8',
  'top_flat_9',
]);

/** Design-time defaults @ 32px tile; scale with `upperPx(world, n)` in biome-upper-cliff. */
export const UPPER_CLIFF_MASK_DESIGN_SIDE5_OFFSET_PX = 64;
export const UPPER_CLIFF_MASK_DESIGN_SIDE5_COLUMN_TRIM_PX = 16;
export const UPPER_CLIFF_MASK_DESIGN_ROW01_MIDSTRIP_DOWN_PX = 320;
/** Solid fill for row 0–1 mid-strip (drawn under tiles; not part of ground clip). */
export const UPPER_CLIFF_MID_STRIP_FILL_HEX = '#6f7559';

function placementCenterX(p) {
  return p.x + p.sw * 0.5;
}

function placementCenterY(p) {
  return p.y + p.sh * 0.5;
}

function placementLeftEdgeMidY(p) {
  return p.y + p.sh * 0.5;
}

/** Intersect `rect` with the horizontal band y ∈ [y0, y1). Returns null if empty. */
export function intersectRectWithHorizontalBandY(rect, y0, y1) {
  if (!rect || rect.w <= 0 || rect.h <= 0) return null;
  const yA = Math.max(rect.y, y0);
  const yB = Math.min(rect.y + rect.h, y1);
  if (yB <= yA) return null;
  return { x: rect.x, y: yA, w: rect.w, h: yB - yA };
}

/** Top edge `y` of bottom cliff sprites overlapping `[bx, br)`; excludes `bottom_left` / `bottom_right`. */
export function bottomCliffTopEdgeY(placements, bx, br) {
  let minY = null;
  for (const p of placements) {
    const id = p.spriteId;
    if (!id || !id.startsWith('bottom')) continue;
    if (id === 'bottom_left' || id === 'bottom_right') continue;
    if (p.x + p.sw <= bx || p.x >= br) continue;
    if (minY == null || p.y < minY) minY = p.y;
  }
  return minY;
}

/** Bottom edge `y` (`y + sh`) of bottom cliff sprites overlapping `[bx, br)`; excludes `bottom_left` / `bottom_right`. */
export function bottomCliffBottomEdgeY(placements, bx, br) {
  let maxY = null;
  for (const p of placements) {
    const id = p.spriteId;
    if (!id || !id.startsWith('bottom')) continue;
    if (id === 'bottom_left' || id === 'bottom_right') continue;
    if (p.x + p.sw <= bx || p.x >= br) continue;
    const yb = p.y + p.sh;
    if (maxY == null || yb > maxY) maxY = yb;
  }
  return maxY;
}

function pushSide5BottomToBottomCliffMask(rects, side5, yBottomCliffBottom, side, columnTrimPx) {
  if (!side5 || yBottomCliffBottom == null) return;
  const t = columnTrimPx;
  let x;
  let w;
  if (side === 'left') {
    x = side5.x + t;
    w = side5.sw - t;
  } else {
    x = side5.x;
    w = side5.sw - t;
  }
  if (w <= 0) return;
  const yTop = side5.y + side5.sh;
  if (yBottomCliffBottom <= yTop) return;
  rects.push({
    x,
    y: yTop,
    w,
    h: yBottomCliffBottom - yTop,
  });
}

function pushSide5TopEdgeCapMasks(rects, left5, right5, spanPx) {
  if (left5) {
    rects.push({
      x: left5.x + left5.sw - spanPx,
      y: left5.y,
      w: spanPx,
      h: left5.sh,
    });
  }
  if (right5) {
    rects.push({
      x: right5.x,
      y: right5.y,
      w: spanPx,
      h: right5.sh,
    });
  }
}

/**
 * Row 0–1 boundary: for each top cliff sprite, rect from vertical mid (L/R edge midline) down `downPx`.
 */
export function buildRow01BoundaryMidStripMaskRects(
  placements,
  downPx,
  topIds = UPPER_CLIFF_MASK_TOP_PREVIEW_IDS
) {
  const rects = [];
  for (const p of placements) {
    if (!topIds.has(p.spriteId)) continue;
    rects.push({
      x: p.x,
      y: placementCenterY(p),
      w: p.sw,
      h: downPx,
    });
  }
  return rects;
}

/**
 * Row 0–1 boundary: for each top cliff sprite, rect from sprite bottom to macro row-1 bottom (`y = 2 * cellH`).
 * Unioned into ground clip so floor tiles draw under the cliff through the bottom of row 1.
 *
 * @param {Array<{ x: number, y: number, sw: number, sh: number, spriteId?: string }>} placements
 * @param {number} worldHeight
 * @param {number} layoutRows — macro row count (e.g. 4)
 * @param {Set<string>} [topIds]
 */
export function buildRow01TopSpriteBottomToRow1BottomClipRects(
  placements,
  worldHeight,
  layoutRows,
  topIds = UPPER_CLIFF_MASK_TOP_PREVIEW_IDS
) {
  if (!layoutRows || layoutRows <= 0) return [];
  const cellH = worldHeight / layoutRows;
  const row1BottomY = 2 * cellH;
  const rects = [];
  for (const p of placements) {
    if (!topIds.has(p.spriteId)) continue;
    const y0 = p.y + p.sh;
    if (y0 >= row1BottomY) continue;
    rects.push({
      x: p.x,
      y: y0,
      w: p.sw,
      h: row1BottomY - y0,
    });
  }
  return rects;
}

/**
 * Row-0 **island** mask: per–top-sprite columns (sprite bottom → bottom-cliff bottom) + anchor slabs + side-5
 * columns + caps. `offsetPx` / `columnTrimPx` should be world-scaled (e.g. via `upperPx(world, design)`).
 */
export function buildIslandRow0UpperMaskRects(placements, islandBounds, options = {}) {
  const offsetPx = options.offsetPx ?? UPPER_CLIFF_MASK_DESIGN_SIDE5_OFFSET_PX;
  const columnTrimPx = options.columnTrimPx ?? UPPER_CLIFF_MASK_DESIGN_SIDE5_COLUMN_TRIM_PX;

  const tops = placements
    .filter((p) => UPPER_CLIFF_MASK_ISLAND_TOP_IDS.has(p.spriteId))
    .sort((a, b) => a.x - b.x);
  const slopes = tops.filter((p) => p.spriteId === 'top_5' || p.spriteId === 'top_6').sort((a, b) => a.x - b.x);
  const topLeft = tops.find((p) => p.spriteId === 'top_left');
  const topRight = tops.find((p) => p.spriteId === 'top_right');

  const bx = islandBounds.x;
  const br = islandBounds.x + islandBounds.w;
  const xLeftStart = topLeft
    ? placementCenterX(topLeft)
    : tops.length
      ? Math.min(...tops.map((p) => p.x))
      : bx;
  const topRightCenterX = topRight
    ? placementCenterX(topRight)
    : tops.length
      ? Math.max(...tops.map((p) => p.x + p.sw))
      : br;

  /** @type {{ x: number, y: number, kind: string }[]} */
  const anchorPoints = [];
  if (topLeft) {
    anchorPoints.push({
      x: placementCenterX(topLeft),
      y: placementCenterY(topLeft),
      kind: 'top_left_center',
    });
  }
  for (let si = 1; si < slopes.length; si++) {
    const s = slopes[si];
    anchorPoints.push({
      x: s.x,
      y: placementLeftEdgeMidY(s),
      kind: 'slope_left_edge_mid',
    });
  }
  if (!anchorPoints.length && tops.length) {
    const y0 = Math.min(...tops.map((p) => p.y));
    anchorPoints.push({ x: xLeftStart, y: y0, kind: 'fallback_min_top_y' });
  }

  const left5 = placements.find((p) => p.spriteId === 'left_5');
  const right5 = placements.find((p) => p.spriteId === 'right_5');
  if (!left5 && !right5) {
    return {
      rects: [],
      yHoriz: null,
      yMaskBottom: null,
      lineX0: null,
      lineX1: null,
      anchorPoints,
      debug: 'no left_5/right_5',
    };
  }

  const leftHigher = left5 && (!right5 || left5.y <= right5.y);
  let yHoriz;
  let lineX0;
  let lineX1;
  if (leftHigher && left5) {
    yHoriz = left5.y;
    const xAnchor = left5.x + left5.sw - offsetPx;
    const xTouchOpposite = right5 ? right5.x : br;
    lineX0 = Math.min(xAnchor, xTouchOpposite);
    lineX1 = Math.max(xAnchor, xTouchOpposite);
  } else if (right5) {
    yHoriz = right5.y;
    const xAnchor = right5.x + offsetPx;
    const xTouchOpposite = left5 ? left5.x + left5.sw : bx;
    lineX0 = Math.min(xAnchor, xTouchOpposite);
    lineX1 = Math.max(xAnchor, xTouchOpposite);
  } else {
    return {
      rects: [],
      yHoriz: null,
      yMaskBottom: null,
      lineX0: null,
      lineX1: null,
      anchorPoints,
      debug: 'no side5',
    };
  }

  const yBottomCliffBottom = bottomCliffBottomEdgeY(placements, bx, br);
  const yMaskBottom =
    yBottomCliffBottom != null ? Math.max(yHoriz, yBottomCliffBottom) : yHoriz;

  /** @type {{ x: number, y: number, w: number, h: number }[]} */
  const rects = [];
  if (yBottomCliffBottom != null) {
    for (const p of tops) {
      const yTop = p.y + p.sh;
      if (yBottomCliffBottom <= yTop) continue;
      rects.push({
        x: p.x,
        y: yTop,
        w: p.sw,
        h: yBottomCliffBottom - yTop,
      });
    }
  }

  let prevEndX = null;
  const nAnch = anchorPoints.length;
  for (let i = 0; i < nAnch; i++) {
    const a = anchorPoints[i];
    const x1 = i + 1 < nAnch ? anchorPoints[i + 1].x : topRightCenterX;
    const x0 = prevEndX == null ? a.x : prevEndX;
    if (x1 <= x0 || yMaskBottom <= a.y) {
      prevEndX = x1;
      continue;
    }
    rects.push({
      x: x0,
      y: a.y,
      w: x1 - x0,
      h: yMaskBottom - a.y,
    });
    prevEndX = x1;
  }

  pushSide5BottomToBottomCliffMask(rects, left5, yBottomCliffBottom, 'left', columnTrimPx);
  pushSide5BottomToBottomCliffMask(rects, right5, yBottomCliffBottom, 'right', columnTrimPx);
  pushSide5TopEdgeCapMasks(rects, left5, right5, offsetPx);

  return {
    rects,
    yHoriz,
    yMaskBottom,
    lineX0,
    lineX1,
    anchorPoints,
    debug: `island mask ${rects.length} rect(s)`,
  };
}

/**
 * Ground **clip** rects for row-0 islands only: each rect is clamped to macro row 0 (y ∈ [0, row0BottomY)).
 * Row 0–1 mid-strip is not included — use {@link buildRow01BoundaryMidStripMaskRects} for solid underlay fills.
 */
export function buildIslandRow0GroundClipRects(islandMaskJobs, px, row0BottomY) {
  const offsetPx = px.side5Offset;
  const columnTrimPx = px.columnTrim;
  const y0 = 0;
  const y1 = row0BottomY;

  const out = [];
  for (const job of islandMaskJobs || []) {
    const m = buildIslandRow0UpperMaskRects(job.placements, job.bounds, {
      offsetPx,
      columnTrimPx,
    });
    for (const r of m.rects) {
      const c = intersectRectWithHorizontalBandY(r, y0, y1);
      if (c) out.push(c);
    }
  }

  return out;
}
