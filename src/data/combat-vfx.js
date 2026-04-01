export const COMBAT_VFX = {
  groundImpactLightOrange: {
    sprite: "groundImpactLightOrange",
    frames: 7,
    frameWidth: 566,
    frameHeight: 374
  },
  groundImpactOrange: {
    sprite: "groundImpactOrange",
    frames: 7,
    frameWidth: 566,
    frameHeight: 374
  },
  groundImpactGreen: {
    sprite: "groundImpactGreen",
    frames: 7,
    frameWidth: 566,
    frameHeight: 374
  },
  groundImpactPurple: {
    sprite: "groundImpactPurple",
    frames: 7,
    frameWidth: 566,
    frameHeight: 374
  },
  fireExplosion: {
    sprite: "fireExplosionVfx",
    frames: 5,
    frameWidth: 64,
    frameHeight: 64,
    fps: 12
  }
};

export function getVfxConfig(vfxId) {
  return COMBAT_VFX[vfxId] || null;
}
