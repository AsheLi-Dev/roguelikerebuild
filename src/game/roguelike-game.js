import { loadAssetPack } from "../core/assets.js";
import { Camera } from "../core/camera.js";
import { InputController } from "../core/input.js";
import { centerOf, clamp } from "../core/runtime-utils.js";
import { DEFAULT_HERO_ID, getHeroDef, resolveSelectableHeroId } from "../data/heroes.js";
import { getWeaponArtDef } from "../data/weapon-arts.js";
import { buildRunWeaponArtState, createWeaponArtProgressionState } from "../data/weapon-art-progression.js";
import { createCombatState, damageEnemy, damagePlayer, resolveEnemyBodyDamage, spawnDamagePopup, spawnEnemyAreaHitbox, spawnEnemyProjectile, updateCombat, updateCombatFeedback, updateEnemyThreats } from "../systems/combat.js";
import { damageBreakable, updateBreakables } from "../systems/breakables.js";
import { clearCursedAnvilCurse, closeCursedAnvil, confirmCursedAnvilGamble, openCursedAnvil, updateCursedAnvilCurse, updateCursedAnvilParticles } from "../systems/cursed-anvil.js";
import {
  createAmbientLeavesState,
  createAmbientMagicParticlesState,
  resetAmbientLeaves,
  resetAmbientMagicParticles,
  updateAmbientLeaves,
  updateAmbientMagicParticles
} from "../systems/ambient-leaves.js";
import { clearTreasureSpirit, updateTreasureSpirit } from "../systems/treasure-spirit.js";
import { activateDevilMerchant, attackDevilMerchant, buyDevilMerchantOffer, clearDevilMerchant, closeDevilMerchant, sellRingToDevilMerchant, updateDevilMerchant } from "../systems/devil-merchant.js";
import { applyAffinityStatSource, getAffinityDebugInfo, grantAffinityXp } from "../systems/interactable-affinity.js";
import { spawnRoomInteractables } from "../systems/interactable-manager.js";
import { findSafeEnemySpawnPosition, getControllableEnemyTypeIds, spawnEnemyByType, spawnRoomEnemies, updateEnemies } from "../systems/enemies.js";
import { updateGoldDrops } from "../systems/gold.js";
import { computeXpToNext, grantExperience, updateExperienceDrops } from "../systems/experience.js";
import { consumeMaterialFromInventory, createMaterialInventory, ensureMaterialInventory, getMaterialCount, updateMaterialDrops } from "../systems/materials.js";
import { scaleGoldAmount } from "../systems/economy.js";
import {
  consumePendingFingerEchoAttack,
  consumePendingFingerSlideAttackTarget,
  getAvailableFingerDefsForMaterial,
  getAdjustedFingerCraftCost,
  getFingerInSlot,
  getOwnedFingerEntries,
  getStartingFingerCount,
  initializeFingerRuntime,
  onFingerBiomeRoomEntered,
  refreshFingerDerivedStats,
  sellOwnedFinger,
  slotHasFingerWithoutRing,
  unlockFingerFromMaterial,
  updateFingerRuntime
} from "../systems/fingers.js";
import { createMeleeAttackTokenController, DEFAULT_MELEE_ATTACK_TOKEN_COUNT, resetMeleeAttackTokenController, updateMeleeAttackTokens } from "../systems/melee-attack-tokens.js";
import { createMovementState, updatePlayerAnimation, updatePlayerMovement } from "../systems/movement.js";
import { clearPlayerStatSource, ensurePlayerStats, resetPlayerStats, setPlayerStatSource } from "../systems/player-stats.js";
import { createEnemyTestScene } from "../scenes/enemy-test-scene.js";
import { createAffinityScene } from "../scenes/affinity-scene.js";
import { createLoadoutScene } from "../scenes/loadout-scene.js";
import { createSettingsScene } from "../scenes/settings-scene.js";
import { createStartMenuScene } from "../scenes/start-menu-scene.js";
import { createFingerExperimentScene } from "../scenes/finger-experiment-scene.js";
import {
  addRing,
  applyMirrorUpgradeFromSource,
  applyMirrorUpgradeToRing,
  canApplyMirrorUpgradeToRing,
  canEquipOwnedRingToSlot,
  canScrapRing,
  canSelectRingForEquip,
  canUpgradeRing,
  canUseMirrorUpgradeSource,
  cancelPendingRingInventorySelection,
  equipOwnedRingToSlot,
  equipOwnedRing,
  getPendingRingInventorySelection,
  getOwnedRings,
  getRingEssence,
  initializeRingRuntime,
  isMirrorCatalystRing,
  refreshRingDerivedStats,
  scrapRing,
  togglePendingEquipSelection,
  toggleMirrorCatalystSelection,
  unequipRingBySlot,
  updateRingRuntime,
  upgradeRing
} from "../systems/rings.js";
import {
  getRingSelectionOffers,
  purchaseRingSelectionOffer,
  spawnAlchemyWorkshop,
  spawnBlacksmith,
  spawnBiomePortal,
  spawnLifeSpring,
  spawnPortal,
  updateSearchables
} from "../systems/searchables.js";
import { createStatusState, resetStatusState, updateStatusState } from "../systems/status-manager.js";
import { createDefaultTacticProfiles, getEnemyMovementClass } from "../systems/tactical-movement.js";
import { triggerEnemyAttackByIndex, updateManualControlledEnemy } from "../systems/undead-runtime.js";
import { getDefaultRunSkillIds } from "../systems/skills.js";
import { initializeWeaponArtRuntime } from "../systems/weapon-art-runtime.js";
import { applyFingerExperimentToRun, updateFingerExperimentRuntime } from "../systems/finger-experiment-runtime.js";
import { generateBreakRoom, generateRoom } from "../systems/world-generation.js";
import { renderGame } from "../render/renderer.js";
import { renderMinimap, setMinimapVisible, setMinimapWorld } from "../ui/minimap.js";

const ENEMY_TEST_SEED = 424242;
const ENEMY_TEST_ATTACK_KEYS = Object.freeze(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]);
const ENEMY_MOVEMENT_PATTERN_STORAGE_KEY = "roguelike.enemyMovementPatterns";
const ENEMY_MOVEMENT_PATTERN_TRIM_SECONDS = 2;
const MELEE_ATTACK_TOKEN_POOL_SIZE = DEFAULT_MELEE_ATTACK_TOKEN_COUNT;
const BGM_MENU_VOLUME = 0.4;
const BGM_RUN_VOLUME = 0.1;
const BGM_FADE_SPEED = 0.06;
const PLAYER_HIT_SLOW_DURATION = 0.18;
const PLAYER_HIT_SLOW_TIME_SCALE = 0.45;
const PLAYER_HIT_SLOW_COOLDOWN = 2;
const CRIT_HIT_SLOW_DURATION = 0.12;
const CRIT_HIT_SLOW_TIME_SCALE = 0.82;
const CRIT_HIT_SLOW_WINDOW = 2;
const CRIT_HIT_SLOW_MAX_TRIGGERS = 2;
const PLAYER_HIT_CAMERA_ZOOM_DURATION = 0.24;
const PLAYER_HIT_CAMERA_ZOOM_SCALE = 0.94;
const PLAYER_HIT_CAMERA_ZOOM_IN_LERP = 12;
const PLAYER_HIT_CAMERA_ZOOM_OUT_LERP = 7;
const RUN_START_ENEMY_IDLE_DURATION = 2;
const RUN_START_PLAYER_SPAWN_DELAY = 1;
const RUN_START_PORTAL_FADE_IN_DURATION = 0.45;
const RUN_START_PORTAL_FADE_OUT_DURATION = 0.45;
const DEFEAT_OVERLAY_MIN_DELAY = 0.15;
const DEFAULT_CAMERA_VIEW = Object.freeze({
  width: 1120,
  height: 630
});
const DISPLAY_RESOLUTION_STORAGE_KEY = "roguelike.displayResolution";
const RENDER_RESOLUTION_STORAGE_KEY = "roguelike.renderResolution";
const CAMERA_ZOOM_STORAGE_KEY = "roguelike.cameraZoom";
const PERF_QUERY_KEY = "perf";
const PERF_QUERY_ENABLED = "1";
const PERF_SAMPLE_WINDOW = 300;
const RESOLUTION_OPTIONS = Object.freeze([
  Object.freeze({ width: 960, height: 540, label: "960 x 540" }),
  Object.freeze({ width: 1280, height: 720, label: "1280 x 720" }),
  Object.freeze({ width: 1600, height: 900, label: "1600 x 900" }),
  Object.freeze({ width: 1920, height: 1080, label: "1920 x 1080" }),
  Object.freeze({ width: 2560, height: 1440, label: "2560 x 1440" }),
  Object.freeze({ width: 3840, height: 2160, label: "3840 x 2160" })
]);
const RENDER_RESOLUTION_OPTIONS = Object.freeze(
  RESOLUTION_OPTIONS.map((option) => Object.freeze({
    value: `${option.width}x${option.height}`,
    width: option.width,
    height: option.height,
    label: option.label
  }))
);
const CAMERA_ZOOM_OPTIONS = Object.freeze([
  Object.freeze({ value: "close", width: 960, height: 540, label: "Close", scaleMode: "ceil" }),
  Object.freeze({ value: "default", width: 1120, height: 630, label: "Default", scaleMode: "round" }),
  Object.freeze({ value: "far", width: 1280, height: 720, label: "Far", scaleMode: "floor" })
]);
const DEFAULT_STARTUP_RESOLUTION = Object.freeze({ width: 1920, height: 1080 });

function isSupportedResolution(width, height) {
  return RESOLUTION_OPTIONS.some((option) => option.width === width && option.height === height);
}

function collectIntegerScaleCandidates(width, height) {
  const limit = Math.max(1, Math.min(width, height));
  const scales = [];
  for (let scale = 1; scale <= limit; scale += 1) {
    if (width % scale === 0 && height % scale === 0) scales.push(scale);
  }
  return scales;
}

function resolveIntegerRenderScale(width, height, targetScale, mode = "round") {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  const candidates = collectIntegerScaleCandidates(safeWidth, safeHeight);
  if (!candidates.length) return 1;
  const desired = Math.max(1, targetScale || 1);
  if (mode === "ceil") {
    return candidates.find((scale) => scale >= desired) || candidates[candidates.length - 1];
  }
  if (mode === "floor") {
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      if (candidates[index] <= desired) return candidates[index];
    }
    return candidates[0];
  }
  let bestScale = candidates[0];
  let bestDistance = Math.abs(bestScale - desired);
  for (const scale of candidates) {
    const distance = Math.abs(scale - desired);
    if (distance < bestDistance || (distance === bestDistance && scale > bestScale)) {
      bestScale = scale;
      bestDistance = distance;
    }
  }
  return bestScale;
}
const ENEMY_TEST_PLAYER_SNAPSHOT = Object.freeze({
  w: 36,
  h: 36,
  hp: 999,
  maxHp: 999,
  facing: "down",
  animClock: 0,
  isMoving: false,
  hitTimer: 0,
  hitDuration: 0.34,
  damageFlashTimer: 0,
  damageFlashDuration: 0.18,
  damageBonus: 0,
  damageBonusTimer: 0,
  curseTimer: 0,
  curseTickTimer: 0,
  poisonTimer: 0,
  poisonTickTimer: 0,
  poisonDps: 0,
  skillMoveSpeedMult: 1,
  skillAttackSpeedMult: 1,
  basicAttackDamageBonus: 0,
  lifestealRatio: 0,
  damageShield: 0,
  isInvisible: false,
  spiritMode: null,
  darkGraspState: null,
  lightningDashState: null,
  knightChargeState: null,
  windFlipState: null,
  status: createStatusState(),
  enemySlowTimer: 0,
  enemySlowMult: 1,
  stunTimer: 0,
  numberOfFingers: 2,
  ringMoveSpeedMult: 1,
  ringMoveSpeedFlat: 0,
  ringAttackSpeedMult: 1,
  ringDamageBonus: 0,
  ringFlatAttackDamage: 0,
  ringDefenseBonus: 0,
  ringMaxHpMult: 1,
  ringSizeMult: 1,
  ringDamageReductionFlat: 0,
  ringDashChargeBonus: 0,
  ringProjectileHomingRadius: 0,
  ringProjectileHomingTurnRate: 0,
  ringProjectileLifetime: 0
});

function isPerfModeEnabled() {
  try {
    return new URLSearchParams(window.location.search).get(PERF_QUERY_KEY) === PERF_QUERY_ENABLED;
  } catch {
    return false;
  }
}

function createPerfSnapshot(enabled = false) {
  return {
    enabled,
    lastFrame: null,
    summary: null,
    frameCount: 0,
    windowSize: 0
  };
}

