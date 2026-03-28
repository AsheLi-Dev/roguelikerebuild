import { clamp, formatStateLabel, frameIndexFromClock } from "../core/runtime-utils.js";
import { drawOpenWorldGroundBase, drawOpenWorldGroundDetails } from "../systems/biome-floor.js";
import { drawUpperCliffDecor } from "../systems/biome-upper-cliff.js";

function drawTile(ctx, atlas, row, col, x, y, size = 32) {
  if (!atlas) return;
  ctx.drawImage(atlas, col * 32, row * 32, 32, 32, x, y, size, size);
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

function drawHero(ctx, game) {
  const stateKey = heroStateKey(game);
  const stateDef = game.heroDef.sprite.states[stateKey];
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
    const total = Math.max(0.001, game.heroDef.dash.duration);
    const progress = clamp(1 - game.player.movement.dashTimer / total, 0, 0.999);
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
  const screenX = Math.round(game.player.x - game.camera.x - 28);
  const screenY = Math.round(game.player.y - game.camera.y - 36);
  ctx.drawImage(image, sx, sy, frameWidth, frameHeight, screenX, screenY, 96, 96);
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

function drawEnemySprite(ctx, image, frameWidth, frameHeight, frame, x, y, size, flip = 1) {
  if (!image) return;
  ctx.save();
  if (flip < 0) {
    ctx.translate(x + size * 0.5, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + size * 0.5), 0);
  }
  ctx.drawImage(image, frame * frameWidth, 0, frameWidth, frameHeight, x, y, size, size);
  ctx.restore();
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
  if (attack.kind.includes("circle") || attack.kind === "warcry" || attack.kind === "arrow_rain" || attack.kind === "darkfire_pillar" || attack.kind === "earthquake" || attack.kind === "volcano" || attack.kind === "fire_cleanse" || attack.kind === "fire_leap") {
    const atTarget = enemy.role === "ranged" && attack.maxRange > 280 && attack.kind !== "warcry";
    const cx = (atTarget ? target.x : enemy.x + enemy.w * 0.5) - game.camera.x;
    const cy = (atTarget ? target.y : enemy.y + enemy.h * 0.5) - game.camera.y;
    ctx.beginPath();
    ctx.arc(cx, cy, attack.radius || 60, 0, Math.PI * 2);
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
    const x = Math.round(enemy.x - game.camera.x - (enemy.drawSize - enemy.w) * 0.5);
    const y = Math.round(enemy.y - game.camera.y - (enemy.drawSize - enemy.h) * 0.7);
    if (enemy.attackRuntime) {
      const row = rowIndexFromDirection(enemy);
      ctx.drawImage(image, frame * frameWidth, row * frameHeight, frameWidth, frameHeight, x, y, enemy.drawSize, enemy.drawSize);
    } else {
      drawEnemySprite(ctx, image, frameWidth, frameHeight, frame, x, y, enemy.drawSize || enemy.w, enemy.facing);
    }
    if (enemy.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${enemy.hitFlash * 2.5})`;
      ctx.fillRect(x, y, enemy.drawSize || enemy.w, enemy.drawSize || enemy.h);
    }
    const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
    ctx.fillStyle = "rgba(2, 6, 23, 0.8)";
    ctx.fillRect(x, y - 8, enemy.w, 5);
    ctx.fillStyle = hpRatio > 0.4 ? "#4ade80" : "#ef4444";
    ctx.fillRect(x, y - 8, enemy.w * hpRatio, 5);
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
    if (projectile.spriteAsset && game.assets[projectile.spriteAsset]) {
      const image = game.assets[projectile.spriteAsset];
      const angle = Math.atan2(projectile.vy, projectile.vx);
      const size = projectile.drawSize || projectile.radius * 2;
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(angle);
      ctx.drawImage(image, -size * 0.5, -size * 0.2, size, size * 0.4);
      ctx.restore();
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
      const angle = Math.atan2(projectile.vy, projectile.vx);
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(angle);
      const size = projectile.drawSize || projectile.radius * 2;
      ctx.drawImage(image, -size * 0.5, -size * 0.2, size, size * 0.4);
      ctx.restore();
    } else {
      ctx.fillStyle = projectile.color;
      ctx.beginPath();
      ctx.arc(screenX, screenY, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const hitbox of game.combat.enemyAreaHitboxes) {
    const ageAlpha = 1 - clamp(hitbox.age / Math.max(0.001, hitbox.duration), 0, 1);
    ctx.save();
    ctx.strokeStyle = `rgba(251,113,113,${0.18 * ageAlpha})`;
    ctx.fillStyle = `rgba(251,113,113,${0.08 * ageAlpha})`;
    ctx.lineWidth = 2;
    if (hitbox.shape === "circle") {
      ctx.beginPath();
      ctx.arc(hitbox.x - game.camera.x, hitbox.y - game.camera.y, hitbox.radius, 0, Math.PI * 2);
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

function drawHud(ctx, game) {
  ctx.save();
  ctx.fillStyle = "rgba(8, 15, 26, 0.78)";
  ctx.fillRect(12, 12, 292, 112);
  ctx.strokeStyle = "rgba(167, 139, 250, 0.38)";
  ctx.strokeRect(12, 12, 292, 112);

  const hpRatio = clamp(game.player.hp / game.player.maxHp, 0, 1);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(24, 42, 168, 14);
  ctx.fillStyle = hpRatio > 0.35 ? "#ef4444" : "#fb7185";
  ctx.fillRect(24, 42, 168 * hpRatio, 14);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 14px Georgia";
  ctx.fillText(game.heroDef.name, 24, 30);
  ctx.font = "12px Georgia";
  ctx.fillStyle = "#c4b5fd";
  ctx.fillText(game.weaponArt.def?.name ? `Art ${game.weaponArt.def.name}` : "", 120, 30);
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(`HP ${Math.ceil(game.player.hp)} / ${game.player.maxHp}`, 24, 74);
  ctx.fillText(`Room ${game.roomIndex + 1} / ${game.maxRooms}`, 210, 30);
  ctx.fillText(`Kills ${game.kills}`, 210, 52);
  ctx.fillText(`Dash ${game.player.movement.dashCharges}/${game.heroDef.dash.charges}`, 24, 96);
  ctx.fillText(`State ${formatStateLabel(game.player.movement.state)}`, 120, 96);
  ctx.fillText(`Enemies ${game.enemies.length}`, 210, 74);
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
  drawProjectiles(ctx, game);
  drawEnemies(ctx, game);
  drawSoulSiphonSpirit(ctx, game);
  drawHero(ctx, game);
  drawHud(ctx, game);
  drawOverlay(ctx, game);
}
