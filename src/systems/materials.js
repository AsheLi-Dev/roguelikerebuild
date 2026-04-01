import { centerOf, distance } from "../core/runtime-utils.js";
import { MATERIAL_DROP_TABLE, getMaterialDefById } from "../data/materials.js";

const MATERIAL_PICKUP_RADIUS = 18;
const MATERIAL_MAGNET_RANGE = 132;
const MATERIAL_MAGNET_SPEED = 420;
const MATERIAL_PICKUP_DELAY = 0.25;
const MATERIAL_LIFETIME = 18;

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
  for (const tierKey of Object.keys(MATERIAL_DROP_TABLE)) {
    const materialId = MATERIAL_DROP_TABLE[tierKey]?.materialId;
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

export function spawnMaterialDrop(game, materialId, x, y) {
  const materialDef = getMaterialDefById(materialId);
  if (!materialDef) return null;
  game.materialDrops ||= [];
  const visual = getMaterialVisual(materialId);
  const drop = {
    id: `material_${Math.random().toString(36).slice(2, 8)}`,
    materialId,
    x,
    y,
    radius: MATERIAL_PICKUP_RADIUS,
    bobClock: Math.random() * Math.PI * 2,
    pickupDelay: MATERIAL_PICKUP_DELAY,
    age: 0,
    lifetime: MATERIAL_LIFETIME,
    color: visual.color,
    glow: visual.glow
  };
  game.materialDrops.push(drop);
  return drop;
}

export function maybeSpawnMaterialDropForEnemy(game, enemy) {
  const tier = enemy?.enemyTier || "minion";
  const entry = MATERIAL_DROP_TABLE[tier];
  if (!entry || Math.random() >= entry.chance) return null;
  const origin = centerOf(enemy);
  return spawnMaterialDrop(
    game,
    entry.materialId,
    origin.x + (Math.random() * 24 - 12),
    origin.y + (Math.random() * 18 - 9)
  );
}

export function updateMaterialDrops(game, dt) {
  ensureMaterialInventory(game);
  const playerCenter = centerOf(game.player);
  const remaining = [];

  for (const drop of game.materialDrops || []) {
    drop.age += dt;
    drop.bobClock += dt;
    drop.pickupDelay = Math.max(0, (drop.pickupDelay || 0) - dt);

    if (drop.pickupDelay <= 0) {
      const dx = playerCenter.x - drop.x;
      const dy = playerCenter.y - drop.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < MATERIAL_MAGNET_RANGE) {
        const speed = Math.min(MATERIAL_MAGNET_SPEED * dt, dist);
        drop.x += (dx / dist) * speed;
        drop.y += (dy / dist) * speed;
      }
      if (distance(playerCenter.x, playerCenter.y, drop.x, drop.y) <= drop.radius + Math.min(game.player.w, game.player.h) * 0.45) {
        if (addMaterialToInventory(game, drop.materialId, 1)) continue;
      }
    }

    if (drop.age < drop.lifetime) remaining.push(drop);
  }

  game.materialDrops = remaining;
}
