import { clamp, normalize } from "../core/runtime-utils.js";

const TACTIC_IDS = Object.freeze([
  "feint_entry",
  "drift_noise",
  "cooldown_kite",
  "retreat_reset",
  "strafe_pressure"
]);

const DEFAULT_TACTIC_PROFILES = Object.freeze({
  melee: {
    feint_entry: {
      feintChance: 0.28,
      feintCycles: 2,
      feintBurstDuration: 0.1,
      feintCommitDuration: 0.22,
      feintCooldown: 2.6,
      feintBurstSpeedMult: 0.42,
      feintSpeedMult: 1.08,
      feintLateralWeight: 0.34
    },
    drift_noise: {
      driftStrength: 0.1,
      driftEpisodeMinGap: 2,
      driftEpisodeMaxGap: 4,
      driftStepMinDuration: 0.1,
      driftStepMaxDuration: 0.3,
      driftStepsMin: 3,
      driftStepsMax: 5,
      driftForwardWeight: 0.72
    },
    cooldown_kite: {
      kitePadding: 12,
      rangeTolerance: 20,
      postAttackKiteDuration: 0.65
    },
    retreat_reset: {
      kitePadding: 18,
      rangeTolerance: 24,
      postAttackKiteDuration: 0.8
    },
    strafe_pressure: {
      strafeWeight: 0.18
    }
  },
  ranged: {
    feint_entry: {
      feintChance: 0.18,
      feintCycles: 2,
      feintBurstDuration: 0.11,
      feintCommitDuration: 0.24,
      feintCooldown: 2.9,
      feintBurstSpeedMult: 0.36,
      feintSpeedMult: 1.05,
      feintLateralWeight: 0.26
    },
    drift_noise: {
      driftStrength: 0.22,
      driftEpisodeMinGap: 2,
      driftEpisodeMaxGap: 4,
      driftStepMinDuration: 0.1,
      driftStepMaxDuration: 0.3,
      driftStepsMin: 3,
      driftStepsMax: 5,
      driftForwardWeight: 0.68
    },
    cooldown_kite: {
      kitePadding: 26,
      rangeTolerance: 32,
      postAttackKiteDuration: 1.25
    },
    retreat_reset: {
      kitePadding: 30,
      rangeTolerance: 36,
      postAttackKiteDuration: 1.4
    },
    strafe_pressure: {
      strafeWeight: 0.42
    }
  }
});

const DEFAULT_ROLE_PROFILE = Object.freeze({
  melee: {
    feintChance: 0.28,
    feintCycles: 2,
    feintBurstDuration: 0.1,
    feintCommitDuration: 0.22,
    feintCooldown: 2.6,
    feintBurstSpeedMult: 0.42,
    feintSpeedMult: 1.08,
    feintLateralWeight: 0.34,
    driftStrength: 0.1,
    driftEpisodeMinGap: 2,
    driftEpisodeMaxGap: 4,
    driftStepMinDuration: 0.1,
    driftStepMaxDuration: 0.3,
    driftStepsMin: 3,
    driftStepsMax: 5,
    driftForwardWeight: 0.72,
    strafeWeight: 0.18,
    kitePadding: 12,
    rangeTolerance: 20,
    postAttackKiteDuration: 0.65
  },
  ranged: {
    feintChance: 0.18,
    feintCycles: 2,
    feintBurstDuration: 0.11,
    feintCommitDuration: 0.24,
    feintCooldown: 2.9,
    feintBurstSpeedMult: 0.36,
    feintSpeedMult: 1.05,
    feintLateralWeight: 0.26,
    driftStrength: 0.22,
    driftEpisodeMinGap: 2,
    driftEpisodeMaxGap: 4,
    driftStepMinDuration: 0.1,
    driftStepMaxDuration: 0.3,
    driftStepsMin: 3,
    driftStepsMax: 5,
    driftForwardWeight: 0.68,
    strafeWeight: 0.42,
    kitePadding: 26,
    rangeTolerance: 32,
    postAttackKiteDuration: 1.25
  },
  skirmisher: {
    feintChance: 0.22,
    feintCycles: 3,
    feintBurstDuration: 0.09,
    feintCommitDuration: 0.2,
    feintCooldown: 2.5,
    feintBurstSpeedMult: 0.4,
    feintSpeedMult: 1.12,
    feintLateralWeight: 0.3,
    driftStrength: 0.2,
    driftEpisodeMinGap: 2,
    driftEpisodeMaxGap: 4,
    driftStepMinDuration: 0.1,
    driftStepMaxDuration: 0.3,
    driftStepsMin: 3,
    driftStepsMax: 5,
    driftForwardWeight: 0.66,
    strafeWeight: 0.5,
    kitePadding: 18,
    rangeTolerance: 24,
    postAttackKiteDuration: 0.95
  }
});

