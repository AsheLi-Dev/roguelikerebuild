import { centerOf } from "../core/runtime-utils.js";

export function getEnemyTargetEntity(game) {
  return game.enemyTest?.dummyTarget || game.player;
}

export function getEnemyTargetCenter(game) {
  return centerOf(getEnemyTargetEntity(game));
}

export function isEnemyTestDummy(game, entity) {
  return !!entity && game.enemyTest?.dummyTarget === entity;
}
