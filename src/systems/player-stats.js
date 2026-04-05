const DEFAULT_BASE_STATS = Object.freeze({
  maxHp: 1,
  attack: 20,
  critChance: 0.1,
  critDamage: 1.5,
  moveSpeed: 0,
  attackSpeed: 1,
  globalDamage: 1,
  basicDamage: 1,
  outgoingDamage: 1,
  flatAttackDamage: 0,
  defense: 0,
  size: 1,
  damageReduction: 0,
  damageTaken: 1,
  dashCharges: 0,
  projectileHomingRadius: 0,
  projectileHomingTurnRate: 0,
  projectileLifetime: 0,
  lifestealRatio: 0,
  healingEffectiveness: 1,
  goldGain: 1,
  pickupRadius: 1,
  uncommonDropRate: 1,
  rareDropRate: 1,
  hpRegenRatio: 0,
  lifePotionMaxCharges: 1,
  lifePotionHealRatio: 0.2,
  dotDamageMultiplier: 1,
  nearbyDamageReduction: 0,
  eliteDamage: 1,
  undeadDamageMultiplier: 1,
  sprintSpeedMultiplier: 1,
  projectileDamageReduction: 0,
  sprintDamageReduction: 0
});

const STAT_LIMITS = Object.freeze({
  maxHp: { min: 1, integer: true },
  attack: { min: 0, integer: true },
  critChance: { min: 0 },
  critDamage: { min: 1 },
  moveSpeed: { min: 0 },
  attackSpeed: { min: 0.1 },
  globalDamage: { min: 0 },
  basicDamage: { min: 0 },
  outgoingDamage: { min: 0 },
  flatAttackDamage: { min: 0, integer: true },
  defense: { min: 0, integer: true },
  size: { min: 0.25 },
  damageReduction: { min: 0, integer: true },
  damageTaken: { min: 0.05 },
  dashCharges: { min: 0, integer: true },
  projectileHomingRadius: { min: 0 },
  projectileHomingTurnRate: { min: 0 },
  projectileLifetime: { min: 0 },
  lifestealRatio: { min: 0 },
  healingEffectiveness: { min: 0 },
  goldGain: { min: 0 },
  pickupRadius: { min: 0.25 },
  uncommonDropRate: { min: 0 },
  rareDropRate: { min: 0 },
  hpRegenRatio: { min: 0 },
  lifePotionMaxCharges: { min: 0, integer: true },
  lifePotionHealRatio: { min: 0 },
  dotDamageMultiplier: { min: 0 },
  nearbyDamageReduction: { min: 0, max: 0.9 },
  eliteDamage: { min: 0 },
  undeadDamageMultiplier: { min: 0 },
  sprintSpeedMultiplier: { min: 0 },
  projectileDamageReduction: { min: 0, max: 0.9 },
  sprintDamageReduction: { min: 0, max: 0.9 }
});

function heroBaseStats(heroDef) {
  return {
    ...DEFAULT_BASE_STATS,
    maxHp: heroDef?.maxHp ?? DEFAULT_BASE_STATS.maxHp,
    moveSpeed: heroDef?.moveSpeed ?? DEFAULT_BASE_STATS.moveSpeed,
    attackSpeed: heroDef?.combat?.cooldown > 0 ? 1 / heroDef.combat.cooldown : DEFAULT_BASE_STATS.attackSpeed,
    dashCharges: heroDef?.dash?.charges ?? DEFAULT_BASE_STATS.dashCharges,
    lifePotionMaxCharges: heroDef?.lifePotionMaxCharges ?? DEFAULT_BASE_STATS.lifePotionMaxCharges,
    lifePotionHealRatio: heroDef?.lifePotionHealRatio ?? DEFAULT_BASE_STATS.lifePotionHealRatio
  };
}

function clampStatValue(statId, value) {
  const limits = STAT_LIMITS[statId];
  if (!limits) return value;
  let next = value;
  if (limits.min != null) next = Math.max(limits.min, next);
  if (limits.max != null) next = Math.min(limits.max, next);
  if (limits.integer) next = Math.round(next);
  return next;
}

function normalizeContribution(entry) {
  if (entry == null) return null;
  if (typeof entry === "number") {
    return { add: entry, mult: 1 };
  }
  return {
    add: Number.isFinite(entry.add) ? entry.add : 0,
    mult: Number.isFinite(entry.mult) ? entry.mult : 1
  };
}

