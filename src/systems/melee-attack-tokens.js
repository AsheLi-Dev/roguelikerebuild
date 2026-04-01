import { centerOf, distance } from "../core/runtime-utils.js";

export const DEFAULT_MELEE_ATTACK_TOKEN_COUNT = 2;
const DEFAULT_MELEE_TOKEN_ASSIGNMENT_RANGE = 220;
const DEFAULT_MELEE_TOKEN_ASSIGNMENT_COOLDOWN = 0.75;
const DEFAULT_MELEE_TOKEN_ASSIGNMENT_COOLDOWN_PER_EXTRA_ENEMY = 0.18;
const DEFAULT_MELEE_TOKEN_POST_ATTACK_FATIGUE = 1.8;
const DEFAULT_MELEE_TOKEN_POST_ATTACK_FATIGUE_PER_EXTRA_ENEMY = 0.3;
const DEFAULT_MELEE_TOKEN_PLAYER_HIT_GRACE = 1.1;

export function createMeleeAttackTokenController(options = {}) {
  return {
    maxTokens: Math.max(0, Math.floor(options.maxTokens ?? DEFAULT_MELEE_ATTACK_TOKEN_COUNT)),
    assignmentRange: Math.max(0, Number(options.assignmentRange ?? DEFAULT_MELEE_TOKEN_ASSIGNMENT_RANGE)),
    assignmentCooldown: Math.max(0, Number(options.assignmentCooldown ?? DEFAULT_MELEE_TOKEN_ASSIGNMENT_COOLDOWN)),
    assignmentCooldownPerExtraEnemy: Math.max(0, Number(options.assignmentCooldownPerExtraEnemy ?? DEFAULT_MELEE_TOKEN_ASSIGNMENT_COOLDOWN_PER_EXTRA_ENEMY)),
    postAttackFatigue: Math.max(0, Number(options.postAttackFatigue ?? DEFAULT_MELEE_TOKEN_POST_ATTACK_FATIGUE)),
    postAttackFatiguePerExtraEnemy: Math.max(0, Number(options.postAttackFatiguePerExtraEnemy ?? DEFAULT_MELEE_TOKEN_POST_ATTACK_FATIGUE_PER_EXTRA_ENEMY)),
    playerHitGrace: Math.max(0, Number(options.playerHitGrace ?? DEFAULT_MELEE_TOKEN_PLAYER_HIT_GRACE)),
    nextTokenAssignmentAt: 0,
    nearbyEnemyCount: 0,
    assignedEnemyIds: []
  };
}

export function resetMeleeAttackTokenController(controller, options = {}) {
  if (!controller) return null;
  controller.maxTokens = Math.max(0, Math.floor(options.maxTokens ?? controller.maxTokens ?? DEFAULT_MELEE_ATTACK_TOKEN_COUNT));
  controller.assignmentRange = Math.max(0, Number(options.assignmentRange ?? controller.assignmentRange ?? DEFAULT_MELEE_TOKEN_ASSIGNMENT_RANGE));
  controller.assignmentCooldown = Math.max(0, Number(options.assignmentCooldown ?? controller.assignmentCooldown ?? DEFAULT_MELEE_TOKEN_ASSIGNMENT_COOLDOWN));
  controller.assignmentCooldownPerExtraEnemy = Math.max(0, Number(options.assignmentCooldownPerExtraEnemy ?? controller.assignmentCooldownPerExtraEnemy ?? DEFAULT_MELEE_TOKEN_ASSIGNMENT_COOLDOWN_PER_EXTRA_ENEMY));
  controller.postAttackFatigue = Math.max(0, Number(options.postAttackFatigue ?? controller.postAttackFatigue ?? DEFAULT_MELEE_TOKEN_POST_ATTACK_FATIGUE));
  controller.postAttackFatiguePerExtraEnemy = Math.max(0, Number(options.postAttackFatiguePerExtraEnemy ?? controller.postAttackFatiguePerExtraEnemy ?? DEFAULT_MELEE_TOKEN_POST_ATTACK_FATIGUE_PER_EXTRA_ENEMY));
  controller.playerHitGrace = Math.max(0, Number(options.playerHitGrace ?? controller.playerHitGrace ?? DEFAULT_MELEE_TOKEN_PLAYER_HIT_GRACE));
  controller.nextTokenAssignmentAt = 0;
  controller.nearbyEnemyCount = 0;
  controller.assignedEnemyIds = [];
  return controller;
}

export function enemyUsesMeleeAttackTokens(enemy) {
  return !!enemy?.attackRuntime && enemy.role === "melee";
}

export function enemyHasMeleeAttackToken(game, enemy) {
  if (!game?.meleeAttackTokens || !enemyUsesMeleeAttackTokens(enemy)) return false;
  return game.meleeAttackTokens.assignedEnemyIds.includes(enemy.id);
}

function isEnemyNearPlayer(game, enemy, controller) {
  const playerCenter = centerOf(game.player);
  const enemyCenter = centerOf(enemy);
  return distance(playerCenter.x, playerCenter.y, enemyCenter.x, enemyCenter.y) <= controller.assignmentRange;
}

