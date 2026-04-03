import { centerOf } from "../core/runtime-utils.js";
import { getRingDefById } from "../data/rings.js";
import { spawnDamagePopup } from "./combat.js";
import { markRingDerivedStatsDirty, getOwnedRings } from "./rings.js";
import { clearPlayerStatSource, setPlayerStatSource } from "./player-stats.js";
import { grantAffinityXp } from "./interactable-affinity.js";

const CURSE_SLOW_SOURCE = "cursedAnvilCurse";
const FIREBALL_INTERVAL = 3.0;
const FIREBALL_DAMAGE = 8;
const FIREBALL_SPEED = 180;
const FIREBALL_RADIUS = 14;
const FIREBALL_DRAW_SIZE = 28;
const PARTICLE_INTERVAL = 0.12;

const ANVIL_PARTICLE_COLORS = ["#941fd5", "#b43bf2", "#c084fc", "#7e22ce"];
const ANVIL_PARTICLE_PATTERNS = [
  { pixels: [{ x: 0, y: 0, color: 0 }], w: 1, h: 1 },
  { pixels: [{ x: 0, y: 0, color: 1 }, { x: 1, y: 0, color: 0 }], w: 2, h: 1 },
  { pixels: [{ x: 0, y: 0, color: 2 }, { x: 0, y: 1, color: 1 }], w: 1, h: 2 },
];

export const CURSED_ANVIL_CURSES = [
  { id: "curse_slow",       label: "Sluggish Hex",     description: "20% slower next biome" },
  { id: "curse_fireballs",  label: "Rain of Fire",     description: "Fireballs rain next biome" },
  { id: "curse_chest_cost", label: "Merchant's Spite", description: "Chests 20% pricier next biome" },
];

// ---------------------------------------------------------------------------
// Open / close
// ---------------------------------------------------------------------------

export function openCursedAnvil(game, searchable) {
  if (!searchable || searchable.isOpen) return false;
  const ownedRings = getOwnedRings(game);
  const eligible = ownedRings.filter((r) => {
    const def = getRingDefById(r.ringKey);
    return def && (r.currentLevel || 1) < (def.maxLevel || 5);
  });
  if (!eligible.length) {
    spawnDamagePopup(game, searchable.x + searchable.w * 0.5, searchable.y - 10, "No rings to gamble", {
      color: "#94a3b8",
      strokeColor: "rgba(15, 23, 42, 0.95)",
      duration: 1.1,
      riseSpeed: 22,
      scale: 0.9
    });
    return false;
  }
  game.cursedAnvilOpen = true;
  game.activeCursedAnvilId = searchable.id;
  if (game.state === "running") {
    game.cursedAnvilPausedGame = true;
    game.state = "paused";
  } else {
    game.cursedAnvilPausedGame = false;
  }
  game.bumpUiVersion?.("inventory", "overlay", "ringStats");
  return true;
}

export function closeCursedAnvil(game) {
  game.cursedAnvilOpen = false;
  game.activeCursedAnvilId = null;
  if (game.cursedAnvilPausedGame && game.state === "paused") {
    game.cursedAnvilPausedGame = false;
    game.state = "running";
  } else {
    game.cursedAnvilPausedGame = false;
  }
  game.bumpUiVersion?.("inventory", "overlay", "ringStats");
}

// ---------------------------------------------------------------------------
// Gamble
// ---------------------------------------------------------------------------

export function confirmCursedAnvilGamble(game, ringId) {
  const searchable = (game.searchables || []).find((s) => s.id === game.activeCursedAnvilId);
  if (!searchable || searchable.isOpen) return { ok: false, reason: "unavailable" };

  const def = getRingDefById(ringId);
  const owned = (game.ringInventory?.owned || {})[ringId];
  if (!def || !owned) return { ok: false, reason: "missingRing" };

  if ((owned.currentLevel || 1) >= (def.maxLevel || 5)) {
    spawnDamagePopup(game, searchable.x + searchable.w * 0.5, searchable.y - 10, "Already max level", {
      color: "#94a3b8",
      strokeColor: "rgba(15, 23, 42, 0.95)",
      duration: 1.1,
      riseSpeed: 22,
      scale: 0.9
    });
    closeCursedAnvil(game);
    return { ok: false, reason: "maxLevel" };
  }

  // Consume the anvil
  searchable.isOpen = true;
  searchable.openTimer = 0.3;

  grantAffinityXp(game, "cursedAnvil");

  const win = Math.random() < 0.5;
  if (win) {
    owned.currentLevel = Math.min(def.maxLevel || 5, (owned.currentLevel || 1) + 1);
    markRingDerivedStatsDirty(game);
    spawnDamagePopup(game, searchable.x + searchable.w * 0.5, searchable.y - 12, `${def.name} upgraded!`, {
      color: "#86efac",
      strokeColor: "rgba(20, 83, 45, 0.96)",
      duration: 1.1,
      riseSpeed: 28,
      scale: 1
    });
    closeCursedAnvil(game);
    return { ok: true, outcome: "upgrade", ringId, newLevel: owned.currentLevel };
  }

  // Lose — pick a random curse
  const curse = CURSED_ANVIL_CURSES[Math.floor(Math.random() * CURSED_ANVIL_CURSES.length)];
  applyCursedAnvilCurse(game, curse, searchable);
  closeCursedAnvil(game);
  return { ok: true, outcome: "curse", curse };
}

// ---------------------------------------------------------------------------
// Curse application
// ---------------------------------------------------------------------------

