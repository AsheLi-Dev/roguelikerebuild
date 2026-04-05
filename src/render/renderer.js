import { GLOBAL_LIGHTING } from "../core/lighting.js";
import { centerOf, clamp, formatStateLabel, frameIndexFromClock, resolveHeroProjectileOrigin } from "../core/runtime-utils.js";
import { getAffixDef } from "../data/enemy-affixes.js";
import { getRingDefById, getRingRarityColor } from "../data/rings.js";
import { getMaterialDefById } from "../data/materials.js";
import { getSkillIconFrame } from "../data/skill-icons.js";
import { drawBreakables } from "../systems/breakables.js";
import { getGoldDropSpriteFrame } from "../systems/gold.js";
import { drawOpenWorldGroundBase, drawOpenWorldGroundDecor, drawOpenWorldGroundDetails } from "../systems/biome-floor.js";
import { drawUpperCliffDecor } from "../systems/biome-upper-cliff.js";
import { UPPER_CLIFF_MID_STRIP_FILL_HEX } from "../systems/upper-cliff-ground-mask.js";
import { getPlayerStat } from "../systems/player-stats.js";
import { getSearchableInteractState } from "../systems/searchables.js";
import { SEARCHABLE_DEFS } from "../data/searchables.js";
import { getTreasureSpiritRenderState } from "../systems/treasure-spirit.js";
import { getDevilMerchantRenderState } from "../systems/devil-merchant.js";
import { getMaxDashCharges } from "../systems/rings.js";
import { getMovementSkillSlot, getRunSkillEffects, getRunSkillSlots } from "../systems/skills.js";
import { getEnemyMovementCircleAt } from "../systems/enemy-movement-collider.js";
import { drawAmbientLeaves, drawAmbientMagicParticles } from "../systems/ambient-leaves.js";
import { drawWorldLighting } from "./lighting.js";
import { drawGroundContactShadow } from "./object-shadows.js";
import { drawSpriteFrame, getSnappedSpriteMetrics } from "./sprite-utils.js";

const WORLD_RENDER_ZOOM = 1;
const CAMERA_VIGNETTE = Object.freeze({
  innerRadius: 0.24,
  midRadius: 0.64,
  outerRadius: 1.06,
  alpha: 0.44,
  color: "6, 8, 16"
});
const SLIME_CONTACT_SHADOW = Object.freeze({
  shadowWidth: 0.7,
  shadowHeight: 0.2,
  shadowOffsetX: 0,
  shadowOffsetY: -0.03,
  shadowAlpha: 0.18,
  shadowBlurScale: 1.78,
  shadowColor: "rgba(0, 0, 0, 1)"
});
const HERO_ATTACK_NUDGE_DISTANCE = 8;
const LOYAL_DRAGON_FRAME_WIDTH = 70;
const LOYAL_DRAGON_FRAME_HEIGHT = 73;
const LOYAL_DRAGON_FRAMES = 6;
const LOYAL_DRAGON_FPS = 10;
const LOYAL_DRAGON_DRAW_WIDTH = 35;
const LOYAL_DRAGON_DRAW_HEIGHT = 35;
const LOYAL_DRAGON_FLOAT_AMPLITUDE = 6;

function getHeroAttackNudgeOffset(game) {
  const action = game.combat?.playerAction;
  if (!action || action.kind !== "attack") return { x: 0, y: 0 };
  const dir = action.direction;
  if (!dir) return { x: 0, y: 0 };
  const duration = Math.max(0.001, action.duration || 0.001);
  const progress = clamp(action.elapsed / duration, 0, 1);
  const peak = clamp((action.triggerTime || duration * 0.4) / duration, 0.18, 0.72);
  let strength = 0;
  if (progress <= peak) {
    strength = Math.sin((progress / Math.max(0.001, peak)) * Math.PI * 0.5);
  } else {
    strength = Math.cos(((progress - peak) / Math.max(0.001, 1 - peak)) * Math.PI * 0.5);
  }
  strength = Math.max(0, strength);
  strength = Math.pow(strength, 1.15);
  const distance = HERO_ATTACK_NUDGE_DISTANCE * strength;
  return {
    x: dir.x * distance,
    y: dir.y * distance
  };
}

function getCameraRenderScale(game) {
  const snappedScale = Math.max(1, Math.round(game.camera?.renderScale || 1));
  return {
    x: snappedScale,
    y: snappedScale
  };
}

