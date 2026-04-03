import { FOREST_VARIANTS } from "../data/forest-biome-variants.js";

const LEAF_BASE_COLOR = "#67ae85";
const LEAF_HIGHLIGHT_COLOR = "#94ddc9";
const LEAF_COLORS = [LEAF_BASE_COLOR, LEAF_HIGHLIGHT_COLOR];
const LEAF_MIN_COUNT = 18;
const LEAF_MAX_COUNT = 40;
const LEAF_SPAWN_MARGIN = 64;
const LEAF_DESPAWN_MARGIN = 96;
const LEAF_LIFETIME = 12;
const MAGIC_BASE_COLOR = "#2cd9ff";
const MAGIC_SHADE_COLOR = "#0a8fc3";
const MAGIC_COLORS = [MAGIC_BASE_COLOR, MAGIC_SHADE_COLOR];
const MAGIC_PARTICLE_MIN_COUNT = 30;
const MAGIC_PARTICLE_MAX_COUNT = 56;
const MAGIC_PARTICLE_MARGIN = 72;
const MAGIC_SINGLE_PIXEL_WEIGHT = 4;
const MAGIC_GRID_PIXEL_SIZE = 1;
const MAGIC_PATTERNS = Object.freeze([
  Object.freeze({
    w: 1,
    h: 1,
    pixels: Object.freeze([{ x: 0, y: 0, color: 0 }])
  }),
  Object.freeze({
    w: 2,
    h: 2,
    pixels: Object.freeze([
      { x: 0, y: 0, color: 0 },
      { x: 1, y: 0, color: 0 },
      { x: 0, y: 1, color: 0 },
      { x: 1, y: 1, color: 1 }
    ])
  })
]);
const LEAF_VARIANTS = Object.freeze([
  buildLeafVariant(9, 7, [
    { x: 0, y: 4, dx: 1, dy: 0, length: 3 },
    { x: 1, y: 3, dx: 1, dy: 0, length: 3 },
    { x: 2, y: 2, dx: 1, dy: 0, length: 2, tipHighlight: true },
    { x: 3, y: 4, dx: 1, dy: 1, length: 3 },
    { x: 4, y: 3, dx: 1, dy: 1, length: 2 },
    { x: 4, y: 1, dx: 1, dy: 1, length: 2, tipHighlight: true }
  ]),
  buildLeafVariant(10, 6, [
    { x: 0, y: 3, dx: 1, dy: 0, length: 4 },
    { x: 1, y: 2, dx: 1, dy: 0, length: 3 },
    { x: 3, y: 1, dx: 1, dy: 0, length: 2, tipHighlight: true },
    { x: 3, y: 3, dx: 1, dy: 1, length: 2 },
    { x: 5, y: 2, dx: 1, dy: 1, length: 2 }
  ]),
  buildLeafVariant(8, 8, [
    { x: 1, y: 5, dx: 1, dy: -1, length: 3 },
    { x: 0, y: 6, dx: 1, dy: -1, length: 2 },
    { x: 2, y: 4, dx: 1, dy: 0, length: 3 },
    { x: 3, y: 3, dx: 1, dy: 0, length: 2, tipHighlight: true },
    { x: 4, y: 4, dx: 1, dy: 1, length: 2 },
    { x: 4, y: 2, dx: 1, dy: 1, length: 2, tipHighlight: true }
  ]),
  buildLeafVariant(11, 7, [
    { x: 0, y: 3, dx: 1, dy: 0, length: 4 },
    { x: 2, y: 2, dx: 1, dy: 0, length: 3 },
    { x: 4, y: 1, dx: 1, dy: 0, length: 2 },
    { x: 4, y: 3, dx: 1, dy: 1, length: 3 },
    { x: 5, y: 2, dx: 1, dy: 1, length: 2 },
    { x: 6, y: 4, dx: 1, dy: 1, length: 2 }
  ]),
  buildLeafVariant(7, 7, [
    { x: 0, y: 4, dx: 1, dy: -1, length: 2 },
    { x: 1, y: 5, dx: 1, dy: -1, length: 2 },
    { x: 1, y: 3, dx: 1, dy: 0, length: 3 },
    { x: 2, y: 2, dx: 1, dy: 0, length: 2, tipHighlight: true },
    { x: 3, y: 4, dx: 1, dy: 1, length: 2 }
  ])
]);

