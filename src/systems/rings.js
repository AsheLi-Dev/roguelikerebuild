import { centerOf, distance } from "../core/runtime-utils.js";
import {
  getRingDefById,
  getRingDefsByDropRarity,
  getRingScrapValueByRarity,
  getRingUpgradeCost
} from "../data/rings.js";
import {
  ensurePlayerStats,
  getPlayerBasicAttackDamage,
  getPlayerStat,
  setPlayerStatSource
} from "./player-stats.js";
import { getFingerRingEffectMultiplierForSlot } from "./fingers.js";
import { applyStatusPayload } from "./status-manager.js";

const MAX_RING_SLOTS = 10;

function createOwnedRingRecord(ringId) {
  return {
    ringId,
    currentLevel: 1
  };
}

function createDefaultEffectState() {
  return {
    critAttackSpeedBuffStacks: 0,
    critAttackSpeedBuffTimer: 0,
    critDamageStacks: 0,
    critDamageStacksTimer: 0,
    recoveryOnHitCooldown: 0,
    sprintMomentumBonus: 0,
    sprintMomentumLingerTimer: 0,
    sprintMomentumElapsed: 0,
    healthKillBonus: 0,
    lifestealSurgeTimer: 0,
    lifestealSurgeMultiplier: 1,
    bloodlustTimer: 0,
    bloodlustRemainingExtension: 3,
    bloodlustLifestealAccumulator: 0,
    bloodlustExtraLifesteal: 0,
    shieldAttackProcCooldown: 0,
    counterKnivesCooldown: 0,
    counterBasicCooldown: 0,
    counterInvulnerabilityTimer: 0,
    counterHasteTimer: 0,
    counterSelfTriggerTimer: 4,
    killMomentumTimer: 0,
    killMomentumTimestamps: [],
    shieldBaseCap: 0,
    shieldBonusCap: 0,
    lifestealShieldCap: 0,
    lifestealShieldDecayPerSecond: 0,
    combatCooldownTimer: 0,
    emergencyBarrierAvailable: true,
    dashCritWindowActive: false,
    dashCritWindowCritChance: 0,
    dashCritWindowCritDamage: 0,
    mirrorCloneTimer: 10,
    chaosRebirthUsed: false
  };
}

export function createRingState() {
  return {
    derivedStatsDirty: true,
    sprintActiveLastFrame: false,
    sprintSpeedMultiplier: 1,
    canAttackWhileSliding: false,
    activeEffects: createDefaultEffectState(),
    mirrorClone: null,
    mirrorCloneSequence: 0,
    inventorySelection: null
  };
}

function ensureRingContainers(game) {
  if (!game.ringInventory || typeof game.ringInventory !== "object" || Array.isArray(game.ringInventory)) {
    game.ringInventory = {
      owned: Object.create(null),
      essence: 0
    };
  }
  game.ringInventory.owned ||= Object.create(null);
  game.ringInventory.essence = Math.max(0, Math.floor(game.ringInventory.essence || 0));
  if (!Array.isArray(game.equippedRings)) {
    game.equippedRings = Array.from({ length: MAX_RING_SLOTS }, () => null);
  } else if (game.equippedRings.length < MAX_RING_SLOTS) {
    while (game.equippedRings.length < MAX_RING_SLOTS) game.equippedRings.push(null);
  }
  game.ringState ??= createRingState();
}

function getOwnedRecord(game, ringId) {
  ensureRingContainers(game);
  return game.ringInventory.owned[String(ringId || "")] || null;
}

function getEquippedRingIds(game) {
  ensureRingContainers(game);
  return game.equippedRings.filter(Boolean);
}

function getChanceRollCount(game) {
  let lucky = false;
  forEachEquippedEffect(game, (effect) => {
    if (effect.type === "special" && effect.effect === "luckyChance") lucky = true;
  });
  return lucky ? 2 : 1;
}

export function hasLuckyRing(game) {
  return getChanceRollCount(game) > 1;
}

export function rollLuckyChance(game, chance, random = Math.random) {
  const clampedChance = Math.max(0, Math.min(1, Number(chance) || 0));
  if (clampedChance <= 0) return false;
  if (clampedChance >= 1) return true;
  const rolls = getChanceRollCount(game);
  for (let index = 0; index < rolls; index += 1) {
    if (random() < clampedChance) return true;
  }
  return false;
}

function scaleEffect(effect, multiplier = 1) {
  if (multiplier === 1) return effect;
  const next = { ...effect };
  for (const [key, value] of Object.entries(next)) {
    if (!Number.isFinite(value)) continue;
    if (
      key === "value" ||
      key === "amount" ||
      key === "healRatio" ||
      key === "gain" ||
      key === "maxBonus" ||
      key === "perEnemy" ||
      key === "perTenPercent" ||
      key === "damagePerStack" ||
      key === "attackSpeedBonus" ||
      key === "sprintSpeedBonus" ||
      key === "moveSpeedBonus" ||
      key === "lifestealBonus" ||
      key === "baseShield" ||
      key === "shield" ||
      key === "maxBonusShield" ||
      key === "knockback" ||
      key === "damageRatio" ||
      key === "critDamageBonus" ||
      key === "critChanceBonus"
    ) {
      next[key] = value * multiplier;
    }
  }
  return next;
}

function forEachEquippedEffect(game, callback) {
  ensureRingContainers(game);
  game.equippedRings.forEach((ringId, slotIndex) => {
    if (!ringId) return;
    const def = getRingDefById(ringId);
    const owned = getOwnedRecord(game, ringId);
    if (!def || !owned) return;
    const effectMultiplier = getFingerRingEffectMultiplierForSlot(game, slotIndex);
    const levelCount = Math.max(1, Math.min(def.maxLevel || 5, owned.currentLevel || 1));
    for (let index = 0; index < levelCount; index += 1) {
      const levelDef = def.levels?.[index];
      if (!levelDef?.effects?.length) continue;
      for (const effect of levelDef.effects) callback(scaleEffect(effect, effectMultiplier), def, owned, index + 1, { slotIndex, effectMultiplier });
    }
  });
}

function applyHealing(game, amount, options = {}) {
  const rawAmount = Number(amount) || 0;
  if (rawAmount <= 0) return { healed: 0, excess: 0 };
  const healingMult = options.ignoreHealingEffectiveness ? 1 : getPlayerStat(game.player, "healingEffectiveness");
  const actualAmount = Math.max(0, rawAmount * healingMult);
  const previousHp = game.player.hp;
  game.player.hp = Math.min(game.player.maxHp, game.player.hp + actualAmount);
  const healed = Math.max(0, game.player.hp - previousHp);
  return { healed, excess: Math.max(0, actualAmount - healed) };
}

function addShield(game, amount, options = {}) {
  const value = Math.max(0, Number(amount) || 0);
  if (value <= 0) return 0;
  const previous = Math.max(0, game.player.damageShield || 0);
  const cap = Number.isFinite(options.cap) ? Math.max(0, options.cap) : Infinity;
  const next = Math.min(cap, previous + value);
  game.player.damageShield = next;
  return Math.max(0, next - previous);
}

function getNearbyEnemies(game, radius = 180, origin = null) {
  const center = origin || centerOf(game.player);
  return (game.getLivingEnemies?.() || game.enemies || []).filter((enemy) => {
    const enemyCenter = centerOf(enemy);
    return distance(center.x, center.y, enemyCenter.x, enemyCenter.y) <= radius;
  });
}

function markCombatActive(game, duration = 2) {
  game.ringState.activeEffects.combatCooldownTimer = Math.max(game.ringState.activeEffects.combatCooldownTimer, duration);
}

function getCurrentMaxShield(game) {
  const state = game.ringState.activeEffects;
  return Math.max(0, state.shieldBaseCap + state.shieldBonusCap + state.lifestealShieldCap + 50);
}

function getNearbyBleedingEnemies(game, radius = 180) {
  return getNearbyEnemies(game, radius).filter((enemy) => (enemy.state?.bleedTimer || 0) > 0 && (enemy.state?.bleedStacks || 0) > 0).length;
}

