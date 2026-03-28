import { HERO_ASSET_SPECS } from "../data/heroes.js";
import { ENEMY_ASSET_SPECS } from "../data/enemies.js";
import { UNDEAD_ENEMY_ASSET_SPECS } from "../data/undead-enemies.js";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

async function loadJson(src) {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Failed to load ${src}`);
  return response.json();
}

export async function loadAssetPack() {
  const assetSpecs = [
    ["tiles", "./assets/environment/tiles.png"],
    ["projectileDarkBolt", "./assets/projectiles/darkness-bolt.png"],
    ["darkMageIdle", "./assets/heroes/dark-mage/Idle.png"],
    ["darkMageWalk", "./assets/heroes/dark-mage/Walk.png"],
    ["darkMageRun", "./assets/heroes/dark-mage/Run.png"],
    ["darkMageRolling", "./assets/heroes/dark-mage/Rolling.png"],
    ["darkMageSlide", "./assets/heroes/dark-mage/Slide.png"],
    ["darkMageTakeDamage", "./assets/heroes/dark-mage/TakeDamage.png"],
    ["darkMageQuickShot", "./assets/heroes/dark-mage/QuickShot.png"],
    ["darkMageDie", "./assets/heroes/dark-mage/Die.png"],
    ["enemySlime", "./assets/enemies/sprSmallSlime.png"],
    ["enemySkeleton", "./assets/enemies/sprSkeleton1.png"],
    ["enemyGoblin", "./assets/enemies/sprGoblinNormal.png"],
    ["enemyTrollIdle", "./assets/enemies/CAVETROLL_IDLE-Sheet.png"],
    ["enemyTrollWalk", "./assets/enemies/CAVETROLL_WALK-Sheet.png"],
    ["enemyGoblinMageIdle", "./assets/enemies/goblin-mage-idle.png"],
    ["enemyGoblinMageMove", "./assets/enemies/goblin-mage-move.png"],
    ["biomeGroundBase", "./assets/biomes/openworld/mainGround1280px.png"],
    ["biomeGroundGrassA1", "./assets/biomes/openworld/grassA_1.png"],
    ["biomeGroundGrassA2", "./assets/biomes/openworld/grassA_2.png"],
    ["biomeGroundRocksA", "./assets/biomes/openworld/groundrocksA.png"],
    ["biomeRockBorder", "./assets/biomes/openworld/groundhillsA.png"],
    ["biomeBackdrop", "./assets/biomes/openworld/bckgrnd_mainstatic.png"],
    ["biomeCobble", "./assets/biomes/openworld/decorative_props.png"],
    ["biomeBlockerChunks", "./assets/biomes/blockers/blocks-for-empty-grid.png"],
    ["soulSiphonSpiritIdle", "./assets/effects/soul-siphon-spirit/Idle.png"],
    ["soulSiphonSpiritMove", "./assets/effects/soul-siphon-spirit/Move.png"],
    ["soulSiphonSpiritAttack", "./assets/effects/soul-siphon-spirit/Attack1.png"],
    ...ENEMY_ASSET_SPECS,
    ...HERO_ASSET_SPECS,
    ...UNDEAD_ENEMY_ASSET_SPECS
  ];

  const imageEntries = await Promise.all(
    assetSpecs.map(async ([key, src]) => [key, await loadImage(src)])
  );
  const jsonEntries = await Promise.all([
    ["biomeGroundGrassA1Defs", await loadJson("./assets/biomes/openworld/grassA_1.json")],
    ["biomeGroundGrassA2Defs", await loadJson("./assets/biomes/openworld/grassA_2.json")],
    ["biomeGroundRocksADefs", await loadJson("./assets/biomes/openworld/rocksA.json")]
  ]);
  return Object.fromEntries([...imageEntries, ...jsonEntries]);
}
