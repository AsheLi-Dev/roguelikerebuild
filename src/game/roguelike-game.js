import { loadAssetPack } from "../core/assets.js";
import { Camera } from "../core/camera.js";
import { InputController } from "../core/input.js";
import { DEFAULT_HERO_ID, getHeroDef } from "../data/heroes.js";
import { createRingInstance } from "../data/rings.js";
import { getWeaponArtDef } from "../data/weapon-arts.js";
import { buildRunWeaponArtState, createWeaponArtProgressionState } from "../data/weapon-art-progression.js";
import { createCombatState, damageEnemy, damagePlayer, resolveEnemyBodyDamage, spawnEnemyAreaHitbox, spawnEnemyProjectile, updateCombat, updateCombatFeedback, updateEnemyThreats } from "../systems/combat.js";
import { damageBreakable, spawnRoomBreakables, updateBreakables } from "../systems/breakables.js";
import { getControllableEnemyTypeIds, spawnEnemyByType, spawnRoomEnemies, updateEnemies } from "../systems/enemies.js";
import { updateGoldDrops } from "../systems/gold.js";
import { createMovementState, updatePlayerMovement } from "../systems/movement.js";
import { ensurePlayerStats, resetPlayerStats, setPlayerStatSource } from "../systems/player-stats.js";
import { createEnemyTestScene } from "../scenes/enemy-test-scene.js";
import { createLoadoutScene } from "../scenes/loadout-scene.js";
import { createStartMenuScene } from "../scenes/start-menu-scene.js";
import { initializeRingRuntime, updateRingRuntime } from "../systems/rings.js";
import { spawnRoomSearchables, updateSearchables } from "../systems/searchables.js";
import { createStatusState, resetStatusState, updateStatusState } from "../systems/status-manager.js";
import { createDefaultTacticProfiles, getEnemyMovementClass } from "../systems/tactical-movement.js";
import { triggerEnemyAttackByIndex, updateManualControlledEnemy } from "../systems/undead-runtime.js";
import { getDefaultRunSkillIds } from "../systems/skills.js";
import { initializeWeaponArtRuntime } from "../systems/weapon-art-runtime.js";
import { generateRoom } from "../systems/world-generation.js";
import { renderGame } from "../render/renderer.js";
import { renderMinimap, setMinimapVisible, setMinimapWorld } from "../ui/minimap.js";

const ENEMY_TEST_SEED = 424242;
const ENEMY_TEST_ATTACK_KEYS = Object.freeze(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]);
const ENEMY_MOVEMENT_PATTERN_STORAGE_KEY = "roguelike.enemyMovementPatterns";
const ENEMY_MOVEMENT_PATTERN_TRIM_SECONDS = 2;
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
  numberOfFingers: 1,
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

export class RoguelikeGame {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assets = null;
    this.input = new InputController(canvas);
    this.camera = new Camera(canvas.width, canvas.height);
    this.heroDef = getHeroDef(options.heroId || DEFAULT_HERO_ID);
    this.heroId = this.heroDef.id;
    this.weaponArt = this.createWeaponArtLoadout(this.heroDef.defaultWeaponArt);
    this.maxRooms = 5;
    this.seed = Date.now();
    this.roomIndex = 0;
    this.roomKills = 0;
    this.kills = 0;
    this.gold = 0;
    this.goldDrops = [];
    this.searchables = [];
    this.breakables = [];
    this.ringDrops = [];
    this.ringInventory = [];
    this.equippedRings = Array.from({ length: 10 }, () => null);
    this.inventoryOverlayOpen = false;
    this.inventoryPausedGame = false;
    this.characterOverlayOpen = false;
    this.characterPausedGame = false;
    this.nextRingInstanceId = 1;
    this.selectedRunSkills = [];
    this.runSkills = getDefaultRunSkillIds(this.selectedRunSkills);
    this.loadoutDraft = null;
    this.enemyTest = null;
    this.enemyTacticProfiles = createDefaultTacticProfiles();
    this.ringState = null;
    this.enemies = [];
    this.world = null;
    this.roomCleared = false;
    this.roomTransitionTimer = 0;
    this.state = "loading";
    this.scene = null;
    this.lastFrame = 0;
    this.animationFrame = 0;
    this.time = 0;