function getBaseProfile(role = "melee") {
  return { ...(DEFAULT_ROLE_PROFILE[role] || DEFAULT_ROLE_PROFILE.melee) };
}

export function getEnemyMovementClass(enemyOrRole) {
  const role = typeof enemyOrRole === "string" ? enemyOrRole : enemyOrRole?.role;
  return role === "ranged" ? "ranged" : "melee";
}

export function createDefaultTacticProfiles() {
  return JSON.parse(JSON.stringify(DEFAULT_TACTIC_PROFILES));
}

function normalizeMovementTactic(movementTactic) {
  const value = String(movementTactic || "Balance").trim().toLowerCase();
  if (value === "brave") return "Brave";
  if (value === "coward") return "Coward";
  return "Balance";
}

function getLoadedTacticProfile(game, movementClass, tacticId) {
  return game.enemyTacticProfiles?.[movementClass]?.[tacticId] || {};
}

function applyMovementTacticToProfile(enemy, tacticId, profile) {
  const movementTactic = normalizeMovementTactic(enemy?.movementTactic);
  if (movementTactic === "Balance") return profile;

  const adjusted = { ...profile, movementTactic };
  if (tacticId === "feint_entry") {
    if (movementTactic === "Brave") {
      adjusted.feintChance = Math.max(0.04, (profile.feintChance || 0) * 0.3);
      adjusted.feintCycles = Math.max(1, Math.round((profile.feintCycles || 2) - 1));
      adjusted.feintLateralWeight = Math.max(0.12, (profile.feintLateralWeight || 0.3) * 0.7);
      adjusted.feintBurstSpeedMult = Math.max(0.18, (profile.feintBurstSpeedMult || 0.4) * 0.7);
      adjusted.feintCooldown = Math.max(3.2, (profile.feintCooldown || 2.5) * 1.35);
    } else if (movementTactic === "Coward") {
      adjusted.feintChance = Math.min(0.9, Math.max(0.55, (profile.feintChance || 0) * 1.9));
      adjusted.feintCycles = Math.min(5, Math.max(3, Math.round((profile.feintCycles || 2) + 1)));
      adjusted.feintLateralWeight = Math.min(0.7, (profile.feintLateralWeight || 0.3) * 1.25);
      adjusted.feintBurstSpeedMult = Math.min(0.65, (profile.feintBurstSpeedMult || 0.4) * 1.1);
      adjusted.feintCooldown = Math.max(1.2, (profile.feintCooldown || 2.5) * 0.75);
    }
  }

  if (tacticId === "drift_noise") {
    if (movementTactic === "Brave") {
      adjusted.driftStrength = Math.max(0.08, (profile.driftStrength || 0.2) * 0.55);
      adjusted.driftForwardWeight = Math.min(0.9, (profile.driftForwardWeight || 0.65) + 0.14);
      adjusted.driftEpisodeMinGap = Math.max(2.8, (profile.driftEpisodeMinGap || 2) * 1.5);
      adjusted.driftEpisodeMaxGap = Math.max(adjusted.driftEpisodeMinGap + 0.4, (profile.driftEpisodeMaxGap || 4) * 1.4);
      adjusted.driftStepsMin = Math.max(1, Math.min(3, (profile.driftStepsMin || 3) - 1));
      adjusted.driftStepsMax = Math.max(adjusted.driftStepsMin, Math.min(4, (profile.driftStepsMax || 5) - 1));
    } else if (movementTactic === "Coward") {
      adjusted.driftStrength = Math.min(0.7, (profile.driftStrength || 0.2) * 1.35);
      adjusted.driftForwardWeight = Math.max(0.35, (profile.driftForwardWeight || 0.65) - 0.12);
      adjusted.driftEpisodeMinGap = Math.max(0.9, (profile.driftEpisodeMinGap || 2) * 0.65);
      adjusted.driftEpisodeMaxGap = Math.max(adjusted.driftEpisodeMinGap + 0.2, (profile.driftEpisodeMaxGap || 4) * 0.7);
      adjusted.driftStepsMin = Math.min(5, Math.max(4, (profile.driftStepsMin || 3) + 1));
      adjusted.driftStepsMax = Math.min(7, Math.max(adjusted.driftStepsMin, (profile.driftStepsMax || 5) + 1));
    }
  }

  return adjusted;
}

