import { clamp, normalize } from "../core/runtime-utils.js";
import { getBlockingBreakableRects } from "./breakables.js";
import {
  circleOverlapsBlocker,
  getBlockerCircle,
  getEnemyMovementCircleAt,
  getShortestCircleCircleSeparation,
  getShortestCircleRectSeparation
} from "./enemy-movement-collider.js";
import { shouldPlayerBlockEnemies } from "./player-collision.js";

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
const NAV_GRID_CACHE = new WeakMap();
const OVERLAP_BLOCKER_INDEX_CACHE = new WeakMap();
const COLLISION_BOUNCE_DURATION = 0.1;
const COLLISION_BOUNCE_DISTANCE = 4;
const COLLISION_BOUNCE_COOLDOWN = 0.14;
const MOVEMENT_CLEARANCE = 3;

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
    pathBreakablesVersion: -1,
    overlapResolveX: Number.NaN,
    overlapResolveY: Number.NaN,
    overlapResolveWorldVersion: -1,
    overlapResolveBreakablesVersion: -1
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

function getDynamicBlockers(game, enemy) {
  if (!game) return [];
  const blockers = [];
  if (shouldPlayerBlockEnemies(game.player)) blockers.push(game.player);
  for (const otherEnemy of game.getLivingEnemies?.() || game.enemies || []) {
    if (!otherEnemy || otherEnemy.dead || otherEnemy === enemy) continue;
    blockers.push(otherEnemy);
  }
  return blockers;
}

function getOverlapBlockerIndexCellSize(room) {
  return Math.max(32, Number(room?.tileSize) || 32);
}

function buildOverlapBlockerIndex(blockers, room) {
  const cellSize = getOverlapBlockerIndexCellSize(room);
  const cells = new Map();

  for (let index = 0; index < blockers.length; index += 1) {
    const blocker = blockers[index];
    if (!blocker) continue;
    const minCellX = Math.floor(blocker.x / cellSize);
    const maxCellX = Math.floor((blocker.x + blocker.w) / cellSize);
    const minCellY = Math.floor(blocker.y / cellSize);
    const maxCellY = Math.floor((blocker.y + blocker.h) / cellSize);
    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const key = toCellKey(cellX, cellY);
        let bucket = cells.get(key);
        if (!bucket) {
          bucket = [];
          cells.set(key, bucket);
        }
        bucket.push(index);
      }
    }
  }

  return {
    cellSize,
    cells,
    marks: new Uint32Array(blockers.length),
    queryStamp: 0
  };
}

function getOverlapBlockerIndex(blockers, room) {
  if (!Array.isArray(blockers) || !blockers.length) return null;
  const cellSize = getOverlapBlockerIndexCellSize(room);
  const cached = OVERLAP_BLOCKER_INDEX_CACHE.get(blockers);
  if (cached?.cellSize === cellSize) return cached;
  const next = buildOverlapBlockerIndex(blockers, room);
  OVERLAP_BLOCKER_INDEX_CACHE.set(blockers, next);
  return next;
}

function getNearbyOverlapBlockers(blockers, room, circle) {
  if (!Array.isArray(blockers) || blockers.length <= 12 || !circle) return blockers;
  const index = getOverlapBlockerIndex(blockers, room);
  if (!index) return blockers;
  let queryStamp = index.queryStamp + 1;
  if (queryStamp >= 0xffffffff) {
    index.marks.fill(0);
    queryStamp = 1;
  }
  index.queryStamp = queryStamp;

  const minCellX = Math.floor((circle.x - circle.radius) / index.cellSize);
  const maxCellX = Math.floor((circle.x + circle.radius) / index.cellSize);
  const minCellY = Math.floor((circle.y - circle.radius) / index.cellSize);
  const maxCellY = Math.floor((circle.y + circle.radius) / index.cellSize);
  const result = [];

  for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      const bucket = index.cells.get(toCellKey(cellX, cellY));
      if (!bucket) continue;
      for (const blockerIndex of bucket) {
        if (index.marks[blockerIndex] === queryStamp) continue;
        index.marks[blockerIndex] = queryStamp;
        result.push(blockers[blockerIndex]);
      }
    }
  }

  return result;
}