function applySpecialStatEffect(game, effect, aggregate) {
  if (!effect || effect.type !== "special") return;
  switch (effect.effect) {
    case "nearbyBleedingCrit": {
      const nearby = getNearbyBleedingEnemies(game, effect.radius || 180);
      const bonus = Math.min(effect.maxBonus || 0, nearby * (effect.perEnemy || 0));
      aggregate.critChance.add += bonus;
      break;
    }
    case "missingHpDamage": {
      const hpRatio = game.player.maxHp > 0 ? game.player.hp / game.player.maxHp : 1;
      const missingRatio = Math.max(0, 1 - hpRatio);
      const steps = Math.floor(missingRatio / 0.1);
      const bonus = Math.min(effect.maxBonus || 0, steps * (effect.perTenPercent || 0));
      aggregate.outgoingDamage.mult *= 1 + bonus;
      break;
    }
    case "crowdPower": {
      const nearbyCount = getNearbyEnemies(game, effect.radius || 180).length;
      if (nearbyCount >= (effect.nearbyRequired || 5)) {
        aggregate.outgoingDamage.mult *= 1 + (effect.damageBonus || 0);
        aggregate.damageTaken.mult *= 1 - (effect.damageReduction || 0);
      }
      break;
    }
    case "sprintSpeed":
    case "sprintMomentum":
    case "slideAttackUnlock":
    case "critAttackSpeedBuff":
    case "critDamageStacks":
    case "critBleed":
    case "killMaxHp":
    case "healOnKill":
    case "healOnHit":
    case "healPreventedDamage":
      break;
    default:
      break;
  }
}

function createAggregate() {
  return {
    moveSpeed: { add: 0, mult: 1 },
    attackSpeed: { add: 0, mult: 1 },
    outgoingDamage: { add: 0, mult: 1 },
    flatAttackDamage: { add: 0, mult: 1 },
    maxHp: { add: 0, mult: 1 },
    critChance: { add: 0, mult: 1 },
    critDamage: { add: 0, mult: 1 },
    healingEffectiveness: { add: 0, mult: 1 },
    lifestealRatio: { add: 0, mult: 1 },
    goldGain: { add: 0, mult: 1 },
    pickupRadius: { add: 0, mult: 1 },
    uncommonDropRate: { add: 0, mult: 1 },
    rareDropRate: { add: 0, mult: 1 },
    damageTaken: { add: 0, mult: 1 },
    damageReduction: { add: 0, mult: 1 },
    hpRegenRatio: { add: 0, mult: 1 },
    dashCharges: { add: 0, mult: 1 },
    projectileHomingRadius: { add: 0, mult: 1 },
    projectileHomingTurnRate: { add: 0, mult: 1 },
    projectileLifetime: { add: 0, mult: 1 }
  };
}

function applyStatEffectToAggregate(aggregate, effect) {
  const bucket = aggregate[effect.stat];
  if (!bucket) return;
  switch (effect.op) {
    case "add":
      bucket.add += effect.value || 0;
      break;
    case "multAdd":
      bucket.mult *= 1 + (effect.value || 0);
      break;
    default:
      bucket.add += effect.value || 0;
      break;
  }
}

function applyDerivedPlayerStats(game) {
  ensurePlayerStats(game.player, game.heroDef);
  const aggregate = createAggregate();
  const effectState = game.ringState.activeEffects;
  const previousShieldBaseCap = effectState.shieldBaseCap || 0;
  let sprintSpeedMultiplier = 1;
  let canAttackWhileSliding = false;
  let shieldBaseCap = 0;
  let shieldBonusCap = 0;
  let lifestealShieldCap = 0;
  let lifestealShieldDecayPerSecond = 0;
  let emergencyBarrierFound = false;

  forEachEquippedEffect(game, (effect) => {
    if (effect.type === "stat") {
      applyStatEffectToAggregate(aggregate, effect);
      return;
    }
    applySpecialStatEffect(game, effect, aggregate);
    if (effect.effect === "sprintSpeed") {
      sprintSpeedMultiplier *= 1 + (effect.sprintSpeedBonus || 0);
    }
    if (effect.effect === "slideAttackUnlock" && getCurrentAttackRate(game) > (effect.minimumAttackRate || 2)) {
      canAttackWhileSliding = true;
    }
    if (effect.effect === "shieldCore") {
      shieldBaseCap += effect.baseShield || 0;
    }
    if (effect.effect === "shieldOnAttack") {
      shieldBonusCap += effect.maxBonusShield || 0;
    }
    if (effect.effect === "lifestealOverhealShield") {
      lifestealShieldCap = Math.max(lifestealShieldCap, game.player.maxHp * (effect.maxShieldRatio || 0));
      lifestealShieldDecayPerSecond = Math.max(lifestealShieldDecayPerSecond, game.player.maxHp * (effect.decayPerSecondRatio || 0));
    }
    if (effect.effect === "shieldEmergencyBarrier") {
      emergencyBarrierFound = true;
    }
  });

  if (effectState.critAttackSpeedBuffStacks > 0 && effectState.critAttackSpeedBuffTimer > 0) {
    aggregate.attackSpeed.mult *= 1 + effectState.critAttackSpeedBuffStacks * 0.1;
  }
  if (effectState.critDamageStacks > 0 && effectState.critDamageStacksTimer > 0) {
    aggregate.critDamage.mult *= 1 + effectState.critDamageStacks * 0.1;
  }
  if (effectState.healthKillBonus > 0) {
    aggregate.maxHp.add += effectState.healthKillBonus;
  }
  if (effectState.sprintMomentumBonus > 0) {
    sprintSpeedMultiplier *= 1 + effectState.sprintMomentumBonus;
  }
  if (effectState.lifestealSurgeTimer > 0) {
    aggregate.lifestealRatio.mult *= effectState.lifestealSurgeMultiplier || 1;
  }
  if (effectState.bloodlustTimer > 0) {
    aggregate.moveSpeed.mult *= 1.2;
    aggregate.attackSpeed.mult *= 1.2;
    aggregate.lifestealRatio.add += 0.1 + (effectState.bloodlustExtraLifesteal || 0);
  }
  if (effectState.counterHasteTimer > 0) {
    aggregate.moveSpeed.mult *= 1.2;
    aggregate.attackSpeed.mult *= 1.2;
  }
  if (effectState.killMomentumTimer > 0) {
    aggregate.moveSpeed.mult *= 1.3;
    aggregate.attackSpeed.mult *= 1.3;
  }
  if (effectState.dashCritWindowActive) {
    aggregate.critChance.add += effectState.dashCritWindowCritChance || 0;
    aggregate.critDamage.mult *= 1 + (effectState.dashCritWindowCritDamage || 0);
  }

  effectState.shieldBaseCap = shieldBaseCap;
  effectState.shieldBonusCap = shieldBonusCap;
  effectState.lifestealShieldCap = lifestealShieldCap;
  effectState.lifestealShieldDecayPerSecond = lifestealShieldDecayPerSecond;
  if (!emergencyBarrierFound) effectState.emergencyBarrierAvailable = false;
  game.ringState.sprintSpeedMultiplier = sprintSpeedMultiplier;
  game.ringState.canAttackWhileSliding = canAttackWhileSliding;

  setPlayerStatSource(game.player, "rings", aggregate);
  if (effectState.shieldBaseCap > previousShieldBaseCap) {
    addShield(game, effectState.shieldBaseCap - previousShieldBaseCap, { cap: getCurrentMaxShield(game) });
  }
  game.player.damageShield = Math.min(Math.max(0, game.player.damageShield || 0), getCurrentMaxShield(game));
}

export function markRingDerivedStatsDirty(game) {
  ensureRingContainers(game);
  game.ringState.derivedStatsDirty = true;
}