function compilePatternProfile(pattern) {
  const steps = Array.isArray(pattern?.steps) ? pattern.steps.filter((step) => (step.duration || 0) > 0) : [];
  const movingSteps = steps.filter((step) => Math.abs(step.x || 0) > 0.001 || Math.abs(step.y || 0) > 0.001);
  const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0) || 1;
  const movingDuration = movingSteps.reduce((sum, step) => sum + step.duration, 0) || 1;
  const idleDuration = Math.max(0, totalDuration - movingDuration);
  const averageMoveDuration = movingDuration / Math.max(1, movingSteps.length);
  const diagonalDuration = movingSteps.reduce((sum, step) => {
    return sum + (Math.abs(step.x || 0) > 0.2 && Math.abs(step.y || 0) > 0.2 ? step.duration : 0);
  }, 0);
  const verticalShare = movingSteps.reduce((sum, step) => sum + Math.abs(step.y || 0) * step.duration, 0) / movingDuration;
  const horizontalShare = movingSteps.reduce((sum, step) => sum + Math.abs(step.x || 0) * step.duration, 0) / movingDuration;

  let directionChanges = 0;
  let quickOpposites = 0;
  for (let index = 1; index < movingSteps.length; index += 1) {
    const previous = movingSteps[index - 1];
    const current = movingSteps[index];
    const dot = (previous.x || 0) * (current.x || 0) + (previous.y || 0) * (current.y || 0);
    if (Math.abs(previous.x - current.x) > 0.2 || Math.abs(previous.y - current.y) > 0.2) directionChanges += 1;
    if (dot < -0.2 && previous.duration <= 0.18 && current.duration <= 0.18) quickOpposites += 1;
  }

  const diagonalRatio = diagonalDuration / movingDuration;
  const idleRatio = idleDuration / totalDuration;
  const changeRate = directionChanges / Math.max(1, movingSteps.length);
  const feintCycles = clamp(2 + Math.round(quickOpposites / 6), 2, 4);

  return {
    sourcePatternId: pattern.id,
    sourceTacticId: pattern.tacticId || null,
    feintChance: clamp(0.12 + (quickOpposites / Math.max(1, movingSteps.length)) * 1.1, 0.12, 0.58),
    feintCycles,
    feintBurstDuration: clamp(averageMoveDuration * 0.75, 0.07, 0.16),
    feintCommitDuration: clamp(averageMoveDuration * 1.2, 0.16, 0.32),
    feintCooldown: clamp(2.2 + idleRatio * 2.4, 1.8, 4.2),
    feintBurstSpeedMult: clamp(0.34 + diagonalRatio * 0.16, 0.34, 0.56),
    feintSpeedMult: clamp(1 + diagonalRatio * 0.18 + changeRate * 0.08, 1.02, 1.22),
    feintLateralWeight: clamp(0.22 + diagonalRatio * 0.22 + verticalShare * 0.18, 0.22, 0.48),
    driftStrength: clamp(0.08 + verticalShare * 0.16 + diagonalRatio * 0.18, 0.08, 0.4),
    driftEpisodeMinGap: clamp(2.8 - idleRatio * 0.8, 2, 4),
    driftEpisodeMaxGap: clamp(4.2 - idleRatio * 0.8, 2.6, 4),
    driftStepMinDuration: clamp(0.12 - changeRate * 0.03, 0.1, 0.2),
    driftStepMaxDuration: clamp(0.3 - changeRate * 0.04, 0.18, 0.3),
    driftStepsMin: clamp(3 + Math.round(changeRate), 3, 4),
    driftStepsMax: clamp(4 + Math.round(diagonalRatio * 2), 4, 5),
    driftForwardWeight: clamp(0.78 - verticalShare * 0.18 - diagonalRatio * 0.12, 0.56, 0.82),
    strafeWeight: clamp(0.14 + diagonalRatio * 0.45 + verticalShare * 0.22, 0.14, 0.65),
    kitePadding: clamp(12 + idleRatio * 24 + horizontalShare * 10, 12, 40),
    rangeTolerance: clamp(18 + idleRatio * 26, 18, 38),
    postAttackKiteDuration: clamp(0.55 + idleRatio * 1.1, 0.55, 1.75)
  };
}

