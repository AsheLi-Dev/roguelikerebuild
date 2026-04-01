import { centerOf, clamp, normalize, rectsOverlap } from "../core/runtime-utils.js";
import { getBlockingBreakableRects } from "./breakables.js";

const NAV_STUCK_THRESHOLD = 0.16;
const NAV_PROGRESS_RATIO = 0.12;
const NAV_MIN_PROGRESS = 0.6;
const NAV_MIN_TRAVEL = 1;
const NAV_PATH_FAIL_COOLDOWN = 0.28;
const NAV_PATH_SUCCESS_COOLDOWN = 0.18;
const NAV_PATH_TARGET_DRIFT = 96;
const NAV_PATH_GOAL_PADDING = 18;
const NAV_PATH_WAYPOINT_RADIUS = 12;
const NAV_PATH_MAX_EXPANSIONS = 2200;

const PATH_NEIGHBORS = Object.freeze([
  Object.freeze({ x: 1, y: 0, cost: 1 }),
  Object.freeze({ x: -1, y: 0, cost: 1 }),
  Object.freeze({ x: 0, y: 1, cost: 1 }),
  Object.freeze({ x: 0, y: -1, cost: 1 }),
  Object.freeze({ x: 1, y: 1, cost: Math.SQRT2 }),
  Object.freeze({ x: 1, y: -1, cost: Math.SQRT2 }),
  Object.freeze({ x: -1, y: 1, cost: Math.SQRT2 }),
  Object.freeze({ x: -1, y: -1, cost: Math.SQRT2 })
]);

export function createEnemyNavState() {
  return {
    stuckTimer: 0,
    lastX: Number.NaN,
    lastY: Number.NaN,
    detourDirX: 0,
    detourDirY: 0,
    detourTimer: 0,
    lastSideSign: 0,
    repathCooldown: 0,
    pathPoints: null,
    pathIndex: 0,
    pathGoalX: Number.NaN,
    pathGoalY: Number.NaN,
    pathGoalRadius: 0,
    pathWorldVersion: -1,
    pathBreakablesVersion: -1
  };
}

function ensureEnemyNavState(enemy) {
  enemy.state ||= {};
  enemy.state.nav ||= createEnemyNavState();
  return enemy.state.nav;
}

function clearDetour(nav) {
  nav.detourDirX = 0;
  nav.detourDirY = 0;
  nav.detourTimer = 0;
}

function clearPath(nav) {
  nav.pathPoints = null;
  nav.pathIndex = 0;
  nav.pathGoalX = Number.NaN;
  nav.pathGoalY = Number.NaN;
  nav.pathGoalRadius = 0;
  nav.pathWorldVersion = -1;
  nav.pathBreakablesVersion = -1;
}

function hasPath(nav) {
  return Array.isArray(nav.pathPoints) && nav.pathIndex < nav.pathPoints.length;
}

function getEnemyBlockers(game, room, enemy) {
  if (enemy?.ignoreWalls) return [];
  if (game?.getCollisionBlockers) {
    return game.getCollisionBlockers({ includeBreakables: true });
  }
  const blockers = [...(room?.collisionRects || [])];
  if (game) blockers.push(...getBlockingBreakableRects(game));
  return blockers;
}

function simulateMove(enemy, room, dx, dy, blockers) {
  const nextX = clamp(enemy.x + dx, 0, room.width - enemy.w);
  const nextY = clamp(enemy.y + dy, 0, room.height - enemy.h);
  const testX = { x: nextX, y: enemy.y, w: enemy.w, h: enemy.h };
  const testY = { x: enemy.x, y: nextY, w: enemy.w, h: enemy.h };
  let moveX = nextX;
  let moveY = nextY;

  for (const blocker of blockers) {
    if (rectsOverlap(testX, blocker)) moveX = enemy.x;
    if (rectsOverlap(testY, blocker)) moveY = enemy.y;
  }

  return {
    x: moveX,
    y: moveY,
    moved: moveX !== enemy.x || moveY !== enemy.y
  };
}

function getPathCellSize(room) {
  return Math.max(16, Number(room?.tileSize) || 32);
}

function toCellKey(cellX, cellY) {
  return `${cellX},${cellY}`;
}

function fromCellKey(key) {
  const separatorIndex = key.indexOf(",");
  return {
    x: Number(key.slice(0, separatorIndex)),
    y: Number(key.slice(separatorIndex + 1))
  };
}

