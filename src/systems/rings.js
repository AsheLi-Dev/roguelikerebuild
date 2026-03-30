import { centerOf, distance } from "../core/runtime-utils.js";
import { getRingDefById, getRingDefsByDropRarity } from "../data/rings.js";

function healPlayer(game, amount) {
  if (amount <= 0) return;
  game.player.hp = Math.min(game.player.maxHp, game.player.hp + amount);
}

function findRingSlotIndex(game, ringId) {
  return game.equippedRings.findIndex((ring) => ring?.ringId === ringId);
}

function removeEquippedRingById(game, ringId) {
  const slotIndex = findRingSlotIndex(game, ringId);
  if (slotIndex < 0) return null;
  const [ring] = game.equippedRings.splice(slotIndex, 1, null);
  return ring || null;
}

function spawnRingDrop(game, ringId, x, y) {
  const ringDef = getRingDefById(ringId);
  if (!ringDef) return false;
  game.ringDrops.push({
    id: `${ringId}_${game.nextRingInstanceId}_${Math.random().toString(36).slice(2, 7)}`,
    ringId,
    x,
    y,
    bobClock: 0,
    spriteCell: ringDef.spriteCell,
    rarity: ringDef.dropRarity
  });
  return true;
}

function pickRandomRingDefByRarity(rarity, random = Math.random) {
  const pool = getRingDefsByDropRarity(rarity);
  if (!pool.length) return null;
  return pool[Math.floor(random() * pool.length)] || null;
}

function rollChestRarity(random = Math.random) {
  const roll = random();
  if (roll < 0.8) return "normal";
  if (roll < 0.95) return "uncommon";
  return "rare";
}

function ensureDerivedPlayerFields(player) {
  player.baseW ??= player.w;
  player.baseH ??= player.h;
  player.baseDrawSize ??= 128;
  player.ringMoveSpeedMult ??= 1;
  player.ringMoveSpeedFlat ??= 0;
  player.ringAttackSpeedMult ??= 1;
  player.ringDamageBonus ??= 0;
  player.ringFlatAttackDamage ??= 0;
  player.ringDefenseBonus ??= 0;
  player.ringMaxHpMult ??= 1;
  player.ringSizeMult ??= 1;
  player.ringDamageReductionFlat ??= 0;
  player.ringDashChargeBonus ??= 0;
  player.ringProjectileHomingRadius ??= 0;
  player.ringProjectileHomingTurnRate ??= 0;
  player.ringProjectileLifetime ??= 0;
}

function gamblerStateFor(game, ring) {
  if (!ring) return null;
  const bucket = game.ringState.gamblerRolls;
  if (!bucket[ring.instanceId]) {
    bucket[ring.instanceId] = {
      damageBonus: Math.random() * 0.5,
      maxHpPenalty: 0.2 + Math.random() * 0.3
    };
  }
  return bucket[ring.instanceId];
}

function equippedRingInstances(game) {
  return game.equippedRings.filter(Boolean);
}

export function createRingState() {
  return {
    timers: {
      momentum: 0,
      vanguard: 0,
      battleRhythm: 0,
      windstep: 0,
      heartOfRenewal: 20,
      echoEngineCooldown: 0
    },
    conquerorKills: 0,
    conquerorDefense: 0,
    standStillTimer: 0,
    sentinelActive: false,
    pendingBasicRepeats: 0,
    suppressMirrorFang: false,
    gamblerRolls: Object.create(null),
    levelHooks: {
      vitality: 0,
      ascendant: 0,
      windstep: 0
    }
  };
}

export function getEquippedRingDefs(game) {
  return equippedRingInstances(game).map((ring) => getRingDefById(ring.ringId)).filter(Boolean);
}

export function countEquippedRings(game, ringId) {
  return equippedRingInstances(game).filter((ring) => ring.ringId === ringId).length;
}

export function hasEquippedRing(game, ringId) {
  return countEquippedRings(game, ringId) > 0;
}

export function getModifiedChestCost(game, baseCost) {
  const locksmithCount = countEquippedRings(game, "ring_locksmith");
  if (!locksmithCount) return Math.max(0, Math.round(baseCost));
  const mult = Math.max(0.2, 1 - locksmithCount * 0.2);
  return Math.max(0, Math.round(baseCost * mult));
}