export function refreshRingDerivedStats(game, options = {}) {
  ensureRingContainers(game);
  if (!options.force && !game.ringState.derivedStatsDirty) return false;
  applyDerivedPlayerStats(game);
  game.ringState.derivedStatsDirty = false;
  return true;
}

export function initializeRingRuntime(game) {
  ensureRingContainers(game);
  game.ringState = createRingState();
  refreshRingDerivedStats(game, { force: true });
}

export function getEquippedRingDefs(game) {
  return getEquippedRingIds(game).map((ringId) => getRingDefById(ringId)).filter(Boolean);
}

export function countEquippedRings(game, ringId) {
  return getEquippedRingIds(game).includes(ringId) ? 1 : 0;
}

export function hasEquippedRing(game, ringId) {
  return countEquippedRings(game, ringId) > 0;
}

export function getOwnedRings(game) {
  ensureRingContainers(game);
  return Object.values(game.ringInventory.owned)
    .map((owned) => ({
      ...owned,
      definition: getRingDefById(owned.ringId),
      equipped: hasEquippedRing(game, owned.ringId)
    }))
    .filter((entry) => entry.definition)
    .sort((a, b) => (a.definition.sortOrder || 0) - (b.definition.sortOrder || 0));
}

export function getRingLevel(game, ringId) {
  return getOwnedRecord(game, ringId)?.currentLevel || 0;
}

export function getRingEssence(game) {
  ensureRingContainers(game);
  return game.ringInventory.essence || 0;
}

function ringHasSpecialInventoryUse(def) {
  return !!def?.levels?.some((level) => level?.effects?.some((effect) => effect.type === "special" && effect.effect === "mirrorUpgradeCatalyst"));
}

export function isMirrorCatalystRing(game, ringId) {
  const def = getRingDefById(ringId);
  return !!getOwnedRecord(game, ringId) && ringHasSpecialInventoryUse(def);
}

export function getPendingRingInventorySelection(game) {
  ensureRingContainers(game);
  return game.ringState.inventorySelection || null;
}

export function cancelPendingRingInventorySelection(game) {
  ensureRingContainers(game);
  if (!game.ringState.inventorySelection) return false;
  game.ringState.inventorySelection = null;
  return true;
}

export function canSelectRingForEquip(game, ringId) {
  ensureRingContainers(game);
  return !!getOwnedRecord(game, ringId);
}

export function togglePendingEquipSelection(game, ringId) {
  ensureRingContainers(game);
  if (!canSelectRingForEquip(game, ringId)) return false;
  const current = getPendingRingInventorySelection(game);
  if (current?.type === "equipSlot" && current.ringId === ringId) {
    game.ringState.inventorySelection = null;
    return true;
  }
  game.ringState.inventorySelection = {
    type: "equipSlot",
    ringId
  };
  return true;
}

export function canEquipOwnedRingToSlot(game, ringId, slotIndex) {
  ensureRingContainers(game);
  if (!getOwnedRecord(game, ringId)) return false;
  if (slotIndex < 0 || slotIndex >= game.equippedRings.length) return false;
  if (slotIndex >= Math.min(game.equippedRings.length, Math.max(0, Math.floor(game.player.numberOfFingers || 0)))) return false;
  return true;
}

export function equipOwnedRingToSlot(game, ringId, slotIndex) {
  ensureRingContainers(game);
  if (!canEquipOwnedRingToSlot(game, ringId, slotIndex)) return false;
  const currentSlot = game.equippedRings.findIndex((id) => id === ringId);
  const displacedRingId = game.equippedRings[slotIndex] || null;
  if (currentSlot === slotIndex) {
    game.ringState.inventorySelection = null;
    return true;
  }
  if (currentSlot >= 0) {
    game.equippedRings[currentSlot] = displacedRingId;
  }
  game.equippedRings[slotIndex] = ringId;
  if (currentSlot < 0 && displacedRingId) {
    // displaced ring remains owned but is now unequipped
  }
  game.ringState.inventorySelection = null;
  markRingDerivedStatsDirty(game);
  return true;
}

export function toggleMirrorCatalystSelection(game, ringId) {
  ensureRingContainers(game);
  if (!isMirrorCatalystRing(game, ringId)) return false;
  const current = getPendingRingInventorySelection(game);
  if (current?.type === "mirrorUpgrade" && current.sourceRingId === ringId) {
    game.ringState.inventorySelection = null;
    return true;
  }
  game.ringState.inventorySelection = {
    type: "mirrorUpgrade",
    sourceRingId: ringId
  };
  return true;
}

export function canApplyMirrorUpgradeToRing(game, ringId) {
  ensureRingContainers(game);
  const selection = getPendingRingInventorySelection(game);
  if (selection?.type !== "mirrorUpgrade") return false;
  if (ringId === selection.sourceRingId) return false;
  const owned = getOwnedRecord(game, ringId);
  const def = getRingDefById(ringId);
  if (!owned || !def) return false;
  if (def.dropRarity === "rare") return false;
  if (owned.currentLevel >= (def.maxLevel || 5)) return false;
  return true;
}

export function applyMirrorUpgradeToRing(game, ringId) {
  ensureRingContainers(game);
  const selection = getPendingRingInventorySelection(game);
  if (selection?.type !== "mirrorUpgrade") return false;
  const sourceOwned = getOwnedRecord(game, selection.sourceRingId);
  if (!sourceOwned) {
    game.ringState.inventorySelection = null;
    return false;
  }
  if (!canApplyMirrorUpgradeToRing(game, ringId)) return false;
  const targetOwned = getOwnedRecord(game, ringId);
  const targetDef = getRingDefById(ringId);
  if (!targetOwned || !targetDef) return false;
  targetOwned.currentLevel = Math.min(targetDef.maxLevel || 5, targetOwned.currentLevel + 1);
  const equippedIndex = game.equippedRings.findIndex((id) => id === selection.sourceRingId);
  if (equippedIndex >= 0) game.equippedRings[equippedIndex] = null;
  delete game.ringInventory.owned[selection.sourceRingId];
  game.ringState.inventorySelection = null;
  markRingDerivedStatsDirty(game);
  return true;
}

export function addRing(game, ringId) {
  ensureRingContainers(game);
  const def = getRingDefById(ringId);
  if (!def) return null;
  let owned = getOwnedRecord(game, ringId);
  if (!owned) {
    owned = createOwnedRingRecord(ringId);
    game.ringInventory.owned[ringId] = owned;
    markRingDerivedStatsDirty(game);
    return { addedNew: true, upgraded: false, level: owned.currentLevel, ringId };
  }
  if (owned.currentLevel < (def.maxLevel || 5)) {
    owned.currentLevel += 1;
    markRingDerivedStatsDirty(game);
    return { addedNew: false, upgraded: true, level: owned.currentLevel, ringId };
  }
  return { addedNew: false, upgraded: false, level: owned.currentLevel, ringId };
}

export function upgradeRing(game, ringId) {
  ensureRingContainers(game);
  const def = getRingDefById(ringId);
  const owned = getOwnedRecord(game, ringId);
  if (!def || !owned) return false;
  if (owned.currentLevel >= (def.maxLevel || 5)) return false;
  const cost = getRingUpgradeCost(owned.currentLevel);
  if (game.ringInventory.essence < cost) return false;
  game.ringInventory.essence -= cost;
  owned.currentLevel += 1;
  markRingDerivedStatsDirty(game);
  return true;
}

export function scrapRing(game, ringId) {
  ensureRingContainers(game);
  const owned = getOwnedRecord(game, ringId);
  const def = getRingDefById(ringId);
  if (!owned || !def) return false;
  const selection = getPendingRingInventorySelection(game);
  if (selection?.sourceRingId === ringId) {
    game.ringState.inventorySelection = null;
  }
  const equippedIndex = game.equippedRings.findIndex((id) => id === ringId);
  if (equippedIndex >= 0) game.equippedRings[equippedIndex] = null;
  game.ringInventory.essence += getRingScrapValueByRarity(def.dropRarity);
  delete game.ringInventory.owned[ringId];
  markRingDerivedStatsDirty(game);
  return true;
}

