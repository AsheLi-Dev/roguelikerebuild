import { HERO_ASSET_SPECS } from "../data/heroes.js";
import { ENEMY_ASSET_SPECS } from "../data/enemies.js";
import { RING_ITEM_ATLAS } from "../data/rings.js";
import { BARBARIAN_ENEMY_ASSET_SPECS } from "../data/barbarian-enemies.js";
import { SHEPARD_ENEMY_ASSET_SPECS } from "../data/shepard-enemies.js";
import { SEARCHABLE_ASSET_SPECS } from "../data/searchables.js";
import { UNDEAD_ENEMY_ASSET_SPECS } from "../data/undead-enemies.js";
import { SKILL_ICON_ATLASES } from "../data/skill-icons.js";
import { BIOME_OBSTACLE_IMAGE_ASSET_SPECS, BIOME_OBSTACLE_JSON_ASSET_SPECS } from "../data/biome-obstacles.js";

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
    ["volatileFireballProjectile", "./assets/projectiles/wizard-charged-fireball.png"],
    ["darkMageIdle", "./assets/heroes/dark-mage/Idle.png"],
    ["darkMageWalk", "./assets/heroes/dark-mage/Walk.png"],
    ["darkMageRun", "./assets/heroes/dark-mage/Run.png"],
    ["darkMageRolling", "./assets/heroes/dark-mage/Rolling.png"],
    ["darkMageDashStart", "./assets/heroes/dark-mage/SlideStart.png"],
    ["darkMageDashEnd", "./assets/heroes/dark-mage/SlideEnd.png"],
    ["darkMageSlide", "./assets/heroes/dark-mage/Slide.png"],
    ["darkMageTakeDamage", "./assets/heroes/dark-mage/TakeDamage.png"],
    ["darkMageAttack1", "./assets/heroes/dark-mage/Attack1.png"],
    ["darkMageAttack2", "./assets/heroes/dark-mage/Attack2.png"],
    ["darkMageAttack3", "./assets/heroes/dark-mage/Attack3.png"],
    ["darkMageQuickShot", "./assets/heroes/dark-mage/QuickShot.png"],
    ["darkMageDie", "./assets/heroes/dark-mage/Die.png"],
    ["dashChargeIconFull", "./assets/UI/dash-charge/full.png"],
    ["dashChargeIconEmpty", "./assets/UI/dash-charge/empty.png"],
    [RING_ITEM_ATLAS.assetKey, RING_ITEM_ATLAS.src],
    ["biomeGroundBase", "./assets/biomes/openworld/mainGround1280px.png"],
    ["biomeGroundGrassA1", "./assets/biomes/openworld/grassA_1.png"],
    ["biomeGroundGrassA2", "./assets/biomes/openworld/grassA_2.png"],
    ["biomeGroundRocksA", "./assets/biomes/openworld/groundrocksA.png"],
    ["biomeGroundFlowers", "./assets/biomes/openworld/flowers/fourFlowers.png"],
    ...BIOME_OBSTACLE_IMAGE_ASSET_SPECS,
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
    ["biomeBackdropCloud1", "./assets/biomes/openworld/1.png"],
    ["biomeBackdropCloud2", "./assets/biomes/openworld/2.png"],
    ["biomeBackdropCloud3", "./assets/biomes/openworld/3.png"],
    ["biomeBackdropCloud4", "./assets/biomes/openworld/4.png"],
    ["biomeBackdropCloud5", "./assets/biomes/openworld/5.png"],
    ["biomeBackdropCloud6", "./assets/biomes/openworld/6.png"],
    ["biomeRagWindA", "./assets/biomes/openworld/Rag/Rag wind A/32x80.png"],
    ["biomeCobble", "./assets/biomes/openworld/decorative_props.png"],
    ["biomeBlockerChunks", "./assets/biomes/blockers/blocks-for-empty-grid.png"],
    ["soulSiphonSpiritIdle", "./assets/effects/soul-siphon-spirit/Idle.png"],
    ["soulSiphonSpiritMove", "./assets/effects/soul-siphon-spirit/Move.png"],
    ["soulSiphonSpiritAttack", "./assets/effects/soul-siphon-spirit/Attack1.png"],
    ["orangeFireThrowerVfx", "./assets/Combat VFX/blue fire splash/Orange Fire.png"],
    ["groundImpactOrange", "./assets/Combat VFX/None Pixel VFX/Ground Explosion/Orange Ground Impact.png"],
    ["groundImpactGreen", "./assets/Combat VFX/None Pixel VFX/Ground Explosion/Green Ground Impact.png"],
    ["groundImpactPurple", "./assets/Combat VFX/None Pixel VFX/Ground Explosion/Dark Ground Impact.png"],
    ["groundImpactLightOrange", "./assets/Combat VFX/None Pixel VFX/Ground Explosion/White Ground Impact.png"],
    ["iceNovaImpact", "./assets/Combat VFX/None Pixel VFX/Water Ice/Ice Nova/Effect 1.png"],
    ["fireExplosionVfx", "./assets/Combat VFX/None Pixel VFX/Fire/Fire Explosion.png"],
    ["smokeExplosionVfx", "./assets/Combat VFX/None Pixel VFX/White VFX/Effect 9/Effect 9.png"],
    ["darkGraspVfx", "./assets/Combat VFX/None Pixel VFX/Dark/Dark Grasp/Effect 6.png"],
    ["darkLaserVfx", "./assets/Combat VFX/None Pixel VFX/Dark/Dark Laser/Effect 3.png"],
    ["darkChainOverheadStartVfx", "./assets/Combat VFX/None Pixel VFX/Dark/Dark Chain Overhead/start.png"],
    ["darkChainOverheadIdleVfx", "./assets/Combat VFX/None Pixel VFX/Dark/Dark Chain Overhead/idle.png"],
    ["darkChainOverheadDeathVfx", "./assets/Combat VFX/None Pixel VFX/Dark/Dark Chain Overhead/death.png"],
    ["deathKnightSwordSlashVfx", "./assets/Combat VFX/None Pixel VFX/Blood/Sword Slash/Dark Sword Slash.png"],
    ["deathKnightDarkWaveProjectile", "./assets/Combat VFX/None Pixel VFX/Blood/Wave/Dark Wave Attack.png"],
    ["lightningFlashVfx", "./assets/Combat VFX/None Pixel VFX/Lightning 2/lightning flash/yellow lightning flash.png"],
    ["lightningStrikeVfx", "./assets/Combat VFX/None Pixel VFX/Lightning/Short Lightning Strike/Short Lightning Strike.png"],
    ["elementMageFireBreathVfx", "./assets/Combat VFX/None Pixel VFX/Fire/Fire Breath.png"],
    ["elementMageIceProjectile", "./assets/Combat VFX/None Pixel VFX/Water Ice/Effect 8/Effect 8 Idle.png"],
    ["elementMageIceImpactVfx", "./assets/Combat VFX/None Pixel VFX/Water Ice/Effect 8/Effect 8 End.png"],
    ["elementMageLightningProjectile", "./assets/Combat VFX/None Pixel VFX/Lightning/Lightning Orb/Yellow Lightning Orb.png"],
    ["elementMageLightningImpactVfx", "./assets/Combat VFX/None Pixel VFX/Lightning/Effect 3/Yellow Lightning Explosion.png"],
    [SKILL_ICON_ATLASES.primary.imageAssetKey, SKILL_ICON_ATLASES.primary.src],
    [SKILL_ICON_ATLASES.secondary.imageAssetKey, SKILL_ICON_ATLASES.secondary.src],
    ...SEARCHABLE_ASSET_SPECS,
    ...ENEMY_ASSET_SPECS,
    ...HERO_ASSET_SPECS,
    ...BARBARIAN_ENEMY_ASSET_SPECS,
    ...SHEPARD_ENEMY_ASSET_SPECS,
    ...UNDEAD_ENEMY_ASSET_SPECS
  ];

  const imageEntries = await Promise.all(
    assetSpecs.map(async ([key, src]) => [key, await loadImage(src)])
  );
  const audioEntries = await Promise.all([
    ["dashSfx", withVolume(await loadAudio("./assets/Audio/Dash.mp3"), 0.22)],
    ["slideSfx", withVolume(await loadAudio("./assets/Audio/Slide.mp3"), 0.22)],
    ["openChestSfx", withVolume(await loadAudio("./assets/Audio/Open Chest.mp3"), 0.2)],
    ["footstepStep1Sfx", withVolume(await loadAudio("./assets/Audio/Footstep/step 1.mp3"), 0.18)],
    ["footstepStep2Sfx", withVolume(await loadAudio("./assets/Audio/Footstep/step 2.mp3"), 0.18)],
    ["footstepStep3Sfx", withVolume(await loadAudio("./assets/Audio/Footstep/step 3.mp3"), 0.18)],
    ["footstepStep4Sfx", withVolume(await loadAudio("./assets/Audio/Footstep/step 4.mp3"), 0.18)],
    ["footstepStep5Sfx", withVolume(await loadAudio("./assets/Audio/Footstep/step 5.mp3"), 0.18)],
    ["footstepStep6Sfx", withVolume(await loadAudio("./assets/Audio/Footstep/step 6.mp3"), 0.18)],
    ["drinkPotionSfx", withVolume(await loadAudio("./assets/Audio/Drink Potion.mp3"), 0.2)],
    ["masterBgm", withVolume(await loadAudio("./assets/Audio/Master BGM.mp3"), 0.2)],
    ["enemyHurtSfx", withVolume(await loadAudio("./assets/Audio/enemy_hurt.wav"), 0.2)],
    ["enemyPlateHitShieldSfx", withVolume(await loadAudio("./assets/Audio/enemy_plate_hit_shield.mp3"), 0.18)],
    ["enemyPlateHitArmorSfx", withVolume(await loadAudio("./assets/Audio/enemy_plate_hit_armor.mp3"), 0.2)],
    ["goldPickupSfx", withVolume(await loadAudio("./assets/Audio/gold_pickup.mp3"), 0.12)],
    ["crateBreakSfx", withVolume(await loadAudio("./assets/Audio/crate_break.mp3"), 0.22)],
    ["jarBreakSfx", withVolume(await loadAudio("./assets/Audio/jar_break.mp3"), 0.22)],
    ["tombBreakSfx", withVolume(await loadAudio("./assets/Audio/tomb_break.mp3"), 0.24)],
    ["knightEnemyHitSfx", withVolume(await loadAudio("./assets/Audio/knight_enemy_hit.mp3"), 0.24)],
    ["knightEnemyHitLayerSfx", withVolume(await loadAudio("./assets/Audio/knight_enemy_hit_layer.mp3"), 0.16)],
    ["darkMageEnemyHitSfx", withVolume(await loadAudio("./assets/Audio/dark_mage_enemy_hit.wav"), 0.24)],
    ["darkMageEnemyHitLayerSfx", withVolume(await loadAudio("./assets/Audio/dark_mage_enemy_hit_layer.mp3"), 0.1)],
    ["darkMageAttackSfx", withVolume(await loadAudio("./assets/Audio/dark_mage_attack.mp3"), 0.2)],
    ["elementMageAttackSfx", withVolume(await loadAudio("./assets/Audio/element_mage_attack_fire.mp3"), 0.2)],
    ["elementMageIceAttackSfx", withVolume(await loadAudio("./assets/Audio/element_mage_attack_ice.mp3"), 0.16)],
    ["elementMageLightningAttackSfx", withVolume(await loadAudio("./assets/Audio/element_mage_attack_lightning.mp3"), 0.18)],
    ["elementMageFireProjectileHitSfx", withVolume(await loadAudio("./assets/Audio/element_mage_fire_projectile_hit.wav"), 0.2)],
    ["elementMageFireProjectileHitLayerSfx", withVolume(await loadAudio("./assets/Audio/element_mage_fire_projectile_hit_layer.wav"), 0.12)],
    ["elementMageFireLightningDetonationSfx", withVolume(await loadAudio("./assets/Audio/element_mage_fire_lightning_detonation.mp3"), 0.18)],
    ["elementMageIceProjectileHitSfx", withVolume(await loadAudio("./assets/Audio/element_mage_ice_projectile_hit.wav"), 0.18)],
    ["elementMageIceProjectileHitLayerSfx", withVolume(await loadAudio("./assets/Audio/element_mage_ice_projectile_hit_layer.mp3"), 0.12)],
    ["slimeDeathSfx", withVolume(await loadAudio("./assets/Audio/slime_death.mp3"), 0.22)],
    ["undeadDeathBoneBreakSfxA", withVolume(await loadAudio("./assets/Audio/undead_death_bone_break_a.mp3"), 0.24)],
    ["undeadDeathBoneBreakSfxB", withVolume(await loadAudio("./assets/Audio/undead_death_bone_break_b.mp3"), 0.22)],
    ["barbarianDeathFleshSfxA", withVolume(await loadAudio("./assets/Audio/barbarian_death_flesh_a.mp3"), 0.24)],
    ["barbarianDeathFleshSfxB", withVolume(await loadAudio("./assets/Audio/barbarian_death_flesh_b.mp3"), 0.22)],
    ["enemyGenericBowSfx", withVolume(await loadAudio("./assets/Audio/generic bow.mp3"), 0.18)],
    ["enemyGenericCastSfx", withVolume(await loadAudio("./assets/Audio/generic_cast.mp3"), 0.18)],
    ["enemyGenericGroundImpactSfx", withVolume(await loadAudio("./assets/Audio/generic_ground_impact.mp3"), 0.2)],
    ["enemyGenericSwooshSfx", withVolume(await loadAudio("./assets/Audio/generic_swoosh.mp3"), 0.18)],
    ["enemyGenericSwordSfx", withVolume(await loadAudio("./assets/Audio/generic_sword.mp3"), 0.2)],
    ["windVolleyHitSfx", withVolume(await loadAudio("./assets/Audio/wind_volley_hit.mp3"), 0.22)],
    ["windVolleyHitLayerSfx", withVolume(await loadAudio("./assets/Audio/wind_volley_hit_layer.mp3"), 0.18)],
    ["windVolleySpawnSfx", withVolume(await loadAudio("./assets/Audio/wind_volley_spawn.mp3"), 0.16)]
  ]);
  const jsonEntries = await Promise.all([
    ["biomeGroundGrassA1Defs", await loadJson("./assets/biomes/openworld/grassA_1.json")],
    ["biomeGroundGrassA2Defs", await loadJson("./assets/biomes/openworld/grassA_2.json")],
    ["biomeGroundRocksADefs", await loadJson("./assets/biomes/openworld/rocksA.json")],
    ["biomeGroundFlowerDefs", await loadJson("./assets/biomes/openworld/flowers/fourFlowers.json")],
    ...BIOME_OBSTACLE_JSON_ASSET_SPECS.map(async ([key, src]) => [key, await loadJson(src)]),
    [SKILL_ICON_ATLASES.primary.defsAssetKey, await loadJson(SKILL_ICON_ATLASES.primary.defsSrc)],
    [SKILL_ICON_ATLASES.secondary.defsAssetKey, await loadJson(SKILL_ICON_ATLASES.secondary.defsSrc)]
  ]);
  return Object.fromEntries([...imageEntries, ...audioEntries, ...jsonEntries]);
}