function getCellCenter(cellX, cellY, cellSize) {
  return {
    x: cellX * cellSize + cellSize * 0.5,
    y: cellY * cellSize + cellSize * 0.5
  };
}

function getEnemyRectAtCell(room, enemy, cellX, cellY, cellSize) {
  const center = getCellCenter(cellX, cellY, cellSize);
  return {
    x: clamp(center.x - enemy.w * 0.5, 0, Math.max(0, room.width - enemy.w)),
    y: clamp(center.y - enemy.h * 0.5, 0, Math.max(0, room.height - enemy.h)),
    w: enemy.w,
    h: enemy.h
  };
}

function isCellPassable(room, enemy, blockers, cellX, cellY, cellSize, cache, startKey = null) {
  const cols = Math.max(1, Math.ceil(room.width / cellSize));
  const rows = Math.max(1, Math.ceil(room.height / cellSize));
  if (cellX < 0 || cellY < 0 || cellX >= cols || cellY >= rows) return false;

  const key = toCellKey(cellX, cellY);
  if (startKey && key === startKey) return true;
  if (cache.has(key)) return cache.get(key);

  const rect = getEnemyRectAtCell(room, enemy, cellX, cellY, cellSize);
  let passable = true;
  for (const blocker of blockers) {
    if (rectsOverlap(rect, blocker)) {
      passable = false;
      break;
    }
  }
  cache.set(key, passable);
  return passable;
}

function getPathGoalRadius(enemy, options, cellSize) {
  const clearDistanceThreshold = Number.isFinite(options.clearDistanceThreshold)
    ? Math.max(0, options.clearDistanceThreshold)
    : 0;
  const rangeGoalRadius = clearDistanceThreshold > 0
    ? Math.max(0, clearDistanceThreshold - cellSize * 0.4)
    : 0;
  const bodyGoalRadius = Math.max(enemy.w, enemy.h) * 0.55 + cellSize * 0.25;
  return Math.max(rangeGoalRadius, bodyGoalRadius, NAV_PATH_GOAL_PADDING);
}

function getCellHeuristic(cellX, cellY, targetPoint, cellSize, goalRadius) {
  const center = getCellCenter(cellX, cellY, cellSize);
  return Math.max(0, Math.hypot(targetPoint.x - center.x, targetPoint.y - center.y) - goalRadius);
}

function isGoalCell(cellX, cellY, targetPoint, cellSize, goalRadius) {
  const center = getCellCenter(cellX, cellY, cellSize);
  return Math.hypot(targetPoint.x - center.x, targetPoint.y - center.y) <= goalRadius;
}

function isLowerScoreNode(a, b) {
  if (a.score !== b.score) return a.score < b.score;
  return a.heuristic < b.heuristic;
}

function pushPathNode(heap, node) {
  heap.push(node);
  let index = heap.length - 1;
  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2);
    if (!isLowerScoreNode(heap[index], heap[parentIndex])) break;
    [heap[index], heap[parentIndex]] = [heap[parentIndex], heap[index]];
    index = parentIndex;
  }
}

function popPathNode(heap) {
  if (!heap.length) return null;
  const first = heap[0];
  const last = heap.pop();
  if (!heap.length) return first;

  heap[0] = last;
  let index = 0;
  while (true) {
    const leftIndex = index * 2 + 1;
    const rightIndex = leftIndex + 1;
    let smallestIndex = index;

    if (leftIndex < heap.length && isLowerScoreNode(heap[leftIndex], heap[smallestIndex])) {
      smallestIndex = leftIndex;
    }
    if (rightIndex < heap.length && isLowerScoreNode(heap[rightIndex], heap[smallestIndex])) {
      smallestIndex = rightIndex;
    }
    if (smallestIndex === index) break;
    [heap[index], heap[smallestIndex]] = [heap[smallestIndex], heap[index]];
    index = smallestIndex;
  }
  return first;
}