function enemyCanHoldMeleeToken(game, enemy, controller) {
  if (!enemyUsesMeleeAttackTokens(enemy) || enemy.dead) return false;
  if (!isEnemyNearPlayer(game, enemy, controller)) return false;
  if (enemy.awarenessState === "idle" || enemy.awarenessState === "blinded") return false;
  if ((enemy.meleeTokenFatigueUntil || 0) > (game.time || 0)) return false;
  return true;
}

function getNearbyEligibleMeleeEnemies(game, controller) {
  const nearby = [];
  for (const enemy of game.enemies || []) {
    if (!enemyUsesMeleeAttackTokens(enemy) || enemy.dead) continue;
    if (!isEnemyNearPlayer(game, enemy, controller)) continue;
    if (enemy.awarenessState === "idle" || enemy.awarenessState === "blinded") continue;
    nearby.push(enemy);
  }
  return nearby;
}

function getCrowdPressure(controller) {
  return Math.max(0, (controller.nearbyEnemyCount || 0) - Math.max(1, controller.maxTokens));
}

function getAssignmentDelay(controller) {
  return controller.assignmentCooldown + getCrowdPressure(controller) * controller.assignmentCooldownPerExtraEnemy;
}

function getPostAttackFatigue(controller) {
  return controller.postAttackFatigue + getCrowdPressure(controller) * controller.postAttackFatiguePerExtraEnemy;
}

function shuffleInPlace(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const next = values[index];
    values[index] = values[swapIndex];
    values[swapIndex] = next;
  }
  return values;
}

export function updateMeleeAttackTokens(game) {
  const controller = game?.meleeAttackTokens;
  if (!controller) return;

  const nearbyEligibleMeleeEnemies = getNearbyEligibleMeleeEnemies(game, controller);
  controller.nearbyEnemyCount = nearbyEligibleMeleeEnemies.length;

  const enemiesById = new Map();
  for (const enemy of game.enemies || []) {
    enemiesById.set(enemy.id, enemy);
  }

  const keptIds = [];
  for (const id of controller.assignedEnemyIds) {
    const enemy = enemiesById.get(id);
    if (!enemyCanHoldMeleeToken(game, enemy, controller)) continue;
    keptIds.push(id);
  }
  controller.assignedEnemyIds = keptIds.slice(0, controller.maxTokens);

  const openSlots = Math.max(0, controller.maxTokens - controller.assignedEnemyIds.length);
  if (openSlots <= 0) return;
  if ((game.time || 0) < (controller.nextTokenAssignmentAt || 0)) return;

  const candidates = [];
  for (const enemy of nearbyEligibleMeleeEnemies) {
    if (!enemyCanHoldMeleeToken(game, enemy, controller)) continue;
    if (controller.assignedEnemyIds.includes(enemy.id)) continue;
    candidates.push(enemy);
  }

  shuffleInPlace(candidates);
  const granted = candidates.slice(0, openSlots);
  for (const enemy of granted) {
    controller.assignedEnemyIds.push(enemy.id);
  }
  if (granted.length > 0) {
    controller.nextTokenAssignmentAt = Math.max(controller.nextTokenAssignmentAt || 0, (game.time || 0) + getAssignmentDelay(controller));
  }
}

export function noteEnemySpentMeleeAttackToken(game, enemy) {
  const controller = game?.meleeAttackTokens;
  if (!controller || !enemyUsesMeleeAttackTokens(enemy)) return;
  enemy.meleeTokenFatigueUntil = (game.time || 0) + getPostAttackFatigue(controller);
}

function noteEnemyReleasedMeleeAttackToken(game, enemy) {
  const controller = game?.meleeAttackTokens;
  if (!controller || !enemyUsesMeleeAttackTokens(enemy)) return;
  controller.nextTokenAssignmentAt = Math.max(controller.nextTokenAssignmentAt || 0, (game.time || 0) + getAssignmentDelay(controller));
}

export function notePlayerDamagedByEnemyMelee(game, sourceEnemy = null) {
  const controller = game?.meleeAttackTokens;
  if (!controller) return;
  if (sourceEnemy && !enemyUsesMeleeAttackTokens(sourceEnemy)) return;
  controller.nextTokenAssignmentAt = Math.max(
    controller.nextTokenAssignmentAt || 0,
    (game.time || 0) + controller.playerHitGrace
  );
}

export function releaseEnemyMeleeAttackToken(game, enemy) {
  if (!game?.meleeAttackTokens || !enemy) return;
  const before = game.meleeAttackTokens.assignedEnemyIds.length;
  game.meleeAttackTokens.assignedEnemyIds = game.meleeAttackTokens.assignedEnemyIds.filter((id) => id !== enemy.id);
  if (game.meleeAttackTokens.assignedEnemyIds.length !== before) {
    noteEnemyReleasedMeleeAttackToken(game, enemy);
  }
}
