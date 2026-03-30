import { clamp, formatStateLabel, frameIndexFromClock } from "../core/runtime-utils.js";
import { getAffixDef } from "../data/enemy-affixes.js";
import { getRingDefById, getRingRarityColor } from "../data/rings.js";
import { getSkillIconFrame } from "../data/skill-icons.js";
import { drawBreakables } from "../systems/breakables.js";
import { drawOpenWorldGroundBase, drawOpenWorldGroundDecor, drawOpenWorldGroundDetails } from "../systems/biome-floor.js";
import { drawUpperCliffDecor } from "../systems/biome-upper-cliff.js";
import { getSearchableInteractState } from "../systems/searchables.js";
import { SEARCHABLE_DEFS } from "../data/searchables.js";
import { getMaxDashCharges } from "../systems/rings.js";
import { getRunSkillEffects, getRunSkillSlots } from "../systems/skills.js";

function drawTile(ctx, atlas, row, col, x, y, size = 32) {
  if (!atlas) return;
  ctx.drawImage(atlas, col * 32, row * 32, 32, 32, x, y, size, size);
}

let treeFadeScratch = null;

function getTreeFadeScratch(width, height) {
  if (!treeFadeScratch) treeFadeScratch = document.createElement("canvas");
  if (treeFadeScratch.width !== width || treeFadeScratch.height !== height) {
    treeFadeScratch.width = width;
    treeFadeScratch.height = height;
  }
  return treeFadeScratch;
}

function distancePointToRect(px, py, rect) {
  const nx = clamp(px, rect.x, rect.x + rect.w);
  const ny = clamp(py, rect.y, rect.y + rect.h);
  return Math.hypot(px - nx, py - ny);
}

function directionRowIndex(heroDef, directionKey) {
  const row = heroDef.sprite.rowOrder.indexOf(directionKey);
  return row >= 0 ? row : heroDef.sprite.rowOrder.indexOf("down");
}

function heroStateKey(game) {
  if (game.state === "defeat") return "dead";
  if (game.combat.playerAction?.animationKey) return game.combat.playerAction.animationKey;
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
    if (progress < 0.5 && states.dashStart) {
      return {
        stateKey: "dashStart",
        stateDef: states.dashStart,
        progress: progress / 0.5
      };
    }
    if (states.dashEnd) {
      return {
        stateKey: "dashEnd",
        stateDef: states.dashEnd,
        progress: (progress - 0.5) / 0.5
      };
    }
  }
  return {
    stateKey,
    stateDef: states[stateKey] || states.cast || states.idle,
    progress: null
  };
}

function getHeroDrawMetrics(game) {
  const drawSize = Math.round((game.player.baseDrawSize || 128) * (game.player.ringSizeMult || 1));
  const screenX = Math.round(game.player.x - game.camera.x - (drawSize - game.player.w) * 0.5);
  const screenY = Math.round(game.player.y - game.camera.y - (drawSize - game.player.h) * 0.7);
  return { drawSize, screenX, screenY };
}

function drawHero(ctx, game) {
  const stateKey = heroStateKey(game);
  const resolvedState = resolveHeroStateDef(game, stateKey);
  const stateDef = resolvedState.stateDef;
  if (!stateDef) return;
  const image = game.assets[stateDef.asset];
  if (!image) return;
  const row = directionRowIndex(game.heroDef, game.player.facing);
  let frame = 0;
  if (stateDef.loop) {
    frame = frameIndexFromClock(game.player.animClock, stateDef.fps, stateDef.frames);
  } else if (game.combat.playerAction) {
    const total = Math.max(0.001, game.combat.playerAction.duration || 0.001);
    const progress = clamp(1 - game.combat.castTimer / total, 0, 0.999);
    frame = Math.floor(progress * stateDef.frames);
  } else if (stateKey === "dash") {
    const progress = clamp(resolvedState.progress ?? 0, 0, 0.999);
    frame = Math.floor(progress * stateDef.frames);
  } else if (stateKey === "slide") {
    const total = Math.max(0.001, game.heroDef.slide.duration);
    const progress = clamp(1 - game.player.movement.slideTimer / total, 0, 0.999);
    frame = Math.floor(progress * stateDef.frames);
  } else if (stateKey === "hit") {
    const total = Math.max(0.001, game.player.hitDuration || 0.34);
    const progress = clamp(1 - game.player.hitTimer / total, 0, 0.999);
    frame = Math.floor(progress * stateDef.frames);
  } else if (stateKey === "dead") {
    frame = stateDef.frames - 1;
  }
  const frameWidth = game.heroDef.sprite.frameWidth;
  const frameHeight = game.heroDef.sprite.frameHeight;
  const sx = frame * frameWidth;
  const sy = row * frameHeight;
  const { drawSize, screenX, screenY } = getHeroDrawMetrics(game);
  ctx.save();
  ctx.globalAlpha = game.player.isInvisible ? 0.42 : 1;
  ctx.drawImage(image, sx, sy, frameWidth, frameHeight, screenX, screenY, drawSize, drawSize);
  ctx.restore();
}

