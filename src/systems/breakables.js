import { centerOf, circleHitsRect, createSeededRandom, distance, playThrottledAudio, rectsOverlap } from "../core/runtime-utils.js";
import { BIOME_ARCHETYPE } from "./world-generation.js";
import { BREAKABLE_DEFS, BREAKABLE_GOLD_BY_RARITY, BREAKABLE_SPAWN_WEIGHTS, BREAKABLE_VARIANT_POOLS } from "../data/breakables.js";
import { getBreakableGoldMultiplier, onRingBreakableDestroyed } from "./rings.js";
import { spawnDamagePopup } from "./combat.js";
import { createGoldDrop } from "./gold.js";
import { drawGroundContactShadow } from "../render/object-shadows.js";

const imageCache = new Map();

function loadImage(src) {
  const key = String(src || "");
  if (!key) return null;
  if (imageCache.has(key)) return imageCache.get(key);
  const image = new Image();
  image.src = key;
  imageCache.set(key, image);
  return image;
}

function playAudioClone(audio, options = {}) {
  return playThrottledAudio(audio, options);
}

function chooseWeightedDefId(random) {
  const totalWeight = BREAKABLE_SPAWN_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * totalWeight;
  for (const entry of BREAKABLE_SPAWN_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return BREAKABLE_SPAWN_WEIGHTS[0]?.id || "urn_magic";
}

function chooseVariant(def, random) {
  const pool = BREAKABLE_VARIANT_POOLS[def.variantPool];
  if (!Array.isArray(pool) || !pool.length) return def.sprites;
  return pool[Math.floor(random() * pool.length)];
}

function sortedDamageStages(spriteConfig) {
  const stages = Array.isArray(spriteConfig?.damageStages) ? [...spriteConfig.damageStages] : [];
  stages.sort((a, b) => (Number(b.minHpPct) || 0) - (Number(a.minHpPct) || 0));
  return stages;
}

function imageSizeFromConfig(spriteConfig, fallbackWidth, fallbackHeight) {
  const declaredWidth = Number(spriteConfig?.size?.w);
  const declaredHeight = Number(spriteConfig?.size?.h);
  if (declaredWidth > 0 && declaredHeight > 0) {
    return { w: declaredWidth, h: declaredHeight };
  }
  const candidates = [
    spriteConfig?.staticSrc,
    ...(spriteConfig?.destroyFramesSrc || []),
    spriteConfig?.destroyedSrc
  ];
  for (const src of candidates) {
    const image = loadImage(src);
    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      return { w: image.naturalWidth, h: image.naturalHeight };
    }
  }
  return { w: fallbackWidth, h: fallbackHeight };
}

function overlapsBreakables(rect, breakables) {
  return (breakables || []).some((breakable) => !breakable.removed && rectsOverlap(rect, breakable));
}

function createBreakable(id, defId, x, y, random) {
  const def = BREAKABLE_DEFS[defId];
  if (!def) return null;
  const spriteConfig = chooseVariant(def, random) || def.sprites || {};
  const spriteSize = imageSizeFromConfig(spriteConfig, def.width, def.height);
  return {
    id,
    defId,
    label: def.label,
    x,
    y,
    w: Math.max(1, Math.round(spriteSize.w)),
    h: Math.max(1, Math.round(spriteSize.h)),
    maxHp: def.maxHp,
    hp: def.maxHp,
    rarity: def.rarity,
    blocksMovement: !!def.blocksMovement,
    damageCooldown: def.damageCooldown ?? 0.06,
    damageTimer: 0,
    hitFlashTimer: 0,
    healthBarTimer: 0,
    healthBarDuration: 1.1,
    isDestroyed: false,
    removed: false,
    destroyElapsed: 0,
    breakSfxKey: def.breakSfxKey || null,
    spriteConfig,
    damageStages: sortedDamageStages(spriteConfig),
    shadow: spriteConfig.shadow || def.shadow || null
  };
}

function breakableCenter(breakable) {
  return centerOf(breakable);
}

function buildCandidateRect(x, y, breakable) {
  return { x, y, w: breakable.w, h: breakable.h };
}

