import { circleHitsRect, clamp } from "../core/runtime-utils.js";

const DEFAULT_ALPHA_THRESHOLD = 16;
const DEFAULT_LOWER_HALF_START = 0.5;
const DEFAULT_ANCHOR_X = 0.5;
const DEFAULT_ANCHOR_Y = 0.7;
const DEFAULT_ENEMY_MOVEMENT_COLLIDER_RADIUS_SCALE = 0.86;
const DEFAULT_ENEMY_SEPARATION_RADIUS_SCALE = 0.65;
const SOURCE_CACHE = new WeakMap();
let SCRATCH_CANVAS = null;
let SCRATCH_CONTEXT = null;

function getScratchContext(width, height) {
  if (typeof document === "undefined") return null;
  if (!SCRATCH_CANVAS) {
    SCRATCH_CANVAS = document.createElement("canvas");
    SCRATCH_CONTEXT = SCRATCH_CANVAS.getContext("2d", { willReadFrequently: true });
  }
  if (!SCRATCH_CONTEXT) return null;
  SCRATCH_CANVAS.width = Math.max(1, width);
  SCRATCH_CANVAS.height = Math.max(1, height);
  SCRATCH_CONTEXT.clearRect(0, 0, SCRATCH_CANVAS.width, SCRATCH_CANVAS.height);
  return SCRATCH_CONTEXT;
}

function median(values, fallback = 0) {
  if (!Array.isArray(values) || !values.length) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length * 0.5);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) * 0.5;
}

function buildFallbackSource(def) {
  const baseDrawSize = Math.max(1, Number(def?.drawSize) || Number(def?.size) || 1);
  const baseBodySize = Math.max(1, Number(def?.size) || baseDrawSize);
  const fallbackRadius = Math.max(6, baseBodySize * 0.24);
  const centerX = baseBodySize * 0.5;
  const centerY = baseBodySize * 0.72;
  return {
    centerXRatio: (centerX + (baseDrawSize - baseBodySize) * DEFAULT_ANCHOR_X) / baseDrawSize,
    centerYRatio: (centerY + (baseDrawSize - baseBodySize) * DEFAULT_ANCHOR_Y) / baseDrawSize,
    radiusXRatio: fallbackRadius / baseDrawSize,
    radiusYRatio: fallbackRadius / baseDrawSize,
    baselineYRatio: (centerY + fallbackRadius + (baseDrawSize - baseBodySize) * DEFAULT_ANCHOR_Y) / baseDrawSize,
    baseDrawSize,
    derivedFromSprite: false
  };
}

function getPrimarySheet(def) {
  if (def?.sprite?.move) return def.sprite.move;
  if (def?.sprite?.idle) return def.sprite.idle;
  return null;
}

function getSheetRows(def) {
  return Array.isArray(def?.rowOrder) && def.rowOrder.length ? def.rowOrder.length : 1;
}

