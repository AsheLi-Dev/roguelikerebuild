import { createDirectionalShadowConfig } from "../core/lighting.js";

const CHEST_SHADOW = createDirectionalShadowConfig({
  shadowWidth: 0.72,
  shadowHeight: 0.16,
  shadowOffsetY: -0.06,
  shadowAlpha: 0.22,
  shadowBlurScale: 1.75
});

const WELL_SHADOW = createDirectionalShadowConfig({
  shadowWidth: 0.82,
  shadowHeight: 0.18,
  shadowOffsetY: -0.03,
  shadowAlpha: 0.18,
  shadowBlurScale: 1.85
});

const WORKSHOP_SHADOW = createDirectionalShadowConfig({
  shadowWidth: 0.72,
  shadowHeight: 0.14,
  shadowOffsetY: -0.02,
  shadowAlpha: 0.16,
  shadowBlurScale: 1.65
});

const RING_SELECTION_SHADOW = createDirectionalShadowConfig({
  shadowWidth: 0.88,
  shadowHeight: 0.14,
  shadowOffsetY: -0.02,
  shadowAlpha: 0.18,
  shadowBlurScale: 1.7
});

const ANVIL_SHADOW = createDirectionalShadowConfig({
  shadowWidth: 0.7,
  shadowHeight: 0.12,
  shadowOffsetY: -0.02,
  shadowAlpha: 0.24,
  shadowBlurScale: 1.6
});

export const SEARCHABLE_DEFS = {
  smallChest: {
    id: "smallChest",
    name: "Small Chest",
    width: 32,
    height: 32,
    openAnimDuration: 0.24,
    shadow: CHEST_SHADOW,
    rarityChances: [
      { rarity: "normal", chance: 0.8 },
      { rarity: "uncommon", chance: 0.15 },
      { rarity: "rare", chance: 0.05 }
    ],
    sprites: {
      closedAsset: "smallChestClosed",
      openFrames: ["smallChestOpenAnim1", "smallChestOpenAnim2", "smallChestOpenAnim3"],
      openStaticAsset: "smallChestOpenStatic"
    }
  },
  largeChest: {
    id: "largeChest",
    name: "Large Chest",
    width: 32,
    height: 32,
    openAnimDuration: 0.24,
    shadow: CHEST_SHADOW,
    rarityChances: [
      { rarity: "uncommon", chance: 0.9 },
      { rarity: "rare", chance: 0.1 }
    ],
    sprites: {
      closedAsset: "largeChestClosed",
      openFrames: ["largeChestOpenAnim1", "largeChestOpenAnim2", "largeChestOpenAnim3"],
      openStaticAsset: "largeChestOpenStatic"
    }
  },
  redWell: {
    id: "redWell",
    name: "Red Well",
    width: 48,
    height: 48,
    openAnimDuration: 0.42,
    shadow: WELL_SHADOW,
    interactionType: "redWell",
    interactLabel: "E Drink",
    sprites: {
      closedAsset: "redWellFull5",
      openFrames: ["redWellUse1", "redWellUse2", "redWellUse3", "redWellUse4", "redWellUse5", "redWellUse6"],
      openStaticAsset: "redWellEmpty"
    }
  },
  yellowWell: {
    id: "yellowWell",
    name: "Yellow Well",
    width: 48,
    height: 48,
    openAnimDuration: 0.42,
    shadow: WELL_SHADOW,
    interactionType: "yellowWell",
    interactLabel: "E Drink",
    sprites: {
      closedAsset: "yellowWellFull5",
      openFrames: ["yellowWellUse1", "yellowWellUse2", "yellowWellUse3", "yellowWellUse4", "yellowWellUse5", "yellowWellUse6"],
      openStaticAsset: "yellowWellEmpty"
    }
  },
  lifeSpring: {
    id: "lifeSpring",
    name: "Life Spring",
    width: 74,
    height: 64,
    openAnimDuration: 0,
    shadow: WELL_SHADOW,
    interactionType: "lifeSpring",
    interactLabel: "E Restore",
    sprites: {
      sheetAsset: "lifeSpringSheet",
      frameWidth: 148,
      frameHeight: 128,
      frameCols: 9,
      frameRows: 1,
      frameCount: 9,
      frameDuration: 0.12
    }
  },
  alchemyWorkshop: {
    id: "alchemyWorkshop",
    name: "Alchemy Workshop",
    width: 92,
    height: 64,
    openAnimDuration: 0,
    shadow: WORKSHOP_SHADOW,
    interactionType: "alchemyWorkshop",
    interactLabel: "E Craft"
  },
  blacksmith: {
    id: "blacksmith",
    name: "Blacksmith",
    width: 92,
    height: 64,
    openAnimDuration: 0,
    shadow: WORKSHOP_SHADOW,
    interactionType: "blacksmith",
    interactLabel: "E Smith"
  },
  ringSelectionShop: {
    id: "ringSelectionShop",
    name: "Ring Selection",
    width: 204,
    height: 60,
    openAnimDuration: 0,
    shadow: RING_SELECTION_SHADOW,
    interactionType: "ringSelectionShop",
    interactLabel: "E Browse",
    sprites: {
      closedAsset: "ringSelectionShopSprite",
      openStaticAsset: "ringSelectionShopSprite"
    }
  },
  cursedAnvil: {
    id: "cursedAnvil",
    name: "Cursed Anvil",
    width: 112,
    height: 97,
    openAnimDuration: 0.3,
    shadow: ANVIL_SHADOW,
    interactionType: "cursedAnvil",
    interactLabel: "E Gamble",
    sprites: {
      closedAsset: "cursedAnvilSprite",
      openStaticAsset: "cursedAnvilSprite"
    }
  },
  treasureSpirit: {
    id: "treasureSpirit",
    name: "Treasure Spirit",
    width: 32,
    height: 32,
    openAnimDuration: 0,
    interactionType: "treasureSpirit",
    interactLabel: "E Follow",
    sprites: {
      closedAsset: "treasureMapSprite",
      openStaticAsset: "treasureMapSprite",
      sheetAsset: null,
      spiritSheetAsset: "treasureSpiritSheet",
      spiritFrameWidth: 32,
      spiritFrameHeight: 32,
      spiritFrameCount: 8,
      spiritFrameDuration: 0.1
    }
  },
  devilMerchant: {
    id: "devilMerchant",
    name: "Devil Merchant",
    width: 48,
    height: 48,
    openAnimDuration: 0,
    interactionType: "devilMerchant",
    interactLabel: "E Trade",
    sprites: {
      sheetAsset: "devilMerchantSheet",
      frameWidth: 48,
      frameHeight: 48,
      frameCols: 8,
      frameRows: 1,
      frameCount: 8,
      frameDuration: 0.1
    }
  },
  biomePortal: {
    id: "biomePortal",
    name: "Biome Portal",
    width: 64,
    height: 80,
    openAnimDuration: 0,
    interactionType: "portal",
    interactLabel: "E Enter",
    sprites: {
      sheetAsset: "biomePortalSheet",
      frameWidth: 100,
      frameHeight: 100,
      frameCols: 7,
      frameRows: 6,
      frameCount: 41,
      frameDuration: 0.08
    }
  },
  unknownWell: {
    id: "unknownWell",
    name: "Unknown Well",
    width: 48,
    height: 48,
    openAnimDuration: 0.42,
    shadow: WELL_SHADOW,
    interactionType: "unknownWell",
    interactLabel: "E Drink",
    sprites: {
      closedAsset: "purpleWellFull5",
      openFrames: ["purpleWellUse0", "purpleWellUse1", "purpleWellUse2", "purpleWellUse3", "purpleWellUse4", "purpleWellUse5"],
      openStaticAsset: "purpleWellEmpty"
    }
  }
};

