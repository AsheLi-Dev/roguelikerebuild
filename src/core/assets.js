import { HERO_ASSET_SPECS } from "../data/heroes.js";
import { ENEMY_ASSET_SPECS } from "../data/enemies.js";
import { RING_ITEM_ATLAS } from "../data/rings.js";
import { BARBARIAN_ENEMY_ASSET_SPECS } from "../data/barbarian-enemies.js";
import { SEARCHABLE_ASSET_SPECS } from "../data/searchables.js";
import { UNDEAD_ENEMY_ASSET_SPECS } from "../data/undead-enemies.js";
import { SKILL_ICON_ATLASES } from "../data/skill-icons.js";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

function loadAudio(src) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const cleanup = () => {
      audio.removeEventListener("canplaythrough", handleReady);
      audio.removeEventListener("error", handleError);
    };
    const handleReady = () => {
      cleanup();
      resolve(audio);
    };
    const handleError = () => {
      cleanup();
      reject(new Error(`Failed to load ${src}`));
    };
    audio.preload = "auto";
    audio.addEventListener("canplaythrough", handleReady, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    audio.src = src;
    audio.load();
  });
}

function withVolume(audio, volume) {
  audio.volume = volume;
  return audio;
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
    ["heroFlyingSword", "./assets/projectiles/barbarian-spinning-axe.png"],
    ["darkMageIdle", "./assets/heroes/dark-mage/Idle.png"],
    ["darkMageWalk", "./assets/heroes/dark-mage/Walk.png"],
    ["darkMageRun", "./assets/heroes/dark-mage/Run.png"],
    ["darkMageRolling", "./assets/heroes/dark-mage/Rolling.png"],
    ["darkMageDashStart", "./assets/heroes/dark-mage/SlideStart.png"],
    ["darkMageDashEnd", "./assets/heroes/dark-mage/SlideEnd.png"],
    ["darkMageSlide", "./assets/heroes/dark-mage/Slide.png"],
    ["darkMageTakeDamage", "./assets/heroes/dark-mage/TakeDamage.png"],
    ["darkMageQuickShot", "./assets/heroes/dark-mage/QuickShot.png"],
    ["darkMageDie", "./assets/heroes/dark-mage/Die.png"],
    [RING_ITEM_ATLAS.assetKey, RING_ITEM_ATLAS.src],
    ["biomeGroundBase", "./assets/biomes/openworld/mainGround1280px.png"],
    ["biomeGroundGrassA1", "./assets/biomes/openworld/grassA_1.png"],
    ["biomeGroundGrassA2", "./assets/biomes/openworld/grassA_2.png"],
    ["biomeGroundRocksA", "./assets/biomes/openworld/groundrocksA.png"],
    ["biomeGroundFlowers", "./assets/biomes/openworld/flowers/fourFlowers.png"],
    ["treeBB01", "./assets/biomes/openworld/Trees/treeBB_01.png"],
    ["treeBB02", "./assets/biomes/openworld/Trees/treeBB_02.png"],
    ["treeBB03", "./assets/biomes/openworld/Trees/treeBB_03.png"],
    ["treeBB04", "./assets/biomes/openworld/Trees/treeBB_04.png"],
    ["treeBB05", "./assets/biomes/openworld/Trees/treeBB_05.png"],
    ["treeBB06", "./assets/biomes/openworld/Trees/treeBB_06.png"],
    ["treeBB07", "./assets/biomes/openworld/Trees/treeBB_07.png"],
    ["treeBB08", "./assets/biomes/openworld/Trees/treeBB_08.png"],
    ["biomeRockBorder", "./assets/biomes/openworld/groundhillsA.png"],
    ["biomeBackdrop", "./assets/biomes/openworld/bckgrnd_mainstatic.png"],
    ["biomeCobble", "./assets/biomes/openworld/decorative_props.png"],
    ["biomeBlockerChunks", "./assets/biomes/blockers/blocks-for-empty-grid.png"],
    ["soulSiphonSpiritIdle", "./assets/effects/soul-siphon-spirit/Idle.png"],
    ["soulSiphonSpiritMove", "./assets/effects/soul-siphon-spirit/Move.png"],
    ["soulSiphonSpiritAttack", "./assets/effects/soul-siphon-spirit/Attack1.png"],
    ["orangeFireThrowerVfx", "./assets/Combat VFX/blue fire splash/Orange Fire.png"],
    ["groundImpactOrange", "./assets/Combat VFX/Ground Impact/Orange Ground Impact.png"],
    ["groundImpactGreen", "./assets/Combat VFX/Ground Impact/Green Ground Impact.png"],
    ["groundImpactPurple", "./assets/Combat VFX/Ground Impact/Purple Ground Impact.png"],
    ["groundImpactLightOrange", "./assets/Combat VFX/Ground Impact/Light Orange Ground Impact.png"],
    [SKILL_ICON_ATLASES.primary.imageAssetKey, SKILL_ICON_ATLASES.primary.src],
    [SKILL_ICON_ATLASES.secondary.imageAssetKey, SKILL_ICON_ATLASES.secondary.src],
    ...SEARCHABLE_ASSET_SPECS,
    ...ENEMY_ASSET_SPECS,
    ...HERO_ASSET_SPECS,
    ...BARBARIAN_ENEMY_ASSET_SPECS,
    ...UNDEAD_ENEMY_ASSET_SPECS
  ];

  const imageEntries = await Promise.all(
    assetSpecs.map(async ([key, src]) => [key, await loadImage(src)])
  );
  const audioEntries = await Promise.all([
    ["enemyHurtSfx", withVolume(await loadAudio("./assets/Audio/enemy_hurt.wav"), 0.2)],
    ["goldPickupSfx", await loadAudio("./assets/Audio/Gold Pick Up.mp3")]
  ]);
  const jsonEntries = await Promise.all([
    ["biomeGroundGrassA1Defs", await loadJson("./assets/biomes/openworld/grassA_1.json")],
    ["biomeGroundGrassA2Defs", await loadJson("./assets/biomes/openworld/grassA_2.json")],
    ["biomeGroundRocksADefs", await loadJson("./assets/biomes/openworld/rocksA.json")],
    ["biomeGroundFlowerDefs", await loadJson("./assets/biomes/openworld/flowers/fourFlowers.json")],
    [SKILL_ICON_ATLASES.primary.defsAssetKey, await loadJson(SKILL_ICON_ATLASES.primary.defsSrc)],
    [SKILL_ICON_ATLASES.secondary.defsAssetKey, await loadJson(SKILL_ICON_ATLASES.secondary.defsSrc)]
  ]);
  return Object.fromEntries([...imageEntries, ...audioEntries, ...jsonEntries]);
}
