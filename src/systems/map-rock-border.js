import { createSeededRandom } from '../core/runtime-utils.js';
import { ROCK_BORDER_ATLAS } from '../data/terrain-rock-border-atlas.js';

const CLIFF_SPAN_MIN = 768;
const CLIFF_SPAN_MAX = 896;
const CLIFF_TOP_FLAT_IDS = new Set(['top_flat_8', 'top_flat_9']);
const CLIFF_TOP_SLOPE_DOWN_ID = 'top_5';
const CLIFF_TOP_SLOPE_UP_ID = 'top_6';

/** Pass to {@link buildRockBorderFromBounds} for row-0 island cliffs (no `top_5` on top run). */
export const ROCK_BORDER_ISLAND_TOP_BUILD_OPTIONS = { excludeTopIds: new Set([CLIFF_TOP_SLOPE_DOWN_ID]) };
const CLIFF_LEFT_SLOPE_ID = 'left_5';
const CLIFF_RIGHT_SLOPE_ID = 'right_5';
const CLIFF_LEFT_BOTTOM_IDS = ['bottom_4', 'bottom_5', 'bottom_6'];
const CLIFF_LEFT_BOTTOM_WEIGHT = { bottom_4: 3, bottom_5: 1, bottom_6: 3 };
const CLIFF_RIGHT_BOTTOM_IDS = ['bottom_9', 'bottom_10', 'bottom_11'];
const CLIFF_RIGHT_BOTTOM_WEIGHT = { bottom_9: 3, bottom_10: 1, bottom_11: 3 };
const CLIFF_BOTTOM_DROP_BY_ID = { bottom_5: 32, bottom_10: 32 };
// The visible entrance between `bottom_7` and `bottom_8` must comfortably fit the
// player's 36x36 body plus some steering room. The old 16px minimum routinely
// produced entrances that looked open but were awkward or impossible to traverse.
const CLIFF_BOTTOM_7_8_GAP_MIN = 128;
const CLIFF_BOTTOM_7_8_GAP_MAX = 224;
const CLIFF_BOTTOM_ENTRY_GAP_WITH_SIDE_SLOPES_MIN = 192;

function mulberry32(seed) {
  return createSeededRandom(seed);
}

function pickWeightedId(weightsById, rng) {
  const entries = Object.entries(weightsById).filter(([, w]) => Number.isFinite(w) && w > 0);
  if (!entries.length) return null;
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

function pickDifferentRandomId(ids, prevId, rng) {
  if (!ids.length) return null;
  if (ids.length === 1) return ids[0] === prevId ? null : ids[0];
  let pick = ids[Math.floor(rng() * ids.length)];
  if (pick === prevId) {
    const alternatives = ids.filter((id) => id !== prevId);
    if (!alternatives.length) return null;
    pick = alternatives[Math.floor(rng() * alternatives.length)];
  }
  return pick;
}

function pickDifferentWeightedId(weightsById, prevId, rng) {
  const filtered = {};
  for (const [id, w] of Object.entries(weightsById)) {
    if (id === prevId) continue;
    filtered[id] = w;
  }
  return pickWeightedId(filtered, rng) || pickWeightedId(weightsById, rng);
}

function topWidthFromMiddle(middleIds, byId) {
  const tl = byId.get('top_left');
  const tr = byId.get('top_right');
  if (!tl || !tr) return 0;
  let w = tl.w + tr.w;
  for (const id of middleIds) {
    const sp = byId.get(id);
    if (sp) w += sp.w;
  }
  return w;
}

/** Last tile before `top_right` must be a top flat (never `top_5`/`top_6`). */
function ensureMiddleBeforeTopRightEndsWithTopFlat(middleIds, flatIds, byId, rng) {
  const lastMid = middleIds[middleIds.length - 1];
  if (lastMid && CLIFF_TOP_FLAT_IDS.has(lastMid)) return;
  if (lastMid && !CLIFF_TOP_FLAT_IDS.has(lastMid)) middleIds.pop();
  let prevForPick = middleIds.length ? middleIds[middleIds.length - 1] : 'top_left';
  let fp = pickDifferentRandomId(flatIds, prevForPick, rng) || flatIds[0];
  while (
    middleIds.length > 0 &&
    topWidthFromMiddle([...middleIds, fp], byId) > CLIFF_SPAN_MAX
  ) {
    middleIds.pop();
    prevForPick = middleIds.length ? middleIds[middleIds.length - 1] : 'top_left';
    fp = pickDifferentRandomId(flatIds, prevForPick, rng) || flatIds[0];
  }
  middleIds.push(fp);
}

function computeTopPlacements(sequenceIds, byId) {
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
      const nextIsFlat = CLIFF_TOP_FLAT_IDS.has(sprite.id);
      const prevIsFlat = CLIFF_TOP_FLAT_IDS.has(prevId);
      if (sprite.id === CLIFF_TOP_SLOPE_DOWN_ID) y = prevBottom - sprite.h + 32;
      else if (prevId === CLIFF_TOP_SLOPE_DOWN_ID) y = prevBottom - sprite.h + 32;
      else if (sprite.id === CLIFF_TOP_SLOPE_UP_ID && prevIsFlat) y = prevBottom - sprite.h - 32;
      else if (prevId === CLIFF_TOP_SLOPE_UP_ID && nextIsFlat) y = prevBottom - sprite.h;
      else y = prevBottom - sprite.h;
    }
    placements.push({ sprite, x, y });
    x += sprite.w;
  }
  const minY = placements.length ? Math.min(...placements.map((p) => p.y)) : 0;
  const maxY = placements.length ? Math.max(...placements.map((p) => p.y + p.sprite.h)) : 0;
  return { placements, minY, maxY, width: x };
}