function reconstructPathPoints(cameFrom, endKey, cellSize) {
  const cells = [];
  let cursorKey = endKey;
  while (cursorKey) {
    cells.push(fromCellKey(cursorKey));
    cursorKey = cameFrom.get(cursorKey) || null;
  }
  cells.reverse();
  if (cells.length <= 1) return [];

  const simplified = [cells[0]];
  let prevDirX = 0;
  let prevDirY = 0;
  for (let index = 1; index < cells.length; index += 1) {
    const previous = cells[index - 1];
    const current = cells[index];
    const dirX = current.x - previous.x;
    const dirY = current.y - previous.y;
    if (index > 1 && (dirX !== prevDirX || dirY !== prevDirY)) {
      simplified.push(previous);
    }
    prevDirX = dirX;
    prevDirY = dirY;
  }
  simplified.push(cells[cells.length - 1]);
  return simplified.slice(1).map((cell) => getCellCenter(cell.x, cell.y, cellSize));
}

function findPathToTarget(room, enemy, targetPoint, blockers, goalRadius) {
  if (!room || !targetPoint) return null;

  const cellSize = getPathCellSize(room);
  const cols = Math.max(1, Math.ceil(room.width / cellSize));
  const rows = Math.max(1, Math.ceil(room.height / cellSize));
  const enemyCenter = centerOf(enemy);
  const startCellX = clamp(Math.floor(enemyCenter.x / cellSize), 0, cols - 1);
  const startCellY = clamp(Math.floor(enemyCenter.y / cellSize), 0, rows - 1);
  const startKey = toCellKey(startCellX, startCellY);
  if (isGoalCell(startCellX, startCellY, targetPoint, cellSize, goalRadius)) return [];

  const passabilityCache = new Map();
  const openHeap = [];
  const closed = new Set();
  const cameFrom = new Map();
  const bestCost = new Map([[startKey, 0]]);
  const startHeuristic = getCellHeuristic(startCellX, startCellY, targetPoint, cellSize, goalRadius);
  pushPathNode(openHeap, {
    cellX: startCellX,
    cellY: startCellY,
    key: startKey,
    cost: 0,
    heuristic: startHeuristic,
    score: startHeuristic
  });

  let expansions = 0;
  while (openHeap.length > 0 && expansions < NAV_PATH_MAX_EXPANSIONS) {
    const current = popPathNode(openHeap);
    if (!current || closed.has(current.key)) continue;
    expansions += 1;

    if (isGoalCell(current.cellX, current.cellY, targetPoint, cellSize, goalRadius)) {
      return reconstructPathPoints(cameFrom, current.key, cellSize);
    }

    closed.add(current.key);

    for (const neighbor of PATH_NEIGHBORS) {
      const nextCellX = current.cellX + neighbor.x;
      const nextCellY = current.cellY + neighbor.y;
      if (nextCellX < 0 || nextCellY < 0 || nextCellX >= cols || nextCellY >= rows) continue;

      const nextKey = toCellKey(nextCellX, nextCellY);
      if (closed.has(nextKey)) continue;
      if (!isCellPassable(room, enemy, blockers, nextCellX, nextCellY, cellSize, passabilityCache, startKey)) continue;

      if (neighbor.x !== 0 && neighbor.y !== 0) {
        const xStepPassable = isCellPassable(
          room,
          enemy,
          blockers,
          current.cellX + neighbor.x,
          current.cellY,
          cellSize,
          passabilityCache,
          startKey
        );
        const yStepPassable = isCellPassable(
          room,
          enemy,
          blockers,
          current.cellX,
          current.cellY + neighbor.y,
          cellSize,
          passabilityCache,
          startKey
        );
        if (!xStepPassable || !yStepPassable) continue;
      }

      const nextCost = current.cost + neighbor.cost;
      if (nextCost >= (bestCost.get(nextKey) ?? Infinity)) continue;

      cameFrom.set(nextKey, current.key);
      bestCost.set(nextKey, nextCost);
      const heuristic = getCellHeuristic(nextCellX, nextCellY, targetPoint, cellSize, goalRadius);
      pushPathNode(openHeap, {
        cellX: nextCellX,
        cellY: nextCellY,
        key: nextKey,
        cost: nextCost,
        heuristic,
        score: nextCost + heuristic
      });
    }
  }

  return null;
}

function pathVersionsMatch(nav, game, room) {
  return nav.pathWorldVersion === (room?.collisionVersion || 0)
    && nav.pathBreakablesVersion === (game?.runtimeVersions?.breakables || 0);
}