export function compileEnemyMovementProfiles(patterns = []) {
  const latestByClassAndTactic = new Map();
  for (const pattern of patterns) {
    const legacyTypeId = String(pattern?.enemyTypeId || "");
    const legacyMovementClass = legacyTypeId.includes("_archer") || legacyTypeId.includes("_bow") || legacyTypeId.includes("_wizard") || legacyTypeId.includes("_shaman") || legacyTypeId.includes("_witchdoctor") || legacyTypeId.includes("_necromancer")
      ? "ranged"
      : "melee";
    const movementClass = pattern?.movementClass || getEnemyMovementClass(pattern?.role) || legacyMovementClass;
    const tacticId = pattern?.tacticId || "feint_entry";
    if (!movementClass) continue;
    const key = `${movementClass}:${tacticId}`;
    const previous = latestByClassAndTactic.get(key);
    const previousDate = Date.parse(previous?.createdAt || 0) || 0;
    const currentDate = Date.parse(pattern.createdAt || 0) || Date.now();
    if (!previous || currentDate >= previousDate) latestByClassAndTactic.set(key, pattern);
  }

  const profiles = {};
  for (const movementClass of ["melee", "ranged"]) {
    profiles[movementClass] = {};
    for (const tacticId of TACTIC_IDS) {
      const pattern = latestByClassAndTactic.get(`${movementClass}:${tacticId}`);
      if (pattern) profiles[movementClass][tacticId] = compilePatternProfile(pattern);
    }
  }
  return profiles;
}

export function getEnemyMovementProfile(game, enemy) {
  const movementClass = getEnemyMovementClass(enemy);
  const tacticProfiles = game.enemyTacticProfiles?.[movementClass] || {};
  return {
    ...getBaseProfile(enemy?.role),
    ...(DEFAULT_TACTIC_PROFILES[movementClass]?.feint_entry || {}),
    ...(DEFAULT_TACTIC_PROFILES[movementClass]?.drift_noise || {}),
    ...(DEFAULT_TACTIC_PROFILES[movementClass]?.cooldown_kite || {}),
    ...(tacticProfiles.feint_entry || {}),
    ...(tacticProfiles.drift_noise || {}),
    ...(tacticProfiles.cooldown_kite || {})
  };
}

