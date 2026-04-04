import { centerOf, distance, getCanvasDiameterRadius } from "../core/runtime-utils.js";
import { MATERIAL_DROP_TABLE, getMaterialDefById } from "../data/materials.js";
import { spawnDamagePopup } from "./combat.js";

const MATERIAL_PICKUP_RADIUS = 18;
const MATERIAL_MAGNET_SPEED = 420;
const MATERIAL_PICKUP_DELAY = 0.25;
const MATERIAL_LIFETIME = 18;
const MATERIAL_DROP_GRAVITY = 720;
const MATERIAL_DROP_AIR_DRAG = 0.94;
const MATERIAL_DROP_GROUND_DRAG = 0.82;
const MATERIAL_DROP_BOUNCE_RESTITUTION = 0.34;
const MATERIAL_DROP_BOUNCE_HORIZONTAL_DAMPING = 0.9;
const MATERIAL_DROP_MIN_BOUNCE_SPEED = 36;
const MATERIAL_DROP_INITIAL_ANGULAR_VELOCITY = 2.8;
const MATERIAL_DROP_GROUND_ANGULAR_DAMPING = 0.86;

const MATERIAL_VISUALS = Object.freeze({
  common: Object.freeze({
    color: "#d6d3d1",
    glow: "rgba(231, 229, 228, 0.4)"
  }),
  uncommon: Object.freeze({
    color: "#34d399",
    glow: "rgba(52, 211, 153, 0.35)"
  }),
  rare: Object.freeze({
    color: "#f472b6",
    glow: "rgba(244, 114, 182, 0.35)"
  })
});

export function createMaterialInventory() {
  return Object.create(null);
}

export function ensureMaterialInventory(game) {
  if (!game.materialInventory || typeof game.materialInventory !== "object" || Array.isArray(game.materialInventory)) {
    game.materialInventory = createMaterialInventory();
  }
  for (const entry of Object.values(MATERIAL_DROP_TABLE).flat()) {
    const materialId = entry?.materialId;
    if (!materialId) continue;
    game.materialInventory[materialId] = Math.max(0, Math.floor(game.materialInventory[materialId] || 0));
  }
  return game.materialInventory;
}

export function getMaterialCount(game, materialId) {
  ensureMaterialInventory(game);
  return Math.max(0, Math.floor(game.materialInventory[String(materialId || "")] || 0));
}

export function addMaterialToInventory(game, materialId, amount = 1) {
  const materialDef = getMaterialDefById(materialId);
  if (!materialDef) return false;
  const inventory = ensureMaterialInventory(game);
  inventory[materialDef.id] = Math.max(0, Math.floor(inventory[materialDef.id] || 0) + Math.max(1, Math.floor(amount || 1)));
  game.bumpUiVersion?.("inventory", "overlay");
  return true;
}

export function consumeMaterialFromInventory(game, materialId, amount = 1) {
  const materialDef = getMaterialDefById(materialId);
  if (!materialDef) return false;
  const inventory = ensureMaterialInventory(game);
  const spend = Math.max(1, Math.floor(amount || 1));
  if ((inventory[materialDef.id] || 0) < spend) return false;
  inventory[materialDef.id] = Math.max(0, Math.floor(inventory[materialDef.id] || 0) - spend);
  game.bumpUiVersion?.("inventory", "overlay");
  return true;
}

function getMaterialVisual(materialId) {
  const rarity = getMaterialDefById(materialId)?.rarity || "common";
  return MATERIAL_VISUALS[rarity] || MATERIAL_VISUALS.common;
}

function pushMaterialPickupPopup(game, playerCenter, materialId) {
  const materialDef = getMaterialDefById(materialId);
  if (!materialDef) return;
  spawnDamagePopup(
    game,
    playerCenter.x + (Math.random() - 0.5) * 28,
    playerCenter.y - game.player.h * 0.42 + (Math.random() - 0.5) * 8,
    materialDef.name,
    {
      color: getMaterialVisual(materialId).color,
      strokeColor: "rgba(2, 6, 23, 0.98)",
      duration: 0.9,
      riseSpeed: 28,
      scale: 0.9
    }
  );
}

export function spawnMaterialDrop(game, materialId, x, y) {
  const materialDef = getMaterialDefById(materialId);
  if (!materialDef) return null;
  game.materialDrops ||= [];
  const visual = getMaterialVisual(materialId);
  const burstAngle = Math.random() * Math.PI * 2;
  const burstSpeed = 65 + Math.random() * 55;
  const drop = {
    id: `material_${Math.random().toString(36).slice(2, 8)}`,
    materialId,
    x,
    y,
    vx: Math.cos(burstAngle) * burstSpeed,
    vy: Math.sin(burstAngle) * burstSpeed * 0.72,
    z: 12 + Math.random() * 8,
    vz: 145 + Math.random() * 65,
    radius: MATERIAL_PICKUP_RADIUS,
    bobClock: Math.random() * Math.PI * 2,
    pickupDelay: MATERIAL_PICKUP_DELAY,
    age: 0,
    lifetime: MATERIAL_LIFETIME,
    grounded: false,
    bounceCount: 0,
    rotation: (Math.random() - 0.5) * 0.08,
    angularVelocity: MATERIAL_DROP_INITIAL_ANGULAR_VELOCITY + Math.random() * 0.8,
    color: visual.color,
    glow: visual.glow
  };
  game.materialDrops.push(drop);
  return drop;
}

