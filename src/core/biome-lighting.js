const BIOME_LIGHTING_PROFILES = [
  // roomIndex 0 — Afternoon: warm sunlight, bright world
  {
    skyColor: "#0d0a04",
    ambientColor: "rgba(20, 8, 0, 0.04)",
    ambientNorthBoostColor: "rgba(255, 210, 120, 0.20)",
    playerLightColor: "rgba(255, 225, 170, __ALPHA__)",
    playerLightRadius: 72,
    playerLightAlpha: 0.07,
    nightVignette: false,
    nightVignetteRadius: 0,
    nightVignetteOuterAlpha: 0
  },
  // roomIndex 1 — Dusk: dims, orange-red horizon
  {
    skyColor: "#0e0704",
    ambientColor: "rgba(30, 10, 2, 0.20)",
    ambientNorthBoostColor: "rgba(255, 120, 50, 0.15)",
    playerLightColor: "rgba(255, 185, 110, __ALPHA__)",
    playerLightRadius: 88,
    playerLightAlpha: 0.10,
    nightVignette: false,
    nightVignetteRadius: 0,
    nightVignetteOuterAlpha: 0
  },
  // roomIndex 2+ — Night magic forest: dark with bright player halo
  {
    skyColor: "#020617",
    ambientColor: "rgba(4, 8, 22, 0.30)",
    ambientNorthBoostColor: "rgba(90, 140, 255, 0.05)",
    playerLightColor: "rgba(200, 230, 255, __ALPHA__)",
    playerLightRadius: 100,
    playerLightAlpha: 0.13,
    nightVignette: true,
    nightVignetteRadius: 420,
    nightVignetteOuterAlpha: 0.52
  }
];

export function getBiomeLightingProfile(roomIndex) {
  const idx = Math.min(roomIndex, BIOME_LIGHTING_PROFILES.length - 1);
  return BIOME_LIGHTING_PROFILES[Math.max(0, idx)];
}
