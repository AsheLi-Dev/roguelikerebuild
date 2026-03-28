export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(aX, aY, bX, bY) {
  return Math.hypot(bX - aX, bY - aY);
}

export function normalize(x, y, fallback = { x: 1, y: 0 }) {
  const length = Math.hypot(x, y);
  if (length < 0.0001) return { ...fallback };
  return { x: x / length, y: y / length };
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleHitsRect(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  return distance(cx, cy, nearestX, nearestY) <= radius;
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

export function formatStateLabel(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
