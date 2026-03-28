import { getHeroDef, HERO_LIST } from "./heroes.js";
import { getWeaponArtKind, WEAPON_ARTS } from "./weapon-arts.js";
import { getWeaponArtBuildSelectableUpgrades, getWeaponArtUpgradeDefById } from "./weapon-art-upgrades.js";

const CATEGORY_LABELS = Object.freeze({
  damage: "Damage",
  rhythm: "Rhythm",
  control: "Control",
  elemental: "Elemental",
  onhit: "On Hit",
  spiritcraft: "Spiritcraft"
});

const CATEGORY_COLORS = Object.freeze({
  damage: "#f97316",
  rhythm: "#22c55e",
  control: "#3b82f6",
  elemental: "#facc15",
  onhit: "#f472b6",
  spiritcraft: "#a855f7"
});

const CATEGORY_LAYOUTS = Object.freeze({
  projectile: ["damage", "rhythm", "control", "elemental"],
  windVolley: ["damage", "rhythm", "control", "onhit"],
  bladeBlast: ["damage", "rhythm", "control", "onhit"],
  soulSiphon: ["damage", "rhythm", "control", "spiritcraft"],
  guardCombo: ["damage", "rhythm", "control", "onhit"]
});

const BOARD_MASKS = Object.freeze({
  projectile: [
    [7, 0], [7, 1], [8, 1], [7, 2], [8, 2], [9, 2], [6, 3], [7, 3], [8, 3], [9, 3],
    [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [4, 5], [5, 5], [6, 5], [7, 5],
    [8, 5], [9, 5], [10, 5], [11, 5], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6],
    [9, 6], [10, 6], [11, 6], [12, 6], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7],
    [8, 7], [9, 7], [10, 7], [11, 7], [12, 7], [13, 7], [2, 8], [3, 8], [4, 8], [5, 8],
    [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [1, 9], [2, 9],
    [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [11, 9], [12, 9],
    [13, 9], [1, 10], [2, 10], [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10],
    [10, 10], [11, 10], [12, 10], [13, 10], [1, 11], [2, 11], [3, 11], [4, 11], [5, 11], [6, 11],
    [7, 11], [8, 11], [9, 11], [10, 11], [11, 11], [12, 11], [13, 11], [2, 12], [3, 12], [4, 12],
    [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12], [11, 12], [12, 12], [3, 13], [4, 13],
    [5, 13], [6, 13], [7, 13], [8, 13], [9, 13], [10, 13], [11, 13], [4, 14], [5, 14], [6, 14],
    [7, 14], [8, 14], [9, 14], [10, 14]
  ],
  soulSiphon: [
    [5, 0], [6, 0], [4, 1], [5, 1], [6, 1], [7, 1], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2],
    [3, 3], [4, 3], [5, 3], [6, 3], [4, 4], [5, 4], [6, 4], [5, 5], [6, 5], [5, 6], [6, 6],
    [4, 7], [5, 7], [3, 8], [4, 8], [2, 9], [3, 9], [1, 10], [2, 10]
  ],
  bladeBlast: [
    [3, 0], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [1, 3], [2, 3], [3, 3],
    [4, 3], [5, 3], [2, 4], [3, 4], [4, 4], [3, 5], [2, 6], [4, 6], [1, 7], [5, 7], [0, 8], [6, 8]
  ],
  windVolley: [
    [4, 0], [3, 1], [4, 1], [5, 1], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [1, 3], [2, 3], [3, 3],
    [4, 3], [5, 3], [6, 3], [7, 3], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [3, 5], [4, 5], [5, 5], [4, 6]
  ],
  guardCombo: [
    [1, 0], [2, 0], [3, 0], [1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [1, 3],
    [2, 3], [3, 3], [4, 3], [5, 3], [2, 4], [3, 4], [4, 4], [5, 4], [3, 5], [4, 5], [5, 5], [4, 6], [5, 6]
  ]
});

const BOARD_SEEDS = Object.freeze({
  projectile: [[6, 11], [7, 11], [8, 11], [7, 12]],
  soulSiphon: [[5, 3], [5, 4], [4, 4], [6, 4]],
  bladeBlast: [[3, 2], [3, 3], [2, 3], [4, 3]],
  windVolley: [[4, 2], [4, 3], [3, 3], [5, 3]],
  guardCombo: [[2, 2], [3, 2], [2, 3], [3, 3]]
});

const SHARED_CATEGORY_SHAPES = Object.freeze({
  damage: [[0, 0], [1, 0], [2, 0], [1, 1]],
  rhythm: [[0, 0], [1, 0], [1, 1], [2, 1]],
  control: [[0, 0], [0, 1], [0, 2], [1, 2]]
});

const UNIQUE_CATEGORY_SHAPES = Object.freeze([
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1]]
]);

let cachedBoardDefs = null;

function toCellKey(x, y) {
  return `${x},${y}`;
}

function normalizeOffsets(offsets) {
  const minX = Math.min(...offsets.map(([x]) => x));
  const minY = Math.min(...offsets.map(([, y]) => y));
  return offsets.map(([x, y]) => [x - minX, y - minY]);
}

function getFourthCategory(weaponArtId) {
  const categories = CATEGORY_LAYOUTS[weaponArtId] || ["damage"];
  return categories[3] || categories[categories.length - 1] || "damage";
}

