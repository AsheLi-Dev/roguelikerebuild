export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(aX, aY, bX, bY) {
  const dx = bX - aX;
  const dy = bY - aY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalize(x, y, fallback = { x: 1, y: 0 }) {
  const lengthSq = x * x + y * y;
  if (lengthSq < 0.00000001) {
    return { x: fallback?.x ?? 1, y: fallback?.y ?? 0 };
  }
  const inverseLength = 1 / Math.sqrt(lengthSq);
  return { x: x * inverseLength, y: y * inverseLength };
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleHitsRect(cx, cy, radius, rect) {
  const minX = rect.x;
  const maxX = rect.x + rect.w;
  const minY = rect.y;
  const maxY = rect.y + rect.h;
  const nearestX = cx < minX ? minX : (cx > maxX ? maxX : cx);
  const nearestY = cy < minY ? minY : (cy > maxY ? maxY : cy);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function createSeededRandom(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sample(array, random) {
  return array[Math.floor(random() * array.length)];
}

export function toDirectionKey(x, y, fallback = "down") {
  if (Math.abs(x) < 0.001 && Math.abs(y) < 0.001) return fallback;
  const angle = Math.atan2(y, x);
  const step = Math.round(angle / (Math.PI / 4));
  const normalizedStep = ((step % 8) + 8) % 8;
  return ["right", "right_down", "down", "left_down", "left", "left_up", "up", "right_up"][normalizedStep];
}

export function frameIndexFromClock(clock, fps, frames) {
  if (frames <= 1) return 0;
  return Math.floor(clock * fps) % frames;
}

export function centerOf(entity) {
  return {
    x: entity.x + entity.w * 0.5,
    y: entity.y + entity.h * 0.5
  };
}

const DEFAULT_PROJECTILE_ANCHOR_OFFSETS = Object.freeze({
  right: { x: 16, y: -9 },
  right_down: { x: 14, y: -1 },
  down: { x: 4, y: 9 },
  left_down: { x: -14, y: -1 },
  left: { x: -16, y: -9 },
  left_up: { x: -14, y: -16 },
  up: { x: 0, y: -19 },
  right_up: { x: 14, y: -16 }
});

export function resolveHeroProjectileOrigin(player, heroDef, dir, facing = null) {
  const center = centerOf(player);
  const directionKey = facing || toDirectionKey(dir?.x ?? 0, dir?.y ?? 0, player.facing || "down");
  const anchorOffsets = heroDef?.sprite?.projectileAnchorOffsets || DEFAULT_PROJECTILE_ANCHOR_OFFSETS;
  const offset = anchorOffsets[directionKey] || anchorOffsets.default || DEFAULT_PROJECTILE_ANCHOR_OFFSETS[directionKey] || DEFAULT_PROJECTILE_ANCHOR_OFFSETS.down;
  return {
    x: center.x + offset.x,
    y: center.y + offset.y
  };
}

export function formatStateLabel(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