export function equipOwnedRing(game, ringId) {
  ensureRingContainers(game);
  if (!getOwnedRecord(game, ringId)) return false;
  if (hasEquippedRing(game, ringId)) return true;
  const availableSlots = Math.min(game.equippedRings.length, Math.max(0, Math.floor(game.player.numberOfFingers || 0)));
  const slotIndex = game.equippedRings.findIndex((entry, index) => index < availableSlots && entry == null);
  if (slotIndex < 0) return false;
  game.equippedRings[slotIndex] = ringId;
  markRingDerivedStatsDirty(game);
  return true;
}

export function unequipRingBySlot(game, slotIndex) {
  ensureRingContainers(game);
  if (slotIndex < 0 || slotIndex >= game.equippedRings.length) return false;
  if (!game.equippedRings[slotIndex]) return false;
  game.equippedRings[slotIndex] = null;
  markRingDerivedStatsDirty(game);
  return true;
}

function getNearestEnemy(game) {
  const playerCenter = centerOf(game.player);
  let nearest = null;
  let nearestDistance = Infinity;
  for (const enemy of game.getLivingEnemies?.() || game.enemies || []) {
    const enemyCenter = centerOf(enemy);
    const dist = distance(playerCenter.x, playerCenter.y, enemyCenter.x, enemyCenter.y);
    if (dist >= nearestDistance) continue;
    nearest = enemy;
    nearestDistance = dist;
  }
  return nearest;
}

function spawnCounterKnives(game, effectiveness = 1) {
  const projectileCount = 8;
  for (let index = 0; index < projectileCount; index += 1) {
    spawnDaggerKnife(game, {
      dir: { x: 1, y: 0 },
      angleOffsetDeg: (360 / projectileCount) * index,
      damageScale: 0.5 * effectiveness,
      chainDepth: 99
    });
  }
}

function getDaggerKnifeConfig(game) {
  const config = {
    chance: 0,
    chainChance: 0,
    damagePerSecond: 0,
    maxRampBonus: 0,
    homingRadius: 0,
    homingTurnRate: 0,
    collisionExplosionDamageRatio: 0,
    collisionExplosionRadius: 0
  };
  forEachEquippedEffect(game, (effect) => {
    if (effect.type !== "special") return;
    if (effect.effect === "daggerKnifeProc") config.chance = Math.max(config.chance, effect.chance || 0);
    if (effect.effect === "daggerKnifeChain") config.chainChance = Math.max(config.chainChance, effect.chance || 0);
    if (effect.effect === "daggerKnifeRamp") {
      config.damagePerSecond = Math.max(config.damagePerSecond, effect.damagePerSecond || 0);
      config.maxRampBonus = Math.max(config.maxRampBonus, effect.maxBonus || 0);
    }
    if (effect.effect === "daggerKnifeHoming") {
      config.homingRadius = Math.max(config.homingRadius, effect.homingRadius || 0);
      config.homingTurnRate = Math.max(config.homingTurnRate, effect.homingTurnRate || 0);
    }
    if (effect.effect === "daggerKnifeCollisionExplosion") {
      config.collisionExplosionDamageRatio = Math.max(config.collisionExplosionDamageRatio, effect.damageRatio || 0);
      config.collisionExplosionRadius = Math.max(config.collisionExplosionRadius, effect.radius || 0);
    }
  });
  return config;
}

function getPhantomKnifeConfig(game) {
  const config = {
    enabled: false,
    pierce: 0,
    speedMultiplier: 1,
    rangeMultiplier: 1
  };
  forEachEquippedEffect(game, (effect) => {
    if (effect.type !== "special" || effect.effect !== "phantomKnife") return;
    config.enabled = true;
    config.pierce = Math.max(config.pierce, effect.pierce || 0);
    config.speedMultiplier = Math.max(config.speedMultiplier, effect.speedMultiplier || 1);
    config.rangeMultiplier = Math.max(config.rangeMultiplier, effect.rangeMultiplier || 1);
  });
  return config;
}

export function applyRingKnifeModifiers(game, projectile) {
  if (!projectile || projectile.projectileClass !== "knife") return projectile;
  const config = getPhantomKnifeConfig(game);
  if (!config.enabled) return projectile;
  projectile.pierce = Math.max(projectile.pierce ?? 0, config.pierce || 5);
  projectile.maxRange = Math.max(projectile.maxRange || 0, (projectile.maxRange || 700) * (config.rangeMultiplier || 1));
  const speedMultiplier = Math.max(1, config.speedMultiplier || 1);
  projectile.speed *= speedMultiplier;
  projectile.vx *= speedMultiplier;
  projectile.vy *= speedMultiplier;
  return projectile;
}

function getAttackAimDirection(game) {
  const center = centerOf(game.player);
  const aim = game.input?.getAimWorld?.(game.camera);
  if (aim) {
    const dx = aim.x - center.x;
    const dy = aim.y - center.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  }
  const facing = game.player.facing || "right";
  return facing === "left"
    ? { x: -1, y: 0 }
    : facing === "up"
      ? { x: 0, y: -1 }
      : facing === "down"
        ? { x: 0, y: 1 }
        : { x: 1, y: 0 };
}

function tryHitMirrorCloneWithBasicAttack(game) {
  const clone = getMirrorClone(game);
  if (!clone) return false;
  const playerCenter = centerOf(game.player);
  const cloneCenter = centerOf(clone);
  const dx = cloneCenter.x - playerCenter.x;
  const dy = cloneCenter.y - playerCenter.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (dist > 108) return false;
  const aim = getAttackAimDirection(game);
  const alignment = ((dx / dist) * aim.x) + ((dy / dist) * aim.y);
  if (alignment < 0.45) return false;
  return damageMirrorClone(game, getEstimatedRingDamage(game), { source: "basic" });
}

function spawnDaggerKnife(game, options = {}) {
  const config = getDaggerKnifeConfig(game);
  const dir = options.dir || getAttackAimDirection(game);
  const angle = Math.atan2(dir.y, dir.x) + ((options.angleOffsetDeg || 0) * Math.PI) / 180;
  const speed = 520;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  const baseDamage = Math.max(1, getEstimatedRingDamage(game) * (options.damageScale || 1));
  const projectile = {
    x: centerOf(game.player).x,
    y: centerOf(game.player).y,
    radius: 9,
    drawSize: 22,
    damage: baseDamage,
    baseDamage,
    speed,
    vx,
    vy,
    traveled: 0,
    maxRange: 700,
    color: "#fca5a5",
    pierce: 2,
    bounceOnWall: true,
    projectileClass: "knife",
    source: "ring",
    isDirect: false,
    hitEnemyIds: new Set(),
    homingRadius: config.homingRadius || 0,
    homingTurnRate: config.homingTurnRate || 0,
    ringKnife: true,
    ringKnifeRampPerSecond: config.damagePerSecond || 0,
    ringKnifeRampMaxBonus: config.maxRampBonus || 0,
    ringKnifeCollisionExplosion: config.collisionExplosionDamageRatio > 0,
    ringKnifeCollisionExplosionDamageRatio: config.collisionExplosionDamageRatio || 0,
    ringKnifeCollisionExplosionRadius: config.collisionExplosionRadius || 0,
    onUpdate: (_runtimeGame, projectileRef, dt) => {
      if ((projectileRef.ringKnifeRampPerSecond || 0) > 0) {
        const age = (projectileRef.age || 0) + dt;
        const bonus = Math.min(projectileRef.ringKnifeRampMaxBonus || 0, age * (projectileRef.ringKnifeRampPerSecond || 0));
        projectileRef.damage = projectileRef.baseDamage * (1 + bonus);
      }
    }
  };
  applyRingKnifeModifiers(game, projectile);
  game.combat.playerProjectiles.push(projectile);

  if ((config.chainChance || 0) > 0 && (options.chainDepth || 0) < 6 && rollLuckyChance(game, config.chainChance)) {
    spawnDaggerKnife(game, {
      dir: { x: Math.cos(angle), y: Math.sin(angle) },
      angleOffsetDeg: (Math.random() * 18) - 9,
      chainDepth: (options.chainDepth || 0) + 1
    });
  }
}