export function getBreakableGoldMultiplier(game) {
  return 1 + countEquippedRings(game, "ring_demolisher") * 0.2;
}

export function getMaxDashCharges(game) {
  return Math.max(0, game.heroDef.dash.charges + (game.player.ringDashChargeBonus || 0));
}

export function getTotalAttackSpeedMultiplier(game) {
  return Math.max(0.1, (game.player.skillAttackSpeedMult || 1) * (game.player.ringAttackSpeedMult || 1));
}

export function getTotalMoveSpeed(game) {
  return (game.heroDef.moveSpeed * (game.player.skillMoveSpeedMult || 1) * (game.player.ringMoveSpeedMult || 1)) + (game.player.ringMoveSpeedFlat || 0);
}

function estimatedAttackDamage(game) {
  const mult = 1 + (game.player.damageBonus || 0) + (game.player.basicAttackDamageBonus || 0) + (game.player.ringDamageBonus || 0);
  return Math.max(12, Math.round((22 + (game.player.ringFlatAttackDamage || 0)) * mult));
}

function updateHeartOfRenewal(game, dt) {
  const count = countEquippedRings(game, "ring_renewal");
  const timers = game.ringState.timers;
  if (!count) {
    timers.heartOfRenewal = 20;
    return;
  }
  timers.heartOfRenewal -= dt;
  if (timers.heartOfRenewal > 0) return;
  timers.heartOfRenewal += 20;
  healPlayer(game, game.player.maxHp * 0.15 * count);
}

function updateSentinelState(game, dt) {
  const sentinelCount = countEquippedRings(game, "ring_sentinel");
  if (!sentinelCount) {
    game.ringState.standStillTimer = 0;
    game.ringState.sentinelActive = false;
    return;
  }
  const movement = game.player.movement;
  const activelyMoving = !!game.player.isMoving || movement?.dashTimer > 0 || movement?.slideTimer > 0 || movement?.sprintTimer > 0;
  if (activelyMoving) {
    game.ringState.standStillTimer = 0;
    game.ringState.sentinelActive = false;
    return;
  }
  game.ringState.standStillTimer += dt;
  if (game.ringState.standStillTimer >= 2) game.ringState.sentinelActive = true;
}

function updateBasicRepeat(game) {
  const ringState = game.ringState;
  if (ringState.pendingBasicRepeats <= 0) return;
  if (game.state !== "running" || game.combat.playerAction || game.combat.attackCooldown > 0) return;
  ringState.pendingBasicRepeats -= 1;
  ringState.suppressMirrorFang = true;
  game.combat.attackCooldown = 0;
  if (game.tryHeroAttack?.()) {
    ringState.suppressMirrorFang = false;
    return;
  }
  ringState.suppressMirrorFang = false;
}

function updateProjectileBonuses(game) {
  const seekerCount = countEquippedRings(game, "ring_seeker");
  game.player.ringProjectileHomingRadius = seekerCount > 0 ? 280 + seekerCount * 40 : 0;
  game.player.ringProjectileHomingTurnRate = seekerCount > 0 ? 6 + seekerCount * 1.5 : 0;
  game.player.ringProjectileLifetime = seekerCount > 0 ? 3 : 0;
}

function updateSkillChargeBonuses(game) {
  const slots = game.combat.skillRuntime?.slots || [];
  const firstSlot = slots[0];
  if (!firstSlot) return;
  const focusCount = countEquippedRings(game, "ring_focus");
  const previousMaxCharges = firstSlot.maxCharges || 0;
  firstSlot.maxCharges = (firstSlot.baseMaxCharges || 0) + focusCount;
  if (firstSlot.maxCharges <= 0) {
    firstSlot.maxCharges = 0;
    firstSlot.charges = 0;
    return;
  }
  if (firstSlot.maxCharges > previousMaxCharges) {
    firstSlot.charges = Math.min(firstSlot.maxCharges, firstSlot.charges + (firstSlot.maxCharges - previousMaxCharges));
  }
  firstSlot.charges = Math.min(firstSlot.charges, firstSlot.maxCharges);
}

