import { GLOBAL_LIGHTING } from "../core/lighting.js";

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function isWorldRectVisible(game, x, y, w, h, padding = 0) {
  return !(
    x + w < game.camera.x - padding ||
    y + h < game.camera.y - padding ||
    x > game.camera.x + game.camera.viewWidth + padding ||
    y > game.camera.y + game.camera.viewHeight + padding
  );
}

function drawSoftLight(ctx, x, y, radius, color, alpha = 1, aspectY = 1) {
  if (!(radius > 0) || alpha <= 0) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color.replace("__ALPHA__", `${alpha}`));
  gradient.addColorStop(0.38, color.replace("__ALPHA__", `${alpha * 0.55}`));
  gradient.addColorStop(1, color.replace("__ALPHA__", "0"));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, aspectY);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTopRimAccent(ctx, x, y, w, h, color, alpha = 0.08) {
  if (!(w > 0) || !(h > 0) || alpha <= 0) return;
  const gradient = ctx.createLinearGradient(x, y, x, y + h * 0.75);
  gradient.addColorStop(0, color.replace("__ALPHA__", `${alpha}`));
  gradient.addColorStop(0.42, color.replace("__ALPHA__", `${alpha * 0.42}`));
  gradient.addColorStop(1, color.replace("__ALPHA__", "0"));
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function collectSearchableLights(game, lights) {
  for (const searchable of game.searchables || []) {
    if (!isWorldRectVisible(game, searchable.x, searchable.y, searchable.w, searchable.h, 36)) continue;
    let light = null;
    if (searchable.typeId === "redWell") {
      light = { color: "rgba(255, 145, 113, __ALPHA__)", radius: 54, alpha: searchable.isOpen ? 0.12 : 0.2 };
    } else if (searchable.typeId === "yellowWell" || searchable.typeId === "lifeSpring") {
      light = { color: "rgba(255, 228, 149, __ALPHA__)", radius: searchable.typeId === "lifeSpring" ? 70 : 56, alpha: 0.18 };
    } else if (searchable.typeId === "biomePortal") {
      light = { color: "rgba(151, 220, 255, __ALPHA__)", radius: 88, alpha: 0.26 };
    }
    if (!light) continue;
    const alphaScale = clamp01(searchable.introAlpha ?? 1);
    if (alphaScale <= 0) continue;
    lights.push({
      x: searchable.x + searchable.w * 0.5 - game.camera.x,
      y: searchable.y + searchable.h * 0.32 - game.camera.y,
      radius: light.radius,
      alpha: light.alpha * alphaScale,
      color: light.color,
      aspectY: 0.82
    });
  }
}

function collectObstacleLights(game, lights) {
  const obstacles = game.world?.biomeObstacles || [];
  for (const obstacle of obstacles) {
    if (!isWorldRectVisible(game, obstacle.x, obstacle.y, obstacle.w, obstacle.h, 36)) continue;
    if (!String(obstacle.type || "").startsWith("magicPillar")) continue;
    lights.push({
      x: obstacle.x + obstacle.w * 0.5 - game.camera.x,
      y: obstacle.y + obstacle.h * 0.22 - game.camera.y,
      radius: Math.max(46, obstacle.w * 0.95),
      alpha: obstacle.type === "magicPillarLarge" ? 0.16 : 0.12,
      color: "rgba(180, 208, 255, __ALPHA__)",
      aspectY: 0.9
    });
  }
}

function collectMaterialLights(game, lights) {
  for (const drop of game.materialDrops || []) {
    if (!isWorldRectVisible(game, drop.x - 20, drop.y - 20, 40, 40, 24)) continue;
    if (drop.glow) {
      lights.push({
        x: drop.x - game.camera.x,
        y: drop.y - game.camera.y - 6,
        radius: 20,
        alpha: 0.12,
        color: drop.glow.replace(/rgba?\(([^)]+)\)/, (_, values) => {
          const parts = values.split(",").slice(0, 3).map((part) => part.trim());
          return `rgba(${parts.join(", ")}, __ALPHA__)`;
        }),
        aspectY: 0.85
      });
    }
  }
}

