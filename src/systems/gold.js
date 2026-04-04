import { centerOf, distance, getCanvasDiameterRadius, playThrottledAudio } from "../core/runtime-utils.js";
import { getGoldPickupRadiusMultiplier } from "./rings.js";
import { getPlayerStat } from "./player-stats.js";
import { scaleGoldAmount } from "./economy.js";

export const GOLD_DROP_TABLE = Object.freeze({
  mob: { min: 1, max: 3, color: "#facc15", radius: 8 },
  elite: { min: 4, max: 7, color: "#f59e0b", radius: 10 },
  miniBoss: { min: 10, max: 16, color: "#fb7185", radius: 12 }
});

const GOLD_DROP_SPRITE_COLUMNS = 7;
const GOLD_DROP_SPRITE_ROWS = 11;
const GOLD_DROP_GRAVITY = 720;
const GOLD_DROP_AIR_DRAG = 0.94;
const GOLD_DROP_GROUND_DRAG = 0.82;
const GOLD_DROP_BOUNCE_RESTITUTION = 0.42;
const GOLD_DROP_BOUNCE_HORIZONTAL_DAMPING = 0.92;
const GOLD_DROP_MIN_BOUNCE_SPEED = 42;
const GOLD_DROP_SPIN_FACTOR = 0.018;
const GOLD_DROP_MAX_SPIN = 7.5;

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomGoldSpriteFrame() {
  const index = randomInt(0, GOLD_DROP_SPRITE_COLUMNS * GOLD_DROP_SPRITE_ROWS - 1);
  return {
    col: index % GOLD_DROP_SPRITE_COLUMNS,
    row: Math.floor(index / GOLD_DROP_SPRITE_COLUMNS)
  };
}

export function createGoldDrop({
  id,
  type,
  value,
  x,
  y,
  radius,
  color,
  collectDelay = 0.25,
  lifetime = 16,
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
    bounceCount: 0,
    rotation: (Math.random() - 0.5) * 0.35,
    angularVelocity: 0,
    spriteFrame: randomGoldSpriteFrame()
  };
}

export function getGoldDropType(enemy) {
  if (enemy.enemyTier === "miniBoss") return "miniBoss";
  if (enemy.enemyTier === "elite") return "elite";
  return "mob";
}

export function spawnGoldDropsForEnemy(game, enemy) {
  const type = getGoldDropType(enemy);
  const config = GOLD_DROP_TABLE[type];
  let total = randomInt(config.min, config.max);

  if (enemy.movementTactic === "Swarmer") {
    total = Math.ceil(total * 0.5);
    if (Math.random() < 0.5) {
      total = Math.max(0, total - 1);
    }
  }

  const origin = centerOf(enemy);
  const baseSpeed = type === "miniBoss" ? 250 : type === "elite" ? 205 : 165;

  for (let index = 0; index < total; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = baseSpeed * (0.65 + Math.random() * 0.6);
    game.goldDrops.push(createGoldDrop({
      id: `gold_${Math.random().toString(36).slice(2, 8)}`,
      type,
      value: scaleGoldAmount(1),
      x: origin.x,
      y: origin.y,
      radius: config.radius,
      color: config.color,
      collectDelay: 0.28,
      lifetime: 16,
      burstAngle: angle,
      burstSpeed: speed,
      launchHeight: 14 + Math.random() * 10,
      launchVelocity: 175 + Math.random() * 110
    }));
  }
}

export function getGoldDropSpriteFrame(drop) {
  const frame = drop?.spriteFrame;
  if (!frame) return { col: 0, row: 0 };
  return frame;
}

export function updateGoldDrops(game, dt) {
  const playerCenter = centerOf(game.player);
  const pickupRadiusMult = getGoldPickupRadiusMultiplier(game);
  const magnetRange = getCanvasDiameterRadius(game) * pickupRadiusMult;
  const pickupRange = Math.min(game.player.w, game.player.h) * 0.75;
  const remaining = [];

  for (const drop of game.goldDrops) {
    drop.age += dt;
    drop.collectDelay = Math.max(0, drop.collectDelay - dt);
    drop.z = Math.max(0, drop.z || 0);
    drop.vz = drop.vz || 0;
    const lateralSpeed = drop.vx || 0;
    const targetSpin = Math.max(-GOLD_DROP_MAX_SPIN, Math.min(GOLD_DROP_MAX_SPIN, lateralSpeed * GOLD_DROP_SPIN_FACTOR));
    drop.angularVelocity = (drop.angularVelocity || 0) + (targetSpin - (drop.angularVelocity || 0)) * Math.min(1, dt * 10);
    drop.rotation = (drop.rotation || 0) + drop.angularVelocity * dt;

    if (!drop.grounded) {
      drop.x += (drop.vx || 0) * dt;
      drop.y += (drop.vy || 0) * dt;
      drop.z += drop.vz * dt;
      drop.vz -= GOLD_DROP_GRAVITY * dt;
      drop.vx *= Math.pow(GOLD_DROP_AIR_DRAG, dt * 60);
      drop.vy *= Math.pow(GOLD_DROP_AIR_DRAG, dt * 60);
      if (drop.z <= 0) {
        drop.z = 0;
        if (Math.abs(drop.vz) > GOLD_DROP_MIN_BOUNCE_SPEED) {
          drop.vz = Math.abs(drop.vz) * GOLD_DROP_BOUNCE_RESTITUTION;
          drop.vx *= GOLD_DROP_BOUNCE_HORIZONTAL_DAMPING;
          drop.vy *= GOLD_DROP_BOUNCE_HORIZONTAL_DAMPING;
          drop.bounceCount = (drop.bounceCount || 0) + 1;
        } else {
          drop.vz = 0;
          drop.grounded = true;
        }
      }
    } else {
      drop.x += (drop.vx || 0) * dt;
      drop.y += (drop.vy || 0) * dt;
      drop.vx *= Math.pow(GOLD_DROP_GROUND_DRAG, dt * 60);
      drop.vy *= Math.pow(GOLD_DROP_GROUND_DRAG, dt * 60);
      drop.angularVelocity *= Math.pow(0.9, dt * 60);
      if (Math.abs(drop.vx) < 2.5) drop.vx = 0;
      if (Math.abs(drop.vy) < 2.5) drop.vy = 0;
      if (Math.abs(drop.angularVelocity) < 0.05) drop.angularVelocity = 0;
    }

    if (drop.collectDelay <= 0) {
      const dx = playerCenter.x - drop.x;
      const dy = playerCenter.y - drop.y;
      const dist = Math.hypot(dx, dy) || 1;
      const magnet = dist < magnetRange ? (1 - dist / magnetRange) * 520 : 0;
      if (magnet > 0) {
        drop.x += (dx / dist) * magnet * dt;
        drop.y += (dy / dist) * magnet * dt;
      }
      if (distance(playerCenter.x, playerCenter.y, drop.x, drop.y) <= drop.radius + pickupRange) {
        game.gold += Math.max(1, Math.round(drop.value * getPlayerStat(game.player, "goldGain")));
        if (game.assets?.goldPickupSfx) {
          playThrottledAudio(game.assets.goldPickupSfx, {
            volume: Math.min(1, (game.assets.goldPickupSfx.volume || 0.12) * (0.75 + Math.random() * 0.5)),
            playbackRate: 1 + (Math.random() * 0.32 - 0.16)
          });
        }
        continue;
      }
    }

    if (drop.age < drop.lifetime) remaining.push(drop);
  }

  game.goldDrops = remaining;
}
