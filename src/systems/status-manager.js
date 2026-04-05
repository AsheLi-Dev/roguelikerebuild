const STATUS_TICK_INTERVAL = 1;
const BURN_TICK_INTERVAL = 0.5;

function createEmptyStatusState() {
  return {
    slow: {
      timer: 0,
      mult: 1
    },
    blind: {
      timer: 0,
      lockoutTimer: 0
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
    burn: {
      timer: 0,
      tickTimer: 0,
      dps: 0,
      stacks: 0,
      tickInterval: BURN_TICK_INTERVAL
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
  entity.blindTimer = status.blind.timer;
  entity.blindLockoutTimer = status.blind.lockoutTimer;
  entity.stunTimer = status.stun.timer;
  entity.poisonTimer = status.poison.timer;
  entity.poisonTickTimer = status.poison.tickTimer;
  entity.poisonDps = status.poison.dps;
  entity.burnTimer = status.burn.timer;
  entity.burnTickTimer = status.burn.tickTimer;
  entity.burnStacks = status.burn.stacks;
  entity.burnDamagePerSecond = status.burn.dps;
  entity.curseTimer = status.curse.timer;
  entity.curseTickTimer = status.curse.tickTimer;
  if (entity.state) {
    entity.state.blindTimer = status.blind.timer;
    entity.state.blindLockoutTimer = status.blind.lockoutTimer;
    entity.state.burnTimer = status.burn.timer;
    entity.state.burnTickTimer = status.burn.tickTimer;
    entity.state.burnTickInterval = status.burn.tickInterval;
    entity.state.burnStacks = status.burn.stacks;
    entity.state.burnDamagePerSecond = status.burn.dps;
  }
}

export function ensureStatusState(entity) {
  if (!entity.status) {
    entity.status = createEmptyStatusState();
  }
  const status = entity.status;
  status.slow ||= { timer: 0, mult: 1 };
  status.blind ||= { timer: 0, lockoutTimer: 0 };
  status.stun ||= { timer: 0 };
  status.poison ||= { timer: 0, tickTimer: 0, dps: 0, tickInterval: STATUS_TICK_INTERVAL };
  status.burn ||= { timer: 0, tickTimer: 0, dps: 0, stacks: 0, tickInterval: BURN_TICK_INTERVAL };
  status.curse ||= { timer: 0, tickTimer: 0, damagePerTick: 2, tickInterval: STATUS_TICK_INTERVAL };

  if (entity.enemySlowTimer != null) status.slow.timer = Math.max(status.slow.timer || 0, entity.enemySlowTimer || 0);
  if (entity.enemySlowMult != null) status.slow.mult = Math.min(status.slow.mult || 1, entity.enemySlowMult || 1);
  if (entity.blindTimer != null) status.blind.timer = Math.max(status.blind.timer || 0, entity.blindTimer || 0);
  if (entity.blindLockoutTimer != null) status.blind.lockoutTimer = Math.max(status.blind.lockoutTimer || 0, entity.blindLockoutTimer || 0);
  if (entity.state?.blindTimer != null) status.blind.timer = Math.max(status.blind.timer || 0, entity.state.blindTimer || 0);
  if (entity.state?.blindLockoutTimer != null) status.blind.lockoutTimer = Math.max(status.blind.lockoutTimer || 0, entity.state.blindLockoutTimer || 0);
  if (entity.stunTimer != null) status.stun.timer = Math.max(status.stun.timer || 0, entity.stunTimer || 0);
  if (entity.poisonTimer != null) status.poison.timer = Math.max(status.poison.timer || 0, entity.poisonTimer || 0);
  if (entity.poisonTickTimer != null) status.poison.tickTimer = Math.max(status.poison.tickTimer || 0, entity.poisonTickTimer || 0);
  if (entity.poisonDps != null) status.poison.dps = Math.max(status.poison.dps || 0, entity.poisonDps || 0);
  if (entity.burnTimer != null) status.burn.timer = Math.max(status.burn.timer || 0, entity.burnTimer || 0);
  if (entity.burnTickTimer != null) status.burn.tickTimer = Math.max(status.burn.tickTimer || 0, entity.burnTickTimer || 0);
  if (entity.burnDamagePerSecond != null) status.burn.dps = Math.max(status.burn.dps || 0, entity.burnDamagePerSecond || 0);
  if (entity.burnStacks != null) status.burn.stacks = Math.max(status.burn.stacks || 0, entity.burnStacks || 0);
  if (entity.state?.burnTimer != null) status.burn.timer = Math.max(status.burn.timer || 0, entity.state.burnTimer || 0);
  if (entity.state?.burnTickTimer != null) status.burn.tickTimer = Math.max(status.burn.tickTimer || 0, entity.state.burnTickTimer || 0);
  if (entity.state?.burnTickInterval != null) {
    status.burn.tickInterval = Math.max(0.05, Math.min(status.burn.tickInterval || BURN_TICK_INTERVAL, entity.state.burnTickInterval || BURN_TICK_INTERVAL));
  }
  if (entity.state?.burnDamagePerSecond != null) status.burn.dps = Math.max(status.burn.dps || 0, entity.state.burnDamagePerSecond || 0);
  if (entity.state?.burnStacks != null) status.burn.stacks = Math.max(status.burn.stacks || 0, entity.state.burnStacks || 0);
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
  if ((payload.blindDuration || 0) > 0 && (status.blind.lockoutTimer || 0) <= 0) {
    status.blind.timer = Math.max(status.blind.timer || 0, payload.blindDuration);
    status.blind.lockoutTimer = Math.max(status.blind.lockoutTimer || 0, payload.blindLockoutDuration ?? 5);
  }
  if ((payload.stunDuration || 0) > 0) {
    status.stun.timer = Math.max(status.stun.timer || 0, payload.stunDuration);
  }
  if ((payload.poisonDuration || 0) > 0 && (payload.poisonDps || 0) > 0) {
    status.poison.timer = Math.max(status.poison.timer || 0, payload.poisonDuration);
    status.poison.dps = Math.max(status.poison.dps || 0, payload.poisonDps);
    status.poison.tickTimer = Math.min(Math.max(status.poison.tickTimer || status.poison.tickInterval || STATUS_TICK_INTERVAL, 0.01), status.poison.tickInterval || STATUS_TICK_INTERVAL);
  }
  if ((payload.burnDuration || 0) > 0 && (payload.burnDamagePerSecond || 0) > 0) {
    const burnTickInterval = Math.max(0.05, payload.burnTickInterval ?? status.burn.tickInterval ?? BURN_TICK_INTERVAL);
    status.burn.timer = Math.max(status.burn.timer || 0, payload.burnDuration);
    status.burn.stacks = Math.min(99, (status.burn.stacks || 0) + Math.max(1, payload.burnStacks ?? 1));
    status.burn.dps = Math.max(status.burn.dps || 0, payload.burnDamagePerSecond);
    status.burn.tickInterval = Math.min(status.burn.tickInterval || burnTickInterval, burnTickInterval);
    status.burn.tickTimer = Math.min(
      Math.max(status.burn.tickTimer || status.burn.tickInterval || burnTickInterval, 0.01),
      status.burn.tickInterval || burnTickInterval
    );
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

export function isEntityBlinded(entity) {
  return (ensureStatusState(entity).blind.timer || 0) > 0;
}

export function getEntitySlowMultiplier(entity) {
  return ensureStatusState(entity).slow.mult || 1;
}

export function consumeEntityBurnStacks(entity, count = 1) {
  const stacksToConsume = Math.max(0, Math.floor(count));
  if (stacksToConsume <= 0) return 0;
  const status = ensureStatusState(entity);
  const consumed = Math.min(status.burn.stacks || 0, stacksToConsume);
  if (consumed <= 0) return 0;
  status.burn.stacks = Math.max(0, (status.burn.stacks || 0) - consumed);
  if ((status.burn.stacks || 0) <= 0) {
    status.burn.timer = 0;
    status.burn.dps = 0;
    status.burn.tickTimer = 0;
    status.burn.tickInterval = BURN_TICK_INTERVAL;
  }
  syncLegacyStatusFields(entity);
  return consumed;
}

export function updateStatusState(entity, dt, options = {}) {
  const status = ensureStatusState(entity);
  const onTickDamage = options.onTickDamage || (() => {});

  status.slow.timer = Math.max(0, (status.slow.timer || 0) - dt);
  status.blind.timer = Math.max(0, (status.blind.timer || 0) - dt);
  status.blind.lockoutTimer = Math.max(0, (status.blind.lockoutTimer || 0) - dt);
  status.stun.timer = Math.max(0, (status.stun.timer || 0) - dt);
  status.poison.timer = Math.max(0, (status.poison.timer || 0) - dt);
  status.poison.tickTimer = Math.max(0, (status.poison.tickTimer || 0) - dt);
  status.burn.timer = Math.max(0, (status.burn.timer || 0) - dt);
  status.burn.tickTimer = Math.max(0, (status.burn.tickTimer || 0) - dt);
  status.curse.timer = Math.max(0, (status.curse.timer || 0) - dt);
  status.curse.tickTimer = Math.max(0, (status.curse.tickTimer || 0) - dt);

  if ((status.slow.timer || 0) <= 0) status.slow.mult = 1;

  if ((status.burn.timer || 0) <= 0) {
    status.burn.stacks = 0;
    status.burn.dps = 0;
    status.burn.tickTimer = 0;
    status.burn.tickInterval = BURN_TICK_INTERVAL;
  } else {
    const burnTickInterval = Math.max(0.05, status.burn.tickInterval || BURN_TICK_INTERVAL);
    while ((status.burn.tickTimer || 0) <= 0 && (status.burn.timer || 0) > 0) {
      status.burn.tickTimer += burnTickInterval;
      onTickDamage(Math.max(0, (status.burn.stacks || 0) * (status.burn.dps || 0) * burnTickInterval), "burn");
    }
  }

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