function drawPlayerHealthOverlay(ctx, game) {
  if (!game.player || game.player.maxHp <= 0) return;
  const hpRatio = clamp(game.player.hp / game.player.maxHp, 0, 1);
  const { drawSize, screenX, screenY } = getHeroDrawMetrics(game);
  const centerX = Math.round(screenX + drawSize * 0.5);
  const barWidth = Math.max(58, Math.round(game.player.w + 22));
  const barHeight = 8;
  const barX = Math.round(centerX - barWidth * 0.5);
  const barY = Math.round(screenY - 14);

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

  if ((game.player.damageShield || 0) > 0) {
    ctx.font = "10px Georgia";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(`Shield ${Math.ceil(game.player.damageShield)}`, centerX, barY + 20);
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
  const spirit = game.combat.weaponArtRuntime?.soulSiphonSpirit;
  if (!spirit) return;
  const stateKey = spirit.attackTimer > 0 ? "attack" : "move";
  const image = game.assets[stateKey === "attack" ? "soulSiphonSpiritAttack" : "soulSiphonSpiritMove"];
  if (!image) return;
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

function drawEnemySprite(ctx, image, frameWidth, frameHeight, frame, x, y, width, height, flip = 1) {
  if (!image) return;
  ctx.save();
  if (flip < 0) {
    ctx.translate(x + width * 0.5, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + width * 0.5), 0);
  }
  ctx.drawImage(image, frame * frameWidth, 0, frameWidth, frameHeight, x, y, width, height);
  ctx.restore();
}

function drawProjectileSprite(ctx, image, projectile, screenX, screenY) {
  if (!image) return false;
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const drawWidth = projectile.drawSize || projectile.radius * 2;
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(angle);
  if (projectile.spriteFrameWidth || projectile.spriteFrameHeight || projectile.spriteFrames) {
    const frameWidth = projectile.spriteFrameWidth || image.naturalWidth;
    const frameHeight = projectile.spriteFrameHeight || image.naturalHeight;
    const totalFrames = Math.max(1, projectile.spriteFrames || Math.floor(image.naturalWidth / Math.max(1, frameWidth)));
    const fps = Math.max(1, projectile.spriteFps || 12);
    const loopStart = Math.max(0, Math.min(totalFrames - 1, projectile.spriteLoopStart ?? 0));
    const loopEnd = Math.max(loopStart, Math.min(totalFrames - 1, projectile.spriteLoopEnd ?? (totalFrames - 1)));
    const loopFrames = Math.max(1, loopEnd - loopStart + 1);
    const frame = totalFrames > 1
      ? loopStart + (Math.floor((projectile.age || 0) * fps) % loopFrames)
      : 0;
    const sourceWidth = Math.min(frameWidth, projectile.spriteCropWidth || frameWidth);
    const sourceHeight = Math.min(frameHeight, projectile.spriteCropHeight || frameHeight);
    const sourceX = frame * frameWidth + Math.max(0, Math.floor((frameWidth - sourceWidth) * 0.5));
    const sourceY = Math.max(0, Math.floor((frameHeight - sourceHeight) * 0.5));
    const drawHeight = drawWidth * (sourceHeight / Math.max(1, sourceWidth));
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      -drawWidth * 0.5,
      -drawHeight * 0.5,
      drawWidth,
      drawHeight
    );
  } else {
    ctx.drawImage(image, -drawWidth * 0.5, -drawWidth * 0.2, drawWidth, drawWidth * 0.4);
  }
  ctx.restore();
  return true;
}

