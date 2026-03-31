export const COMBAT_VFX = {
  groundImpactLightOrange: {
    sprite: "groundImpactLightOrange",
    frames: 6,
    frameWidth: 374,
    frameHeight: 374
  },
  groundImpactOrange: {
    sprite: "groundImpactOrange",
    frames: 10,
    frameWidth: 128,
    frameHeight: 128
  },
  groundImpactGreen: {
    sprite: "groundImpactGreen",
    frames: 10,
    frameWidth: 128,
    frameHeight: 128
  },
  groundImpactPurple: {
    sprite: "groundImpactPurple",
    frames: 10,
    frameWidth: 128,
    frameHeight: 128
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