function createStatSummary(samples, key) {
  if (!samples.length) {
    return { avg: 0, p95: 0, max: 0 };
  }
  const values = samples.map((sample) => sample[key] || 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  const sorted = [...values].sort((a, b) => a - b);
  const p95Index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
  return {
    avg: total / values.length,
    p95: sorted[p95Index] || 0,
    max: sorted[sorted.length - 1] || 0
  };
}

export class RoguelikeGame {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;
    this.assets = null;
    this.input = new InputController(canvas);
    this.camera = new Camera(DEFAULT_CAMERA_VIEW.width, DEFAULT_CAMERA_VIEW.height);
    this.displayResolutionOptions = RESOLUTION_OPTIONS;
    this.renderResolutionOptions = RENDER_RESOLUTION_OPTIONS;
    this.cameraZoomOptions = CAMERA_ZOOM_OPTIONS;
    this.displayResolution = this.resolveInitialDisplayResolution(canvas);
    this.renderResolution = this.resolveInitialRenderResolution(canvas);
    this.cameraZoom = this.resolveInitialCameraZoom();
    this.heroDef = getHeroDef(resolveSelectableHeroId(options.heroId || DEFAULT_HERO_ID));
    this.heroId = this.heroDef.id;
    this.weaponArt = this.createWeaponArtLoadout(this.heroDef.defaultWeaponArt);
    this.maxRooms = 5;
    this.seed = Date.now();
    this.roomIndex = 0;
    this.roomKills = 0;
    this.kills = 0;
    this.gold = 0;
    this.goldDrops = [];
    this.xpDrops = [];
    this.materialDrops = [];
    this.searchables = [];
    this.breakables = [];
    this.ringDrops = [];
    this.materialInventory = createMaterialInventory();
    this.ringInventory = { owned: Object.create(null), essence: 0 };
    this.equippedRings = Array.from({ length: 20 }, () => null);
    this.inventoryOverlayOpen = false;
    this.inventoryPausedGame = false;
    this.characterOverlayOpen = false;
    this.characterPausedGame = false;
    this.alchemyWorkshopOpen = false;
    this.alchemyWorkshopPausedGame = false;
    this.blacksmithOpen = false;
    this.blacksmithPausedGame = false;
    this.ringSelectionShopOpen = false;
    this.ringSelectionShopPausedGame = false;
    this.activeRingSelectionSearchableId = null;
    this.cursedAnvilOpen = false;
    this.cursedAnvilPausedGame = false;
    this.activeCursedAnvilId = null;
    this.cursedAnvilCurse = null;
    this.treasureSpirit = null;
    this.devilMerchant = null;
    this.devilMerchantOpen = false;
    this.devilMerchantPausedGame = false;
    this.tutorialSprintTimer = 0;
    this.hasShownSprintTutorial = false;
    this.hasShownSlideTutorial = false;
    this.revealChestsOnMinimap = false;
    this.minibossHasteTimer = 0;
    this.uiSyncs = [];
    this.fingerInventory = { owned: [], slots: [] };
    this.fingerState = null;
    this.runStartingFingerCount = 2;
    this.selectedRunSkills = [];
    this.runSkills = getDefaultRunSkillIds(this.selectedRunSkills);
    this.loadoutDraft = null;
    this.enemyTest = null;
    this.enemyTacticProfiles = createDefaultTacticProfiles();
    this.meleeAttackTokens = createMeleeAttackTokenController({ maxTokens: MELEE_ATTACK_TOKEN_POOL_SIZE });
    this.ringState = null;
    this.enemies = [];
    this.world = null;
    this.roomCleared = false;
    this.roomTransitionTimer = 0;
    this.roomMinibossSpawned = false;
    this.roomPortalSpawned = false;
    this.lastMinibossDeathPosition = null;
    this.roomType = "biome";
    this.state = "loading";
    this.scene = null;
    this.lastFrame = 0;
    this.animationFrame = 0;
    this.time = 0;
    this.perf = createPerfSnapshot(isPerfModeEnabled());
    this.perfSamples = [];
    this.lastGameplayPerf = {
      combat: 0,
      enemies: 0
    };
    this.uiSyncCallbacks = new Set();
    this.uiVersions = {
      scene: 0,
      resolution: 0,
      loadout: 0,
      enemyTest: 0,
      inventory: 0,
      overlay: 0,
      ringStats: 0
    };
    this.runtimeVersions = {
      enemies: 0,
      breakables: 0
    };
    this.frameCache = {
      frameId: 0,
      playerCenter: null,
      playerX: Number.NaN,
      playerY: Number.NaN,
      playerW: Number.NaN,
      playerH: Number.NaN,
      livingEnemies: null,
      livingEnemiesVersion: -1,
      blockingBreakables: null,
      breakablesVersion: -1,
      viewportByPadding: new Map()
    };
    this.blockerCache = {
      fullWithBreakables: null,
      fullWithoutBreakables: null,
      noTreesWithBreakables: null,
      noTreesWithoutBreakables: null
    };
    this.playerHitSlowTimer = 0;
    this.playerHitSlowCooldownTimer = 0;
    this.critHitSlowTimer = 0;
    this.critHitSlowTriggerTimers = [];
    this.playerHitCameraZoomTimer = 0;
    this.playerHitCameraZoomStrength = 0;
    this.defeatSequenceElapsed = 0;
    this.defeatOverlayUnlocked = false;
    this.runStartIntro = null;
    this.ambientLeaves = createAmbientLeavesState();
    this.ambientMagicParticles = createAmbientMagicParticlesState();
    this.boundUnlockAudio = () => this.ensureBackgroundMusic();
    this.bgmTargetVolume = BGM_MENU_VOLUME;

    this.player = {
      x: 0,
      y: 0,
      w: 36,
      h: 36,
      hp: this.heroDef.maxHp,
      maxHp: this.heroDef.maxHp,
      level: 1,
      xp: 0,
      xpToNext: computeXpToNext(1),
      stats: null,
      facing: "down",
      animClock: 0,
      isMoving: false,
      movement: createMovementState(this.heroDef),
      dashAfterimages: [],
      dashFlash: null,
      dashVisualSnapshot: null,
      hitTimer: 0,
      hitDuration: 0.34,
      damageFlashTimer: 0,
      damageFlashDuration: 0.18,
      damageBonus: 0,
      damageBonusTimer: 0,
      curseTimer: 0,
      curseTickTimer: 0,
      poisonTimer: 0,
      poisonTickTimer: 0,
      poisonDps: 0,
      damageShield: 0,
      isInvisible: false,
      spiritMode: null,
      darkGraspState: null,
      lightningDashState: null,
      knightChargeState: null,
      windFlipState: null,
      status: createStatusState(),
      enemySlowTimer: 0,
      enemySlowMult: 1,
      stunTimer: 0,
      numberOfFingers: 2,
      yellowWellSpeedBuffUntil: 0,
      lifePotionCharges: 1,
      lifePotionMaxCharges: 1,
      lifePotionHealRatio: 0.4,
      lifePotionConsumeTimer: 0,
      lifePotionConsumeDuration: 1.5,
      lifePotionKillProgress: 0,
      runStartHidden: false
    };
    resetPlayerStats(this.player, this.heroDef);
    this.combat = createCombatState(getDefaultRunSkillIds(this.selectedRunSkills));
    initializeFingerRuntime(this);
    applyFingerExperimentToRun(this);
    initializeWeaponArtRuntime(this);
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    this.tryHeroAttack = () => false;
    this.tryHeroAssist = () => false;
    this.tryTriggerSkillProc = () => false;
    this.applyCameraZoom(this.cameraZoom, { persist: false });
    this.applyDisplayResolution(this.displayResolution.width, this.displayResolution.height, { persist: false });
    this.applyRenderResolution(this.renderResolution, { persist: false });
    ensureMaterialInventory(this);
  }

  parseResolutionValue(value) {
    const [widthText, heightText] = String(value || "").toLowerCase().split("x");
    const width = Math.max(1, Math.floor(Number(widthText) || 0));
    const height = Math.max(1, Math.floor(Number(heightText) || 0));
    return width > 0 && height > 0 ? { width, height } : null;
  }

  resolveInitialDisplayResolution(canvas) {
    try {
      const stored = window.localStorage.getItem(DISPLAY_RESOLUTION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const width = Math.max(1, Math.floor(Number(parsed?.width) || 0));
        const height = Math.max(1, Math.floor(Number(parsed?.height) || 0));
        if (isSupportedResolution(width, height)) {
          return { width, height };
        }
      }
    } catch {}
    return { ...DEFAULT_STARTUP_RESOLUTION };
  }

  resolveInitialRenderResolution(canvas) {
    try {
      const stored = window.localStorage.getItem(RENDER_RESOLUTION_STORAGE_KEY);
      const parsed = this.parseResolutionValue(stored);
      if (parsed && isSupportedResolution(parsed.width, parsed.height)) return stored;
    } catch {}
    return `${DEFAULT_STARTUP_RESOLUTION.width}x${DEFAULT_STARTUP_RESOLUTION.height}`;
  }

  getDisplayResolutionValue() {
    return `${this.displayResolution.width}x${this.displayResolution.height}`;
  }

  getRenderResolutionValue() {
    return this.renderResolution;
  }

  resolveInitialCameraZoom() {
    try {
      const stored = window.localStorage.getItem(CAMERA_ZOOM_STORAGE_KEY);
      if (this.cameraZoomOptions.some((option) => option.value === stored)) {
        return stored;
      }
    } catch {}
    return "default";
  }

  getCameraZoomValue() {
    return this.cameraZoom;
  }

  getCameraZoomOption(value) {
    return this.cameraZoomOptions.find((option) => option.value === value) || this.cameraZoomOptions[1];
  }

  updateCameraViewport() {
    const zoomOption = this.getCameraZoomOption(this.cameraZoom);
    const hitZoomStrength = clamp(this.playerHitCameraZoomStrength || 0, 0, 1);
    const hitZoomScale = 1 - (1 - PLAYER_HIT_CAMERA_ZOOM_SCALE) * hitZoomStrength;
    const targetScale = Math.min(
      this.canvas.width / Math.max(1, zoomOption.width * hitZoomScale),
      this.canvas.height / Math.max(1, zoomOption.height * hitZoomScale)
    );
    const renderScale = resolveIntegerRenderScale(this.canvas.width, this.canvas.height, targetScale, zoomOption.scaleMode);
    this.camera.renderScale = Math.max(1, renderScale);
    this.camera.viewWidth = Math.max(1, Math.floor(this.canvas.width / this.camera.renderScale));
    this.camera.viewHeight = Math.max(1, Math.floor(this.canvas.height / this.camera.renderScale));
    if (this.world) {
      const minX = this.world.width <= this.camera.viewWidth ? (this.world.width - this.camera.viewWidth) * 0.5 : 0;
      const maxX = this.world.width <= this.camera.viewWidth ? minX : this.world.width - this.camera.viewWidth;
      const minY = this.world.height <= this.camera.viewHeight ? (this.world.height - this.camera.viewHeight) * 0.5 : 0;
      const maxY = this.world.height <= this.camera.viewHeight ? minY : this.world.height - this.camera.viewHeight;
      this.camera.smoothX = clamp(this.camera.smoothX, minX, maxX);
      this.camera.smoothY = clamp(this.camera.smoothY, minY, maxY);
      this.camera.x = Math.round(this.camera.smoothX);
      this.camera.y = Math.round(this.camera.smoothY);
    }
  }

  applyCameraZoom(value, options = {}) {
    const zoomOption = this.getCameraZoomOption(value);
    if (!zoomOption) return false;
    this.cameraZoom = zoomOption.value;
    this.updateCameraViewport();
    this.bumpUiVersion("resolution");
    if (options.persist !== false) {
      try {
        window.localStorage.setItem(CAMERA_ZOOM_STORAGE_KEY, this.cameraZoom);
      } catch {}
    }
    return true;
  }

  setCameraZoom(value) {
    return this.applyCameraZoom(value);
  }

  applyDisplayResolution(width, height, options = {}) {
    const nextWidth = Math.max(1, Math.floor(Number(width) || 0));
    const nextHeight = Math.max(1, Math.floor(Number(height) || 0));
    if (!nextWidth || !nextHeight) return false;
    this.displayResolution = { width: nextWidth, height: nextHeight };
    this.canvas.style.setProperty("--game-display-width", `${nextWidth}px`);
    this.canvas.style.setProperty("--game-display-height", `${nextHeight}px`);
    this.bumpUiVersion("resolution");
    if (options.persist !== false) {
      try {
        window.localStorage.setItem(DISPLAY_RESOLUTION_STORAGE_KEY, JSON.stringify(this.displayResolution));
      } catch {}
    }
    return true;
  }

  setDisplayResolution(value) {
    const parsed = this.parseResolutionValue(value);
    if (!parsed || !isSupportedResolution(parsed.width, parsed.height)) return false;
    return this.applyDisplayResolution(parsed.width, parsed.height);
  }

  applyRenderResolution(value, options = {}) {
    const normalizedValue = String(value || "").toLowerCase();
    const nextResolution = this.parseResolutionValue(normalizedValue);
    if (!nextResolution || !isSupportedResolution(nextResolution.width, nextResolution.height)) {
      return false;
    }
    this.canvas.width = nextResolution.width;
    this.canvas.height = nextResolution.height;
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;
    this.renderResolution = normalizedValue;
    this.updateCameraViewport();
    this.bumpUiVersion("resolution");
    if (options.persist !== false) {
      try {
        window.localStorage.setItem(RENDER_RESOLUTION_STORAGE_KEY, this.renderResolution);
      } catch {}
    }
    return true;
  }

  setRenderResolution(value) {
    return this.applyRenderResolution(value);
  }

  createWeaponArtLoadout(weaponArtId) {
    const progressionState = createWeaponArtProgressionState(weaponArtId);
    return {
      id: weaponArtId,
      def: getWeaponArtDef(weaponArtId),
      progressionState,
      runState: buildRunWeaponArtState(weaponArtId, progressionState)
    };
  }

  bumpUiVersion(...keys) {
    for (const key of keys) {
      this.uiVersions[key] = (this.uiVersions[key] || 0) + 1;
    }
  }

  getUiVersion(key) {
    return this.uiVersions[key] || 0;
  }

  getHeroDeathAnimationDuration() {
    const deadState = this.heroDef?.sprite?.states?.dead;
    const frames = Math.max(1, deadState?.frames || 1);
    const fps = Math.max(1, deadState?.fps || 1);
    return Math.max(DEFEAT_OVERLAY_MIN_DELAY, frames / fps);
  }

  startDefeatSequence() {
    this.state = "defeat";
    this.defeatSequenceElapsed = 0;
    this.defeatOverlayUnlocked = false;
    this.player.animClock = 0;
    this.player.isMoving = false;
    this.player.movement.dashTimer = 0;
    this.player.movement.slideTimer = 0;
    this.player.movement.sprintTimer = 0;
    this.player.dashAfterimages = [];
    this.player.dashFlash = null;
    this.player.dashVisualSnapshot = null;
  }

  updateDefeatSequence(dt) {
    if (this.state !== "defeat") return;
    const duration = this.getHeroDeathAnimationDuration();
    this.defeatSequenceElapsed = Math.min(duration, this.defeatSequenceElapsed + dt);
    this.player.animClock = this.defeatSequenceElapsed;
    if (!this.defeatOverlayUnlocked && this.defeatSequenceElapsed >= duration) {
      this.defeatOverlayUnlocked = true;
    }
  }

  isDefeatOverlayVisible() {
    return this.state === "defeat" && this.defeatOverlayUnlocked;
  }

  registerUiSync(callback) {
    if (typeof callback !== "function") return () => {};
    this.uiSyncCallbacks.add(callback);
    return () => this.uiSyncCallbacks.delete(callback);
  }

  runUiSync(timestamp, dt) {
    for (const callback of this.uiSyncCallbacks) {
      callback(timestamp, dt);
    }
  }

  beginFrameCache() {
    this.frameCache.frameId += 1;
    this.frameCache.playerCenter = null;
    this.frameCache.viewportByPadding = new Map();
  }

  getPlayerCenter() {
    const { player, frameCache } = this;
    if (
      frameCache.playerCenter &&
      frameCache.playerX === player.x &&
      frameCache.playerY === player.y &&
      frameCache.playerW === player.w &&
      frameCache.playerH === player.h
    ) {
      return frameCache.playerCenter;
    }
    frameCache.playerCenter = centerOf(player);
    frameCache.playerX = player.x;
    frameCache.playerY = player.y;
    frameCache.playerW = player.w;
    frameCache.playerH = player.h;
    return frameCache.playerCenter;
  }

  markEnemiesDirty() {
    this.runtimeVersions.enemies += 1;
    this.frameCache.livingEnemiesVersion = -1;
  }

  markBreakablesDirty() {
    this.runtimeVersions.breakables += 1;
    this.frameCache.breakablesVersion = -1;
    this.blockerCache.fullWithBreakables = null;
    this.blockerCache.noTreesWithBreakables = null;
  }

  markCollisionCacheDirty() {
    this.blockerCache.fullWithBreakables = null;
    this.blockerCache.fullWithoutBreakables = null;
    this.blockerCache.noTreesWithBreakables = null;
    this.blockerCache.noTreesWithoutBreakables = null;
  }

  getLivingEnemies() {
    if (this.frameCache.livingEnemies && this.frameCache.livingEnemiesVersion === this.runtimeVersions.enemies) {
      return this.frameCache.livingEnemies;
    }
    this.frameCache.livingEnemies = this.enemies.filter((enemy) => !enemy.dead);
    this.frameCache.livingEnemiesVersion = this.runtimeVersions.enemies;
    return this.frameCache.livingEnemies;
  }

  getBlockingBreakableRects() {
    if (this.frameCache.blockingBreakables && this.frameCache.breakablesVersion === this.runtimeVersions.breakables) {
      return this.frameCache.blockingBreakables;
    }
    this.frameCache.blockingBreakables = this.breakables.filter((breakable) => breakable.blocksMovement && !breakable.isDestroyed);
    this.frameCache.breakablesVersion = this.runtimeVersions.breakables;
    return this.frameCache.blockingBreakables;
  }

  getCollisionBlockers(options = {}) {
    const world = this.world;
    if (!world) return [];
    const includeBreakables = options.includeBreakables !== false;
    const ignoreTrees = !!options.ignoreTrees;
    const cacheKey = ignoreTrees
      ? (includeBreakables ? "noTreesWithBreakables" : "noTreesWithoutBreakables")
      : (includeBreakables ? "fullWithBreakables" : "fullWithoutBreakables");
    const cached = this.blockerCache[cacheKey];
    const worldVersion = world.collisionVersion || 0;
    const breakablesVersion = this.runtimeVersions.breakables;
    if (
      cached &&
      cached.worldVersion === worldVersion &&
      cached.breakablesVersion === breakablesVersion
    ) {
      return cached.value;
    }
    let blockers = ignoreTrees ? (world.collisionRectsNoTrees || []) : (world.collisionRects || []);
    if (includeBreakables) blockers = blockers.concat(this.getBlockingBreakableRects());
    const nextCache = {
      worldVersion,
      breakablesVersion,
      value: blockers
    };
    this.blockerCache[cacheKey] = nextCache;
    return blockers;
  }

  getViewportBounds(padding = 0) {
    const key = Number.isFinite(padding) ? padding : 0;
    const cached = this.frameCache.viewportByPadding.get(key);
    if (cached) return cached;
    const rect = {
      x: this.camera.x - key,
      y: this.camera.y - key,
      w: this.camera.viewWidth + key * 2,
      h: this.camera.viewHeight + key * 2
    };
    this.frameCache.viewportByPadding.set(key, rect);
    return rect;
  }

  isWorldRectVisible(x, y, w, h, padding = 0) {
    const view = this.getViewportBounds(padding);
    return !(
      x + w < view.x ||
      y + h < view.y ||
      x > view.x + view.w ||
      y > view.y + view.h
    );
  }

  recordPerfFrame(sample) {
    if (!this.perf.enabled || !sample) return;
    this.perfSamples.push(sample);
    if (this.perfSamples.length > PERF_SAMPLE_WINDOW) this.perfSamples.shift();
    this.perf.lastFrame = sample;
    this.perf.summary = {
      total: createStatSummary(this.perfSamples, "total"),
      scene: createStatSummary(this.perfSamples, "scene"),
      update: createStatSummary(this.perfSamples, "update"),
      combat: createStatSummary(this.perfSamples, "combat"),
      enemies: createStatSummary(this.perfSamples, "enemies"),
      render: createStatSummary(this.perfSamples, "render"),
      uiSync: createStatSummary(this.perfSamples, "uiSync")
    };
    this.perf.frameCount += 1;
    this.perf.windowSize = this.perfSamples.length;
  }

  async init() {
    this.assets = await loadAssetPack();
    this.ensureBackgroundMusic();
    window.addEventListener("pointerdown", this.boundUnlockAudio, { passive: true });
    window.addEventListener("keydown", this.boundUnlockAudio);
    await this.loadEnemyTacticProfiles();
    this.showStartMenu();
  }

  ensureBackgroundMusic() {
    const bgm = this.assets?.masterBgm;
    if (!bgm) return;
    bgm.loop = true;
    bgm.volume = this.bgmTargetVolume;
    if (!bgm.paused) {
      window.removeEventListener("pointerdown", this.boundUnlockAudio);
      window.removeEventListener("keydown", this.boundUnlockAudio);
      return;
    }
    bgm.play()
      .then(() => {
        window.removeEventListener("pointerdown", this.boundUnlockAudio);
        window.removeEventListener("keydown", this.boundUnlockAudio);
      })
      .catch(() => {});
  }

  updateBackgroundMusic(dt) {
    const bgm = this.assets?.masterBgm;
    if (!bgm || !Number.isFinite(dt) || dt <= 0) return;
    const delta = this.bgmTargetVolume - bgm.volume;
    if (Math.abs(delta) <= 0.001) {
      bgm.volume = this.bgmTargetVolume;
      return;
    }
    const step = Math.min(Math.abs(delta), BGM_FADE_SPEED * dt);
    bgm.volume = Math.max(0, Math.min(1, bgm.volume + Math.sign(delta) * step));
  }

  playAudioAsset(assetKey, options = {}) {
    const audio = this.assets?.[assetKey];
    if (!audio) return null;
    const instance = audio.cloneNode();
    const baseVolume = audio.volume || 0.2;
    const volumeScale = Number.isFinite(options.volumeScale) ? options.volumeScale : 1;
    instance.volume = Math.max(0, Math.min(1, baseVolume * volumeScale));
    if (Number.isFinite(options.playbackRate)) {
      instance.playbackRate = Math.max(0.25, options.playbackRate);
    }
    instance.currentTime = 0;
    instance.play().catch(() => {});
    return instance;
  }

  async loadEnemyTacticProfiles() {
    try {
      const response = await fetch("./src/data/tactical-movement-profiles.json", { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        if (payload && typeof payload === "object") {
          const defaults = createDefaultTacticProfiles();
          this.enemyTacticProfiles = {
            ...defaults,
            ...payload,
            melee: {
              ...defaults.melee,
              ...(payload.melee || {}),
              feint_entry: {
                ...defaults.melee.feint_entry,
                ...(payload.melee?.feint_entry || {})
              },
              drift_noise: {
                ...defaults.melee.drift_noise,
                ...(payload.melee?.drift_noise || {})
              },
              cooldown_kite: {
                ...defaults.melee.cooldown_kite,
                ...(payload.melee?.cooldown_kite || {})
              },
              retreat_reset: {
                ...defaults.melee.retreat_reset,
                ...(payload.melee?.retreat_reset || {})
              },
              strafe_pressure: {
                ...defaults.melee.strafe_pressure,
                ...(payload.melee?.strafe_pressure || {})
              }
            },
            ranged: {
              ...defaults.ranged,
              ...(payload.ranged || {}),
              feint_entry: {
                ...defaults.ranged.feint_entry,
                ...(payload.ranged?.feint_entry || {})
              },
              drift_noise: {
                ...defaults.ranged.drift_noise,
                ...(payload.ranged?.drift_noise || {})
              },
              cooldown_kite: {
                ...defaults.ranged.cooldown_kite,
                ...(payload.ranged?.cooldown_kite || {})
              },
              retreat_reset: {
                ...defaults.ranged.retreat_reset,
                ...(payload.ranged?.retreat_reset || {})
              },
              strafe_pressure: {
                ...defaults.ranged.strafe_pressure,
                ...(payload.ranged?.strafe_pressure || {})
              }
            }
          };
        }
      }
    } catch {}
  }

  setHero(heroId, options = {}) {
    this.heroDef = getHeroDef(resolveSelectableHeroId(heroId || DEFAULT_HERO_ID));
    this.heroId = this.heroDef.id;
    this.weaponArt = this.createWeaponArtLoadout(this.heroDef.defaultWeaponArt);
    ensurePlayerStats(this.player, this.heroDef);
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    this.player.spiritMode = null;
    this.player.darkGraspState = null;
    this.player.lightningDashState = null;
    this.player.knightChargeState = null;
    this.player.windFlipState = null;
    this.player.movement = createMovementState(this.heroDef);
    this.combat = createCombatState(getDefaultRunSkillIds(this.selectedRunSkills));
    initializeWeaponArtRuntime(this);
    refreshRingDerivedStats(this, { force: true });
    this.bumpUiVersion("loadout", "inventory", "overlay", "ringStats");
    if (options.restart !== false) this.restart();
  }

  showStartMenu() {
    this.state = "menu";
    this.scene = createStartMenuScene(this);
    this.loadoutDraft = null;
    this.enemyTest = null;
    this.bgmTargetVolume = BGM_MENU_VOLUME;
    this.bumpUiVersion("scene");
  }

  showLoadoutScene() {
    this.state = "loadout";
    this.loadoutDraft = {
      heroId: this.heroId,
      skillIds: [...getDefaultRunSkillIds(this.selectedRunSkills)]
    };
    this.scene = createLoadoutScene(this);
    this.bgmTargetVolume = BGM_MENU_VOLUME;
    this.bumpUiVersion("scene", "loadout");
  }

  showSettingsScene() {
    this.state = "settings";
    this.scene = createSettingsScene(this);
    this.bgmTargetVolume = BGM_MENU_VOLUME;
    this.bumpUiVersion("scene");
  }

  showAffinityScene() {
    this.state = "affinity";
    this.scene = createAffinityScene(this);
    this.bgmTargetVolume = BGM_MENU_VOLUME;
    this.bumpUiVersion("scene");
  }

  showFingerExperimentScene() {
    this.state = "fingerExperiment";
    this.scene = createFingerExperimentScene(this);
    this.bgmTargetVolume = BGM_MENU_VOLUME;
    this.bumpUiVersion("scene");
  }

  showEnemyTestScene() {
    const supportedIds = getControllableEnemyTypeIds();
    const selectedTypeId = this.enemyTest?.selectedTypeId || supportedIds[0] || null;
    this.enemyTest = {
      selectedTypeId,
      selectedTactic: "feint_entry",
      controlledEnemy: null,
      dummyTarget: null,
      dummyRespawnTimer: 0,
      uiOpen: true,
      movementRecorder: null,
      lastSavedPatternId: null,
      lastPersistStatus: null
    };
    this.scene = createEnemyTestScene(this);
    this.state = "running";
    this.time = 0;
    this.bgmTargetVolume = BGM_RUN_VOLUME;
    this.setupEnemyTestArena(selectedTypeId);
    this.bumpUiVersion("scene", "enemyTest");
  }

  setEnemyTestEnemy(typeId) {
    if (!this.enemyTest || !typeId || this.enemyTest.selectedTypeId === typeId) return;
    this.enemyTest.selectedTypeId = typeId;
    this.setupEnemyTestArena(typeId);
    this.bumpUiVersion("enemyTest");
  }

  setEnemyTestRecordingTactic(tacticId) {
    if (!this.enemyTest || !tacticId) return;
    this.enemyTest.selectedTactic = tacticId;
    this.bumpUiVersion("enemyTest");
  }

  setEnemyTestUiOpen(open) {
    if (!this.enemyTest) return;
    this.enemyTest.uiOpen = !!open;
    this.bumpUiVersion("enemyTest");
  }

  toggleEnemyTestUi() {
    if (!this.enemyTest) return;
    this.enemyTest.uiOpen = !this.enemyTest.uiOpen;
    this.bumpUiVersion("enemyTest");
  }

  getSavedEnemyMovementPatterns() {
    try {
      const raw = window.localStorage.getItem(ENEMY_MOVEMENT_PATTERN_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveEnemyMovementPattern(pattern) {
    const patterns = this.getSavedEnemyMovementPatterns();
    patterns.push(pattern);
    window.localStorage.setItem(ENEMY_MOVEMENT_PATTERN_STORAGE_KEY, JSON.stringify(patterns));
    return pattern;
  }

  async persistEnemyMovementPatternToFile(pattern) {
    const response = await fetch("/api/enemy-movement-patterns", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ pattern })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Failed to save pattern (${response.status}).`);
    }
    return payload;
  }

  trimEnemyMovementSteps(steps, trimStartSeconds, trimEndSeconds) {
    let remainingStart = Math.max(0, trimStartSeconds || 0);
    let remainingEnd = Math.max(0, trimEndSeconds || 0);
    let trimmed = steps
      .map((step) => ({
        x: step.x,
        y: step.y,
        duration: Number(step.duration || 0)
      }))
      .filter((step) => step.duration > 0);

    if (remainingStart > 0) {
      const next = [];
      for (const step of trimmed) {
        if (remainingStart <= 0) {
          next.push(step);
          continue;
        }
        if (step.duration <= remainingStart) {
          remainingStart -= step.duration;
          continue;
        }
        next.push({
          ...step,
          duration: Number((step.duration - remainingStart).toFixed(3))
        });
        remainingStart = 0;
      }
      trimmed = next.filter((step) => step.duration > 0);
    }

    if (remainingEnd > 0) {
      const next = [];
      for (let index = trimmed.length - 1; index >= 0; index -= 1) {
        const step = trimmed[index];
        if (remainingEnd <= 0) {
          next.push(step);
          continue;
        }
        if (step.duration <= remainingEnd) {
          remainingEnd -= step.duration;
          continue;
        }
        next.push({
          ...step,
          duration: Number((step.duration - remainingEnd).toFixed(3))
        });
        remainingEnd = 0;
      }
      trimmed = next.reverse().filter((step) => step.duration > 0);
    }

    return trimmed;
  }

  isEnemyTestRecordingMovement() {
    return !!this.enemyTest?.movementRecorder?.isRecording;
  }

  startEnemyTestMovementRecording() {
    if (!this.enemyTest) return false;
    this.enemyTest.movementRecorder = {
      isRecording: true,
      elapsed: 0,
      currentAxis: null,
      currentDuration: 0,
      steps: [],
      sampleCount: 0,
      savedPattern: null
    };
    this.bumpUiVersion("enemyTest");
    return true;
  }

  finalizeEnemyTestMovementPattern(save = true) {
    const recorder = this.enemyTest?.movementRecorder;
    const enemy = this.enemyTest?.controlledEnemy;
    if (!recorder || !enemy) return null;
    if (recorder.currentAxis) {
      recorder.steps.push({
        x: recorder.currentAxis.x,
        y: recorder.currentAxis.y,
        duration: Number(recorder.currentDuration.toFixed(3))
      });
    }
    recorder.isRecording = false;
    const trimmedSteps = this.trimEnemyMovementSteps(
      recorder.steps,
      ENEMY_MOVEMENT_PATTERN_TRIM_SECONDS,
      ENEMY_MOVEMENT_PATTERN_TRIM_SECONDS
    );
    const pattern = {
      id: `pattern_${Date.now()}`,
      movementClass: getEnemyMovementClass(enemy),
      tacticId: this.enemyTest.selectedTactic || "feint_entry",
      enemyTypeId: this.enemyTest.selectedTypeId,
      enemyName: enemy.name,
      createdAt: new Date().toISOString(),
      totalDuration: Number(trimmedSteps.reduce((total, step) => total + step.duration, 0).toFixed(3)),
      rawDuration: Number(recorder.elapsed.toFixed(3)),
      trimStartSeconds: ENEMY_MOVEMENT_PATTERN_TRIM_SECONDS,
      trimEndSeconds: ENEMY_MOVEMENT_PATTERN_TRIM_SECONDS,
      steps: trimmedSteps
    };
    recorder.savedPattern = save ? this.saveEnemyMovementPattern(pattern) : pattern;
    this.enemyTest.lastSavedPatternId = recorder.savedPattern.id;
    this.enemyTest.lastPersistStatus = save
      ? { state: "saving", message: "Saving pattern to file..." }
      : null;
    this.bumpUiVersion("enemyTest");
    if (save) {
      this.persistEnemyMovementPatternToFile(recorder.savedPattern)
        .then((result) => {
          if (!this.enemyTest) return;
          this.enemyTest.lastPersistStatus = {
            state: "saved",
            message: `Saved to ${result.file}`
          };
          this.bumpUiVersion("enemyTest");
        })
        .catch((error) => {
          if (!this.enemyTest) return;
          this.enemyTest.lastPersistStatus = {
            state: "error",
            message: String(error?.message || error)
          };
          this.bumpUiVersion("enemyTest");
        });
    }
    return recorder.savedPattern;
  }

  stopEnemyTestMovementRecording(options = {}) {
    if (!this.enemyTest?.movementRecorder?.isRecording) return null;
    return this.finalizeEnemyTestMovementPattern(options.save !== false);
  }

  updateEnemyTestMovementRecorder(dt, moveAxis) {
    const recorder = this.enemyTest?.movementRecorder;
    if (!recorder?.isRecording) return;
    const roundedAxis = {
      x: Math.abs(moveAxis.x) > 0.001 ? Number(moveAxis.x.toFixed(3)) : 0,
      y: Math.abs(moveAxis.y) > 0.001 ? Number(moveAxis.y.toFixed(3)) : 0
    };
    recorder.elapsed += dt;
    recorder.sampleCount += 1;
    if (!recorder.currentAxis) {
      recorder.currentAxis = roundedAxis;
      recorder.currentDuration = dt;
      return;
    }
    if (recorder.currentAxis.x === roundedAxis.x && recorder.currentAxis.y === roundedAxis.y) {
      recorder.currentDuration += dt;
      return;
    }
    recorder.steps.push({
      x: recorder.currentAxis.x,
      y: recorder.currentAxis.y,
      duration: Number(recorder.currentDuration.toFixed(3))
    });
    recorder.currentAxis = roundedAxis;
    recorder.currentDuration = dt;
  }

  setLoadoutHero(heroId) {
    this.heroDef = getHeroDef(resolveSelectableHeroId(heroId || DEFAULT_HERO_ID));
    this.heroId = this.heroDef.id;
    if (this.loadoutDraft) this.loadoutDraft.heroId = this.heroId;
    this.bumpUiVersion("loadout");
  }

  toggleLoadoutSkill(skillId) {
    if (!this.loadoutDraft) return;
    const current = new Set(this.loadoutDraft.skillIds);
    if (current.has(skillId)) {
      current.delete(skillId);
    } else if (current.size < 3) {
      current.add(skillId);
    }
    this.loadoutDraft.skillIds = [...current];
    this.bumpUiVersion("loadout");
  }

  setLoadoutSkillAt(slotIndex, skillId) {
    if (!this.loadoutDraft) return;
    const index = Math.max(0, Math.min(2, Math.floor(slotIndex)));
    const next = [...this.loadoutDraft.skillIds];
    const existingIndex = next.indexOf(skillId);
    if (existingIndex >= 0) {
      next.splice(existingIndex, 1);
    }
    next[index] = skillId;
    this.loadoutDraft.skillIds = next.filter(Boolean).slice(0, 3);
    this.bumpUiVersion("loadout");
  }

  clearLoadoutSkillAt(slotIndex) {
    if (!this.loadoutDraft) return;
    const index = Math.max(0, Math.min(2, Math.floor(slotIndex)));
    const next = [...this.loadoutDraft.skillIds];
    next.splice(index, 1);
    this.loadoutDraft.skillIds = next;
    this.bumpUiVersion("loadout");
  }

  startRunWithLoadout() {
    if (!this.loadoutDraft || this.loadoutDraft.skillIds.length !== 3) return false;
    this.selectedRunSkills = [...this.loadoutDraft.skillIds];
    this.setHero(this.loadoutDraft.heroId, { restart: false });
    this.restart();
    return true;
  }

  restart() {
    this.seed = Date.now();
    this.time = 0;
    this.resetPlayerHitSlow();
    this.roomIndex = 0;
    this.kills = 0;
    this.roomKills = 0;
    this.gold = 0;
    this.goldDrops = [];
    this.xpDrops = [];
    this.materialDrops = [];
    this.searchables = [];
    this.breakables = [];
    this.ringDrops = [];
    this.materialInventory = createMaterialInventory();
    this.ringInventory = { owned: Object.create(null), essence: 0 };
    this.equippedRings = Array.from({ length: 20 }, () => null);
    this.inventoryOverlayOpen = false;
    this.inventoryPausedGame = false;
    this.characterOverlayOpen = false;
    this.characterPausedGame = false;
    this.alchemyWorkshopOpen = false;
    this.alchemyWorkshopPausedGame = false;
    this.blacksmithOpen = false;
    this.blacksmithPausedGame = false;
    this.ringSelectionShopOpen = false;
    this.ringSelectionShopPausedGame = false;
    this.activeRingSelectionSearchableId = null;
    this.nextRingInstanceId = 1;
    this.fingerInventory = { owned: [], slots: [] };
    this.loadoutDraft = null;
    this.enemyTest = null;
    resetPlayerStats(this.player, this.heroDef);
    this.player.hp = this.player.maxHp;
    this.player.damageBonus = 0;
    this.player.damageBonusTimer = 0;
    this.player.damageFlashTimer = 0;
    resetStatusState(this.player);
    this.player.damageShield = 0;
    this.player.isInvisible = false;
    this.player.spiritMode = null;
    this.player.darkGraspState = null;
    this.player.lightningDashState = null;
    this.player.knightChargeState = null;
    this.player.windFlipState = null;
    this.runStartingFingerCount = getStartingFingerCount();
    this.player.numberOfFingers = this.runStartingFingerCount;
    this.player.yellowWellSpeedBuffUntil = 0;
    this.player.lifePotionCharges = 1;
    this.player.lifePotionMaxCharges = 1;
    this.player.lifePotionHealRatio = 0.4;
    this.player.lifePotionConsumeTimer = 0;
    this.player.lifePotionConsumeDuration = 1.5;
    this.player.lifePotionKillProgress = 0;
    this.player.runStartHidden = false;
    this.defeatSequenceElapsed = 0;
    this.defeatOverlayUnlocked = false;
    this.player.movement = createMovementState(this.heroDef);
    this.player.dashAfterimages = [];
    this.player.dashFlash = null;
    this.player.dashVisualSnapshot = null;
    this.weaponArt = this.createWeaponArtLoadout(this.heroDef.defaultWeaponArt);
    this.runSkills = getDefaultRunSkillIds(this.selectedRunSkills);
    this.combat = createCombatState(this.runSkills);
    initializeWeaponArtRuntime(this);
    initializeFingerRuntime(this);
    applyFingerExperimentToRun(this);
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    setPlayerStatSource(this.player, "runtime", { globalDamage: { add: 0 } });
    applyAffinityStatSource(this);
    initializeRingRuntime(this);
    this.scene = null;
    this.state = "running";
    this.bgmTargetVolume = BGM_RUN_VOLUME;
    resetMeleeAttackTokenController(this.meleeAttackTokens, { maxTokens: MELEE_ATTACK_TOKEN_POOL_SIZE });
    resetAmbientLeaves(this);
    resetAmbientMagicParticles(this);
    this.markEnemiesDirty();
    this.markBreakablesDirty();
    this.bumpUiVersion("scene", "inventory", "overlay", "ringStats");
    this.loadRoom(this.roomIndex);
  }

  loadRoom(roomIndex) {
    resetMeleeAttackTokenController(this.meleeAttackTokens, { maxTokens: MELEE_ATTACK_TOKEN_POOL_SIZE });
    this.resetPlayerHitSlow();
    this.runStartIntro = null;
    this.roomType = "biome";
    this.world = generateRoom(this.seed, roomIndex, this.assets);
    this.player.x = this.world.start.x;
    this.player.y = this.world.start.y;
    this.player.animClock = 0;
    this.player.hitTimer = 0;
    this.player.damageFlashTimer = 0;
    this.player.dashAfterimages = [];
    this.player.dashFlash = null;
    this.player.dashVisualSnapshot = null;
    this.player.spiritMode = null;
    this.player.darkGraspState = null;
    this.player.lightningDashState = null;
    this.player.knightChargeState = null;
    this.player.windFlipState = null;
    this.player.runStartHidden = false;
    resetStatusState(this.player);
    this.roomCleared = false;
    this.roomTransitionTimer = 0;
    this.roomKills = 0;
    this.roomPortalSpawned = false;
    this.roomBossSpawned = false;
    this.lastMinibossDeathPosition = null;
    this.revealChestsOnMinimap = false;
    this.ringSelectionShopOpen = false;
    this.ringSelectionShopPausedGame = false;
    this.activeRingSelectionSearchableId = null;
    clearCursedAnvilCurse(this);
    this.cursedAnvilOpen = false;
    this.cursedAnvilPausedGame = false;
    this.activeCursedAnvilId = null;
    clearTreasureSpirit(this);
    clearDevilMerchant(this);
    const { searchables, breakables, props } = this.isBossRoom(roomIndex)
      ? { searchables: [], breakables: [], props: [] }
      : spawnRoomInteractables(this.world, roomIndex, this.seed);
    this.searchables = [...searchables, ...props];
    this.enemies = this.isBossRoom(roomIndex)
      ? this.spawnBossRoomEncounter(roomIndex)
      : spawnRoomEnemies(this.world, roomIndex, this.seed, this.searchables, this.assets);
    this.roomMinibossSpawned = this.enemies.some((enemy) => enemy.isMiniBoss);
    this.roomBossSpawned = this.enemies.some((enemy) => enemy.isBoss);
    this.goldDrops = [];
    this.xpDrops = [];
    this.materialDrops = [];
    this.breakables = breakables;
    this.ringDrops = [];
    this.combat.playerProjectiles = [];
    this.combat.enemyProjectiles = [];
    this.combat.enemyAreaHitboxes = [];
    resetAmbientLeaves(this);
    resetAmbientMagicParticles(this);
    this.camera.snapTo(this.player, this.world);
    setMinimapWorld(this.world);
    this.markEnemiesDirty();
    this.markBreakablesDirty();
    this.markCollisionCacheDirty();
    this.bumpUiVersion("scene", "inventory", "overlay");
    onFingerBiomeRoomEntered(this);
    if (roomIndex === 0) this.startRunStartIntro();
  }

  loadBreakRoom() {
    resetMeleeAttackTokenController(this.meleeAttackTokens, { maxTokens: MELEE_ATTACK_TOKEN_POOL_SIZE });
    this.resetPlayerHitSlow();
    this.runStartIntro = null;
    this.roomType = "breakRoom";
    this.world = generateBreakRoom(this.seed, this.roomIndex, this.assets);
    this.player.x = this.world.start.x;
    this.player.y = this.world.start.y;
    this.player.animClock = 0;
    this.player.hitTimer = 0;
    this.player.damageFlashTimer = 0;
    this.player.spiritMode = null;
    this.player.darkGraspState = null;
    this.player.lightningDashState = null;
    this.player.knightChargeState = null;
    this.player.windFlipState = null;
    resetStatusState(this.player);
    this.roomCleared = false;
    this.roomTransitionTimer = 0;
    this.roomKills = 0;
    this.roomPortalSpawned = true;
    this.roomBossSpawned = false;
    this.lastMinibossDeathPosition = null;
    this.revealChestsOnMinimap = false;
    this.ringSelectionShopOpen = false;
    this.ringSelectionShopPausedGame = false;
    this.activeRingSelectionSearchableId = null;
    this.enemies = [];
    this.roomMinibossSpawned = false;
    this.roomBossSpawned = false;
    this.goldDrops = [];
    this.xpDrops = [];
    this.materialDrops = [];
    this.searchables = [];
    this.breakables = [];
    this.ringDrops = [];
    this.combat.playerProjectiles = [];
    this.combat.enemyProjectiles = [];
    this.combat.enemyAreaHitboxes = [];
    resetAmbientLeaves(this);
    resetAmbientMagicParticles(this);
    spawnPortal(this, {
      target: "nextBiome",
      origin: {
        x: this.world.exit.x + this.world.exit.w * 0.5,
        y: this.world.exit.y + this.world.exit.h * 0.5
      },
      cellArchetype: "openSpace"
    });
    spawnLifeSpring(this, {
      x: this.world.width * 0.5 - 180,
      y: this.world.height * 0.5
    });
    spawnAlchemyWorkshop(this);
    spawnBlacksmith(this);
    this.camera.snapTo(this.player, this.world);
    setMinimapWorld(this.world);
    this.markEnemiesDirty();
    this.markBreakablesDirty();
    this.markCollisionCacheDirty();
    this.bumpUiVersion("scene", "inventory", "overlay");
  }

  enterBreakRoom() {
    this.handlePortalExitGoldConversion();
    this.loadBreakRoom();
  }

  startRunStartIntro() {
    if (!this.world) return;
    const origin = {
      x: this.world.start.x + this.player.w * 0.5,
      y: this.world.start.y + this.player.h * 0.5
    };
    const portal = spawnPortal(this, {
      target: "introStart",
      origin,
      cellArchetype: "start",
      silent: true,
      introOnly: true
    });
    if (portal) {
      portal.introAlpha = 0;
    }
    this.player.x = this.world.start.x;
    this.player.y = this.world.start.y;
    this.player.runStartHidden = true;
    this.player.isMoving = false;
    this.player.animClock = 0;
    this.runStartIntro = {
      active: true,
      elapsed: 0,
      playerSpawned: false,
      portalId: portal?.id || null,
      spawnX: this.world.start.x,
      spawnY: this.world.start.y
    };
  }

  updateRunStartIntro(dt) {
    const intro = this.runStartIntro;
    if (!intro?.active) return;
    intro.elapsed += dt;
    const portal = intro.portalId
      ? (this.searchables || []).find((searchable) => searchable.id === intro.portalId)
      : null;
    if (portal) {
      if (intro.elapsed < RUN_START_PLAYER_SPAWN_DELAY) {
        portal.introAlpha = clamp(intro.elapsed / RUN_START_PORTAL_FADE_IN_DURATION, 0, 1);
      } else {
        portal.introAlpha = clamp(
          1 - ((intro.elapsed - RUN_START_PLAYER_SPAWN_DELAY) / RUN_START_PORTAL_FADE_OUT_DURATION),
          0,
          1
        );
        if (portal.introAlpha <= 0) {
          this.searchables = (this.searchables || []).filter((searchable) => searchable.id !== portal.id);
          intro.portalId = null;
        }
      }
    }
    if (!intro.playerSpawned && intro.elapsed >= RUN_START_PLAYER_SPAWN_DELAY) {
      intro.playerSpawned = true;
      this.player.x = intro.spawnX;
      this.player.y = intro.spawnY;
      this.player.runStartHidden = false;
      this.player.animClock = 0;
      this.camera.triggerShake?.(12, 0.3);
      this.killVisibleEnemies();
    }
    if (intro.elapsed >= RUN_START_ENEMY_IDLE_DURATION) {
      intro.active = false;
      this.player.runStartHidden = false;
    }
  }

  isWorldRectVisible(x, y, w, h, padding = 0) {
    return !(
      x + w < this.camera.x - padding
      || y + h < this.camera.y - padding
      || x > this.camera.x + this.camera.viewWidth + padding
      || y > this.camera.y + this.camera.viewHeight + padding
    );
  }

  killVisibleEnemies() {
    const visibleEnemies = (this.enemies || []).filter((enemy) => (
      !enemy.dead && this.isWorldRectVisible(enemy.x, enemy.y, enemy.w, enemy.h, 24)
    ));
    for (const enemy of visibleEnemies) {
      this.damageEnemy(enemy, enemy.maxHp * 999, {
        source: "introPortal",
        isDirect: true,
        bypassPlates: true
      });
    }
  }

  createEnemyTestDummy(x, y) {
    const dummy = spawnEnemyByType("m_bar_ogre_1", x, y, { currentHp: 600, assets: this.assets });
    if (!dummy) return null;
    dummy.maxHp = 600;
    dummy.hp = 600;
    dummy.damage = 0;
    dummy.baseDamage = 0;
    dummy.speed = 0;
    dummy.baseSpeed = 0;
    dummy.cooldown = 9999;
    dummy.render = { sheetKey: "idle", frame: 0 };
    dummy.hitTimer = 0;
    dummy.status = createStatusState();
    dummy.affixes = [];
    dummy.affixState = {};
    return dummy;
  }

  resetEnemyTestDummy() {
    const dummy = this.enemyTest?.dummyTarget;
    const enemy = this.enemyTest?.controlledEnemy;
    if (!dummy || !enemy) return;
    dummy.dead = false;
    dummy.maxHp = 600;
    dummy.hp = 600;
    dummy.hitTimer = 0;
    resetStatusState(dummy);
    dummy.showHealthBar = true;
    dummy.render.sheetKey = "idle";
    dummy.render.frame = 0;
    dummy.x = Math.min(this.world.width - dummy.w - 48, enemy.x + 220);
    dummy.y = enemy.y;
    this.markEnemiesDirty();
  }

  setupEnemyTestArena(typeId) {
    const selectedTypeId = typeId || this.enemyTest?.selectedTypeId;
    if (!selectedTypeId) return;
    this.seed = ENEMY_TEST_SEED;
    this.roomIndex = 0;
    this.kills = 0;
    this.roomKills = 0;
    this.gold = 0;
    this.goldDrops = [];
    this.xpDrops = [];
    this.materialDrops = [];
    this.searchables = [];
    this.breakables = [];
    this.ringDrops = [];
    this.roomCleared = false;
    this.roomTransitionTimer = 0;
    this.roomMinibossSpawned = false;
    this.roomPortalSpawned = false;
    this.lastMinibossDeathPosition = null;
    this.roomType = "biome";
    this.world = generateRoom(ENEMY_TEST_SEED, 0, this.assets);
    resetMeleeAttackTokenController(this.meleeAttackTokens, { maxTokens: MELEE_ATTACK_TOKEN_POOL_SIZE });
    this.combat = createCombatState([]);
    this.runSkills = [];
    this.scene = createEnemyTestScene(this);
    this.state = "running";

    const controlledEnemy = spawnEnemyByType(selectedTypeId, this.world.start.x, this.world.start.y, { assets: this.assets });
    if (!controlledEnemy?.attackRuntime) return;
    controlledEnemy.attackRuntime.awaken.finished = true;
    controlledEnemy.attackRuntime.awaken.active = false;
    controlledEnemy.attackRuntime.swiftStep.triggered = true;
    controlledEnemy.attackRuntime.guard.triggered = true;
    controlledEnemy.cooldown = 0;
    controlledEnemy.affixes = [];
    controlledEnemy.affixState = {};
    controlledEnemy.enemyTier = "minion";
    controlledEnemy.showHealthBar = true;

    const dummy = this.createEnemyTestDummy(this.world.start.x + 220, this.world.start.y);
    this.enemies = [controlledEnemy];
    if (dummy) this.enemies.push(dummy);

    this.enemyTest.selectedTypeId = selectedTypeId;
    this.enemyTest.controlledEnemy = controlledEnemy;
    this.enemyTest.dummyTarget = dummy;
    this.enemyTest.dummyRespawnTimer = 0;
    this.player = {
      ...this.player,
      ...ENEMY_TEST_PLAYER_SNAPSHOT,
      x: dummy?.x ?? this.world.start.x + 220,
      y: dummy?.y ?? this.world.start.y,
      movement: createMovementState(this.heroDef)
    };
    resetPlayerStats(this.player, this.heroDef);
    setPlayerStatSource(this.player, "runtime", { globalDamage: { add: 0 } });
    resetAmbientLeaves(this);
    resetAmbientMagicParticles(this);
    this.camera.snapTo(controlledEnemy, this.world);
    setMinimapWorld(this.world);
    this.markEnemiesDirty();
    this.markBreakablesDirty();
    this.markCollisionCacheDirty();
    this.bumpUiVersion("enemyTest", "overlay");
  }

  updateEnemyTest(dt) {
    const controlledEnemy = this.enemyTest?.controlledEnemy;
    const dummy = this.enemyTest?.dummyTarget;
      if (this.input.wasPressed("escape")) {
      this.showStartMenu();
      return;
    }
    if (!this.world || !controlledEnemy || !dummy) return;

    this.time += dt;
    this.combat.contactCooldown = Math.max(0, this.combat.contactCooldown - dt);
    updateMeleeAttackTokens(this);
    const moveAxis = this.input.getMoveAxis();
    this.updateEnemyTestMovementRecorder(dt, moveAxis);
    dummy.hitTimer = Math.max(0, (dummy.hitTimer || 0) - dt);
    dummy.animClock += dt;
    dummy.render.sheetKey = "idle";
    dummy.render.frame = Math.floor(dummy.animClock * (dummy.sprite.idle?.fps || 8)) % Math.max(1, dummy.sprite.idle?.frames || 1);

    updateStatusState(dummy, dt, {
      onTickDamage: (amount) => {
        if (amount <= 0) return;
        dummy.hp = Math.max(0, dummy.hp - amount);
        dummy.showHealthBar = true;
        if (dummy.hp <= 0) {
          dummy.dead = true;
          this.enemyTest.dummyRespawnTimer = Math.max(this.enemyTest.dummyRespawnTimer || 0, 0.75);
          this.markEnemiesDirty();
        }
      }
    });

    for (let index = 0; index < ENEMY_TEST_ATTACK_KEYS.length; index += 1) {
      if (this.input.wasPressed(ENEMY_TEST_ATTACK_KEYS[index])) {
        triggerEnemyAttackByIndex(this, controlledEnemy, index);
      }
    }

    updateManualControlledEnemy(this, controlledEnemy, dt);
    updateEnemyThreats(this, dt);

    this.player.x = dummy.x;
    this.player.y = dummy.y;
    this.player.w = dummy.w;
    this.player.h = dummy.h;

    if (this.enemyTest.dummyRespawnTimer > 0 || dummy.dead || dummy.hp <= 0) {
      this.enemyTest.dummyRespawnTimer = Math.max(0, (this.enemyTest.dummyRespawnTimer || 0) - dt);
      if (this.enemyTest.dummyRespawnTimer <= 0) this.resetEnemyTestDummy();
    }

    this.camera.follow(controlledEnemy, this.world, dt);
  }

  start() {
    this.lastFrame = performance.now();
    this.animationFrame = requestAnimationFrame((time) => this.loop(time));
  }

  resetPlayerHitSlow() {
    this.playerHitSlowTimer = 0;
    this.playerHitSlowCooldownTimer = 0;
    this.critHitSlowTimer = 0;
    this.critHitSlowTriggerTimers = [];
    this.playerHitCameraZoomTimer = 0;
    this.playerHitCameraZoomStrength = 0;
    this.updateCameraViewport();
  }

  updatePlayerHitSlow(dt) {
    this.playerHitSlowTimer = Math.max(0, this.playerHitSlowTimer - dt);
    this.playerHitSlowCooldownTimer = Math.max(0, this.playerHitSlowCooldownTimer - dt);
    this.critHitSlowTimer = Math.max(0, this.critHitSlowTimer - dt);
    this.critHitSlowTriggerTimers = (this.critHitSlowTriggerTimers || [])
      .map((timer) => Math.max(0, timer - dt))
      .filter((timer) => timer > 0);
    if (this.playerHitCameraZoomTimer > 0 || this.playerHitCameraZoomStrength > 0) {
      this.playerHitCameraZoomTimer = Math.max(0, this.playerHitCameraZoomTimer - dt);
      const targetZoomStrength = this.playerHitCameraZoomTimer > 0 ? 1 : 0;
      const previousZoomStrength = this.playerHitCameraZoomStrength || 0;
      const zoomLerpRate = targetZoomStrength > previousZoomStrength
        ? PLAYER_HIT_CAMERA_ZOOM_IN_LERP
        : PLAYER_HIT_CAMERA_ZOOM_OUT_LERP;
      const zoomT = clamp(dt * zoomLerpRate, 0, 1);
      let nextZoomStrength = previousZoomStrength + (targetZoomStrength - previousZoomStrength) * zoomT;
      if (Math.abs(nextZoomStrength - targetZoomStrength) <= 0.001) nextZoomStrength = targetZoomStrength;
      this.playerHitCameraZoomStrength = nextZoomStrength;
      if (Math.abs(nextZoomStrength - previousZoomStrength) > 0.0001) {
        this.updateCameraViewport();
      }
    } else if (this.playerHitCameraZoomStrength !== 0) {
      this.playerHitCameraZoomStrength = 0;
      this.updateCameraViewport();
    }
  }

  getGameplayTimeScale() {
    let timeScale = 1;
    if (this.playerHitSlowTimer > 0) timeScale = Math.min(timeScale, PLAYER_HIT_SLOW_TIME_SCALE);
    if (this.critHitSlowTimer > 0) timeScale = Math.min(timeScale, CRIT_HIT_SLOW_TIME_SCALE);
    return timeScale;
  }

  triggerPlayerHitSlow() {
    if (this.playerHitSlowCooldownTimer > 0) return false;
    this.playerHitSlowTimer = PLAYER_HIT_SLOW_DURATION;
    this.playerHitSlowCooldownTimer = PLAYER_HIT_SLOW_COOLDOWN;
    return true;
  }

  triggerCritHitSlow() {
    const activeTriggerTimers = (this.critHitSlowTriggerTimers || []).filter((timer) => timer > 0);
    if (activeTriggerTimers.length >= CRIT_HIT_SLOW_MAX_TRIGGERS) return false;
    activeTriggerTimers.push(CRIT_HIT_SLOW_WINDOW);
    this.critHitSlowTriggerTimers = activeTriggerTimers;
    this.critHitSlowTimer = Math.max(this.critHitSlowTimer || 0, CRIT_HIT_SLOW_DURATION);
    return true;
  }

  triggerPlayerHitCameraZoom() {
    this.playerHitCameraZoomTimer = PLAYER_HIT_CAMERA_ZOOM_DURATION;
    this.updateCameraViewport();
  }

  loop(time) {
    this.beginFrameCache();
    const dt = Math.min(1 / 15, (time - this.lastFrame) / 1000 || 0);
    this.lastFrame = time;
    const perfSample = this.perf.enabled
      ? {
          dt: dt * 1000,
          total: 0,
          scene: 0,
          update: 0,
          combat: 0,
          enemies: 0,
          render: 0,
          uiSync: 0
        }
      : null;
    const frameStart = this.perf.enabled ? performance.now() : 0;
    this.updateBackgroundMusic(dt);
    if (this.scene?.id === "enemy-test") {
      const sceneStart = this.perf.enabled ? performance.now() : 0;
      this.updateEnemyTest(dt);
      if (this.scene?.id === "enemy-test") {
        if (perfSample) perfSample.scene = performance.now() - sceneStart;
        const renderStart = this.perf.enabled ? performance.now() : 0;
        renderGame(this.ctx, this);
        if (perfSample) perfSample.render = performance.now() - renderStart;
        setMinimapVisible(false);
      } else if (this.scene) {
        if (perfSample) perfSample.scene = performance.now() - sceneStart;
        const renderStart = this.perf.enabled ? performance.now() : 0;
        this.scene.update?.(0);
        this.scene.render?.(this.ctx);
        if (perfSample) perfSample.render = performance.now() - renderStart;
        setMinimapVisible(false);
      }
    } else if (this.scene) {
      const sceneStart = this.perf.enabled ? performance.now() : 0;
      this.scene.update?.(dt);
      this.scene.render?.(this.ctx);
      if (perfSample) perfSample.scene = performance.now() - sceneStart;
      setMinimapVisible(false);
    } else {
      const updateStart = this.perf.enabled ? performance.now() : 0;
      this.update(dt);
      if (perfSample) {
        perfSample.update = performance.now() - updateStart;
        perfSample.combat = this.lastGameplayPerf.combat;
        perfSample.enemies = this.lastGameplayPerf.enemies;
      }
      const renderStart = this.perf.enabled ? performance.now() : 0;
      renderGame(this.ctx, this);
      const showMinimap = this.state !== "loading" && !!this.world && (!this.roomMinibossSpawned || this.revealChestsOnMinimap);
      setMinimapVisible(showMinimap);
      renderMinimap(this);
      if (perfSample) perfSample.render = performance.now() - renderStart;
    }
    const uiSyncStart = this.perf.enabled ? performance.now() : 0;
    this.runUiSync(time, dt);
    if (perfSample) {
      perfSample.uiSync = performance.now() - uiSyncStart;
      perfSample.total = performance.now() - frameStart;
      this.recordPerfFrame(perfSample);
    }
    this.input.updateFrame();
    this.animationFrame = requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  update(dt) {
    this.lastGameplayPerf.combat = 0;
    this.lastGameplayPerf.enemies = 0;
    if (this.input.wasPressed("i") && !this.scene && this.state !== "loading" && this.state !== "defeat" && this.state !== "victory") {
      this.toggleInventoryOverlay();
    }
    if (this.input.wasPressed("c") && !this.scene && this.state !== "loading" && this.state !== "defeat" && this.state !== "victory") {
      this.toggleCharacterOverlay();
    }

    if (this.input.wasPressed("escape")) {
      if (this.inventoryOverlayOpen) {
        this.closeInventoryOverlay();
      } else if (this.characterOverlayOpen) {
        this.closeCharacterOverlay();
      } else if (this.alchemyWorkshopOpen) {
        this.closeAlchemyWorkshop();
      } else if (this.blacksmithOpen) {
        this.closeBlacksmith();
      } else if (this.ringSelectionShopOpen) {
        this.closeRingSelectionShop();
      } else if (this.state === "running") {
        this.state = "paused";
      } else if (this.state === "paused") {
        this.state = "running";
      }
    }

    if (this.input.wasPressed("r") && (this.isDefeatOverlayVisible() || this.state === "victory")) {
      this.restart();
      return;
    }
    if (!this.world || this.state === "loading") return;

    const cameraTarget = this.player.spiritMode?.active
      ? { x: this.player.spiritMode.spiritX, y: this.player.spiritMode.spiritY, w: this.player.w, h: this.player.h }
      : this.player;
    let cameraDt = dt;

    if (this.state === "running") {
      const gameplayDt = dt * this.getGameplayTimeScale();
      this.updatePlayerHitSlow(dt);
      cameraDt = gameplayDt;
      updateCombatFeedback(this, gameplayDt);
      if ((this.combat.hitStopTimer || 0) > 0) {
        this.camera.follow(cameraTarget, this.world, cameraDt);
        return;
      }
      this.time += gameplayDt;
      this.inkFlashTimer = Math.max(0, (this.inkFlashTimer || 0) - gameplayDt);
      this.player.hitTimer = Math.max(0, this.player.hitTimer - gameplayDt);
      this.player.damageFlashTimer = Math.max(0, (this.player.damageFlashTimer || 0) - gameplayDt);
      updateRingRuntime(this, gameplayDt);
      updateRingRuntime(this, gameplayDt);
      updateFingerRuntime(this, gameplayDt);
      updateFingerExperimentRuntime(this, gameplayDt);
      this.updateRunStartIntro(gameplayDt);
      const playerCanAct = !this.runStartIntro?.active || this.runStartIntro.playerSpawned;
      if (playerCanAct) {
        updatePlayerMovement(this, gameplayDt);
        updatePlayerAnimation(this, gameplayDt);

        // Sprint Tutorial Logic
        if (this.roomIndex === 0 && !this.hasShownSprintTutorial) {
          const isSprinting = this.player.movement?.state === "sprint";
          const isAttacking = this.input.mouse.down || this.input.mouse.rightClicked;
          const isMoving = this.player.isMoving;

          if (isMoving && !isSprinting && !isAttacking) {
            this.tutorialSprintTimer += gameplayDt;
            if (this.tutorialSprintTimer >= 5) {
              spawnDamagePopup(this, this.player.x + this.player.w * 0.5, this.player.y - 40, "press Shift to sprint", {
                color: "#facc15",
                strokeColor: "rgba(113, 63, 18, 0.95)",
                duration: 10,
                riseSpeed: 12,
                scale: 1.1
              });
              this.hasShownSprintTutorial = true;
            }
          } else {
            // Reset timer if they stop moving, or mark as done if they already know how to sprint/attack
            if (isSprinting || isAttacking) {
              this.hasShownSprintTutorial = true;
            }
            this.tutorialSprintTimer = 0;
          }
        }
      } else {
        this.player.isMoving = false;
      }
      const combatStart = this.perf.enabled ? performance.now() : 0;
      if (playerCanAct) updateCombat(this, gameplayDt);
      if (this.perf.enabled) this.lastGameplayPerf.combat = performance.now() - combatStart;
      updateMeleeAttackTokens(this);
      const enemiesStart = this.perf.enabled ? performance.now() : 0;
      updateEnemies(this, gameplayDt);
      if (this.perf.enabled) this.lastGameplayPerf.enemies = performance.now() - enemiesStart;
      updateGoldDrops(this, gameplayDt);
      updateExperienceDrops(this, gameplayDt);
             updateMaterialDrops(this, gameplayDt);
       updateBreakables(this, gameplayDt);
      updateSearchables(this, gameplayDt);
      updateCursedAnvilCurse(this, gameplayDt);
      updateCursedAnvilParticles(this, gameplayDt);
      updateAmbientLeaves(this, gameplayDt);
      updateAmbientMagicParticles(this, gameplayDt);
      updateTreasureSpirit(this, gameplayDt);
      updateDevilMerchant(this, gameplayDt);
      resolveEnemyBodyDamage(this);

      const hasLivingMiniboss = this.enemies.some((enemy) => enemy.isMiniBoss);
      const hasLivingBoss = this.enemies.some((enemy) => enemy.isBoss);
      const roomObjectiveMet = this.roomBossSpawned
        ? !hasLivingBoss
        : this.roomMinibossSpawned
          ? !hasLivingMiniboss
          : this.enemies.length === 0;

      if (this.roomType === "biome" && !this.roomPortalSpawned && roomObjectiveMet) {
        this.roomPortalSpawned = true;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 8);
        spawnBiomePortal(this);

        if (this.roomMinibossSpawned) {
          this.revealChestsOnMinimap = true;
          this.minibossHasteTimer = 30;
          setPlayerStatSource(this.player, "minibossHaste", { moveSpeed: { mult: 1.5 } });
          spawnDamagePopup(this, this.player.x + this.player.w * 0.5, this.player.y - 60, "Miniboss Defeated: HASTE!", {
            color: "#fbbf24",
            strokeColor: "#78350f",
            duration: 3.0,
            riseSpeed: 20,
            scale: 1.2
          });
        }
      }

      if (this.minibossHasteTimer > 0) {
        this.minibossHasteTimer -= gameplayDt;
        if (this.minibossHasteTimer <= 0) {
          this.minibossHasteTimer = 0;
          clearPlayerStatSource(this.player, "minibossHaste");
        }
      }
    } else if (this.state === "defeat") {
      this.updateDefeatSequence(dt);
    }

    this.camera.follow(cameraTarget, this.world, cameraDt);
  }

  handlePortalExitGoldConversion() {
    const consumed = Math.floor(this.gold * 0.8);
    if (consumed > 0) {
      this.gold -= consumed;
      grantExperience(this, consumed);
      
      const px = this.player.x + this.player.w * 0.5;
      const py = this.player.y;
      spawnDamagePopup(this, px, py - 40, `Converted ${consumed} Gold to XP`, {
        color: "#38bdf8",
        strokeColor: "#082f49",
        duration: 2.0,
        riseSpeed: 20,
        scale: 1.0
      });
    }
  }

  advanceRoom() {
    this.handlePortalExitGoldConversion();
    this.roomIndex += 1;
    if (this.roomIndex >= this.maxRooms) {
      this.state = "victory";
      return;
    }
    this.loadRoom(this.roomIndex);
  }

  isBossRoom(roomIndex) {
    return roomIndex === this.maxRooms - 1;
  }

  spawnBossRoomEncounter(roomIndex) {
    if (!this.world || !this.isBossRoom(roomIndex)) return [];
    const spawnX = this.world.width * 0.5 - 42;
    const spawnY = Math.max(72, this.world.height * 0.34 - 42);
    const boss = spawnEnemyByType("m_ud_arcane_elemental_boss", spawnX, spawnY, { assets: this.assets });
    if (!boss) return [];
    boss.isBoss = true;
    boss.showHealthBar = true;
    boss.enemyTier = "minion";
    boss.affixes = [];
    boss.affixState = {};
    return [boss];
  }

  spawnEnemyProjectile(enemy, options) {
    spawnEnemyProjectile(this, enemy, options);
  }

  spawnEnemyAreaHitbox(hitbox) {
    spawnEnemyAreaHitbox(this, hitbox);
  }

  damageEnemy(enemy, amount, meta = {}) {
    let finalAmount = amount;
    const feState = this.fingerExperimentState;

    if (feState?.activeMainMod?.id === 'main_empowered_strike' && feState.empoweredStrikeReady) {
      finalAmount *= 1.5;
      feState.empoweredStrikeReady = false;
      feState.empoweredStrikeTimer = 3.0; // Reset 3s cooldown
      
      const center = centerOf(enemy);
      spawnDamagePopup(this, center.x, center.y - 20, "EMPOWERED!", {
        color: "#c084fc",
        strokeColor: "#581c87",
        duration: 1.2,
        scale: 1.3
      });
    }

    return damageEnemy(this, enemy, finalAmount, meta);
  }

  damageBreakable(breakable, amount) {
    damageBreakable(this, breakable, amount);
  }

  damagePlayer(amount, sourceEnemy = null) {
    return damagePlayer(this, amount, sourceEnemy);
  }

  spawnEnemyByType(typeId, x, y, extras = {}) {
    const enemy = spawnEnemyByType(typeId, x, y, { ...extras, assets: this.assets });
    if (!enemy) return null;
    Object.assign(enemy, extras);
    const safePosition = findSafeEnemySpawnPosition(this.world, enemy, enemy.x, enemy.y);
    enemy.x = safePosition.x;
    enemy.y = safePosition.y;
    this.enemies.push(enemy);
    this.markEnemiesDirty();
    return enemy;
  }

  spawnEnemyNearPlayer(typeId) {
    if (!this.world) return null;
    const offsets = [
      { x: 96, y: 0 },
      { x: -96, y: 0 },
      { x: 0, y: 96 },
      { x: 0, y: -96 },
      { x: 128, y: 64 },
      { x: -128, y: 64 },
      { x: 128, y: -64 },
      { x: -128, y: -64 }
    ];
    for (const offset of offsets) {
      const enemy = spawnEnemyByType(typeId, this.player.x + offset.x, this.player.y + offset.y, { assets: this.assets });
      if (!enemy) continue;
      const safePosition = findSafeEnemySpawnPosition(this.world, enemy, enemy.x, enemy.y);
      const nextEnemy = {
        x: safePosition.x,
        y: safePosition.y,
        w: enemy.w,
        h: enemy.h
      };
      const blocked = this.getCollisionBlockers({ includeBreakables: true }).some((wall) => !(
        nextEnemy.x + nextEnemy.w <= wall.x ||
        nextEnemy.x >= wall.x + wall.w ||
        nextEnemy.y + nextEnemy.h <= wall.y ||
        nextEnemy.y >= wall.y + wall.h
      ));
      if (blocked) continue;
      Object.assign(enemy, { x: nextEnemy.x, y: nextEnemy.y });
      this.enemies.push(enemy);
      this.markEnemiesDirty();
      return enemy;
    }
    return null;
  }

  canSpendGold(amount) {
    return this.gold >= amount;
  }

  spendGold(amount) {
    if (!this.canSpendGold(amount)) return false;
    this.gold -= amount;
    return true;
  }

  openInventoryOverlay() {
    if (this.scene || this.state === "loading" || this.state === "defeat" || this.state === "victory") return false;
    if (this.inventoryOverlayOpen) return true;
    if (this.characterOverlayOpen) this.closeCharacterOverlay();
    if (this.alchemyWorkshopOpen) this.closeAlchemyWorkshop();
    if (this.blacksmithOpen) this.closeBlacksmith();
    if (this.ringSelectionShopOpen) this.closeRingSelectionShop();
    this.inventoryOverlayOpen = true;
    if (this.state === "running") {
      this.state = "paused";
      this.inventoryPausedGame = true;
    } else {
      this.inventoryPausedGame = false;
    }
    this.bumpUiVersion("inventory", "overlay");
    return true;
  }

  closeInventoryOverlay() {
    if (!this.inventoryOverlayOpen) return false;
    this.inventoryOverlayOpen = false;
    cancelPendingRingInventorySelection(this);
    if (this.inventoryPausedGame && this.state === "paused") {
      this.state = "running";
    }
    this.inventoryPausedGame = false;
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  toggleInventoryOverlay() {
    if (this.inventoryOverlayOpen) return this.closeInventoryOverlay();
    return this.openInventoryOverlay();
  }

  openCharacterOverlay() {
    if (this.scene || this.state === "loading" || this.state === "defeat" || this.state === "victory") return false;
    if (this.characterOverlayOpen) return true;
    if (this.inventoryOverlayOpen) this.closeInventoryOverlay();
    if (this.alchemyWorkshopOpen) this.closeAlchemyWorkshop();
    if (this.blacksmithOpen) this.closeBlacksmith();
    if (this.ringSelectionShopOpen) this.closeRingSelectionShop();
    this.characterOverlayOpen = true;
    if (this.state === "running") {
      this.state = "paused";
      this.characterPausedGame = true;
    } else {
      this.characterPausedGame = false;
    }
    this.bumpUiVersion("overlay");
    return true;
  }

  closeCharacterOverlay() {
    if (!this.characterOverlayOpen) return false;
    this.characterOverlayOpen = false;
    if (this.characterPausedGame && this.state === "paused") {
      this.state = "running";
    }
    this.characterPausedGame = false;
    this.bumpUiVersion("overlay");
    return true;
  }

  toggleCharacterOverlay() {
    if (this.characterOverlayOpen) return this.closeCharacterOverlay();
    return this.openCharacterOverlay();
  }

  openAlchemyWorkshop() {
    if (this.scene || this.state === "loading" || this.state === "defeat" || this.state === "victory") return false;
    if (this.alchemyWorkshopOpen) return true;
    if (this.inventoryOverlayOpen) this.closeInventoryOverlay();
    if (this.characterOverlayOpen) this.closeCharacterOverlay();
    if (this.blacksmithOpen) this.closeBlacksmith();
    if (this.ringSelectionShopOpen) this.closeRingSelectionShop();
    this.alchemyWorkshopOpen = true;
    if (this.state === "running") {
      this.state = "paused";
      this.alchemyWorkshopPausedGame = true;
    } else {
      this.alchemyWorkshopPausedGame = false;
    }
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  closeAlchemyWorkshop() {
    if (!this.alchemyWorkshopOpen) return false;
    this.alchemyWorkshopOpen = false;
    if (this.alchemyWorkshopPausedGame && this.state === "paused") {
      this.state = "running";
    }
    this.alchemyWorkshopPausedGame = false;
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  toggleAlchemyWorkshop() {
    if (this.alchemyWorkshopOpen) return this.closeAlchemyWorkshop();
    return this.openAlchemyWorkshop();
  }

  openBlacksmith() {
    if (this.scene || this.state === "loading" || this.state === "defeat" || this.state === "victory") return false;
    if (this.blacksmithOpen) return true;
    if (this.inventoryOverlayOpen) this.closeInventoryOverlay();
    if (this.characterOverlayOpen) this.closeCharacterOverlay();
    if (this.alchemyWorkshopOpen) this.closeAlchemyWorkshop();
    if (this.ringSelectionShopOpen) this.closeRingSelectionShop();
    this.blacksmithOpen = true;
    if (this.state === "running") {
      this.state = "paused";
      this.blacksmithPausedGame = true;
    } else {
      this.blacksmithPausedGame = false;
    }
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  closeBlacksmith() {
    if (!this.blacksmithOpen) return false;
    this.blacksmithOpen = false;
    if (this.blacksmithPausedGame && this.state === "paused") {
      this.state = "running";
    }
    this.blacksmithPausedGame = false;
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  toggleBlacksmith() {
    if (this.blacksmithOpen) return this.closeBlacksmith();
    return this.openBlacksmith();
  }

  getActiveRingSelectionSearchable() {
    if (!this.activeRingSelectionSearchableId) return null;
    return (this.searchables || []).find((searchable) => searchable.id === this.activeRingSelectionSearchableId) || null;
  }

  getActiveRingSelectionOffers() {
    return getRingSelectionOffers(this.getActiveRingSelectionSearchable());
  }

  openRingSelectionShop(searchableId) {
    if (this.scene || this.state === "loading" || this.state === "defeat" || this.state === "victory") return false;
    const searchable = (this.searchables || []).find((entry) => entry.id === searchableId && entry.typeId === "ringSelectionShop" && !entry.isOpen);
    if (!searchable) return false;
    if (this.ringSelectionShopOpen && this.activeRingSelectionSearchableId === searchable.id) return true;
    if (this.inventoryOverlayOpen) this.closeInventoryOverlay();
    if (this.characterOverlayOpen) this.closeCharacterOverlay();
    if (this.alchemyWorkshopOpen) this.closeAlchemyWorkshop();
    if (this.blacksmithOpen) this.closeBlacksmith();
    this.activeRingSelectionSearchableId = searchable.id;
    this.ringSelectionShopOpen = true;
    if (this.state === "running") {
      this.state = "paused";
      this.ringSelectionShopPausedGame = true;
    } else {
      this.ringSelectionShopPausedGame = false;
    }
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  closeRingSelectionShop() {
    if (!this.ringSelectionShopOpen) return false;
    this.ringSelectionShopOpen = false;
    this.activeRingSelectionSearchableId = null;
    if (this.ringSelectionShopPausedGame && this.state === "paused") {
      this.state = "running";
    }
    this.ringSelectionShopPausedGame = false;
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  closeRingSelectionShop() {
    if (!this.ringSelectionShopOpen) return false;
    this.ringSelectionShopOpen = false;
    this.activeRingSelectionSearchableId = null;
    if (this.ringSelectionShopPausedGame && this.state === "paused") {
      this.state = "running";
    }
    this.ringSelectionShopPausedGame = false;
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  openCursedAnvilUi(searchableId) {
    if (this.scene || this.state === "loading" || this.state === "defeat" || this.state === "victory") return false;
    const searchable = (this.searchables || []).find((s) => s.id === searchableId && s.typeId === "cursedAnvil" && !s.isOpen);
    if (!searchable) return false;
    if (this.inventoryOverlayOpen) this.closeInventoryOverlay();
    if (this.characterOverlayOpen) this.closeCharacterOverlay();
    if (this.alchemyWorkshopOpen) this.closeAlchemyWorkshop();
    if (this.blacksmithOpen) this.closeBlacksmith();
    if (this.ringSelectionShopOpen) this.closeRingSelectionShop();
    return openCursedAnvil(this, searchable);
  }

  closeCursedAnvilUi() {
    closeCursedAnvil(this);
  }

  confirmCursedAnvilGamble(ringId) {
    const result = confirmCursedAnvilGamble(this, ringId);
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return result;
  }

  openDevilMerchantUi(searchableId) {
    if (this.scene || this.state === "loading" || this.state === "defeat" || this.state === "victory") return false;
    const searchable = (this.searchables || []).find((s) => s.id === searchableId && s.typeId === "devilMerchant" && !s.isOpen);
    if (!searchable) return false;
    if (this.inventoryOverlayOpen) this.closeInventoryOverlay();
    if (this.characterOverlayOpen) this.closeCharacterOverlay();
    if (this.alchemyWorkshopOpen) this.closeAlchemyWorkshop();
    if (this.blacksmithOpen) this.closeBlacksmith();
    if (this.ringSelectionShopOpen) this.closeRingSelectionShop();
    if (this.cursedAnvilOpen) this.closeCursedAnvilUi();
    return activateDevilMerchant(this, searchable);
  }

  closeDevilMerchantUi() {
    closeDevilMerchant(this);
  }

  buyDevilMerchantOffer(ringId) {
    const result = buyDevilMerchantOffer(this, ringId);
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return result;
  }

  sellRingToDevilMerchant(ringId) {
    const result = sellRingToDevilMerchant(this, ringId);
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return result;
  }

  attackDevilMerchant() {
    const result = attackDevilMerchant(this);
    this.bumpUiVersion("overlay");
    return result;
  }

  purchaseRingFromSelection(ringId) {
    const searchable = this.getActiveRingSelectionSearchable();
    const result = purchaseRingSelectionOffer(this, searchable, ringId);
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return result;
  }

  addRingToInventory(ringId) {
    const result = addRing(this, ringId);
    if (!result) return null;
    this.playAudioAsset("ringPickupSfx", {
      volumeScale: 0.9 + Math.random() * 0.2,
      playbackRate: 0.96 + Math.random() * 0.08
    });
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return result;
  }

  getRingEquipCapacity() {
    return Math.max(0, Math.floor(this.player.numberOfFingers || 0));
  }

  getAvailableRingSlotCount() {
    return Math.min(this.equippedRings.length, this.getRingEquipCapacity());
  }

  setNumberOfFingers(count) {
    this.player.numberOfFingers = Math.max(0, Math.floor(count || 0));
    const allowedSlots = this.getAvailableRingSlotCount();
    for (let index = this.equippedRings.length - 1; index >= allowedSlots; index -= 1) {
      this.equippedRings[index] = null;
    }
    refreshRingDerivedStats(this, { force: true });
    refreshFingerDerivedStats(this, { force: true });
    this.bumpUiVersion("inventory", "overlay", "ringStats");
  }

  getOwnedFingers() {
    return getOwnedFingerEntries(this);
  }

  getFingerAtSlot(slotIndex) {
    return getFingerInSlot(this, slotIndex);
  }

  slotHasFingerWithoutRing(slotIndex) {
    return slotHasFingerWithoutRing(this, slotIndex);
  }

  getAvailableFingerChoices(materialId) {
    return getAvailableFingerDefsForMaterial(this, materialId);
  }

  unlockFingerFromMaterial(materialId) {
    const result = unlockFingerFromMaterial(this, materialId);
    if (!result.ok) return result;
    this.playAudioAsset("fingerPickupSfx", {
      volumeScale: 0.95 + Math.random() * 0.15,
      playbackRate: 0.98 + Math.random() * 0.06
    });
    refreshFingerDerivedStats(this, { force: true });
    refreshRingDerivedStats(this, { force: true });
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return result;
  }

  craftFingerAtWorkshop(materialId) {
    const available = this.getAvailableFingerChoices(materialId);
    if (!available.length) return { ok: false, reason: "tierComplete" };
    const cost = getAdjustedFingerCraftCost(this, materialId);
    if (!cost.length) return { ok: false, reason: "invalidMaterial" };
    for (const entry of cost) {
      if (this.getMaterialCount(entry.materialId) < entry.amount) return { ok: false, reason: "insufficientMaterials" };
    }
    for (const entry of cost) {
      if (!consumeMaterialFromInventory(this, entry.materialId, entry.amount)) {
        for (const refund of cost) {
          if (refund === entry) break;
          ensureMaterialInventory(this);
          this.materialInventory[refund.materialId] = Math.max(0, Math.floor(this.materialInventory[refund.materialId] || 0) + refund.amount);
        }
        this.bumpUiVersion("inventory", "overlay", "ringStats");
        return { ok: false, reason: "insufficientMaterials" };
      }
    }
    const result = this.unlockFingerFromMaterial(materialId);
    if (!result.ok) {
      ensureMaterialInventory(this);
      for (const entry of cost) {
        this.materialInventory[entry.materialId] = Math.max(0, Math.floor(this.materialInventory[entry.materialId] || 0) + entry.amount);
      }
      this.bumpUiVersion("inventory", "overlay", "ringStats");
      return result;
    }
    grantAffinityXp(this, "alchemyWorkshop");
    return result;
  }

  sellFingerAtWorkshop(slotIndex) {
    const finger = this.getFingerAtSlot(slotIndex);
    if (!finger) return { ok: false, reason: "missingFinger" };
    const hpCost = 20;
    const goldGain = scaleGoldAmount(50);
    const nextHp = Math.max(1, (Number(this.player.hp) || 0) - hpCost);
    if (nextHp === this.player.hp) return { ok: false, reason: "insufficientHp" };

    const result = sellOwnedFinger(this, slotIndex);
    if (!result.ok) return result;

    this.player.hp = nextHp;
    this.gold += goldGain;
    refreshFingerDerivedStats(this, { force: true });
    refreshRingDerivedStats(this, { force: true });
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return {
      ...result,
      hpCost,
      goldGain
    };
  }

  consumePendingFingerEchoAttack() {
    return consumePendingFingerEchoAttack(this);
  }

  consumePendingFingerSlideAttackTarget() {
    return consumePendingFingerSlideAttackTarget(this);
  }

  equipRing(ringId) {
    const selected = togglePendingEquipSelection(this, ringId);
    if (!selected) return false;
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  canSelectRingForEquip(ringId) {
    return canSelectRingForEquip(this, ringId);
  }

  canEquipRingToSlot(ringId, slotIndex) {
    return canEquipOwnedRingToSlot(this, ringId, slotIndex);
  }

  equipRingToSlot(ringId, slotIndex) {
    const equipped = equipOwnedRingToSlot(this, ringId, slotIndex);
    if (!equipped) return false;
    refreshRingDerivedStats(this, { force: true });
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  unequipRing(slotIndex) {
    const removed = unequipRingBySlot(this, slotIndex);
    if (!removed) return false;
    refreshRingDerivedStats(this, { force: true });
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  upgradeOwnedRing(ringId) {
    const upgraded = upgradeRing(this, ringId);
    if (!upgraded) return false;
    refreshRingDerivedStats(this, { force: true });
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  getUpgradeRingState(ringId) {
    return canUpgradeRing(this, ringId);
  }

  scrapOwnedRing(ringId) {
    const removed = scrapRing(this, ringId);
    if (!removed) return false;
    refreshRingDerivedStats(this, { force: true });
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  getScrapRingState(ringId) {
    return canScrapRing(this, ringId);
  }

  isMirrorCatalystRing(ringId) {
    return isMirrorCatalystRing(this, ringId);
  }

  canUseMirrorRing(ringId) {
    return canUseMirrorUpgradeSource(this, ringId);
  }

  getPendingRingInventorySelection() {
    return getPendingRingInventorySelection(this);
  }

  toggleMirrorRingSelection(ringId) {
    const updated = toggleMirrorCatalystSelection(this, ringId);
    if (!updated) return false;
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  canApplyMirrorUpgradeToRing(ringId) {
    return canApplyMirrorUpgradeToRing(this, ringId);
  }

  applyMirrorUpgradeToRing(ringId) {
    const applied = applyMirrorUpgradeToRing(this, ringId);
    if (!applied) return false;
    refreshRingDerivedStats(this, { force: true });
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return true;
  }

  applyMirrorUpgradeFromRing(sourceRingId, targetRingId) {
    const result = applyMirrorUpgradeFromSource(this, sourceRingId, targetRingId);
    if (!result.ok) return result;
    refreshRingDerivedStats(this, { force: true });
    this.bumpUiVersion("inventory", "overlay", "ringStats");
    return result;
  }

  getOwnedRings() {
    return getOwnedRings(this);
  }

  getAffinityDebugInfo() {
    return getAffinityDebugInfo();
  }

  getRingEssence() {
    return getRingEssence(this);
  }

  getMaterialCount(materialId) {
    return getMaterialCount(this, materialId);
  }
}
