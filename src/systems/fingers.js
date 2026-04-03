import { centerOf, distance, normalize } from "../core/runtime-utils.js";
import { getFingerDefById, getFingerDefsByRarity, getFingerRarityOrder } from "../data/fingers.js";
import { getMaterialDefById } from "../data/materials.js";
import { getPlayerAttackStat, getPlayerBasicAttackDamage, getPlayerSkillAttackDamage, setPlayerStatSource } from "./player-stats.js";
import { rollLuckyChance } from "./rings.js";

const FINGER_MATERIAL_TO_RARITY = Object.freeze({
  witheredFinger: "normal",
  monsterFinger: "uncommon",
  twistedFinger: "rare"
});
const BASE_STARTING_FINGER_COUNT = 2;

function toAbsoluteSlotIndex(storageIndex) {
  return BASE_STARTING_FINGER_COUNT + Math.max(0, Math.floor(storageIndex || 0));
}

function toStorageSlotIndex(slotIndex) {
  return Math.max(0, Math.floor(slotIndex || 0) - BASE_STARTING_FINGER_COUNT);
}

function createDefaultEffectState() {
  return {
    killThresholdProgress: 0,
    killThresholdBuffTimer: 0,
    attackFluxTimer: 10,
    attackFluxPenalty: 0,
    attackFluxPenaltyTimer: 0,
    pendingEchoAttack: false,
    pendingSlideAttackTarget: null,
    dragonTimer: 15,
    lastBiomeRewardRoomIndex: -1
  };
}

export function createFingerState() {
  return {
    derivedStatsDirty: true,
    activeEffects: createDefaultEffectState()
  };
}

function createFingerInventory() {
  return {
    owned: [],
    slots: []
  };
}

function ensureFingerContainers(game) {
  if (!game.fingerInventory || typeof game.fingerInventory !== "object" || Array.isArray(game.fingerInventory)) {
    game.fingerInventory = createFingerInventory();
  }
  if (!Array.isArray(game.fingerInventory.owned)) game.fingerInventory.owned = [];
  if (!Array.isArray(game.fingerInventory.slots)) game.fingerInventory.slots = [];
  game.fingerState ??= createFingerState();
}

function createAggregate() {
  return {
    attack: { add: 0, mult: 1 },
    maxHp: { add: 0, mult: 1 },
    moveSpeed: { add: 0, mult: 1 },
    attackSpeed: { add: 0, mult: 1 },
    lifestealRatio: { add: 0, mult: 1 }
  };
}

function applyStatEffect(aggregate, effect) {
  const bucket = aggregate[effect.stat];
  if (!bucket) return;
  if (effect.op === "multAdd") bucket.mult *= 1 + (effect.value || 0);
  else bucket.add += effect.value || 0;
}

function getFingerSlotRecord(game, slotIndex) {
  ensureFingerContainers(game);
  if (slotIndex < BASE_STARTING_FINGER_COUNT) return null;
  const fingerId = game.fingerInventory.slots[toStorageSlotIndex(slotIndex)];
  if (!fingerId) return null;
  const definition = getFingerDefById(fingerId);
  if (!definition) return null;
  return { slotIndex, fingerId, definition };
}

function forEachOwnedFinger(game, callback) {
  ensureFingerContainers(game);
  game.fingerInventory.slots.forEach((fingerId, storageIndex) => {
    const definition = getFingerDefById(fingerId);
    if (!definition) return;
    callback({ slotIndex: toAbsoluteSlotIndex(storageIndex), fingerId, definition });
  });
}

function forEachFingerEffect(game, callback) {
  forEachOwnedFinger(game, ({ slotIndex, fingerId, definition }) => {
    for (const effect of definition.effects || []) callback(effect, definition, { slotIndex, fingerId });
  });
}

function applyBleed(enemy, effect) {
  enemy.state ||= {};
  enemy.state.bleedStacks = Math.min(99, (enemy.state.bleedStacks || 0) + (effect.stacks || 1));
  enemy.state.bleedTimer = Math.max(enemy.state.bleedTimer || 0, effect.duration || 4);
  enemy.state.bleedTickTimer = Math.min(enemy.state.bleedTickTimer || 1, 1);
  enemy.state.bleedDamagePerStack = Math.max(enemy.state.bleedDamagePerStack || 0, effect.damagePerStack || 3);
}