function buildCliffTopSequence(topSprites, topFlatSprites, rng, options = {}) {
  const excludeTopIds = options.excludeTopIds;
  const slopePool = [CLIFF_TOP_SLOPE_DOWN_ID, CLIFF_TOP_SLOPE_UP_ID].filter(
    (id) => !excludeTopIds?.has(id)
  );
  const byId = new Map([...topSprites, ...topFlatSprites].map((sp) => [sp.id, sp]));
  const flatIds = topFlatSprites.map((sp) => sp.id);
  if (!byId.get('top_left') || !byId.get('top_right') || !flatIds.length) {
    return computeTopPlacements(['top_left', 'top_right'], byId);
  }
  const middleIds = [];
  let prevId = 'top_left';
  const minFlatW = Math.min(...topFlatSprites.map((s) => s.w));
  while (topWidthFromMiddle(middleIds, byId) < CLIFF_SPAN_MIN && middleIds.length < 80) {
    if (middleIds.length > 0 && rng() < 0.35 && slopePool.length) {
      const slopePick = pickDifferentRandomId(slopePool, prevId, rng);
      if (slopePick) {
        middleIds.push(slopePick);
        prevId = slopePick;
      }
    }
    const flatPick = pickDifferentRandomId(flatIds, prevId, rng) || flatIds[0];
    middleIds.push(flatPick);
    prevId = flatPick;
  }
  while (topWidthFromMiddle(middleIds, byId) <= CLIFF_SPAN_MAX - minFlatW && rng() < 0.45) {
    if (rng() < 0.3 && slopePool.length) {
      const slopePick = pickDifferentRandomId(slopePool, prevId, rng);
      if (slopePick && topWidthFromMiddle([...middleIds, slopePick], byId) <= CLIFF_SPAN_MAX) {
        middleIds.push(slopePick);
        prevId = slopePick;
      }
    }
    const flatPick = pickDifferentRandomId(flatIds, prevId, rng) || flatIds[0];
    if (topWidthFromMiddle([...middleIds, flatPick], byId) > CLIFF_SPAN_MAX) break;
    middleIds.push(flatPick);
    prevId = flatPick;
  }
  while (topWidthFromMiddle(middleIds, byId) > CLIFF_SPAN_MAX && middleIds.length) {
    middleIds.pop();
  }
  ensureMiddleBeforeTopRightEndsWithTopFlat(middleIds, flatIds, byId, rng);
  return computeTopPlacements(['top_left', ...middleIds, 'top_right'], byId);
}

function sideStackHeight(sprites) {
  return sprites.reduce((s, sp) => s + sp.h, 0);
}

function isLeftFlatId(id) { return id.startsWith('left_flat_'); }
function isRightFlatId(id) { return id.startsWith('right_flat_'); }