function collectProjectileLights(game, lights) {
  for (const projectile of game.combat?.playerProjectiles || []) {
    if (!isWorldRectVisible(game, projectile.x - 24, projectile.y - 24, 48, 48, 18)) continue;
    let light = null;
    if (projectile.projectileClass === "lightningSpark") {
      light = { color: "rgba(255, 241, 166, __ALPHA__)", radius: 26, alpha: 0.14 };
    } else if (/lightning/i.test(projectile.spriteAsset || "")) {
      light = { color: "rgba(255, 238, 163, __ALPHA__)", radius: 28, alpha: 0.12 };
    } else if (/fire/i.test(projectile.spriteAsset || "")) {
      light = { color: "rgba(255, 155, 110, __ALPHA__)", radius: 24, alpha: 0.1 };
    } else if (/ice/i.test(projectile.spriteAsset || "")) {
      light = { color: "rgba(160, 215, 255, __ALPHA__)", radius: 24, alpha: 0.08 };
    }
    if (!light) continue;
    lights.push({
      x: projectile.x - game.camera.x,
      y: projectile.y - game.camera.y,
      radius: light.radius,
      alpha: light.alpha,
      color: light.color,
      aspectY: 0.88
    });
  }

  for (const vfx of game.combat?.impactVfx || []) {
    const drawWidth = vfx.drawWidth ?? vfx.size ?? 0;
    const drawHeight = vfx.drawHeight ?? vfx.size ?? 0;
    if (!isWorldRectVisible(game, vfx.x - drawWidth * 0.5, vfx.y - drawHeight * 0.5, drawWidth, drawHeight, 24)) continue;
    let light = null;
    if (/lightning/i.test(vfx.sprite || "")) {
      light = { color: "rgba(255, 238, 163, __ALPHA__)", radius: Math.max(26, drawWidth * 0.34), alpha: 0.16 };
    } else if (/fire|orange/i.test(vfx.sprite || "")) {
      light = { color: "rgba(255, 145, 110, __ALPHA__)", radius: Math.max(24, drawWidth * 0.3), alpha: 0.13 };
    } else if (/ice|water/i.test(vfx.sprite || "")) {
      light = { color: "rgba(160, 215, 255, __ALPHA__)", radius: Math.max(22, drawWidth * 0.28), alpha: 0.09 };
    }
    if (!light) continue;
    lights.push({
      x: vfx.x - game.camera.x,
      y: vfx.y - game.camera.y,
      radius: light.radius,
      alpha: light.alpha,
      color: light.color,
      aspectY: 0.86
    });
  }
}

export function drawDirectionalRectShadow(ctx, x, y, w, h, color, shadowHeight) {
  const tall = GLOBAL_LIGHTING.tallShadow;
  const drawHeight = Math.max(2, Math.round((shadowHeight || 12) * tall.heightScale));
  ctx.save();
  ctx.fillStyle = color || `rgba(0, 0, 0, ${tall.alpha})`;
  ctx.fillRect(x + tall.offsetX, y + h - drawHeight + tall.offsetY, w, drawHeight);
  ctx.restore();
}

export function drawWorldLighting(ctx, game) {
  const viewportWidth = game.camera?.viewWidth || game.canvas?.width || 0;
  const viewportHeight = game.camera?.viewHeight || game.canvas?.height || 0;
  if (!(viewportWidth > 0) || !(viewportHeight > 0)) return;

  ctx.save();
  ctx.fillStyle = GLOBAL_LIGHTING.ambientColor;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  ctx.globalCompositeOperation = "screen";
  const northGradient = ctx.createLinearGradient(0, 0, 0, viewportHeight);
  northGradient.addColorStop(0, GLOBAL_LIGHTING.ambientNorthBoostColor);
  northGradient.addColorStop(0.28, "rgba(255, 244, 214, 0.03)");
  northGradient.addColorStop(1, "rgba(255, 244, 214, 0)");
  ctx.fillStyle = northGradient;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  const lights = [];
  const playerLight = GLOBAL_LIGHTING.playerLight;
  lights.push({
    x: game.player.x + game.player.w * 0.5 - game.camera.x,
    y: game.player.y + game.player.h * 0.5 - game.camera.y + playerLight.offsetY,
    radius: playerLight.radius,
    alpha: playerLight.alpha,
    color: playerLight.color,
    aspectY: playerLight.aspectY
  });

  collectSearchableLights(game, lights);
  collectObstacleLights(game, lights);
  collectMaterialLights(game, lights);
  collectProjectileLights(game, lights);

  lights.sort((a, b) => (b.alpha * b.radius) - (a.alpha * a.radius));
  const visibleLights = lights.slice(0, GLOBAL_LIGHTING.maxVisibleLocalLights);
  for (const light of visibleLights) {
    drawSoftLight(ctx, light.x, light.y, light.radius, light.color, clamp01(light.alpha), light.aspectY ?? 1);
  }

  ctx.restore();
}