function clampEnemyPositionToRoom(enemy, room, x, y) {
  let nextX = clamp(x, 0, room.width - enemy.w);
  let nextY = clamp(y, 0, room.height - enemy.h);
  const circle = getEnemyMovementCircleAt(enemy, nextX, nextY);
  if (circle.x - circle.radius < 0) nextX += -(circle.x - circle.radius);
  if (circle.y - circle.radius < 0) nextY += -(circle.y - circle.radius);
  if (circle.x + circle.radius > room.width) nextX -= circle.x + circle.radius - room.width;
  if (circle.y + circle.radius > room.height) nextY -= circle.y + circle.radius - room.height;
  return {
    x: clamp(nextX, 0, room.width - enemy.w),
    y: clamp(nextY, 0, room.height - enemy.h)
  };
}

function applyClampedEnemyPosition(enemy, room) {
  const clamped = clampEnemyPositionToRoom(enemy, room, enemy.x, enemy.y);
  if (clamped.x === enemy.x && clamped.y === enemy.y) return false;
  enemy.x = clamped.x;
  enemy.y = clamped.y;
  return true;
}

function triggerCollisionBounce(enemy, dx, dy, strength = 1) {
  if (!enemy) return;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return;
  const bounceDistance = COLLISION_BOUNCE_DISTANCE * Math.max(0.35, Math.min(1, strength));
  enemy.collisionBounceOffsetX = (-dx / length) * bounceDistance;
  enemy.collisionBounceOffsetY = (-dy / length) * bounceDistance;
  enemy.collisionBounceDuration = COLLISION_BOUNCE_DURATION;
  enemy.collisionBounceTimer = COLLISION_BOUNCE_DURATION;
  enemy.collisionBounceCooldownTimer = COLLISION_BOUNCE_COOLDOWN;
}

function getClearanceCircle(enemy, x = enemy?.x || 0, y = enemy?.y || 0, extraRadius = MOVEMENT_CLEARANCE) {
  const circle = getEnemyMovementCircleAt(enemy, x, y);
  return {
    ...circle,
    radius: circle.radius + Math.max(0, extraRadius)
  };
}

function markOverlapResolved(nav, enemy, room, game) {
  nav.overlapResolveX = enemy.x;
  nav.overlapResolveY = enemy.y;
  nav.overlapResolveWorldVersion = room?.collisionVersion || 0;
  nav.overlapResolveBreakablesVersion = game?.runtimeVersions?.breakables || 0;
}

function clearOverlapResolved(nav) {
  nav.overlapResolveX = Number.NaN;
  nav.overlapResolveY = Number.NaN;
  nav.overlapResolveWorldVersion = -1;
  nav.overlapResolveBreakablesVersion = -1;
}

function canSkipOverlapResolution(nav, enemy, room, game, circle, playerBlocker) {
  if (!Number.isFinite(nav.overlapResolveX) || !Number.isFinite(nav.overlapResolveY)) return false;
  if (nav.overlapResolveX !== enemy.x || nav.overlapResolveY !== enemy.y) return false;
  if (nav.overlapResolveWorldVersion !== (room?.collisionVersion || 0)) return false;
  if (nav.overlapResolveBreakablesVersion !== (game?.runtimeVersions?.breakables || 0)) return false;
  if (!playerBlocker) return true;
  const playerCircle = getBlockerCircle(playerBlocker);
  return !(playerCircle
    ? circleOverlapsBlocker(circle, playerCircle)
    : circleOverlapsBlocker(circle, playerBlocker));
}