function applyDerivedPlayerStats(game) {
  const player = game.player;
  ensureDerivedPlayerFields(player);

  const defense = game.ringState.conquerorDefense;
  const armorerCount = countEquippedRings(game, "ring_armorers_grace");
  const featherstepCount = countEquippedRings(game, "ring_featherstep");
  const windrunnerCount = countEquippedRings(game, "ring_windrunner");
  const titanCount = countEquippedRings(game, "ring_titan");
  const bastionCount = countEquippedRings(game, "ring_bastion");
  const stoneWardCount = countEquippedRings(game, "ring_stone_ward");
  const ascendantStacks = game.ringState.levelHooks.ascendant;
  const windstepStacks = game.ringState.levelHooks.windstep;
  const gamblerInstances = equippedRingInstances(game).filter((ring) => ring.ringId === "ring_gambler");

  let moveSpeedMult = 1;
  let moveSpeedFlat = 0;
  let attackSpeedMult = 1;
  let damageBonus = ascendantStacks * 0.05;
  let flatAttackDamage = 0;
  let maxHpMult = 1 + titanCount * 0.3;
  let sizeMult = 1 + titanCount * 0.3;

  if (armorerCount > 0) moveSpeedFlat += Math.floor(defense / 2) * armorerCount;
  if (featherstepCount > 0 && equippedRingInstances(game).length <= 4) moveSpeedMult += 0.2 * featherstepCount;
  if (game.ringState.timers.momentum > 0) moveSpeedMult += 0.2 * countEquippedRings(game, "ring_momentum");
  if (game.ringState.timers.vanguard > 0) {
    moveSpeedMult += 0.2 * countEquippedRings(game, "ring_vanguard");
    attackSpeedMult += 0.1 * countEquippedRings(game, "ring_vanguard");
  }
  if (game.ringState.timers.battleRhythm > 0) attackSpeedMult += 0.2 * countEquippedRings(game, "ring_battle_rhythm");
  if (game.ringState.timers.windstep > 0 && windstepStacks > 0) moveSpeedMult += 0.4 * windstepStacks;
  if (game.ringState.sentinelActive) {
    attackSpeedMult += 0.2 * countEquippedRings(game, "ring_sentinel");
    damageBonus += 0.2 * countEquippedRings(game, "ring_sentinel");
  }
  if (bastionCount > 0) flatAttackDamage += Math.floor(defense / 3) * bastionCount;

  for (const ring of gamblerInstances) {
    const gambler = gamblerStateFor(game, ring);
    damageBonus += gambler.damageBonus;
    maxHpMult -= gambler.maxHpPenalty;
  }

  maxHpMult = Math.max(0.25, maxHpMult);
  player.ringDefenseBonus = defense;
  player.ringMoveSpeedMult = moveSpeedMult;
  player.ringMoveSpeedFlat = moveSpeedFlat;
  player.ringAttackSpeedMult = attackSpeedMult;
  player.ringDamageBonus = damageBonus;
  player.ringFlatAttackDamage = flatAttackDamage;
  player.ringMaxHpMult = maxHpMult;
  player.ringSizeMult = sizeMult;
  player.ringDamageReductionFlat = stoneWardCount;
  const previousDashBonus = player.ringDashChargeBonus || 0;
  player.ringDashChargeBonus = windrunnerCount;
  if (game.player.movement && player.ringDashChargeBonus > previousDashBonus) {
    const dashDelta = player.ringDashChargeBonus - previousDashBonus;
    game.player.movement.dashCharges = Math.min(getMaxDashCharges(game), game.player.movement.dashCharges + dashDelta);
  }

  const targetMaxHp = Math.max(1, Math.round(game.heroDef.maxHp * player.ringMaxHpMult));
  if (player.maxHp !== targetMaxHp) {
    const hpRatio = player.maxHp > 0 ? player.hp / player.maxHp : 1;
    player.maxHp = targetMaxHp;
    player.hp = Math.min(player.maxHp, Math.max(1, Math.round(player.maxHp * hpRatio)));
  }

  const targetW = Math.max(24, Math.round(player.baseW * player.ringSizeMult));
  const targetH = Math.max(24, Math.round(player.baseH * player.ringSizeMult));
  player.w = targetW;
  player.h = targetH;
}