function applyShieldBreakShockwave(game, radius = 120, knockback = 56) {
  const origin = centerOf(game.player);
  for (const enemy of game.getLivingEnemies?.() || game.enemies || []) {
    const enemyCenter = centerOf(enemy);
    const dist = distance(origin.x, origin.y, enemyCenter.x, enemyCenter.y);
    if (dist > radius) continue;
    const dirX = dist > 0.001 ? (enemyCenter.x - origin.x) / dist : 1;
    const dirY = dist > 0.001 ? (enemyCenter.y - origin.y) / dist : 0;
    enemy.x += dirX * knockback;
    enemy.y += dirY * knockback;
    enemy.hitTimer = Math.max(enemy.hitTimer || 0, 0.12);
  }
  game.combat.enemyProjectiles = (game.combat.enemyProjectiles || []).filter((projectile) => distance(origin.x, origin.y, projectile.x, projectile.y) > radius);
}

function triggerBloodlust(game) {
  const state = game.ringState.activeEffects;
  let hpToShieldConfig = null;
  forEachEquippedEffect(game, (effect) => {
    if (effect.type === "special" && effect.effect === "bloodlustHpToShield") hpToShieldConfig = effect;
  });
  state.bloodlustTimer = 3;
  state.bloodlustRemainingExtension = 3;
  state.bloodlustExtraLifesteal = 0;
  if (hpToShieldConfig && game.player.hp > 1) {
    const convertedHp = Math.min(game.player.hp - 1, game.player.hp * (hpToShieldConfig.hpRatio || 0));
    if (convertedHp > 0) {
      game.player.hp -= convertedHp;
      addShield(game, convertedHp, { cap: getCurrentMaxShield(game) });
      state.bloodlustExtraLifesteal = Math.min(
        hpToShieldConfig.maxLifestealBonus || 0.15,
        Math.floor(convertedHp / 10) * (hpToShieldConfig.lifestealPerTenHp || 0.01)
      );
    }
  }
  markRingDerivedStatsDirty(game);
}

function handleLifesteal(game, healed, excess) {
  const state = game.ringState.activeEffects;
  if (state.bloodlustTimer > 0 && healed > 0 && state.bloodlustRemainingExtension > 0) {
    const extension = Math.min(state.bloodlustRemainingExtension, 0.5);
    state.bloodlustTimer += extension;
    state.bloodlustRemainingExtension -= extension;
  }

  let bloodlustConfig = null;
  let overhealShieldConfig = null;
  forEachEquippedEffect(game, (effect) => {
    if (effect.type !== "special") return;
    if (effect.effect === "bloodlustLifesteal") bloodlustConfig = effect;
    if (effect.effect === "lifestealOverhealShield") overhealShieldConfig = effect;
  });

  if (bloodlustConfig) {
    state.bloodlustLifestealAccumulator += healed;
    while (state.bloodlustLifestealAccumulator >= (bloodlustConfig.threshold || 50)) {
      state.bloodlustLifestealAccumulator -= bloodlustConfig.threshold || 50;
      triggerBloodlust(game);
    }
  }

  if (overhealShieldConfig && excess > 0) {
    addShield(game, excess, { cap: state.shieldBaseCap + state.shieldBonusCap + state.lifestealShieldCap });
  }
}

function getMirrorCloneConfig(game) {
  let config = null;
  forEachEquippedEffect(game, (effect) => {
    if (effect.type === "special" && effect.effect === "mirrorClone") config = effect;
  });
  return config;
}

export function getMirrorClone(game) {
  const clone = game.ringState?.mirrorClone;
  return clone && clone.hp > 0 ? clone : null;
}

function spawnMirrorClone(game, config) {
  const playerCenter = centerOf(game.player);
  const side = game.ringState.mirrorCloneSequence % 2 === 0 ? 1 : -1;
  game.ringState.mirrorCloneSequence += 1;
  game.ringState.mirrorClone = {
    id: `mirror_clone_${game.ringState.mirrorCloneSequence}`,
    x: playerCenter.x + side * 68 - 14,
    y: playerCenter.y - 14,
    w: 28,
    h: 28,
    hp: Math.max(1, Math.round(game.player.maxHp * (config.hpRatio || 0.5))),
    maxHp: Math.max(1, Math.round(game.player.maxHp * (config.hpRatio || 0.5))),
    orbitAngle: side > 0 ? 0 : Math.PI
  };
}

function updateMirrorClone(game, dt) {
  const config = getMirrorCloneConfig(game);
  if (!config) {
    game.ringState.mirrorClone = null;
    game.ringState.activeEffects.mirrorCloneTimer = 10;
    return;
  }
  const state = game.ringState.activeEffects;
  const clone = getMirrorClone(game);
  if (!clone) {
    state.mirrorCloneTimer = Math.max(0, state.mirrorCloneTimer - dt);
    if (state.mirrorCloneTimer <= 0) {
      spawnMirrorClone(game, config);
      state.mirrorCloneTimer = config.interval || 10;
    }
    return;
  }
  clone.orbitAngle = (clone.orbitAngle || 0) + dt * 1.25;
  const playerCenter = centerOf(game.player);
  const radius = 64;
  clone.x = playerCenter.x + Math.cos(clone.orbitAngle) * radius - clone.w * 0.5;
  clone.y = playerCenter.y + Math.sin(clone.orbitAngle) * radius * 0.65 - clone.h * 0.5;
}

export function damageMirrorClone(game, amount, meta = {}) {
  const clone = getMirrorClone(game);
  if (!clone || (meta.source === "ring" || meta.source === "burn")) return false;
  const damage = Math.max(1, Number(amount) || 0);
  clone.hp = Math.max(0, clone.hp - damage);
  onRingPlayerDamaged(game, null, { effectiveness: meta.effectiveness || 1, mirrorClone: true });
  if (clone.hp <= 0) {
    game.ringState.mirrorClone = null;
    game.ringState.activeEffects.mirrorCloneTimer = getMirrorCloneConfig(game)?.interval || 10;
  }
  return true;
}

function syncDragonLegion(game) {
  const effects = game.combat?.skillRuntime?.effects;
  if (!Array.isArray(effects)) return;
  let dragonConfig = null;
  forEachEquippedEffect(game, (effect) => {
    if (effect.type === "special" && effect.effect === "dragonLegion") dragonConfig = effect;
  });
  const existing = effects.find((effect) => effect.kind === "loyalDragons" && effect.source === "ringDragon");
  if (!dragonConfig) {
    if (existing) existing.elapsed = existing.duration;
    return;
  }
  const dragonCount = Math.max(1, Math.min(dragonConfig.maxDragons || 4, Math.floor(game.player.maxHp / Math.max(1, dragonConfig.hpPerDragon || 100))));
  const contactDamage = Math.max(1, getEstimatedRingDamage(game) * (dragonConfig.contactDamageRatio || 0.35));
  const projectileDamage = Math.max(1, getEstimatedRingDamage(game) * (dragonConfig.projectileDamageRatio || 0.35));
  if (existing) {
    existing.duration = Number.POSITIVE_INFINITY;
    existing.elapsed = 0;
    existing.dragonCount = dragonCount;
    existing.contactDamage = contactDamage;
    existing.projectileDamage = projectileDamage;
    return;
  }
  effects.push({
    kind: "loyalDragons",
    source: "ringDragon",
    duration: Number.POSITIVE_INFINITY,
    elapsed: 0,
    orbitAngle: 0,
    orbitRadius: 82,
    contactDamage,
    projectileDamage,
    projectileCooldown: 0,
    autoFireCooldown: 0,
    hitCooldowns: {},
    dragonPositions: [],
    dragonCount,
    color: "#fb923c"
  });
}