function findPlacementInCell(world, cellBounds, placedRects, breakables, defId, random, nextId) {
  const preview = createBreakable(nextId, defId, 0, 0, random);
  if (!preview) return null;
  const margin = 72;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const x = Math.round(cellBounds.x + margin + random() * Math.max(0, cellBounds.w - margin * 2 - preview.w));
    const y = Math.round(cellBounds.y + margin + random() * Math.max(0, cellBounds.h - margin * 2 - preview.h));
    const rect = buildCandidateRect(x, y, preview);
    if (rectsOverlap(rect, world.start) || rectsOverlap(rect, world.exit)) continue;
    if ((world.collisionRects || []).some((wall) => rectsOverlap(rect, wall))) continue;
    if (placedRects.some((other) => rectsOverlap(rect, other))) continue;
    if (overlapsBreakables(rect, breakables)) continue;
    preview.x = x;
    preview.y = y;
    return preview;
  }
  return null;
}

export function spawnRoomBreakables(world, searchables = [], roomIndex = 0, seed = 0) {
  const random = createSeededRandom(seed + roomIndex * 8191 + 401);
  const breakables = [];
  const placedRects = [
    world.start,
    world.exit,
    ...(searchables || []).map((entry) => ({ x: entry.x, y: entry.y, w: entry.w, h: entry.h }))
  ];
  let nextId = 1;

  for (let row = 0; row < world.archetypeGrid.grid.length; row += 1) {
    for (let col = 0; col < world.archetypeGrid.grid[row].length; col += 1) {
      const archetype = world.archetypeGrid.grid[row][col];
      if (archetype === BIOME_ARCHETYPE.EMPTY || archetype === BIOME_ARCHETYPE.START) continue;
      const cellBounds = world.biomeCellBounds(col, row);
      const baseCount = archetype === BIOME_ARCHETYPE.MINIBOSS || archetype === BIOME_ARCHETYPE.VAULT ? 3 : 2;
      const extra = random() < 0.45 ? 1 : 0;
      const targetCount = baseCount + extra;
      for (let index = 0; index < targetCount; index += 1) {
        const defId = chooseWeightedDefId(random);
        const breakable = findPlacementInCell(world, cellBounds, placedRects, breakables, defId, random, nextId);
        if (!breakable) continue;
        breakables.push(breakable);
        placedRects.push({ x: breakable.x, y: breakable.y, w: breakable.w, h: breakable.h });
        nextId += 1;
      }
    }
  }

  return breakables;
}

export function updateBreakables(game, dt) {
  const remaining = [];
  for (const breakable of game.breakables || []) {
    breakable.damageTimer = Math.max(0, (breakable.damageTimer || 0) - dt);
    breakable.hitFlashTimer = Math.max(0, (breakable.hitFlashTimer || 0) - dt);
    breakable.healthBarTimer = Math.max(0, (breakable.healthBarTimer || 0) - dt);
    if (breakable.isDestroyed) {
      breakable.destroyElapsed += dt;
    }
    if (!breakable.removed) remaining.push(breakable);
  }
  game.breakables = remaining;
}

function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

export function spawnGoldDropsForBreakable(game, breakable) {
  const config = BREAKABLE_GOLD_BY_RARITY[breakable.rarity] || BREAKABLE_GOLD_BY_RARITY.low;
  const total = Math.max(1, Math.round(randomInt(Math.random, config.min, config.max) * getBreakableGoldMultiplier(game)));
  const origin = breakableCenter(breakable);
  let remaining = total;

  for (let index = 0; index < config.dropCount; index += 1) {
    const value = index === config.dropCount - 1
      ? remaining
      : Math.max(1, Math.floor(remaining / (config.dropCount - index)));
    remaining -= value;
    const angle = (index / config.dropCount) * Math.PI * 2 + Math.random() * 0.6;
    game.goldDrops.push(createGoldDrop({
      id: `gold_breakable_${breakable.id}_${index}`,
      type: `breakable_${breakable.rarity}`,
      value,
      x: origin.x,
      y: origin.y,
      radius: config.radius,
      color: config.color,
      collectDelay: 0.18,
      lifetime: 14,
      burstAngle: angle,
      burstSpeed: 95 + Math.random() * 45,
      launchHeight: 12 + Math.random() * 8,
      launchVelocity: 145 + Math.random() * 80
    }));
  }
}

