export function enemyCanBeDisplaced(enemy) {
  return !!enemy && !enemy.isMiniBoss && !enemy.ignoreKnockback;
}
