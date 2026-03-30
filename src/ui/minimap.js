const MINIMAP_WIDTH = 176;
const MINIMAP_HEIGHT = 104;

let minimapCanvas = null;
let minimapCtx = null;
let worldRef = null;
let staticCanvas = null;
let staticCtx = null;

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
  minimapCanvas.width = MINIMAP_WIDTH;
  minimapCanvas.height = MINIMAP_HEIGHT;
  minimapCtx = minimapCanvas.getContext("2d");
}

export function setMinimapVisible(visible) {
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
}
