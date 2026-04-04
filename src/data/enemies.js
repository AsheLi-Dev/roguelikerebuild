function sheet(asset, frames, fps = 8) {
  return { asset, frames, fps };
}

function createSlimeEnemy({
  id,
  name,
  hp,
  damage,
  speed,
  size,
  drawSize,
  preferredRange = 0,
  movementTactic = "Swarmer",
  collisionRadius = 0.34,
  color,
  idleAsset,
  moveAsset,
  hitAsset,
  moveFrames,
  hopPeakFrame = 3,
  shadow
}) {
  return {
    id,
    name,
    category: "Slime",
    role: "melee",
    hp,
    damage,
    speed,
    size,
    drawSize,
    preferredRange,
    movementTactic,
    collisionRadius,
    color,
    movementProfile: {
      kind: "slimeHop",
      minSpeedMult: 0.3,
      peakSpeedMult: 1,
      peakFrame: hopPeakFrame
    },
    shadow,
    sprite: {
      idle: sheet(idleAsset, 1, 4),
      move: sheet(moveAsset, moveFrames, moveFrames >= 6 ? 10 : 8),
      hit: hitAsset ? sheet(hitAsset, 2, 8) : undefined
    }
  };
}

export const ENEMY_ASSET_SPECS = Object.freeze([
  ["slimeGreenLvl01Idle", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl01_Idle_1x1.png"],
  ["slimeGreenLvl01Move", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl01_Move_5x1.png"],
  ["slimeGreenLvl01Hit", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl01_Hit_2x1.png"],
  ["slimeGreenLvl02Idle", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl02_Idle_1x1.png"],
  ["slimeGreenLvl02Move", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl02_Move_5x1.png"],
  ["slimeGreenLvl02Hit", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl02_Hit_2x1.png"],
  ["slimeGreenLvl03Idle", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl03_Idle_1x1.png"],
  ["slimeGreenLvl03Move", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl03_Move_5x1.png"],
  ["slimeGreenLvl03Hit", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl03_Hit_2x1.png"],
  ["slimeGreenLvl04Idle", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl04_Idle_1x1.png"],
  ["slimeGreenLvl04Move", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl04_Move_6x1.png"],
  ["slimeGreenLvl04Hit", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl04_Hit_2x1.png"],
  ["slimeGreenLvl05Idle", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl05_Idle_1x1.png"],
  ["slimeGreenLvl05Move", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl05_Move_6x1.png"],
  ["slimeGreenLvl05Hit", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl05_Hit_2x1.png"],
  ["slimeGreenLvl06Idle", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl06_Idle_1x1.png"],
  ["slimeGreenLvl06Move", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl06_Move_6x1.png"],
  ["slimeGreenLvl06Hit", "./assets/enemies/Slime/08_GREENDARK/Slime_Lvl06_Hit_2x1.png"]
]);

export const ENEMY_DEFS = Object.freeze({
  slime_green_1: createSlimeEnemy({
    id: "slime_green_1",
    name: "Green Dark Slime I",
    hp: 20,
    damage: 5,
    speed: 92,
    size: 28,
    drawSize: 56,
    collisionRadius: 0.3,
    color: "#86efac",
    idleAsset: "slimeGreenLvl01Idle",
    moveAsset: "slimeGreenLvl01Move",
    hitAsset: "slimeGreenLvl01Hit",
    moveFrames: 5,
    hopPeakFrame: 3
  }),
  slime_green_2: createSlimeEnemy({
    id: "slime_green_2",
    name: "Green Dark Slime II",
    hp: 28,
    damage: 6,
    speed: 96,
    size: 30,
    drawSize: 58,
    collisionRadius: 0.31,
    color: "#84cc16",
    idleAsset: "slimeGreenLvl02Idle",
    moveAsset: "slimeGreenLvl02Move",
    hitAsset: "slimeGreenLvl02Hit",
    moveFrames: 5,
    hopPeakFrame: 3
  }),
  slime_green_3: createSlimeEnemy({
    id: "slime_green_3",
    name: "Green Dark Slime III",
    hp: 38,
    damage: 8,
    speed: 88,
    size: 36,
    drawSize: 68,
    collisionRadius: 0.32,
    color: "#65a30d",
    idleAsset: "slimeGreenLvl03Idle",
    moveAsset: "slimeGreenLvl03Move",
    hitAsset: "slimeGreenLvl03Hit",
    moveFrames: 5,
    hopPeakFrame: 2,
    shadow: {
      shadowOffsetY: -0.03,
      useSpriteBounds: true
    }
  }),
  slime_green_4: createSlimeEnemy({
    id: "slime_green_4",
    name: "Green Dark Slime IV",
    hp: 52,
    damage: 10,
    speed: 84,
    size: 40,
    drawSize: 74,
    collisionRadius: 0.33,
    color: "#4d7c0f",
    idleAsset: "slimeGreenLvl04Idle",
    moveAsset: "slimeGreenLvl04Move",
    hitAsset: "slimeGreenLvl04Hit",
    moveFrames: 6,
    hopPeakFrame: 3
  }),
  slime_green_5: createSlimeEnemy({
    id: "slime_green_5",
    name: "Green Dark Slime V",
    hp: 64,
    damage: 12,
    speed: 104,
    size: 34,
    drawSize: 62,
    collisionRadius: 0.31,
    color: "#22c55e",
    idleAsset: "slimeGreenLvl05Idle",
    moveAsset: "slimeGreenLvl05Move",
    hitAsset: "slimeGreenLvl05Hit",
    moveFrames: 6,
    hopPeakFrame: 3
  }),
  slime_green_6: createSlimeEnemy({
    id: "slime_green_6",
    name: "Green Dark Slime VI",
    hp: 78,
    damage: 14,
    speed: 98,
    size: 42,
    drawSize: 76,
    collisionRadius: 0.33,
    color: "#16a34a",
    idleAsset: "slimeGreenLvl06Idle",
    moveAsset: "slimeGreenLvl06Move",
    hitAsset: "slimeGreenLvl06Hit",
    moveFrames: 6,
    hopPeakFrame: 3
  })
});

export const ROOM_ENEMY_TABLE = Object.freeze([
  ["slime_green_1", "slime_green_2"],
  ["slime_green_1", "slime_green_2", "slime_green_3"],
  ["slime_green_2", "slime_green_3", "slime_green_4"],
  ["slime_green_3", "slime_green_4", "slime_green_5"],
  ["slime_green_4", "slime_green_5", "slime_green_6"]
]);

export function getEnemyDef(id) {
  return ENEMY_DEFS[id];
}