function hasRemainingOverlap(blockers, room, circle, playerBlocker) {
  for (const blocker of getNearbyOverlapBlockers(blockers, room, circle)) {
    if (getShortestCircleRectSeparation(circle, blocker)) return true;
  }
  if (!playerBlocker) return false;
  const blockerCircle = getBlockerCircle(playerBlocker);
  return blockerCircle
    ? !!getShortestCircleCircleSeparation(circle, blockerCircle)
    : !!getShortestCircleRectSeparation(circle, playerBlocker);
}

function circlesOverlapDynamicBlocker(testCircle, currentCircle, blocker) {
  if (!blocker) return false;
  const blockerCircle = getBlockerCircle(blocker);
  const paddedBlockerCircle = blockerCircle
    ? { ...blockerCircle, radius: blockerCircle.radius + MOVEMENT_CLEARANCE }
    : null;
  const currentlyOverlapping = blockerCircle
    ? circleOverlapsBlocker(currentCircle, paddedBlockerCircle)
    : circleOverlapsBlocker(currentCircle, blocker);
  if (currentlyOverlapping) return false;
  return blockerCircle
    ? circleOverlapsBlocker(testCircle, paddedBlockerCircle)
    : circleOverlapsBlocker(testCircle, blocker);
}

function canOccupyPosition(enemy, room, x, y, blockers, dynamicBlockers = []) {
  const currentCircle = getClearanceCircle(enemy, enemy.x, enemy.y);
  const testCircle = getClearanceCircle(enemy, x, y);
  for (const blocker of blockers) {
    if (circleOverlapsBlocker(testCircle, blocker)) return false;
  }
  for (const blocker of dynamicBlockers) {
    if (circlesOverlapDynamicBlocker(testCircle, currentCircle, blocker)) return false;
  }
  return true;
}