export function initializeRingRuntime(game) {
  game.ringState = createRingState();
  ensureDerivedPlayerFields(game.player);
  updateProjectileBonuses(game);
  updateSkillChargeBonuses(game);
  applyDerivedPlayerStats(game);
}

export function updateRingRuntime(game, dt) {
  game.ringState ??= createRingState();
  ensureDerivedPlayerFields(game.player);
  const timers = game.ringState.timers;
  timers.momentum = Math.max(0, timers.momentum - dt);
  timers.vanguard = Math.max(0, timers.vanguard - dt);
  timers.battleRhythm = Math.max(0, timers.battleRhythm - dt);
  timers.windstep = Math.max(0, timers.windstep - dt);
  timers.echoEngineCooldown = Math.max(0, timers.echoEngineCooldown - dt);
  updateHeartOfRenewal(game, dt);
  updateSentinelState(game, dt);
  updateProjectileBonuses(game);
  updateSkillChargeBonuses(game);
  applyDerivedPlayerStats(game);
  updateBasicRepeat(game);
}

export function onRingDashUsed(game) {
  if (countEquippedRings(game, "ring_momentum") > 0) {
    game.ringState.timers.momentum = 1;
  }
}

export function modifyIncomingPlayerDamage(game, amount, sourceEnemy = null) {
  let damage = Math.max(0, amount - (game.player.ringDamageReductionFlat || 0));
  const calmingCount = countEquippedRings(game, "ring_calming");
  if (calmingCount > 0 && sourceEnemy && sourceEnemy.enemyTier !== "miniBoss") {
    const playerCenter = centerOf(game.player);
    const enemyCenter = centerOf(sourceEnemy);
    if (distance(playerCenter.x, playerCenter.y, enemyCenter.x, enemyCenter.y) <= 220) {
      damage *= Math.max(0.2, 1 - calmingCount * 0.2);
    }
  }
  return Math.max(0, damage);
}

export function onRingPlayerDamaged(game, sourceEnemy = null) {
  const vanguardCount = countEquippedRings(game, "ring_vanguard");
  if (vanguardCount > 0) game.ringState.timers.vanguard = 5;

  const guardianCount = countEquippedRings(game, "ring_guardian");
  if (guardianCount > 0 && game.player.hp > 0 && game.player.hp / Math.max(1, game.player.maxHp) <= 0.3) {
    const consumed = removeEquippedRingById(game, "ring_guardian");
    if (consumed) {
      game.player.hp = game.player.maxHp;
      return;
    }
  }

  const thornboundCount = countEquippedRings(game, "ring_thornbound");
  if (thornboundCount > 0 && sourceEnemy && !sourceEnemy.dead) {
    const reflected = estimatedAttackDamage(game) * thornboundCount;
    game.damageEnemy(sourceEnemy, reflected, { source: "ring", isDirect: false, bypassRingDamage: true });
  }
}

export function onRingEnemyKilled(game, enemy) {
  const conquerorCount = countEquippedRings(game, "ring_conqueror");
  if (conquerorCount > 0) {
    game.ringState.conquerorKills += 1;
    const maxDefense = 20 * conquerorCount;
    while (game.ringState.conquerorKills >= 10 && game.ringState.conquerorDefense < maxDefense) {
      game.ringState.conquerorKills -= 10;
      game.ringState.conquerorDefense += 1;
    }
  }

  const trophyCount = countEquippedRings(game, "ring_trophy_hunter");
  if (trophyCount > 0 && enemy.enemyTier === "miniBoss") {
    const enemyCenter = centerOf(enemy);
    for (let index = 0; index < trophyCount; index += 1) {
      const rarity = rollChestRarity();
      const ringDef = pickRandomRingDefByRarity(rarity);
      if (!ringDef) continue;
      spawnRingDrop(game, ringDef.ringId, enemyCenter.x + (index - (trophyCount - 1) * 0.5) * 18, enemyCenter.y - 10);
    }
  }
}

