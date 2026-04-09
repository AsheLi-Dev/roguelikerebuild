export const DEFAULT_RANGED_ATTACK_TOKEN_COUNT = 4;
export const DEFAULT_RANGED_ATTACK_TOKEN_GRANT_INTERVAL = 0.5;
export const DEFAULT_RANGED_ATTACK_TOKEN_PAUSE_EVERY = 5;
export const DEFAULT_RANGED_ATTACK_TOKEN_PAUSE_DURATION = 1.5;

const RANGED_ATTACK_TOKEN_ELIGIBLE_ENEMY_TYPES = new Set([
  "m_bar_archer_5",
  "m_bar_bowman_7",
  "m_bar_shaman_9",
  "m_ud_archer_5",
  "m_ud_dark_archer_7",
  "m_ud_necromancer_8",
  "m_ud_wizard_9"
]);

const RANGED_ATTACK_TOKEN_KINDS = new Set([
  "projectile",
  "frame_synced_projectile",
  "projectile_spin",
  "projectile_trail",
  "projectile_burst",
  "projectile_backstep",
  "running_shot",
  "targeted_rain_zone"
]);

function clampPositiveNumber(value, fallback) {
  return Math.max(0, Number.isFinite(Number(value)) ? Number(value) : fallback);
}

function clampPositiveInterval(value, fallback) {
  return Math.max(0.001, clampPositiveNumber(value, fallback));
}

function clearEnemyRangedTokenAssignment(enemy) {
  if (!enemy) return;
  enemy.rangedTokenHeldAttackId = null;
  enemy.rangedTokenCommitted = false;
  enemy.rangedTokenRevoked = false;
}

function clearEnemyRangedTokenState(enemy) {
  if (!enemy) return;
  clearEnemyRangedTokenAssignment(enemy);
  enemy.rangedTokenWaitingSince = null;
}

function refreshEnemyWaitTimestamp(game, enemy) {
  if (!enemy) return;
  if (!Number.isFinite(enemy.rangedTokenWaitingSince)) {
    enemy.rangedTokenWaitingSince = game?.time || 0;
  }
}

