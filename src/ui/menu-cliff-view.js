import {
  buildOpenWorldCosmeticFloor,
  drawOpenWorldGroundBase,
  drawOpenWorldGroundDecor,
  drawOpenWorldGroundDetails
} from "../systems/biome-floor.js";
import { BIOME_ARCHETYPE, BIOME_GRID_COLS, BIOME_GRID_ROWS, generateRoom } from "../systems/world-generation.js";

const MENU_BIOME_WORLD_SEED = 187331;
const MENU_BIOME_ROOM_INDEX = 0;

let cachedWorld = null;

function rebuildPlayableMacroRects(world) {
  world.playableMacroRects = [];
  world.voidRects = [];
  const cellW = world.width / BIOME_GRID_COLS;
  const cellH = world.height / BIOME_GRID_ROWS;
  for (let row = 0; row < BIOME_GRID_ROWS; row += 1) {
    for (let col = 0; col < BIOME_GRID_COLS; col += 1) {
      const bounds = {
        x: col * cellW,
        y: row * cellH,
        w: cellW,
        h: cellH
      };
      if (world.archetypeGrid.grid[row][col] === BIOME_ARCHETYPE.EMPTY) {
        world.voidRects.push(bounds);
      } else {
        world.playableMacroRects.push(bounds);
      }
    }
  }
}

function configureMenuBiomeLayout(world, assets) {
  world.archetypeGrid.grid[1] = Array.from({ length: BIOME_GRID_COLS }, () => BIOME_ARCHETYPE.OPEN_SPACE);
  rebuildPlayableMacroRects(world);
  world.upperCliff = null;
  world.cosmeticFloor = buildOpenWorldCosmeticFloor(world, MENU_BIOME_WORLD_SEED, assets, "grassA");
}

function getMenuBiomeWorld(assets) {
  if (!cachedWorld || cachedWorld.assetRefs !== assets) {
    cachedWorld = generateRoom(MENU_BIOME_WORLD_SEED, MENU_BIOME_ROOM_INDEX, assets);
    configureMenuBiomeLayout(cachedWorld, assets);
  }
  return cachedWorld;
}

export function renderMenuCliffView(canvas, assets, time = performance.now() / 1000) {
  if (!(canvas instanceof HTMLCanvasElement) || !assets) return;
  const world = getMenuBiomeWorld(assets);
  if (!world?.cosmeticFloor?.groundLayer) return;

  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const macroRowHeight = world.height / BIOME_GRID_ROWS;
  const camera = {
    x: 0,
    y: macroRowHeight,
    viewWidth: world.width,
    viewHeight: macroRowHeight
  };
  const scale = Math.max(width / world.width, height / macroRowHeight);
  const drawWidth = Math.round(world.width * scale);
  const drawHeight = Math.round(macroRowHeight * scale);
  const xOffset = Math.round((width - drawWidth) * 0.5);
  const yOffset = Math.round(height - drawHeight);

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.translate(xOffset, yOffset);
  ctx.scale(scale, scale);

  drawOpenWorldGroundBase(ctx, world.cosmeticFloor.groundLayer, camera);
  drawOpenWorldGroundDetails(ctx, world.cosmeticFloor.groundLayer, camera);
  drawOpenWorldGroundDecor(ctx, world.cosmeticFloor.groundLayer, camera, time);
  ctx.restore();

  const fade = ctx.createLinearGradient(0, 0, 0, height);
  fade.addColorStop(0, "rgba(3, 8, 14, 0.55)");
  fade.addColorStop(0.18, "rgba(3, 8, 14, 0.18)");
  fade.addColorStop(1, "rgba(3, 8, 14, 0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, width, height);
}