function simulateMove(enemy, room, dx, dy, blockers, dynamicBlockers = []) {
  const nextPosition = clampEnemyPositionToRoom(enemy, room, enemy.x + dx, enemy.y + dy);
  const nextX = nextPosition.x;
  const nextY = nextPosition.y;
  const currentCircle = getClearanceCircle(enemy, enemy.x, enemy.y);
  const testX = getClearanceCircle(enemy, nextX, enemy.y);
  const testY = getClearanceCircle(enemy, enemy.x, nextY);
  let moveX = nextX;
  let moveY = nextY;
  let blockedByStatic = false;
  let blockedByDynamic = false;

  for (const blocker of blockers) {
    if (circleOverlapsBlocker(testX, blocker)) {
      moveX = enemy.x;
      blockedByStatic = true;
    }
    if (circleOverlapsBlocker(testY, blocker)) {
      moveY = enemy.y;
      blockedByStatic = true;
    }
  }

  for (const blocker of dynamicBlockers) {
    if (circlesOverlapDynamicBlocker(testX, currentCircle, blocker)) {
      moveX = enemy.x;
      blockedByDynamic = true;
    }
    if (circlesOverlapDynamicBlocker(testY, currentCircle, blocker)) {
      moveY = enemy.y;
      blockedByDynamic = true;
    }
  }

  if (moveX === enemy.x && moveY === enemy.y && Math.abs(dx) > 0.001 && Math.abs(dy) > 0.001) {
    const fullTestCircle = getClearanceCircle(enemy, nextX, nextY);
    let slideNormal = null;
    for (const blocker of blockers) {
      const separation = getShortestCircleRectSeparation(fullTestCircle, blocker);
      if (separation) {
        const length = Math.hypot(separation.x, separation.y);
        if (length > 0.001) {
          slideNormal = { x: separation.x / length, y: separation.y / length };
          break;
        }
      }
    }
    if (slideNormal) {
      const dot = dx * slideNormal.x + dy * slideNormal.y;
      const slideDx = dx - slideNormal.x * dot;
      const slideDy = dy - slideNormal.y * dot;
      if (Math.hypot(slideDx, slideDy) > 0.001) {
        const slidePosition = clampEnemyPositionToRoom(enemy, room, enemy.x + slideDx, enemy.y + slideDy);
        if (canOccupyPosition(enemy, room, slidePosition.x, slidePosition.y, blockers, dynamicBlockers)) {
          moveX = slidePosition.x;
          moveY = slidePosition.y;
        }
      }
    }
  }

  return {
    x: moveX,
    y: moveY,
    moved: moveX !== enemy.x || moveY !== enemy.y,
    blockedByStatic,
    blockedByDynamic
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

function getEnemyCircleAtCell(cellX, cellY, cellSize, enemy) {
  const center = getCellCenter(cellX, cellY, cellSize);
  const liveCircle = getClearanceCircle(enemy);
  return {
    x: center.x,
    y: center.y,
    radius: liveCircle.radius
  };
}

function getNavGridCacheKey(game, room, enemy, cellSize) {
  const circle = getClearanceCircle(enemy);
  return [
    room?.collisionVersion || 0,
    game?.runtimeVersions?.breakables || 0,
    cellSize,
    Math.max(1, Math.round(circle.radius || 1)),
    Math.round((enemy.movementCollider?.offsetX || 0) * 10),
    Math.round((enemy.movementCollider?.offsetY || 0) * 10)
  ].join(":");
}

function buildNavGrid(room, enemy, blockers, cellSize) {
  const cols = Math.max(1, Math.ceil(room.width / cellSize));
  const rows = Math.max(1, Math.ceil(room.height / cellSize));
  const blocked = new Uint8Array(cols * rows);
  const enemyCircle = getClearanceCircle(enemy);
  const inflate = Math.max(0, enemyCircle.radius);

  for (const blocker of blockers) {
    const minCellX = clamp(Math.floor((blocker.x - inflate) / cellSize), 0, cols - 1);
    const maxCellX = clamp(Math.floor((blocker.x + blocker.w + inflate) / cellSize), 0, cols - 1);
    const minCellY = clamp(Math.floor((blocker.y - inflate) / cellSize), 0, rows - 1);
    const maxCellY = clamp(Math.floor((blocker.y + blocker.h + inflate) / cellSize), 0, rows - 1);

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const index = cellY * cols + cellX;
        if (blocked[index]) continue;
        if (circleOverlapsBlocker(getEnemyCircleAtCell(cellX, cellY, cellSize, enemy), blocker)) {
          blocked[index] = 1;
        }
      }
    }
  }

  return { cellSize, cols, rows, blocked };
}

function getNavGrid(game, room, enemy, blockers, cellSize) {
  let roomCache = NAV_GRID_CACHE.get(room);
  if (!roomCache) {
    roomCache = new Map();
    NAV_GRID_CACHE.set(room, roomCache);
  }

  const cacheKey = getNavGridCacheKey(game, room, enemy, cellSize);
  const cached = roomCache.get(cacheKey);
  if (cached) return cached;

  const grid = buildNavGrid(room, enemy, blockers, cellSize);
  roomCache.set(cacheKey, grid);
  return grid;
}

function isCellPassable(navGrid, cellX, cellY, startCellX, startCellY) {
  if (cellX < 0 || cellY < 0 || cellX >= navGrid.cols || cellY >= navGrid.rows) return false;
  if (cellX === startCellX && cellY === startCellY) return true;
  return navGrid.blocked[cellY * navGrid.cols + cellX] === 0;
}

