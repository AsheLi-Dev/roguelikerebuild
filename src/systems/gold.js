import { centerOf, distance } from "../core/runtime-utils.js";
import { getGoldPickupRadiusMultiplier } from "./rings.js";
import { getPlayerStat } from "./player-stats.js";

export const GOLD_DROP_TABLE = Object.freeze({
  mob: { min: 1, max: 3, color: "#facc15", radius: 8 },
  elite: { min: 4, max: 7, color: "#f59e0b", radius: 10 },
  miniBoss: { min: 10, max: 16, color: "#fb7185", radius: 12 }
});

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function getGoldDropType(enemy) {
  if (enemy.enemyTier === "miniBoss") return "miniBoss";
  if (enemy.enemyTier === "elite") return "elite";
  return "mob";
}

export function spawnGoldDropsForEnemy(game, enemy) {
  const type = getGoldDropType(enemy);
  const config = GOLD_DROP_TABLE[type];
  const total = randomInt(config.min, config.max);
  const origin = centerOf(enemy);
  const dropCount = type === "miniBoss" ? 4 : type === "elite" ? 2 : 1;
  let remaining = total;

  for (let index = 0; index < dropCount; index += 1) {
    const value = index === dropCount - 1 ? remaining : Math.max(1, Math.floor(remaining / (dropCount - index)));
    remaining -= value;
    const angle = (index / dropCount) * Math.PI * 2 + Math.random() * 0.4;
    const speed = 80 + Math.random() * 50;
    game.goldDrops.push({
      id: `gold_${Math.random().toString(36).slice(2, 8)}`,
      type,
      value,
      x: origin.x + Math.cos(angle) * (28 + Math.random() * 26),
      y: origin.y + Math.sin(angle) * (28 + Math.random() * 26),
      vx: 0,
      vy: 0,
      radius: config.radius,
      color: config.color,
      age: 0,
      collectDelay: 0.25,
      lifetime: 16
    });
  }
}

export function updateGoldDrops(game, dt) {
  const playerCenter = centerOf(game.player);
  const pickupRadiusMult = getGoldPickupRadiusMultiplier(game);
  const magnetRange = 140 * pickupRadiusMult;
  const remaining = [];

  for (const drop of game.goldDrops) {
    drop.age += dt;
    drop.collectDelay = Math.max(0, drop.collectDelay - dt);

    if (drop.collectDelay <= 0) {
      const dx = playerCenter.x - drop.x;
      const dy = playerCenter.y - drop.y;
      const dist = Math.hypot(dx, dy) || 1;
      const magnet = dist < magnetRange ? (1 - dist / magnetRange) * 520 : 0;
      if (magnet > 0) {
        drop.x += (dx / dist) * magnet * dt;
        drop.y += (dy / dist) * magnet * dt;
      }
      if (distance(playerCenter.x, playerCenter.y, drop.x, drop.y) <= drop.radius + Math.min(game.player.w, game.player.h) * 0.45) {
        game.gold += Math.max(1, Math.round(drop.value * getPlayerStat(game.player, "goldGain")));
        const goldPickupSfx = game.assets?.goldPickupSfx;
        if (goldPickupSfx) {
          const instance = goldPickupSfx.cloneNode();
          instance.volume = Math.min(1, (goldPickupSfx.volume || 0.12) * (0.75 + Math.random() * 0.5));
          instance.playbackRate = 1 + (Math.random() * 0.32 - 0.16);
          instance.play().catch(() => {});
        }
        continue;
      }
    }

    if (drop.age < drop.lifetime) remaining.push(drop);
  }

  game.goldDrops = remaining;
}