function rerollOwnedRingsByRarity(game, random = Math.random) {
  const nextOwned = Object.create(null);
  const equippedCount = game.equippedRings.filter(Boolean).length;
  const oldEntries = Object.values(game.ringInventory.owned || {});
  const transformedIds = [];
  for (const entry of oldEntries) {
    const currentDef = getRingDefById(entry.ringId);
    if (!currentDef) continue;
    const pool = getRingDefsByDropRarity(currentDef.dropRarity).filter((candidate) => candidate.ringId !== currentDef.ringId);
    const target = pool.length
      ? pool[Math.floor(random() * pool.length)]
      : currentDef;
    const existing = nextOwned[target.ringId] || createOwnedRingRecord(target.ringId);
    existing.currentLevel = Math.min(target.maxLevel || 5, Math.max(existing.currentLevel || 1, (existing.currentLevel || 1) + Math.max(0, (entry.currentLevel || 1) - 1)));
    nextOwned[target.ringId] = existing;
    transformedIds.push(target.ringId);
  }
  game.ringInventory.owned = nextOwned;
  game.equippedRings = Array.from({ length: MAX_RING_SLOTS }, () => null);
  const availableSlots = Math.min(MAX_RING_SLOTS, Math.max(0, Math.floor(game.player.numberOfFingers || 0)));
  let equipIndex = 0;
  for (const ringId of transformedIds) {
    if (!nextOwned[ringId]) continue;
    if (game.equippedRings.includes(ringId)) continue;
    if (equipIndex >= Math.min(equippedCount, availableSlots)) break;
    game.equippedRings[equipIndex] = ringId;
    equipIndex += 1;
  }
}

export function tryChaosRebirth(game) {
  let config = null;
  forEachEquippedEffect(game, (effect) => {
    if (effect.type === "special" && effect.effect === "chaosRebirth") config = effect;
  });
  const state = game.ringState.activeEffects;
  if (!config || state.chaosRebirthUsed) return false;
  state.chaosRebirthUsed = true;
  game.player.hp = Math.max(1, Math.round(game.player.maxHp * (config.healRatio || 0.5)));
  rerollOwnedRingsByRarity(game);
  markRingDerivedStatsDirty(game);
  refreshRingDerivedStats(game, { force: true });
  return true;
}

function updateTimedEffects(game, dt) {
  const state = game.ringState.activeEffects;
  state.critAttackSpeedBuffTimer = Math.max(0, state.critAttackSpeedBuffTimer - dt);
  if (state.critAttackSpeedBuffTimer <= 0) state.critAttackSpeedBuffStacks = 0;
  state.critDamageStacksTimer = Math.max(0, state.critDamageStacksTimer - dt);
  if (state.critDamageStacksTimer <= 0) state.critDamageStacks = 0;
  state.recoveryOnHitCooldown = Math.max(0, state.recoveryOnHitCooldown - dt);
  state.sprintMomentumLingerTimer = Math.max(0, state.sprintMomentumLingerTimer - dt);
  if (state.sprintMomentumLingerTimer <= 0 && !game.ringState.sprintActiveLastFrame) {
    state.sprintMomentumBonus = 0;
  }
  state.lifestealSurgeTimer = Math.max(0, state.lifestealSurgeTimer - dt);
  if (state.lifestealSurgeTimer <= 0) state.lifestealSurgeMultiplier = 1;
  state.bloodlustTimer = Math.max(0, state.bloodlustTimer - dt);
  if (state.bloodlustTimer <= 0) state.bloodlustExtraLifesteal = 0;
  state.shieldAttackProcCooldown = Math.max(0, state.shieldAttackProcCooldown - dt);
  state.counterKnivesCooldown = Math.max(0, state.counterKnivesCooldown - dt);
  state.counterBasicCooldown = Math.max(0, state.counterBasicCooldown - dt);
  state.counterInvulnerabilityTimer = Math.max(0, state.counterInvulnerabilityTimer - dt);
  state.counterHasteTimer = Math.max(0, state.counterHasteTimer - dt);
  state.counterSelfTriggerTimer = Math.max(0, state.counterSelfTriggerTimer - dt);
  state.killMomentumTimer = Math.max(0, state.killMomentumTimer - dt);
  state.combatCooldownTimer = Math.max(0, state.combatCooldownTimer - dt);
}

function updateSprintMomentum(game, dt) {
  const movement = game.player?.movement;
  const effectState = game.ringState.activeEffects;
  const sprinting = !!movement && movement.sprintTimer > 0;
  let momentumConfig = null;

  forEachEquippedEffect(game, (effect) => {
    if (effect.type === "special" && effect.effect === "sprintMomentum") {
      momentumConfig = effect;
    }
  });

  if (!momentumConfig) {
    effectState.sprintMomentumBonus = 0;
    effectState.sprintMomentumElapsed = 0;
    effectState.sprintMomentumLingerTimer = 0;
    game.ringState.sprintActiveLastFrame = sprinting;
    return;
  }

  if (sprinting) {
    effectState.sprintMomentumElapsed += dt;
    effectState.sprintMomentumBonus = Math.min(
      momentumConfig.maxBonus || 0,
      effectState.sprintMomentumElapsed * (momentumConfig.perSecond || 0)
    );
    effectState.sprintMomentumLingerTimer = momentumConfig.lingerDuration || 2;
  } else if (game.ringState.sprintActiveLastFrame) {
    effectState.sprintMomentumLingerTimer = momentumConfig.lingerDuration || 2;
    effectState.sprintMomentumElapsed = Math.min(
      effectState.sprintMomentumElapsed,
      (momentumConfig.maxBonus || 0) / Math.max(0.0001, momentumConfig.perSecond || 1)
    );
  } else if (effectState.sprintMomentumLingerTimer <= 0) {
    effectState.sprintMomentumElapsed = 0;
    effectState.sprintMomentumBonus = 0;
  }

  game.ringState.sprintActiveLastFrame = sprinting;
}

function applyPassiveRegen(game, dt) {
  const regenRatio = getPlayerStat(game.player, "hpRegenRatio");
  if (regenRatio > 0 && game.player.hp > 0) {
    applyHealing(game, game.player.maxHp * regenRatio * dt);
  }
  const state = game.ringState.activeEffects;
  if (state.shieldBaseCap > 0 && state.combatCooldownTimer <= 0) {
    addShield(game, 10 * dt, { cap: state.shieldBaseCap });
  }
  if (state.lifestealShieldDecayPerSecond > 0 && game.player.damageShield > state.shieldBaseCap + state.shieldBonusCap) {
    const floor = state.shieldBaseCap + state.shieldBonusCap;
    game.player.damageShield = Math.max(floor, game.player.damageShield - state.lifestealShieldDecayPerSecond * dt);
  }
}

function updateCounterSelfTrigger(game) {
  const state = game.ringState.activeEffects;
  let config = null;
  forEachEquippedEffect(game, (effect) => {
    if (effect.type === "special" && effect.effect === "counterSelfTrigger") config = effect;
  });
  if (!config) {
    state.counterSelfTriggerTimer = 4;
    return;
  }
  if (state.counterSelfTriggerTimer > 0 || game.state !== "running" || game.player.hp < 2) return;
  game.player.hp = Math.max(1, game.player.hp - Math.max(1, config.selfDamage || 1));
  onRingPlayerDamaged(game, null, { effectiveness: config.effectiveness || 0.5, selfInflicted: true });
  state.counterSelfTriggerTimer = config.interval || 4;
}

export function updateRingRuntime(game, dt) {
  ensureRingContainers(game);
  updateTimedEffects(game, dt);
  updateSprintMomentum(game, dt);
  updateCounterSelfTrigger(game);
  refreshRingDerivedStats(game, { force: true });
  syncDragonLegion(game);
  updateMirrorClone(game, dt);
  applyPassiveRegen(game, dt);
}

export function getModifiedChestCost(_game, baseCost) {
  return Math.max(0, Math.round(baseCost));
}

