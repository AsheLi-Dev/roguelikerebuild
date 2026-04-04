import { centerOf, distance, getCanvasDiameterRadius, playThrottledAudio } from "../core/runtime-utils.js";
import { setPlayerStatSource } from "./player-stats.js";
import { spawnDamagePopup } from "./combat.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const XP_DROP_TABLE = Object.freeze({
  mob: { min: 1, max: 2, color: "#38bdf8", radius: 6 },
  elite: { min: 6, max: 10, color: "#0ea5e9", radius: 8 },
  miniBoss: { min: 25, max: 40, color: "#0284c7", radius: 10 }
});

const XP_DROP_GRAVITY = 720;
const XP_DROP_AIR_DRAG = 0.94;
const XP_DROP_GROUND_DRAG = 0.82;
const XP_DROP_BOUNCE_RESTITUTION = 0.42;
const XP_DROP_MIN_BOUNCE_SPEED = 42;

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createExperienceDrop({
  id,
  type,
  value,
  x,
  y,
  radius,
  color,
  collectDelay = 0.25,
  lifetime = 20,
  burstAngle = Math.random() * Math.PI * 2,
  burstSpeed = 100,
  launchHeight = 18 + Math.random() * 8,
  launchVelocity = 170 + Math.random() * 90
}) {
  return {
    id,
    type,
    value,
    x,
    y,
    vx: Math.cos(burstAngle) * burstSpeed,
    vy: Math.sin(burstAngle) * burstSpeed * 0.72,
    z: launchHeight,
    vz: launchVelocity,
    radius,
    color,
    age: 0,
    collectDelay,
    lifetime,
    grounded: false,
    bounceCount: 0
  };
}

// ---------------------------------------------------------------------------
// World Spawning
// ---------------------------------------------------------------------------
export function spawnExperienceDropsForEnemy(game, enemy) {
  if (!game.xpDrops) return;
  const type = enemy.enemyTier === "miniBoss" ? "miniBoss" : (enemy.isElite ? "elite" : "mob");
  const config = XP_DROP_TABLE[type];
  const total = randomInt(config.min, config.max);
  const origin = centerOf(enemy);
  const baseSpeed = type === "miniBoss" ? 280 : type === "elite" ? 220 : 180;

  for (let index = 0; index < total; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = baseSpeed * (0.6 + Math.random() * 0.7);
    game.xpDrops.push(createExperienceDrop({
      id: `xp_${Math.random().toString(36).slice(2, 8)}`,
      type,
      value: 1, // Each drop is worth 1 XP for simplicity, config controls count
      x: origin.x,
      y: origin.y,
      radius: config.radius,
      color: config.color,
      collectDelay: 0.3,
      lifetime: 20,
      burstAngle: angle,
      burstSpeed: speed,
      launchHeight: 12 + Math.random() * 10,
      launchVelocity: 160 + Math.random() * 100
    }));
  }
}

// ---------------------------------------------------------------------------
// Leveling Logic
// ---------------------------------------------------------------------------
export function computeTotalXpForLevel(level) {
  if (level <= 1) return 0;
  // Formula: exp = -4/0.11 * (1 - 1.55^(level-1))
  return Math.round((-4 / 0.11) * (1 - Math.pow(1.55, level - 1)));
}

export function computeXpToNext(level) {
  // Returns the amount of XP needed to go from the current level to the next
  return computeTotalXpForLevel(level + 1) - computeTotalXpForLevel(level);
}

export function hasEnoughXpToLevelUp(game) {
  return (game.player.xp || 0) >= (game.player.xpToNext || 10);
}

export function applyLevelUpBonuses(game) {
  const level = game.player.level || 1;
  // +6 Max HP and +1 ATK per level gained (beyond Level 1)
  const bonus = {
    maxHp: { add: (level - 1) * 6 },
    attack: { add: (level - 1) * 1 }
  };
  setPlayerStatSource(game.player, "level_up", bonus);
}

export function grantExperience(game, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  
  game.player.xp = (game.player.xp || 0) + amount;
  
  let levelsGained = 0;
  while (game.player.xp >= (game.player.xpToNext || 10)) {
    game.player.xp -= game.player.xpToNext;
    game.player.level = (game.player.level || 1) + 1;
    game.player.xpToNext = computeXpToNext(game.player.level);
    levelsGained += 1;
  }
  
  if (levelsGained > 0) {
    onLevelUp(game);
  }
}

function onLevelUp(game) {
  applyLevelUpBonuses(game);
  
  // Visual feedback
  const px = game.player.x + game.player.w * 0.5;
  const py = game.player.y;
  
  spawnDamagePopup(game, px, py - 60, `LEVEL UP! Lv${game.player.level}`, {
    color: "#38bdf8",
    strokeColor: "#082f49",
    duration: 2.5,
    riseSpeed: 24,
    scale: 1.2
  });
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
export function updateExperienceDrops(game, dt) {
  const playerCenter = centerOf(game.player);
  const magnetRange = getCanvasDiameterRadius(game) * 1.5; // Always strong magnet for XP
  const pickupRange = Math.min(game.player.w, game.player.h) * 0.85;
  const remaining = [];

  for (const drop of game.xpDrops || []) {
    drop.age += dt;
    drop.collectDelay = Math.max(0, drop.collectDelay - dt);
    drop.z = Math.max(0, drop.z || 0);

    if (!drop.grounded) {
      drop.x += (drop.vx || 0) * dt;
      drop.y += (drop.vy || 0) * dt;
      drop.z += (drop.vz || 0) * dt;
      drop.vz = (drop.vz || 0) - XP_DROP_GRAVITY * dt;
      drop.vx *= Math.pow(XP_DROP_AIR_DRAG, dt * 60);
      drop.vy *= Math.pow(XP_DROP_AIR_DRAG, dt * 60);
      
      if (drop.z <= 0) {
        drop.z = 0;
        if (Math.abs(drop.vz || 0) > XP_DROP_MIN_BOUNCE_SPEED) {
          drop.vz = Math.abs(drop.vz) * XP_DROP_BOUNCE_RESTITUTION;
          drop.vx *= 0.9;
          drop.vy *= 0.9;
        } else {
          drop.vz = 0;
          drop.grounded = true;
        }
      }
    } else {
      drop.x += (drop.vx || 0) * dt;
      drop.y += (drop.vy || 0) * dt;
      drop.vx *= Math.pow(XP_DROP_GROUND_DRAG, dt * 60);
      drop.vy *= Math.pow(XP_DROP_GROUND_DRAG, dt * 60);
    }

    if (drop.collectDelay <= 0) {
      const dx = playerCenter.x - drop.x;
      const dy = playerCenter.y - drop.y;
      const dist = Math.hypot(dx, dy) || 1;
      
      // Stronger magnet as distance decreases
      const magnetStrength = dist < magnetRange ? (1 - dist / magnetRange) * 650 : 0;
      if (magnetStrength > 0) {
        drop.x += (dx / dist) * magnetStrength * dt;
        drop.y += (dy / dist) * magnetStrength * dt;
      }
      
      if (dist <= drop.radius + pickupRange) {
        grantExperience(game, drop.value);
        
        // SFX
        if (game.assets?.xpPickupSfx) {
          playThrottledAudio(game.assets.xpPickupSfx, {
            volume: (game.assets.xpPickupSfx.volume || 0.18) * (0.8 + Math.random() * 0.4),
            playbackRate: 1.0 + (Math.random() * 0.4 - 0.2)
          });
        }
        continue;
      }
    }

    if (drop.age < drop.lifetime) remaining.push(drop);
  }

  game.xpDrops = remaining;
}