function applyHealing(game, amount) {
  const value = Math.max(0, Number(amount) || 0);
  if (value <= 0) return 0;
  const previous = game.player.hp;
  game.player.hp = Math.min(game.player.maxHp, game.player.hp + value);
  return Math.max(0, game.player.hp - previous);
}

function addGold(game, amount) {
  game.gold += Math.max(0, Math.round(amount || 0));
}

function addPopup(game, x, y, text, options = {}) {
  game.combat?.damagePopups?.push({
    x,
    y,
    text,
    age: 0,
    duration: options.duration ?? 0.9,
    riseSpeed: options.riseSpeed ?? 24,
    color: options.color ?? "#e2e8f0",
    strokeColor: options.strokeColor ?? "rgba(2, 6, 23, 0.98)",
    scale: options.scale ?? 0.9,
    isCrit: false
  });
}

function hasRingInSlot(game, slotIndex) {
  return !!game.equippedRings?.[slotIndex];
}

function findNearestEnemyCenter(game, range) {
  let nearest = null;
  let nearestDist = range;
  const playerCenter = centerOf(game.player);
  for (const enemy of game.enemies || []) {
    if (enemy.dead) continue;
    const enemyCenter = centerOf(enemy);
    const dist = distance(playerCenter.x, playerCenter.y, enemyCenter.x, enemyCenter.y);
    if (dist >= nearestDist) continue;
    nearest = enemyCenter;
    nearestDist = dist;
  }
  return nearest;
}

function pushLoyalDragonEffect(game, duration) {
  game.combat.skillRuntime.effects.push({
    kind: "loyalDragons",
    duration,
    elapsed: 0,
    orbitAngle: 0,
    orbitRadius: 70,
    contactDamage: getPlayerSkillAttackDamage(game.player),
    projectileDamage: getPlayerSkillAttackDamage(game.player),
    projectileCooldown: 0,
    autoFireCooldown: 0,
    hitCooldowns: {},
    dragonPositions: [],
    color: "#fb923c"
  });
}

export function markFingerDerivedStatsDirty(game) {
  ensureFingerContainers(game);
  game.fingerState.derivedStatsDirty = true;
}

export function initializeFingerRuntime(game) {
  ensureFingerContainers(game);
  game.fingerState = createFingerState();
  refreshFingerDerivedStats(game, { force: true });
}

export function refreshFingerDerivedStats(game, options = {}) {
  ensureFingerContainers(game);
  if (!options.force && !game.fingerState.derivedStatsDirty) return false;
  const aggregate = createAggregate();
  const state = game.fingerState.activeEffects;

  forEachFingerEffect(game, (effect, _definition, context) => {
    if (effect.type === "stat") {
      applyStatEffect(aggregate, effect);
      return;
    }
    if (effect.type !== "special") return;
    if (effect.effect === "killThresholdBuff" && state.killThresholdBuffTimer > 0) {
      aggregate.moveSpeed.mult *= 1 + (effect.moveSpeedBonus || 0);
      aggregate.attackSpeed.mult *= 1 + (effect.attackSpeedBonus || 0);
    }
    if (effect.effect === "periodicAttackSpeedPenalty" && state.attackFluxPenaltyTimer > 0) {
      aggregate.attackSpeed.mult *= Math.max(0.1, 1 - (state.attackFluxPenalty || 0));
    }
    if (effect.effect === "emptySlotBoon" && !hasRingInSlot(game, context.slotIndex)) {
      aggregate.lifestealRatio.add += effect.lifesteal || 0;
      aggregate.moveSpeed.mult *= 1 + (effect.moveSpeedBonus || 0);
    }
  });

  setPlayerStatSource(game.player, "fingers", aggregate);
  game.fingerState.derivedStatsDirty = false;
  return true;
}