export function getEnemyTacticProfile(game, enemy, tacticId) {
  const movementClass = getEnemyMovementClass(enemy);
  const profile = {
    ...getBaseProfile(enemy?.role),
    ...(DEFAULT_TACTIC_PROFILES[movementClass]?.[tacticId] || {}),
    ...getLoadedTacticProfile(game, movementClass, tacticId)
  };
  return applyMovementTacticToProfile(enemy, tacticId, profile);
}

function ensureTacticalRuntime(enemy) {
  const runtime = enemy.attackRuntime;
  runtime.tactical ||= {
    mode: "idle",
    nextFeintAt: 0,
    feintTimer: 0,
    feintBurstsRemaining: 0,
    feintSign: 1,
    commitTimer: 0,
    commitMode: "advance",
    postAttackKiteTimer: 0,
    noiseOffset: Math.random() * Math.PI * 2,
    driftSign: Math.random() < 0.5 ? -1 : 1,
    driftTimer: 0,
    driftActive: false,
    driftStepsRemaining: 0,
    nextDriftAt: 0,
    nextFeintRollAt: 0,
    lastLoggedMode: null,
    lastLoggedAt: -Infinity
  };
  return runtime.tactical;
}

function logTacticMove(game, enemy, tactical, mode, detail = "") {
  if (!game || !enemy || !tactical) return;
  const now = Number(game.time || 0);
  if (tactical.lastLoggedMode === mode && now - (tactical.lastLoggedAt || 0) < 0.35) return;
  tactical.lastLoggedMode = mode;
  tactical.lastLoggedAt = now;
  const suffix = detail ? ` ${detail}` : "";
  console.log(`[TACTIC] ${enemy.name || enemy.type || "enemy"} -> ${mode}${suffix}`);
}

function hasReadyAttack(enemy, distanceToTarget, now) {
  const runtime = enemy.attackRuntime;
  if (!runtime || runtime.state !== "idle" || now < (runtime.nextAttackAt || 0)) return false;
  return enemy.attacks.some((attack) => {
    if ((runtime.cooldowns[attack.id] ?? 0) > 0) return false;
    if (distanceToTarget < (attack.minRange ?? 0) || distanceToTarget > (attack.maxRange ?? 9999)) return false;
    return true;
  });
}

function getPerpendicular(dir, clockwise = true) {
  return clockwise ? { x: -dir.y, y: dir.x } : { x: dir.y, y: -dir.x };
}

function randomRange(min, max) {
  return min + Math.random() * Math.max(0, max - min);
}

function randomIntRange(min, max) {
  const normalizedMin = Math.floor(min);
  const normalizedMax = Math.floor(max);
  return normalizedMin + Math.floor(Math.random() * Math.max(1, normalizedMax - normalizedMin + 1));
}

function scheduleNextDriftEpisode(game, tactical, profile) {
  tactical.nextDriftAt = game.time + randomRange(
    profile.driftEpisodeMinGap || 2,
    profile.driftEpisodeMaxGap || 4
  );
}