function shouldKeepPath(nav, game, room, targetPoint, goalRadius, behavior) {
  if (!hasPath(nav) || behavior !== "advance" || !targetPoint) return false;
  if (!pathVersionsMatch(nav, game, room)) return false;
  if (Math.hypot((nav.pathGoalX || 0) - targetPoint.x, (nav.pathGoalY || 0) - targetPoint.y) > NAV_PATH_TARGET_DRIFT) {
    return false;
  }
  return Math.abs((nav.pathGoalRadius || 0) - goalRadius) <= getPathCellSize(room);
}

function setPath(nav, pathPoints, targetPoint, goalRadius, game, room) {
  nav.pathPoints = pathPoints;
  nav.pathIndex = 0;
  nav.pathGoalX = targetPoint.x;
  nav.pathGoalY = targetPoint.y;
  nav.pathGoalRadius = goalRadius;
  nav.pathWorldVersion = room?.collisionVersion || 0;
  nav.pathBreakablesVersion = game?.runtimeVersions?.breakables || 0;
}

function consumePathWaypoint(nav, enemy, travelDistance) {
  if (!hasPath(nav)) return null;
  const enemyCenter = centerOf(enemy);
  const reachRadius = Math.max(
    NAV_PATH_WAYPOINT_RADIUS,
    travelDistance * 0.75,
    Math.max(enemy.w, enemy.h) * 0.35
  );

  while (nav.pathIndex < nav.pathPoints.length) {
    const waypoint = nav.pathPoints[nav.pathIndex];
    if (Math.hypot(waypoint.x - enemyCenter.x, waypoint.y - enemyCenter.y) > reachRadius) {
      return waypoint;
    }
    nav.pathIndex += 1;
  }

  clearPath(nav);
  return null;
}

function buildCandidateDirections(baseDir) {
  const left = { x: -baseDir.y, y: baseDir.x };
  const right = { x: baseDir.y, y: -baseDir.x };
  return [
    { dir: baseDir, sideSign: 0, lockTime: 0 },
    { dir: normalize(baseDir.x + left.x * 0.35, baseDir.y + left.y * 0.35, baseDir), sideSign: -1, lockTime: 0.24 },
    { dir: normalize(baseDir.x + right.x * 0.35, baseDir.y + right.y * 0.35, baseDir), sideSign: 1, lockTime: 0.24 },
    { dir: normalize(baseDir.x + left.x * 0.9, baseDir.y + left.y * 0.9, left), sideSign: -1, lockTime: 0.36 },
    { dir: normalize(baseDir.x + right.x * 0.9, baseDir.y + right.y * 0.9, right), sideSign: 1, lockTime: 0.36 },
    { dir: left, sideSign: -1, lockTime: 0.42 },
    { dir: right, sideSign: 1, lockTime: 0.42 }
  ];
}

function scoreCandidate(enemy, candidate, targetPoint, behavior, desiredRange, blockers, room, travelDistance, nav) {
  const sim = simulateMove(
    enemy,
    room,
    candidate.dir.x * travelDistance,
    candidate.dir.y * travelDistance,
    blockers
  );

  let score = sim.moved ? 100 : -100;
  if (!sim.moved) return { ...candidate, score, moved: false };

  const currentCenter = centerOf(enemy);
  const nextCenter = {
    x: sim.x + enemy.w * 0.5,
    y: sim.y + enemy.h * 0.5
  };

  if (targetPoint) {
    const currentDistance = Math.hypot(targetPoint.x - currentCenter.x, targetPoint.y - currentCenter.y);
    const nextDistance = Math.hypot(targetPoint.x - nextCenter.x, targetPoint.y - nextCenter.y);
    if (behavior === "retreat") {
      score += (nextDistance - currentDistance) * 0.4;
    } else if (behavior === "hold") {
      score -= Math.abs(nextDistance - desiredRange) * 0.18;
    } else {
      score += (currentDistance - nextDistance) * 0.4;
    }
  }

  if (candidate.sideSign !== 0 && candidate.sideSign === nav.lastSideSign) score += 4;
  if (candidate.sideSign !== 0) score += 1.5;
  return { ...candidate, score, moved: true };
}