export function damageBreakable(game, breakable, amount, options = {}) {
  if (!breakable || breakable.isDestroyed) return false;
  const ignoreCooldown = options.ignoreCooldown === true;
  if (!ignoreCooldown && (breakable.damageTimer || 0) > 0) return false;
  const damage = Math.max(1, Math.round(amount));
  breakable.hp = Math.max(0, breakable.hp - damage);
  breakable.damageTimer = breakable.damageCooldown;
  breakable.hitFlashTimer = 0.08;
  breakable.healthBarTimer = Math.max(breakable.healthBarTimer || 0, breakable.healthBarDuration || 1.1);
  const center = breakableCenter(breakable);
  spawnDamagePopup(game, center.x, center.y - breakable.h * 0.3, `${damage}`, {
    color: "#f8fafc",
    duration: 0.5,
    riseSpeed: 36,
    scale: 0.92
  });
  const hitSfx = game.assets?.enemyHurtSfx;
  playAudioClone(hitSfx, {
    volume: Math.min(1, (hitSfx?.volume ?? 0.2) * (0.94 + Math.random() * 0.12)),
    playbackRate: 0.96 + Math.random() * 0.08
  });
  if (breakable.hp > 0) return true;
  breakable.isDestroyed = true;
  breakable.blocksMovement = false;
  breakable.destroyElapsed = 0;
  game.markBreakablesDirty?.();
  const breakSfx = breakable.breakSfxKey ? game.assets?.[breakable.breakSfxKey] : null;
  playAudioClone(breakSfx, {
    volume: Math.min(1, (breakSfx?.volume ?? 0.22) * (0.94 + Math.random() * 0.12)),
    playbackRate: 0.96 + Math.random() * 0.08
  });
  spawnGoldDropsForBreakable(game, breakable);
  onRingBreakableDestroyed(game, breakable);
  return true;
}

export function getBlockingBreakableRects(game) {
  return game.getBlockingBreakableRects?.()
    || (game.breakables || []).filter((breakable) => breakable.blocksMovement && !breakable.isDestroyed);
}

export function damageBreakablesInRadius(game, x, y, radius, amount, hitIds = null) {
  for (const breakable of game.breakables || []) {
    if (breakable.isDestroyed) continue;
    if (hitIds?.has(breakable.id)) continue;
    if (!circleHitsRect(x, y, radius, breakable)) continue;
    if (damageBreakable(game, breakable, amount) && hitIds) hitIds.add(breakable.id);
  }
}

export function damageBreakablesInCone(game, origin, dir, range, arcDeg, amount, hitIds = null) {
  const cosArc = Math.cos((arcDeg * Math.PI) / 360);
  for (const breakable of game.breakables || []) {
    if (breakable.isDestroyed) continue;
    if (hitIds?.has(breakable.id)) continue;
    const center = breakableCenter(breakable);
    const dist = distance(origin.x, origin.y, center.x, center.y);
    if (dist > range + Math.max(breakable.w, breakable.h) * 0.35) continue;
    const dx = center.x - origin.x;
    const dy = center.y - origin.y;
    const length = Math.hypot(dx, dy) || 1;
    const dot = (dx / length) * dir.x + (dy / length) * dir.y;
    if (dot < cosArc) continue;
    if (damageBreakable(game, breakable, amount) && hitIds) hitIds.add(breakable.id);
  }
}

export function damageBreakablesAlongSegment(game, ax, ay, bx, by, width, amount, hitIds = null, options = null) {
  const radius = Math.max(4, width * 0.5);
  const abx = bx - ax;
  const aby = by - ay;
  const denom = abx * abx + aby * aby || 1;
  for (const breakable of game.breakables || []) {
    if (breakable.isDestroyed) continue;
    if (hitIds?.has(breakable.id)) continue;
    const center = breakableCenter(breakable);
    const apx = center.x - ax;
    const apy = center.y - ay;
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom));
    const closestX = ax + abx * t;
    const closestY = ay + aby * t;
    const reach = radius + Math.max(breakable.w, breakable.h) * 0.35;
    if (distance(center.x, center.y, closestX, closestY) > reach) continue;
    if (damageBreakable(game, breakable, amount, options) && hitIds) hitIds.add(breakable.id);
  }
}

function currentBreakableStage(breakable) {
  const hpPct = breakable.maxHp > 0 ? breakable.hp / breakable.maxHp : 0;
  for (const stage of breakable.damageStages || []) {
    if (hpPct >= (stage.minHpPct ?? 0)) return stage;
  }
  return breakable.damageStages?.[breakable.damageStages.length - 1] || null;
}