function resolveEnemyMaterialTier(enemy) {
  if (enemy?.isMiniBoss || enemy?.enemyTier === "miniBoss") return "miniBoss";
  return enemy?.enemyTier || "minion";
}

function spawnMaterialDropAmount(game, materialId, amount, origin) {
  const count = Math.max(0, Math.floor(amount || 0));
  const drops = [];
  for (let index = 0; index < count; index += 1) {
    const angle = count > 1 ? (index / count) * Math.PI * 2 : Math.random() * Math.PI * 2;
    const distance = count > 1 ? 10 + Math.random() * 6 : Math.random() * 12;
    const drop = spawnMaterialDrop(
      game,
      materialId,
      origin.x + Math.cos(angle) * distance + (Math.random() * 6 - 3),
      origin.y + Math.sin(angle) * distance * 0.75 + (Math.random() * 6 - 3)
    );
    if (drop) drops.push(drop);
  }
  return drops;
}

export function maybeSpawnMaterialDropForEnemy(game, enemy) {
  const origin = centerOf(enemy);
  const tier = resolveEnemyMaterialTier(enemy);
  const entries = MATERIAL_DROP_TABLE[tier];
  if (!Array.isArray(entries) || !entries.length) return [];

  const isSwarmer = enemy.movementTactic === "Swarmer";
  const drops = [];
  const weightedEntries = entries.filter((entry) => !entry.independent);

  if (weightedEntries.length) {
    let roll = Math.random();
    for (const entry of weightedEntries) {
      const chance = (entry.chance || 0) * (isSwarmer ? 0.5 : 1);
      roll -= chance;
      if (roll <= 0) {
        drops.push(...spawnMaterialDropAmount(game, entry.materialId, entry.amount, origin));
        break;
      }
    }
  }

  for (const entry of entries) {
    if (!entry.independent) continue;
    const chance = (entry.chance || 0) * (isSwarmer ? 0.5 : 1);
    if (Math.random() < chance) {
      drops.push(...spawnMaterialDropAmount(game, entry.materialId, entry.amount, origin));
    }
  }

  return drops;
}

export function updateMaterialDrops(game, dt) {
  ensureMaterialInventory(game);
  const playerCenter = centerOf(game.player);
  const magnetRange = getCanvasDiameterRadius(game);
  const remaining = [];

  for (const drop of game.materialDrops || []) {
    drop.age += dt;
    drop.bobClock += dt;
    drop.pickupDelay = Math.max(0, (drop.pickupDelay || 0) - dt);
    drop.z = Math.max(0, drop.z || 0);
    drop.vz = drop.vz || 0;
    drop.rotation = (drop.rotation || 0) + Math.max(0, drop.angularVelocity || 0) * dt;

    if (!drop.grounded) {
      drop.x += (drop.vx || 0) * dt;
      drop.y += (drop.vy || 0) * dt;
      drop.z += drop.vz * dt;
      drop.vz -= MATERIAL_DROP_GRAVITY * dt;
      drop.vx *= Math.pow(MATERIAL_DROP_AIR_DRAG, dt * 60);
      drop.vy *= Math.pow(MATERIAL_DROP_AIR_DRAG, dt * 60);
      if (drop.z <= 0) {
        drop.z = 0;
        if (Math.abs(drop.vz) > MATERIAL_DROP_MIN_BOUNCE_SPEED) {
          drop.vz = Math.abs(drop.vz) * MATERIAL_DROP_BOUNCE_RESTITUTION;
          drop.vx *= MATERIAL_DROP_BOUNCE_HORIZONTAL_DAMPING;
          drop.vy *= MATERIAL_DROP_BOUNCE_HORIZONTAL_DAMPING;
          drop.bounceCount = (drop.bounceCount || 0) + 1;
        } else {
          drop.vz = 0;
          drop.grounded = true;
        }
      }
    } else {
      drop.x += (drop.vx || 0) * dt;
      drop.y += (drop.vy || 0) * dt;
      drop.vx *= Math.pow(MATERIAL_DROP_GROUND_DRAG, dt * 60);
      drop.vy *= Math.pow(MATERIAL_DROP_GROUND_DRAG, dt * 60);
      drop.angularVelocity *= Math.pow(MATERIAL_DROP_GROUND_ANGULAR_DAMPING, dt * 60);
      if (Math.abs(drop.vx) < 2.5) drop.vx = 0;
      if (Math.abs(drop.vy) < 2.5) drop.vy = 0;
      if (Math.abs(drop.angularVelocity) < 0.05) drop.angularVelocity = 0;
    }

    if (drop.pickupDelay <= 0) {
      const dx = playerCenter.x - drop.x;
      const dy = playerCenter.y - drop.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < magnetRange) {
        const speed = Math.min(MATERIAL_MAGNET_SPEED * dt, dist);
        drop.x += (dx / dist) * speed;
        drop.y += (dy / dist) * speed;
      }
      if (distance(playerCenter.x, playerCenter.y, drop.x, drop.y) <= drop.radius + Math.min(game.player.w, game.player.h) * 0.45) {
        if (addMaterialToInventory(game, drop.materialId, 1)) {
          pushMaterialPickupPopup(game, playerCenter, drop.materialId);
          game.playAudioAsset?.("fingerPickupSfx", {
            volumeScale: 0.85 + Math.random() * 0.2,
            playbackRate: 0.97 + Math.random() * 0.08
          });
          continue;
        }
      }
    }

    if (drop.age < drop.lifetime) remaining.push(drop);
  }

  game.materialDrops = remaining;
}