function buildSideVerticalBySpan(flatSprites, slopeSprite, label, rng) {
  const sequence = [];
  if (!flatSprites.length) return { sequence };
  const flatIds = flatSprites.map((sp) => sp.id);
  const slopeId = slopeSprite ? slopeSprite.id : null;
  let prevId = null;
  const firstId = pickDifferentRandomId(flatIds, null, rng) || flatIds[0];
  sequence.push(flatSprites.find((s) => s.id === firstId) || flatSprites[0]);
  prevId = firstId;
  const minFlatH = Math.min(...flatSprites.map((s) => s.h));
  let slopePlaced = false;
  while (sideStackHeight(sequence) < CLIFF_SPAN_MIN && sequence.length < 80) {
    if (slopeId && !slopePlaced && rng() < 0.28) {
      sequence.push(slopeSprite);
      prevId = slopeId;
      slopePlaced = true;
    }
    const fid = pickDifferentRandomId(flatIds, prevId, rng) || flatIds[0];
    sequence.push(flatSprites.find((s) => s.id === fid) || flatSprites[0]);
    prevId = fid;
  }
  while (sideStackHeight(sequence) <= CLIFF_SPAN_MAX - minFlatH && rng() < 0.42 && sequence.length < 80) {
    if (slopeId && !slopePlaced && rng() < 0.25 && sideStackHeight([...sequence, slopeSprite]) <= CLIFF_SPAN_MAX) {
      sequence.push(slopeSprite);
      prevId = slopeId;
      slopePlaced = true;
      continue;
    }
    const fid = pickDifferentRandomId(flatIds, prevId, rng) || flatIds[0];
    const sp = flatSprites.find((s) => s.id === fid) || flatSprites[0];
    if (sideStackHeight([...sequence, sp]) > CLIFF_SPAN_MAX) break;
    sequence.push(sp);
    prevId = fid;
  }
  while (sideStackHeight(sequence) > CLIFF_SPAN_MAX && sequence.length > 2) {
    sequence.splice(sequence.length - 2, 1);
  }
  const last = sequence[sequence.length - 1];
  if (!last || !last.id.startsWith(`${label}_flat_`)) {
    const fid = pickDifferentRandomId(flatIds, last?.id ?? null, rng);
    sequence.push(flatSprites.find((s) => s.id === (fid || flatIds[0])) || flatSprites[0]);
  }
  return { sequence };
}

function buildCliffBottomSequence(bottomSprites, rng) {
  const byId = new Map(bottomSprites.map((sp) => [sp.id, sp]));
  const sequence = [];
  const pushId = (id) => { const sp = byId.get(id); if (sp) sequence.push(sp); };
  pushId('bottom_left');
  let prevLeft = 'bottom_left';
  const nLeft = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < nLeft; i++) {
    const pick = pickDifferentWeightedId(CLIFF_LEFT_BOTTOM_WEIGHT, prevLeft, rng) || CLIFF_LEFT_BOTTOM_IDS[0];
    pushId(pick);
    prevLeft = pick;
  }
  pushId('bottom_7');
  pushId('bottom_8');
  let prevRight = 'bottom_8';
  const nRight = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < nRight; i++) {
    const pick = pickDifferentWeightedId(CLIFF_RIGHT_BOTTOM_WEIGHT, prevRight, rng) || CLIFF_RIGHT_BOTTOM_IDS[0];
    pushId(pick);
    prevRight = pick;
  }
  pushId('bottom_right');
  return { sequence };
}

function makePlacement(sprite, x, y, role, pass) {
  const px = Math.round(x);
  const py = Math.round(y);
  return {
    role,
    tileKey: null,
    pass,
    spriteId: sprite.id,
    sx: sprite.x,
    sy: sprite.y,
    sw: sprite.w,
    sh: sprite.h,
    x: px,
    y: py,
    contactX: px + Math.floor(sprite.w * 0.5),
    contactY: py + Math.floor(sprite.h * 0.5),
    anchorX: px + Math.floor(sprite.w * 0.5),
    anchorY: py + Math.floor(sprite.h * 0.5),
    effAnchorX: Math.floor(sprite.w * 0.5),
    effAnchorY: Math.floor(sprite.h * 0.5),
    depthHint: sprite.depthHint || 0,
    jitterX: 0,
    jitterY: 0,
    lastAdvance: null,
  };
}