function recomputePlayerStats(player) {
  const stats = player.stats;
  const values = {};

  for (const statId of Object.keys(DEFAULT_BASE_STATS)) {
    const base = Number.isFinite(stats.base[statId]) ? stats.base[statId] : DEFAULT_BASE_STATS[statId];
    let add = 0;
    let mult = 1;

    for (const source of Object.values(stats.sources)) {
      const contribution = source?.[statId];
      if (!contribution) continue;
      add += contribution.add ?? 0;
      mult *= contribution.mult ?? 1;
    }

    values[statId] = clampStatValue(statId, (base + add) * mult);
  }

  stats.values = values;
  syncPlayerDerivedState(player);
}

function syncPlayerDerivedState(player) {
  const stats = player.stats.values;
  const previousMaxHp = Number.isFinite(player.maxHp) ? player.maxHp : stats.maxHp;
  const previousHp = Number.isFinite(player.hp) ? player.hp : previousMaxHp;
  const hpRatio = previousMaxHp > 0 ? previousHp / previousMaxHp : 1;
  player.maxHp = stats.maxHp;
  if (previousHp <= 0) {
    player.hp = 0;
  } else {
    player.hp = Math.min(player.maxHp, Math.max(1, Math.round(player.maxHp * hpRatio)));
  }

  player.lifePotionMaxCharges = stats.lifePotionMaxCharges;
  player.lifePotionHealRatio = stats.lifePotionHealRatio;

  player.baseW ??= player.w;
  player.baseH ??= player.h;
  player.baseDrawSize ??= 128;
  player.w = Math.max(24, Math.round(player.baseW * stats.size));
  player.h = Math.max(24, Math.round(player.baseH * stats.size));
}

export function createPlayerStats(heroDef) {
  const stats = {
    base: heroBaseStats(heroDef),
    sources: Object.create(null),
    values: { ...heroBaseStats(heroDef) }
  };
  return stats;
}

export function ensurePlayerStats(player, heroDef) {
  if (!player.stats) {
    player.stats = createPlayerStats(heroDef);
  }
  if (!player.stats.base || !player.stats.sources || !player.stats.values) {
    player.stats = createPlayerStats(heroDef);
  }
  if (heroDef) {
    player.stats.base.maxHp = heroDef.maxHp ?? player.stats.base.maxHp;
    player.stats.base.moveSpeed = heroDef.moveSpeed ?? player.stats.base.moveSpeed;
    player.stats.base.attackSpeed = heroDef.combat?.cooldown > 0 ? 1 / heroDef.combat.cooldown : player.stats.base.attackSpeed;
    player.stats.base.dashCharges = heroDef.dash?.charges ?? player.stats.base.dashCharges;
  }
  recomputePlayerStats(player);
  return player.stats;
}

export function resetPlayerStats(player, heroDef) {
  player.stats = createPlayerStats(heroDef);
  recomputePlayerStats(player);
  return player.stats;
}

export function setPlayerStatSource(player, sourceId, partialStats) {
  const stats = ensurePlayerStats(player);
  const nextSource = {};

  for (const [statId, value] of Object.entries(partialStats || {})) {
    if (!(statId in DEFAULT_BASE_STATS)) continue;
    const normalized = normalizeContribution(value);
    if (!normalized) continue;
    nextSource[statId] = normalized;
  }

  stats.sources[sourceId] = nextSource;
  recomputePlayerStats(player);
  return stats.values;
}

export function clearPlayerStatSource(player, sourceId) {
  const stats = ensurePlayerStats(player);
  delete stats.sources[sourceId];
  recomputePlayerStats(player);
  return stats.values;
}

export function getPlayerStat(player, statId) {
  const stats = ensurePlayerStats(player);
  return stats.values[statId] ?? DEFAULT_BASE_STATS[statId] ?? 0;
}

export function getPlayerGlobalDamageMultiplier(player) {
  return getPlayerStat(player, "globalDamage");
}

export function getPlayerAttackStat(player) {
  return getPlayerStat(player, "attack");
}

export function getPlayerCritChance(player) {
  return getPlayerStat(player, "critChance");
}

export function getPlayerCritDamage(player) {
  return getPlayerStat(player, "critDamage");
}

export function getPlayerBasicDamageMultiplier(player) {
  return getPlayerStat(player, "globalDamage") * getPlayerStat(player, "basicDamage");
}

export function getPlayerBasicAttackDamage(player) {
  return getPlayerAttackStat(player) * getPlayerBasicDamageMultiplier(player);
}

export function getPlayerSkillAttackDamage(player) {
  return getPlayerAttackStat(player) * getPlayerGlobalDamageMultiplier(player);
}