export function getBreakableGoldMultiplier(game) {
  return 1;
}

export function getMaxDashCharges(game) {
  return Math.max(0, getPlayerStat(game.player, "dashCharges"));
}

export function getCurrentAttackRate(game) {
  return Math.max(0.1, getPlayerStat(game.player, "attackSpeed"));
}

export function getTotalAttackSpeedMultiplier(game) {
  const baseCooldown = game.heroDef?.combat?.cooldown;
  const baseAttackRate = baseCooldown > 0 ? 1 / baseCooldown : 1;
  return Math.max(0.1, getCurrentAttackRate(game) / baseAttackRate);
}

export function getTotalMoveSpeed(game) {
  return getPlayerStat(game.player, "moveSpeed");
}

export function getSprintSpeedMultiplier(game) {
  return Math.max(1, game.ringState?.sprintSpeedMultiplier || 1);
}

export function canAttackWhileSliding(game) {
  return !!game.ringState?.canAttackWhileSliding;
}

export function getGoldPickupRadiusMultiplier(game) {
  return Math.max(1, getPlayerStat(game.player, "pickupRadius"));
}

export function getRingPickupRadiusMultiplier(game) {
  return Math.max(1, getPlayerStat(game.player, "pickupRadius"));
}

export function getDropRateMultiplier(game, rarity) {
  if (rarity === "uncommon") return Math.max(1, getPlayerStat(game.player, "uncommonDropRate"));
  if (rarity === "rare") return Math.max(1, getPlayerStat(game.player, "rareDropRate"));
  return 1;
}

export function onRingDashUsed(game) {
  const state = game.ringState.activeEffects;
  forEachEquippedEffect(game, (effect) => {
    if (effect.type === "special" && effect.effect === "dashCritWindow") {
      state.dashCritWindowActive = true;
      state.dashCritWindowCritChance = effect.critChanceBonus || 0;
      state.dashCritWindowCritDamage = effect.critDamageBonus || 0;
      markRingDerivedStatsDirty(game);
    }
  });
}

export function modifyIncomingPlayerDamage(game, amount, _sourceEnemy = null) {
  const originalAmount = Math.max(0, amount);
  if (game.ringState.activeEffects.counterInvulnerabilityTimer > 0) {
    return { damage: 0, prevented: originalAmount, negateShieldOverflow: false, shieldBreakShockwave: null };
  }
  let damage = Math.max(0, originalAmount - getPlayerStat(game.player, "damageReduction"));
  if (damage > 0) {
    damage *= Math.max(0.05, getPlayerStat(game.player, "damageTaken"));
  }
  if (damage > 0) {
    damage = Math.max(1, damage);
  }
  const prevented = Math.max(0, originalAmount - damage);
  let healRatio = 0;
  forEachEquippedEffect(game, (effect) => {
    if (effect.type === "special" && effect.effect === "healPreventedDamage") {
      healRatio += effect.healRatio || 0;
    }
  });
  if (prevented > 0 && healRatio > 0) applyHealing(game, prevented * healRatio);

  let negateShieldOverflow = false;
  let shieldBreakShockwave = null;
  forEachEquippedEffect(game, (effect) => {
    if (effect.type !== "special") return;
    if (effect.effect === "shieldBreakNegateOverflow") negateShieldOverflow = true;
    if (effect.effect === "shieldBreakShockwave") shieldBreakShockwave = effect;
    if (
      effect.effect === "shieldEmergencyBarrier" &&
      game.ringState.activeEffects.emergencyBarrierAvailable &&
      game.player.hp > game.player.maxHp * (effect.thresholdRatio || 0.2) &&
      game.player.hp - damage < game.player.maxHp * (effect.thresholdRatio || 0.2)
    ) {
      addShield(game, effect.shield || 50, { cap: getCurrentMaxShield(game) });
      game.ringState.activeEffects.emergencyBarrierAvailable = false;
    }
  });

  return { damage, prevented, negateShieldOverflow, shieldBreakShockwave };
}

export function modifyOutgoingPlayerDamage(game, enemy, amount, meta = {}) {
  let damage = amount;
  if (!meta.bypassRingDamage) {
    damage += getPlayerStat(game.player, "flatAttackDamage");
    damage *= getPlayerStat(game.player, "outgoingDamage");
  }
  if (meta.source === "ring" || meta.source === "burn") return damage;
  if (enemy?.maxHp > 0 && enemy.hp >= enemy.maxHp && hasEquippedRing(game, "ring_berserker")) {
    damage = Math.max(damage, amount);
  }
  return damage;
}

function applyCritBleed(enemy, effect) {
  enemy.state ||= {};
  enemy.state.bleedStacks = Math.min(99, (enemy.state.bleedStacks || 0) + (effect.stacks || 1));
  enemy.state.bleedTimer = Math.max(enemy.state.bleedTimer || 0, effect.duration || 3);
  enemy.state.bleedTickTimer = Math.min(enemy.state.bleedTickTimer || 1, 1);
  enemy.state.bleedDamagePerStack = Math.max(enemy.state.bleedDamagePerStack || 0, effect.damagePerStack || 3);
}

function triggerOnCrit(game, enemy) {
  forEachEquippedEffect(game, (effect) => {
    if (effect.type !== "special") return;
    if (effect.effect === "critAttackSpeedBuff") {
      const effectState = game.ringState.activeEffects;
      effectState.critAttackSpeedBuffStacks = Math.min(effect.maxStacks || 3, effectState.critAttackSpeedBuffStacks + 1);
      effectState.critAttackSpeedBuffTimer = Math.max(effectState.critAttackSpeedBuffTimer, effect.duration || 2);
      markRingDerivedStatsDirty(game);
    }
    if (effect.effect === "critBleed" && enemy) {
      applyCritBleed(enemy, effect);
    }
    if (effect.effect === "critDamageStacks") {
      const effectState = game.ringState.activeEffects;
      effectState.critDamageStacks = Math.min(effect.maxStacks || 4, effectState.critDamageStacks + 1);
      effectState.critDamageStacksTimer = Math.max(effectState.critDamageStacksTimer, effect.duration || 2);
      markRingDerivedStatsDirty(game);
    }
  });
  if (game.ringState.activeEffects.dashCritWindowActive) {
    game.ringState.activeEffects.dashCritWindowActive = false;
    game.ringState.activeEffects.dashCritWindowCritChance = 0;
    game.ringState.activeEffects.dashCritWindowCritDamage = 0;
    markRingDerivedStatsDirty(game);
  }
}

function triggerOnAnyHit(game) {
  forEachEquippedEffect(game, (effect) => {
    if (effect.type !== "special") return;
    const effectState = game.ringState.activeEffects;
    if (effect.effect === "healOnHit" && effectState.recoveryOnHitCooldown <= 0) {
      applyHealing(game, effect.amount || 0);
      effectState.recoveryOnHitCooldown = effect.cooldown || 2;
    }
    if (effect.effect === "shieldOnAttack" && effectState.shieldAttackProcCooldown <= 0 && rollLuckyChance(game, effect.chance || 0)) {
      addShield(game, effect.shield || 10, { cap: effectState.shieldBaseCap + effectState.shieldBonusCap });
      effectState.shieldAttackProcCooldown = effect.cooldown || 0.5;
    }
  });
}

