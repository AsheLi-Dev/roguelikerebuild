const MIN_DIRECTION_SWITCH_DELAY = 0.08;
const MAX_DIRECTION_SWITCH_DELAY = 0.15;

function randomDirectionSwitchDelay() {
  return MIN_DIRECTION_SWITCH_DELAY + Math.random() * (MAX_DIRECTION_SWITCH_DELAY - MIN_DIRECTION_SWITCH_DELAY);
}

export function initializeEnemyAnimationDirection(enemy, initialDirection = "down") {
  if (!enemy) return;
  const direction = initialDirection || enemy.direction || "down";
  enemy.direction = direction;
  enemy.displayDirection = direction;
  enemy.pendingDisplayDirection = direction;
  enemy.displayDirectionDelayTimer = 0;
}

export function setEnemyAnimationDirection(enemy, direction) {
  if (!enemy || !direction) return;
  enemy.direction = direction;
  if (!enemy.displayDirection) enemy.displayDirection = direction;
  if (!enemy.pendingDisplayDirection) enemy.pendingDisplayDirection = enemy.displayDirection;
  if (enemy.displayDirection === direction) {
    enemy.pendingDisplayDirection = direction;
    enemy.displayDirectionDelayTimer = 0;
    return;
  }
  if (enemy.pendingDisplayDirection !== direction) {
    enemy.pendingDisplayDirection = direction;
    enemy.displayDirectionDelayTimer = randomDirectionSwitchDelay();
  }
}

export function updateEnemyAnimationDirection(enemy, dt) {
  if (!enemy) return;
  if (!enemy.displayDirection) {
    initializeEnemyAnimationDirection(enemy, enemy.direction || "down");
    return;
  }
  if (!enemy.pendingDisplayDirection || enemy.pendingDisplayDirection === enemy.displayDirection) return;
  enemy.displayDirectionDelayTimer = Math.max(0, (enemy.displayDirectionDelayTimer || 0) - dt);
  if (enemy.displayDirectionDelayTimer <= 0) {
    enemy.displayDirection = enemy.pendingDisplayDirection;
  }
}