export function updateFingerRuntime(game, dt) {
  ensureFingerContainers(game);
  const state = game.fingerState.activeEffects;
  state.killThresholdBuffTimer = Math.max(0, state.killThresholdBuffTimer - dt);
  state.attackFluxTimer = Math.max(0, state.attackFluxTimer - dt);
  state.attackFluxPenaltyTimer = Math.max(0, state.attackFluxPenaltyTimer - dt);
  state.dragonTimer = Math.max(0, state.dragonTimer - dt);

  if (state.attackFluxPenaltyTimer <= 0 && state.attackFluxPenalty > 0) {
    state.attackFluxPenalty = 0;
    markFingerDerivedStatsDirty(game);
  }

  forEachFingerEffect(game, (effect) => {
    if (effect.type !== "special") return;
    if (effect.effect === "periodicAttackSpeedPenalty" && state.attackFluxTimer <= 0) {
      state.attackFluxTimer = effect.interval || 10;
      state.attackFluxPenalty = effect.minPenalty + Math.random() * Math.max(0, (effect.maxPenalty || effect.minPenalty) - effect.minPenalty);
      state.attackFluxPenaltyTimer = effect.duration || 10;
      markFingerDerivedStatsDirty(game);
    }
    if (effect.effect === "periodicDragonSummon" && state.dragonTimer <= 0) {
      state.dragonTimer = effect.interval || 15;
      pushLoyalDragonEffect(game, effect.duration || 8);
      const playerCenter = centerOf(game.player);
      addPopup(game, playerCenter.x, playerCenter.y - 42, "Dragon Pact", {
        color: "#fb923c",
        strokeColor: "rgba(120, 53, 15, 0.96)"
      });
    }
  });

  refreshFingerDerivedStats(game);
}

export function getFingerInSlot(game, slotIndex) {
  return getFingerSlotRecord(game, slotIndex);
}

export function slotHasFingerWithoutRing(game, slotIndex) {
  return !!getFingerSlotRecord(game, slotIndex) && !hasRingInSlot(game, slotIndex);
}

export function getFingerRingEffectMultiplierForSlot(game, slotIndex) {
  const record = getFingerSlotRecord(game, slotIndex);
  if (!record) return 1;
  for (const effect of record.definition.effects || []) {
    if (effect.type === "special" && effect.effect === "doubleRingEffect") return effect.multiplier || 2;
  }
  return 1;
}

