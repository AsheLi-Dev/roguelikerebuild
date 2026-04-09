// World-space "sunlight through clouds" ground-light patches.
// Patches are anchored in world coordinates and drift left/slightly-down.
//
// Sky haze is a SEPARATE screen-space layer: soft directional gradients
// sitting at the top of the screen, suggesting light from the upper-right.
// They are NOT connected to the ground patches geometrically — this avoids
// the "beam growing from the ground" artifact when the player moves upward.

// Set window.DEBUG_SUNLIGHT = true in the browser console to enable debug overlay.
const DEBUG_SUNLIGHT = () => window.DEBUG_SUNLIGHT ?? false;

// ── Ground patch constants ────────────────────────────────────────────────────
const PATCH_COUNT_MIN = 6;
const PATCH_COUNT_MAX = 9;

const DRIFT_X = -14; // world px / sec, leftward
const DRIFT_Y =   6; // world px / sec, slightly downward

const BASE_ALPHA_MIN  = 0.055;
const BASE_ALPHA_MAX  = 0.092;
const ALPHA_PULSE_AMP = 0.022;

const RX_MIN = 200;
const RX_MAX = 370;
const RY_MIN = 110;
const RY_MAX = 230;

const PHASE_SPEED_MIN = 0.06;
const PHASE_SPEED_MAX = 0.17;

const FADE_IN_MIN = 1.2;
const FADE_IN_MAX = 1.8;

// ── Camera-right spawn bias ───────────────────────────────────────────────────
const SPAWN_RIGHT_CHANCE      = 0.70;
const SPAWN_RIGHT_CHANCE_INIT = 0.30;
const SPAWN_MARGIN_MIN  = 100;
const SPAWN_MARGIN_MAX  = 160;
const SPAWN_EXTRA_X_MIN =  40;
const SPAWN_EXTRA_X_MAX = 120;
const VERTICAL_PAD_MIN  = 100;
const VERTICAL_PAD_MAX  = 160;

// ── Sky haze beam constants ───────────────────────────────────────────────────
// These live in SCREEN space — no camera offset, no world position.
// They drift leftward slower than ground patches for a parallax depth feel.
const SKY_BEAM_COUNT = 3;

const SKY_BASE_ALPHA_MIN  = 0.045;
const SKY_BASE_ALPHA_MAX  = 0.075;
const SKY_PULSE_AMP       = 0.012;
const SKY_PHASE_SPEED_MIN = 0.04;
const SKY_PHASE_SPEED_MAX = 0.09;

// Screen-space drift in screen-width units per second
// (7 screen-px / sec at 1120px wide → normX changes by 7/1120 per sec)
const SKY_DRIFT_PX     = -7;
const SKY_WRAP_RIGHT   = 1.5;  // normX value assigned on respawn
const SKY_WRAP_LEFT    = -0.3; // normX threshold that triggers respawn

// Sun angle from vertical: 30°, so light goes lower-left from upper-right.
// SIN/COS used to compute the gradient direction vector.
const SUN_SIN = Math.sin(Math.PI / 6); // 0.500
const SUN_COS = Math.cos(Math.PI / 6); // 0.866

// ── Color ─────────────────────────────────────────────────────────────────────
const SUN_R = 255;
const SUN_G = 230;
const SUN_B = 145;

// ─────────────────────────────────────────────────────────────────────────────

function rng(min, max) {
  return min + Math.random() * (max - min);
}

// ── Ground patch helpers ──────────────────────────────────────────────────────

function createPatchAt(x, y) {
  return {
    x, y,
    rx:           rng(RX_MIN, RX_MAX),
    ry:           rng(RY_MIN, RY_MAX),
    baseAlpha:    rng(BASE_ALPHA_MIN, BASE_ALPHA_MAX),
    alpha:        0,
    phase:        rng(0, Math.PI * 2),
    phaseSpeed:   rng(PHASE_SPEED_MIN, PHASE_SPEED_MAX),
    fadeTimer:    0,
    fadeDuration: rng(FADE_IN_MIN, FADE_IN_MAX)
  };
}

