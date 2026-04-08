export const GLOBAL_LIGHTING = Object.freeze({
  ambientColor: "rgba(6, 16, 28, 0.12)",
  ambientNorthBoostColor: "rgba(255, 244, 214, 0.08)",
  directionalHighlightColor: "rgba(255, 244, 214, 0.1)",
  grassAtmosphere: Object.freeze({
    enabled: false,
    lightPatchCount: 8,
    shadowPatchCount: 5,
    lightPatchAlpha: 0.22,
    shadowPatchAlpha: 0.16,
    patchDriftSpeed: 0.3,
    patchBaseRadius: 220,
    patchRadiusJitter: 80
  }),
  playerLight: Object.freeze({
    color: "rgba(255, 245, 214, __ALPHA__)",
    radius: 96,
    alpha: 0.115,
    aspectY: 0.86,
    offsetY: -10
  }),
  shadow: Object.freeze({
    driftXRatio: 0.015,
    driftYRatio: 0.09,
    stretchX: 1.02,
    stretchY: 1.18,
    blurScale: 1.72,
    alphaScale: 1
  }),
  tallShadow: Object.freeze({
    offsetX: 2,
    offsetY: 8,
    heightScale: 1.12,
    alpha: 0.22
  }),
  maxVisibleLocalLights: 28
});

export function createDirectionalShadowConfig(config = {}) {
  return Object.freeze({
    shadowWidth: config.shadowWidth ?? 0.7,
    shadowHeight: config.shadowHeight ?? 0.18,
    shadowOffsetX: config.shadowOffsetX ?? 0,
    shadowOffsetY: config.shadowOffsetY ?? -0.05,
    shadowAlpha: config.shadowAlpha ?? 0.22,
    shadowBlurScale: config.shadowBlurScale ?? 1.9,
    shadowColor: config.shadowColor ?? "rgba(0, 0, 0, 1)"
  });
}