function compareEnemyWaitPriority(left, right) {
  const leftWait = Number.isFinite(left?.rangedTokenWaitingSince) ? left.rangedTokenWaitingSince : Infinity;
  const rightWait = Number.isFinite(right?.rangedTokenWaitingSince) ? right.rangedTokenWaitingSince : Infinity;
  if (leftWait !== rightWait) return leftWait - rightWait;
  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

function getAssignedEnemyCount(controller) {
  return Array.isArray(controller?.assignedEnemyIds) ? controller.assignedEnemyIds.length : 0;
}

function clampAvailableTokens(controller) {
  if (!controller) return;
  controller.availableTokens = Math.max(
    0,
    Math.min(controller.availableTokens || 0, Math.max(0, controller.maxTokens - getAssignedEnemyCount(controller)))
  );
}

function shouldEnemyKeepRangedToken(game, enemy) {
  if (!enemy || enemy.dead) return false;
  if (!game) return false;
  if (!enemy.rangedTokenHeldAttackId) return false;
  const currentAttack = enemy.attackRuntime?.currentAttack || null;
  if (!currentAttack || currentAttack.id !== enemy.rangedTokenHeldAttackId) return false;
  return enemyUsesRangedAttackTokens(enemy, currentAttack);
}

function revokePendingWindupTokensForPause(game, controller, now) {
  if (!controller?.assignedEnemyIds?.length) return;
  const keptIds = [];
  let releasedCount = 0;
  for (const id of controller.assignedEnemyIds) {
    const enemy = (game.enemies || []).find((candidate) => candidate.id === id) || null;
    if (!enemy || enemy.dead) continue;
    const currentAttack = enemy.attackRuntime?.currentAttack || null;
    const shouldRevoke = !enemy.rangedTokenCommitted
      && (!currentAttack || enemy.attackRuntime?.state === "windup")
      && (!currentAttack || enemyUsesRangedAttackTokens(enemy, currentAttack));
    if (shouldRevoke) {
      clearEnemyRangedTokenAssignment(enemy);
      enemy.rangedTokenRevoked = true;
      enemy.rangedTokenWaitingSince = now;
      releasedCount += 1;
      continue;
    }
    keptIds.push(id);
  }
  controller.assignedEnemyIds = keptIds;
  controller.availableTokens = Math.min(controller.maxTokens, (controller.availableTokens || 0) + releasedCount);
}

function beginPause(game, controller, now) {
  controller.pauseUntil = now + controller.pauseDuration;
  controller.nextGrantAt = controller.pauseUntil;
  controller.nextPauseAt = controller.pauseUntil + controller.pauseEvery;
  revokePendingWindupTokensForPause(game, controller, now);
  clampAvailableTokens(controller);
}

function pruneAssignedEnemyIds(game, controller) {
  if (!controller?.assignedEnemyIds?.length) return;
  const keptIds = [];
  for (const id of controller.assignedEnemyIds) {
    const enemy = (game.enemies || []).find((candidate) => candidate.id === id) || null;
    if (shouldEnemyKeepRangedToken(game, enemy)) {
      keptIds.push(id);
      continue;
    }
    clearEnemyRangedTokenAssignment(enemy);
    controller.availableTokens = Math.min(controller.maxTokens, (controller.availableTokens || 0) + 1);
  }
  controller.assignedEnemyIds = keptIds;
  clampAvailableTokens(controller);
}

function canEnemyClaimRangedTokenNow(game, enemy, controller) {
  const now = game?.time || 0;
  if (!controller || !enemy) return false;
  if (now < (controller.pauseUntil || 0)) return false;
  if (now < (controller.nextGrantAt || 0)) return false;
  if ((controller.availableTokens || 0) <= 0) return false;

  let bestCandidate = null;
  for (const other of game.enemies || []) {
    if (!other || other.dead) continue;
    if (!RANGED_ATTACK_TOKEN_ELIGIBLE_ENEMY_TYPES.has(other.type)) continue;
    if (!Number.isFinite(other.rangedTokenWaitingSince)) continue;
    if (enemyHasRangedAttackToken(game, other)) continue;
    if (!bestCandidate || compareEnemyWaitPriority(other, bestCandidate) < 0) {
      bestCandidate = other;
    }
  }
  return !bestCandidate || bestCandidate.id === enemy.id;
}

export function createRangedAttackTokenController(options = {}) {
  const maxTokens = Math.max(0, Math.floor(options.maxTokens ?? DEFAULT_RANGED_ATTACK_TOKEN_COUNT));
  const pauseEvery = clampPositiveInterval(options.pauseEvery ?? DEFAULT_RANGED_ATTACK_TOKEN_PAUSE_EVERY, DEFAULT_RANGED_ATTACK_TOKEN_PAUSE_EVERY);
  const startTime = clampPositiveNumber(options.startTime ?? 0, 0);
  const grantInterval = clampPositiveInterval(
    options.grantInterval ?? DEFAULT_RANGED_ATTACK_TOKEN_GRANT_INTERVAL,
    DEFAULT_RANGED_ATTACK_TOKEN_GRANT_INTERVAL
  );
  return {
    maxTokens,
    availableTokens: Math.max(0, Math.min(maxTokens, Math.floor(options.availableTokens ?? maxTokens))),
    grantInterval,
    pauseEvery,
    pauseDuration: clampPositiveNumber(options.pauseDuration ?? DEFAULT_RANGED_ATTACK_TOKEN_PAUSE_DURATION, DEFAULT_RANGED_ATTACK_TOKEN_PAUSE_DURATION),
    nextGrantAt: clampPositiveNumber(options.nextGrantAt ?? (startTime + grantInterval), startTime + grantInterval),
    nextPauseAt: clampPositiveNumber(options.nextPauseAt ?? (startTime + pauseEvery), startTime + pauseEvery),
    pauseUntil: clampPositiveNumber(options.pauseUntil ?? startTime, startTime),
    assignedEnemyIds: []
  };
}

export function resetRangedAttackTokenController(controller, options = {}) {
  if (!controller) return null;
  const startTime = clampPositiveNumber(options.startTime ?? 0, 0);
  controller.maxTokens = Math.max(0, Math.floor(options.maxTokens ?? controller.maxTokens ?? DEFAULT_RANGED_ATTACK_TOKEN_COUNT));
  controller.availableTokens = Math.max(0, Math.min(controller.maxTokens, Math.floor(options.availableTokens ?? controller.maxTokens)));
  controller.grantInterval = clampPositiveInterval(
    options.grantInterval ?? controller.grantInterval ?? DEFAULT_RANGED_ATTACK_TOKEN_GRANT_INTERVAL,
    DEFAULT_RANGED_ATTACK_TOKEN_GRANT_INTERVAL
  );
  controller.pauseEvery = clampPositiveInterval(
    options.pauseEvery ?? controller.pauseEvery ?? DEFAULT_RANGED_ATTACK_TOKEN_PAUSE_EVERY,
    DEFAULT_RANGED_ATTACK_TOKEN_PAUSE_EVERY
  );
  controller.pauseDuration = clampPositiveNumber(
    options.pauseDuration ?? controller.pauseDuration ?? DEFAULT_RANGED_ATTACK_TOKEN_PAUSE_DURATION,
    DEFAULT_RANGED_ATTACK_TOKEN_PAUSE_DURATION
  );
  controller.nextGrantAt = clampPositiveNumber(
    options.nextGrantAt ?? (startTime + controller.grantInterval),
    startTime + controller.grantInterval
  );
  controller.nextPauseAt = clampPositiveNumber(
    options.nextPauseAt ?? (startTime + controller.pauseEvery),
    startTime + controller.pauseEvery
  );
  controller.pauseUntil = clampPositiveNumber(options.pauseUntil ?? startTime, startTime);
  controller.assignedEnemyIds = [];
  return controller;
}

export function enemyUsesRangedAttackTokens(enemy, attack = enemy?.attackRuntime?.currentAttack || null) {
  if (!enemy || !attack) return false;
  if (!RANGED_ATTACK_TOKEN_ELIGIBLE_ENEMY_TYPES.has(enemy.type)) return false;
  return RANGED_ATTACK_TOKEN_KINDS.has(attack.kind);
}

export function enemyHasRangedAttackToken(game, enemy) {
  if (!game?.rangedAttackTokens || !enemy) return false;
  return game.rangedAttackTokens.assignedEnemyIds.includes(enemy.id);
}

export function tryAssignRangedAttackToken(game, enemy, attack = enemy?.attackRuntime?.currentAttack || null) {
  const controller = game?.rangedAttackTokens;
  if (!controller || !enemyUsesRangedAttackTokens(enemy, attack)) return true;
  if (enemyHasRangedAttackToken(game, enemy)) return true;

  refreshEnemyWaitTimestamp(game, enemy);
  if (!canEnemyClaimRangedTokenNow(game, enemy, controller)) return false;

  controller.availableTokens = Math.max(0, (controller.availableTokens || 0) - 1);
  controller.nextGrantAt = Math.max(controller.nextGrantAt || 0, (game?.time || 0) + controller.grantInterval);
  controller.assignedEnemyIds.push(enemy.id);
  enemy.rangedTokenHeldAttackId = attack?.id || null;
  enemy.rangedTokenCommitted = false;
  enemy.rangedTokenRevoked = false;
  enemy.rangedTokenWaitingSince = null;
  clampAvailableTokens(controller);
  return true;
}

export function noteEnemySpentRangedAttackToken(game, enemy) {
  if (!game?.rangedAttackTokens || !enemyHasRangedAttackToken(game, enemy)) return;
  enemy.rangedTokenCommitted = true;
  enemy.rangedTokenRevoked = false;
}

export function releaseEnemyRangedAttackToken(game, enemy) {
  const controller = game?.rangedAttackTokens;
  if (!controller || !enemy) return;
  const before = getAssignedEnemyCount(controller);
  controller.assignedEnemyIds = controller.assignedEnemyIds.filter((id) => id !== enemy.id);
  if (getAssignedEnemyCount(controller) !== before) {
    controller.availableTokens = Math.min(controller.maxTokens, (controller.availableTokens || 0) + 1);
  }
  clearEnemyRangedTokenState(enemy);
  clampAvailableTokens(controller);
}

export function updateRangedAttackTokens(game) {
  const controller = game?.rangedAttackTokens;
  if (!controller) return;

  for (const enemy of game.enemies || []) {
    if (enemy.dead || !RANGED_ATTACK_TOKEN_ELIGIBLE_ENEMY_TYPES.has(enemy.type)) {
      clearEnemyRangedTokenState(enemy);
    }
  }

  pruneAssignedEnemyIds(game, controller);

  const now = game?.time || 0;
  if (now >= (controller.nextPauseAt || 0)) {
    beginPause(game, controller, now);
  }
  clampAvailableTokens(controller);
}