function spawnRightOfCamera(game) {
  const camX = game.camera?.x       || 0;
  const camY = game.camera?.y       || 0;
  const vw   = game.camera?.viewWidth  || 1120;
  const vh   = game.camera?.viewHeight || 630;
  const vPad = rng(VERTICAL_PAD_MIN, VERTICAL_PAD_MAX);
  const x    = camX + vw
              + rng(SPAWN_MARGIN_MIN, SPAWN_MARGIN_MAX)
              + rng(SPAWN_EXTRA_X_MIN, SPAWN_EXTRA_X_MAX);
  const y    = rng(camY - vPad, camY + vh + vPad);
  return createPatchAt(x, y);
}

function spawnWorldDistributed(world) {
  return createPatchAt(
    rng(0, world?.width  || 1600),
    rng(0, world?.height || 1200)
  );
}

function choosePatch(game, isInitial) {
  const chance = isInitial ? SPAWN_RIGHT_CHANCE_INIT : SPAWN_RIGHT_CHANCE;
  if (game.camera && Math.random() < chance) return spawnRightOfCamera(game);
  return spawnWorldDistributed(game.world);
}

// ── Sky haze beam helpers ─────────────────────────────────────────────────────

function createSkyBeam(normXHint) {
  return {
    normX:      normXHint + rng(-0.12, 0.12),
    baseAlpha:  rng(SKY_BASE_ALPHA_MIN, SKY_BASE_ALPHA_MAX),
    alpha:      0,
    phase:      rng(0, Math.PI * 2),
    phaseSpeed: rng(SKY_PHASE_SPEED_MIN, SKY_PHASE_SPEED_MAX)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function createSunlightPatchesState() {
  return { patches: [], skyBeams: [] };
}

export function resetSunlightPatches(game) {
  // Ground patches
  const count = PATCH_COUNT_MIN
    + Math.floor(Math.random() * (PATCH_COUNT_MAX - PATCH_COUNT_MIN + 1));
  const patches = [];
  for (let i = 0; i < count; i++) patches.push(choosePatch(game, true));

  // Sky haze beams — evenly spread across normX ∈ [0.3, 1.2]
  const skyBeams = [];
  for (let i = 0; i < SKY_BEAM_COUNT; i++) {
    const hint = SKY_BEAM_COUNT < 2
      ? 0.75
      : 0.3 + (i / (SKY_BEAM_COUNT - 1)) * 0.9;
    skyBeams.push(createSkyBeam(hint));
  }

  game.sunlightPatches = { patches, skyBeams };
}

export function updateSunlightPatches(game, dt) {
  if (!game.sunlightPatches) resetSunlightPatches(game);
  const state = game.sunlightPatches;

  // Lazily migrate state if skyBeams was not present in a previous version
  if (!state.skyBeams) {
    state.skyBeams = [];
    for (let i = 0; i < SKY_BEAM_COUNT; i++) {
      state.skyBeams.push(createSkyBeam(0.3 + i * 0.45));
    }
  }

  const world = game.world;
  if (!world) return;

  const wh = world.height;
  const vw = game.camera?.viewWidth || 1120;

  // Ground patches
  const patches = state.patches;
  for (let i = 0; i < patches.length; i++) {
    const p = patches[i];
    p.x         += DRIFT_X * dt;
    p.y         += DRIFT_Y * dt;
    p.phase     += p.phaseSpeed * dt;
    p.fadeTimer  = Math.min(p.fadeDuration, p.fadeTimer + dt);
    const fadeT  = p.fadeTimer / p.fadeDuration;
    p.alpha      = (p.baseAlpha + Math.sin(p.phase) * ALPHA_PULSE_AMP) * fadeT;

    if (p.x + p.rx < 0) { patches[i] = choosePatch(game, false); continue; }
    if (p.y - p.ry > wh) p.y = -p.ry;
  }

  // Sky haze beams (screen-space drift, no camera involved)
  const skyBeams = state.skyBeams;
  for (let i = 0; i < skyBeams.length; i++) {
    const b    = skyBeams[i];
    b.normX   += (SKY_DRIFT_PX / vw) * dt;
    b.phase   += b.phaseSpeed * dt;
    b.alpha    = b.baseAlpha + Math.sin(b.phase) * SKY_PULSE_AMP;

    if (b.normX < SKY_WRAP_LEFT) {
      skyBeams[i] = createSkyBeam(SKY_WRAP_RIGHT + rng(0, 0.2));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal draw helpers
// ─────────────────────────────────────────────────────────────────────────────

function drawSkyHazeBeam(ctx, beam, viewW, viewH) {
  // Source point: just above the screen, at the beam's screen-x position.
  // Gradient direction: lower-left at 30° from vertical (SUN_SIN / SUN_COS).
  // fillRect covers the whole view — the gradient fades to 0 well before
  // the lower-left of the screen so it never looks like a ground filter.
  const srcX = viewW * beam.normX;
  const srcY = -40;
  const len  = viewH * 0.80; // gradient reach along beam direction
  const dstX = srcX - SUN_SIN * len;
  const dstY = srcY + SUN_COS * len;

  const a = Math.max(0, beam.alpha);
  if (a <= 0.001) return;

  const grad = ctx.createLinearGradient(srcX, srcY, dstX, dstY);
  grad.addColorStop(0,    `rgba(${SUN_R},${SUN_G},${SUN_B},${a.toFixed(3)})`);
  grad.addColorStop(0.22, `rgba(${SUN_R},${SUN_G},${SUN_B},${(a * 0.62).toFixed(3)})`);
  grad.addColorStop(0.60, `rgba(${SUN_R},${SUN_G},${SUN_B},${(a * 0.18).toFixed(3)})`);
  grad.addColorStop(1,    `rgba(${SUN_R},${SUN_G},${SUN_B},0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
}

function drawGroundPatch(ctx, p, sx, sy, alpha, debug) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(1, p.ry / p.rx);

  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.rx);
  const a0 = alpha.toFixed(3);
  const a1 = (alpha * 0.52).toFixed(3);
  grad.addColorStop(0,    `rgba(${SUN_R},${SUN_G},${SUN_B},${a0})`);
  grad.addColorStop(0.42, `rgba(${SUN_R},${SUN_G},${SUN_B},${a1})`);
  grad.addColorStop(1,    `rgba(${SUN_R},${SUN_G},${SUN_B},0)`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, p.rx, 0, Math.PI * 2);
  ctx.fill();

  if (debug) {
    ctx.strokeStyle = "rgba(255,80,0,0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, p.rx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(sx, sy);
    ctx.strokeStyle = "rgba(255,80,0,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
    ctx.moveTo(0, -8); ctx.lineTo(0, 8);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main draw entry point
// ─────────────────────────────────────────────────────────────────────────────

export function drawSunlightPatches(ctx, game) {
  const debug   = DEBUG_SUNLIGHT();
  const state   = game.sunlightPatches;
  if (!state || !game.world) return;

  const cameraX = game.camera?.x || 0;
  const cameraY = game.camera?.y || 0;
  const viewW   = game.camera?.viewWidth  || game.canvas?.width  || 1120;
  const viewH   = game.camera?.viewHeight || game.canvas?.height || 630;

  if (debug) {
    // Green dashed line = camera right edge
    ctx.save();
    ctx.strokeStyle = "rgba(0,255,80,0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(viewW, 0);
    ctx.lineTo(viewW, viewH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(0,255,80,0.9)";
    ctx.font = "bold 11px monospace";
    ctx.fillText("cam right", viewW - 72, 18);
    ctx.restore();
  }

  ctx.save();

  // Pass 0 — sky haze (screen-space, drawn first so ground patches sit on top)
  const skyBeams = state.skyBeams;
  if (skyBeams?.length) {
    for (const beam of skyBeams) {
      drawSkyHazeBeam(ctx, beam, viewW, viewH);
    }

    if (debug) {
      // Yellow line + dot = each sky beam's gradient axis
      for (const beam of skyBeams) {
        const srcX = viewW * beam.normX;
        const len  = viewH * 0.80;
        const dstX = srcX - SUN_SIN * len;
        const dstY = SUN_COS * len - 40;
        ctx.save();
        ctx.strokeStyle = "rgba(255,220,0,0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(srcX, 0);   // clamp to screen top
        ctx.lineTo(dstX, dstY);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,220,0,0.9)";
        ctx.beginPath();
        ctx.arc(srcX, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Pass 1 — ground patches (world-space, camera offset applied)
  const patches = state.patches;
  if (patches?.length) {
    for (const p of patches) {
      const sx = p.x - cameraX;
      const sy = p.y - cameraY;
      if (!debug && (sx + p.rx < 0 || sx - p.rx > viewW ||
                     sy + p.ry < 0 || sy - p.ry > viewH)) {
        continue;
      }
      const alpha = debug ? 0.35 : Math.max(0, p.alpha);
      if (alpha <= 0.001) continue;
      drawGroundPatch(ctx, p, sx, sy, alpha, debug);
    }
  }

  ctx.restore();
}