function rowIndexFromDirection(enemy) {
  const rowOrder = enemy.rowOrder || ["right", "right_down", "down", "left_down", "left", "left_up", "up", "right_up"];
  const index = rowOrder.indexOf(enemy.direction || "down");
  return index >= 0 ? index : rowOrder.indexOf("down");
}

function drawUndeadTelegraph(ctx, game, enemy) {
  const runtime = enemy.attackRuntime;
  const attack = runtime?.currentAttack;
  if (!attack || runtime.state !== "windup") return;
  const progress = clamp(1 - runtime.timer / Math.max(0.001, runtime.windupDuration), 0, 1);
  const alpha = 0.12 + progress * 0.2;
  const originX = enemy.x + enemy.w * 0.5 - game.camera.x;
  const originY = enemy.y + enemy.h * 0.5 - game.camera.y;
  const target = runtime.telegraphTarget || { x: enemy.x + enemy.w * 0.5, y: enemy.y + enemy.h * 0.5 };
  const dirX = target.x - (enemy.x + enemy.w * 0.5);
  const dirY = target.y - (enemy.y + enemy.h * 0.5);
  const angle = Math.atan2(dirY, dirX);

  ctx.save();
  ctx.strokeStyle = attack.kind.includes("fire") ? `rgba(251,146,60,${alpha})` : `rgba(248,113,113,${alpha})`;
  ctx.fillStyle = attack.kind.includes("magic") ? `rgba(96,165,250,${alpha * 0.75})` : `rgba(248,113,113,${alpha * 0.75})`;
  ctx.lineWidth = 2;
  if (attack.kind.includes("circle") || attack.kind === "warcry" || attack.kind === "arrow_rain" || attack.kind === "targeted_rain_zone" || attack.kind === "poison_pool" || attack.kind === "poisonous_blessing" || attack.kind === "darkfire_pillar" || attack.kind === "earthquake" || attack.kind === "volcano" || attack.kind === "fire_cleanse" || attack.kind === "fire_leap") {
    const atTarget = enemy.role === "ranged" && attack.maxRange > 280 && attack.kind !== "warcry";
    const cx = (atTarget ? target.x : enemy.x + enemy.w * 0.5) - game.camera.x;
    const cy = (atTarget ? target.y : enemy.y + enemy.h * 0.5) - game.camera.y;
    const radiusX = attack.radius || 60;
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
  } else if (attack.kind.includes("projectile")) {
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + Math.cos(angle) * 180, originY + Math.sin(angle) * 180);
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

function drawEnemies(ctx, game) {
  for (const enemy of game.enemies) {
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
      ctx.strokeStyle = `rgba(251,146,60,${0.18 + progress * 0.24})`;
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
    const frame = enemy.attackRuntime ? (enemy.render?.frame ?? 0) : frameIndexFromClock(enemy.animClock, sprite.fps, sprite.frames);
    const frameWidth = image.naturalWidth / sprite.frames;
    const frameHeight = enemy.attackRuntime ? image.naturalHeight / 8 : image.naturalHeight;
    const hitFlash = clamp((enemy.hitTimer || 0) / Math.max(0.001, enemy.hitDuration || 0.1), 0, 1);
    const hitOffsetX = Math.round((enemy.hitDirX || 0) * 4 * hitFlash);
    const hitOffsetY = Math.round((enemy.hitDirY || 0) * 2 * hitFlash);
    const drawWidth = (enemy.drawSize || enemy.w) * (1 + hitFlash * 0.05);
    const drawHeight = (enemy.drawSize || enemy.h) * (1 - hitFlash * 0.04);
    const x = Math.round(enemy.x - game.camera.x - (drawWidth - enemy.w) * 0.5 + hitOffsetX);
    const y = Math.round(enemy.y - game.camera.y - (drawHeight - enemy.h) * 0.7 + hitOffsetY);
    const centerX = enemy.x + enemy.w * 0.5 - game.camera.x;
    const centerY = enemy.y + enemy.h * 0.5 - game.camera.y;
    const speedBuffActive = (enemy.attackRuntime?.buffs?.speedUntil || 0) > game.time;
    const damageBuffActive = (enemy.damageBuffUntil || 0) > game.time;
    for (const effect of enemy.attackRuntime?.activeEffects || []) {
      if (effect.kind === "fire_thrower") drawFireThrowerVfx(ctx, game, enemy, effect);
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
    if (enemy.attackRuntime) {
      const row = rowIndexFromDirection(enemy);
      ctx.drawImage(image, frame * frameWidth, row * frameHeight, frameWidth, frameHeight, x, y, drawWidth, drawHeight);
    } else {
      drawEnemySprite(ctx, image, frameWidth, frameHeight, frame, x, y, drawWidth, drawHeight, enemy.facing);
    }
    ctx.restore();
    if (hitFlash > 0.01) {
      ctx.save();
      ctx.globalAlpha = hitFlash * 0.38;
      ctx.filter = `brightness(${1 + hitFlash * 1.6}) saturate(${1 + hitFlash * 0.9})`;
      ctx.shadowColor = `rgba(255, 148, 148, ${0.45 * hitFlash})`;
      ctx.shadowBlur = 10 * hitFlash;
      if (enemy.attackRuntime) {
        const row = rowIndexFromDirection(enemy);
        ctx.drawImage(image, frame * frameWidth, row * frameHeight, frameWidth, frameHeight, x, y, drawWidth, drawHeight);
      } else {
        drawEnemySprite(ctx, image, frameWidth, frameHeight, frame, x, y, drawWidth, drawHeight, enemy.facing);
      }
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
    for (const orb of enemy.affixState?.deflectOrbs || []) {
      ctx.fillStyle = "#38bdf8";
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
    if (enemy.showHealthBar) {
      const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
      const frameSize = enemy.drawSize || enemy.w;
      const barWidth = enemy.w / 3;
      const barX = Math.round(x + frameSize * 0.5 - barWidth * 0.5);
      const barY = Math.round(y + frameSize * 0.3);
      ctx.fillStyle = "rgba(2, 6, 23, 0.8)";
      ctx.fillRect(barX, barY, barWidth, 5);
      ctx.fillStyle = hpRatio > 0.4 ? "#4ade80" : "#ef4444";
      ctx.fillRect(barX, barY, barWidth * hpRatio, 5);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.strokeRect(barX - 0.5, barY - 0.5, barWidth + 1, 6);
    }
    if (enemy.enemyTier === "elite" || enemy.enemyTier === "miniBoss") {
      ctx.strokeStyle = enemy.enemyTier === "miniBoss" ? "#fb7185" : "#fbbf24";
      ctx.lineWidth = enemy.enemyTier === "miniBoss" ? 3 : 2;
      ctx.strokeRect(x - 2, y - 2, (enemy.drawSize || enemy.w) + 4, (enemy.drawSize || enemy.h) + 4);
    }
    if (enemy.affixes?.length) {
      const firstAffix = getAffixDef(enemy.affixes[0]);
      ctx.fillStyle = firstAffix.color;
      ctx.fillRect(x, y - 14, 6, 4);
      if (enemy.affixes.length > 1) {
        ctx.fillStyle = "rgba(248,250,252,0.9)";
        ctx.font = "10px Georgia";
        ctx.fillText(`+${enemy.affixes.length - 1}`, x + 9, y - 10);
      }
    }
    if ((enemy.state?.bleedStacks || 0) > 0) {
      ctx.fillStyle = "#fecaca";
      ctx.font = "10px Georgia";
      ctx.fillText(`Bleed ${enemy.state.bleedStacks}`, x, y - 20);
    }
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

  for (const rect of world.voidRects || []) {
    const screenX = rect.x - camera.x;
    const screenY = rect.y - camera.y;
    if (screenX + rect.w < 0 || screenY + rect.h < 0 || screenX > game.canvas.width || screenY > game.canvas.height) continue;
    if (assets.biomeBackdrop) {
      ctx.drawImage(assets.biomeBackdrop, screenX, screenY, rect.w, rect.h);
    } else {
      ctx.fillStyle = "rgba(2, 12, 18, 0.9)";
      ctx.fillRect(screenX, screenY, rect.w, rect.h);
    }
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

  if (world.upperCliff?.midStripFillRects?.length) {
    ctx.save();
    ctx.fillStyle = "#6f7559";
    for (const rect of world.upperCliff.midStripFillRects) {
      const screenX = rect.x - camera.x;
      const screenY = rect.y - camera.y;
      if (screenX + rect.w < 0 || screenY + rect.h < 0 || screenX > game.canvas.width || screenY > game.canvas.height) continue;
      ctx.fillRect(screenX, screenY, rect.w, rect.h);
    }
    ctx.restore();
  }

  if (world.upperCliff?.enabled) {
    drawUpperCliffDecor(ctx, world, -camera.x, -camera.y, {
      x: camera.x,
      y: camera.y,
      viewWidth: camera.viewWidth,
      viewHeight: camera.viewHeight
    });
  }

  if (world.cosmeticFloor?.groundLayer) {
    drawOpenWorldGroundDetails(ctx, world.cosmeticFloor.groundLayer, camera);
    drawOpenWorldGroundDecor(ctx, world.cosmeticFloor.groundLayer, camera);
  }

  if (world.blockerChunkSpaces?.length && assets.biomeBlockerChunks) {
    for (const space of world.blockerChunkSpaces) {
      const screenX = Math.round(space.worldX - camera.x);
      const screenY = Math.round(space.worldY - camera.y);
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

  for (const wall of game.affixWallRects || []) {
    const screenX = Math.round(wall.x - camera.x);
    const screenY = Math.round(wall.y - camera.y);
    if (screenX + wall.w < 0 || screenY + wall.h < 0 || screenX > game.canvas.width || screenY > game.canvas.height) continue;
    ctx.fillStyle = "rgba(71, 85, 105, 0.9)";
    ctx.fillRect(screenX, screenY, wall.w, wall.h);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.8)";
    ctx.strokeRect(screenX, screenY, wall.w, wall.h);
  }

  for (const decor of world.decor) {
    const screenX = Math.round(decor.x - camera.x);
    const screenY = Math.round(decor.y - camera.y);
    drawTile(ctx, atlas, 17, 4 + ((screenX / 32) & 1), screenX, screenY);
  }

  const exit = world.exit;
  drawTile(ctx, atlas, 16, game.roomCleared ? 3 : 2, Math.round(exit.x - camera.x), Math.round(exit.y - camera.y), tileSize);
}

function drawProjectiles(ctx, game) {
  const playerBolt = game.assets.projectileDarkBolt;
  for (const zone of game.combat.weaponArtRuntime?.assistGroundZones || []) {
    const screenX = zone.x - game.camera.x;
    const screenY = zone.y - game.camera.y;
    const life = 1 - clamp(zone.elapsed / Math.max(0.001, zone.duration), 0, 1);
    ctx.save();
    ctx.fillStyle = `rgba(76, 29, 149, ${0.16 * life})`;
    ctx.strokeStyle = `rgba(168, 85, 247, ${0.68 * life})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY, zone.radius, zone.radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = `rgba(196, 181, 253, ${0.4 * life})`;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY, zone.radius * 0.62, zone.radiusY * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (game.combat.playerBeam) {
    const beam = game.combat.playerBeam;
    ctx.save();
    ctx.strokeStyle = "rgba(196, 181, 253, 0.75)";
    ctx.lineWidth = beam.width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(beam.x1 - game.camera.x, beam.y1 - game.camera.y);
    ctx.lineTo(beam.x2 - game.camera.x, beam.y2 - game.camera.y);
    ctx.stroke();
    ctx.strokeStyle = beam.color || "#a855f7";
    ctx.lineWidth = Math.max(4, beam.width * 0.38);
    ctx.beginPath();
    ctx.moveTo(beam.x1 - game.camera.x, beam.y1 - game.camera.y);
    ctx.lineTo(beam.x2 - game.camera.x, beam.y2 - game.camera.y);
    ctx.stroke();
    ctx.restore();
  }
  for (const projectile of game.combat.playerProjectiles) {
    const screenX = projectile.x - game.camera.x;
    const screenY = projectile.y - game.camera.y;
    if (projectile.projectileClass === "knife") {
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
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(angle);
      ctx.drawImage(playerBolt, 0, 0, 16, 16, -16, -8, 32, 16);
      ctx.restore();
    } else {
      ctx.fillStyle = projectile.color || "#e879f9";
      ctx.beginPath();
      ctx.arc(screenX, screenY, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const projectile of game.combat.enemyProjectiles) {
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

  for (const hitbox of game.combat.enemyAreaHitboxes) {
    const fadeDuration = Math.max(0.001, hitbox.visualDuration ?? hitbox.duration);
    const ageAlpha = 1 - clamp(hitbox.age / fadeDuration, 0, 1);
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
      const frameWidth = sprite.naturalWidth / totalFrames;
      const frameHeight = sprite.naturalHeight;
      const progress = clamp(hitbox.age / fadeDuration, 0, 0.999);
      const frame = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));
      const drawWidth = hitbox.radius * 2 * 0.7 * (hitbox.groundImpactScale ?? 1);
      const drawHeight = drawWidth * (frameHeight / Math.max(1, frameWidth));
      const radiusY = hitbox.radiusY ?? hitbox.radius * 0.75;
      const anchorX = hitbox.x;
      const anchorY = hitbox.y + radiusY * 0.5;
      ctx.drawImage(
        sprite,
        frame * frameWidth,
        0,
        frameWidth,
        frameHeight,
        anchorX - game.camera.x - drawWidth * 0.5,
        anchorY - game.camera.y - drawHeight * 0.5 + (hitbox.groundImpactYOffset ?? 0),
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
    }
    ctx.restore();
  }
}

function drawTreeShadow(ctx, game, tree) {
  const drawX = Math.round(tree.x - game.camera.x);
  const drawY = Math.round(tree.y - game.camera.y);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(drawX + 4, drawY + tree.h - (tree.shadowHeight || 12), tree.w, tree.shadowHeight || 12);
  ctx.restore();
}

function drawTreeSprite(ctx, game, tree, faded = false) {
  const image = game.assets?.[tree.assetKey];
  if (!image) return;
  const drawX = Math.round(tree.x - game.camera.x);
  const drawY = Math.round(tree.y - game.camera.y);

  if (!faded) {
    ctx.drawImage(image, drawX, drawY, tree.w, tree.h);
    return;
  }

  const playerRect = {
    x: game.player.x,
    y: game.player.y,
    w: game.player.w,
    h: game.player.h
  };
  if (distancePointToRect(playerRect.x + playerRect.w * 0.5, playerRect.y + playerRect.h * 0.5, tree) > tree.canopyFadeRadius) {
    ctx.drawImage(image, drawX, drawY, tree.w, tree.h);
    return;
  }

  const scratch = getTreeFadeScratch(tree.w, tree.h);
  const tctx = scratch.getContext("2d");
  if (!tctx) {
    ctx.drawImage(image, drawX, drawY, tree.w, tree.h);
    return;
  }
  tctx.clearRect(0, 0, tree.w, tree.h);
  tctx.drawImage(image, 0, 0, tree.w, tree.h);
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

function drawTrees(ctx, game, overlayPass = false) {
  const trees = [...(game.world?.treeObstacles || [])];
  if (!trees.length) return;
  const playerSortY = game.player.y + game.player.h;
  trees.sort((a, b) => (a.y + a.h * a.ySortHeightRatio) - (b.y + b.h * b.ySortHeightRatio));
  for (const tree of trees) {
    const treeSortY = tree.y + tree.h * tree.ySortHeightRatio;
    const playerBehindTree = playerSortY < treeSortY;
    if (!overlayPass) drawTreeShadow(ctx, game, tree);
    if (overlayPass !== playerBehindTree) continue;
    drawTreeSprite(ctx, game, tree, overlayPass);
  }
}

function drawSkillEffects(ctx, game) {
  const effects = getRunSkillEffects(game);
  if (!effects.length) return;
  ctx.save();
  for (const effect of effects) {
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
      ctx.strokeStyle = "rgba(192,132,252,0.45)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 140, 0, Math.PI * 2);
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
      for (const dragon of effect.dragonPositions || []) {
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
    const searchableDef = SEARCHABLE_DEFS[searchable.typeId];
    if (!searchableDef) continue;
    const x = Math.round(searchable.x - game.camera.x);
    const y = Math.round(searchable.y - game.camera.y);
    const { sprites } = searchableDef;
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
    if (image) ctx.drawImage(image, x, y, searchable.w, searchable.h);
    if (searchable.isOpen) continue;
    const interact = getSearchableInteractState(game, searchable);
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "bold 12px Georgia";
    ctx.fillStyle = interact.affordable ? "#facc15" : "#fb7185";
    ctx.fillText(`${interact.goldCost}g`, x + searchable.w * 0.5, y - 12);
    if (interact.inRange) {
      ctx.font = "10px Georgia";
      ctx.fillStyle = "rgba(241, 245, 249, 0.95)";
      ctx.fillText("E Open", x + searchable.w * 0.5, y - 26);
    }
    ctx.restore();
  }
}

function drawGoldDrops(ctx, game) {
  for (const drop of game.goldDrops || []) {
    const screenX = drop.x - game.camera.x;
    const screenY = drop.y - game.camera.y;
    ctx.save();
    ctx.fillStyle = drop.color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, drop.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.arc(screenX - drop.radius * 0.2, screenY - drop.radius * 0.2, Math.max(2, drop.radius * 0.35), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRingDrops(ctx, game) {
  const atlas = game.assets.itemsAtlas;
  if (!atlas) return;
  for (const drop of game.ringDrops || []) {
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
    ctx.strokeStyle = getRingRarityColor(ringDef.dropRarity);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(screenX - 16, screenY - 18, 32, 32);
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
  const slots = getRunSkillSlots(game);
  if (!slots.length) return;
  const panelWidth = 290;
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
    drawSkillIcon(ctx, game, slot.skillId, x + 6, y + 6, 18);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 12px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(`${index + 1}`, x + 15, y + 19);

    ctx.textAlign = "left";
    ctx.font = "bold 11px Georgia";
    ctx.fillText(slot.def?.name || slot.skillId, x + 30, y + 18);
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
  ctx.fillStyle = "#c4b5fd";
  ctx.fillText(game.weaponArt.def?.name ? `Art ${game.weaponArt.def.name}` : "", 120, 30);
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(`Room ${game.roomIndex + 1} / ${game.maxRooms}`, 210, 30);
  ctx.fillText(`Kills ${game.kills}`, 210, 52);
  ctx.fillText(`Dash ${game.player.movement.dashCharges}/${getMaxDashCharges(game)}`, 24, 52);
  ctx.fillText(`State ${formatStateLabel(game.player.movement.state)}`, 120, 52);
  ctx.fillText(`Enemies ${game.enemies.length}`, 210, 74);
  ctx.fillStyle = "#facc15";
  ctx.fillText(`Gold ${game.gold}`, 210, 96);
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(`Rings ${game.ringInventory.length + game.equippedRings.filter(Boolean).length}`, 24, 74);
  ctx.fillText(`Equipped ${game.equippedRings.filter(Boolean).length}/${game.getAvailableRingSlotCount()}`, 24, 96);
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
  if (game.state === "running" && !game.roomCleared) return;
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
    ctx.fillText("Room Cleared", game.canvas.width / 2, game.canvas.height / 2 - 10);
    ctx.font = "15px Georgia";
    ctx.fillText("Advancing to the next room...", game.canvas.width / 2, game.canvas.height / 2 + 24);
  } else if (game.state === "loading") {
    ctx.fillText("Loading", game.canvas.width / 2, game.canvas.height / 2);
  }
  ctx.restore();

  if ((game.inkFlashTimer || 0) > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(3,7,18,${Math.min(0.45, game.inkFlashTimer * 0.25)})`;
    ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);
    ctx.restore();
  }
}

export function renderGame(ctx, game) {
  ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);
  if (!game.world || !game.assets?.tiles) {
    drawOverlay(ctx, game);
    return;
  }
  drawWorld(ctx, game);
  drawTrees(ctx, game, false);
  drawSearchables(ctx, game);
  drawBreakables(ctx, game);
  drawSkillEffects(ctx, game);
  drawProjectiles(ctx, game);
  drawGoldDrops(ctx, game);
  drawRingDrops(ctx, game);
  drawEnemies(ctx, game);
  if (game.scene?.id === "enemy-test") {
    drawTrees(ctx, game, true);
    drawEnemyTestHud(ctx, game);
  } else {
    drawSoulSiphonSpirit(ctx, game);
    drawHero(ctx, game);
    drawTrees(ctx, game, true);
    drawPlayerHealthOverlay(ctx, game);
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

  drawProjectiles(ctx, game);
  drawEnemies(ctx, game);
  drawSoulSiphonSpirit(ctx, game);
  drawHero(ctx, game);
}