function hexToRgb(hex) {
  const normalized = String(hex || "").replace("#", "");
  if (normalized.length !== 6) return { r: 255, g: 255, b: 255 };
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function brightenColor(hex, amount) {
  const rgb = hexToRgb(hex);
  const clamped = Math.max(0, Math.min(1, amount));
  const mix = (channel) => Math.round(channel + (255 - channel) * clamped);
  return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
}

function buildLeafVariant(width, height, strokes) {
  const byKey = new Map();
  for (const stroke of strokes) {
    for (let step = 0; step < stroke.length; step += 1) {
      const x = stroke.x + stroke.dx * step;
      const y = stroke.y + stroke.dy * step;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const key = `${x},${y}`;
      const color = stroke.tipHighlight && step === stroke.length - 1 ? 1 : 0;
      const existing = byKey.get(key);
      if (!existing || color > existing.color) {
        byKey.set(key, { x, y, color });
      }
    }
  }
  return Object.freeze({
    w: width,
    h: height,
    pixels: Object.freeze(Array.from(byKey.values()))
  });
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function getViewportWidth(game) {
  return game.camera?.viewWidth || game.canvas?.width || 0;
}

function getViewportHeight(game) {
  return game.camera?.viewHeight || game.canvas?.height || 0;
}

function ambientLeavesEnabled(game) {
  const variantId = game.world?.forestVariantId;
  return variantId === FOREST_VARIANTS.WOODS || variantId === FOREST_VARIANTS.SWAMP;
}

function ambientMagicEnabled(game) {
  return game.world?.forestVariantId === FOREST_VARIANTS.MAGIC_FOREST
    || game.world?.cosmeticFloor?.groundTypeId === "grass_magic";
}

function getLeafTargetCount(game) {
  const area = getViewportWidth(game) * getViewportHeight(game);
  return Math.max(LEAF_MIN_COUNT, Math.min(LEAF_MAX_COUNT, Math.round(area / 24000)));
}

function getMagicTargetCount(game) {
  const area = getViewportWidth(game) * getViewportHeight(game);
  return Math.max(MAGIC_PARTICLE_MIN_COUNT, Math.min(MAGIC_PARTICLE_MAX_COUNT, Math.round(area / 18000)));
}

function getSpawnRect(game) {
  const camera = game.camera;
  return {
    left: (camera?.x || 0) - LEAF_SPAWN_MARGIN,
    top: (camera?.y || 0) - LEAF_SPAWN_MARGIN,
    right: (camera?.x || 0) + getViewportWidth(game) + LEAF_SPAWN_MARGIN,
    bottom: (camera?.y || 0) + getViewportHeight(game) + LEAF_SPAWN_MARGIN
  };
}

function createLeafParticle(game, options = {}) {
  const spawnRect = getSpawnRect(game);
  const worldWidth = game.world?.width || spawnRect.right;
  const worldHeight = game.world?.height || spawnRect.bottom;
  const variant = LEAF_VARIANTS[Math.floor(Math.random() * LEAF_VARIANTS.length)];
  const compactness = variant.w <= 8 ? 1.08 : 0.92;
  const spawnBandTop = Math.max(-LEAF_SPAWN_MARGIN, spawnRect.top - getViewportHeight(game) * 0.15);
  const spawnBandBottom = Math.min(worldHeight + LEAF_SPAWN_MARGIN, spawnRect.bottom);
  return {
    x: options.x ?? randomRange(Math.max(-LEAF_SPAWN_MARGIN, spawnRect.left), Math.min(worldWidth + LEAF_SPAWN_MARGIN, spawnRect.right)),
    y: options.y ?? randomRange(spawnBandTop, spawnBandBottom),
    vx: randomRange(12, 22) * compactness,
    vy: randomRange(16, 30),
    swayAmplitude: randomRange(2, 6) * compactness,
    swayFrequency: randomRange(0.7, 1.5),
    swayPhase: randomRange(0, Math.PI * 2),
    rotation: randomRange(-0.28, 0.28),
    angularVelocity: randomRange(-0.18, 0.18),
    pixelSize: 1,
    age: 0,
    duration: LEAF_LIFETIME,
    shimmerPhase: randomRange(0, Math.PI * 2),
    shimmerSpeed: randomRange(0.8, 1.8),
    shimmerAmount: randomRange(0.04, 0.16),
    flashTimer: 0,
    flashDuration: randomRange(0.08, 0.18),
    flashStrength: randomRange(0.2, 0.5),
    variant
  };
}

function shouldRespawnLeaf(game, particle) {
  const camera = game.camera;
  const viewLeft = (camera?.x || 0) - LEAF_DESPAWN_MARGIN;
  const viewTop = (camera?.y || 0) - LEAF_DESPAWN_MARGIN;
  const viewRight = (camera?.x || 0) + getViewportWidth(game) + LEAF_DESPAWN_MARGIN;
  const viewBottom = (camera?.y || 0) + getViewportHeight(game) + LEAF_DESPAWN_MARGIN;
  const worldWidth = game.world?.width || viewRight;
  const worldHeight = game.world?.height || viewBottom;
  return (
    particle.y > Math.min(worldHeight + LEAF_DESPAWN_MARGIN, viewBottom)
    || particle.x > Math.min(worldWidth + LEAF_DESPAWN_MARGIN, viewRight)
    || particle.x < viewLeft - LEAF_DESPAWN_MARGIN
  );
}

function chooseMagicPattern() {
  if (Math.random() * (MAGIC_SINGLE_PIXEL_WEIGHT + 1) < MAGIC_SINGLE_PIXEL_WEIGHT) {
    return MAGIC_PATTERNS[0];
  }
  return MAGIC_PATTERNS[1];
}

function createMagicParticle(game, options = {}) {
  const camera = game.camera;
  const viewportWidth = getViewportWidth(game);
  const viewportHeight = getViewportHeight(game);
  const worldWidth = game.world?.width || ((camera?.x || 0) + viewportWidth);
  const worldHeight = game.world?.height || ((camera?.y || 0) + viewportHeight);
  const pattern = chooseMagicPattern();
  const duration = randomRange(2.8, 5.4);
  const fadeInDuration = duration * randomRange(0.2, 0.42);
  return {
    x: options.x ?? randomRange(
      Math.max(-MAGIC_PARTICLE_MARGIN, (camera?.x || 0) - MAGIC_PARTICLE_MARGIN),
      Math.min(worldWidth + MAGIC_PARTICLE_MARGIN, (camera?.x || 0) + viewportWidth + MAGIC_PARTICLE_MARGIN)
    ),
    y: options.y ?? randomRange(
      Math.max(-MAGIC_PARTICLE_MARGIN, (camera?.y || 0) - MAGIC_PARTICLE_MARGIN),
      Math.min(worldHeight + MAGIC_PARTICLE_MARGIN, (camera?.y || 0) + viewportHeight + MAGIC_PARTICLE_MARGIN)
    ),
    vx: randomRange(3, 8),
    vy: -randomRange(10, 22),
    age: 0,
    duration,
    fadeInDuration,
    alphaMax: randomRange(0.78, 1),
    gamma: randomRange(0.85, 1.25),
    driftPhase: randomRange(0, Math.PI * 2),
    driftFrequency: randomRange(0.8, 1.8),
    driftAmplitude: randomRange(1.5, 4),
    pattern,
    pixelSize: MAGIC_GRID_PIXEL_SIZE
  };
}

function shouldRespawnMagicParticle(game, particle) {
  const camera = game.camera;
  const viewportWidth = getViewportWidth(game);
  const viewportHeight = getViewportHeight(game);
  const worldWidth = game.world?.width || ((camera?.x || 0) + viewportWidth);
  const worldHeight = game.world?.height || ((camera?.y || 0) + viewportHeight);
  return (
    particle.age >= particle.duration
    || particle.y < (camera?.y || 0) - MAGIC_PARTICLE_MARGIN
    || particle.x > Math.min(worldWidth + MAGIC_PARTICLE_MARGIN, (camera?.x || 0) + viewportWidth + MAGIC_PARTICLE_MARGIN * 2)
    || particle.x < (camera?.x || 0) - MAGIC_PARTICLE_MARGIN * 2
    || particle.y > Math.min(worldHeight + MAGIC_PARTICLE_MARGIN, (camera?.y || 0) + viewportHeight + MAGIC_PARTICLE_MARGIN)
  );
}

export function createAmbientLeavesState() {
  return {
    particles: []
  };
}

export function createAmbientMagicParticlesState() {
  return {
    particles: []
  };
}

export function resetAmbientLeaves(game) {
  game.ambientLeaves = createAmbientLeavesState();
  if (!ambientLeavesEnabled(game)) return;
  const targetCount = getLeafTargetCount(game);
  for (let index = 0; index < targetCount; index += 1) {
    game.ambientLeaves.particles.push(createLeafParticle(game));
  }
}

export function resetAmbientMagicParticles(game) {
  game.ambientMagicParticles = createAmbientMagicParticlesState();
  if (!ambientMagicEnabled(game)) return;
  const targetCount = getMagicTargetCount(game);
  for (let index = 0; index < targetCount; index += 1) {
    game.ambientMagicParticles.particles.push(createMagicParticle(game));
  }
}

export function updateAmbientLeaves(game, dt) {
  if (!game?.ambientLeaves) resetAmbientLeaves(game);
  const state = game.ambientLeaves;
  if (!ambientLeavesEnabled(game)) {
    state.particles = [];
    return;
  }
  const targetCount = getLeafTargetCount(game);

  while (state.particles.length > targetCount) state.particles.shift();
  while (state.particles.length < targetCount) state.particles.push(createLeafParticle(game));

  for (let index = 0; index < state.particles.length; index += 1) {
    const particle = state.particles[index];
    particle.age += dt;
    particle.swayPhase += dt * particle.swayFrequency;
    particle.shimmerPhase += dt * particle.shimmerSpeed;
    particle.x += (particle.vx + Math.sin(particle.swayPhase) * particle.swayAmplitude) * dt;
    particle.y += particle.vy * dt;
    particle.rotation += particle.angularVelocity * dt;
    particle.flashTimer = Math.max(0, (particle.flashTimer || 0) - dt);
    if (particle.flashTimer <= 0 && Math.random() < dt * 0.08) {
      particle.flashTimer = particle.flashDuration;
    }

    if (particle.age >= particle.duration || shouldRespawnLeaf(game, particle)) {
      state.particles[index] = createLeafParticle(game, {
        x: randomRange((game.camera?.x || 0) - LEAF_SPAWN_MARGIN, (game.camera?.x || 0) + getViewportWidth(game) + LEAF_SPAWN_MARGIN),
        y: (game.camera?.y || 0) - randomRange(18, getViewportHeight(game) * 0.3 + LEAF_SPAWN_MARGIN)
      });
    }
  }
}

export function updateAmbientMagicParticles(game, dt) {
  if (!game?.ambientMagicParticles) resetAmbientMagicParticles(game);
  const state = game.ambientMagicParticles;
  if (!ambientMagicEnabled(game)) {
    state.particles = [];
    return;
  }
  const targetCount = getMagicTargetCount(game);

  while (state.particles.length > targetCount) state.particles.shift();
  while (state.particles.length < targetCount) state.particles.push(createMagicParticle(game));

  for (let index = 0; index < state.particles.length; index += 1) {
    const particle = state.particles[index];
    particle.age += dt;
    particle.driftPhase += dt * particle.driftFrequency;
    particle.x += (particle.vx + Math.sin(particle.driftPhase) * particle.driftAmplitude) * dt;
    particle.y += particle.vy * dt;

    if (shouldRespawnMagicParticle(game, particle)) {
      state.particles[index] = createMagicParticle(game, {
        x: randomRange(
          (game.camera?.x || 0) - MAGIC_PARTICLE_MARGIN,
          (game.camera?.x || 0) + getViewportWidth(game) + MAGIC_PARTICLE_MARGIN
        ),
        y: (game.camera?.y || 0) + getViewportHeight(game) + randomRange(8, MAGIC_PARTICLE_MARGIN)
      });
    }
  }
}

export function drawAmbientLeaves(ctx, game) {
  if (!ambientLeavesEnabled(game)) return;
  const particles = game.ambientLeaves?.particles;
  if (!particles?.length) return;

  const cameraX = game.camera?.x || 0;
  const cameraY = game.camera?.y || 0;
  ctx.save();
  for (const particle of particles) {
    const variant = particle.variant;
    const pixelSize = particle.pixelSize || 1;
    const width = variant.w * pixelSize;
    const height = variant.h * pixelSize;
    const screenX = particle.x - cameraX;
    const screenY = particle.y - cameraY;
    const progress = Math.min(1, particle.age / Math.max(0.001, particle.duration || LEAF_LIFETIME));
    const shimmer = (Math.sin(particle.shimmerPhase || 0) * 0.5 + 0.5) * (particle.shimmerAmount || 0);
    const flashProgress = particle.flashTimer > 0
      ? particle.flashTimer / Math.max(0.001, particle.flashDuration || 0.1)
      : 0;
    const flash = Math.sin(flashProgress * Math.PI) * (particle.flashStrength || 0);
    const brightness = shimmer + flash;

    ctx.save();
    ctx.translate(Math.round(screenX), Math.round(screenY));
    ctx.rotate(particle.rotation || 0);
    ctx.globalAlpha = 1 - progress;
    for (const pixel of variant.pixels) {
      ctx.fillStyle = brightenColor(LEAF_COLORS[pixel.color] || LEAF_BASE_COLOR, brightness);
      ctx.fillRect(
        pixel.x * pixelSize - width * 0.5,
        pixel.y * pixelSize - height * 0.5,
        pixelSize,
        pixelSize
      );
    }
    ctx.restore();
  }
  ctx.restore();
}

export function drawAmbientMagicParticles(ctx, game) {
  if (!ambientMagicEnabled(game)) return;
  const particles = game.ambientMagicParticles?.particles;
  if (!particles?.length) return;

  const cameraX = game.camera?.x || 0;
  const cameraY = game.camera?.y || 0;
  ctx.save();
  for (const particle of particles) {
    const pattern = particle.pattern;
    const pixelSize = particle.pixelSize || 1;
    const width = pattern.w * pixelSize;
    const height = pattern.h * pixelSize;
    const screenX = particle.x - cameraX;
    const screenY = particle.y - cameraY;
    const progress = Math.min(1, particle.age / Math.max(0.001, particle.duration));
    const fadeInProgress = Math.min(1, particle.age / Math.max(0.001, particle.fadeInDuration));
    const fadeOutProgress = 1 - progress;
    const alpha = Math.pow(fadeInProgress, particle.gamma) * Math.pow(Math.max(0, fadeOutProgress), Math.max(0.9, 1.6 - (particle.gamma - 1) * 0.4)) * particle.alphaMax;

    ctx.save();
    ctx.translate(Math.round(screenX), Math.round(screenY));
    ctx.globalAlpha = alpha;
    for (const pixel of pattern.pixels) {
      ctx.fillStyle = MAGIC_COLORS[pixel.color] || MAGIC_BASE_COLOR;
      ctx.fillRect(
        pixel.x * pixelSize - width * 0.5,
        pixel.y * pixelSize - height * 0.5,
        pixelSize,
        pixelSize
      );
    }
    ctx.restore();
  }
  ctx.restore();
}
