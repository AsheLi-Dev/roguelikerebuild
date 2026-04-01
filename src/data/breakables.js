const BREAKABLE_ASSET_ROOT = "./assets/Breakables";

function assetPath(folder, file) {
  return `${BREAKABLE_ASSET_ROOT}/${folder}/${file}`;
}

function createShadowConfig(config = {}) {
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

const URN_SHADOW = createShadowConfig({
  shadowWidth: 0.58,
  shadowHeight: 0.16,
  shadowOffsetY: -0.08,
  shadowAlpha: 0.2,
  shadowBlurScale: 1.8
});

const BARREL_SHADOW = createShadowConfig({
  shadowWidth: 0.7,
  shadowHeight: 0.18,
  shadowOffsetY: -0.06,
  shadowAlpha: 0.24,
  shadowBlurScale: 1.85
});

const CRATE_SHADOW = createShadowConfig({
  shadowWidth: 0.76,
  shadowHeight: 0.14,
  shadowOffsetY: -0.04,
  shadowAlpha: 0.22,
  shadowBlurScale: 1.7
});

const TOMB_SHADOW = createShadowConfig({
  shadowWidth: 0.84,
  shadowHeight: 0.15,
  shadowOffsetY: -0.03,
  shadowAlpha: 0.26,
  shadowBlurScale: 1.75
});

function createUrnVariant(letter) {
  return {
    staticSrc: assetPath(`Urn ${letter}`, `urn-${letter}-main-static-00.png`),
    damageStages: [
      {
        minHpPct: 0.5,
        staticSrc: assetPath(`Urn ${letter}`, `urn-${letter}-main-static-00.png`),
        hitSrc: assetPath(`Urn ${letter}`, `urn-${letter}-main-static-00.png`)
      },
      {
        minHpPct: 0,
        staticSrc: assetPath(`Urn ${letter}`, `urn-${letter}-crack-00.png`),
        hitSrc: assetPath(`Urn ${letter}`, `urn-${letter}-crack-hit-00.png`)
      }
    ],
    destroyFramesSrc: [
      assetPath(`Urn ${letter}`, `urn-${letter}-destr-anim-01.png`),
      assetPath(`Urn ${letter}`, `urn-${letter}-destr-anim-02.png`),
      assetPath(`Urn ${letter}`, `urn-${letter}-destr-anim-03.png`),
      assetPath(`Urn ${letter}`, `urn-${letter}-destr-anim-04.png`)
    ],
    destroyedSrc: assetPath(`Urn ${letter}`, `urn-${letter}-static-destroyed-00.png`),
    shadow: URN_SHADOW
  };
}

function createCrateDef(id, folder, prefix, rarity = "medium") {
  return {
    id,
    label: folder,
    maxHp: 30,
    rarity,
    blocksMovement: false,
    width: 32,
    height: 32,
    damageCooldown: 0.06,
    breakSfxKey: "crateBreakSfx",
    shadow: CRATE_SHADOW,
    sprites: {
      staticSrc: assetPath(folder, `${prefix}-main-static-00.png`),
      damageStages: [
        {
          minHpPct: 1,
          staticSrc: assetPath(folder, `${prefix}-main-static-00.png`),
          hitSrc: assetPath(folder, `${prefix}-hit-00.png`)
        }
      ],
      destroyFramesSrc: [
        assetPath(folder, `${prefix}-destr-anim-01.png`),
        assetPath(folder, `${prefix}-destr-anim-02.png`),
        assetPath(folder, `${prefix}-destr-anim-03.png`),
        assetPath(folder, `${prefix}-destr-anim-04.png`)
      ],
      destroyedSrc: assetPath(folder, `${prefix}-static-destroyed-00.png`)
    }
  };
}

function createTombDef(id, folder, prefix) {
  return {
    id,
    label: folder,
    maxHp: 70,
    rarity: "high",
    blocksMovement: false,
    width: 32,
    height: 32,
    damageCooldown: 0.06,
    breakSfxKey: "tombBreakSfx",
    shadow: TOMB_SHADOW,
    sprites: {
      staticSrc: assetPath(folder, `${prefix}-main-static-00.png`),
      damageStages: [
        {
          minHpPct: 0.6,
          staticSrc: assetPath(folder, `${prefix}-main-static-00.png`),
          hitSrc: assetPath(folder, `${prefix}-main-hit-00.png`)
        },
        {
          minHpPct: 0.3,
          staticSrc: assetPath(folder, `${prefix}-crack-1-00.png`),
          hitSrc: assetPath(folder, `${prefix}-crack-1-hit-00.png`)
        },
        {
          minHpPct: 0,
          staticSrc: assetPath(folder, `${prefix}-crack-2-00.png`),
          hitSrc: assetPath(folder, `${prefix}-crack-2-hit-00.png`)
        }
      ],
      destroyFramesSrc: [
        assetPath(folder, `${prefix}-destr-anim-01.png`),
        assetPath(folder, `${prefix}-destr-anim-02.png`),
        assetPath(folder, `${prefix}-destr-anim-03.png`),
        assetPath(folder, `${prefix}-destr-anim-04.png`),
        assetPath(folder, `${prefix}-destr-anim-05.png`),
        assetPath(folder, `${prefix}-destr-anim-06.png`)
      ],
      destroyedSrc: assetPath(folder, `${prefix}-static-destroyed-00.png`)
    }
  };
}

export const BREAKABLE_GOLD_BY_RARITY = Object.freeze({
  low: { min: 1, max: 3, dropCount: 1, color: "#facc15", radius: 8 },
  medium: { min: 4, max: 7, dropCount: 2, color: "#f59e0b", radius: 9 },
  high: { min: 8, max: 13, dropCount: 3, color: "#fb7185", radius: 10 }
});

export const BREAKABLE_DEFS = Object.freeze({
  urn_magic: {
    id: "urn_magic",
    label: "Urn",
    maxHp: 24,
    rarity: "low",
    blocksMovement: false,
    width: 24,
    height: 28,
    damageCooldown: 0.06,
    breakSfxKey: "jarBreakSfx",
    shadow: URN_SHADOW,
    variantPool: "urn_magic_variants"
  },
  barrel_a: {
    id: "barrel_a",
    label: "Barrel",
    maxHp: 35,
    rarity: "medium",
    blocksMovement: false,
    width: 32,
    height: 32,
    damageCooldown: 0.06,
    breakSfxKey: "crateBreakSfx",
    shadow: BARREL_SHADOW,
    sprites: {
      staticSrc: assetPath("Barrel B", "barrel-B-main-static-00.png"),
      damageStages: [
        {
          minHpPct: 1,
          staticSrc: assetPath("Barrel B", "barrel-B-main-static-00.png"),
          hitSrc: assetPath("Barrel B", "barrel-B-hit-00.png")
        }
      ],
      destroyFramesSrc: [
        assetPath("Barrel B", "barrel-B-destr-anim-01.png"),
        assetPath("Barrel B", "barrel-B-destr-anim-02.png"),
        assetPath("Barrel B", "barrel-B-destr-anim-03.png"),
        assetPath("Barrel B", "barrel-B-destr-anim-04.png")
      ],
      destroyedSrc: assetPath("Barrel B", "barrel-B-static-destroyed-00.png")
    }
  },
  wooden_crate_a: createCrateDef("wooden_crate_a", "Crate A", "crate-A", "medium"),
  wooden_crate_b: createCrateDef("wooden_crate_b", "Crate B", "crate-B", "low"),
  wooden_crate_c: createCrateDef("wooden_crate_c", "Crate C", "crate-C", "medium"),
  wooden_crate_d: createCrateDef("wooden_crate_d", "Crate D", "crate-D", "low"),
  tomb_a: createTombDef("tomb_a", "Tomb A", "tomb-A"),
  tomb_b: createTombDef("tomb_b", "Tomb B", "tomb-B")
});

export const BREAKABLE_VARIANT_POOLS = Object.freeze({
  urn_magic_variants: Object.freeze([
    createUrnVariant("A"),
    createUrnVariant("B"),
    createUrnVariant("C"),
    createUrnVariant("D"),
    createUrnVariant("E"),
    createUrnVariant("F"),
    createUrnVariant("G"),
    createUrnVariant("H"),
    createUrnVariant("I"),
    createUrnVariant("J"),
    createUrnVariant("K"),
    createUrnVariant("L"),
    createUrnVariant("M")
  ])
});

export const BREAKABLE_SPAWN_WEIGHTS = Object.freeze([
  { id: "urn_magic", weight: 22 },
  { id: "barrel_a", weight: 10 },
  { id: "wooden_crate_a", weight: 9 },
  { id: "wooden_crate_b", weight: 7 },
  { id: "wooden_crate_c", weight: 7 },
  { id: "wooden_crate_d", weight: 6 },
  { id: "tomb_a", weight: 3 },
  { id: "tomb_b", weight: 3 }
]);
