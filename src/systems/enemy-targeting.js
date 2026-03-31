import { centerOf } from "../core/runtime-utils.js";

export function getEnemyTargetEntity(game) {
  if (game.player.spiritMode?.active) {
    return { x: game.player.spiritMode.spiritX, y: game.player.spiritMode.spiritY, w: game.player.w, h: game.player.h, isSpirit: true };
  }
  return game.enemyTest?.dummyTarget || game.player;
}

export function getEnemyTargetCenter(game) {
  return centerOf(getEnemyTargetEntity(game));
}

export function isEnemyTestDummy(game, entity) {
  return !!entity && game.enemyTest?.dummyTarget === entity;
}