function applyCursedAnvilCurse(game, curse, searchable) {
  // Clear any previous curse first
  clearCursedAnvilCurse(game);

  game.cursedAnvilCurse = { id: curse.id, label: curse.label };

  if (curse.id === "curse_slow") {
    setPlayerStatSource(game.player, CURSE_SLOW_SOURCE, { moveSpeed: { mult: 0.8 } });
  } else if (curse.id === "curse_fireballs") {
    game.cursedAnvilFireballTimer = 0;
  } else if (curse.id === "curse_chest_cost") {
    game.cursedAnvilChestCostMult = 1.2;
  }

  const cx = searchable ? searchable.x + searchable.w * 0.5 : (game.player?.x ?? 0);
  const cy = searchable ? searchable.y - 12 : (game.player?.y ?? 0);
  spawnDamagePopup(game, cx, cy, `Cursed: ${curse.label}`, {
    color: "#c084fc",
    strokeColor: "rgba(59, 7, 100, 0.96)",
    duration: 1.4,
    riseSpeed: 24,
    scale: 1
  });
}

// ---------------------------------------------------------------------------
// Per-frame update (fireball curse)
// ---------------------------------------------------------------------------

export function updateCursedAnvilCurse(game, dt) {
  if (!game.cursedAnvilCurse || game.cursedAnvilCurse.id !== "curse_fireballs") return;
  if (typeof game.cursedAnvilFireballTimer !== "number") return;

  game.cursedAnvilFireballTimer += dt;
  if (game.cursedAnvilFireballTimer < FIREBALL_INTERVAL) return;
  game.cursedAnvilFireballTimer -= FIREBALL_INTERVAL;

  spawnCurseFireball(game);
}

function spawnCurseFireball(game) {
  if (!game.world || !game.player) return;
  const playerCenter = centerOf(game.player);

  // Pick a random edge: 0=top, 1=right, 2=bottom, 3=left
  const edge = Math.floor(Math.random() * 4);
  let sx, sy;
  const margin = 32;
  switch (edge) {
    case 0: sx = Math.random() * game.world.width;  sy = -margin; break;
    case 1: sx = game.world.width + margin;          sy = Math.random() * game.world.height; break;
    case 2: sx = Math.random() * game.world.width;  sy = game.world.height + margin; break;
    default: sx = -margin;                           sy = Math.random() * game.world.height; break;
  }

  const dx = playerCenter.x - sx;
  const dy = playerCenter.y - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  game.combat.enemyProjectiles.push({
    x: sx,
    y: sy,
    radius: FIREBALL_RADIUS,
    drawSize: FIREBALL_DRAW_SIZE,
    damage: FIREBALL_DAMAGE,
    speed: FIREBALL_SPEED,
    vx: (dx / len) * FIREBALL_SPEED,
    vy: (dy / len) * FIREBALL_SPEED,
    traveled: 0,
    maxRange: game.world.width + game.world.height,
    lifetime: 8,
    age: 0,
    color: "#f97316",
    sourceEnemyId: "cursed_anvil",
    spriteAsset: "volatileFireballProjectile",
    spriteFrames: 26,
    spriteFrameWidth: 512,
    spriteFrameHeight: 512,
    spriteFps: 18,
    spriteLoopStart: 0,
    spriteLoopEnd: 25,
    boomerang: false,
    outbound: true
  });
}

// ---------------------------------------------------------------------------
// Clear (called at biome transition / loadRoom)
// ---------------------------------------------------------------------------

export function clearCursedAnvilCurse(game) {
  if (!game.cursedAnvilCurse) return;
  clearPlayerStatSource(game.player, CURSE_SLOW_SOURCE);
  delete game.cursedAnvilChestCostMult;
  delete game.cursedAnvilFireballTimer;
  game.cursedAnvilCurse = null;
}

// ---------------------------------------------------------------------------
// Ambient particles — emitted from un-opened cursed anvil searchables
// ---------------------------------------------------------------------------

export function updateCursedAnvilParticles(game, dt) {
  if (!game.searchables?.length || !game.combat?.enemyHitParticles) return;
  for (const s of game.searchables) {
    if (s.typeId !== "cursedAnvil" || s.isOpen) continue;
    s._anvilParticleTimer = (s._anvilParticleTimer ?? 0) + dt;
    if (s._anvilParticleTimer < PARTICLE_INTERVAL) continue;
    s._anvilParticleTimer -= PARTICLE_INTERVAL;
    spawnAnvilParticle(game, s.x + s.w * 0.5, s.y + s.h * 0.3);
  }
}

function spawnAnvilParticle(game, cx, cy) {
  const pat = ANVIL_PARTICLE_PATTERNS[Math.floor(Math.random() * ANVIL_PARTICLE_PATTERNS.length)];
  const vx = (Math.random() - 0.5) * 28;
  const vy = -(18 + Math.random() * 36);
  game.combat.enemyHitParticles.push({
    kind: "cursedAnvilEmber",
    x: cx + (Math.random() - 0.5) * 20,
    y: cy + (Math.random() - 0.5) * 8,
    vx,
    vy,
    gravity: -18,
    drag: 0.96,
    age: 0,
    duration: 0.7 + Math.random() * 0.5,
    rotation: Math.random() * Math.PI * 2,
    angularVelocity: (Math.random() - 0.5) * 3,
    velocityFollow: 0,
    pixelSize: 2,
    pattern: pat.pixels,
    patternWidth: pat.w,
    patternHeight: pat.h,
    colors: ANVIL_PARTICLE_COLORS,
  });
}
