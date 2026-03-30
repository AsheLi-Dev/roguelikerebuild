const STATUS_TICK_INTERVAL = 1;

function createEmptyStatusState() {
  return {
    slow: {
      timer: 0,
      mult: 1
    },
    stun: {
      timer: 0
    },
    poison: {
      timer: 0,
      tickTimer: 0,
      dps: 0,
      tickInterval: STATUS_TICK_INTERVAL
    },
    curse: {
      timer: 0,
      tickTimer: 0,
      damagePerTick: 2,
      tickInterval: STATUS_TICK_INTERVAL
    }
  };
}

function syncLegacyStatusFields(entity) {
  const status = entity.status;
  entity.enemySlowTimer = status.slow.timer;
  entity.enemySlowMult = status.slow.mult;
  entity.stunTimer = status.stun.timer;
  entity.poisonTimer = status.poison.timer;
  entity.poisonTickTimer = status.poison.tickTimer;
  entity.poisonDps = status.poison.dps;
  entity.curseTimer = status.curse.timer;
  entity.curseTickTimer = status.curse.tickTimer;
}

export function ensureStatusState(entity) {
  if (!entity.status) {
    entity.status = createEmptyStatusState();
  }
  const status = entity.status;
  status.slow ||= { timer: 0, mult: 1 };
  status.stun ||= { timer: 0 };
  status.poison ||= { timer: 0, tickTimer: 0, dps: 0, tickInterval: STATUS_TICK_INTERVAL };
  status.curse ||= { timer: 0, tickTimer: 0, damagePerTick: 2, tickInterval: STATUS_TICK_INTERVAL };

  if (entity.enemySlowTimer != null) status.slow.timer = Math.max(status.slow.timer || 0, entity.enemySlowTimer || 0);
  if (entity.enemySlowMult != null) status.slow.mult = Math.min(status.slow.mult || 1, entity.enemySlowMult || 1);
  if (entity.stunTimer != null) status.stun.timer = Math.max(status.stun.timer || 0, entity.stunTimer || 0);
  if (entity.poisonTimer != null) status.poison.timer = Math.max(status.poison.timer || 0, entity.poisonTimer || 0);
  if (entity.poisonTickTimer != null) status.poison.tickTimer = Math.max(status.poison.tickTimer || 0, entity.poisonTickTimer || 0);
  if (entity.poisonDps != null) status.poison.dps = Math.max(status.poison.dps || 0, entity.poisonDps || 0);
  if (entity.curseTimer != null) status.curse.timer = Math.max(status.curse.timer || 0, entity.curseTimer || 0);
  if (entity.curseTickTimer != null) status.curse.tickTimer = Math.max(status.curse.tickTimer || 0, entity.curseTickTimer || 0);

  syncLegacyStatusFields(entity);
  return status;
}

export function createStatusState() {
  const entity = { status: createEmptyStatusState() };
  syncLegacyStatusFields(entity);
  return entity.status;
}

export function resetStatusState(entity) {
  entity.status = createEmptyStatusState();
  syncLegacyStatusFields(entity);
  return entity.status;
}

export function applyStatusPayload(entity, payload = {}) {
  const status = ensureStatusState(entity);
  if ((payload.slowDuration || 0) > 0) {
    status.slow.timer = Math.max(status.slow.timer || 0, payload.slowDuration);
    status.slow.mult = Math.min(status.slow.mult || 1, payload.slowMult ?? 0.5);
  }
  if ((payload.stunDuration || 0) > 0) {
    status.stun.timer = Math.max(status.stun.timer || 0, payload.stunDuration);
  }
  if ((payload.poisonDuration || 0) > 0 && (payload.poisonDps || 0) > 0) {
    status.poison.timer = Math.max(status.poison.timer || 0, payload.poisonDuration);
    status.poison.dps = Math.max(status.poison.dps || 0, payload.poisonDps);
    status.poison.tickTimer = Math.min(Math.max(status.poison.tickTimer || status.poison.tickInterval || STATUS_TICK_INTERVAL, 0.01), status.poison.tickInterval || STATUS_TICK_INTERVAL);
  }
  if ((payload.curseDuration || 0) > 0) {
    status.curse.timer = Math.max(status.curse.timer || 0, payload.curseDuration);
    status.curse.tickTimer = Math.min(Math.max(status.curse.tickTimer || status.curse.tickInterval || STATUS_TICK_INTERVAL, 0.01), status.curse.tickInterval || STATUS_TICK_INTERVAL);
    status.curse.damagePerTick = Math.max(0, payload.curseDamagePerTick ?? status.curse.damagePerTick ?? 2);
  }
  syncLegacyStatusFields(entity);
  return status;
}

export function isEntityStunned(entity) {
  return (ensureStatusState(entity).stun.timer || 0) > 0;
}

export function getEntitySlowMultiplier(entity) {
  return ensureStatusState(entity).slow.mult || 1;
}

export function updateStatusState(entity, dt, options = {}) {
  const status = ensureStatusState(entity);
  const onTickDamage = options.onTickDamage || (() => {});

  status.slow.timer = Math.max(0, (status.slow.timer || 0) - dt);
  status.stun.timer = Math.max(0, (status.stun.timer || 0) - dt);
  status.poison.timer = Math.max(0, (status.poison.timer || 0) - dt);
  status.poison.tickTimer = Math.max(0, (status.poison.tickTimer || 0) - dt);
  status.curse.timer = Math.max(0, (status.curse.timer || 0) - dt);
  status.curse.tickTimer = Math.max(0, (status.curse.tickTimer || 0) - dt);

  if ((status.slow.timer || 0) <= 0) status.slow.mult = 1;

  if ((status.curse.timer || 0) > 0 && (status.curse.tickTimer || 0) <= 0) {
    status.curse.tickTimer = status.curse.tickInterval || STATUS_TICK_INTERVAL;
    onTickDamage(Math.max(0, status.curse.damagePerTick || 0), "curse");
  }

  if ((status.poison.timer || 0) <= 0) {
    status.poison.dps = 0;
  } else if ((status.poison.tickTimer || 0) <= 0) {
    status.poison.tickTimer = status.poison.tickInterval || STATUS_TICK_INTERVAL;
    onTickDamage(Math.max(1, Math.round(status.poison.dps || 0)), "poison");
  }

  syncLegacyStatusFields(entity);
  return status;
}