export function onRingHit(game, enemy, meta = {}) {
  markCombatActive(game);
  triggerOnAnyHit(game);
  if (meta.isCrit) triggerOnCrit(game, enemy);
  forEachEquippedEffect(game, (effect) => {
    if (
      effect.type === "special" &&
      effect.effect === "attackExplosion" &&
      !meta.noAttackExplosion &&
      meta.source !== "ring" &&
      rollLuckyChance(game, effect.chance || 0)
    ) {
      const origin = centerOf(enemy);
      for (const otherEnemy of game.getLivingEnemies?.() || game.enemies || []) {
        if (otherEnemy === enemy) continue;
        const targetCenter = centerOf(otherEnemy);
        if (distance(origin.x, origin.y, targetCenter.x, targetCenter.y) > (effect.radius || 90)) continue;
        game.damageEnemy(otherEnemy, (meta.damage || 0) * (effect.damageRatio || 0.5), {
          source: "ring",
          isDirect: false,
          noAttackExplosion: true,
          noDeathExplosionChain: true
        });
      }
    }
    if (
      effect.type === "special" &&
      effect.effect === "infernoBurn" &&
      enemy &&
      meta.source !== "burn" &&
      !meta.noInfernoBurn
    ) {
      applyStatusPayload(enemy, {
        burnDuration: effect.duration || 4,
        burnStacks: effect.burnStacks || 1,
        burnDamagePerSecond: Math.max(1, getEstimatedRingDamage(game) * (effect.burnDamageRatio || 0.2))
      });
    }
  });
}

export function onRingPlayerDamaged(game, _sourceEnemy = null, options = {}) {
  markCombatActive(game);
  forEachEquippedEffect(game, (effect) => {
    if (effect.type !== "special") return;
    if (effect.effect === "lifestealSurge") {
      game.ringState.activeEffects.lifestealSurgeTimer = Math.max(game.ringState.activeEffects.lifestealSurgeTimer, effect.duration || 1);
      game.ringState.activeEffects.lifestealSurgeMultiplier = Math.max(game.ringState.activeEffects.lifestealSurgeMultiplier, effect.multiplier || 1.5);
      markRingDerivedStatsDirty(game);
    }
    if (effect.effect === "counterKnives" && game.ringState.activeEffects.counterKnivesCooldown <= 0) {
      spawnCounterKnives(game, options.effectiveness || 1);
      game.ringState.activeEffects.counterKnivesCooldown = effect.cooldown || 2;
    }
    if (effect.effect === "counterBasicStrike" && game.ringState.activeEffects.counterBasicCooldown <= 0) {
      const nearest = getNearestEnemy(game);
      if (nearest) {
        game.damageEnemy(nearest, getEstimatedRingDamage(game) * (options.effectiveness || 1), {
          source: "ring",
          isDirect: true,
          noAttackExplosion: true,
          noDeathExplosionChain: true
        });
        game.ringState.activeEffects.counterBasicCooldown = effect.cooldown || 1;
      }
    }
    if (effect.effect === "counterInvulnerability" && !options.selfInflicted) {
      game.ringState.activeEffects.counterInvulnerabilityTimer = Math.max(game.ringState.activeEffects.counterInvulnerabilityTimer, effect.duration || 0.1);
    }
    if (effect.effect === "counterHaste") {
      game.ringState.activeEffects.counterHasteTimer = Math.max(game.ringState.activeEffects.counterHasteTimer, effect.duration || 2);
      markRingDerivedStatsDirty(game);
    }
  });
}

export function onRingEnemyKilled(game, enemy, options = {}) {
  markCombatActive(game);
  forEachEquippedEffect(game, (effect) => {
    if (effect.type !== "special") return;
    if (effect.effect === "killMaxHp") {
      const effectState = game.ringState.activeEffects;
      effectState.healthKillBonus = Math.min(effect.maxBonus || 30, effectState.healthKillBonus + (effect.gain || 0));
      markRingDerivedStatsDirty(game);
    }
    if (effect.effect === "healOnKill") {
      applyHealing(game, game.player.maxHp * (effect.healRatio || 0));
    }
    if (effect.effect === "deathExplosion" && !options?.meta?.noDeathExplosionChain && rollLuckyChance(game, effect.chance || 0)) {
      const origin = centerOf(enemy);
      for (const otherEnemy of game.getLivingEnemies?.() || game.enemies || []) {
        if (otherEnemy === enemy) continue;
        const targetCenter = centerOf(otherEnemy);
        if (distance(origin.x, origin.y, targetCenter.x, targetCenter.y) > (effect.radius || 100)) continue;
        game.damageEnemy(otherEnemy, getEstimatedRingDamage(game) * (effect.damageRatio || 1), {
          source: "ring",
          isDirect: false,
          noAttackExplosion: true,
          noDeathExplosionChain: true
        });
      }
    }
    if (effect.effect === "infernoBurn" && !options?.meta?.noInfernoExplosion) {
      const burnStacks = Math.max(enemy?.burnStacks || 0, enemy?.state?.burnStacks || 0);
      if (burnStacks > 0) {
        const origin = centerOf(enemy);
        const explosionDamage = getEstimatedRingDamage(game) * burnStacks * (effect.explosionDamageRatioPerStack || 0.3);
        for (const otherEnemy of game.getLivingEnemies?.() || game.enemies || []) {
          if (otherEnemy === enemy) continue;
          const targetCenter = centerOf(otherEnemy);
          if (distance(origin.x, origin.y, targetCenter.x, targetCenter.y) > (effect.explosionRadius || 110)) continue;
          game.damageEnemy(otherEnemy, explosionDamage, {
            source: "ring",
            isDirect: false,
            noAttackExplosion: true,
            noDeathExplosionChain: true,
            noInfernoExplosion: true
          });
        }
      }
    }
    if (effect.effect === "killMomentum") {
      const now = game.time || 0;
      const timestamps = game.ringState.activeEffects.killMomentumTimestamps;
      timestamps.push(now);
      game.ringState.activeEffects.killMomentumTimestamps = timestamps.filter((value) => now - value <= (effect.window || 2));
      if (game.ringState.activeEffects.killMomentumTimestamps.length >= (effect.killsRequired || 5)) {
        game.ringState.activeEffects.killMomentumTimer = Math.max(game.ringState.activeEffects.killMomentumTimer, effect.duration || 2);
        game.ringState.activeEffects.killMomentumTimestamps = [];
        markRingDerivedStatsDirty(game);
      }
    }
  });
}

export function tryReviveEnemyOnKill(game, enemy, meta = {}) {
  if (meta.noDeathExplosionChain || enemy.ringRevivedOnce) return false;
  let reviveConfig = null;
  forEachEquippedEffect(game, (effect) => {
    if (effect.type === "special" && effect.effect === "enemyRevive") reviveConfig = effect;
  });
  if (!reviveConfig || !rollLuckyChance(game, reviveConfig.chance || 0.1)) return false;
  enemy.ringRevivedOnce = true;
  enemy.dead = false;
  enemy.hp = Math.max(1, Math.round(enemy.maxHp * (reviveConfig.hpRatio || 0.05)));
  enemy.showHealthBar = true;
  return true;
}

export function onRingLifesteal(game, healed, excess) {
  if (healed <= 0 && excess <= 0) return;
  markCombatActive(game);
  handleLifesteal(game, healed, excess);
  markRingDerivedStatsDirty(game);
}

export function onRingBreakableDestroyed(_game, _breakable) {}

export function onRingBasicAttackUsed(game) {
  tryHitMirrorCloneWithBasicAttack(game);
  const config = getDaggerKnifeConfig(game);
  if ((config.chance || 0) > 0 && rollLuckyChance(game, config.chance)) {
    spawnDaggerKnife(game);
  }
}

export function onRingBasicAttackHit(game, enemy, meta = {}) {
  onRingHit(game, enemy, meta);
}

export function onRingSkillHit(game, _damage, meta = {}) {
  onRingHit(game, meta.enemy || null, meta);
}

export function onRingSkillCooldownRestored(_game, _restoredSlotIndex) {}

export function onRingLevelUp(_game) {}

export function getEstimatedRingDamage(game) {
  const baseDamage = getPlayerBasicAttackDamage(game.player);
  return Math.max(1, Math.round((baseDamage + getPlayerStat(game.player, "flatAttackDamage")) * getPlayerStat(game.player, "outgoingDamage")));
}

export function pickRandomRingDefByRarity(rarity, random = Math.random) {
  const pool = getRingDefsByDropRarity(rarity);
  if (!pool.length) return null;
  return pool[Math.floor(random() * pool.length)] || null;
}
