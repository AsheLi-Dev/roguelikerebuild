export const SEARCHABLE_DEFS = {
  smallChest: {
    id: "smallChest",
    name: "Small Chest",
    width: 32,
    height: 32,
    openAnimDuration: 0.24,
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
    rarityChances: [
      { rarity: "uncommon", chance: 0.9 },
      { rarity: "rare", chance: 0.1 }
    ],
    sprites: {
      closedAsset: "largeChestClosed",
      openFrames: ["largeChestOpenAnim1", "largeChestOpenAnim2", "largeChestOpenAnim3"],
      openStaticAsset: "largeChestOpenStatic"
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
  ["largeChestClosed", "./assets/biomes/openworld/Chest B/chestB_0004_chest-B-closed.png"]
];

export const SEARCHABLE_ARCHETYPE_PLANS = {
  start: { smallChestCount: 1, largeChestCount: 0, costBase: 12 },
  openSpace: { smallChestCount: 1, largeChestCount: 0, chance: 0.4, costBase: 15 },
  miniboss: { smallChestCount: 0, largeChestCount: 1, costBase: 28 },
  lostCamps: { smallChestCount: 2, largeChestCount: 0, costBase: 18 },
  ruins: { smallChestCount: 1, largeChestCount: 0, chance: 0.75, costBase: 18 },
  vault: { smallChestCount: 2, largeChestCount: 1, costBase: 24 },
  woods: { smallChestCount: 1, largeChestCount: 0, chance: 0.65, costBase: 16 },
  empty: { smallChestCount: 0, largeChestCount: 0, costBase: 0 }
};

export const SEARCHABLE_INTERACT_RANGE = 100;