export function onRingBreakableDestroyed(game, breakable) {
  const shrapnelCount = countEquippedRings(game, "ring_shrapnel");
  if (!shrapnelCount) return;
  const origin = centerOf(breakable);
  const projectileCount = 10 * shrapnelCount;
  const damage = estimatedAttackDamage(game) * 0.8;
  for (let index = 0; index < projectileCount; index += 1) {
    const angle = (Math.PI * 2 * index) / projectileCount;
    const speed = 540;
    game.combat.playerProjectiles.push({
      x: origin.x,
      y: origin.y,
      radius: 8,
      drawSize: 14,
      damage,
      speed,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      traveled: 0,
      maxRange: 260,
      spriteAsset: null,
      color: "#fbbf24",
      pierce: 0,
      source: "ring",
      hitEnemyIds: new Set()
    });
  }
}

export function modifyOutgoingPlayerDamage(game, enemy, amount, meta = {}) {
  let damage = amount;
  if (!meta.bypassRingDamage) {
    damage += game.player.ringFlatAttackDamage || 0;
    damage *= 1 + (game.player.ringDamageBonus || 0);
    if (countEquippedRings(game, "ring_first_strike") > 0 && enemy.hp >= enemy.maxHp) {
      damage *= 1 + countEquippedRings(game, "ring_first_strike") * 0.5;
    }
    if (countEquippedRings(game, "ring_reaper") > 0 && enemy.maxHp > 0 && enemy.hp / enemy.maxHp <= 0.2) {
      damage *= 1 + countEquippedRings(game, "ring_reaper") * 2;
    }
  }
  if (meta.isDirect && countEquippedRings(game, "ring_executioner") > 0 && enemy.maxHp > 0 && enemy.hp / enemy.maxHp <= 0.15) {
    damage = Math.max(damage, enemy.hp + enemy.maxHp);
  }
  return damage;
}

export function onRingBasicAttackUsed(game) {
  if (game.ringState.suppressMirrorFang) return;
  const mirrorCount = countEquippedRings(game, "ring_mirror_fang");
  for (let index = 0; index < mirrorCount; index += 1) {
    if (Math.random() < 0.1) game.ringState.pendingBasicRepeats += 1;
  }
}

export function onRingBasicAttackHit(game) {
  const echoCount = countEquippedRings(game, "ring_echo_engine");
  if (!echoCount || game.ringState.timers.echoEngineCooldown > 0) return;
  for (let index = 0; index < echoCount; index += 1) {
    if (Math.random() >= 0.1) continue;
    game.tryTriggerSkillProc?.(0, 0.5);
    game.ringState.timers.echoEngineCooldown = 0.4;
    break;
  }
}

export function onRingSkillHit(game, damage) {
  const battleRhythmCount = countEquippedRings(game, "ring_battle_rhythm");
  for (let index = 0; index < battleRhythmCount; index += 1) {
    if (Math.random() < 0.2) game.ringState.timers.battleRhythm = 5;
  }
  const bloodChannelCount = countEquippedRings(game, "ring_blood_channel");
  if (bloodChannelCount > 0 && damage > 0) {
    healPlayer(game, damage * 0.05 * bloodChannelCount);
  }
}

export function onRingSkillCooldownRestored(game, restoredSlotIndex) {
  const medicCount = countEquippedRings(game, "ring_medics");
  if (medicCount > 0) healPlayer(game, 10 * medicCount);

  const arcaneCount = countEquippedRings(game, "ring_arcane_feedback");
  if (!arcaneCount) return;
  const candidates = (game.combat.skillRuntime?.slots || []).filter((slot, index) => index !== restoredSlotIndex && slot.cooldownRemaining > 0);
  if (!candidates.length) return;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  target.cooldownRemaining = Math.max(0, target.cooldownRemaining - 0.2 * arcaneCount);
}

export function onRingLevelUp(game) {
  if (countEquippedRings(game, "ring_vitality") > 0) {
    healPlayer(game, game.player.maxHp * 0.1 * countEquippedRings(game, "ring_vitality"));
  }
  if (countEquippedRings(game, "ring_ascendant") > 0) {
    game.ringState.levelHooks.ascendant += countEquippedRings(game, "ring_ascendant");
  }
  if (countEquippedRings(game, "ring_windstep") > 0) {
    game.ringState.levelHooks.windstep = Math.max(game.ringState.levelHooks.windstep, countEquippedRings(game, "ring_windstep"));
    game.ringState.timers.windstep = 10;
  }
}