export const SEARCHABLE_ASSET_SPECS = [
  ["smallChestOpenStatic", "./assets/biomes/openworld/Chest A/chestA_0000_chest-A-open-static.png"],
  ["smallChestOpenAnim3", "./assets/biomes/openworld/Chest A/chestA_0001_chest-A-open-anim-03.png"],
  ["smallChestOpenAnim2", "./assets/biomes/openworld/Chest A/chestA_0002_chest-A-open-anim-02.png"],
  ["smallChestOpenAnim1", "./assets/biomes/openworld/Chest A/chestA_0003_chest-A-open-anim-01.png"],
  ["smallChestClosed", "./assets/biomes/openworld/Chest A/chestA_0004_chest-A-closed.png"],
  ["largeChestOpenStatic", "./assets/biomes/openworld/Chest B/chestB_0000_chest-B-open-static.png"],
  ["largeChestOpenAnim3", "./assets/biomes/openworld/Chest B/chestB_0001_chest-B-open-anim-03.png"],
  ["largeChestOpenAnim2", "./assets/biomes/openworld/Chest B/chestB_0002_chest-B-open-anim-02.png"],
  ["largeChestOpenAnim1", "./assets/biomes/openworld/Chest B/chestB_0003_chest-B-open-anim-01.png"],
  ["largeChestClosed", "./assets/biomes/openworld/Chest B/chestB_0004_chest-B-closed.png"],
  ["redWellFull1", "./assets/biomes/openworld/Red well/red-well-anim-full-01.png"],
  ["redWellFull2", "./assets/biomes/openworld/Red well/red-well-anim-full-02.png"],
  ["redWellFull3", "./assets/biomes/openworld/Red well/red-well-anim-full-03.png"],
  ["redWellFull4", "./assets/biomes/openworld/Red well/red-well-anim-full-04.png"],
  ["redWellFull5", "./assets/biomes/openworld/Red well/red-well-anim-full-05.png"],
  ["redWellUse1", "./assets/biomes/openworld/Red well/red-well-anim-use-01.png"],
  ["redWellUse2", "./assets/biomes/openworld/Red well/red-well-anim-use-02.png"],
  ["redWellUse3", "./assets/biomes/openworld/Red well/red-well-anim-use-03.png"],
  ["redWellUse4", "./assets/biomes/openworld/Red well/red-well-anim-use-04.png"],
  ["redWellUse5", "./assets/biomes/openworld/Red well/red-well-anim-use-05.png"],
  ["redWellUse6", "./assets/biomes/openworld/Red well/red-well-anim-use-06.png"],
  ["redWellEmpty", "./assets/biomes/openworld/Red well/red-well-static-empty-00.png"],
  ["yellowWellFull1", "./assets/biomes/openworld/Yellow well/yellow-well-anim-full-01.png"],
  ["yellowWellFull2", "./assets/biomes/openworld/Yellow well/yellow-well-anim-full-02.png"],
  ["yellowWellFull3", "./assets/biomes/openworld/Yellow well/yellow-well-anim-full-03.png"],
  ["yellowWellFull4", "./assets/biomes/openworld/Yellow well/yellow-well-anim-full-04.png"],
  ["yellowWellFull5", "./assets/biomes/openworld/Yellow well/yellow-well-anim-full-05.png"],
  ["yellowWellUse1", "./assets/biomes/openworld/Yellow well/yellow-well-anim-use-01.png"],
  ["yellowWellUse2", "./assets/biomes/openworld/Yellow well/yellow-well-anim-use-02.png"],
  ["yellowWellUse3", "./assets/biomes/openworld/Yellow well/yellow-well-anim-use-03.png"],
  ["yellowWellUse4", "./assets/biomes/openworld/Yellow well/yellow-well-anim-use-04.png"],
  ["yellowWellUse5", "./assets/biomes/openworld/Yellow well/yellow-well-anim-use-05.png"],
  ["yellowWellUse6", "./assets/biomes/openworld/Yellow well/yellow-well-anim-use-06.png"],
  ["yellowWellEmpty", "./assets/biomes/openworld/Yellow well/yellow-well-static-empty-00.png"],
  ["purpleWellFull1", "./assets/biomes/openworld/Purple Well/purple-well-anim-full-01.png"],
  ["purpleWellFull2", "./assets/biomes/openworld/Purple Well/purple-well-anim-full-02.png"],
  ["purpleWellFull3", "./assets/biomes/openworld/Purple Well/purple-well-anim-full-03.png"],
  ["purpleWellFull4", "./assets/biomes/openworld/Purple Well/purple-well-anim-full-04.png"],
  ["purpleWellFull5", "./assets/biomes/openworld/Purple Well/purple-well-anim-full-05.png"],
  ["purpleWellUse0", "./assets/biomes/openworld/Purple Well/purple-well-anim-use-00.png"],
  ["purpleWellUse1", "./assets/biomes/openworld/Purple Well/purple-well-anim-use-01.png"],
  ["purpleWellUse2", "./assets/biomes/openworld/Purple Well/purple-well-anim-use-02.png"],
  ["purpleWellUse3", "./assets/biomes/openworld/Purple Well/purple-well-anim-use-03.png"],
  ["purpleWellUse4", "./assets/biomes/openworld/Purple Well/purple-well-anim-use-04.png"],
  ["purpleWellUse5", "./assets/biomes/openworld/Purple Well/purple-well-anim-use-05.png"],
  ["purpleWellEmpty", "./assets/biomes/openworld/Purple Well/purple-well-static-empty-00.png"],
  ["ringSelectionShopSprite", "./assets/biomes/openworld/ring selection.png"],
  ["lifeSpringSheet", "./assets/biomes/openworld/life-spring-148x128.png"],
  ["biomePortalSheet", "./assets/biomes/openworld/Portal_100x100px.png"],
  ["cursedAnvilSprite", "./assets/biomes/openworld/a cursed anvil.png"],
  ["treasureSpiritSheet", "./assets/biomes/openworld/Treasure Spirit.png"],
  ["treasureMapSprite", "./assets/biomes/openworld/a treasure map.png"],
  ["devilMerchantSheet", "./assets/biomes/openworld/devil merchant.png"]
];

export const SEARCHABLE_ARCHETYPE_PLANS = {
  start: { smallChestCount: 1, largeChestCount: 0, costBase: 12 },
  openSpace: { smallChestCount: 1, largeChestCount: 0, chance: 0.8, costBase: 15 },
  miniboss: { smallChestCount: 1, largeChestCount: 1, costBase: 28 },
  ruins: { smallChestCount: 1, largeChestCount: 0, chance: 1, costBase: 18 },
  vault: { smallChestCount: 3, largeChestCount: 2, costBase: 24 },
  woods: { smallChestCount: 2, largeChestCount: 0, chance: 0.8, costBase: 16 },
  deepWoods: { smallChestCount: 0, largeChestCount: 0, costBase: 20 },
  empty: { smallChestCount: 0, largeChestCount: 0, costBase: 0 }
};

export const SEARCHABLE_INTERACT_RANGE = 100;