export function resolveEnemyWallOverlap(game, enemy, room) {
  if (!room || enemy.ignoreWalls) return false;
  const blockers = getEnemyBlockers(game, room, enemy);
  if (!blockers.length) return false;
  let moved = false;

  for (let pass = 0; pass < 3; pass += 1) {
    let adjustedThisPass = false;
    for (const blocker of blockers) {
      if (!rectsOverlap(enemy, blocker)) continue;
      const enemyCenterX = enemy.x + enemy.w * 0.5;
      const enemyCenterY = enemy.y + enemy.h * 0.5;
      const blockerCenterX = blocker.x + blocker.w * 0.5;
      const blockerCenterY = blocker.y + blocker.h * 0.5;
      const overlapX = enemy.w * 0.5 + blocker.w * 0.5 - Math.abs(enemyCenterX - blockerCenterX);
      const overlapY = enemy.h * 0.5 + blocker.h * 0.5 - Math.abs(enemyCenterY - blockerCenterY);
      if (overlapX <= 0 || overlapY <= 0) continue;
      if (overlapX < overlapY) {
        enemy.x += enemyCenterX < blockerCenterX ? -overlapX : overlapX;
      } else {
        enemy.y += enemyCenterY < blockerCenterY ? -overlapY : overlapY;
      }
      enemy.x = clamp(enemy.x, 0, room.width - enemy.w);
      enemy.y = clamp(enemy.y, 0, room.height - enemy.h);
      adjustedThisPass = true;
      moved = true;
    }
    if (!adjustedThisPass) break;
  }

  return moved;
}

export function tryMoveEnemy(game, enemy, room, dx, dy) {
  const previousX = enemy.x;
  const previousY = enemy.y;
  const nextX = clamp(enemy.x + dx, 0, room.width - enemy.w);
  const nextY = clamp(enemy.y + dy, 0, room.height - enemy.h);

  if (enemy.ignoreWalls) {
    enemy.x = nextX;
    enemy.y = nextY;
    return enemy.x !== previousX || enemy.y !== previousY;
  }

  const blockers = getEnemyBlockers(game, room, enemy);
  const sim = simulateMove(enemy, room, dx, dy, blockers);
  enemy.x = sim.x;
  enemy.y = sim.y;
  resolveEnemyWallOverlap(game, enemy, room);
  return enemy.x !== previousX || enemy.y !== previousY;
}