function getPieceOffsetsForUpgrade(weaponArtId, def, uniqueIndex = 0) {
  const category = String(def?.category || "damage");
  if (SHARED_CATEGORY_SHAPES[category]) {
    return normalizeOffsets(SHARED_CATEGORY_SHAPES[category]);
  }
  if (category === getFourthCategory(weaponArtId)) {
    return normalizeOffsets(UNIQUE_CATEGORY_SHAPES[uniqueIndex % UNIQUE_CATEGORY_SHAPES.length]);
  }
  return normalizeOffsets([[0, 0]]);
}

function createBoardDefinition(weaponArtId) {
  const categories = CATEGORY_LAYOUTS[weaponArtId] || ["damage"];
  const defs = getWeaponArtBuildSelectableUpgrades(weaponArtId);
  const categoryMeta = {};
  const upgradePieces = {};

  categories.forEach((category, index) => {
    categoryMeta[category] = {
      id: category,
      label: CATEGORY_LABELS[category] || category,
      color: CATEGORY_COLORS[category] || "#94a3b8",
      shapeType: index === 0 ? "t" : index === 1 ? "z" : index === 2 ? "l" : "unique"
    };
  });

  defs.forEach((def, index) => {
    upgradePieces[def.id] = {
      upgradeId: def.id,
      category: def.category,
      color: CATEGORY_COLORS[def.category] || "#94a3b8",
      offsets: getPieceOffsetsForUpgrade(weaponArtId, def, index)
    };
  });

  const mask = BOARD_MASKS[weaponArtId] || [];
  const seedKeys = (BOARD_SEEDS[weaponArtId] || []).map(([x, y]) => toCellKey(x, y));
  return {
    weaponArtId,
    boardId: `${weaponArtId}:board:v1`,
    name: weaponArtId,
    lanes: [...categories],
    categoryMeta,
    mask: [...mask],
    maskKeys: mask.map(([x, y]) => toCellKey(x, y)),
    seedKeys,
    upgradePieces,
    maxLevel: 1 + Math.ceil(Math.max(0, mask.length - seedKeys.length) / 2)
  };
}

export function getWeaponArtCategories(weaponArtId) {
  return [...(CATEGORY_LAYOUTS[weaponArtId] || ["damage"])];
}

export function getWeaponArtCategoryLabel(category) {
  return CATEGORY_LABELS[String(category || "").toLowerCase()] || String(category || "");
}

export function getWeaponArtBoardDefinitions() {
  if (cachedBoardDefs) return cachedBoardDefs;
  cachedBoardDefs = Object.fromEntries(WEAPON_ARTS.map((entry) => [entry.id, createBoardDefinition(entry.id)]));
  return cachedBoardDefs;
}

export function getWeaponArtBoardDefinition(weaponArtId) {
  return getWeaponArtBoardDefinitions()[weaponArtId] || null;
}

export function createWeaponArtProgressionState(weaponArtId) {
  const board = getWeaponArtBoardDefinition(weaponArtId);
  return {
    weaponArtId,
    boardId: board?.boardId || `${weaponArtId}:board:v1`,
    xp: 0,
    level: 1,
    pendingUnlockCount: 0,
    unlockedCells: [...(board?.seedKeys || [])],
    placedUpgrades: [],
    selectedEvolutionIds: []
  };
}

export function buildRunWeaponArtState(weaponArtId, progressionState = null) {
  const state = progressionState || createWeaponArtProgressionState(weaponArtId);
  const runAttackUpgrades = [];
  const categoryCounts = {};
  for (const placement of state.placedUpgrades || []) {
    const def = getWeaponArtUpgradeDefById(weaponArtId, placement.upgradeId);
    if (!def) continue;
    runAttackUpgrades.push({
      id: def.id,
      name: def.name,
      description: def.description,
      category: def.category,
      level: 1,
      maxLevel: def.maxLevel
    });
    categoryCounts[def.category] = (categoryCounts[def.category] || 0) + 1;
  }
  return {
    weaponArtId,
    runAttackUpgrades,
    runAttackPenalties: [],
    categoryCounts,
    progressionState: state
  };
}

export function getHeroDefaultAttackType(heroId) {
  return getHeroDef(heroId)?.defaultWeaponArt || null;
}

export function getHeroDefaultWeaponArtClass(heroId) {
  return getHeroDef(heroId)?.defaultWeaponArtClass || "melee";
}

export function canHeroUseWeaponArt(heroId, weaponArtId, options = {}) {
  const hero = getHeroDef(heroId);
  if (!hero || !weaponArtId) return false;
  if (hero.defaultWeaponArt === weaponArtId) return true;
  if (!options.sharedUnlocked) return false;

  const heroClass = hero.defaultWeaponArtClass || "melee";
  const artKind = getWeaponArtKind(weaponArtId);
  if (heroClass === "hybrid") return true;
  if (heroClass === artKind) return true;
  return heroClass === "melee" && artKind === "hybrid";
}

export function getHeroSelectableWeaponArts(heroId, options = {}) {
  return WEAPON_ARTS.filter((weaponArt) => canHeroUseWeaponArt(heroId, weaponArt.id, options));
}

export function getWeaponArtOwnerHeroId(weaponArtId) {
  return HERO_LIST.find((hero) => hero.ownsDefaultWeaponArt && hero.defaultWeaponArt === weaponArtId)?.id || null;
}
