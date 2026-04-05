export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function normalize(x, y, fallback = null) {
  const len = Math.hypot(x, y);
  if (len < 0.0001) return fallback;
  return { x: x / len, y: y / len };
}

export function centerOf(rect) {
  return {
    x: rect.x + (rect.w || 0) * 0.5,
    y: rect.y + (rect.h || 0) * 0.5
  };
}

export function rectsOverlap(r1, r2) {
  return (
    r1.x < r2.x + r2.w &&
    r1.x + r1.w > r2.x &&
    r1.y < r2.y + r2.h &&
    r1.y + r1.h > r2.y
  );
}

export function circleHitsRect(cx, cy, radius, rxOrRect, ry, rw, rh) {
  let rx, ryVal, rWidth, rHeight;
  if (typeof rxOrRect === "object" && rxOrRect !== null) {
    rx = rxOrRect.x;
    ryVal = rxOrRect.y;
    rWidth = rxOrRect.w;
    rHeight = rxOrRect.h;
  } else {
    rx = rxOrRect;
    ryVal = ry;
    rWidth = rw;
    rHeight = rh;
  }
  const closestX = clamp(cx, rx, rx + rWidth);
  const closestY = clamp(cy, ryVal, ryVal + rHeight);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

export function toDirectionKey(x, y, current) {
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  if (absX < 0.1 && absY < 0.1) return current;
  if (absX > absY * 1.5) return x > 0 ? "right" : "left";
  if (absY > absX * 1.5) return y > 0 ? "down" : "up";
  if (x > 0) return y > 0 ? "right_down" : "right_up";
  return y > 0 ? "left_down" : "left_up";
}

export function sample(array) {
  if (!array || !array.length) return null;
  return array[Math.floor(Math.random() * array.length)];
}

export function createSeededRandom(seed) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

export function syncProjectileRangeToSpeed(projectile, options = {}) {
  const speed = options.baseSpeed ?? projectile.speed ?? 0;
  const maxRange = options.baseMaxRange ?? projectile.maxRange ?? 0;
  
  if (speed > 0 && maxRange > 0 && projectile.lifetime == null) {
    projectile.lifetime = maxRange / speed;
  }

  if (Number.isFinite(projectile.dirX) && Number.isFinite(projectile.dirY)) {
    const currentSpeed = projectile.speed ?? speed;
    projectile.vx = projectile.dirX * currentSpeed;
    projectile.vy = projectile.dirY * currentSpeed;
  }
}

export function getCanvasDiameterRadius(game) {
  return Math.max(game.canvas.width, game.canvas.height);
}

const canvasDimensionsCache = new WeakMap();
window.addEventListener("resize", () => {
  // We can't clear a WeakMap easily, but we can't really do anything here
  // except wait for the next getCanvasDimensions call to realize it's stale.
  // A better way is to track a "global layout version".
});

let globalLayoutVersion = 0;
window.addEventListener("resize", () => {
  globalLayoutVersion += 1;
});

export function getCanvasDimensions(canvas) {
  let cached = canvasDimensionsCache.get(canvas);
  if (!cached || cached.version !== globalLayoutVersion) {
    const rect = canvas.getBoundingClientRect();
    cached = {
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
      left: rect.left,
      top: rect.top,
      version: globalLayoutVersion
    };
    canvasDimensionsCache.set(canvas, cached);
  }
  return cached;
}

const AUDIO_THROTTLE_MS = 45;
const audioLastPlayedMap = new Map();

/**
 * Plays an audio clone with a small throttle to prevent SFX "flooding"
 * during high-action moments (like mass pickups or multi-hits).
 */
export function playThrottledAudio(audio, options = {}) {
  if (!audio || !audio.src) return null;

  const now = Date.now();
  const lastPlayed = audioLastPlayedMap.get(audio.src) || 0;

  if (now - lastPlayed < AUDIO_THROTTLE_MS) {
    return null;
  }

  audioLastPlayedMap.set(audio.src, now);

  const instance = audio.cloneNode();
  instance.volume = options.volume ?? audio.volume;
  instance.playbackRate = options.playbackRate ?? 1;
  instance.play().catch(() => {});
  return instance;
}

export function formatStateLabel(state) {
  if (!state) return "";
  return String(state).charAt(0).toUpperCase() + String(state).slice(1);
}

export function frameIndexFromClock(clock, fps, frames) {
  if (!frames || frames <= 1) return 0;
  return Math.floor((clock || 0) * (fps || 8)) % frames;
}

const DEFAULT_PROJECTILE_ANCHOR_OFFSETS = Object.freeze({
  right: { x: 18, y: -4 },
  right_down: { x: 14, y: 1 },
  down: { x: 0, y: 2 },
  left_down: { x: -14, y: 1 },
  left: { x: -18, y: -4 },
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
    x: center.x + (offset.x || 0),
    y: center.y + (offset.y || 0)
  };
}