/**
 * @param {{ x: number, y: number, w: number, h: number }} bounds
 * @param {number} [seed]
 * @param {{ excludeTopIds?: Set<string> }} [options] — e.g. {@link ROCK_BORDER_ISLAND_TOP_BUILD_OPTIONS}
 */
function buildPreviewStyleRockBorder(bounds, seed = 1, options = {}) {
  const rng = mulberry32((seed ^ 0x53ad) >>> 0);
  const excludeTopIds = options.excludeTopIds;
  const topAll = ROCK_BORDER_ATLAS.top || [];
  const top =
    excludeTopIds?.size > 0 ? topAll.filter((sp) => !excludeTopIds.has(sp.id)) : topAll;
  const topFlat = ROCK_BORDER_ATLAS.topFlat || [];
  const bottom = ROCK_BORDER_ATLAS.bottom || [];
  const left = ROCK_BORDER_ATLAS.left || [];
  const right = ROCK_BORDER_ATLAS.right || [];
  const leftFlat = ROCK_BORDER_ATLAS.leftFlat || [];
  const rightFlat = ROCK_BORDER_ATLAS.rightFlat || [];
  const topLayout = buildCliffTopSequence(top, topFlat, rng, options);
  const tops = topLayout.placements;
  const leftSlope = left.find((sp) => sp.id === CLIFF_LEFT_SLOPE_ID) || null;
  const rightSlope = right.find((sp) => sp.id === CLIFF_RIGHT_SLOPE_ID) || null;
  const lefts = buildSideVerticalBySpan(leftFlat, leftSlope, 'left', rng).sequence;
  const rights = buildSideVerticalBySpan(rightFlat, rightSlope, 'right', rng).sequence;
  const bots = buildCliffBottomSequence(bottom, rng).sequence;
  if (!tops.length || !bots.length) {
    return { image: null, placements: [], occludeTiles: null, debugPoints: [] };
  }

  const Wtop = topLayout.width;
  const Htop = Math.max(0, topLayout.maxY - topLayout.minY);
  const topYOffset = -topLayout.minY;
  const Hbot = Math.max(...bots.map((s) => s.h));
  const HleftStack = sideStackHeight(lefts);
  const HrightStack = sideStackHeight(rights);
  const midH = Math.max(HleftStack, HrightStack, 32);
  const bottomBandY = Htop + midH;
  const hasLeftSlope = lefts.some((sp) => sp.id === CLIFF_LEFT_SLOPE_ID);
  const hasRightSlope = rights.some((sp) => sp.id === CLIFF_RIGHT_SLOPE_ID);
  // Keep the entrance between `bottom_7` and `bottom_8` player-safe. When both tall
  // side slopes are present, bias even wider because their collision and silhouette
  // visually pinch the doorway.
  const bottomGapMin =
    hasLeftSlope && hasRightSlope
      ? Math.max(CLIFF_BOTTOM_7_8_GAP_MIN, CLIFF_BOTTOM_ENTRY_GAP_WITH_SIDE_SLOPES_MIN)
      : CLIFF_BOTTOM_7_8_GAP_MIN;
  const bottom78Gap =
    bottomGapMin + Math.floor(rng() * (CLIFF_BOTTOM_7_8_GAP_MAX - bottomGapMin + 1));
  const topLeft = tops.find((p) => p.sprite.id === 'top_left');
  const topRight = tops.find((p) => p.sprite.id === 'top_right');
  const maxLW = lefts.length ? Math.max(...lefts.map((s) => s.w)) : 0;
  const maxRW = rights.length ? Math.max(...rights.map((s) => s.w)) : 0;
  const leftAnchorRightX = topLeft ? topLeft.x + topLeft.sprite.w : maxLW;
  const rightAnchorLeftX = topRight ? topRight.x : Wtop - maxRW;
  const leftAnchorBottomY = topLeft ? topLeft.y + topYOffset + topLeft.sprite.h : Htop;
  const rightAnchorBottomY = topRight ? topRight.y + topYOffset + topRight.sprite.h : Htop;

  const leftPlaced = [];
  const rightPlaced = [];
  const bottomPlaced = [];
  const topPlaced = [];

  let yL = leftAnchorBottomY;
  let xL = leftAnchorRightX - (lefts[0]?.w || 0);
  for (let i = 0; i < lefts.length; i++) {
    const sp = lefts[i];
    if (i === 0) xL = leftAnchorRightX - sp.w;
    else {
      const prev = lefts[i - 1];
      const prevRight = xL + prev.w;
      xL = prev.id === CLIFF_LEFT_SLOPE_ID ? prevRight - sp.w - 96 : prevRight - sp.w;
    }
    leftPlaced.push({ sprite: sp, x: xL, y: yL, pass: 2 });
    yL += sp.h;
  }

  let yR = rightAnchorBottomY;
  let xR = rightAnchorLeftX;
  for (let i = 0; i < rights.length; i++) {
    const sp = rights[i];
    if (i === 0) xR = rightAnchorLeftX;
    else if (rights[i - 1].id === CLIFF_RIGHT_SLOPE_ID) xR += 96;
    rightPlaced.push({ sprite: sp, x: xR, y: yR, pass: 3 });
    yR += sp.h;
  }

  let deltaLeft = 0;
  let deltaRight = 0;
  const blPre = bots.find((s) => s.id === 'bottom_left');
  const brPre = bots.find((s) => s.id === 'bottom_right');
  // Nudge each vertical side so its bottom flat meets the top edge of bottom_left / bottom_right.
  // Previously this only ran when HleftStack === HrightStack (random stacks are usually unequal),
  // which left most seeds with a vertical gap between side columns and bottom corner sprites.
  if (blPre) {
    const targetTop = bottomBandY + (Hbot - blPre.h);
    const lastLf = [...leftPlaced].reverse().find((p) => isLeftFlatId(p.sprite.id));
    if (lastLf) {
      deltaLeft = targetTop - (lastLf.y + lastLf.sprite.h);
      for (const p of leftPlaced) p.y += deltaLeft;
    }
  }
  if (brPre) {
    const targetTop = bottomBandY + (Hbot - brPre.h);
    const lastRf = [...rightPlaced].reverse().find((p) => isRightFlatId(p.sprite.id));
    if (lastRf) {
      deltaRight = targetTop - (lastRf.y + lastRf.sprite.h);
      for (const p of rightPlaced) p.y += deltaRight;
    }
  }

  const topShift = Math.max(0, deltaLeft, deltaRight);
  // Tops shift by topShift so the row stays tied to the side that needed the largest bottom nudge.
  // Left/right columns only used deltaLeft/deltaRight, so when those differ the first side flat no
  // longer meets top_left / top_right (left_flat can appear to sit above the corner). Re-sync Y.
  for (const p of leftPlaced) p.y += topShift - deltaLeft;
  for (const p of rightPlaced) p.y += topShift - deltaRight;
  const bottomFixLeft = topShift - deltaLeft;
  const bottomFixRight = topShift - deltaRight;

  for (const p of tops) topPlaced.push({ sprite: p.sprite, x: p.x, y: p.y + topYOffset + topShift, pass: 4 });

  const lastLeftFlat = [...leftPlaced].reverse().find((p) => isLeftFlatId(p.sprite.id));
  const lastRightFlat = [...rightPlaced].reverse().find((p) => isRightFlatId(p.sprite.id));
  const bottomLeftSprite = bots.find((s) => s.id === 'bottom_left');
  const bottomRightSprite = bots.find((s) => s.id === 'bottom_right');
  let bottomLeftX = 0;
  if (lastLeftFlat && bottomLeftSprite) bottomLeftX = lastLeftFlat.x + lastLeftFlat.sprite.w + 32 - bottomLeftSprite.w;
  let bottomRightX = 0;
  if (lastRightFlat && bottomRightSprite) bottomRightX = lastRightFlat.x - 32;

  const idx8 = bots.findIndex((s) => s.id === 'bottom_8');
  const leftBottomSeg = idx8 >= 0 ? bots.slice(0, idx8) : bots;
  const rightBottomSeg = idx8 >= 0 ? bots.slice(idx8) : [];
  let curX = bottomLeftX;
  for (const sp of leftBottomSeg) {
    const y0 = bottomBandY + (Hbot - sp.h) + (CLIFF_BOTTOM_DROP_BY_ID[sp.id] || 0) + bottomFixLeft;
    bottomPlaced.push({ sprite: sp, x: curX, y: y0, pass: 1 });
    curX += sp.w;
    if (sp.id === 'bottom_7') curX += bottom78Gap;
  }
  if (rightBottomSeg.length && bottomRightSprite) {
    let rightEdge = bottomRightX + bottomRightSprite.w;
    for (let i = rightBottomSeg.length - 1; i >= 0; i--) {
      const sp = rightBottomSeg[i];
      rightEdge -= sp.w;
      const y0 = bottomBandY + (Hbot - sp.h) + (CLIFF_BOTTOM_DROP_BY_ID[sp.id] || 0) + bottomFixRight;
      bottomPlaced.push({ sprite: sp, x: rightEdge, y: y0, pass: 1 });
    }
  }

  const draws = [...bottomPlaced, ...leftPlaced, ...rightPlaced, ...topPlaced];
  draws.sort((a, b) => (a.pass === b.pass ? (a.pass === 1 ? a.x - b.x : 0) : a.pass - b.pass));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of draws) {
    minX = Math.min(minX, d.x);
    minY = Math.min(minY, d.y);
    maxX = Math.max(maxX, d.x + d.sprite.w);
    maxY = Math.max(maxY, d.y + d.sprite.h);
  }
  const localW = Math.max(1, maxX - minX);
  const localH = Math.max(1, maxY - minY);
  // World uses the same authored X/Y spacing as the preview (scale fixed at 1).
  // Center within bounds; do not downscale — that compressed positions while sprites
  // stayed native size and broke adjacency. Overflow may extend past bounds for small rectangles.
  const scale = 1;
  const offX = bounds.x + (bounds.w - localW) * 0.5;
  const offY = bounds.y + (bounds.h - localH) * 0.02;

  const placements = [];
  const debugPoints = [];
  for (const d of draws) {
    const p = makePlacement(d.sprite, offX + (d.x - minX) * scale, offY + (d.y - minY) * scale, d.sprite.id, 0);
    placements.push(p);
    debugPoints.push({
      role: d.sprite.id,
      anchorX: p.contactX,
      anchorY: p.contactY,
      drawX: p.x,
      drawY: p.y,
      bboxX: p.x,
      bboxY: p.y,
      bboxW: p.sw,
      bboxH: p.sh,
      lastAdvance: null,
      effAnchorX: p.effAnchorX,
      effAnchorY: p.effAnchorY,
    });
  }
  return { image: null, placements, occludeTiles: null, debugPoints };
}