    this.player = {
      x: 0,
      y: 0,
      w: 36,
      h: 36,
      hp: this.heroDef.maxHp,
      maxHp: this.heroDef.maxHp,
      stats: null,
      facing: "down",
      animClock: 0,
      isMoving: false,
      movement: createMovementState(this.heroDef),
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
      numberOfFingers: 1
    };
    resetPlayerStats(this.player, this.heroDef);
    this.combat = createCombatState(getDefaultRunSkillIds(this.selectedRunSkills));
    initializeWeaponArtRuntime(this);
    this.tryHeroAttack = () => false;
    this.tryHeroAssist = () => false;
    this.tryTriggerSkillProc = () => false;
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

  async init() {
    this.assets = await loadAssetPack();
    await this.loadEnemyTacticProfiles();
    this.showStartMenu();
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
    this.heroDef = getHeroDef(heroId || DEFAULT_HERO_ID);
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
    if (options.restart !== false) this.restart();
  }

  showStartMenu() {
    this.state = "menu";
    this.scene = createStartMenuScene(this);
    this.loadoutDraft = null;
    this.enemyTest = null;
  }

  showLoadoutScene() {
    this.state = "loadout";
    this.loadoutDraft = {
      heroId: this.heroId,
      skillIds: [...getDefaultRunSkillIds(this.selectedRunSkills)]
    };
    this.scene = createLoadoutScene(this);
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
    this.setupEnemyTestArena(selectedTypeId);
  }

  setEnemyTestEnemy(typeId) {
    if (!this.enemyTest || !typeId || this.enemyTest.selectedTypeId === typeId) return;
    this.enemyTest.selectedTypeId = typeId;
    this.setupEnemyTestArena(typeId);
  }

  setEnemyTestRecordingTactic(tacticId) {
    if (!this.enemyTest || !tacticId) return;
    this.enemyTest.selectedTactic = tacticId;
  }

  setEnemyTestUiOpen(open) {
    if (!this.enemyTest) return;
    this.enemyTest.uiOpen = !!open;
  }