function applyDriftNoise(game, enemy, baseDir, profile, tactical) {
  if (Math.abs(baseDir.x) < 0.001 && Math.abs(baseDir.y) < 0.001) return baseDir;
  if (!(tactical.nextDriftAt > 0)) {
    scheduleNextDriftEpisode(game, tactical, profile);
  }

  tactical.driftTimer = Math.max(0, tactical.driftTimer || 0);
  if (!tactical.driftActive && game.time >= tactical.nextDriftAt) {
    tactical.driftActive = true;
    tactical.driftStepsRemaining = randomIntRange(profile.driftStepsMin || 3, profile.driftStepsMax || 5);
    tactical.driftSign = Math.random() < 0.5 ? -1 : 1;
    tactical.driftTimer = randomRange(profile.driftStepMinDuration || 0.1, profile.driftStepMaxDuration || 0.3);
  } else if (tactical.driftActive && tactical.driftTimer <= 0) {
    tactical.driftStepsRemaining -= 1;
    if (tactical.driftStepsRemaining <= 0) {
      tactical.driftActive = false;
      tactical.driftTimer = 0;
      scheduleNextDriftEpisode(game, tactical, profile);
      return baseDir;
    }
    tactical.driftSign *= -1;
    tactical.driftTimer = randomRange(profile.driftStepMinDuration || 0.1, profile.driftStepMaxDuration || 0.3);
  }
  if (!tactical.driftActive) return baseDir;
  const side = getPerpendicular(baseDir, tactical.driftSign > 0);
  const forwardWeight = profile.driftForwardWeight || 0.7;
  return normalize(
    baseDir.x * forwardWeight + side.x * profile.driftStrength,
    baseDir.y * forwardWeight + side.y * profile.driftStrength,
    baseDir
  );
}

function startFeint(game, enemy, profile, distanceToTarget) {
  const tactical = ensureTacticalRuntime(enemy);
  tactical.mode = "feint";
  tactical.feintBurstsRemaining = profile.feintCycles * 2;
  tactical.feintTimer = profile.feintBurstDuration;
  tactical.feintSign = 1;
  tactical.commitTimer = profile.feintCommitDuration;
  tactical.commitMode = distanceToTarget > (enemy.preferredRange || 140) ? "advance" : (Math.random() < 0.5 ? "advance" : "retreat");
  tactical.nextFeintAt = game.time + profile.feintCooldown;
  logTacticMove(game, enemy, tactical, "feint_start", `(commit=${tactical.commitMode})`);
}

function updateFeintMovement(game, enemy, dirToTarget, profile, dt) {
  const tactical = ensureTacticalRuntime(enemy);
  if (tactical.feintBurstsRemaining > 0) {
    tactical.feintTimer -= dt;
    const side = getPerpendicular(dirToTarget, tactical.feintSign > 0);
    const burstDir = normalize(
      side.x * (profile.feintLateralWeight || 0.3),
      side.y * (profile.feintLateralWeight || 0.3),
      side
    );
    if (tactical.feintTimer <= 0) {
      tactical.feintBurstsRemaining -= 1;
      tactical.feintTimer = profile.feintBurstDuration;
      tactical.feintSign *= -1;
    }
    logTacticMove(game, enemy, tactical, "feint_burst", `(remaining=${tactical.feintBurstsRemaining})`);
    return { dir: burstDir, speedMult: profile.feintBurstSpeedMult || 0.4 };
  }

  if (tactical.commitTimer > 0) {
    tactical.commitTimer -= dt;
    const signValue = tactical.commitMode === "retreat" ? -1 : 1;
    const commitDir = normalize(dirToTarget.x * signValue, dirToTarget.y * signValue, dirToTarget);
    if (tactical.commitTimer <= 0) tactical.mode = "idle";
    logTacticMove(game, enemy, tactical, "feint_commit", `(mode=${tactical.commitMode})`);
    return { dir: commitDir, speedMult: profile.feintSpeedMult };
  }

  tactical.mode = "idle";
  return null;
}

export function noteEnemyAttackFinished(game, enemy) {
  const tactical = ensureTacticalRuntime(enemy);
  const profile = getEnemyTacticProfile(game, enemy, "cooldown_kite");
  tactical.postAttackKiteTimer = Math.max(tactical.postAttackKiteTimer || 0, profile.postAttackKiteDuration);
}