/**
 * @param {{ x: number, y: number, w: number, h: number }} bounds
 * @param {number} [seed]
 * @param {{ excludeTopIds?: Set<string> }} [options]
 */
export function buildRockBorderFromBounds(bounds, seed = 1, options) {
  if (!bounds) return null;
  return buildPreviewStyleRockBorder(bounds, seed, options);
}

export function buildRockBorderPlacements(world, seed = 1) {
  if (!world) return null;
  const t = world.wallThickness || world.tileSize || 32;
  const bounds = {
    x: t,
    y: t,
    w: Math.max(1, world.width - t * 2),
    h: Math.max(1, world.height - t * 2),
  };
  world.rockBorder = buildPreviewStyleRockBorder(bounds, seed);
  return world.rockBorder;
}

export function drawRockBorder(ctx, world, ox, oy, camera, pass = null) {
  const data = world?.rockBorder;
  if (!data?.placements?.length) return;
  const image = data.image;
  if (!image?.complete || image.naturalWidth <= 0) return;
  const viewLeft = camera.position?.x ?? camera.x ?? 0;
  const viewTop = camera.position?.y ?? camera.y ?? 0;
  const viewRight = viewLeft + camera.viewWidth;
  const viewBottom = viewTop + camera.viewHeight;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const placement of data.placements) {
    if (pass != null && placement.pass !== pass) continue;
    const px = placement.x;
    const py = placement.y;
    if (px + placement.sw < viewLeft || px > viewRight || py + placement.sh < viewTop || py > viewBottom) continue;
    ctx.drawImage(
      image,
      placement.sx, placement.sy, placement.sw, placement.sh,
      Math.round(px + ox), Math.round(py + oy), placement.sw, placement.sh
    );
  }
  ctx.imageSmoothingEnabled = true;
  ctx.restore();
}

export function shouldUseRockBorderForMap(mapDef) {
  if (!mapDef) return false;
  if (mapDef.rockBorder === false) return false;
  if (mapDef.rockBorder === true) return true;
  return mapDef.floorPattern === 'grass';
}