export function getOwnedFingerEntries(game) {
  ensureFingerContainers(game);
  return game.fingerInventory.slots
    .map((fingerId, storageIndex) => {
      const definition = getFingerDefById(fingerId);
      return definition ? { slotIndex: toAbsoluteSlotIndex(storageIndex), fingerId, definition } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.slotIndex - b.slotIndex || getFingerRarityOrder(a.definition.rarity) - getFingerRarityOrder(b.definition.rarity));
}

export function getAvailableFingerDefsForMaterial(game, materialId) {
  ensureFingerContainers(game);
  const rarity = FINGER_MATERIAL_TO_RARITY[String(materialId || "")];
  if (!rarity) return [];
  const owned = new Set(game.fingerInventory.owned);
  return getFingerDefsByRarity(rarity).filter((definition) => !owned.has(definition.id));
}

export function unlockFingerFromMaterial(game, materialId) {
  ensureFingerContainers(game);
  const materialDef = getMaterialDefById(materialId);
  const rarity = FINGER_MATERIAL_TO_RARITY[String(materialId || "")];
  if (!materialDef || !rarity) return { ok: false, reason: "invalidMaterial" };
  const available = getAvailableFingerDefsForMaterial(game, materialId);
  if (!available.length) return { ok: false, reason: "tierComplete", rarity };
  const picked = available[Math.floor(Math.random() * available.length)];
  const slotIndex = toAbsoluteSlotIndex(game.fingerInventory.slots.length);
  game.fingerInventory.owned.push(picked.id);
  game.fingerInventory.slots.push(picked.id);
  game.setNumberOfFingers?.(slotIndex + 1);
  markFingerDerivedStatsDirty(game);
  refreshFingerDerivedStats(game, { force: true });
  return {
    ok: true,
    rarity,
    materialId: materialDef.id,
    fingerId: picked.id,
    slotIndex,
    definition: picked
  };
}

export function sellOwnedFinger(game, slotIndex) {
  ensureFingerContainers(game);
  const absoluteSlotIndex = Math.max(BASE_STARTING_FINGER_COUNT, Math.floor(slotIndex || 0));
  const storageIndex = toStorageSlotIndex(absoluteSlotIndex);
  const fingerId = game.fingerInventory.slots[storageIndex];
  if (!fingerId) return { ok: false, reason: "missingFinger" };
  const definition = getFingerDefById(fingerId);
  if (!definition) return { ok: false, reason: "missingFingerDef" };

  const removedRingId = game.equippedRings?.[absoluteSlotIndex] || null;
  if (Array.isArray(game.equippedRings)) {
    for (let index = absoluteSlotIndex; index < game.equippedRings.length - 1; index += 1) {
      game.equippedRings[index] = game.equippedRings[index + 1] || null;
    }
    game.equippedRings[game.equippedRings.length - 1] = null;
  }

  game.fingerInventory.slots.splice(storageIndex, 1);
  const ownedIndex = game.fingerInventory.owned.indexOf(fingerId);
  if (ownedIndex >= 0) game.fingerInventory.owned.splice(ownedIndex, 1);

  game.setNumberOfFingers?.(BASE_STARTING_FINGER_COUNT + game.fingerInventory.slots.length);
  markFingerDerivedStatsDirty(game);
  refreshFingerDerivedStats(game, { force: true });

  return {
    ok: true,
    slotIndex: absoluteSlotIndex,
    fingerId,
    definition,
    removedRingId
  };
}

export function onFingerEnemyKilled(game) {
  const state = game.fingerState?.activeEffects;
  if (!state) return;
  forEachFingerEffect(game, (effect) => {
    if (effect.type !== "special" || effect.effect !== "killThresholdBuff") return;
    state.killThresholdProgress += 1;
    if (state.killThresholdProgress < (effect.killThreshold || 10)) return;
    state.killThresholdProgress = 0;
    state.killThresholdBuffTimer = effect.duration || 4;
    applyHealing(game, effect.healAmount || 10);
    markFingerDerivedStatsDirty(game);
    const playerCenter = centerOf(game.player);
    addPopup(game, playerCenter.x, playerCenter.y - 36, "Hunter's Rush", {
      color: "#34d399",
      strokeColor: "rgba(6, 78, 59, 0.96)"
    });
  });
}

export function onFingerHit(game, enemy, meta = {}) {
  forEachFingerEffect(game, (effect, _definition, context) => {
    if (effect.type !== "special") return;
    if (effect.effect === "bleedChanceOnHit" && meta.source !== "burn" && rollLuckyChance(game, effect.chance || 0)) {
      applyBleed(enemy, effect);
    }
    if (effect.effect === "emptySlotExplosion" && !hasRingInSlot(game, context.slotIndex) && meta.source !== "fingerExplosion" && meta.source !== "burn") {
      const origin = centerOf(enemy);
      const damage = Math.max(1, getPlayerAttackStat(game.player) * (effect.damageRatio || 0.5));
      for (const other of game.enemies || []) {
        if (other.dead || other === enemy) continue;
        const targetCenter = centerOf(other);
        if (distance(origin.x, origin.y, targetCenter.x, targetCenter.y) > (effect.radius || 56) + other.w * 0.35) continue;
        game.damageEnemy(other, damage, { source: "fingerExplosion", isDirect: false, bypassRingDamage: true });
      }
    }
  });
}

export function onFingerBasicAttackUsed(game) {
  const state = game.fingerState?.activeEffects;
  if (!state) return;
  forEachFingerEffect(game, (effect) => {
    if (effect.type !== "special" || effect.effect !== "doubleAttackChance") return;
    if (rollLuckyChance(game, effect.chance || 0)) state.pendingEchoAttack = true;
  });
}

export function consumePendingFingerEchoAttack(game) {
  const state = game.fingerState?.activeEffects;
  if (!state?.pendingEchoAttack) return false;
  state.pendingEchoAttack = false;
  return true;
}

export function onFingerSlideStart(game) {
  const state = game.fingerState?.activeEffects;
  if (!state) return;
  forEachFingerEffect(game, (effect) => {
    if (effect.type !== "special" || effect.effect !== "slideAutoAttack") return;
    const target = findNearestEnemyCenter(game, effect.range || 280);
    if (target) state.pendingSlideAttackTarget = target;
  });
}

export function consumePendingFingerSlideAttackTarget(game) {
  const state = game.fingerState?.activeEffects;
  const target = state?.pendingSlideAttackTarget || null;
  if (state) state.pendingSlideAttackTarget = null;
  return target;
}

export function onFingerBiomeRoomEntered(game) {
  const state = game.fingerState?.activeEffects;
  if (!state || game.roomType !== "biome" || state.lastBiomeRewardRoomIndex === game.roomIndex) return;
  state.lastBiomeRewardRoomIndex = game.roomIndex;
  forEachFingerEffect(game, (effect) => {
    if (effect.type !== "special" || effect.effect !== "biomeEntryReward") return;
    applyHealing(game, effect.healAmount || 20);
    addGold(game, effect.goldAmount || 80);
    const playerCenter = centerOf(game.player);
    addPopup(game, playerCenter.x, playerCenter.y - 40, `+${effect.goldAmount || 80}g / +${effect.healAmount || 20} HP`, {
      color: "#facc15",
      strokeColor: "rgba(120, 53, 15, 0.96)"
    });
  });
}
