import { applyUiSkinTree } from "./ui-atlas.js";

const MINIMAP_WIDTH = 176;
const MINIMAP_HEIGHT = 104;

let minimapCanvas = null;
let minimapCtx = null;
let minimapStack = null;
let minimapShell = null;
let minimapGoldLabel = null;
let worldRef = null;
let staticCanvas = null;
let staticCtx = null;
let lastGoldText = "";

const goldFormatter = new Intl.NumberFormat("en-US");

function syncMinimapGold(gold = 0) {
  if (!minimapGoldLabel) return;
  const nextText = `Gold ${goldFormatter.format(Math.max(0, Math.floor(gold || 0)))}`;
  if (nextText === lastGoldText) return;
  lastGoldText = nextText;
  minimapGoldLabel.textContent = nextText;
}

function ensureStaticCanvas() {
  if (!staticCanvas) {
    staticCanvas = document.createElement("canvas");
  }
  staticCanvas.width = MINIMAP_WIDTH;
  staticCanvas.height = MINIMAP_HEIGHT;
  staticCtx = staticCanvas.getContext("2d");
}

function fillWorldWalls(ctx, world) {
  const worldWidth = world.width || 1;
  const worldHeight = world.height || 1;
  const walls = Array.isArray(world.tileWallRects) && world.tileWallRects.length > 0
    ? world.tileWallRects
    : null;

  if (walls) {
    ctx.fillStyle = "rgba(148, 163, 184, 0.94)";
    for (const wall of walls) {
      if (wall._upperCliffRockCollision) continue;
      const sx = ((wall.x || 0) / worldWidth) * MINIMAP_WIDTH;
      const sy = ((wall.y || 0) / worldHeight) * MINIMAP_HEIGHT;
      const sw = Math.max(1, ((wall.w || 0) / worldWidth) * MINIMAP_WIDTH);
      const sh = Math.max(1, ((wall.h || 0) / worldHeight) * MINIMAP_HEIGHT);
      ctx.fillRect(sx, sy, sw, sh);
    }
    return;
  }

  if (!Array.isArray(world.tileGrid) || !world.tileGrid.length) return;
  const rows = world.tileGrid.length;
  const cols = world.tileGrid[0]?.length || 1;
  ctx.fillStyle = "rgba(148, 163, 184, 0.94)";
  for (let gy = 0; gy < rows; gy += 1) {
    for (let gx = 0; gx < cols; gx += 1) {
      if (world.tileGrid[gy][gx] !== 1) continue;
      const sx = (gx / cols) * MINIMAP_WIDTH;
      const sy = (gy / rows) * MINIMAP_HEIGHT;
      const sw = Math.max(1, MINIMAP_WIDTH / cols);
      const sh = Math.max(1, MINIMAP_HEIGHT / rows);
      ctx.fillRect(sx, sy, sw, sh);
    }
  }
}

function fillMacroRects(ctx, rects, color, worldWidth, worldHeight) {
  if (!Array.isArray(rects) || !rects.length) return;
  ctx.fillStyle = color;
  for (const rect of rects) {
    const sx = (rect.x / worldWidth) * MINIMAP_WIDTH;
    const sy = (rect.y / worldHeight) * MINIMAP_HEIGHT;
    const sw = Math.max(1, (rect.w / worldWidth) * MINIMAP_WIDTH);
    const sh = Math.max(1, (rect.h / worldHeight) * MINIMAP_HEIGHT);
    ctx.fillRect(sx, sy, sw, sh);
  }
}