export function getTacticalMovementCommand(game, enemy, dirToTarget, distanceToTarget, dt) {
  const feintProfile = getEnemyTacticProfile(game, enemy, "feint_entry");
  const driftProfile = getEnemyTacticProfile(game, enemy, "drift_noise");
  const kiteProfile = getEnemyTacticProfile(game, enemy, "cooldown_kite");
  const pressureProfile = getEnemyTacticProfile(game, enemy, "strafe_pressure");
  const tactical = ensureTacticalRuntime(enemy);
  tactical.postAttackKiteTimer = Math.max(0, tactical.postAttackKiteTimer - dt);
  tactical.driftTimer = Math.max(0, (tactical.driftTimer || 0) - dt);

  if (tactical.mode === "feint") {
    const feintMove = updateFeintMovement(game, enemy, dirToTarget, feintProfile, dt);
    if (feintMove) return feintMove;
  }

  const desiredRange = Math.max(80, (enemy.preferredRange || 120) + kiteProfile.kitePadding);
  const rangeTolerance = kiteProfile.rangeTolerance;
  const attackReady = hasReadyAttack(enemy, distanceToTarget, game.time);
  const inFeintWindow = distanceToTarget <= desiredRange + 90
    && distanceToTarget >= Math.max(40, desiredRange - 80);
  let shouldFeint = false;
  if (
    attackReady
    && inFeintWindow
    && game.time >= (tactical.nextFeintAt || 0)
    && game.time >= (tactical.nextFeintRollAt || 0)
  ) {
    tactical.nextFeintRollAt = game.time + 0.35;
    const feintRollChance = enemy.role === "melee"
      ? Math.max(0.45, feintProfile.feintChance || 0)
      : (feintProfile.feintChance || 0);
    shouldFeint = Math.random() < feintRollChance;
  }

  if (shouldFeint) {
    startFeint(game, enemy, feintProfile, distanceToTarget);
    const feintMove = updateFeintMovement(game, enemy, dirToTarget, feintProfile, dt);
    if (feintMove) return feintMove;
  }

  let baseDir = { x: 0, y: 0 };

  if (tactical.postAttackKiteTimer > 0 || (!attackReady && enemy.role !== "melee")) {
    if (distanceToTarget < desiredRange - rangeTolerance) {
      baseDir = normalize(-dirToTarget.x, -dirToTarget.y, { x: -1, y: 0 });
    } else if (distanceToTarget > desiredRange + rangeTolerance) {
      const advanceScale = enemy.role === "melee" ? 1 : 0.45;
      baseDir = normalize(dirToTarget.x * advanceScale, dirToTarget.y * advanceScale, dirToTarget);
    } else {
      const strafeClockwise = Math.sin(game.time * 0.7 + tactical.noiseOffset) >= 0;
      const side = getPerpendicular(dirToTarget, strafeClockwise);
      baseDir = normalize(side.x, side.y, dirToTarget);
    }
  } else if (enemy.role === "ranged") {
    if (distanceToTarget > desiredRange + 35) {
      baseDir = dirToTarget;
    } else if (distanceToTarget < desiredRange - 45) {
      baseDir = normalize(-dirToTarget.x, -dirToTarget.y, { x: -1, y: 0 });
    } else {
      const strafeClockwise = Math.sin(game.time * 0.8 + tactical.noiseOffset) >= 0;
      const side = getPerpendicular(dirToTarget, strafeClockwise);
      baseDir = normalize(dirToTarget.x * 0.08 + side.x * pressureProfile.strafeWeight, dirToTarget.y * 0.08 + side.y * pressureProfile.strafeWeight, side);
    }
  } else if (enemy.role === "skirmisher") {
    const strafeClockwise = Math.sin(game.time * 1.1 + tactical.noiseOffset) >= 0;
    const side = getPerpendicular(dirToTarget, strafeClockwise);
    baseDir = normalize(
      dirToTarget.x * 0.56 + side.x * pressureProfile.strafeWeight,
      dirToTarget.y * 0.56 + side.y * pressureProfile.strafeWeight,
      dirToTarget
    );
  } else {
    baseDir = dirToTarget;
  }

  return {
    dir: applyDriftNoise(game, enemy, baseDir, driftProfile, tactical),
    facingDir: baseDir,
    speedMult: 1
  };
}