  toggleEnemyTestUi() {
    if (!this.enemyTest) return;
    this.enemyTest.uiOpen = !this.enemyTest.uiOpen;
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
    if (save) {
      this.persistEnemyMovementPatternToFile(recorder.savedPattern)
        .then((result) => {
          if (!this.enemyTest) return;
          this.enemyTest.lastPersistStatus = {
            state: "saved",
            message: `Saved to ${result.file}`
          };
        })
        .catch((error) => {
          if (!this.enemyTest) return;
          this.enemyTest.lastPersistStatus = {
            state: "error",
            message: String(error?.message || error)
          };
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
    this.heroDef = getHeroDef(heroId || DEFAULT_HERO_ID);
    this.heroId = this.heroDef.id;
    if (this.loadoutDraft) this.loadoutDraft.heroId = this.heroId;
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
    this.roomIndex = 0;
    this.kills = 0;
    this.roomKills = 0;
    this.gold = 0;
    this.goldDrops = [];
    this.searchables = [];
    this.breakables = [];
    this.ringDrops = [];
    this.ringInventory = [];
    this.equippedRings = Array.from({ length: 10 }, () => null);
    this.inventoryOverlayOpen = false;
    this.inventoryPausedGame = false;
    this.characterOverlayOpen = false;
    this.characterPausedGame = false;
    this.nextRingInstanceId = 1;
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
    this.player.numberOfFingers = 1;
    this.player.movement = createMovementState(this.heroDef);
    this.weaponArt = this.createWeaponArtLoadout(this.heroDef.defaultWeaponArt);
    this.runSkills = getDefaultRunSkillIds(this.selectedRunSkills);
    this.combat = createCombatState(this.runSkills);
    initializeWeaponArtRuntime(this);
    setPlayerStatSource(this.player, "runtime", { globalDamage: { add: 0 } });
    initializeRingRuntime(this);
    this.scene = null;
    this.state = "running";
    this.loadRoom(this.roomIndex);
  }

  loadRoom(roomIndex) {
    this.world = generateRoom(this.seed, roomIndex, this.assets);
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
    this.enemies = spawnRoomEnemies(this.world, roomIndex, this.seed);
    this.goldDrops = [];
    this.searchables = spawnRoomSearchables(this.world, roomIndex, this.seed);
    this.breakables = spawnRoomBreakables(this.world, this.searchables, roomIndex, this.seed);
    this.ringDrops = [];
    this.affixWallRects = [];
    this.combat.playerProjectiles = [];
    this.combat.enemyProjectiles = [];
    this.combat.enemyAreaHitboxes = [];
    this.camera.snapTo(this.player, this.world);
    setMinimapWorld(this.world);
  }

  createEnemyTestDummy(x, y) {
    const dummy = spawnEnemyByType("m_bar_ogre_1", x, y, { currentHp: 600 });
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
    this.searchables = [];
    this.breakables = [];
    this.ringDrops = [];
    this.roomCleared = false;
    this.roomTransitionTimer = 0;
    this.world = generateRoom(ENEMY_TEST_SEED, 0, this.assets);
    this.affixWallRects = [];
    this.combat = createCombatState([]);
    this.runSkills = [];
    this.scene = createEnemyTestScene(this);
    this.state = "running";

    const controlledEnemy = spawnEnemyByType(selectedTypeId, this.world.start.x, this.world.start.y);
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
    this.camera.snapTo(controlledEnemy, this.world);
    setMinimapWorld(this.world);
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

  loop(time) {
    const dt = Math.min(1 / 15, (time - this.lastFrame) / 1000 || 0);
    this.lastFrame = time;
    if (this.scene?.id === "enemy-test") {
      this.updateEnemyTest(dt);
      if (this.scene?.id === "enemy-test") {
        renderGame(this.ctx, this);
        setMinimapVisible(false);
      } else if (this.scene) {
        this.scene.update?.(0);
        this.scene.render?.(this.ctx);
        setMinimapVisible(false);
      }
    } else if (this.scene) {
      this.scene.update?.(dt);
      this.scene.render?.(this.ctx);
      setMinimapVisible(false);
    } else {
      this.update(dt);
      renderGame(this.ctx, this);
      setMinimapVisible(this.state !== "loading" && !!this.world);
      renderMinimap(this);
    }
    this.input.updateFrame();
    this.animationFrame = requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  update(dt) {
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
      } else if (this.state === "running") {
        this.state = "paused";
      } else if (this.state === "paused") {
        this.state = "running";
      }
    }

    if (this.input.wasPressed("r") && (this.state === "defeat" || this.state === "victory")) {
      this.restart();
      return;
    }
    if (!this.world || this.state === "loading") return;

    const cameraTarget = this.player.spiritMode?.active
      ? { x: this.player.spiritMode.spiritX, y: this.player.spiritMode.spiritY, w: this.player.w, h: this.player.h }
      : this.player;

    if (this.state === "running") {
      updateCombatFeedback(this, dt);
      if ((this.combat.hitStopTimer || 0) > 0) {
        this.camera.follow(cameraTarget, this.world, dt);
        return;
      }
      this.time += dt;
      this.inkFlashTimer = Math.max(0, (this.inkFlashTimer || 0) - dt);
      this.player.animClock += dt;
      this.player.hitTimer = Math.max(0, this.player.hitTimer - dt);
      this.player.damageFlashTimer = Math.max(0, (this.player.damageFlashTimer || 0) - dt);
      updateRingRuntime(this, dt);
      updatePlayerMovement(this, dt);
      updateCombat(this, dt);
      updateEnemies(this, dt);
      updateGoldDrops(this, dt);
      updateBreakables(this, dt);
      updateSearchables(this, dt);
      resolveEnemyBodyDamage(this);

      if (!this.roomCleared && this.enemies.length === 0) {
        this.roomCleared = true;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 8);
      }

      if (this.roomCleared) {
        this.roomTransitionTimer += dt;
        if (this.roomTransitionTimer >= 1.2) this.advanceRoom();
      }
    }

    this.camera.follow(cameraTarget, this.world, dt);
  }

  advanceRoom() {
    this.roomIndex += 1;
    if (this.roomIndex >= this.maxRooms) {
      this.state = "victory";
      return;
    }
    this.loadRoom(this.roomIndex);
  }

  spawnEnemyProjectile(enemy, options) {
    spawnEnemyProjectile(this, enemy, options);
  }

  spawnEnemyAreaHitbox(hitbox) {
    spawnEnemyAreaHitbox(this, hitbox);
  }

  damageEnemy(enemy, amount, meta = {}) {
    damageEnemy(this, enemy, amount, meta);
  }

  damageBreakable(breakable, amount) {
    damageBreakable(this, breakable, amount);
  }

  damagePlayer(amount, sourceEnemy = null) {
    return damagePlayer(this, amount, sourceEnemy);
  }

  spawnEnemyByType(typeId, x, y, extras = {}) {
    const enemy = spawnEnemyByType(typeId, x, y, extras);
    if (!enemy) return null;
    Object.assign(enemy, extras);
    enemy.x = Math.max(0, Math.min(this.world.width - enemy.w, enemy.x));
    enemy.y = Math.max(0, Math.min(this.world.height - enemy.h, enemy.y));
    this.enemies.push(enemy);
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
      const enemy = spawnEnemyByType(typeId, this.player.x + offset.x, this.player.y + offset.y);
      if (!enemy) continue;
      const nextEnemy = {
        x: Math.max(0, Math.min(this.world.width - enemy.w, enemy.x)),
        y: Math.max(0, Math.min(this.world.height - enemy.h, enemy.y)),
        w: enemy.w,
        h: enemy.h
      };
      const blocked = this.world.collisionRects.some((wall) => !(
        nextEnemy.x + nextEnemy.w <= wall.x ||
        nextEnemy.x >= wall.x + wall.w ||
        nextEnemy.y + nextEnemy.h <= wall.y ||
        nextEnemy.y >= wall.y + wall.h
      ));
      if (blocked) continue;
      Object.assign(enemy, { x: nextEnemy.x, y: nextEnemy.y });
      this.enemies.push(enemy);
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
    this.inventoryOverlayOpen = true;
    if (this.state === "running") {
      this.state = "paused";
      this.inventoryPausedGame = true;
    } else {
      this.inventoryPausedGame = false;
    }
    return true;
  }

  closeInventoryOverlay() {
    if (!this.inventoryOverlayOpen) return false;
    this.inventoryOverlayOpen = false;
    if (this.inventoryPausedGame && this.state === "paused") {
      this.state = "running";
    }
    this.inventoryPausedGame = false;
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
    this.characterOverlayOpen = true;
    if (this.state === "running") {
      this.state = "paused";
      this.characterPausedGame = true;
    } else {
      this.characterPausedGame = false;
    }
    return true;
  }

  closeCharacterOverlay() {
    if (!this.characterOverlayOpen) return false;
    this.characterOverlayOpen = false;
    if (this.characterPausedGame && this.state === "paused") {
      this.state = "running";
    }
    this.characterPausedGame = false;
    return true;
  }

  toggleCharacterOverlay() {
    if (this.characterOverlayOpen) return this.closeCharacterOverlay();
    return this.openCharacterOverlay();
  }

  addRingToInventory(ringId) {
    const ring = createRingInstance(this.nextRingInstanceId, ringId);
    if (!ring) return null;
    this.nextRingInstanceId += 1;
    this.ringInventory.push(ring);
    return ring;
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
      const ring = this.equippedRings[index];
      if (!ring) continue;
      this.equippedRings[index] = null;
      this.ringInventory.push(ring);
    }
  }

  equipRing(instanceId) {
    const inventoryIndex = this.ringInventory.findIndex((ring) => ring.instanceId === instanceId);
    const slotIndex = this.equippedRings.findIndex((ring, index) => index < this.getAvailableRingSlotCount() && ring == null);
    if (inventoryIndex < 0 || slotIndex < 0) return false;
    const [ring] = this.ringInventory.splice(inventoryIndex, 1);
    this.equippedRings[slotIndex] = ring;
    return true;
  }

  unequipRing(slotIndex) {
    if (slotIndex < 0 || slotIndex >= this.equippedRings.length) return false;
    const ring = this.equippedRings[slotIndex];
    if (!ring) return false;
    this.equippedRings[slotIndex] = null;
    this.ringInventory.push(ring);
    return true;
  }
}