function extractFrameMetrics(image, frameWidth, frameHeight, sx, sy) {
  const context = getScratchContext(frameWidth, frameHeight);
  if (!context) return null;
  context.drawImage(image, sx, sy, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
  const imageData = context.getImageData(0, 0, frameWidth, frameHeight);
  const data = imageData.data;

  let minX = frameWidth;
  let maxX = -1;
  let minY = frameHeight;
  let maxY = -1;

  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const alpha = data[(y * frameWidth + x) * 4 + 3];
      if (alpha < DEFAULT_ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const visibleHeight = maxY - minY + 1;
  const lowerStartY = clamp(Math.floor(minY + visibleHeight * DEFAULT_LOWER_HALF_START), minY, maxY);
  let lowerMinX = frameWidth;
  let lowerMaxX = -1;
  let lowerMinY = frameHeight;
  let lowerMaxY = -1;

  for (let y = lowerStartY; y <= maxY; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const alpha = data[(y * frameWidth + x) * 4 + 3];
      if (alpha < DEFAULT_ALPHA_THRESHOLD) continue;
      if (x < lowerMinX) lowerMinX = x;
      if (x > lowerMaxX) lowerMaxX = x;
      if (y < lowerMinY) lowerMinY = y;
      if (y > lowerMaxY) lowerMaxY = y;
    }
  }

  if (lowerMaxX < lowerMinX || lowerMaxY < lowerMinY) {
    lowerMinX = minX;
    lowerMaxX = maxX;
    lowerMinY = lowerStartY;
    lowerMaxY = maxY;
  }

  const lowerWidth = lowerMaxX - lowerMinX + 1;
  const lowerHeight = lowerMaxY - lowerMinY + 1;
  const centerX = lowerMinX + lowerWidth * 0.5;
  const centerY = (lowerMaxY + 1) - Math.max(lowerWidth, lowerHeight) * 0.5;
  const radius = Math.max(lowerWidth * 0.5, lowerHeight * 0.5);

  return {
    centerXRatio: centerX / Math.max(1, frameWidth),
    centerYRatio: centerY / Math.max(1, frameHeight),
    radiusXRatio: radius / Math.max(1, frameWidth),
    radiusYRatio: radius / Math.max(1, frameHeight),
    baselineYRatio: (lowerMaxY + 1) / Math.max(1, frameHeight)
  };
}

function deriveSourceFromSprite(def, assets) {
  const sheet = getPrimarySheet(def);
  const image = sheet?.asset ? assets?.[sheet.asset] : null;
  if (!sheet || !image) return null;

  const rows = getSheetRows(def);
  const frames = Math.max(1, Number(sheet.frames) || 1);
  const frameWidth = Math.max(1, Math.floor((image.naturalWidth || image.width || 1) / frames));
  const frameHeight = Math.max(1, Math.floor((image.naturalHeight || image.height || 1) / rows));
  const metrics = [];

  for (let row = 0; row < rows; row += 1) {
    for (let frame = 0; frame < frames; frame += 1) {
      const frameMetrics = extractFrameMetrics(image, frameWidth, frameHeight, frame * frameWidth, row * frameHeight);
      if (frameMetrics) metrics.push(frameMetrics);
    }
  }

  if (!metrics.length) return null;

  const baseDrawSize = Math.max(1, Number(def?.drawSize) || Number(def?.size) || frameWidth);
  return {
    centerXRatio: median(metrics.map((entry) => entry.centerXRatio), 0.5),
    centerYRatio: median(metrics.map((entry) => entry.centerYRatio), 0.72),
    radiusXRatio: median(metrics.map((entry) => entry.radiusXRatio), 0.18),
    radiusYRatio: median(metrics.map((entry) => entry.radiusYRatio), 0.18),
    baselineYRatio: median(metrics.map((entry) => entry.baselineYRatio), 0.92),
    baseDrawSize,
    derivedFromSprite: true
  };
}

function mergeOverrides(source, def) {
  const override = def?.movementCollider || null;
  if (override && typeof override === "object") {
    return {
      ...source,
      ...override
    };
  }
  return {
    ...source,
    radiusScale: Number.isFinite(def?.movementColliderRadiusScale)
      ? def.movementColliderRadiusScale
      : (source.radiusScale ?? 1) * DEFAULT_ENEMY_MOVEMENT_COLLIDER_RADIUS_SCALE,
    separationRadiusScale: Number.isFinite(def?.movementSeparationRadiusScale)
      ? def.movementSeparationRadiusScale
      : (source.separationRadiusScale ?? DEFAULT_ENEMY_SEPARATION_RADIUS_SCALE),
    offsetX: Number.isFinite(def?.movementColliderOffsetX) ? def.movementColliderOffsetX : source.offsetX,
    offsetY: Number.isFinite(def?.movementColliderOffsetY) ? def.movementColliderOffsetY : source.offsetY,
    minRadius: Number.isFinite(def?.movementColliderMinRadius) ? def.movementColliderMinRadius : source.minRadius
  };
}

export function getEnemyMovementColliderSource(def, assets = null) {
  if (!def) return buildFallbackSource({ size: 32, drawSize: 32 });
  const cached = SOURCE_CACHE.get(def);
  if (cached && (cached.derivedFromSprite || !assets)) return cached;
  const baseSource = deriveSourceFromSprite(def, assets) || buildFallbackSource(def);
  const merged = mergeOverrides(baseSource, def);
  SOURCE_CACHE.set(def, merged);
  return merged;
}

export function refreshEnemyMovementCollider(enemy) {
  if (!enemy) return null;
  const source = enemy.movementColliderSource || buildFallbackSource(enemy);
  const drawSize = Math.max(1, Number(enemy.drawSize) || Number(enemy.w) || source.baseDrawSize || 1);
  const bodyWidth = Math.max(1, Number(enemy.w) || drawSize);
  const bodyHeight = Math.max(1, Number(enemy.h) || drawSize);
  const baseDrawSize = Math.max(1, Number(source.baseDrawSize) || drawSize);
  const drawScale = drawSize / baseDrawSize;
  const offsetX = -(drawSize - bodyWidth) * DEFAULT_ANCHOR_X
    + (source.centerXRatio ?? 0.5) * drawSize
    + (source.offsetX || 0) * drawScale;
  const offsetY = -(drawSize - bodyHeight) * DEFAULT_ANCHOR_Y
    + (source.centerYRatio ?? 0.7) * drawSize
    + (source.offsetY || 0) * drawScale;
  const radius = Math.max(
    (source.minRadius || 0) * drawScale,
    Math.max(
      (source.radiusXRatio ?? 0.18) * drawSize,
      (source.radiusYRatio ?? 0.18) * drawSize
    ) * (source.radiusScale ?? 1)
  );
  enemy.movementCollider = {
    offsetX,
    offsetY,
    radius,
    separationRadius: Math.max(4, radius * (source.separationRadiusScale ?? DEFAULT_ENEMY_SEPARATION_RADIUS_SCALE)),
    baselineOffsetY: -(drawSize - bodyHeight) * DEFAULT_ANCHOR_Y + (source.baselineYRatio ?? 0.92) * drawSize
  };
  return enemy.movementCollider;
}

export function applyEnemyMovementCollider(enemy, def, assets = null) {
  if (!enemy) return null;
  enemy.movementColliderSource = getEnemyMovementColliderSource(def, assets);
  return refreshEnemyMovementCollider(enemy);
}

export function getEnemyMovementCircleAt(enemy, x = enemy?.x || 0, y = enemy?.y || 0) {
  if (!enemy?.movementCollider) refreshEnemyMovementCollider(enemy);
  const collider = enemy?.movementCollider || buildFallbackSource(enemy);
  const radius = collider.radius ?? Math.max(6, (enemy?.w || 24) * 0.24);
  return {
    x: x + (collider.offsetX ?? (enemy?.w || 0) * 0.5),
    y: y + (collider.offsetY ?? (enemy?.h || 0) * 0.72),
    radius
  };
}

export function getEnemySeparationCircleAt(enemy, x = enemy?.x || 0, y = enemy?.y || 0) {
  if (!enemy?.movementCollider) refreshEnemyMovementCollider(enemy);
  const collider = enemy?.movementCollider || buildFallbackSource(enemy);
  const radius = collider.separationRadius ?? collider.radius ?? Math.max(4, (enemy?.w || 24) * 0.16);
  return {
    x: x + (collider.offsetX ?? (enemy?.w || 0) * 0.5),
    y: y + (collider.offsetY ?? (enemy?.h || 0) * 0.72),
    radius
  };
}

export function circleOverlapsCircle(a, b) {
  if (!a || !b) return false;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const radius = (a.radius || 0) + (b.radius || 0);
  return dx * dx + dy * dy < radius * radius;
}

export function circleOverlapsBlocker(circle, blocker) {
  if (!circle || !blocker) return false;
  if (Number.isFinite(blocker.radius)) return circleOverlapsCircle(circle, blocker);
  return circleHitsRect(circle.x, circle.y, circle.radius, blocker);
}

export function getBlockerCircle(blocker) {
  if (!blocker) return null;
  if (Number.isFinite(blocker.radius) && Number.isFinite(blocker.x) && Number.isFinite(blocker.y)) {
    return blocker;
  }
  if (blocker.movementCollider || blocker.movementColliderSource) {
    return getEnemyMovementCircleAt(blocker);
  }
  return null;
}

export function getShortestCircleRectSeparation(circle, rect) {
  if (!circle || !rect || !circleHitsRect(circle.x, circle.y, circle.radius, rect)) return null;
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  const distanceSq = dx * dx + dy * dy;
  if (distanceSq > 0.0001) {
    const distance = Math.sqrt(distanceSq);
    const overlap = circle.radius - distance;
    return {
      x: (dx / distance) * overlap,
      y: (dy / distance) * overlap
    };
  }

  const leftGap = circle.x - rect.x;
  const rightGap = rect.x + rect.w - circle.x;
  const topGap = circle.y - rect.y;
  const bottomGap = rect.y + rect.h - circle.y;
  const minGap = Math.min(leftGap, rightGap, topGap, bottomGap);
  if (minGap === leftGap) return { x: -(leftGap + circle.radius), y: 0 };
  if (minGap === rightGap) return { x: rightGap + circle.radius, y: 0 };
  if (minGap === topGap) return { x: 0, y: -(topGap + circle.radius) };
  return { x: 0, y: bottomGap + circle.radius };
}

export function getShortestCircleCircleSeparation(circle, blockerCircle) {
  if (!circle || !blockerCircle) return null;
  const dx = circle.x - blockerCircle.x;
  const dy = circle.y - blockerCircle.y;
  const combinedRadius = (circle.radius || 0) + (blockerCircle.radius || 0);
  const distanceSq = dx * dx + dy * dy;
  if (distanceSq >= combinedRadius * combinedRadius) return null;
  if (distanceSq > 0.0001) {
    const distance = Math.sqrt(distanceSq);
    const overlap = combinedRadius - distance;
    return {
      x: (dx / distance) * overlap,
      y: (dy / distance) * overlap
    };
  }
  return {
    x: combinedRadius || 1,
    y: 0
  };
}