function drawLoyalDragonSprite(ctx, game, effect, dragon, index) {
  const image = game.assets?.loyalDragonSummon;
  if (!image) return false;
  const playerDirectionX = Math.sign(game.player?.vx || 0);
  const bob =
    Math.sin(effect.elapsed * 5 + index * 1.3) * 3 +
    Math.sin(effect.elapsed * (1.4 + index * 0.17) + index * 2.1) * LOYAL_DRAGON_FLOAT_AMPLITUDE;
  const frame = Math.floor(effect.elapsed * LOYAL_DRAGON_FPS + index) % LOYAL_DRAGON_FRAMES;
  const drawWidth = LOYAL_DRAGON_DRAW_WIDTH;
  const drawHeight = LOYAL_DRAGON_DRAW_HEIGHT;
  const screenX = dragon.x - game.camera.x;
  const screenY = dragon.y - game.camera.y + bob;
  const flip = playerDirectionX < 0 ? -1 : 1;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(screenX, screenY + drawHeight * 0.24, drawWidth * 0.22, drawHeight * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawSpriteFrame(ctx, {
    image,
    sx: frame * LOYAL_DRAGON_FRAME_WIDTH,
    sy: 0,
    sw: LOYAL_DRAGON_FRAME_WIDTH,
    sh: LOYAL_DRAGON_FRAME_HEIGHT,
    dx: screenX - drawWidth * 0.5,
    dy: screenY - drawHeight * 0.62,
    dw: drawWidth,
    dh: drawHeight,
    flip,
    smoothingEnabled: false
  });
  return true;
}

function drawTile(ctx, atlas, row, col, x, y, size = 32) {
  if (!atlas) return;
  ctx.drawImage(atlas, col * 32, row * 32, 32, 32, x, y, size, size);
}


function drawImageCover(ctx, image, x, y, w, h) {
  const imageW = image?.naturalWidth || image?.width || 0;
  const imageH = image?.naturalHeight || image?.height || 0;
  if (!imageW || !imageH || w <= 0 || h <= 0) return;
  const scale = Math.max(w / imageW, h / imageH);
  const drawW = imageW * scale;
  const drawH = imageH * scale;
  const dx = x + (w - drawW) * 0.5;
  const dy = y + (h - drawH) * 0.5 - h * 0.08;
  ctx.drawImage(image, dx, dy, drawW, drawH);
}

function drawImageContain(ctx, image, x, y, w, h) {
  const imageW = image?.naturalWidth || image?.width || 0;
  const imageH = image?.naturalHeight || image?.height || 0;
  if (!imageW || !imageH || w <= 0 || h <= 0) return;
  const scale = Math.min(w / imageW, h / imageH);
  const drawW = imageW * scale;
  const drawH = imageH * scale;
  const dx = x + (w - drawW) * 0.5;
  const dy = y + (h - drawH) * 0.5;
  ctx.drawImage(image, dx, dy, drawW, drawH);
}

let cachedCameraVignette = null;

function getCameraVignetteCanvas(width, height) {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  if (
    cachedCameraVignette &&
    cachedCameraVignette.width === safeWidth &&
    cachedCameraVignette.height === safeHeight
  ) {
    return cachedCameraVignette.canvas;
  }

  const canvas = document.createElement("canvas");
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  const vignetteCtx = canvas.getContext("2d");
  if (!vignetteCtx) return null;

  const centerX = safeWidth * 0.5;
  const centerY = safeHeight * 0.47;
  const radius = Math.hypot(safeWidth * 0.56, safeHeight * 0.7);
  const gradient = vignetteCtx.createRadialGradient(
    centerX,
    centerY,
    radius * CAMERA_VIGNETTE.innerRadius,
    centerX,
    centerY,
    radius * CAMERA_VIGNETTE.outerRadius
  );
  gradient.addColorStop(0, `rgba(${CAMERA_VIGNETTE.color}, 0)`);
  gradient.addColorStop(0.52, `rgba(${CAMERA_VIGNETTE.color}, 0)`);
  gradient.addColorStop(CAMERA_VIGNETTE.midRadius, `rgba(${CAMERA_VIGNETTE.color}, ${CAMERA_VIGNETTE.alpha * 0.42})`);
  gradient.addColorStop(0.82, `rgba(${CAMERA_VIGNETTE.color}, ${CAMERA_VIGNETTE.alpha * 0.82})`);
  gradient.addColorStop(1, `rgba(${CAMERA_VIGNETTE.color}, ${CAMERA_VIGNETTE.alpha})`);
  vignetteCtx.fillStyle = gradient;
  vignetteCtx.fillRect(0, 0, safeWidth, safeHeight);

  cachedCameraVignette = {
    width: safeWidth,
    height: safeHeight,
    canvas
  };
  return canvas;
}

function drawCameraVignette(ctx, game) {
  const width = game.canvas?.width || 0;
  const height = game.canvas?.height || 0;
  if (width <= 0 || height <= 0) return;
  const vignetteCanvas = getCameraVignetteCanvas(width, height);
  if (!vignetteCanvas) return;

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(vignetteCanvas, 0, 0);
  ctx.restore();
}

function drawRingSelectionShop(ctx, game, searchable, x, y) {
  const pedestal = game.assets?.ringSelectionShopSprite;
  const atlas = game.assets?.itemsAtlas;
  const offers = searchable.isOpen
    ? []
    : (searchable.ringOffers || [])
      .map((ringId) => getRingDefById(ringId))
      .filter(Boolean);
  if (!pedestal) return;
  const itemWidth = searchable.w / 3;
  const pedestalDrawW = itemWidth - 4;
  const pedestalDrawH = searchable.h;

  ctx.save();
  ctx.textAlign = "center";
  for (let index = 0; index < 3; index += 1) {
    const ringDef = offers[index] || null;
    const cardX = x + itemWidth * index + 2;
    const centerX = cardX + pedestalDrawW * 0.5;
    ctx.drawImage(pedestal, cardX, y, pedestalDrawW, pedestalDrawH);
    if (ringDef) {
      ctx.font = "bold 8px Georgia";
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "rgba(2, 6, 23, 0.96)";
      ctx.lineWidth = 3;
      ctx.strokeText(ringDef.name, centerX, y - 3);
      ctx.fillText(ringDef.name, centerX, y - 3);

      const iconSize = 24;
      const iconX = Math.round(centerX - iconSize * 0.5);
      const iconY = Math.round(y + pedestalDrawH * 0.5 - iconSize * 0.6);
      const individualIcon = ringDef.iconAssetKey ? game.assets[ringDef.iconAssetKey] : null;

      if (individualIcon) {
        ctx.drawImage(
          individualIcon,
          iconX,
          iconY,
          iconSize,
          iconSize
        );
      } else if (atlas) {
        ctx.drawImage(
          atlas,
          ringDef.spriteCell.col * 32,
          ringDef.spriteCell.row * 32,
          32,
          32,
          iconX,
          iconY,
          iconSize,
          iconSize
        );
      }

      ctx.strokeStyle = getRingRarityColor(ringDef.dropRarity);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(iconX, iconY, iconSize, iconSize);
    }
  }
  ctx.restore();
}

function drawBackdropCloudLayer(ctx, cloudImages, canvas, time = 0) {
  if (!Array.isArray(cloudImages) || !cloudImages.length) return;
  const upperBandTop = canvas.height * 0.04;
  const upperBandHeight = canvas.height * 0.28;
  const totalTravel = canvas.width + 420;

  ctx.save();
  ctx.globalAlpha = 0.82;
  for (let index = 0; index < 7; index += 1) {
    const image = cloudImages[index % cloudImages.length];
    const imageW = image?.naturalWidth || image?.width || 0;
    const imageH = image?.naturalHeight || image?.height || 0;
    if (!imageW || !imageH) continue;
    const size = 88 + (index % 3) * 26 + (index === 2 || index === 5 ? 18 : 0);
    const drawW = size * 1.9;
    const drawH = drawW * (imageH / Math.max(1, imageW));
    const speed = 5 + index * 0.9;
    const phase = (index * 0.173) % 1;
    const travel = ((phase * totalTravel) + time * speed) % totalTravel;
    const x = -drawW + travel;
    const yBase = upperBandTop + upperBandHeight * (0.12 + (index % 4) * 0.18);
    const yDrift = Math.sin(time * 0.08 + index * 1.7) * 6;
    ctx.drawImage(
      image,
      Math.round(x),
      Math.round(yBase + yDrift),
      Math.round(drawW),
      Math.round(drawH)
    );
  }
  ctx.restore();
}

function shouldMaskTopUnplayableForUpperCliff(world) {
  const rows = world?.archetypeGrid?.grid?.length || 0;
  return !!world?.upperCliff?.enabled && rows > 0;
}

function getTopUnplayableCutoffY(world) {
  const rows = world?.archetypeGrid?.grid?.length || 0;
  if (!rows) return 0;
  return world.height / rows;
}

function getTopRowPlayableMacroRects(world, excludeCols = null) {
  return getMacroRowPlayableRects(world, 0, excludeCols);
}

function getMacroRowPlayableRects(world, rowIndex, excludeCols = null) {
  const grid = world?.archetypeGrid?.grid;
  if (!Array.isArray(grid) || !grid.length || !Array.isArray(grid[0]) || !grid[0].length) return [];
  if (rowIndex < 0 || rowIndex >= grid.length) return [];
  const rows = grid.length;
  const cols = grid[0].length;
  const cellW = world.width / cols;
  const cellH = world.height / rows;
  const skip =
    excludeCols instanceof Set
      ? excludeCols
      : Array.isArray(excludeCols)
        ? new Set(excludeCols)
        : null;
  const rects = [];
  const row = grid[rowIndex];
  for (let col = 0; col < cols; col += 1) {
    if (skip?.has(col)) continue;
    const archetype = row[col];
    if (!archetype || archetype === "empty") continue;
    rects.push({
      x: col * cellW,
      y: rowIndex * cellH,
      w: cellW,
      h: cellH
    });
  }
  return rects;
}

function getBackdropRevealRects(world) {
  const rects = [...(world?.voidRects || [])];
  if (shouldMaskTopUnplayableForUpperCliff(world)) {
    rects.push(...getTopRowPlayableMacroRects(world));
    for (const rect of getMacroRowPlayableRects(world, 1)) {
      rects.push({
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h * 0.1
      });
    }
  }
  return rects;
}

function drawBackdropRevealLayer(ctx, image, cloudImages, world, camera, canvas, time = 0) {
  const rects = getBackdropRevealRects(world);
  if (!image || !rects.length) return false;
  ctx.save();
  ctx.beginPath();
  let anyVisibleRect = false;
  for (const rect of rects) {
    const screenX = rect.x - camera.x;
    const screenY = rect.y - camera.y;
    if (screenX + rect.w < 0 || screenY + rect.h < 0 || screenX > canvas.width || screenY > canvas.height) continue;
    if (rect.w <= 0 || rect.h <= 0) continue;
    ctx.rect(screenX, screenY, rect.w, rect.h);
    anyVisibleRect = true;
  }
  if (!anyVisibleRect) {
    ctx.restore();
    return false;
  }
  ctx.clip();
  drawImageCover(ctx, image, 0, 0, canvas.width, canvas.height);
  drawBackdropCloudLayer(ctx, cloudImages, canvas, time);
  ctx.restore();
  return true;
}

function drawUpperCliffMaskFillLayer(ctx, rects, camera, game) {
  if (!Array.isArray(rects) || !rects.length) return;
  ctx.save();
  ctx.fillStyle = UPPER_CLIFF_MID_STRIP_FILL_HEX;
  for (const rect of rects) {
    const screenX = rect.x - camera.x;
    const screenY = rect.y - camera.y;
    if (screenX + rect.w < 0 || screenY + rect.h < 0 || screenX > game.canvas.width || screenY > game.canvas.height) continue;
    if (rect.w <= 0 || rect.h <= 0) continue;
    ctx.fillRect(screenX, screenY, rect.w, rect.h);
  }
  ctx.restore();
}

function applyUpperCliffVisibleRegionClip(ctx, world, camera) {
  if (!shouldMaskTopUnplayableForUpperCliff(world)) return false;
  const uc = world.upperCliff;
  const islandClipRects = uc?.groundClipRects;
  const row01MaskRects = uc?.row01GroundMaskRects;
  const cutoffY = getTopUnplayableCutoffY(world);
  const row1BottomY = 2 * cutoffY;
  const islandTopCols = uc?.row0IslandGroundMaskMacroCols;
  const playableTopRects = getTopRowPlayableMacroRects(world, islandTopCols);

  ctx.save();
  ctx.beginPath();
  let anyRegion = false;

  if (row1BottomY < world.height) {
    ctx.rect(-camera.x, row1BottomY - camera.y, world.width, world.height - row1BottomY);
    anyRegion = true;
  }

  for (const rect of playableTopRects) {
    if (rect.w <= 0 || rect.h <= 0) continue;
    ctx.rect(rect.x - camera.x, rect.y - camera.y, rect.w, rect.h);
    anyRegion = true;
  }

  if (Array.isArray(islandClipRects)) {
    for (const rect of islandClipRects) {
      if (rect.w <= 0 || rect.h <= 0) continue;
      ctx.rect(rect.x - camera.x, rect.y - camera.y, rect.w, rect.h);
      anyRegion = true;
    }
  }

  if (Array.isArray(row01MaskRects)) {
    for (const rect of row01MaskRects) {
      if (rect.w <= 0 || rect.h <= 0) continue;
      ctx.rect(rect.x - camera.x, rect.y - camera.y, rect.w, rect.h);
      anyRegion = true;
    }
  }

  if (!anyRegion) {
    ctx.rect(-camera.x, -camera.y, world.width, world.height);
  }

  ctx.clip();
  return true;
}

const treeFadeScratchCache = new Map();
const enemyOverlayScratchCache = new Map();
const enemyMaskedOverlayCache = new Map();
const obstacleRenderCache = new Map();
const MAX_ENEMY_MASKED_OVERLAY_CACHE_ENTRIES = 512;

function getReusableScratchCanvas(cache, width, height) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const cacheKey = `${safeWidth}x${safeHeight}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const canvas = document.createElement("canvas");
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  cache.set(cacheKey, canvas);
  return canvas;
}

function getTreeFadeScratch(width, height) {
  return getReusableScratchCanvas(treeFadeScratchCache, width, height);
}

function getEnemyOverlayScratch(width, height) {
  return getReusableScratchCanvas(enemyOverlayScratchCache, width, height);
}

function pruneOldestMaskedEnemyOverlay() {
  const oldestKey = enemyMaskedOverlayCache.keys().next().value;
  if (oldestKey !== undefined) enemyMaskedOverlayCache.delete(oldestKey);
}

function getCachedEnemyMaskedOverlay(image, frameWidth, frameHeight, frame, row, drawWidth, drawHeight, color) {
  if (!image) return null;
  const safeDrawWidth = Math.max(1, Math.round(drawWidth));
  const safeDrawHeight = Math.max(1, Math.round(drawHeight));
  const imageKey = image.currentSrc || image.src || "inline";
  const cacheKey = [
    imageKey,
    Math.round(frameWidth),
    Math.round(frameHeight),
    frame,
    row,
    safeDrawWidth,
    safeDrawHeight,
    color
  ].join(":");
  const cached = enemyMaskedOverlayCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = safeDrawWidth;
  canvas.height = safeDrawHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSpriteFrame(ctx, {
    image,
    sx: frame * frameWidth,
    sy: row * frameHeight,
    sw: frameWidth,
    sh: frameHeight,
    dx: 0,
    dy: 0,
    dw: canvas.width,
    dh: canvas.height,
    flip: 1
  });
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";

  enemyMaskedOverlayCache.set(cacheKey, canvas);
  if (enemyMaskedOverlayCache.size > MAX_ENEMY_MASKED_OVERLAY_CACHE_ENTRIES) {
    pruneOldestMaskedEnemyOverlay();
  }
  return canvas;
}

function getCachedObstacleImage(image, width, height) {
  if (!image) return null;
  const sourceWidth = image.naturalWidth || image.width || 0;
  const sourceHeight = image.naturalHeight || image.height || 0;
  if (!sourceWidth || !sourceHeight) return image;
  if (sourceWidth === width && sourceHeight === height) return image;
  const cacheKey = `${image.currentSrc || image.src || "inline"}::${width}x${height}`;
  if (obstacleRenderCache.has(cacheKey)) return obstacleRenderCache.get(cacheKey);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const cacheCtx = canvas.getContext("2d");
  if (!cacheCtx) return image;
  cacheCtx.imageSmoothingEnabled = false;
  cacheCtx.clearRect(0, 0, canvas.width, canvas.height);
  cacheCtx.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  obstacleRenderCache.set(cacheKey, canvas);
  return canvas;
}

function distancePointToRect(px, py, rect) {
  const nx = clamp(px, rect.x, rect.x + rect.w);
  const ny = clamp(py, rect.y, rect.y + rect.h);
  return Math.hypot(px - nx, py - ny);
}

function isWorldRectVisible(game, x, y, w, h, padding = 0) {
  if (game.isWorldRectVisible) return game.isWorldRectVisible(x, y, w, h, padding);
  return !(
    x + w < game.camera.x - padding ||
    y + h < game.camera.y - padding ||
    x > game.camera.x + game.camera.viewWidth + padding ||
    y > game.camera.y + game.camera.viewHeight + padding
  );
}

function isWorldCircleVisible(game, x, y, radius, padding = 0) {
  const visibleRadius = Math.max(0, radius);
  return isWorldRectVisible(game, x - visibleRadius, y - visibleRadius, visibleRadius * 2, visibleRadius * 2, padding);
}

function getEntrySortY(entry, fallbackRatio = 1) {
  if (Number.isFinite(entry?.sortY)) return entry.sortY;
  if (Number.isFinite(entry?.ySortHeightRatio)) return entry.y + entry.h * entry.ySortHeightRatio;
  return entry.y + entry.h * fallbackRatio;
}

function directionRowIndex(heroDef, directionKey) {
  const row = heroDef.sprite.rowOrder.indexOf(directionKey);
  return row >= 0 ? row : heroDef.sprite.rowOrder.indexOf("down");
}

function heroStateKey(game) {
  if (game.state === "defeat") return "dead";
  if (game.combat.playerAction?.animationKey) return game.combat.playerAction.animationKey;
  if (game.player.windFlipState?.active) return "frontFlip";
  if (game.player.hitTimer > 0) return "hit";
  if (game.player.movement.slideTimer > 0) return "slide";
  if (game.player.movement.dashTimer > 0) return "dash";
  if (game.player.isMoving && game.player.movement.state === "sprint") return "run";
  if (game.player.isMoving) return "walk";
  return "idle";
}

function resolveHeroStateDef(game, stateKey) {
  const states = game.heroDef.sprite.states;
  if (stateKey === "dash" && game.player.movement.dashTimer > 0) {
    const total = Math.max(0.001, game.heroDef.dash.duration);
    const progress = clamp(1 - game.player.movement.dashTimer / total, 0, 0.999);
    if (!game.heroDef?.dash?.frameSequence?.length && progress < 0.5 && states.dashStart) {
      return {
        stateKey: "dashStart",
        stateDef: states.dashStart,
        progress: progress / 0.5
      };
    }
    if (!game.heroDef?.dash?.frameSequence?.length && states.dashEnd) {
      return {
        stateKey: "dashEnd",
        stateDef: states.dashEnd,
        progress: (progress - 0.5) / 0.5
      };
    }
    return {
      stateKey,
      stateDef: states[stateKey] || states.cast || states.idle,
      progress
    };
  }
  return {
    stateKey,
    stateDef: states[stateKey] || states.cast || states.idle,
    progress: null
  };
}

function getHeroDrawMetrics(game) {
  const frameWidth = game.heroDef?.sprite?.frameWidth || 128;
  const frameHeight = game.heroDef?.sprite?.frameHeight || 128;
  const sizeStat = getPlayerStat(game.player, "size");
  const baseScale = (game.player.baseDrawSize || frameWidth) / Math.max(1, frameWidth);
  const attackNudge = getHeroAttackNudgeOffset(game);
  return getSnappedSpriteMetrics({
    canvas: game.canvas,
    camera: game.camera,
    zoom: WORLD_RENDER_ZOOM,
    entityX: game.player.x + attackNudge.x,
    entityY: game.player.y + attackNudge.y,
    entityWidth: game.player.w,
    entityHeight: game.player.h,
    spriteWidth: frameWidth,
    spriteHeight: frameHeight,
    targetDrawWidth: frameWidth * baseScale * sizeStat,
    targetDrawHeight: frameHeight * baseScale * sizeStat
  });
}

function getHeroFrameRenderData(game) {
  const stateKey = heroStateKey(game);
  const resolvedState = resolveHeroStateDef(game, stateKey);
  const stateDef = resolvedState.stateDef;
  if (!stateDef) return null;
  const image = game.assets[stateDef.asset];
  if (!image) return null;
  const row = directionRowIndex(game.heroDef, game.player.facing);
  const loopSequence = Array.isArray(game.heroDef?.sprite?.loopSequence?.[stateKey]) && game.heroDef.sprite.loopSequence[stateKey].length
    ? game.heroDef.sprite.loopSequence[stateKey]
    : null;
  let frame = 0;
  if (stateDef.loop) {
    const loopFrameCount = loopSequence?.length || stateDef.frames;
    const loopFrame = frameIndexFromClock(game.player.animClock, stateDef.fps, loopFrameCount);
    frame = loopSequence ? loopSequence[loopFrame] ?? 0 : loopFrame;
  } else if (game.combat.playerAction) {
    const total = Math.max(0.001, game.combat.playerAction.duration || 0.001);
    const progress = clamp(1 - game.combat.castTimer / total, 0, 0.999);
    frame = Math.floor(progress * stateDef.frames);
  } else if (stateKey === "dash") {
    const progress = clamp(resolvedState.progress ?? 0, 0, 0.999);
    const dashFrameSequence = game.heroDef?.dash?.frameSequence;
    if (Array.isArray(dashFrameSequence) && dashFrameSequence.length) {
      const index = Math.min(dashFrameSequence.length - 1, Math.floor(progress * dashFrameSequence.length));
      frame = clamp(dashFrameSequence[index] ?? 0, 0, Math.max(0, stateDef.frames - 1));
    } else {
      frame = Math.floor(progress * stateDef.frames);
    }
  } else if (stateKey === "slide") {
    const total = Math.max(0.001, game.heroDef.slide.duration);
    const progress = clamp(1 - game.player.movement.slideTimer / total, 0, 0.999);
    frame = Math.floor(progress * stateDef.frames);
  } else if (stateKey === "frontFlip") {
    const total = Math.max(0.001, game.player.windFlipState?.duration || 0.3);
    const elapsed = game.player.windFlipState?.elapsed || 0;
    const progress = clamp(elapsed / total, 0, 0.999);
    frame = Math.floor(progress * stateDef.frames);
  } else if (stateKey === "hit") {
    const total = Math.max(0.001, game.player.hitDuration || 0.34);
    const progress = clamp(1 - game.player.hitTimer / total, 0, 0.999);
    frame = Math.floor(progress * stateDef.frames);
  } else if (stateKey === "dead") {
    frame = Math.min(
      stateDef.frames - 1,
      Math.floor(Math.max(0, game.defeatSequenceElapsed || 0) * Math.max(1, stateDef.fps || 1))
    );
  }
  const frameWidth = game.heroDef.sprite.frameWidth;
  const frameHeight = game.heroDef.sprite.frameHeight;
  const metrics = getHeroDrawMetrics(game);
  return {
    image,
    frameWidth,
    frameHeight,
    sx: frame * frameWidth,
    sy: row * frameHeight,
    metrics
  };
}

function drawHero(ctx, game) {
  if (game.player?.runStartHidden) return;
  const frameData = getHeroFrameRenderData(game);
  if (!frameData) return;
  const { image, frameWidth, frameHeight, sx, sy, metrics } = frameData;
  ctx.save();
  ctx.globalAlpha = game.player.isInvisible ? 0.42 : 1;
  drawSpriteFrame(ctx, {
    image,
    sx,
    sy,
    sw: frameWidth,
    sh: frameHeight,
    dx: metrics.x,
    dy: metrics.y,
    dw: metrics.drawWidth,
    dh: metrics.drawHeight
  });
  ctx.restore();
}

function drawHeroDashAfterimages(ctx, game) {
  const afterimages = game.player?.dashAfterimages || [];
  if (!afterimages.length) return;
  const states = game.heroDef?.sprite?.states;
  const rowOrder = game.heroDef?.sprite?.rowOrder || [];
  const frameWidth = game.heroDef?.sprite?.frameWidth || 128;
  const frameHeight = game.heroDef?.sprite?.frameHeight || 128;
  const sizeStat = getPlayerStat(game.player, "size");
  const baseScale = (game.player.baseDrawSize || frameWidth) / Math.max(1, frameWidth);

  for (const afterimage of afterimages) {
    const stateDef = states?.[afterimage.stateKey] || states?.walk || states?.idle;
    if (!stateDef) continue;
    const image = game.assets?.[stateDef.asset];
    if (!image) continue;
    const row = rowOrder.indexOf(afterimage.facing);
    const progress = clamp(afterimage.elapsed / Math.max(0.001, afterimage.duration), 0, 1);
    const alpha = (afterimage.alpha ?? 0.3) * Math.pow(1 - progress, 1.05);
    if (alpha <= 0.01) continue;
    const frame = stateDef.loop
      ? frameIndexFromClock(afterimage.animClock || 0, stateDef.fps, stateDef.frames)
      : 0;
    const metrics = getSnappedSpriteMetrics({
      canvas: game.canvas,
      camera: game.camera,
      zoom: WORLD_RENDER_ZOOM,
      entityX: afterimage.x,
      entityY: afterimage.y,
      entityWidth: game.player.w,
      entityHeight: game.player.h,
      spriteWidth: frameWidth,
      spriteHeight: frameHeight,
      targetDrawWidth: frameWidth * baseScale * sizeStat,
      targetDrawHeight: frameHeight * baseScale * sizeStat
    });
    const stretch = afterimage.stretch ?? 0;
    const alongDash = game.player?.movement?.lastDashDirection || game.player?.movement?.dashDirection || { x: 1, y: 0 };
    const stretchX = 1 + Math.abs(alongDash.x) * stretch * (1 - progress);
    const stretchY = 1 + Math.abs(alongDash.y) * stretch * (1 - progress);
    const drawWidth = metrics.drawWidth * stretchX;
    const drawHeight = metrics.drawHeight * stretchY;
    const drawX = metrics.x - (drawWidth - metrics.drawWidth) * 0.5;
    const drawY = metrics.y - (drawHeight - metrics.drawHeight) * 0.5;
    if (afterimage.tint) {
      const scratch = getEnemyOverlayScratch(drawWidth, drawHeight);
      const sctx = scratch.getContext("2d");
      if (!sctx) continue;
      sctx.clearRect(0, 0, scratch.width, scratch.height);
      drawSpriteFrame(sctx, {
        image,
        sx: frame * frameWidth,
        sy: (row >= 0 ? row : rowOrder.indexOf("down")) * frameHeight,
        sw: frameWidth,
        sh: frameHeight,
        dx: 0,
        dy: 0,
        dw: scratch.width,
        dh: scratch.height
      });
      sctx.globalCompositeOperation = "source-in";
      sctx.fillStyle = afterimage.tint;
      sctx.globalAlpha = alpha * 0.65;
      sctx.fillRect(0, 0, scratch.width, scratch.height);
      sctx.globalCompositeOperation = "multiply";
      sctx.globalAlpha = 0.72;
      drawSpriteFrame(sctx, {
        image,
        sx: frame * frameWidth,
        sy: (row >= 0 ? row : rowOrder.indexOf("down")) * frameHeight,
        sw: frameWidth,
        sh: frameHeight,
        dx: 0,
        dy: 0,
        dw: scratch.width,
        dh: scratch.height
      });
      sctx.globalCompositeOperation = "source-over";
      sctx.globalAlpha = 1;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = afterimage.tint;
      ctx.shadowBlur = 18;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(scratch, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    drawSpriteFrame(ctx, {
      image,
      sx: frame * frameWidth,
      sy: (row >= 0 ? row : rowOrder.indexOf("down")) * frameHeight,
      sw: frameWidth,
      sh: frameHeight,
      dx: drawX,
      dy: drawY,
      dw: drawWidth,
      dh: drawHeight
    });
    ctx.restore();
  }
}

function drawHeroDashStreak(ctx, game) {
  if (game.player?.movement?.dashTimer <= 0) return;
  const vfx = game.heroDef?.dash?.vfx;
  if (!vfx) return;
  const dir = game.player.movement.dashDirection || { x: 1, y: 0 };
  const total = Math.max(0.001, game.heroDef?.dash?.duration || 0.2);
  const progress = clamp(1 - game.player.movement.dashTimer / total, 0, 1);
  const centerX = game.player.x + game.player.w * 0.5 - game.camera.x;
  const centerY = game.player.y + game.player.h * 0.5 - game.camera.y;
  const angle = Math.atan2(dir.y, dir.x);
  const length = 78 * (1 - progress * 0.2);
  const width = 28 * (1 - progress * 0.35);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);
  const tailGradient = ctx.createLinearGradient(0, 0, -length, 0);
  tailGradient.addColorStop(0, vfx.streakCoreColor || "rgba(255,255,255,0.85)");
  tailGradient.addColorStop(0.24, vfx.streakColor || "rgba(255,255,255,0.4)");
  tailGradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = tailGradient;
  ctx.beginPath();
  ctx.moveTo(width * 0.72, 0);
  ctx.lineTo(-length * 0.12, -width * 0.42);
  ctx.lineTo(-length, 0);
  ctx.lineTo(-length * 0.12, width * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHeroDashFlash(ctx, game) {
  const flash = game.player?.dashFlash;
  if (!flash) return;
  const frameData = getHeroFrameRenderData(game);
  if (!frameData) return;
  const progress = clamp(flash.elapsed / Math.max(0.001, flash.duration), 0, 1);
  const eased = Math.pow(1 - progress, 1.45);
  const centerX = game.player.x + game.player.w * 0.5 - game.camera.x;
  const centerY = game.player.y + game.player.h * 0.5 - game.camera.y;
  const radius = flash.kind === "start" ? 40 + progress * 24 : 34 + progress * 32;
  const { image, frameWidth, frameHeight, sx, sy, metrics } = frameData;
  const scratch = getEnemyOverlayScratch(metrics.drawWidth, metrics.drawHeight);
  const sctx = scratch.getContext("2d");
  if (!sctx) return;
  const localCenterX = centerX - metrics.x;
  const localCenterY = centerY - metrics.y;

  sctx.clearRect(0, 0, scratch.width, scratch.height);
  drawSpriteFrame(sctx, {
    image,
    sx,
    sy,
    sw: frameWidth,
    sh: frameHeight,
    dx: 0,
    dy: 0,
    dw: scratch.width,
    dh: scratch.height
  });
  sctx.globalCompositeOperation = "source-in";
  sctx.globalAlpha = eased * 0.9;
  const burst = sctx.createRadialGradient(localCenterX, localCenterY, 0, localCenterX, localCenterY, radius);
  burst.addColorStop(0, flash.accentColor || "rgba(255,255,255,0.95)");
  burst.addColorStop(0.35, flash.color || "rgba(255,255,255,0.7)");
  burst.addColorStop(1, "rgba(255,255,255,0)");
  sctx.fillStyle = burst;
  sctx.fillRect(0, 0, scratch.width, scratch.height);
  sctx.globalAlpha = 1;
  sctx.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scratch, metrics.x, metrics.y, metrics.drawWidth, metrics.drawHeight);
  ctx.restore();
}

function drawSpirit(ctx, game) {
  if (!game.player.spiritMode?.active) return;
  const image = game.assets.soulSiphonSpiritMove;
  if (!image) return;
  const frames = 8;
  const frameWidth = image.naturalWidth / frames;
  const frameHeight = image.naturalHeight;
  const frame = frameIndexFromClock(game.time, 10, frames);
  const drawSize = 84;
  const screenX = game.player.spiritMode.spiritX - game.camera.x - (drawSize - game.player.w) * 0.5;
  const screenY = game.player.spiritMode.spiritY - game.camera.y - (drawSize - game.player.h) * 0.7;
  const sx = frame * frameWidth;
  const sy = 0;
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.drawImage(image, sx, sy, frameWidth, frameHeight, screenX, screenY, drawSize, drawSize);
  ctx.restore();
}

function getPlayerBeamRenderState(game) {
  if (game.combat.playerBeam) return game.combat.playerBeam;
  const activeBeam = game.combat.weaponArtRuntime?.activeBeam;
  if (!activeBeam) return null;
  const visualDelay = activeBeam.visualDelay || 0;
  if ((activeBeam.elapsed || 0) < visualDelay) return null;
  const origin = resolveHeroProjectileOrigin(game.player, game.heroDef, { x: activeBeam.dirX, y: activeBeam.dirY });
  const visualElapsed = Math.max(0, (activeBeam.elapsed || 0) - visualDelay);
  
  // If looping, use a fixed short duration for the animation cycle (e.g. 0.4s)
  // Otherwise use the remaining life of the beam
  const visualDuration = activeBeam.loop 
    ? 0.4 
    : Math.max(0.001, (activeBeam.duration || game.heroDef.combat.actionDuration || 0.2) - visualDelay);

  return {
    x1: origin.x,
    y1: origin.y,
    x2: origin.x + activeBeam.dirX * activeBeam.range,
    y2: origin.y + activeBeam.dirY * activeBeam.range,
    width: activeBeam.width,
    color: activeBeam.color || "#a855f7",
    elapsed: visualElapsed,
    duration: visualDuration,
    loop: activeBeam.loop,
    spriteAsset: activeBeam.spriteAsset || "darkLaserVfx",
    spriteFrames: activeBeam.spriteFrames || 7,
    overlaySpriteAsset: activeBeam.overlaySpriteAsset || null,
    overlaySpriteFrames: activeBeam.overlaySpriteFrames || 0,
    overlayColor: activeBeam.overlayColor || "#f5d0fe",
    overlayAlpha: activeBeam.overlayAlpha ?? 0.72,
    overlayHeightMult: activeBeam.overlayHeightMult ?? 0.82,
    shadowBlur: activeBeam.shadowBlur ?? 12
  };
}

function drawBeamLayer(ctx, game, beam, {
  image,
  totalFrames,
  color,
  alpha,
  heightMult = 1,
  shadowBlur = 12
}) {
  if (!image || totalFrames <= 0 || alpha <= 0) return;
  const frameWidth = image.naturalWidth / totalFrames;
  const frameHeight = image.naturalHeight;
  
  let progress = 0;
  if (beam.loop) {
    // Fixed loop speed: 10 frames per second
    const fps = 14;
    const totalLoopDuration = totalFrames / fps;
    progress = ((beam.elapsed || 0) % totalLoopDuration) / totalLoopDuration;
  } else {
    progress = clamp((beam.elapsed || 0) / Math.max(0.001, beam.duration || 0.001), 0, 0.999);
  }
  
  const frame = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));
  const angle = Math.atan2(beam.y2 - beam.y1, beam.x2 - beam.x1);
  const length = Math.hypot(beam.x2 - beam.x1, beam.y2 - beam.y1);
  const drawHeight = Math.max(42, beam.width * 3.4) * heightMult;
  const drawWidth = length + drawHeight * 0.4;
  ctx.save();
  ctx.translate(beam.x1 - game.camera.x, beam.y1 - game.camera.y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color || beam.color || "#a855f7";
  ctx.shadowBlur = shadowBlur;
  ctx.drawImage(
    image,
    frame * frameWidth,
    0,
    frameWidth,
    frameHeight,
    -drawHeight * 0.08,
    -drawHeight * 0.5,
    drawWidth,
    drawHeight
  );
  ctx.restore();
}

function drawDarkGrasp(ctx, game) {
  if (!game.player.darkGraspState?.casting) return;
  const image = game.assets.darkGraspVfx;
  if (!image) return;
  const state = game.player.darkGraspState;
  const frames = 4;
  const frameWidth = image.naturalWidth / frames;
  const frameHeight = image.naturalHeight;
  const frame = Math.min(3, Math.floor((state.animTimer / state.animDuration) * frames));
  
  const drawWidth = 400 * 0.7;
  const drawHeight = (frameHeight / frameWidth) * drawWidth;
  const screenX = state.originX - game.camera.x;
  const screenY = state.originY - game.camera.y;

  const chains = state.chains && state.chains.length > 0 
    ? state.chains 
    : [{ angle: Math.atan2(state.dirY, state.dirX) }];

  for (const chain of chains) {
    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(chain.angle);
    ctx.drawImage(image, frame * frameWidth, 0, frameWidth, frameHeight, 0, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }
}

function drawLightningDash(ctx, game) {
  const state = game.player.lightningDashState;
  if (!state) return;

  if (state.flashStartTimer > 0 && state.dashing) {
    const image = game.assets.lightningFlashVfx;
    if (image) {
      const frames = 8;
      const frameWidth = image.naturalWidth / frames;
      const frameHeight = image.naturalHeight;
      const frame = Math.min(7, Math.floor(((8 / 15 - state.flashStartTimer) / (8 / 15)) * frames));
      const drawSize = 64;
      const screenX = state.startX + game.player.w / 2 - game.camera.x - drawSize / 2;
      const screenY = state.startY + game.player.h / 2 - game.camera.y - drawSize / 2;
      ctx.drawImage(image, frame * frameWidth, 0, frameWidth, frameHeight, screenX, screenY, drawSize, drawSize);
    }
  }

  if (state.flashEndTimer > 0 && !state.dashing) {
    const image = game.assets.lightningFlashVfx;
    if (image) {
      const frames = 8;
      const frameWidth = image.naturalWidth / frames;
      const frameHeight = image.naturalHeight;
      const frame = Math.min(7, Math.floor(((8 / 15 - state.flashEndTimer) / (8 / 15)) * frames));
      const drawSize = 64;
      const screenX = game.player.x + game.player.w / 2 - game.camera.x - drawSize / 2;
      const screenY = game.player.y + game.player.h / 2 - game.camera.y - drawSize / 2;
      ctx.drawImage(image, frame * frameWidth, 0, frameWidth, frameHeight, screenX, screenY, drawSize, drawSize);
    }
  }

  if (state.strikeTimer <= 0 && state.strikes) {
    const image = game.assets.lightningStrikeVfx;
    if (image) {
      const frames = 8;
      const frameWidth = image.naturalWidth / frames;
      const frameHeight = image.naturalHeight;
      for (const strike of state.strikes) {
        if (strike.animTimer != null && strike.animTimer > 0) {
          const frame = Math.min(7, Math.floor(((8 / 15 - strike.animTimer) / (8 / 15)) * frames));
          const drawWidth = 80;
          const drawHeight = (frameHeight / frameWidth) * drawWidth;
          const screenX = strike.x - game.camera.x - drawWidth / 2;
          const screenY = strike.y - game.camera.y - drawHeight * 0.86;
          ctx.drawImage(image, frame * frameWidth, 0, frameWidth, frameHeight, screenX, screenY, drawWidth, drawHeight);
        }
      }
    }
  }
}

function drawPlayerHealthOverlay(ctx, game) {
  if (!game.player || game.player.maxHp <= 0) return;
  const hpRatio = clamp(game.player.hp / game.player.maxHp, 0, 1);
  const potionProgress = clamp((game.player.lifePotionConsumeTimer || 0) / Math.max(0.001, game.player.lifePotionConsumeDuration || 1.5), 0, 1);
  const { drawWidth, x, y } = getHeroDrawMetrics(game);
  const centerX = Math.round(x + drawWidth * 0.5);
  const barWidth = Math.max(58, Math.round(game.player.w + 22));
  const barHeight = 8;
  const barX = Math.round(centerX - barWidth * 0.5);
  const barY = Math.round(y - 4);

  ctx.save();
  ctx.fillStyle = "rgba(2, 6, 23, 0.82)";
  ctx.fillRect(barX - 2, barY - 13, barWidth + 4, 26);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.strokeRect(barX - 2, barY - 13, barWidth + 4, 26);

  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.fillStyle = hpRatio > 0.35 ? "#ef4444" : "#fb7185";
  ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

  ctx.font = "bold 11px Georgia";
  ctx.textAlign = "center";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(`${Math.ceil(game.player.hp)} / ${game.player.maxHp}`, centerX, barY - 3);

  ctx.font = "10px Georgia";
  ctx.fillStyle = "#bfdbfe";
  const potionCharges = Math.max(0, game.player.lifePotionCharges || 0);
  const potionMaxCharges = Math.max(1, game.player.lifePotionMaxCharges || 1);
  ctx.fillText(`R Potion ${potionCharges}/${potionMaxCharges}`, centerX, barY + 20);
  if (potionProgress > 0) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
    ctx.fillRect(barX, barY + 24, barWidth, 5);
    ctx.fillStyle = "#60a5fa";
    ctx.fillRect(barX, barY + 24, barWidth * potionProgress, 5);
  }

  if ((game.player.damageShield || 0) > 0) {
    ctx.font = "10px Georgia";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(`Shield ${Math.ceil(game.player.damageShield)}`, centerX, barY + (potionProgress > 0 ? 36 : 32));
  }
  ctx.restore();
}

function drawMirrorClone(ctx, game) {
  const clone = game.ringState?.mirrorClone;
  if (!clone || clone.hp <= 0) return;
  const screenX = clone.x - game.camera.x;
  const screenY = clone.y - game.camera.y;
  ctx.save();
  ctx.globalAlpha = 0.58;
  ctx.fillStyle = "rgba(191,219,254,0.9)";
  ctx.beginPath();
  ctx.ellipse(screenX + clone.w * 0.5, screenY + clone.h * 0.58, clone.w * 0.55, clone.h * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const hpRatio = clamp(clone.hp / Math.max(1, clone.maxHp), 0, 1);
  ctx.fillStyle = "rgba(15,23,42,0.75)";
  ctx.fillRect(screenX - 4, screenY - 10, clone.w + 8, 5);
  ctx.fillStyle = "rgba(96,165,250,0.95)";
  ctx.fillRect(screenX - 3, screenY - 9, Math.max(0, (clone.w + 6) * hpRatio), 3);
  ctx.restore();
}

function drawDashChargesAbovePlayer(ctx, game) {
  const fullIcon = game.assets?.dashChargeIconFull;
  const emptyIcon = game.assets?.dashChargeIconEmpty;
  if (!fullIcon || !emptyIcon) return;
  const maxCharges = Math.max(1, getMaxDashCharges(game));
  const charges = Math.max(0, Math.min(maxCharges, game.player?.movement?.dashCharges || 0));
  const { drawWidth, x, y } = getHeroDrawMetrics(game);
  const centerX = Math.round(x + drawWidth * 0.5);
  const iconSize = 14;
  const spacing = 2;
  const totalWidth = maxCharges * iconSize + Math.max(0, maxCharges - 1) * spacing;
  const startX = Math.floor(centerX - totalWidth * 0.5);
  const drawY = Math.floor(y - 34);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let index = 0; index < maxCharges; index += 1) {
    const icon = index < charges ? fullIcon : emptyIcon;
    const iconX = startX + index * (iconSize + spacing);
    ctx.drawImage(icon, iconX, drawY, iconSize, iconSize);
  }
  ctx.restore();
}

function drawDamageFlash(ctx, game) {
  const timer = game.player?.damageFlashTimer || 0;
  if (timer <= 0) return;
  const duration = Math.max(0.001, game.player?.damageFlashDuration || 0.18);
  const progress = clamp(timer / duration, 0, 1);
  const alpha = 0.34 * progress;
  if (alpha <= 0) return;

  ctx.save();
  ctx.fillStyle = `rgba(220, 38, 38, ${alpha})`;
  ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);
  ctx.restore();
}

function drawSoulSiphonSpirit(ctx, game) {
  const soulSiphonSpirit = game.combat.weaponArtRuntime?.soulSiphonSpirit;
  if (!soulSiphonSpirit) return;

  const spirits = Array.isArray(soulSiphonSpirit) ? soulSiphonSpirit : [soulSiphonSpirit];

  for (const spirit of spirits) {
    const stateKey = spirit.attackTimer > 0 ? "attack" : "move";
    const image = game.assets[stateKey === "attack" ? "soulSiphonSpiritAttack" : "soulSiphonSpiritMove"];
    if (!image) continue;
    const frames = stateKey === "attack" ? 10 : 8;
    const frameWidth = image.naturalWidth / frames;
    const frameHeight = image.naturalHeight;
    const frame = frameIndexFromClock(spirit.animClock, stateKey === "attack" ? 18 : 10, frames);
    const drawSize = 84;
    const screenX = Math.round(spirit.x - game.camera.x - drawSize * 0.5);
    const screenY = Math.round(spirit.y - game.camera.y - drawSize * 0.6);
    ctx.drawImage(image, frame * frameWidth, 0, frameWidth, frameHeight, screenX, screenY, drawSize, drawSize);

    if (spirit.charge > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(196, 181, 253, 0.95)";
      ctx.font = "11px Georgia";
      ctx.textAlign = "center";
      ctx.fillText(`${spirit.charge}`, screenX + drawSize * 0.5, screenY - 6);
      ctx.restore();
    }
  }
}

function getEnemyDrawMetrics(game, enemy, frameWidth, frameHeight, drawWidth, drawHeight, hitOffsetX = 0, hitOffsetY = 0) {
  return getSnappedSpriteMetrics({
    canvas: game.canvas,
    camera: game.camera,
    zoom: WORLD_RENDER_ZOOM,
    entityX: enemy.x,
    entityY: enemy.y,
    entityWidth: enemy.w,
    entityHeight: enemy.h,
    spriteWidth: frameWidth,
    spriteHeight: frameHeight,
    targetDrawWidth: drawWidth,
    targetDrawHeight: drawHeight,
    offsetX: hitOffsetX,
    offsetY: hitOffsetY
  });
}

function drawEnemyFrame(ctx, enemy, image, frameWidth, frameHeight, frame, x, y, drawWidth, drawHeight) {
  const row = enemy.attackRuntime ? rowIndexFromDirection(enemy) : 0;
  drawSpriteFrame(ctx, {
    image,
    sx: frame * frameWidth,
    sy: row * frameHeight,
    sw: frameWidth,
    sh: frameHeight,
    dx: x,
    dy: y,
    dw: drawWidth,
    dh: drawHeight,
    flip: enemy.attackRuntime ? 1 : enemy.facing
  });
}

function drawEnemyAfterimages(ctx, game, enemy, image, frameWidth, frameHeight) {
  const afterimages = enemy.state?.minibossDash?.afterimages || [];
  if (!afterimages.length) return;
  for (const afterimage of afterimages) {
    const progress = clamp(afterimage.elapsed / Math.max(0.001, afterimage.duration), 0, 1);
    const alpha = (afterimage.alpha ?? 0.2) * Math.pow(1 - progress, 1.05);
    if (alpha <= 0.01) continue;
    const snapshotEnemy = {
      ...enemy,
      x: afterimage.x,
      y: afterimage.y,
      drawSize: afterimage.drawSize || enemy.drawSize || enemy.w,
      displayDirection: afterimage.displayDirection || enemy.displayDirection || enemy.direction,
      direction: afterimage.displayDirection || enemy.direction,
      facing: afterimage.facing || enemy.facing
    };
    const drawWidth = snapshotEnemy.drawSize;
    const drawHeight = snapshotEnemy.drawSize;
    const metrics = getEnemyDrawMetrics(game, snapshotEnemy, frameWidth, frameHeight, drawWidth, drawHeight);
    ctx.save();
    ctx.globalAlpha = alpha;
    drawEnemyFrame(
      ctx,
      snapshotEnemy,
      image,
      frameWidth,
      frameHeight,
      afterimage.frame ?? 0,
      metrics.x,
      metrics.y,
      metrics.drawWidth,
      metrics.drawHeight
    );
    ctx.restore();
  }
}

function getAttackTriggerFrameForOverlay(attack) {
  if (Number.isFinite(attack?.hitboxTrigger)) return Math.max(0, Math.floor(attack.hitboxTrigger));
  const animFps = Number(attack?.animFps) || 14;
  const totalFrames = Math.max(1, Math.round((Number(attack?.activeAnimDuration) || 15 / 14) * animFps));
  return Math.floor(totalFrames * 0.5);
}

function getAttackWindupStopFrameForOverlay(attack, triggerFrame) {
  if (!Number.isFinite(attack?.windupStop)) return null;
  const stopFrame = clamp(Math.floor(attack.windupStop), 0, triggerFrame);
  if (triggerFrame <= 0 || stopFrame >= triggerFrame) return null;
  return stopFrame;
}

function getEnemyWindupOverlayAlpha(enemy, spriteFrames) {
  const runtime = enemy.attackRuntime;
  const attack = runtime?.currentAttack;
  if (!attack || runtime.state !== "windup") return 0;

  const total = Math.max(0.001, runtime.windupDuration || attack.telegraph || 0.001);
  const progress = clamp(1 - runtime.timer / total, 0, 0.9999);
  const triggerFrame = Math.min(Math.max(0, spriteFrames - 1), getAttackTriggerFrameForOverlay(attack));
  const stopFrame = getAttackWindupStopFrameForOverlay(attack, triggerFrame);

  if (stopFrame == null) {
    const peakStart = 0.65;
    const peakEnd = 0.75;
    if (progress <= peakStart) return clamp(progress / peakStart, 0, 1);
    if (progress <= peakEnd) return 1;
    return clamp(1 - (progress - peakEnd) / Math.max(0.001, 1 - peakEnd), 0, 1);
  }

  const windupSlots = triggerFrame + 1;
  const peakStart = stopFrame / windupSlots;
  const peakEnd = Math.min(0.9999, (stopFrame + 1) / windupSlots);

  if (progress <= peakStart) {
    if (peakStart <= 0) return 1;
    return clamp(progress / peakStart, 0, 1);
  }
  if (progress <= peakEnd) return 1;
  return clamp(1 - (progress - peakEnd) / Math.max(0.001, 1 - peakEnd), 0, 1);
}

function drawEnemyMaskedOverlay(ctx, enemy, image, frameWidth, frameHeight, frame, x, y, drawWidth, drawHeight, color, alpha) {
  if (alpha <= 0) return;
  const row = rowIndexFromDirection(enemy);
  const overlay = getCachedEnemyMaskedOverlay(image, frameWidth, frameHeight, frame, row, drawWidth, drawHeight, color);
  if (!overlay) return;

  ctx.save();
  ctx.globalAlpha = (enemy.renderAlpha ?? 1) * alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(overlay, x, y, drawWidth, drawHeight);
  ctx.restore();
}

function snapWorldPixelToRenderZoom(value) {
  return Math.round(value * WORLD_RENDER_ZOOM) / WORLD_RENDER_ZOOM;
}

function snapProjectilePixelScale(rawScale) {
  if (!Number.isFinite(rawScale) || rawScale <= 0) return 1;
  if (rawScale >= 1) {
    const lower = Math.max(1, Math.floor(rawScale));
    const upper = Math.max(1, Math.ceil(rawScale));
    return Math.abs(rawScale - lower) <= Math.abs(upper - rawScale) ? lower : upper;
  }
  const inverse = 1 / rawScale;
  const lowerDenominator = Math.max(1, Math.floor(inverse));
  const upperDenominator = Math.max(1, Math.ceil(inverse));
  const lowerScale = 1 / lowerDenominator;
  const upperScale = 1 / upperDenominator;
  const lowerDiff = Math.abs(rawScale - lowerScale);
  const upperDiff = Math.abs(rawScale - upperScale);
  if (lowerDiff === upperDiff) return Math.min(lowerScale, upperScale);
  return lowerDiff < upperDiff ? lowerScale : upperScale;
}

function getSnappedProjectileSize(targetWidth, targetHeight, sourceWidth, sourceHeight, uniformScale = true) {
  const safeSourceWidth = Math.max(1, sourceWidth || 1);
  const safeSourceHeight = Math.max(1, sourceHeight || 1);
  if (uniformScale) {
    const rawScale = ((targetWidth * WORLD_RENDER_ZOOM) / safeSourceWidth + (targetHeight * WORLD_RENDER_ZOOM) / safeSourceHeight) * 0.5;
    const snappedScale = snapProjectilePixelScale(rawScale);
    return {
      drawWidth: (safeSourceWidth * snappedScale) / WORLD_RENDER_ZOOM,
      drawHeight: (safeSourceHeight * snappedScale) / WORLD_RENDER_ZOOM
    };
  }
  const snappedScaleX = snapProjectilePixelScale((targetWidth * WORLD_RENDER_ZOOM) / safeSourceWidth);
  const snappedScaleY = snapProjectilePixelScale((targetHeight * WORLD_RENDER_ZOOM) / safeSourceHeight);
  return {
    drawWidth: (safeSourceWidth * snappedScaleX) / WORLD_RENDER_ZOOM,
    drawHeight: (safeSourceHeight * snappedScaleY) / WORLD_RENDER_ZOOM
  };
}

function drawAssistGroundZoneSprite(ctx, game, zone, screenX, screenY) {
  const phase = zone.animation?.phases?.[zone.animationPhase];
  if (!phase?.spriteAsset) return false;
  const sprite = game.assets?.[phase.spriteAsset];
  if (!sprite) return false;
  const frameWidth = phase.frameWidth || sprite.naturalHeight || sprite.height || 1;
  const frameHeight = phase.frameHeight || sprite.naturalHeight || sprite.height || 1;
  const totalFrames = Math.max(1, phase.frames || Math.floor((sprite.naturalWidth || sprite.width || frameWidth) / Math.max(1, frameWidth)));
  const rawFrame = Math.floor(zone.animationElapsed * Math.max(1, phase.fps || 1));
  const frame = phase.loop ? rawFrame % totalFrames : Math.min(totalFrames - 1, rawFrame);
  const targetDrawWidth = zone.animation.drawWidth ?? zone.radius * 2;
  const targetDrawHeight = zone.animation.drawHeight ?? zone.radiusY * 2.6;
  const preserveAspect = Math.abs((targetDrawWidth / Math.max(1, frameWidth)) - (targetDrawHeight / Math.max(1, frameHeight))) < 0.001;
  const snappedSize = getSnappedProjectileSize(targetDrawWidth, targetDrawHeight, frameWidth, frameHeight, preserveAspect);
  ctx.save();
  ctx.globalAlpha = zone.animationPhase === "death" ? 0.9 : 0.96;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sprite,
    frame * frameWidth,
    0,
    frameWidth,
    frameHeight,
    snapWorldPixelToRenderZoom(screenX - snappedSize.drawWidth * 0.5),
    snapWorldPixelToRenderZoom(screenY - snappedSize.drawHeight * 0.68),
    snappedSize.drawWidth,
    snappedSize.drawHeight
  );
  ctx.restore();
  return true;
}

function drawProjectileSprite(ctx, image, projectile, screenX, screenY) {
  if (!image) return false;
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const drawWidth = projectile.spriteDrawWidth || projectile.drawSize || projectile.radius * 2;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(snapWorldPixelToRenderZoom(screenX), snapWorldPixelToRenderZoom(screenY));
  ctx.rotate(angle);
  if (projectile.spriteFrameWidth || projectile.spriteFrameHeight || projectile.spriteFrames) {
    const frameWidth = projectile.spriteFrameWidth || image.naturalWidth;
    const frameHeight = projectile.spriteFrameHeight || image.naturalHeight;
    const totalFrames = Math.max(1, projectile.spriteFrames || Math.floor(image.naturalWidth / Math.max(1, frameWidth)));
    const fps = Math.max(1, projectile.spriteFps || 12);
    const loopStart = Math.max(0, Math.min(totalFrames - 1, projectile.spriteLoopStart ?? 0));
    const loopEnd = Math.max(loopStart, Math.min(totalFrames - 1, projectile.spriteLoopEnd ?? (totalFrames - 1)));
    const loopFrames = Math.max(1, loopEnd - loopStart + 1);
    const frameOffset = Math.max(0, Math.floor(projectile.spriteFrameOffset ?? 0));
    const endStart = Math.max(loopStart, Math.min(totalFrames - 1, projectile.spriteEndStart ?? (loopEnd + 1)));
    const endFrames = Math.max(0, Math.min(totalFrames - endStart, projectile.spriteEndFrames ?? 0));
    const defaultEndDistance = (projectile.speed || 0) * (endFrames / fps);
    const endDistance = Math.max(1, projectile.spriteEndDistance ?? defaultEndDistance);
    const remainingDistance = Math.max(0, (projectile.maxRange ?? Infinity) - (projectile.traveled ?? 0));
    const useEndFrames = endFrames > 0 && Number.isFinite(projectile.maxRange) && remainingDistance <= endDistance;
    const frame = totalFrames > 1
      ? useEndFrames
        ? endStart + Math.min(
          endFrames - 1,
          Math.floor(clamp(1 - (remainingDistance / endDistance), 0, 0.999) * endFrames)
        )
        : loopStart + ((frameOffset + Math.floor((projectile.age || 0) * fps)) % loopFrames)
      : 0;
    const sourceWidth = Math.min(frameWidth, projectile.spriteCropWidth || frameWidth);
    const sourceHeight = Math.min(frameHeight, projectile.spriteCropHeight || frameHeight);
    const sourceX = frame * frameWidth + Math.max(0, Math.floor((frameWidth - sourceWidth) * 0.5));
    const sourceY = Math.max(0, Math.floor((frameHeight - sourceHeight) * 0.5));
    const targetDrawHeight = projectile.spriteDrawHeight || (drawWidth * (sourceHeight / Math.max(1, sourceWidth)));
    const preserveAspect = !Number.isFinite(projectile.spriteDrawWidth) && !Number.isFinite(projectile.spriteDrawHeight);
    const snappedSize = getSnappedProjectileSize(drawWidth, targetDrawHeight, sourceWidth, sourceHeight, preserveAspect);
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      -snappedSize.drawWidth * 0.5,
      -snappedSize.drawHeight * 0.5,
      snappedSize.drawWidth,
      snappedSize.drawHeight
    );
  } else {
    const targetDrawHeight = drawWidth * 0.4;
    const sourceWidth = image.naturalWidth || image.width || drawWidth;
    const sourceHeight = image.naturalHeight || image.height || targetDrawHeight;
    const snappedSize = getSnappedProjectileSize(drawWidth, targetDrawHeight, sourceWidth, sourceHeight, false);
    ctx.drawImage(
      image,
      -snappedSize.drawWidth * 0.5,
      -snappedSize.drawHeight * 0.5,
      snappedSize.drawWidth,
      snappedSize.drawHeight
    );
  }
  ctx.restore();
  return true;
}

function rowIndexFromDirection(enemy) {
  const rowOrder = enemy.rowOrder || ["right", "right_down", "down", "left_down", "left", "left_up", "up", "right_up"];
  const index = rowOrder.indexOf(enemy.displayDirection || enemy.direction || "down");
  return index >= 0 ? index : rowOrder.indexOf("down");
}

function drawUndeadTelegraph(ctx, game, enemy) {
  const runtime = enemy.attackRuntime;
  const attack = runtime?.currentAttack;
  if (!attack || runtime.state !== "windup") return;
  const progress = clamp(1 - runtime.timer / Math.max(0.001, runtime.windupDuration), 0, 1);
  const fillAlpha = 0.12 + progress * 0.2;
  const strokeAlpha = 0.3 + progress * 0.34;
  const originX = enemy.x + enemy.w * 0.5 - game.camera.x;
  const originY = enemy.y + enemy.h * 0.5 - game.camera.y;
  const target = runtime.telegraphTarget || { x: enemy.x + enemy.w * 0.5, y: enemy.y + enemy.h * 0.5 };
  const dirX = target.x - (enemy.x + enemy.w * 0.5);
  const dirY = target.y - (enemy.y + enemy.h * 0.5);
  const angle = Math.atan2(dirY, dirX);

  ctx.save();
  ctx.strokeStyle = attack.kind.includes("fire") ? `rgba(251,146,60,${strokeAlpha})` : `rgba(248,113,113,${strokeAlpha})`;
  ctx.fillStyle = attack.kind.includes("magic") ? `rgba(96,165,250,${fillAlpha * 0.75})` : `rgba(248,113,113,${fillAlpha * 0.75})`;
  ctx.lineWidth = 2;
  if (attack.kind.includes("circle") || attack.kind === "warcry" || attack.kind === "arrow_rain" || attack.kind === "targeted_rain_zone" || attack.kind === "poison_pool" || attack.kind === "poisonous_blessing" || attack.kind === "darkfire_pillar" || attack.kind === "earthquake" || attack.kind === "volcano" || attack.kind === "fire_cleanse" || attack.kind === "fire_leap" || attack.kind === "channeling_ground_bursts" || attack.kind === "targeted_leap_slam") {
    const atTarget = enemy.role === "ranged" && attack.maxRange > 280 && attack.kind !== "warcry";
    const cx = (atTarget ? target.x : enemy.x + enemy.w * 0.5) - game.camera.x;
    const cy = (atTarget ? target.y : enemy.y + enemy.h * 0.5) - game.camera.y;
    const radiusX = attack.radius || attack.burstScatterRadius || 60;
    const radiusY = radiusX * 0.75;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (attack.kind.includes("cone") || attack.kind === "fire_thrower") {
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    const arc = ((attack.arc || 90) * Math.PI) / 180;
    ctx.arc(originX, originY, attack.range || 140, angle - arc * 0.5, angle + arc * 0.5);
    ctx.closePath();
    ctx.stroke();
  } else if (attack.kind.includes("projectile") || attack.kind === "beam_line") {
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + Math.cos(angle) * (attack.beamLength || 180), originY + Math.sin(angle) * (attack.beamLength || 180));
    ctx.stroke();
  }
  ctx.restore();
}

function drawFireThrowerVfx(ctx, game, enemy, effect) {
  const image = game.assets?.[effect.attack.fireVfxSprite || ""];
  if (!image) return;
  const frameWidth = effect.attack.fireVfxFrameWidth ?? 81;
  const frameHeight = effect.attack.fireVfxFrameHeight ?? 47;
  const totalFrames = Math.max(1, Math.floor(image.naturalWidth / frameWidth));
  const fps = effect.attack.fireVfxFps ?? 15;
  const startFrames = effect.attack.fireVfxStartFrames ?? 5;
  const loopStart = effect.attack.fireVfxLoopStart ?? 5;
  const loopEnd = effect.attack.fireVfxLoopEnd ?? 9;
  const endStart = effect.attack.fireVfxEndStart ?? 10;
  const elapsed = Math.max(0, game.time - (effect.startedAt ?? game.time));
  let frame = 0;
  if (elapsed < startFrames / fps) {
    frame = Math.min(startFrames - 1, Math.floor(elapsed * fps));
  } else if (game.time < (effect.damageUntil ?? 0)) {
    const loopCount = Math.max(1, loopEnd - loopStart + 1);
    frame = loopStart + (Math.floor((elapsed - startFrames / fps) * fps) % loopCount);
  } else {
    const endElapsed = Math.max(0, game.time - (effect.damageUntil ?? game.time));
    frame = Math.min(totalFrames - 1, endStart + Math.floor(endElapsed * fps));
  }
  const originX = enemy.x + enemy.w * 0.5 - game.camera.x;
  const originY = enemy.y + enemy.h * 0.5 - game.camera.y;
  const angle = Math.atan2(effect.dirY, effect.dirX);
  const drawWidth = effect.attack.fireVfxDrawWidth ?? effect.attack.range ?? 180;
  const drawHeight = effect.attack.fireVfxDrawHeight ?? 72;
  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.92;
  ctx.drawImage(
    image,
    frame * frameWidth,
    0,
    frameWidth,
    frameHeight,
    0,
    -drawHeight * 0.5,
    drawWidth,
    drawHeight
  );
  ctx.restore();
}

function drawEnemyPlates(ctx, enemy, centerX, startY) {
  const maxPlates = Math.max(0, Math.floor(enemy.maxPlates || 0));
  const currentPlates = Math.max(0, Math.floor(enemy.plates || 0));
  if (maxPlates <= 0) return;
  if (currentPlates <= 0) return;
  const pipWidth = 8;
  const pipHeight = 5;
  const pipGap = 3;
  const totalWidth = currentPlates * pipWidth + Math.max(0, currentPlates - 1) * pipGap;
  const startX = Math.round(centerX - totalWidth * 0.5);
  const rowY = Math.round(startY);
  for (let index = 0; index < currentPlates; index += 1) {
    const pipX = startX + index * (pipWidth + pipGap);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(pipX, rowY, pipWidth, pipHeight);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1;
    ctx.strokeRect(pipX - 0.5, rowY - 0.5, pipWidth + 1, pipHeight + 1);
  }
}

function drawEnemies(ctx, game) {
  const enemies = game.getLivingEnemies?.() || game.enemies || [];
  for (const enemy of enemies) {
    const activeAttack = enemy.attackRuntime?.currentAttack;
    const effectRange = Math.max(
      activeAttack?.range || 0,
      activeAttack?.radius || 0,
      enemy.state?.dragonBreath?.range || 0,
      enemy.affixState?.laserBeam?.width || 0,
      96
    );
    if (!isWorldRectVisible(game, enemy.x - effectRange, enemy.y - effectRange, enemy.w + effectRange * 2, enemy.h + effectRange * 2, 32)) {
      continue;
    }
    if (enemy.attackRuntime) drawUndeadTelegraph(ctx, game, enemy);
    if (enemy.specialBehavior === "dragon_breath" && enemy.state?.dragonBreath?.phase === "windup") {
      const breath = enemy.state.dragonBreath;
      const progress = clamp(1 - breath.timer / 0.7, 0, 1);
      const angle = Math.atan2(breath.dirY, breath.dirX);
      const arc = (breath.arcDeg * Math.PI) / 180;
      const originX = enemy.x + enemy.w * 0.5 - game.camera.x;
      const originY = enemy.y + enemy.h * 0.5 - game.camera.y;
      ctx.save();
      ctx.fillStyle = `rgba(251,146,60,${0.08 + progress * 0.12})`;
      ctx.strokeStyle = `rgba(251,146,60,${0.3 + progress * 0.34})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.arc(originX, originY, breath.range, angle - arc * 0.5, angle + arc * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    const moving = enemy.role !== "ranged" || enemy.cooldown <= 0;
    const sprite = enemy.sprite[enemy.render?.sheetKey || (moving ? "move" : "idle")] || enemy.sprite.idle;
    const image = game.assets[sprite.asset];
    if (!image) continue;
    const frame = enemy.attackRuntime
      ? (enemy.render?.frame ?? 0)
      : Number.isFinite(sprite.fixedFrame)
        ? sprite.fixedFrame
        : frameIndexFromClock(enemy.animClock, sprite.fps, sprite.frames);
    const frameWidth = image.naturalWidth / sprite.frames;
    const frameHeight = enemy.attackRuntime ? image.naturalHeight / 8 : image.naturalHeight;
    const windupOverlayAlpha = getEnemyWindupOverlayAlpha(enemy, sprite.frames);
    const hitFlash = clamp((enemy.hitTimer || 0) / Math.max(0.001, enemy.hitDuration || 0.1), 0, 1);
    const critFlash = clamp((enemy.critFlashTimer || 0) / Math.max(0.001, enemy.critFlashDuration || 0.2), 0, 1);
    const hitOffsetX = Math.round((enemy.hitDirX || 0) * 4 * hitFlash);
    const hitOffsetY = Math.round((enemy.hitDirY || 0) * 2 * hitFlash);
    const collisionBounceAlpha = clamp(
      (enemy.collisionBounceTimer || 0) / Math.max(0.001, enemy.collisionBounceDuration || 0.1),
      0,
      1
    );
    const collisionOffsetX = Math.round((enemy.collisionBounceOffsetX || 0) * collisionBounceAlpha);
    const collisionOffsetY = Math.round((enemy.collisionBounceOffsetY || 0) * collisionBounceAlpha);
    const drawWidth = (enemy.drawSize || enemy.w) * (1 + hitFlash * 0.05);
    const drawHeight = (enemy.drawSize || enemy.h) * (1 - hitFlash * 0.04);
    const metrics = getEnemyDrawMetrics(
      game,
      enemy,
      frameWidth,
      frameHeight,
      drawWidth,
      drawHeight,
      hitOffsetX + collisionOffsetX,
      hitOffsetY + collisionOffsetY
    );
    const x = metrics.x;
    const y = metrics.y;
    const snappedDrawWidth = metrics.drawWidth;
    const snappedDrawHeight = metrics.drawHeight;
    drawEnemyAfterimages(ctx, game, enemy, image, frameWidth, frameHeight);
    const centerX = enemy.x + enemy.w * 0.5 - game.camera.x;
    const centerY = enemy.y + enemy.h * 0.5 - game.camera.y;
    const speedBuffActive = (enemy.attackRuntime?.buffs?.speedUntil || 0) > game.time;
    const damageBuffActive = (enemy.damageBuffUntil || 0) > game.time;
    if (enemy.movementProfile?.kind === "slimeHop") {
      const slimeShadow = enemy.shadow
        ? {
            ...SLIME_CONTACT_SHADOW,
            ...enemy.shadow
          }
        : SLIME_CONTACT_SHADOW;
      const slimeShadowBounds = enemy.shadow?.useSpriteBounds
        ? {
            x: x,
            y: y,
            w: snappedDrawWidth,
            h: snappedDrawHeight
          }
        : {
            x: enemy.x - game.camera.x,
            y: enemy.y - game.camera.y,
            w: enemy.w,
            h: enemy.h
          };
      drawGroundContactShadow(ctx, {
        x: slimeShadowBounds.x,
        y: slimeShadowBounds.y,
        w: slimeShadowBounds.w,
        h: slimeShadowBounds.h,
        shadow: {
          ...slimeShadow,
          shadowWidth: slimeShadow.shadowWidth * Math.max(0.92, (enemy.drawSize || enemy.w) / Math.max(1, enemy.w) * 0.6),
          shadowAlpha: slimeShadow.shadowAlpha * (enemy.isMiniBoss ? 1.08 : 1)
        }
      });
    }
    for (const effect of enemy.attackRuntime?.activeEffects || []) {
      if (effect.kind === "fire_thrower") drawFireThrowerVfx(ctx, game, enemy, effect);
      if (effect.kind === "orbiting_projectile_barrage") {
        const image = game.assets?.[effect.attack.projectileSprite || ""];
        if (!image) continue;
        const frameWidth = effect.attack.projectileSpriteFrameWidth ?? 64;
        const frameHeight = effect.attack.projectileSpriteFrameHeight ?? 64;
        const totalFrames = Math.max(1, effect.attack.projectileSpriteFrames ?? Math.floor(image.naturalWidth / Math.max(1, frameWidth)));
        const loopStart = effect.attack.projectileSpriteLoopStart ?? 0;
        const loopEnd = effect.attack.projectileSpriteLoopEnd ?? Math.max(loopStart, totalFrames - 1);
        const loopFrames = Math.max(1, loopEnd - loopStart + 1);
        const fps = effect.attack.projectileSpriteFps ?? 16;
        const now = Math.max(0, game.time - (effect.startedAt ?? game.time));
        const orbitRadius = effect.attack.orbitRadius ?? 86;
        const drawSize = effect.attack.projectileDrawSize ?? effect.attack.projectileSize ?? 44;
        for (const orb of effect.projectiles || []) {
          if (orb.launched) continue;
          const angle = orb.angleOffset + now * (effect.attack.orbitSpinRate ?? 2.8);
          const orbX = centerX + Math.cos(angle) * orbitRadius;
          const orbY = centerY + Math.sin(angle) * orbitRadius * 0.7;
          const frameOffset = Math.max(0, Math.floor(orb.spriteFrameOffset ?? 0));
          const frame = loopStart + ((frameOffset + Math.floor(now * fps)) % loopFrames);
          ctx.save();
          ctx.globalAlpha = 0.96;
          ctx.translate(orbX, orbY);
          ctx.rotate(angle + Math.PI * 0.5);
          ctx.drawImage(
            image,
            frame * frameWidth,
            0,
            frameWidth,
            frameHeight,
            -drawSize * 0.5,
            -drawSize * 0.5,
            drawSize,
            drawSize
          );
          ctx.restore();
        }
      }
    }
    if (speedBuffActive || damageBuffActive) {
      const auraRadius = Math.max(enemy.w * 0.55, 28);
      ctx.save();
      if (speedBuffActive) {
        ctx.fillStyle = "rgba(34, 197, 94, 0.16)";
        ctx.strokeStyle = "rgba(74, 222, 128, 0.48)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, auraRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (damageBuffActive) {
        ctx.fillStyle = "rgba(239, 68, 68, 0.16)";
        ctx.strokeStyle = "rgba(248, 113, 113, 0.48)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, auraRadius + (speedBuffActive ? 6 : 0), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = enemy.renderAlpha ?? 1;
    drawEnemyFrame(ctx, enemy, image, frameWidth, frameHeight, frame, x, y, snappedDrawWidth, snappedDrawHeight);
    ctx.restore();
    if (windupOverlayAlpha > 0.01) {
      drawEnemyMaskedOverlay(
        ctx,
        enemy,
        image,
        frameWidth,
        frameHeight,
        frame,
        x,
        y,
        snappedDrawWidth,
        snappedDrawHeight,
        "#b91c1c",
        windupOverlayAlpha
      );
    }
    if (hitFlash > 0.01) {
      ctx.save();
      ctx.globalAlpha = hitFlash * 0.38;
      ctx.filter = `brightness(${1 + hitFlash * 1.6}) saturate(${1 + hitFlash * 0.9})`;
      ctx.shadowColor = `rgba(255, 148, 148, ${0.45 * hitFlash})`;
      ctx.shadowBlur = 10 * hitFlash;
      drawEnemyFrame(ctx, enemy, image, frameWidth, frameHeight, frame, x, y, snappedDrawWidth, snappedDrawHeight);
      ctx.restore();
    }
    if (critFlash > 0.01) {
      ctx.save();
      ctx.globalAlpha = critFlash * 0.55;
      ctx.filter = `brightness(${1.2 + critFlash * 1.8}) saturate(${1.1 + critFlash * 1.5})`;
      ctx.shadowColor = `rgba(253, 224, 71, ${0.6 * critFlash})`;
      ctx.shadowBlur = 16 * critFlash;
      ctx.globalCompositeOperation = "screen";
      drawEnemyFrame(ctx, enemy, image, frameWidth, frameHeight, frame, x, y, snappedDrawWidth, snappedDrawHeight);
      ctx.restore();
    }
    if (enemy.affixState?.volatileFlash > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(249,115,22,${enemy.affixState.volatileFlash * 2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x + enemy.w * 0.5 - game.camera.x, enemy.y + enemy.h * 0.5 - game.camera.y, enemy.w * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const orb of enemy.affixState?.orbitOrbs || []) {
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(orb.x - game.camera.x, orb.y - game.camera.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    if (enemy.affixState?.laserBeam) {
      const beam = enemy.affixState.laserBeam;
      ctx.save();
      ctx.strokeStyle = "rgba(6,182,212,0.45)";
      ctx.lineWidth = beam.width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(beam.x1 - game.camera.x, beam.y1 - game.camera.y);
      ctx.lineTo(beam.x2 - game.camera.x, beam.y2 - game.camera.y);
      ctx.stroke();
      ctx.restore();
    }
    const frameSize = enemy.drawSize || enemy.w;
    const barWidth = enemy.w / 3;
    const barX = Math.round(x + frameSize * 0.5 - barWidth * 0.5);
    const barY = Math.round(y + frameSize * 0.3);
    const plateRowY = barY - 10;
    const affixRowY = plateRowY - 8;
    if (enemy.showHealthBar) {
      const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
      const borderColor = enemy.isMiniBoss ? "#facc15" : enemy.isElite ? "#3b82f6" : "#000000";
      ctx.save();
      ctx.globalAlpha = enemy.renderAlpha ?? 1;
      ctx.fillStyle = "rgba(2, 6, 23, 0.8)";
      ctx.fillRect(barX, barY, barWidth, 5);
      ctx.fillStyle = hpRatio > 0.4 ? "#4ade80" : "#ef4444";
      ctx.fillRect(barX, barY, barWidth * hpRatio, 5);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(barX - 0.5, barY - 0.5, barWidth + 1, 6);
      ctx.restore();
    }
    drawEnemyPlates(ctx, enemy, barX + barWidth * 0.5, plateRowY);
    if (enemy.affixes?.length) {
      const firstAffix = getAffixDef(enemy.affixes[0]);
      ctx.fillStyle = firstAffix.color;
      ctx.fillRect(barX, affixRowY, 6, 4);
      if (enemy.affixes.length > 1) {
        ctx.fillStyle = "rgba(248,250,252,0.9)";
        ctx.font = "10px Georgia";
        ctx.fillText(`+${enemy.affixes.length - 1}`, barX + 9, affixRowY + 4);
      }
    }
    if ((enemy.state?.bleedStacks || 0) > 0) {
      ctx.fillStyle = "#fecaca";
      ctx.font = "10px Georgia";
      ctx.fillText(`Bleed ${enemy.state.bleedStacks}`, x, y - 20);
    }
  }
}

function drawEnemyCollisionDebug(ctx, game) {
  const enemies = game.getLivingEnemies?.() || game.enemies || [];
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  for (const enemy of enemies) {
    const movementCircle = getEnemyMovementCircleAt(enemy);
    const combatCenter = centerOf(enemy);
    const combatRadius = Math.max(4, (enemy.collisionRadius ?? 0.32) * enemy.w);
    const baselineY = enemy.y + (enemy.movementCollider?.baselineOffsetY ?? enemy.h * 0.9) - game.camera.y;

    ctx.strokeStyle = "rgba(34, 197, 94, 0.95)";
    ctx.beginPath();
    ctx.arc(movementCircle.x - game.camera.x, movementCircle.y - game.camera.y, movementCircle.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(251, 146, 60, 0.95)";
    ctx.beginPath();
    ctx.arc(combatCenter.x - game.camera.x, combatCenter.y - game.camera.y, combatRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
    ctx.beginPath();
    ctx.moveTo(enemy.x - game.camera.x, baselineY);
    ctx.lineTo(enemy.x + enemy.w - game.camera.x, baselineY);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCombatFeedback(ctx, game) {
  for (const burst of game.combat.critBursts || []) {
    if (!isWorldCircleVisible(game, burst.x, burst.y, burst.radius + 32, 24)) continue;
    const progress = clamp(burst.age / Math.max(0.001, burst.duration), 0, 1);
    const radius = burst.radius + progress * 26;
    const alpha = (1 - progress) * 0.9;
    const screenX = burst.x - game.camera.x;
    const screenY = burst.y - game.camera.y;
    ctx.save();
    ctx.strokeStyle = `rgba(253,224,71,${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.9})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const particle of game.combat.enemyHitParticles || []) {
    const width = (particle.patternWidth || 1) * particle.pixelSize;
    const height = (particle.patternHeight || 1) * particle.pixelSize;
    if (!isWorldRectVisible(game, particle.x - width * 0.5, particle.y - height * 0.5, width, height, 16)) continue;
    const progress = clamp(particle.age / Math.max(0.001, particle.duration), 0, 1);
    const alpha = 1 - progress;
    const screenX = particle.x - game.camera.x;
    const screenY = particle.y - game.camera.y;
    ctx.save();
    ctx.translate(Math.round(screenX), Math.round(screenY));
    ctx.rotate(particle.rotation || 0);
    ctx.globalAlpha = alpha;
    for (const pixel of particle.pattern || []) {
      ctx.fillStyle = particle.colors?.[pixel.color] || "#ef4444";
      ctx.fillRect(
        pixel.x * particle.pixelSize - width * 0.5,
        pixel.y * particle.pixelSize - height * 0.5,
        particle.pixelSize,
        particle.pixelSize
      );
    }
    ctx.restore();
  }

  for (const popup of game.combat.damagePopups || []) {
    if (!isWorldRectVisible(game, popup.x - 48, popup.y - 64, 96, 96, 16)) continue;
    const progress = clamp(popup.age / Math.max(0.001, popup.duration), 0, 1);
    const alpha = 1 - progress;
    const y = popup.y - game.camera.y - popup.age * popup.riseSpeed;
    const x = popup.x - game.camera.x;
    const scale = popup.scale * (popup.isCrit ? 1 + Math.sin(progress * Math.PI) * 0.12 : 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.font = popup.isCrit ? "bold 20px Georgia" : "bold 15px Georgia";
    ctx.lineWidth = popup.isCrit ? 4 : 3;
    ctx.strokeStyle = popup.strokeColor ?? "rgba(15,23,42,0.95)";
    ctx.fillStyle = popup.color ?? (popup.isCrit ? "rgb(253,224,71)" : "rgb(248,250,252)");
    const label = popup.text;
    ctx.strokeText(label, 0, 0);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
}

function drawBloodDecals(ctx, game) {
  for (const decal of game.combat.enemyBloodDecals || []) {
    const width = (decal.patternWidth || 1) * decal.pixelSize;
    const height = (decal.patternHeight || 1) * decal.pixelSize;
    if (!isWorldRectVisible(game, decal.x - width * 0.5, decal.y - height * 0.5, width, height, 16)) continue;
    const progress = clamp(decal.age / Math.max(0.001, decal.duration), 0, 1);
    const alpha = (1 - progress) * 0.45;
    const screenX = decal.x - game.camera.x;
    const screenY = decal.y - game.camera.y;
    ctx.save();
    ctx.translate(Math.round(screenX), Math.round(screenY));
    ctx.rotate(decal.rotation || 0);
    ctx.globalAlpha = alpha;
    for (const pixel of decal.pattern || []) {
      ctx.fillStyle = decal.colors?.[pixel.color] || "#7f1d1d";
      ctx.fillRect(
        pixel.x * decal.pixelSize - width * 0.5,
        pixel.y * decal.pixelSize - height * 0.5,
        decal.pixelSize,
        decal.pixelSize
      );
    }
    ctx.restore();
  }
}

function drawWorld(ctx, game) {
  const { world, assets, camera } = game;
  const tileSize = world.tileSize;
  const atlas = assets.tiles;
  const startX = Math.max(0, Math.floor(camera.x / tileSize) - 1);
  const startY = Math.max(0, Math.floor(camera.y / tileSize) - 1);
  const endX = Math.min(world.cols, startX + Math.ceil(game.canvas.width / tileSize) + 3);
  const endY = Math.min(world.rows, startY + Math.ceil(game.canvas.height / tileSize) + 3);
  const theme = [
    { floorRow: 7, wallRow: 0 },
    { floorRow: 8, wallRow: 1 },
    { floorRow: 9, wallRow: 2 },
    { floorRow: 10, wallRow: 5 },
    { floorRow: 11, wallRow: 5 }
  ][Math.min(game.roomIndex, 4)];

  const drewBackdropReveal = drawBackdropRevealLayer(
    ctx,
    assets.biomeBackdrop,
    [
      assets.biomeBackdropCloud1,
      assets.biomeBackdropCloud2,
      assets.biomeBackdropCloud3,
      assets.biomeBackdropCloud4,
      assets.biomeBackdropCloud5,
      assets.biomeBackdropCloud6
    ],
    world,
    camera,
    game.canvas,
    game.time || 0
  );
  if (!drewBackdropReveal) {
    for (const rect of world.voidRects || []) {
      const screenX = rect.x - camera.x;
      const screenY = rect.y - camera.y;
      if (screenX + rect.w < 0 || screenY + rect.h < 0 || screenX > game.canvas.width || screenY > game.canvas.height) continue;
      ctx.fillStyle = "rgba(2, 12, 18, 0.9)";
      ctx.fillRect(screenX, screenY, rect.w, rect.h);
    }
  }

  const maskTopUnplayable = shouldMaskTopUnplayableForUpperCliff(world);
  let activeUpperCliffClip = false;
  if (maskTopUnplayable) {
    drawUpperCliffMaskFillLayer(ctx, world.upperCliff?.midStripFillRects, camera, game);
    drawUpperCliffMaskFillLayer(ctx, world.upperCliff?.row01GroundMaskRects, camera, game);
    activeUpperCliffClip = applyUpperCliffVisibleRegionClip(ctx, world, camera);
  }

  if (world.cosmeticFloor?.groundLayer) {
    drawOpenWorldGroundBase(ctx, world.cosmeticFloor.groundLayer, camera);
  }

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const screenX = x * tileSize - camera.x;
      const screenY = y * tileSize - camera.y;
      const inBlockerChunk = world.blockerChunkTileSet?.has(`${x},${y}`);
      if (world.grid[y][x] === 1 && !inBlockerChunk) {
        drawTile(ctx, atlas, theme.wallRow, x % 2 === 0 ? 0 : 1, screenX, screenY, tileSize);
      } else if ((world.grid[y][x] === 0 || inBlockerChunk) && !world.cosmeticFloor?.groundLayer) {
        drawTile(ctx, atlas, theme.floorRow, 1 + ((x + y) % 3), screenX, screenY, tileSize);
      }
    }
  }

  if (world.cobblestonePathTiles?.size && assets.biomeCobble) {
    for (const [key, variantIndex] of world.cobblestonePathTiles.entries()) {
      const [gx, gy] = key.split(",").map(Number);
      if (gx < startX || gx >= endX || gy < startY || gy >= endY) continue;
      const variant = world.cobblestonePathVariants?.[variantIndex] || world.cobblestonePathVariants?.[0];
      if (!variant) continue;
      const screenX = gx * tileSize - camera.x;
      const screenY = gy * tileSize - camera.y;
      const drawSize = Math.round(tileSize * 0.75);
      const margin = (tileSize - drawSize) * 0.5;
      ctx.drawImage(assets.biomeCobble, variant.sx, variant.sy, 32, 32, screenX + margin, screenY + margin, drawSize, drawSize);
    }
  }

  if (world.upperCliff?.enabled) {
    if (activeUpperCliffClip) {
      ctx.restore();
      activeUpperCliffClip = false;
    }
    drawUpperCliffDecor(ctx, world, -camera.x, -camera.y, {
      x: camera.x,
      y: camera.y,
      viewWidth: camera.viewWidth,
      viewHeight: camera.viewHeight
    });
    if (maskTopUnplayable) {
      activeUpperCliffClip = applyUpperCliffVisibleRegionClip(ctx, world, camera);
    }
  }

  if (world.cosmeticFloor?.groundLayer) {
    drawOpenWorldGroundDetails(ctx, world.cosmeticFloor.groundLayer, camera);
    drawOpenWorldGroundDecor(ctx, world.cosmeticFloor.groundLayer, camera);
  }

  if (activeUpperCliffClip) {
    ctx.restore();
  }

  if (world.blockerChunkSpaces?.length && assets.biomeBlockerChunks) {
    for (const space of world.blockerChunkSpaces) {
      const screenX = space.worldX - camera.x;
      const screenY = space.worldY - camera.y;
      if (screenX + space.chunk.width < 0 || screenY + space.chunk.height < 0 || screenX > game.canvas.width || screenY > game.canvas.height) continue;
      ctx.drawImage(
        assets.biomeBlockerChunks,
        space.chunk.x,
        space.chunk.y,
        space.chunk.width,
        space.chunk.height,
        screenX,
        screenY,
        space.chunk.width,
        space.chunk.height
      );
    }
  }

}

function drawProjectiles(ctx, game) {
  const playerBolt = game.assets.projectileDarkBolt;
  for (const burst of game.combat.weaponArtRuntime?.assistBursts || []) {
    const burstRadius = Math.max(burst.radius || 0, burst.drawWidth || 0, burst.drawHeight || 0, 24);
    if (!isWorldCircleVisible(game, burst.x, burst.y, burstRadius, 24)) continue;
    const screenX = burst.x - game.camera.x;
    const screenY = burst.y - game.camera.y;
    const progress = clamp(burst.elapsed / Math.max(0.001, burst.duration), 0, 0.999);
    ctx.save();
    if (burst.spriteAsset && game.assets[burst.spriteAsset]) {
      const sprite = game.assets[burst.spriteAsset];
      const frameHeight = sprite.naturalHeight || sprite.height || 1;
      const totalFrames = Math.max(
        1,
        burst.spriteFrames || Math.floor((sprite.naturalWidth || sprite.width || frameHeight) / Math.max(1, frameHeight))
      );
      const frameWidth = Math.max(1, Math.floor((sprite.naturalWidth || sprite.width || frameHeight) / totalFrames));
      const frame = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));
      const targetDrawWidth = burst.drawWidth ?? burst.radius * 2.25;
      const targetDrawHeight = burst.drawHeight ?? targetDrawWidth * (frameHeight / Math.max(1, frameWidth));
      const preserveAspect = Math.abs((targetDrawWidth / Math.max(1, frameWidth)) - (targetDrawHeight / Math.max(1, frameHeight))) < 0.001;
      const snappedSize = getSnappedProjectileSize(targetDrawWidth, targetDrawHeight, frameWidth, frameHeight, preserveAspect);
      ctx.globalAlpha = burst.alpha ?? 0.96;
      ctx.imageSmoothingEnabled = false;
      if (burst.angle != null || burst.pivotX !== 0.5 || burst.pivotY !== 0.5) {
        ctx.translate(snapWorldPixelToRenderZoom(screenX), snapWorldPixelToRenderZoom(screenY));
        if (burst.angle != null) ctx.rotate(burst.angle);
        ctx.drawImage(
          sprite,
          frame * frameWidth,
          0,
          frameWidth,
          frameHeight,
          -snappedSize.drawWidth * (burst.pivotX ?? 0.5),
          -snappedSize.drawHeight * (burst.pivotY ?? 0.5),
          snappedSize.drawWidth,
          snappedSize.drawHeight
        );
      } else {
        ctx.drawImage(
          sprite,
          frame * frameWidth,
          0,
          frameWidth,
          frameHeight,
          snapWorldPixelToRenderZoom(screenX - snappedSize.drawWidth * 0.5),
          snapWorldPixelToRenderZoom(screenY - snappedSize.drawHeight * 0.5),
          snappedSize.drawWidth,
          snappedSize.drawHeight
        );
      }
    } else {
      ctx.strokeStyle = `rgba(147, 197, 253, ${0.75 * (1 - progress)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screenX, screenY, burst.radius * (0.45 + progress * 0.65), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  for (const zone of game.combat.weaponArtRuntime?.assistGroundZones || []) {
    if (!isWorldRectVisible(game, zone.x - zone.radius, zone.y - zone.radiusY, zone.radius * 2, zone.radiusY * 2, 24)) continue;
    const screenX = zone.x - game.camera.x;
    const screenY = zone.y - game.camera.y;
    const life = 1 - clamp(zone.elapsed / Math.max(0.001, zone.duration), 0, 1);
    ctx.save();
    const isDespawning = zone.animationPhase === "death" || !zone.active;
    const fillAlpha = isDespawning ? 0.08 : 0.22;
    const strokeAlpha = isDespawning ? 0.42 : 0.8;
    ctx.fillStyle = `rgba(76, 29, 149, ${fillAlpha * life})`;
    ctx.strokeStyle = `rgba(192, 132, 252, ${strokeAlpha * life})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY, zone.radius, zone.radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = `rgba(233, 213, 255, ${0.56 * life})`;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY, zone.radius * 0.62, zone.radiusY * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    drawAssistGroundZoneSprite(ctx, game, zone, screenX, screenY);
    ctx.restore();
  }
  for (const afterimage of game.combat.weaponArtRuntime?.elementProjectileAfterimages || []) {
    if (!afterimage.spriteAsset || !game.assets[afterimage.spriteAsset]) continue;
    if (!isWorldCircleVisible(game, afterimage.x, afterimage.y, Math.max(afterimage.drawSize || 0, afterimage.radius * 2 || 0, 24), 16)) continue;
    const progress = clamp(afterimage.elapsed / Math.max(0.001, afterimage.duration), 0, 1);
    const alpha = (afterimage.alpha ?? 0.16) * Math.pow(1 - progress, 1.2);
    const image = game.assets[afterimage.spriteAsset];
    ctx.save();
    ctx.globalAlpha = alpha;
    drawProjectileSprite(ctx, image, {
      ...afterimage,
      drawSize: (afterimage.drawSize || afterimage.radius * 2) * (1 + progress * 0.05)
    }, afterimage.x - game.camera.x, afterimage.y - game.camera.y);
    ctx.restore();
  }
  for (const afterimage of game.combat.weaponArtRuntime?.sparkAfterimages || []) {
    if (!isWorldCircleVisible(game, afterimage.x, afterimage.y, (afterimage.size || 14) + 8, 16)) continue;
    const screenX = afterimage.x - game.camera.x;
    const screenY = afterimage.y - game.camera.y;
    const progress = clamp(afterimage.elapsed / Math.max(0.001, afterimage.duration), 0, 1);
    const alpha = Math.pow(1 - progress, 1.6) * 0.42;
    const size = (afterimage.size || 14) * (1 + progress * 0.08);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(snapWorldPixelToRenderZoom(screenX), snapWorldPixelToRenderZoom(screenY));
    ctx.rotate(afterimage.angle || 0);
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 2;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.moveTo(size * 0.46, 0);
    ctx.lineTo(size * 0.18, -size * 0.18);
    ctx.lineTo(-size * 0.02, size * 0.02);
    ctx.lineTo(-size * 0.2, -size * 0.14);
    ctx.lineTo(-size * 0.46, size * 0.16);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size * 0.34, -size * 0.02);
    ctx.lineTo(size * 0.1, -size * 0.12);
    ctx.lineTo(-size * 0.06, 0);
    ctx.lineTo(-size * 0.24, -size * 0.08);
    ctx.stroke();
    ctx.restore();
  }
  const beam = getPlayerBeamRenderState(game);
  if (beam) {
    const beamX = Math.min(beam.x1, beam.x2);
    const beamY = Math.min(beam.y1, beam.y2);
    const beamWidth = Math.abs(beam.x2 - beam.x1);
    const beamHeight = Math.abs(beam.y2 - beam.y1);
    if (isWorldRectVisible(game, beamX, beamY, beamWidth, beamHeight, beam.width * 2)) {
      const image = beam.spriteAsset ? game.assets?.[beam.spriteAsset] : null;
      if (image && (beam.spriteFrames || 0) > 0) {
        drawBeamLayer(ctx, game, beam, {
          image,
          totalFrames: Math.max(1, beam.spriteFrames || 1),
          color: beam.color || "#a855f7",
          alpha: 0.95,
          shadowBlur: beam.shadowBlur ?? 12
        });
      }
      const overlayImage = beam.overlaySpriteAsset ? game.assets?.[beam.overlaySpriteAsset] : null;
      if (overlayImage && (beam.overlaySpriteFrames || 0) > 0) {
        drawBeamLayer(ctx, game, beam, {
          image: overlayImage,
          totalFrames: Math.max(1, beam.overlaySpriteFrames || 1),
          color: beam.overlayColor || "#f5d0fe",
          alpha: beam.overlayAlpha ?? 0.72,
          heightMult: beam.overlayHeightMult ?? 0.82,
          shadowBlur: Math.max(beam.shadowBlur ?? 12, 18)
        });
      }
    }
  }
  for (const projectile of game.combat.playerProjectiles) {
    const projectileRadius = Math.max(projectile.radius || 0, (projectile.drawSize || 0) * 0.6, 16);
    if (!isWorldCircleVisible(game, projectile.x, projectile.y, projectileRadius, 16)) continue;
    const screenX = projectile.x - game.camera.x;
    const screenY = projectile.y - game.camera.y;
    if (projectile.projectileClass === "lightningSpark") {
      const angle = Math.atan2(projectile.vy, projectile.vx);
      const size = projectile.drawSize || Math.max(12, projectile.radius * 2);
      ctx.save();
      ctx.translate(snapWorldPixelToRenderZoom(screenX), snapWorldPixelToRenderZoom(screenY));
      ctx.rotate(angle);
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 2;
      ctx.lineCap = "square";
      ctx.lineJoin = "miter";
      ctx.beginPath();
      ctx.moveTo(size * 0.46, 0);
      ctx.lineTo(size * 0.18, -size * 0.18);
      ctx.lineTo(-size * 0.02, size * 0.02);
      ctx.lineTo(-size * 0.2, -size * 0.14);
      ctx.lineTo(-size * 0.46, size * 0.16);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(size * 0.34, -size * 0.02);
      ctx.lineTo(size * 0.1, -size * 0.12);
      ctx.lineTo(-size * 0.06, 0);
      ctx.lineTo(-size * 0.24, -size * 0.08);
      ctx.stroke();
      ctx.restore();
    } else if (projectile.projectileClass === "knife") {
      const angle = Math.atan2(projectile.vy, projectile.vx);
      const size = projectile.drawSize || Math.max(18, projectile.radius * 2);
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(angle);
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.moveTo(size * 0.5, 0);
      ctx.lineTo(-size * 0.18, -size * 0.17);
      ctx.lineTo(-size * 0.02, 0);
      ctx.lineTo(-size * 0.18, size * 0.17);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#7f1d1d";
      ctx.fillRect(-size * 0.34, -size * 0.08, size * 0.18, size * 0.16);
      ctx.restore();
    } else if (projectile.spriteAsset && game.assets[projectile.spriteAsset]) {
      const image = game.assets[projectile.spriteAsset];
      drawProjectileSprite(ctx, image, projectile, screenX, screenY);
    } else if (playerBolt && game.heroDef.id === "dark_mage") {
      const angle = Math.atan2(projectile.vy, projectile.vx);
      const snappedSize = getSnappedProjectileSize(32, 16, 16, 16, false);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(snapWorldPixelToRenderZoom(screenX), snapWorldPixelToRenderZoom(screenY));
      ctx.rotate(angle);
      ctx.drawImage(
        playerBolt,
        0,
        0,
        16,
        16,
        -snappedSize.drawWidth * 0.5,
        -snappedSize.drawHeight * 0.5,
        snappedSize.drawWidth,
        snappedSize.drawHeight
      );
      ctx.restore();
    } else {
      ctx.fillStyle = projectile.color || "#e879f9";
      ctx.beginPath();
      ctx.arc(screenX, screenY, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const projectile of game.combat.enemyProjectiles) {
    const projectileRadius = Math.max(projectile.radius || 0, (projectile.drawSize || 0) * 0.6, 16);
    if (!isWorldCircleVisible(game, projectile.x, projectile.y, projectileRadius, 16)) continue;
    const screenX = projectile.x - game.camera.x;
    const screenY = projectile.y - game.camera.y;
    if (projectile.spriteAsset && game.assets[projectile.spriteAsset]) {
      const image = game.assets[projectile.spriteAsset];
      drawProjectileSprite(ctx, image, projectile, screenX, screenY);
    } else {
      ctx.fillStyle = projectile.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const vfx of game.combat.impactVfx) {
    if (!vfx.sprite || !game.assets[vfx.sprite]) continue;
    const drawWidth = vfx.drawWidth ?? vfx.size;
    const drawHeight = vfx.drawHeight ?? vfx.size;
    if (!isWorldRectVisible(game, vfx.x - drawWidth * 0.5, vfx.y - drawHeight * 0.5, drawWidth, drawHeight, 16)) continue;
    const screenX = vfx.x - game.camera.x;
    const screenY = vfx.y - game.camera.y;
    const image = game.assets[vfx.sprite];
    const frame = Math.min(vfx.currentFrame, vfx.frames - 1);
    const sourceFrame = (vfx.startFrame ?? 0) + frame;
    const sourceWidth = Math.min(vfx.frameWidth, vfx.cropWidth || vfx.frameWidth);
    const sourceHeight = Math.min(vfx.frameHeight, vfx.cropHeight || vfx.frameHeight);
    const sx = sourceFrame * vfx.frameWidth + Math.max(0, Math.floor((vfx.frameWidth - sourceWidth) * 0.5));
    const sy = Math.max(0, Math.floor((vfx.frameHeight - sourceHeight) * 0.5));
    if (Math.abs(vfx.angle || 0) > 0.0001) {
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(vfx.angle);
      ctx.drawImage(image, sx, sy, sourceWidth, sourceHeight, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();
    } else {
      ctx.drawImage(image, sx, sy, sourceWidth, sourceHeight, screenX - drawWidth / 2, screenY - drawHeight / 2, drawWidth, drawHeight);
    }
  }

  for (const hitbox of game.combat.enemyAreaHitboxes) {
    if (
      hitbox.shape === "circle" &&
      !isWorldCircleVisible(game, hitbox.x, hitbox.y, Math.max(hitbox.radius || 0, hitbox.radiusY || 0), 16)
    ) {
      continue;
    }
    if (
      hitbox.shape === "cone" &&
      !isWorldRectVisible(game, hitbox.x - hitbox.range, hitbox.y - hitbox.range, hitbox.range * 2, hitbox.range * 2, 16)
    ) {
      continue;
    }
    if (hitbox.shape === "line") {
      const minX = Math.min(hitbox.x, hitbox.x2 ?? hitbox.x);
      const minY = Math.min(hitbox.y, hitbox.y2 ?? hitbox.y);
      const maxX = Math.max(hitbox.x, hitbox.x2 ?? hitbox.x);
      const maxY = Math.max(hitbox.y, hitbox.y2 ?? hitbox.y);
      const padding = Math.max(12, (hitbox.softLineWidth ?? hitbox.lineWidth ?? 3) * 2);
      if (!isWorldRectVisible(game, minX, minY, maxX - minX, maxY - minY, padding)) {
        continue;
      }
    }
    const fadeDuration = Math.max(0.001, hitbox.visualDuration ?? hitbox.duration);
    const ageAlpha = 1 - clamp(hitbox.age / fadeDuration, 0, 1);
    if (hitbox.hiddenVisual) {
      continue;
    }
    ctx.save();
    const baseColor = hitbox.color || hitbox.tint || "#fb7171";
    const color = baseColor.startsWith("#") ? baseColor : "#fb7171";
    const red = parseInt(color.slice(1, 3), 16);
    const green = parseInt(color.slice(3, 5), 16);
    const blue = parseInt(color.slice(5, 7), 16);
    const hasGroundImpact = !!(hitbox.groundImpactSprite && game.assets[hitbox.groundImpactSprite]);
    if (hasGroundImpact && hitbox.shape === "circle") {
      const sprite = game.assets[hitbox.groundImpactSprite];
      const totalFrames = Math.max(1, hitbox.groundImpactFrames ?? 10);
      const frameWidth = hitbox.groundImpactFrameWidth ?? (sprite.naturalWidth / totalFrames);
      const frameHeight = hitbox.groundImpactFrameHeight ?? sprite.naturalHeight;
      const startFrame = Math.max(0, Math.min(totalFrames - 1, hitbox.groundImpactStartFrame ?? 0));
      const availableFrames = Math.max(1, Math.min(totalFrames - startFrame, hitbox.groundImpactFrameCount ?? (totalFrames - startFrame)));
      const frame = Number.isFinite(hitbox.groundImpactFps)
        ? Math.min(startFrame + availableFrames - 1, startFrame + Math.floor(hitbox.age * hitbox.groundImpactFps))
        : (() => {
            const progress = clamp(hitbox.age / fadeDuration, 0, 0.999);
            return Math.min(startFrame + availableFrames - 1, startFrame + Math.floor(progress * availableFrames));
          })();
      const drawWidth = hitbox.radius * 2 * 0.7 * (hitbox.groundImpactScale ?? 1);
      const drawHeight = drawWidth * (frameHeight / Math.max(1, frameWidth));
      const anchorX = hitbox.groundImpactAnchorX ?? hitbox.x;
      const anchorY = hitbox.groundImpactAnchorY ?? hitbox.y;
      const drawY = hitbox.groundImpactAnchorBottom
        ? anchorY - game.camera.y - drawHeight + (hitbox.groundImpactYOffset ?? 0)
        : anchorY - game.camera.y - drawHeight * 0.5 + (hitbox.groundImpactYOffset ?? 0);
      ctx.drawImage(
        sprite,
        frame * frameWidth,
        0,
        frameWidth,
        frameHeight,
        anchorX - game.camera.x - drawWidth * 0.5,
        drawY,
        drawWidth,
        drawHeight
      );
    }
    ctx.strokeStyle = `rgba(${red},${green},${blue},${(hasGroundImpact ? 0.1 : 0.18) * ageAlpha})`;
    ctx.fillStyle = `rgba(${red},${green},${blue},${(hasGroundImpact ? 0.04 : 0.08) * ageAlpha})`;
    ctx.lineWidth = 2;
    if (hitbox.shape === "circle") {
      const radiusY = hitbox.radiusY ?? hitbox.radius * 0.75;
      ctx.beginPath();
      ctx.ellipse(hitbox.x - game.camera.x, hitbox.y - game.camera.y, hitbox.radius, radiusY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (hitbox.shape === "cone") {
      const angle = Math.atan2(hitbox.dirY, hitbox.dirX);
      const arc = ((hitbox.arcDeg || 90) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(hitbox.x - game.camera.x, hitbox.y - game.camera.y);
      ctx.arc(hitbox.x - game.camera.x, hitbox.y - game.camera.y, hitbox.range, angle - arc * 0.5, angle + arc * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (hitbox.shape === "line") {
      const x1 = hitbox.x - game.camera.x;
      const y1 = hitbox.y - game.camera.y;
      const x2 = (hitbox.x2 ?? hitbox.x) - game.camera.x;
      const y2 = (hitbox.y2 ?? hitbox.y) - game.camera.y;
      if (hitbox.lineSprite && game.assets[hitbox.lineSprite]) {
        const image = game.assets[hitbox.lineSprite];
        const totalFrames = Math.max(1, hitbox.lineSpriteFrames ?? Math.floor(image.naturalWidth / Math.max(1, hitbox.lineSpriteFrameWidth || image.naturalWidth)));
        const frameWidth = hitbox.lineSpriteFrameWidth ?? Math.floor(image.naturalWidth / totalFrames);
        const frameHeight = hitbox.lineSpriteFrameHeight ?? image.naturalHeight;
        const fps = hitbox.lineSpriteFps ?? 12;
        const frame = Math.min(totalFrames - 1, Math.floor(hitbox.age * fps) % totalFrames);
        const length = Math.hypot(x2 - x1, y2 - y1);
        const drawHeight = hitbox.lineSpriteDrawHeight ?? (hitbox.softLineWidth ?? 56);
        ctx.save();
        ctx.translate((x1 + x2) * 0.5, (y1 + y2) * 0.5);
        ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
        ctx.globalAlpha = 0.9 * ageAlpha;
        ctx.drawImage(
          image,
          frame * frameWidth,
          0,
          frameWidth,
          frameHeight,
          -length * 0.5,
          -drawHeight * 0.5,
          length,
          drawHeight
        );
        ctx.restore();
      }
      const softLineWidth = hitbox.softLineWidth ?? Math.max(6, (hitbox.lineWidth ?? 3) * 2.5);
      const coreLineWidth = hitbox.lineWidth ?? 2.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = `rgba(${red},${green},${blue},${0.16 * ageAlpha})`;
      ctx.lineWidth = softLineWidth;
      ctx.shadowColor = `rgba(${red},${green},${blue},${0.14 * ageAlpha})`;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255,228,228,${0.34 * ageAlpha})`;
      ctx.lineWidth = Math.max(1, coreLineWidth);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawTreeSprite(ctx, game, tree, faded = false) {
  const image = game.assets?.[tree.assetKey];
  if (!image) return;
  const renderImage = getCachedObstacleImage(image, tree.w, tree.h);
  const drawX = tree.x - game.camera.x;
  const drawY = tree.y - game.camera.y;

  if (!faded) {
    ctx.drawImage(renderImage, drawX, drawY, tree.w, tree.h);
    return;
  }

  const playerRect = {
    x: game.player.x,
    y: game.player.y,
    w: game.player.w,
    h: game.player.h
  };
  if (distancePointToRect(playerRect.x + playerRect.w * 0.5, playerRect.y + playerRect.h * 0.5, tree) > tree.canopyFadeRadius) {
    ctx.drawImage(renderImage, drawX, drawY, tree.w, tree.h);
    return;
  }

  const scratch = getTreeFadeScratch(tree.w, tree.h);
  const tctx = scratch.getContext("2d");
  if (!tctx) {
    ctx.drawImage(renderImage, drawX, drawY, tree.w, tree.h);
    return;
  }
  tctx.clearRect(0, 0, tree.w, tree.h);
  tctx.drawImage(renderImage, 0, 0, tree.w, tree.h);
  const playerScreenX = game.player.x + game.player.w * 0.5 - game.camera.x - drawX;
  const playerScreenY = game.player.y + game.player.h * 0.5 - game.camera.y - drawY;
  const gradient = tctx.createRadialGradient(playerScreenX, playerScreenY, 0, playerScreenX, playerScreenY, tree.canopyFadeRadius);
  gradient.addColorStop(0, `rgba(255,255,255,${tree.canopyFadeMinAlpha})`);
  gradient.addColorStop(1, `rgba(255,255,255,${tree.canopyFadeMaxAlpha})`);
  tctx.globalCompositeOperation = "destination-in";
  tctx.fillStyle = gradient;
  tctx.fillRect(0, 0, tree.w, tree.h);
  tctx.globalCompositeOperation = "source-over";
  ctx.drawImage(scratch, drawX, drawY);
}

function drawBiomeObstacleSprite(ctx, game, obstacle) {
  const image = game.assets?.[obstacle.assetKey];
  if (!image) return;
  const drawX = obstacle.x - game.camera.x;
  const drawY = obstacle.y - game.camera.y;
  const previousSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (obstacle.atlasFrame) {
    ctx.drawImage(
      image,
      obstacle.atlasFrame.x,
      obstacle.atlasFrame.y,
      obstacle.atlasFrame.w,
      obstacle.atlasFrame.h,
      drawX,
      drawY,
      obstacle.w,
      obstacle.h
    );
  } else {
    const renderImage = getCachedObstacleImage(image, obstacle.w, obstacle.h);
    ctx.drawImage(renderImage, drawX, drawY, obstacle.w, obstacle.h);
  }
  ctx.imageSmoothingEnabled = previousSmoothing;
}

function drawWorldDecorationSprite(ctx, game, decor) {
  const image = game.assets?.[decor.assetKey];
  if (!image) return;
  const drawX = decor.x - game.camera.x;
  const drawY = decor.y - game.camera.y;
  const previousSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (decor.kind === "animatedSprite") {
    const frameCount = Math.max(1, decor.frameCount || 1);
    const frameDuration = Math.max(0.01, decor.frameDuration || 0.12);
    const frameIndex = Math.floor(game.time / frameDuration) % frameCount;
    ctx.drawImage(
      image,
      frameIndex * decor.frameWidth,
      0,
      decor.frameWidth,
      decor.frameHeight,
      drawX,
      drawY,
      decor.w,
      decor.h
    );
  } else {
    ctx.drawImage(image, drawX, drawY, decor.w, decor.h);
  }
  ctx.imageSmoothingEnabled = previousSmoothing;
}

function drawWorldDecorations(ctx, game, overlayPass = false) {
  const decorations = game.world?.sortedDecor || game.world?.decor || [];
  if (!decorations.length) return;
  const playerSortY = game.player.y + game.player.h;
  for (const decor of decorations) {
    if (!isWorldRectVisible(game, decor.x, decor.y, decor.w, decor.h, 16)) continue;
    const decorSortY = getEntrySortY(decor);
    const playerBehindDecor = playerSortY < decorSortY;
    if (overlayPass !== playerBehindDecor) continue;
    drawWorldDecorationSprite(ctx, game, decor);
  }
}

function drawBiomeObstacles(ctx, game, overlayPass = false) {
  const obstacles = game.world?.sortedBiomeObstacles || game.world?.biomeObstacles || [];
  if (!obstacles.length) return;
  const playerSortY = game.player.y + game.player.h;
  for (const obstacle of obstacles) {
    if (!isWorldRectVisible(game, obstacle.x, obstacle.y, obstacle.w, obstacle.h, 24)) continue;
    const obstacleSortY = getEntrySortY(obstacle);
    const playerBehindObstacle = playerSortY < obstacleSortY;
    if (overlayPass !== playerBehindObstacle) continue;
    drawBiomeObstacleSprite(ctx, game, obstacle);
  }
}

function drawTrees(ctx, game, overlayPass = false) {
  const trees = game.world?.sortedTreeObstacles || game.world?.treeObstacles || [];
  if (!trees.length) return;
  const playerSortY = game.player.y + game.player.h;
  for (const tree of trees) {
    if (!isWorldRectVisible(game, tree.x, tree.y, tree.w, tree.h, 32)) continue;
    const treeSortY = getEntrySortY(tree, tree.ySortHeightRatio || 1);
    const playerBehindTree = playerSortY < treeSortY;
    if (overlayPass !== playerBehindTree) continue;
    drawTreeSprite(ctx, game, tree, overlayPass);
  }
}

function drawSkillEffects(ctx, game) {
  const effects = getRunSkillEffects(game);
  if (!effects.length) return;
  ctx.save();
  for (const effect of effects) {
    const effectRadius = effect.radius || 40;
    if (!isWorldCircleVisible(game, effect.x, effect.y, effectRadius + 16, 24)) continue;
    const screenX = effect.x - game.camera.x;
    const screenY = effect.y - game.camera.y;
    if (effect.kind === "circleFlash") {
      const progress = 1 - clamp(effect.elapsed / Math.max(0.001, effect.duration), 0, 1);
      ctx.strokeStyle = `${effect.color}${""}`;
      ctx.globalAlpha = progress * 0.9;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius * (1 - progress * 0.35), 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === "execution") {
      const image = game.assets?.executionHeavySwordVfx;
      if (image) {
        const frameWidth = effect.frameWidth || 128;
        const frameHeight = effect.frameHeight || 128;
        const totalFrames = Math.max(1, effect.totalFrames || Math.floor((image.naturalWidth || frameWidth) / Math.max(1, frameWidth)));
        const progress = clamp(effect.elapsed / Math.max(0.001, effect.duration), 0, 0.999);
        const frame = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));
        ctx.globalAlpha = 0.96;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          image,
          frame * frameWidth,
          0,
          frameWidth,
          frameHeight,
          snapWorldPixelToRenderZoom(screenX - frameWidth * 0.5),
          snapWorldPixelToRenderZoom(screenY - frameHeight * 0.5),
          frameWidth,
          frameHeight
        );
      }
      ctx.strokeStyle = "rgba(192,132,252,0.38)";
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === "lightningCascade") {
      ctx.strokeStyle = "rgba(96,165,250,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 18 + Math.sin(effect.elapsed * 10) * 3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === "lightningCascadeStrike") {
      const image = game.assets?.lightningCascadeStrikeVfx;
      if (image) {
        const frameWidth = effect.frameWidth || 128;
        const frameHeight = effect.frameHeight || 400;
        const totalFrames = Math.max(1, effect.totalFrames || Math.floor((image.naturalWidth || frameWidth) / Math.max(1, frameWidth)));
        const progress = clamp(effect.elapsed / Math.max(0.001, effect.duration), 0, 0.999);
        const frame = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));
        ctx.globalAlpha = 0.96;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          image,
          frame * frameWidth,
          0,
          frameWidth,
          frameHeight,
          snapWorldPixelToRenderZoom(screenX - frameWidth * 0.5),
          snapWorldPixelToRenderZoom(screenY - frameHeight),
          frameWidth,
          frameHeight
        );
      }
      ctx.strokeStyle = "rgba(96,165,250,0.38)";
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === "bloodCrave") {
      const image = game.assets?.bloodCraveVfx;
      if (image) {
        const frameWidth = effect.frameWidth || 64;
        const frameHeight = effect.frameHeight || 64;
        const totalFrames = Math.max(1, effect.frames || Math.floor((image.naturalWidth || frameWidth) / Math.max(1, frameWidth)));
        const frame = Math.floor((effect.elapsed * (effect.fps || 12)) % totalFrames);
        const fadeIn = effect.fadeInDuration || 0;
        const fadeOut = effect.fadeOutDuration || 0;
        const remaining = Math.max(0, effect.duration - effect.elapsed);
        let alpha = 1;
        if (fadeIn > 0 && effect.elapsed < fadeIn) alpha = Math.min(alpha, effect.elapsed / fadeIn);
        if (fadeOut > 0 && remaining < fadeOut) alpha = Math.min(alpha, remaining / fadeOut);
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.9;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          image,
          frame * frameWidth,
          0,
          frameWidth,
          frameHeight,
          snapWorldPixelToRenderZoom(screenX - (effect.drawSize || 72) * 0.5),
          snapWorldPixelToRenderZoom(screenY - (effect.drawSize || 72) * 0.5),
          effect.drawSize || 72,
          effect.drawSize || 72
        );
      }
    } else if (effect.kind === "iceRain") {
      const alpha = 0.18;
      ctx.fillStyle = `rgba(147,197,253,${alpha})`;
      ctx.strokeStyle = "rgba(191,219,254,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (effect.kind === "blackHole") {
      ctx.fillStyle = "rgba(79,70,229,0.16)";
      ctx.strokeStyle = "rgba(129,140,248,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(30,27,75,0.85)";
      ctx.beginPath();
      ctx.arc(screenX, screenY, 26, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.kind === "waveShield") {
      ctx.fillStyle = "rgba(103,232,249,0.85)";
      ctx.beginPath();
      ctx.arc(screenX, screenY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(207,250,254,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (effect.kind === "meteorRain") {
      ctx.fillStyle = "rgba(251,146,60,0.14)";
      ctx.strokeStyle = "rgba(249,115,22,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (effect.kind === "purifyingFire") {
      ctx.fillStyle = "rgba(251,146,60,0.12)";
      ctx.strokeStyle = "rgba(253,186,116,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius * 0.58 + Math.sin(effect.elapsed * 10) * 6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === "whirlwind") {
      ctx.strokeStyle = "rgba(245,158,11,0.75)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius, effect.elapsed * 8, effect.elapsed * 8 + Math.PI * 1.4);
      ctx.stroke();
    } else if (effect.kind === "earthquake") {
      const pulse = 0.92 + ((Math.sin(effect.elapsed * 14) + 1) * 0.5) * 0.08;
      ctx.fillStyle = "rgba(192,132,252,0.08)";
      ctx.strokeStyle = "rgba(192,132,252,0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(233,213,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === "spiritBanner") {
      ctx.fillStyle = "rgba(167,139,250,0.12)";
      ctx.strokeStyle = "rgba(196,181,253,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(196,181,253,0.9)";
      ctx.fillRect(screenX - 8, screenY - 26, 16, 36);
      ctx.fillStyle = "rgba(233,213,255,0.95)";
      ctx.beginPath();
      ctx.moveTo(screenX + 8, screenY - 26);
      ctx.lineTo(screenX + 32, screenY - 16);
      ctx.lineTo(screenX + 8, screenY - 6);
      ctx.closePath();
      ctx.fill();
    } else if (effect.kind === "hauntingGhost") {
      ctx.fillStyle = "rgba(196,181,253,0.88)";
      ctx.beginPath();
      ctx.arc(screenX, screenY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(248,250,252,0.95)";
      ctx.beginPath();
      ctx.arc(screenX - 4, screenY - 3, 2, 0, Math.PI * 2);
      ctx.arc(screenX + 4, screenY - 3, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.kind === "loyalDragons") {
      for (const [index, dragon] of (effect.dragonPositions || []).entries()) {
        if (drawLoyalDragonSprite(ctx, game, effect, dragon, index)) continue;
        const dx = dragon.x - game.camera.x;
        const dy = dragon.y - game.camera.y;
        ctx.fillStyle = "rgba(251,146,60,0.95)";
        ctx.beginPath();
        ctx.arc(dx, dy, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(254,215,170,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (effect.kind === "spiderTrap") {
      ctx.strokeStyle = "rgba(163,230,53,0.8)";
      ctx.fillStyle = "rgba(132,204,22,0.16)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(217,249,157,0.9)";
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6 + effect.elapsed * 0.5;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX + Math.cos(angle) * effect.radius * 0.7, screenY + Math.sin(angle) * effect.radius * 0.7);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(234,255,199,0.95)";
      ctx.beginPath();
      ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.kind === "magicHand") {
      ctx.strokeStyle = "rgba(96,165,250,0.8)";
      ctx.fillStyle = "rgba(96,165,250,0.12)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(191,219,254,0.95)";
      ctx.fillRect(screenX - 14, screenY - 18, 28, 36);
      ctx.strokeStyle = "rgba(219,234,254,0.95)";
      ctx.beginPath();
      ctx.moveTo(screenX - 10, screenY - 18);
      ctx.lineTo(screenX - 10, screenY - 34);
      ctx.moveTo(screenX - 3, screenY - 18);
      ctx.lineTo(screenX - 3, screenY - 38);
      ctx.moveTo(screenX + 4, screenY - 18);
      ctx.lineTo(screenX + 4, screenY - 36);
      ctx.moveTo(screenX + 11, screenY - 18);
      ctx.lineTo(screenX + 11, screenY - 30);
      ctx.stroke();
    } else if (effect.kind === "assimilativeOrb") {
      const pulse = 1 + Math.sin(effect.elapsed * 6) * 0.08;
      ctx.fillStyle = `rgba(139,92,246,${0.2 + effect.absorbFlash * 0.18})`;
      ctx.strokeStyle = "rgba(196,181,253,0.92)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(233,213,255,0.95)";
      ctx.beginPath();
      ctx.arc(screenX, screenY, 10 + Math.min(8, effect.absorbCount), 0, Math.PI * 2);
      ctx.fill();
      if (effect.absorbCount > 0) {
        ctx.fillStyle = "rgba(248,250,252,0.95)";
        ctx.font = "bold 11px Georgia";
        ctx.textAlign = "center";
        ctx.fillText(`${effect.absorbCount}`, screenX, screenY + 4);
      }
    } else if (effect.kind === "bloodFrenzy" || effect.kind === "bloodPact" || effect.kind === "fortuneCollapse" || effect.kind === "loadedDiceDamage") {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 34 + Math.sin(effect.elapsed * 7) * 4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === "frenzyProtocol") {
      ctx.strokeStyle = "rgba(251,113,133,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 38 + Math.sin(effect.elapsed * 16) * 5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === "tricksterMove" || effect.kind === "ancestralShout") {
      ctx.strokeStyle = effect.kind === "tricksterMove" ? "rgba(34,197,94,0.9)" : "rgba(196,181,253,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.kind === "tricksterMove" ? 30 : effect.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === "tricksterLuckBomb") {
      ctx.strokeStyle = "rgba(168,85,247,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === "bloodAmmo" || effect.kind === "bloodDebt") {
      ctx.strokeStyle = effect.kind === "bloodAmmo" ? "rgba(220,38,38,0.9)" : "rgba(190,24,93,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 26, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === "shadowHeist") {
      ctx.strokeStyle = "rgba(148,163,184,0.8)";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawSearchables(ctx, game) {
  for (const searchable of game.searchables || []) {
    if (!isWorldRectVisible(game, searchable.x, searchable.y, searchable.w, searchable.h, 24)) continue;
    const searchableDef = SEARCHABLE_DEFS[searchable.typeId];
    if (!searchableDef) continue;
    const x = searchable.x - game.camera.x;
    const y = searchable.y - game.camera.y;
    const searchableAlpha = searchable.introAlpha ?? 1;
    if (searchableAlpha <= 0.01) continue;
    ctx.save();
    ctx.globalAlpha = searchableAlpha;
    if (searchableDef.shadow) {
      drawGroundContactShadow(ctx, {
        x,
        y,
        w: searchable.w,
        h: searchable.h,
        shadow: searchableDef.shadow
      });
    }
    const sheetSprite = searchableDef.sprites?.sheetAsset ? searchableDef.sprites : null;
    if (sheetSprite) {
      const image = game.assets[sheetSprite.sheetAsset];
      if (image && sheetSprite.frameWidth && sheetSprite.frameHeight && sheetSprite.frameCount) {
        const frameDuration = Math.max(0.001, sheetSprite.frameDuration || 0.08);
        const frameIndex = Math.floor(game.time / frameDuration) % sheetSprite.frameCount;
        const sx = (frameIndex % sheetSprite.frameCols) * sheetSprite.frameWidth;
        const sy = Math.floor(frameIndex / sheetSprite.frameCols) * sheetSprite.frameHeight;
        if (searchable.typeId === "devilMerchant") {
          const pulse = Math.sin(game.time * 2.4) * 0.5 + 0.5;
          ctx.save();
          ctx.shadowBlur = 18 + pulse * 10;
          ctx.shadowColor = "#991b1b";
          ctx.drawImage(image, sx, sy, sheetSprite.frameWidth, sheetSprite.frameHeight, x, y, searchable.w, searchable.h);
          ctx.restore();
        } else {
          ctx.drawImage(image, sx, sy, sheetSprite.frameWidth, sheetSprite.frameHeight, x, y, searchable.w, searchable.h);
        }
      }
    } else if (searchable.typeId === "alchemyWorkshop") {
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
      ctx.fillRect(x, y, searchable.w, searchable.h);
      ctx.strokeStyle = "rgba(250, 204, 21, 0.72)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, searchable.w, searchable.h);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 11px Georgia";
      ctx.textAlign = "center";
      ctx.fillText("Alchemy", x + searchable.w * 0.5, y + 24);
      ctx.fillText("Workshop", x + searchable.w * 0.5, y + 40);
      ctx.restore();
    } else if (searchable.typeId === "blacksmith") {
      ctx.save();
      ctx.fillStyle = "rgba(28, 25, 23, 0.94)";
      ctx.fillRect(x, y, searchable.w, searchable.h);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.78)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, searchable.w, searchable.h);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 11px Georgia";
      ctx.textAlign = "center";
      ctx.fillText("Blacksmith", x + searchable.w * 0.5, y + 24);
      ctx.fillText("Forge", x + searchable.w * 0.5, y + 40);
      ctx.restore();
    } else if (searchable.typeId === "ringSelectionShop") {
      drawRingSelectionShop(ctx, game, searchable, x, y);
    } else {
      const { sprites } = searchableDef;
      if (sprites) {
        let image = game.assets[sprites.closedAsset];
        if (searchable.isOpen) {
          if ((searchable.openTimer || 0) > 0 && sprites.openFrames?.length) {
            const duration = Math.max(0.001, searchableDef.openAnimDuration || 0.001);
            const progress = 1 - searchable.openTimer / duration;
            const frameIndex = Math.min(
              sprites.openFrames.length - 1,
              Math.max(0, Math.floor(progress * sprites.openFrames.length))
            );
            image = game.assets[sprites.openFrames[frameIndex]] || game.assets[sprites.openStaticAsset];
          } else {
            image = game.assets[sprites.openStaticAsset];
          }
        }
        if (image) {
          if (searchable.typeId === "treasureSpirit") {
            const pulse = Math.sin(game.time * 3.2) * 0.5 + 0.5;
            const cx = x + searchable.w * 0.5;
            const cy = y + searchable.h * 0.5;
            const auraR = searchable.w * 0.72 + pulse * 6;
            ctx.save();
            ctx.shadowBlur = 28 + pulse * 12;
            ctx.shadowColor = "#facc15";
            const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
            aura.addColorStop(0, `rgba(253, 224, 71, ${0.35 + pulse * 0.2})`);
            aura.addColorStop(0.6, `rgba(250, 204, 21, ${0.18 + pulse * 0.1})`);
            aura.addColorStop(1, "rgba(250, 204, 21, 0)");
            ctx.fillStyle = aura;
            ctx.beginPath();
            ctx.arc(cx, cy, auraR, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 18 + pulse * 8;
            ctx.drawImage(image, x, y, searchable.w, searchable.h);
            ctx.restore();
          } else if (searchable.typeId === "cursedAnvil") {
            const dw = searchable.w * 0.5;
            const dh = searchable.h * 0.5;
            ctx.drawImage(image, x + (searchable.w - dw) * 0.5, y + (searchable.h - dh) * 0.5, dw, dh);
          } else {
            ctx.drawImage(image, x, y, searchable.w, searchable.h);
          }
        }
      }
    }
    ctx.restore();
    if (searchable.isOpen || searchable.introOnly) continue;
    const interact = getSearchableInteractState(game, searchable);
    ctx.save();
    ctx.textAlign = "center";
    if (!interact.isFreeInteract) {
      ctx.font = "bold 12px Georgia";
      ctx.fillStyle = interact.affordable ? "#facc15" : "#fb7185";
      ctx.fillText(`${interact.goldCost}g`, x + searchable.w * 0.5, y - 12);
    }
    if (interact.inRange) {
      ctx.font = "10px Georgia";
      ctx.fillStyle = "rgba(241, 245, 249, 0.95)";
      ctx.fillText(searchableDef.interactLabel || "E Open", x + searchable.w * 0.5, y - (interact.isFreeInteract ? 12 : 26));
    }
    ctx.restore();
  }
}

function drawTreasureSpirit(ctx, game) {
  const spirit = getTreasureSpiritRenderState(game);
  if (!spirit) return;

  const camX = game.camera.x;
  const camY = game.camera.y;
  const bob = Math.sin(spirit.bobClock * 2.2) * 4;

  if (Array.isArray(spirit.trail) && spirit.trail.length > 0) {
    ctx.save();
    for (const point of spirit.trail) {
      const alpha = Math.max(0, 1 - point.age / 20);
      if (alpha <= 0.01) continue;
      if (!isWorldRectVisible(game, point.x - 18, point.y - 18, 36, 36, 8)) continue;
      const px = point.x - camX;
      const py = point.y - camY;
      ctx.fillStyle = `rgba(250, 204, 21, ${alpha * 0.16})`;
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(254, 240, 138, ${alpha * 0.35})`;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (spirit.state === "complete") return;

  // --- Spirit sprite ---
  const fw = 32;
  const fh = 32;
  const sx = spirit.x - camX - fw * 0.5;
  const sy = spirit.y - camY - fh * 0.5 + bob;

  if (isWorldRectVisible(game, spirit.x - fw, spirit.y - fh, fw * 2, fh * 2, 8)) {
    const sheet = game.assets?.treasureSpiritSheet;
    if (sheet) {
      const frameIndex = Math.floor(spirit.bobClock / 0.1) % 8;
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#facc15";
      ctx.drawImage(sheet, frameIndex * fw, 0, fw, fh, Math.round(sx), Math.round(sy), fw, fh);
      ctx.restore();
    }
  }

  // --- Destination marker (guiding / waitingAtStop / combatLocked) ---
  const showMarker = spirit.state === "guiding"
    || spirit.state === "waitingAtStop"
    || spirit.state === "combatLocked";

  if (showMarker) {
    const stop = spirit.stops[spirit.stopIndex];
    if (stop) {
      const mx = stop.destX - camX;
      const my = stop.destY - camY;
      const pulse = Math.sin(game.time * 3) * 0.5 + 0.5; // 0..1
      const markerR = 18 + pulse * 6;

      if (isWorldRectVisible(game, stop.destX - 40, stop.destY - 40, 80, 80, 8)) {
        ctx.save();

        if (spirit.state === "combatLocked") {
          // Red pulsing ring — combat in progress
          ctx.shadowBlur = 14;
          ctx.shadowColor = "#f87171";
          ctx.strokeStyle = `rgba(248, 113, 113, ${0.5 + pulse * 0.4})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(mx, my, markerR, 0, Math.PI * 2);
          ctx.stroke();
          // Inner fill
          const combatGrad = ctx.createRadialGradient(mx, my, 0, mx, my, markerR);
          combatGrad.addColorStop(0, `rgba(248, 113, 113, ${0.12 + pulse * 0.08})`);
          combatGrad.addColorStop(1, "rgba(248, 113, 113, 0)");
          ctx.fillStyle = combatGrad;
          ctx.beginPath();
          ctx.arc(mx, my, markerR, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Gold pulsing ring — destination marker
          ctx.shadowBlur = 12;
          ctx.shadowColor = "#facc15";
          ctx.strokeStyle = `rgba(250, 204, 21, ${0.45 + pulse * 0.45})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(mx, my, markerR, 0, Math.PI * 2);
          ctx.stroke();
          // Soft fill
          const destGrad = ctx.createRadialGradient(mx, my, 0, mx, my, markerR);
          destGrad.addColorStop(0, `rgba(250, 204, 21, ${0.1 + pulse * 0.08})`);
          destGrad.addColorStop(1, "rgba(250, 204, 21, 0)");
          ctx.fillStyle = destGrad;
          ctx.beginPath();
          ctx.arc(mx, my, markerR, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }
  }
}

function drawDevilMerchant(ctx, game) {
  const merchant = getDevilMerchantRenderState(game);
  if (!merchant || merchant.state === "closed") return;

  const fw = 48;
  const fh = 48;
  const camX = game.camera.x;
  const camY = game.camera.y;
  const bob = Math.sin(merchant.bobClock * 1.8) * 3;
  const mx = merchant.x - camX - fw * 0.5;
  const my = merchant.y - camY - fh * 0.5 + bob;

  if (!isWorldRectVisible(game, merchant.x - fw, merchant.y - fh, fw * 2, fh * 2, 8)) return;

  const sheet = game.assets?.devilMerchantSheet;
  if (!sheet) return;

  const pulse = Math.sin(game.time * 2.4) * 0.5 + 0.5;
  const frameIndex = Math.floor(merchant.bobClock / 0.1) % 8;

  ctx.save();
  ctx.shadowBlur = 18 + pulse * 10;
  ctx.shadowColor = "#991b1b";
  ctx.drawImage(sheet, frameIndex * fw, 0, fw, fh, Math.round(mx), Math.round(my), fw, fh);
  ctx.restore();
}

function drawGoldDrops(ctx, game) {
  const goldDropSprites = game.assets?.goldDropSprites;

  for (const drop of game.goldDrops || []) {
    if (!isWorldCircleVisible(game, drop.x, drop.y, drop.radius + 8, 16)) continue;
    const screenX = drop.x - game.camera.x;
    const screenY = drop.y - game.camera.y;
    const height = Math.max(0, drop.z || 0);
    const spriteScale = 0.18 + Math.min(0.06, (drop.value || 1) * 0.006);
    const drawSize = Math.round(64 * spriteScale);
    const spriteX = Math.round(screenX - drawSize * 0.5);
    const spriteY = Math.round(screenY - height - drawSize + 8);
    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 23, 0.32)";
    ctx.beginPath();
    ctx.ellipse(
      screenX,
      screenY + drop.radius * 0.55,
      drop.radius * Math.max(0.52, 0.78 - height * 0.01),
      drop.radius * 0.28,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    if (goldDropSprites) {
      const frame = getGoldDropSpriteFrame(drop);
      ctx.translate(screenX, spriteY + drawSize * 0.5);
      ctx.rotate(drop.rotation || 0);
      ctx.drawImage(
        goldDropSprites,
        frame.col * 64,
        frame.row * 64,
        64,
        64,
        -drawSize * 0.5,
        -drawSize * 0.5,
        drawSize,
        drawSize
      );
    } else {
      ctx.fillStyle = drop.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY - height, drop.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.arc(screenX - drop.radius * 0.2, screenY - height - drop.radius * 0.2, Math.max(2, drop.radius * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawRingDrops(ctx, game) {
  const atlas = game.assets.itemsAtlas;
  for (const drop of game.ringDrops || []) {
    if (!isWorldRectVisible(game, drop.x - 20, drop.y - 24, 40, 48, 16)) continue;
    const ringDef = getRingDefById(drop.ringId);
    if (!ringDef) continue;
    const bobY = Math.sin(drop.bobClock * 4) * 3;
    const screenX = drop.x - game.camera.x;
    const screenY = drop.y - game.camera.y + bobY;
    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 23, 0.45)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 12, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const individualIcon = ringDef.iconAssetKey ? game.assets[ringDef.iconAssetKey] : null;
    if (individualIcon) {
      ctx.drawImage(
        individualIcon,
        screenX - 16,
        screenY - 18,
        32,
        32
      );
    } else if (atlas) {
      ctx.drawImage(
        atlas,
        ringDef.spriteCell.col * 32,
        ringDef.spriteCell.row * 32,
        32,
        32,
        screenX - 16,
        screenY - 18,
        32,
        32
      );
    }
    ctx.strokeStyle = getRingRarityColor(ringDef.dropRarity);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(screenX - 16, screenY - 18, 32, 32);
    ctx.restore();
  }
}

function drawMaterialDrops(ctx, game) {
  for (const drop of game.materialDrops || []) {
    if (!isWorldCircleVisible(game, drop.x, drop.y, (drop.radius || 18) + 10, 16)) continue;
    const materialDef = getMaterialDefById(drop.materialId);
    if (!materialDef) continue;
    const bobY = (drop.grounded && (drop.vx || 0) === 0 && (drop.vy || 0) === 0)
      ? Math.sin((drop.bobClock || 0) * 4.5) * 3
      : 0;
    const screenX = drop.x - game.camera.x;
    const screenY = drop.y - game.camera.y + bobY;
    const height = Math.max(0, drop.z || 0);
    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 23, 0.38)";
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 10, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!materialDef.suppressDropGlow) {
      ctx.fillStyle = drop.glow || "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.arc(screenX, screenY, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    const image = game.assets?.[materialDef.assetKey];
    if (image) {
      ctx.translate(screenX, screenY - height);
      ctx.rotate(drop.rotation || 0);
      drawImageContain(ctx, image, -12, -8, 24, 16);
    } else {
      ctx.translate(screenX, screenY - height);
      ctx.rotate(drop.rotation || 0);
      ctx.fillStyle = drop.color || "#d6d3d1";
      ctx.beginPath();
      ctx.roundRect(-5, -13, 10, 22, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(248,250,252,0.92)";
      ctx.beginPath();
      ctx.arc(0, -8, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawSkillIcon(ctx, game, skillId, x, y, size) {
  const icon = getSkillIconFrame(game.assets, skillId);
  if (!icon) return false;
  ctx.drawImage(
    icon.image,
    icon.frame.x,
    icon.frame.y,
    icon.frame.w,
    icon.frame.h,
    x,
    y,
    size,
    size
  );
  return true;
}

function drawSkillHud(ctx, game) {
  const slots = [...getRunSkillSlots(game)];
  const movementSlot = getMovementSkillSlot(game);
  if (movementSlot) slots.push(movementSlot);
  if (!slots.length) return;
  const panelWidth = 384;
  const panelHeight = 82;
  const slotWidth = 86;
  const slotHeight = 60;
  const panelX = Math.round((game.canvas.width - panelWidth) * 0.5);
  const panelY = game.canvas.height - panelHeight - 12;

  ctx.save();
  ctx.fillStyle = "rgba(8, 15, 26, 0.78)";
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.strokeStyle = "rgba(96, 165, 250, 0.32)";
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 13px Georgia";
  ctx.fillText("Run Skills", panelX + 12, panelY + 20);

  slots.forEach((slot, index) => {
    const x = panelX + 12 + index * (slotWidth + 8);
    const y = panelY + 24;
    const cooldownRatio = slot.cooldownDuration > 0 ? clamp(slot.cooldownRemaining / slot.cooldownDuration, 0, 1) : 0;
    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.fillRect(x, y, slotWidth, slotHeight);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.28)";
    ctx.strokeRect(x, y, slotWidth, slotHeight);

    ctx.fillStyle = "rgba(30, 41, 59, 0.92)";
    ctx.fillRect(x + 6, y + 6, 18, 18);
    const drewIcon = slot.skillId ? drawSkillIcon(ctx, game, slot.skillId, x + 6, y + 6, 18) : false;
    if (!drewIcon) {
      ctx.fillStyle = "#93c5fd";
      ctx.font = "bold 11px Georgia";
      ctx.textAlign = "center";
      ctx.fillText(slot.keyLabel || `${index + 1}`, x + 15, y + 19);
    }
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 12px Georgia";
    ctx.textAlign = "center";
    if (drewIcon) ctx.fillText(slot.keyLabel || `${index + 1}`, x + 15, y + 19);

    ctx.textAlign = "left";
    ctx.font = "bold 11px Georgia";
    ctx.fillText(slot.def?.name || slot.name || slot.skillId, x + 30, y + 18);
    ctx.font = "10px Georgia";
    ctx.fillStyle = "#cbd5e1";
    if (slot.maxCharges > 0) {
      ctx.fillText(`Charges ${slot.charges}/${slot.maxCharges}`, x + 6, y + 36);
    } else if (slot.maxBasicCharges > 0) {
      ctx.fillText(`Charge ${slot.basicCharges}/${slot.maxBasicCharges}`, x + 6, y + 36);
    } else if (slot.isActive) {
      ctx.fillStyle = "#fda4af";
      ctx.fillText("Active", x + 6, y + 36);
    } else {
      ctx.fillText(cooldownRatio > 0 ? `${slot.cooldownRemaining.toFixed(1)}s` : "Ready", x + 6, y + 36);
    }

    const hunterStacks = slot.skillId === "hunterShot" ? (game.combat.skillRuntime?.hunterShotStacks?.length || 0) : 0;
    const ghostProgress = slot.skillId === "hauntingGhostCharges" ? (slot.killProgress || 0) : 0;
    if (hunterStacks > 0) {
      ctx.fillStyle = "#fde68a";
      ctx.fillText(`Stacks ${hunterStacks}`, x + 6, y + 49);
    } else if (ghostProgress > 0) {
      ctx.fillStyle = "#ddd6fe";
      ctx.fillText(`Kills ${ghostProgress}/5`, x + 6, y + 49);
    }

    if (cooldownRatio > 0) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.68)";
      ctx.fillRect(x, y, slotWidth, slotHeight * cooldownRatio);
    }
  });
  ctx.restore();
}

function drawHud(ctx, game) {
  ctx.save();
  ctx.fillStyle = "rgba(8, 15, 26, 0.78)";
  ctx.fillRect(12, 12, 292, 108);
  ctx.strokeStyle = "rgba(167, 139, 250, 0.38)";
  ctx.strokeRect(12, 12, 292, 108);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 14px Georgia";
  ctx.fillText(game.heroDef.name, 24, 30);
  ctx.font = "12px Georgia";
  ctx.fillStyle = "#38bdf8";
  ctx.fillText(`Lv ${game.player.level || 1}`, 120, 30);
  ctx.fillStyle = "#c4b5fd";
  ctx.fillText(game.weaponArt.def?.name ? `Art ${game.weaponArt.def.name}` : "", 120, 52);
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(`Room ${game.roomIndex + 1} / ${game.maxRooms}`, 210, 30);
  ctx.fillText(`Kills ${game.kills}`, 210, 52);
  ctx.fillText(`Dash ${game.player.movement.dashCharges}/${getMaxDashCharges(game)}`, 24, 52);
  ctx.fillText(`XP ${game.player.xp || 0} / ${game.player.xpToNext || 10}`, 24, 74);
  ctx.fillText(`Enemies ${game.enemies.length}`, 210, 74);
  ctx.fillStyle = "#facc15";
  ctx.fillText(`Gold ${game.gold}`, 210, 96);
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(`Rings ${game.getOwnedRings().length}`, 24, 96);
  ctx.fillText(`Finger Mats ${Object.values(game.materialInventory || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)}`, 120, 74);
  ctx.fillText(`Equipped ${game.equippedRings.filter(Boolean).length}/${game.getAvailableRingSlotCount()}`, 120, 96);
  ctx.restore();
}

function drawEnemyTestHud(ctx, game) {
  const controlledEnemy = game.enemyTest?.controlledEnemy;
  const dummy = game.enemyTest?.dummyTarget;
  if (!controlledEnemy) return;
  const attackKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  const runtime = controlledEnemy.attackRuntime;

  ctx.save();
  ctx.fillStyle = "rgba(8, 15, 26, 0.82)";
  ctx.fillRect(12, 12, 360, 112);
  ctx.strokeStyle = "rgba(96, 165, 250, 0.32)";
  ctx.strokeRect(12, 12, 360, 112);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 15px Georgia";
  ctx.fillText(`${controlledEnemy.name} Test Room`, 24, 32);
  ctx.font = "12px Georgia";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(`Dummy HP ${Math.ceil(dummy?.hp || 0)} / ${dummy?.maxHp || 0}`, 24, 54);
  ctx.fillText("Esc back to start menu", 24, 76);
  ctx.fillText("Move with WASD, aim with mouse", 24, 98);
  ctx.restore();

  const panelX = Math.round(game.canvas.width - 320);
  const panelY = 12;
  const rowHeight = 26;
  ctx.save();
  ctx.fillStyle = "rgba(8, 15, 26, 0.82)";
  ctx.fillRect(panelX, panelY, 308, 12 + rowHeight * attackKeys.length);
  ctx.strokeStyle = "rgba(244, 114, 182, 0.28)";
  ctx.strokeRect(panelX, panelY, 308, 12 + rowHeight * attackKeys.length);
  ctx.font = "12px Georgia";
  attackKeys.forEach((key, index) => {
    const attack = controlledEnemy.attacks[index];
    const y = panelY + 22 + index * rowHeight;
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(`${key}`, panelX + 10, y);
    if (!attack) {
      ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
      ctx.fillText("Empty", panelX + 30, y);
      return;
    }
    const cooldown = runtime?.cooldowns?.[attack.id] ?? 0;
    const active = runtime?.currentAttack?.id === attack.id && runtime?.state !== "recover";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(attack.id, panelX + 30, y);
    ctx.fillStyle = active ? "#fca5a5" : cooldown > 0 ? "#facc15" : "#86efac";
    ctx.fillText(active ? runtime.state : cooldown > 0 ? `${cooldown.toFixed(1)}s` : "Ready", panelX + 226, y);
  });
  ctx.restore();
}

function drawOverlay(ctx, game) {
  const defeatOverlayVisible = game.state !== "defeat" || game.isDefeatOverlayVisible?.();
  const showStateOverlay = !(game.state === "running" && !game.roomCleared);
  if (showStateOverlay && defeatOverlayVisible) {
    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 23, 0.54)";
    ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.font = "bold 30px Georgia";
    if (game.state === "victory") {
      ctx.fillText("Prototype Cleared", game.canvas.width / 2, game.canvas.height / 2 - 10);
      ctx.font = "15px Georgia";
      ctx.fillText("Press R to run again", game.canvas.width / 2, game.canvas.height / 2 + 24);
    } else if (game.state === "paused") {
      ctx.fillText("Paused", game.canvas.width / 2, game.canvas.height / 2 - 10);
      ctx.font = "15px Georgia";
      ctx.fillText("Press Esc to resume", game.canvas.width / 2, game.canvas.height / 2 + 24);
    } else if (game.state === "defeat") {
      ctx.fillText("Run Failed", game.canvas.width / 2, game.canvas.height / 2 - 10);
      ctx.font = "15px Georgia";
      ctx.fillText("Press R to restart", game.canvas.width / 2, game.canvas.height / 2 + 24);
    } else if (game.roomCleared) {
      ctx.fillText(game.roomMinibossSpawned ? "Miniboss Defeated" : "Room Cleared", game.canvas.width / 2, game.canvas.height / 2 - 10);
      ctx.font = "15px Georgia";
      ctx.fillText("Advancing to the next room...", game.canvas.width / 2, game.canvas.height / 2 + 24);
    } else if (game.state === "loading") {
      ctx.fillText("Loading", game.canvas.width / 2, game.canvas.height / 2);
    }
    ctx.restore();
  }

  if ((game.inkFlashTimer || 0) > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(3,7,18,${Math.min(0.45, game.inkFlashTimer * 0.25)})`;
    ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);
    ctx.restore();
  }
}

function drawExperienceDrops(ctx, game) {
  for (const drop of game.xpDrops || []) {
    if (!isWorldCircleVisible(game, drop.x, drop.y, drop.radius + 16, 16)) continue;
    const screenX = drop.x - game.camera.x;
    const screenY = drop.y - game.camera.y;
    const height = Math.max(0, drop.z || 0);
    
    ctx.save();
    // Shadow
    ctx.fillStyle = "rgba(2, 6, 23, 0.24)";
    ctx.beginPath();
    ctx.ellipse(
      screenX,
      screenY + drop.radius * 0.55,
      drop.radius * Math.max(0.52, 0.78 - height * 0.01),
      drop.radius * 0.28,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Visual center
    const vx = screenX;
    const vy = screenY - height;

    // Glow (Simplified replacement for shadowBlur)
    const glowRadius = drop.radius * 2.2;
    const gradient = ctx.createRadialGradient(vx, vy, drop.radius * 0.2, vx, vy, glowRadius);
    gradient.addColorStop(0, drop.color || "#38bdf8");
    gradient.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(vx, vy, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Core
    ctx.fillStyle = "#f0f9ff";
    ctx.beginPath();
    ctx.arc(vx, vy, drop.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

export function renderGame(ctx, game) {
  ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);
  ctx.imageSmoothingEnabled = false;
  if (!game.world || !game.assets?.tiles) {
    drawOverlay(ctx, game);
    return;
  }
  const renderScale = getCameraRenderScale(game);
  ctx.save();
  ctx.scale(renderScale.x, renderScale.y);
  drawWorld(ctx, game);
  drawWorldDecorations(ctx, game, false);
  drawTrees(ctx, game, false);
  drawBiomeObstacles(ctx, game, false);
  drawSearchables(ctx, game);
  drawTreasureSpirit(ctx, game);
  drawDevilMerchant(ctx, game);
  drawBreakables(ctx, game);
  drawBloodDecals(ctx, game);
  drawSkillEffects(ctx, game);
  drawProjectiles(ctx, game);
  drawGoldDrops(ctx, game);
  drawExperienceDrops(ctx, game);
  drawMaterialDrops(ctx, game);
  drawRingDrops(ctx, game);
  drawEnemies(ctx, game);
  if (game.scene?.id === "enemy-test") {
    drawEnemyCollisionDebug(ctx, game);
  }
  drawCombatFeedback(ctx, game);
  if (game.scene?.id === "enemy-test") {
    drawBiomeObstacles(ctx, game, true);
    drawTrees(ctx, game, true);
    drawWorldDecorations(ctx, game, true);
  } else {
    drawSoulSiphonSpirit(ctx, game);
    drawHeroDashStreak(ctx, game);
    drawHeroDashFlash(ctx, game);
    drawHeroDashAfterimages(ctx, game);
    drawMirrorClone(ctx, game);
    drawHero(ctx, game);
    drawSpirit(ctx, game);
    drawDarkGrasp(ctx, game);
    drawLightningDash(ctx, game);
    drawDashChargesAbovePlayer(ctx, game);
    drawBiomeObstacles(ctx, game, true);
    drawTrees(ctx, game, true);
    drawWorldDecorations(ctx, game, true);
    drawPlayerHealthOverlay(ctx, game);
  }
  drawWorldLighting(ctx, game);
  drawAmbientLeaves(ctx, game);
  drawAmbientMagicParticles(ctx, game);
  ctx.restore();
  drawCameraVignette(ctx, game);
  if (game.scene?.id === "enemy-test") {
    drawEnemyTestHud(ctx, game);
  } else {
    drawSkillHud(ctx, game);
    drawDamageFlash(ctx, game);
  }
  drawOverlay(ctx, game);
}

export function renderCombatPreview(ctx, game) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#08101c");
  gradient.addColorStop(1, "#02070f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.fillStyle = "rgba(91, 173, 255, 0.08)";
  ctx.beginPath();
  ctx.arc(width * 0.24, height * 0.2, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(196, 181, 253, 0.08)";
  ctx.beginPath();
  ctx.arc(width * 0.78, height * 0.24, 74, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (game.world?.cosmeticFloor?.groundLayer) {
    const previewCamera = {
      x: 0,
      y: 0,
      viewWidth: width,
      viewHeight: height
    };
    drawOpenWorldGroundBase(ctx, game.world.cosmeticFloor.groundLayer, previewCamera);
    drawOpenWorldGroundDetails(ctx, game.world.cosmeticFloor.groundLayer, previewCamera);
    drawOpenWorldGroundDecor(ctx, game.world.cosmeticFloor.groundLayer, previewCamera);
  } else {
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
    ctx.fillRect(0, height - 82, width, 82);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 82);
    ctx.lineTo(width, height - 82);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(width * (1 - WORLD_RENDER_ZOOM) * 0.5, height * (1 - WORLD_RENDER_ZOOM) * 0.5);
  ctx.scale(WORLD_RENDER_ZOOM, WORLD_RENDER_ZOOM);
  drawProjectiles(ctx, game);
  drawEnemies(ctx, game);
  drawCombatFeedback(ctx, game);
  drawSoulSiphonSpirit(ctx, game);
  drawHero(ctx, game);
  ctx.restore();
}