function drawBreakableImage(ctx, image, x, y, w, h) {
  if (!image || !image.complete || image.naturalWidth <= 0) return false;
  const drawX = x;
  const drawY = y;
  const drawW = Math.max(1, Math.round(w));
  const drawH = Math.max(1, Math.round(h));
  const previousSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, drawX, drawY, drawW, drawH);
  ctx.imageSmoothingEnabled = previousSmoothing;
  return true;
}

export function drawBreakables(ctx, game) {
  for (const breakable of game.breakables || []) {
    if (game.isWorldRectVisible && !game.isWorldRectVisible(breakable.x, breakable.y, breakable.w, breakable.h, 32)) continue;
    const screenX = breakable.x - game.camera.x;
    const screenY = breakable.y - game.camera.y;
    const spriteConfig = breakable.spriteConfig || {};
    const centerX = screenX + breakable.w * 0.5;
    const centerY = screenY + breakable.h * 0.5;
    const auraRadius = Math.max(breakable.w, breakable.h) * 0.7;

    ctx.save();
    if (!breakable.isDestroyed) {
      const aura = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, auraRadius);
      aura.addColorStop(0, "rgba(250, 204, 21, 0.12)");
      aura.addColorStop(0.65, "rgba(250, 204, 21, 0.06)");
      aura.addColorStop(1, "rgba(250, 204, 21, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(centerX, centerY, auraRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (breakable.shadow) {
      drawGroundContactShadow(ctx, {
        x: screenX,
        y: screenY,
        w: breakable.w,
        h: breakable.h,
        shadow: breakable.isDestroyed
          ? {
              ...breakable.shadow,
              shadowAlpha: (breakable.shadow.shadowAlpha ?? 0.22) * 0.5,
              shadowWidth: (breakable.shadow.shadowWidth ?? 0.7) * 0.82,
              shadowHeight: (breakable.shadow.shadowHeight ?? 0.18) * 0.78
            }
          : breakable.shadow
      });
    }

    if (breakable.hitFlashTimer > 0) ctx.globalAlpha = 0.82;

    if (breakable.isDestroyed) {
      const frames = spriteConfig.destroyFramesSrc || [];
      const frameDuration = 0.06;
      const frameIndex = Math.floor((breakable.destroyElapsed || 0) / frameDuration);
      if (frameIndex >= 0 && frameIndex < frames.length
        && drawBreakableImage(ctx, loadImage(frames[frameIndex]), screenX, screenY, breakable.w, breakable.h)) {
        ctx.restore();
        continue;
      }
      drawBreakableImage(ctx, loadImage(spriteConfig.destroyedSrc), screenX, screenY, breakable.w, breakable.h);
      ctx.restore();
      continue;
    }

    const stage = currentBreakableStage(breakable);
    const preferredSrc = breakable.hitFlashTimer > 0 ? (stage?.hitSrc || spriteConfig.hitSrc) : (stage?.staticSrc || spriteConfig.staticSrc);
    const fallbackSrc = stage?.staticSrc || spriteConfig.staticSrc;
    const drawn = drawBreakableImage(ctx, loadImage(preferredSrc), screenX, screenY, breakable.w, breakable.h);
    if (!drawn && fallbackSrc && fallbackSrc !== preferredSrc) {
      drawBreakableImage(ctx, loadImage(fallbackSrc), screenX, screenY, breakable.w, breakable.h);
    }

    if ((breakable.healthBarTimer || 0) > 0 && breakable.maxHp > 0) {
      const hpRatio = Math.max(0, Math.min(1, breakable.hp / breakable.maxHp));
      const alpha = Math.min(1, breakable.healthBarTimer / Math.max(0.001, breakable.healthBarDuration || 1.1));
      const barWidth = Math.max(20, Math.round(breakable.w * 0.72));
      const barHeight = 5;
      const barX = Math.round(centerX - barWidth * 0.5);
      const barY = Math.round(screenY - 10);
      ctx.globalAlpha = 0.95 * alpha;
      ctx.fillStyle = "rgba(2, 6, 23, 0.82)";
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.fillStyle = hpRatio > 0.4 ? "#4ade80" : "#ef4444";
      ctx.fillRect(barX, barY, Math.round(barWidth * hpRatio), barHeight);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.95)";
      ctx.lineWidth = 1;
      ctx.strokeRect(barX - 0.5, barY - 0.5, barWidth + 1, barHeight + 1);
    }

    ctx.restore();

  }
}