export function computeEnemyMoveVector(game, enemy, desiredDir, targetPoint, dt, options = {}) {
  const fallback = options.fallbackDir || { x: 1, y: 0 };
  const baseDir = normalize(desiredDir?.x || 0, desiredDir?.y || 0, fallback);
  const speedMult = options.speedMult ?? 1;
  const desiredMagnitude = Math.hypot(desiredDir?.x || 0, desiredDir?.y || 0);
  const nav = ensureEnemyNavState(enemy);

  nav.detourTimer = Math.max(0, (nav.detourTimer || 0) - dt);
  nav.repathCooldown = Math.max(0, (nav.repathCooldown || 0) - dt);

  if (enemy.ignoreWalls || desiredMagnitude < 0.001) {
    nav.stuckTimer = 0;
    clearDetour(nav);
    clearPath(nav);
    nav.lastX = enemy.x;
    nav.lastY = enemy.y;
    return { dir: baseDir, speedMult, usedDetour: false };
  }

  const room = game.world;
  const blockers = getEnemyBlockers(game, room, enemy);
  const behavior = options.behavior || "advance";
  const travelDistance = Math.max(
    NAV_MIN_TRAVEL,
    options.travelDistance ?? enemy.speed * speedMult * dt
  );
  const progress = Math.hypot(
    enemy.x - (Number.isFinite(nav.lastX) ? nav.lastX : enemy.x),
    enemy.y - (Number.isFinite(nav.lastY) ? nav.lastY : enemy.y)
  );
  const minProgress = Math.max(NAV_MIN_PROGRESS, travelDistance * NAV_PROGRESS_RATIO);
  const currentDistanceToTarget = targetPoint
    ? Math.hypot(targetPoint.x - (enemy.x + enemy.w * 0.5), targetPoint.y - (enemy.y + enemy.h * 0.5))
    : Infinity;
  const clearDistanceThreshold = Number.isFinite(options.clearDistanceThreshold)
    ? options.clearDistanceThreshold
    : null;
  const goalRadius = behavior === "advance" && targetPoint
    ? getPathGoalRadius(enemy, options, getPathCellSize(room))
    : 0;

  if (progress < minProgress) nav.stuckTimer += dt;
  else nav.stuckTimer = Math.max(0, nav.stuckTimer - dt * 2);

  const directSim = simulateMove(enemy, room, baseDir.x * travelDistance, baseDir.y * travelDistance, blockers);

  if (clearDistanceThreshold != null && currentDistanceToTarget <= clearDistanceThreshold) {
    nav.stuckTimer = 0;
    clearDetour(nav);
    clearPath(nav);
    nav.lastX = enemy.x;
    nav.lastY = enemy.y;
    return { dir: baseDir, speedMult, usedDetour: false };
  }

  if (behavior !== "advance" || !targetPoint || currentDistanceToTarget <= goalRadius) {
    clearPath(nav);
  }

  if (directSim.moved && progress >= minProgress * 0.75 && nav.stuckTimer <= 0.06 && !hasPath(nav)) {
    nav.stuckTimer = 0;
    clearDetour(nav);
  }

  if (hasPath(nav)) {
    if (!shouldKeepPath(nav, game, room, targetPoint, goalRadius, behavior)) {
      clearPath(nav);
    } else {
      const waypoint = consumePathWaypoint(nav, enemy, travelDistance);
      if (waypoint) {
        nav.lastX = enemy.x;
        nav.lastY = enemy.y;
        const enemyCenter = centerOf(enemy);
        return {
          dir: normalize(waypoint.x - enemyCenter.x, waypoint.y - enemyCenter.y, baseDir),
          speedMult,
          usedDetour: true
        };
      }
    }
  }

  if (nav.detourTimer > 0 && Math.hypot(nav.detourDirX || 0, nav.detourDirY || 0) > 0.001) {
    nav.lastX = enemy.x;
    nav.lastY = enemy.y;
    if (!directSim.moved || nav.stuckTimer > 0.04) {
      return {
        dir: normalize(nav.detourDirX, nav.detourDirY, baseDir),
        speedMult,
        usedDetour: true
      };
    }
    clearDetour(nav);
  }

  const shouldRepath = nav.stuckTimer >= NAV_STUCK_THRESHOLD || (!directSim.moved && nav.repathCooldown <= 0);
  if (!shouldRepath) {
    nav.lastX = enemy.x;
    nav.lastY = enemy.y;
    return { dir: baseDir, speedMult, usedDetour: false };
  }

  if (behavior === "advance" && targetPoint) {
    const pathPoints = findPathToTarget(room, enemy, targetPoint, blockers, goalRadius);
    if (Array.isArray(pathPoints) && pathPoints.length > 0) {
      clearDetour(nav);
      setPath(nav, pathPoints, targetPoint, goalRadius, game, room);
      nav.repathCooldown = NAV_PATH_SUCCESS_COOLDOWN;
      const waypoint = consumePathWaypoint(nav, enemy, travelDistance);
      if (waypoint) {
        nav.lastX = enemy.x;
        nav.lastY = enemy.y;
        const enemyCenter = centerOf(enemy);
        return {
          dir: normalize(waypoint.x - enemyCenter.x, waypoint.y - enemyCenter.y, baseDir),
          speedMult,
          usedDetour: true
        };
      }
      clearPath(nav);
    } else if (pathPoints == null) {
      nav.repathCooldown = NAV_PATH_FAIL_COOLDOWN;
    }
  }

  const desiredRange = options.desiredRange ?? enemy.preferredRange ?? currentDistanceToTarget;
  const candidates = buildCandidateDirections(baseDir).map((candidate) =>
    scoreCandidate(enemy, candidate, targetPoint, behavior, desiredRange, blockers, room, travelDistance, nav)
  );
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  nav.lastX = enemy.x;
  nav.lastY = enemy.y;

  if (!best?.moved) {
    nav.repathCooldown = Math.max(nav.repathCooldown, 0.1);
    return { dir: baseDir, speedMult, usedDetour: false };
  }

  if (best.sideSign !== 0) {
    nav.detourDirX = best.dir.x;
    nav.detourDirY = best.dir.y;
    nav.detourTimer = best.lockTime;
    nav.lastSideSign = best.sideSign;
    nav.repathCooldown = 0.12;
  } else {
    clearDetour(nav);
    nav.repathCooldown = 0.06;
  }

  return {
    dir: best.dir,
    speedMult,
    usedDetour: best.sideSign !== 0
  };
}