function getPathGoalRadius(enemy, options, cellSize) {
  const movementCircle = getEnemyMovementCircleAt(enemy);
  const clearDistanceThreshold = Number.isFinite(options.clearDistanceThreshold)
    ? Math.max(0, options.clearDistanceThreshold)
    : 0;
  const rangeGoalRadius = clearDistanceThreshold > 0
    ? Math.max(0, clearDistanceThreshold - cellSize * 0.4)
    : 0;
  const bodyGoalRadius = movementCircle.radius + cellSize * 0.25;
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

function findPathToTarget(game, room, enemy, targetPoint, blockers, goalRadius) {
  if (!room || !targetPoint) return null;

  const cellSize = getPathCellSize(room);
  const navGrid = getNavGrid(game, room, enemy, blockers, cellSize);
  const cols = navGrid.cols;
  const rows = navGrid.rows;
  const enemyCenter = getEnemyMovementCircleAt(enemy);
  const startCellX = clamp(Math.floor(enemyCenter.x / cellSize), 0, cols - 1);
  const startCellY = clamp(Math.floor(enemyCenter.y / cellSize), 0, rows - 1);
  const startKey = toCellKey(startCellX, startCellY);
  if (isGoalCell(startCellX, startCellY, targetPoint, cellSize, goalRadius)) return [];

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
      if (!isCellPassable(navGrid, nextCellX, nextCellY, startCellX, startCellY)) continue;

      if (neighbor.x !== 0 && neighbor.y !== 0) {
        const xStepPassable = isCellPassable(navGrid, current.cellX + neighbor.x, current.cellY, startCellX, startCellY);
        const yStepPassable = isCellPassable(navGrid, current.cellX, current.cellY + neighbor.y, startCellX, startCellY);
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
  const enemyCenter = getEnemyMovementCircleAt(enemy);
  const movementCircle = getEnemyMovementCircleAt(enemy);
  const reachRadius = Math.max(
    NAV_PATH_WAYPOINT_RADIUS,
    travelDistance * 0.75,
    movementCircle.radius * 0.9
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

function scoreCandidate(enemy, candidate, targetPoint, behavior, desiredRange, blockers, dynamicBlockers, room, travelDistance, nav) {
  const sim = simulateMove(
    enemy,
    room,
    candidate.dir.x * travelDistance,
    candidate.dir.y * travelDistance,
    blockers,
    dynamicBlockers
  );

  let score = sim.moved ? 100 : -100;
  if (!sim.moved) return { ...candidate, score, moved: false };

  const currentCenter = getEnemyMovementCircleAt(enemy);
  const nextCenter = getEnemyMovementCircleAt(enemy, sim.x, sim.y);

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
  if (!room || !enemy) return false;
  const nav = ensureEnemyNavState(enemy);
  const playerBlocker =
    game?.player && game.player !== enemy && shouldPlayerBlockEnemies(game.player)
      ? game.player
      : null;
  let moved = applyClampedEnemyPosition(enemy, room);
  let circle = getEnemyMovementCircleAt(enemy);
  if (canSkipOverlapResolution(nav, enemy, room, game, circle, playerBlocker)) return moved;

  const blockers = getEnemyBlockers(game, room, enemy);
  if (!blockers.length && !playerBlocker) {
    markOverlapResolved(nav, enemy, room, game);
    return moved;
  }

  for (let pass = 0; pass < 3; pass += 1) {
    let adjustedThisPass = false;
    for (const blocker of getNearbyOverlapBlockers(blockers, room, circle)) {
      const separation = getShortestCircleRectSeparation(circle, blocker);
      if (!separation) continue;
      enemy.x += separation.x;
      enemy.y += separation.y;
      applyClampedEnemyPosition(enemy, room);
      circle = getEnemyMovementCircleAt(enemy);
      adjustedThisPass = true;
      moved = true;
    }
    if (playerBlocker) {
      const blockerCircle = getBlockerCircle(playerBlocker);
      const separation = blockerCircle
        ? getShortestCircleCircleSeparation(circle, blockerCircle)
        : getShortestCircleRectSeparation(circle, playerBlocker);
      if (separation) {
        enemy.x += separation.x;
        enemy.y += separation.y;
        applyClampedEnemyPosition(enemy, room);
        circle = getEnemyMovementCircleAt(enemy);
        adjustedThisPass = true;
        moved = true;
      }
    }
    if (!adjustedThisPass) break;
  }

  if (hasRemainingOverlap(blockers, room, circle, playerBlocker)) clearOverlapResolved(nav);
  else markOverlapResolved(nav, enemy, room, game);
  return moved;
}

export function tryMoveEnemy(game, enemy, room, dx, dy) {
  const previousX = enemy.x;
  const previousY = enemy.y;
  const blockers = getEnemyBlockers(game, room, enemy);
  const dynamicBlockers = getDynamicBlockers(game, enemy);
  const sim = simulateMove(enemy, room, dx, dy, blockers, dynamicBlockers);
  enemy.x = sim.x;
  enemy.y = sim.y;
  resolveEnemyWallOverlap(game, enemy, room);
  const actualDx = enemy.x - previousX;
  const actualDy = enemy.y - previousY;
  const moved = actualDx !== 0 || actualDy !== 0;
  const requestedDistance = Math.hypot(dx, dy);
  const actualDistance = Math.hypot(actualDx, actualDy);
  if (
    sim.blockedByStatic &&
    (enemy.collisionBounceCooldownTimer || 0) <= 0 &&
    requestedDistance > 0.001 &&
    actualDistance < requestedDistance * 0.75
  ) {
    triggerCollisionBounce(enemy, dx - actualDx, dy - actualDy, 1 - (actualDistance / requestedDistance));
  }
  return moved;
}

export function computeEnemyMoveVector(game, enemy, desiredDir, targetPoint, dt, options = {}) {
  const fallback = options.fallbackDir || { x: 1, y: 0 };
  const baseDir = normalize(desiredDir?.x || 0, desiredDir?.y || 0, fallback);
  const speedMult = options.speedMult ?? 1;
  const desiredMagnitude = Math.hypot(desiredDir?.x || 0, desiredDir?.y || 0);
  const nav = ensureEnemyNavState(enemy);

  nav.detourTimer = Math.max(0, (nav.detourTimer || 0) - dt);
  nav.repathCooldown = Math.max(0, (nav.repathCooldown || 0) - dt);

  if (desiredMagnitude < 0.001) {
    nav.stuckTimer = 0;
    clearDetour(nav);
    clearPath(nav);
    nav.lastX = enemy.x;
    nav.lastY = enemy.y;
    return { dir: baseDir, speedMult, usedDetour: false };
  }

  const room = game.world;
  const blockers = getEnemyBlockers(game, room, enemy);
  const dynamicBlockers = getDynamicBlockers(game, enemy);
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
  const movementCenter = getEnemyMovementCircleAt(enemy);
  const currentDistanceToTarget = targetPoint
    ? Math.hypot(targetPoint.x - movementCenter.x, targetPoint.y - movementCenter.y)
    : Infinity;
  const clearDistanceThreshold = Number.isFinite(options.clearDistanceThreshold)
    ? options.clearDistanceThreshold
    : null;
  const goalRadius = behavior === "advance" && targetPoint
    ? getPathGoalRadius(enemy, options, getPathCellSize(room))
    : 0;

  if (progress < minProgress) nav.stuckTimer += dt;
  else nav.stuckTimer = Math.max(0, nav.stuckTimer - dt * 2);

  const directSim = simulateMove(enemy, room, baseDir.x * travelDistance, baseDir.y * travelDistance, blockers, dynamicBlockers);

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
        const enemyCenter = getEnemyMovementCircleAt(enemy);
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
    const pathPoints = findPathToTarget(game, room, enemy, targetPoint, blockers, goalRadius);
    if (Array.isArray(pathPoints) && pathPoints.length > 0) {
      clearDetour(nav);
      setPath(nav, pathPoints, targetPoint, goalRadius, game, room);
      nav.repathCooldown = NAV_PATH_SUCCESS_COOLDOWN;
      const waypoint = consumePathWaypoint(nav, enemy, travelDistance);
      if (waypoint) {
        nav.lastX = enemy.x;
        nav.lastY = enemy.y;
        const enemyCenter = getEnemyMovementCircleAt(enemy);
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
    scoreCandidate(enemy, candidate, targetPoint, behavior, desiredRange, blockers, dynamicBlockers, room, travelDistance, nav)
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