export function initMinimap() {
  minimapCanvas = document.getElementById("minimap-canvas");
  if (!minimapCanvas) return;
  const host = minimapCanvas.parentElement;
  if (host && !host.classList.contains("minimap-stack")) {
    const stack = document.createElement("div");
    stack.className = "minimap-stack";
    host.insertBefore(stack, minimapCanvas);
    minimapStack = stack;
    const shell = document.createElement("div");
    shell.className = "minimap-shell";
    shell.setAttribute("data-ui-skin-token", "minimapShell");
    shell.setAttribute("data-ui-skin-mode", "panel");
    stack.appendChild(shell);
    shell.appendChild(minimapCanvas);
    minimapShell = shell;
  } else {
    minimapStack = host;
    minimapShell = host?.querySelector?.(".minimap-shell") || host;
  }
  if (minimapStack && !minimapGoldLabel) {
    minimapGoldLabel = document.createElement("div");
    minimapGoldLabel.className = "minimap-gold";
    minimapGoldLabel.setAttribute("data-ui-skin-token", "countPill");
    minimapGoldLabel.setAttribute("data-ui-skin-mode", "pill");
    minimapGoldLabel.textContent = "Gold 0";
    minimapStack.appendChild(minimapGoldLabel);
    lastGoldText = minimapGoldLabel.textContent;
  }
  minimapCanvas.width = MINIMAP_WIDTH;
  minimapCanvas.height = MINIMAP_HEIGHT;
  minimapCtx = minimapCanvas.getContext("2d");
  if (minimapStack instanceof HTMLElement) {
    applyUiSkinTree(minimapStack);
    minimapStack.style.display = "none";
  }
}

export function setMinimapVisible(visible) {
  if (minimapStack) {
    minimapStack.style.display = visible ? "flex" : "none";
    return;
  }
  if (!minimapCanvas) return;
  minimapCanvas.style.display = visible ? "block" : "none";
}

export function setMinimapWorld(world) {
  worldRef = world || null;
  if (!minimapCtx || !worldRef) return;

  ensureStaticCanvas();

  const worldWidth = worldRef.width || 1;
  const worldHeight = worldRef.height || 1;
  const ctx = staticCtx;
  ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

  ctx.fillStyle = "rgba(3, 7, 18, 1)";
  ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

  fillMacroRects(ctx, worldRef.voidRects, "rgba(2, 6, 23, 0.95)", worldWidth, worldHeight);
  fillMacroRects(ctx, worldRef.playableMacroRects, "rgba(22, 101, 52, 0.24)", worldWidth, worldHeight);
  fillWorldWalls(ctx, worldRef);

  if (worldRef.exit) {
    ctx.fillStyle = "rgba(250, 204, 21, 0.95)";
    ctx.fillRect(
      (worldRef.exit.x / worldWidth) * MINIMAP_WIDTH,
      (worldRef.exit.y / worldHeight) * MINIMAP_HEIGHT,
      Math.max(2, (worldRef.exit.w / worldWidth) * MINIMAP_WIDTH),
      Math.max(2, (worldRef.exit.h / worldHeight) * MINIMAP_HEIGHT)
    );
  }
}

export function renderMinimap(game) {
  if (!minimapCtx || !worldRef || !game?.player || !game?.camera) return;
  syncMinimapGold(game.gold);

  const ctx = minimapCtx;
  ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
  if (staticCanvas) ctx.drawImage(staticCanvas, 0, 0);

  const worldWidth = worldRef.width || 1;
  const worldHeight = worldRef.height || 1;
  const camera = game.camera;
  const player = game.player;

  ctx.strokeStyle = "rgba(74, 222, 128, 0.95)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    (camera.x / worldWidth) * MINIMAP_WIDTH,
    (camera.y / worldHeight) * MINIMAP_HEIGHT,
    Math.max(1, (camera.viewWidth / worldWidth) * MINIMAP_WIDTH),
    Math.max(1, (camera.viewHeight / worldHeight) * MINIMAP_HEIGHT)
  );

  const px = ((player.x + player.w * 0.5) / worldWidth) * MINIMAP_WIDTH;
  const py = ((player.y + player.h * 0.5) / worldHeight) * MINIMAP_HEIGHT;
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(15, 23, 42, 0.95)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw unopened chests if revealed (after miniboss)
  if (game.revealChestsOnMinimap) {
    for (const searchable of game.searchables || []) {
      if (searchable.isOpen) continue;
      if (searchable.typeId !== "smallChest" && searchable.typeId !== "largeChest") continue;

      const cx = ((searchable.x + searchable.w * 0.5) / worldWidth) * MINIMAP_WIDTH;
      const cy = ((searchable.y + searchable.h * 0.5) / worldHeight) * MINIMAP_HEIGHT;

      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.rect(cx - 2, cy - 2, 4, 4);
      ctx.fill();
      ctx.strokeStyle = "rgba(15, 23, 42, 0.8)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
}
