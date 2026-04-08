import { DEFAULT_HERO_ID, getHeroDef, getHeroList, resolveSelectableHeroId } from "./data/heroes.js";
import { getEnemyDef } from "./data/enemies.js";
import { getAllExtractedSkills } from "./data/extracted-skills.js";
import { getSkillIconDomStyle } from "./data/skill-icons.js";
import { getRingDefById, getRingRarityColor, getRingRarityLabel, getRingUpgradeCost } from "./data/rings.js";
import { getMaterialDefs } from "./data/materials.js";
import { getUndeadEnemyDef } from "./data/undead-enemies.js";
import { getWeaponArtDef } from "./data/weapon-arts.js";
import { RoguelikeGame } from "./game/roguelike-game.js";
import { createCombatState, damageEnemy, tryHeroAttack, updateCombat, updateCombatFeedback } from "./systems/combat.js";
import { getAllEnemyTypeIds, getControllableEnemyTypeIds } from "./systems/enemies.js";
import { buildOpenWorldCosmeticFloor } from "./systems/biome-floor.js";
import { createMovementState } from "./systems/movement.js";
import { getPlayerStat, resetPlayerStats } from "./systems/player-stats.js";
import { renderCombatPreview } from "./render/renderer.js";
import { getAdjustedFingerCraftCost, getStartingFingerCount } from "./systems/fingers.js";
import { getAffinityUiEntries } from "./systems/interactable-affinity.js";
import { initializeRingRuntime } from "./systems/rings.js";
import { getRingItemIconStyle, getSearchableGoldCost } from "./systems/searchables.js";
import { spawnEnemyByType } from "./systems/enemies.js";
import { PLAYABLE_RUN_SKILL_IDS } from "./systems/skills.js";
import { initializeWeaponArtRuntime } from "./systems/weapon-art-runtime.js";
import { renderMenuBackdrop } from "./ui/menu-backdrop.js";
import { applyUiSkinTree, initializeUiAtlas } from "./ui/ui-atlas.js";

const HERO_STORAGE_KEY = "roguelike.hero";
const LOADOUT_HERO_ICON_BY_ID = Object.freeze({
  element_mage: "./assets/UI/UI Sprites/elemental mage.png",
  death_knight: "./assets/UI/UI Sprites/death knight.png",
  dark_mage: "./assets/UI/UI Sprites/dark mage.png",
  knight: "./assets/UI/UI Sprites/knight.png",
  wind_archer: "./assets/UI/UI Sprites/wind archer.png"
});
const LOADOUT_HERO_PREVIEW_ART_BY_ID = Object.freeze({
  dark_mage: "./assets/UI/Dark Mage Selection.png",
  death_knight: "./assets/UI/Death Knight Selection.png",
  element_mage: "./assets/UI/Elemental Mage Selection.png",
  knight: null,
  wind_archer: "./assets/UI/Wind Archer Selection.png"
});

function getInitialHeroId() {
  const params = new URLSearchParams(window.location.search);
  return resolveSelectableHeroId(params.get("hero") || window.localStorage.getItem(HERO_STORAGE_KEY) || DEFAULT_HERO_ID);
}

function updateHeroQuery(heroId) {
  const url = new URL(window.location.href);
  url.searchParams.set("hero", heroId);
  window.history.replaceState({}, "", url);
}

function mountHeroSelector(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;
  const selector = document.createElement("section");
  selector.className = "hero-selector";
  selector.innerHTML = `
    <div class="hero-selector__header">
      <div>
        <p class="hero-selector__eyebrow">Playable Heroes</p>
        <h1 class="hero-selector__title">Choose Your Prototype</h1>
      </div>
      <p class="hero-selector__hint">Query param supported: <code>?hero=dark_mage</code></p>
    </div>
    <div class="hero-selector__grid"></div>
  `;
  panel.insertBefore(selector, canvas);
  const grid = selector.querySelector(".hero-selector__grid");
  const heroes = getHeroList();

  const renderSelection = () => {
    grid.innerHTML = "";
    for (const hero of heroes) {
      const weaponArtName = getWeaponArtDef(hero.defaultWeaponArt)?.name || hero.defaultWeaponArt;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `hero-card${game.heroId === hero.id ? " is-active" : ""}`;
      button.innerHTML = `
        <strong>${hero.name}</strong>
        <small>Default Art: ${weaponArtName}</small>
        <span>${hero.description}</span>
      `;
      button.addEventListener("click", () => {
        window.localStorage.setItem(HERO_STORAGE_KEY, hero.id);
        updateHeroQuery(hero.id);
        game.setHero(hero.id, { restart: game.scene?.id !== "loadout" });
        renderSelection();
        canvas.focus();
      });
      grid.appendChild(button);
    }
  };

  renderSelection();
}

function enemyLabel(typeId) {
  return getUndeadEnemyDef(typeId)?.name || getEnemyDef(typeId)?.name || typeId;
}

function mountStartMenu(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;
  const menu = document.createElement("section");
  menu.className = "start-menu";
  menu.innerHTML = `
    <div class="start-menu__panel">
      <canvas class="start-menu__backdrop" data-role="start-menu-backdrop" aria-hidden="true"></canvas>
      <div class="start-menu__content">
        <div class="start-menu__actions">
          <button type="button" class="start-menu__button" data-role="start-button" data-ui-skin-token="primaryButton" data-ui-skin-mode="button">Start</button>
          <button type="button" class="start-menu__button" data-role="affinity-button" data-ui-skin-token="primaryButton" data-ui-skin-mode="button">Affinity</button>
          <button type="button" class="start-menu__button" data-role="finger-experiment-button" data-ui-skin-token="primaryButton" data-ui-skin-mode="button">Finger Experiment</button>
          <button type="button" class="start-menu__button" data-role="settings-button" data-ui-skin-token="primaryButton" data-ui-skin-mode="button">Settings</button>
        </div>
      </div>
    </div>
  `;
  panel.appendChild(menu);
  applyUiSkinTree(menu);

  const backdropCanvas = menu.querySelector('[data-role="start-menu-backdrop"]');
  const startButton = menu.querySelector('[data-role="start-button"]');
  const affinityButton = menu.querySelector('[data-role="affinity-button"]');
  const settingsButton = menu.querySelector('[data-role="settings-button"]');
  const fingerExperimentButton = menu.querySelector('[data-role="finger-experiment-button"]');
  startButton.addEventListener("click", () => {
    game.showLoadoutScene();
    canvas.focus();
  });
  affinityButton.addEventListener("click", () => {
    game.showAffinityScene();
    canvas.focus();
  });
  fingerExperimentButton.addEventListener("click", () => {
    game.showFingerExperimentScene();
    canvas.focus();
  });
  settingsButton.addEventListener("click", () => {
    game.showSettingsScene();
    canvas.focus();
  });

  let lastOpen = false;
  game.registerUiSync((timestamp = performance.now()) => {
    const open = game.scene?.id === "start-menu";
    if (!open) {
      if (lastOpen) menu.classList.remove("is-visible");
      lastOpen = false;
      return;
    }
    lastOpen = true;
    menu.classList.add("is-visible");
    if (backdropCanvas instanceof HTMLCanvasElement) {
      renderMenuBackdrop(backdropCanvas, game.assets, timestamp / 1000);
    }
  });
}

function mountAffinityScene(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;
  const affinity = document.createElement("section");
  affinity.className = "affinity-scene";
  affinity.innerHTML = `
    <div class="affinity-scene__panel" data-ui-skin-token="secondaryPanel" data-ui-skin-mode="panel">
      <canvas class="affinity-scene__backdrop" data-role="affinity-backdrop" aria-hidden="true"></canvas>
      <div class="affinity-scene__header">
        <div>
          <p class="affinity-scene__eyebrow">Affinity</p>
          <h2 class="affinity-scene__title">Interactable Bonds</h2>
        </div>
        <button type="button" class="affinity-scene__back" data-ui-skin-token="bar_pill_small_gold" data-ui-skin-mode="button">Back</button>
      </div>
      <div class="affinity-scene__body">
        <p class="affinity-scene__hint">Each successful interaction builds affinity. Odd levels improve the interactable reward, while even levels increase how often it appears.</p>
        <div class="affinity-scene__list" data-role="affinity-list"></div>
      </div>
    </div>
  `;
  panel.appendChild(affinity);
  applyUiSkinTree(affinity);

  const backdropCanvas = affinity.querySelector('[data-role="affinity-backdrop"]');
  const list = affinity.querySelector('[data-role="affinity-list"]');
  const backButton = affinity.querySelector(".affinity-scene__back");

  backButton.addEventListener("click", () => {
    game.showStartMenu();
    canvas.focus();
  });

  let lastOpen = false;
  game.registerUiSync((timestamp = performance.now()) => {
    const open = game.scene?.id === "affinity";
    if (!open) {
      if (lastOpen) affinity.classList.remove("is-visible");
      lastOpen = false;
      return;
    }
    lastOpen = true;
    affinity.classList.add("is-visible");
    if (backdropCanvas instanceof HTMLCanvasElement) {
      renderMenuBackdrop(backdropCanvas, game.assets, timestamp / 1000);
    }

    const entries = getAffinityUiEntries();
    list.innerHTML = "";
    for (const entry of entries) {
      const card = document.createElement("article");
      card.className = "affinity-card";
      card.setAttribute("data-ui-skin-token", "blockPanel");
      card.setAttribute("data-ui-skin-mode", "panel");

      const progressPercent = Math.round(entry.progress * 100);
      const progressLabel = entry.xpToNext == null
        ? "Max affinity reached"
        : `${entry.xp} / ${entry.threshold} XP`;
      const nextLevelLabel = entry.xpToNext == null
        ? "Fully bonded"
        : `${entry.xpToNext} interaction${entry.xpToNext === 1 ? "" : "s"} to next level`;

      card.innerHTML = `
        <div class="affinity-card__header">
          <div>
            <p class="affinity-card__eyebrow">${entry.subtitle}</p>
            <h3 class="affinity-card__title">${entry.name}</h3>
          </div>
          <span class="affinity-card__level" data-ui-skin-token="countPill" data-ui-skin-mode="pill">Lv ${entry.level} / ${entry.maxLevel}</span>
        </div>
        <div class="affinity-card__progress">
          <div class="affinity-card__progress-bar">
            <span class="affinity-card__progress-fill" style="width:${progressPercent}%"></span>
          </div>
          <div class="affinity-card__progress-meta">
            <span>${progressLabel}</span>
            <span>${nextLevelLabel}</span>
          </div>
        </div>
        <div class="affinity-card__rewards">
          <p><strong>Odd-level reward:</strong> ${entry.oddLevelBonus}</p>
          <p><strong>Even-level reward:</strong> ${entry.evenLevelBonus}</p>
        </div>
      `;
      list.appendChild(card);
    }
    applyUiSkinTree(list);
  });
}

function mountSettingsScene(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;
  const settings = document.createElement("section");
  settings.className = "settings-scene";
  settings.innerHTML = `
    <div class="settings-scene__panel" data-ui-skin-token="secondaryPanel" data-ui-skin-mode="panel">
      <div class="settings-scene__header">
        <div>
          <p class="settings-scene__eyebrow">Settings</p>
          <h2 class="settings-scene__title">Video</h2>
        </div>
        <button type="button" class="settings-scene__back" data-ui-skin-token="bar_pill_small_gold" data-ui-skin-mode="button">Back</button>
      </div>
      <div class="settings-scene__body">
        <section class="settings-panel" data-ui-skin-token="blockPanel" data-ui-skin-mode="panel">
          <div class="settings-panel__head">
            <h3>Video</h3>
            <span class="settings-panel__value" data-role="resolution-readout" data-ui-skin-token="countPill" data-ui-skin-mode="pill"></span>
          </div>
          <label class="settings-scene__label" for="settings-display-resolution">Display Resolution</label>
          <select id="settings-display-resolution" class="settings-scene__select" data-role="display-resolution-select"></select>
          <label class="settings-scene__label" for="settings-render-resolution">Render Resolution</label>
          <select id="settings-render-resolution" class="settings-scene__select" data-role="render-resolution-select"></select>
          <label class="settings-scene__label" for="settings-camera-zoom">Camera Zoom</label>
          <select id="settings-camera-zoom" class="settings-scene__select" data-role="camera-zoom-select"></select>
          <p class="settings-scene__hint">Display Resolution controls the on-screen canvas size. Render Resolution controls the internal pixel workload, so you can keep a large display size without paying full native rendering cost.</p>
        </section>
        <section class="settings-panel" data-ui-skin-token="blockPanel" data-ui-skin-mode="panel">
          <div class="settings-panel__head">
            <h3>Progress</h3>
          </div>
          <button type="button" class="settings-scene__action" data-role="reset-save-button" data-ui-skin-token="primaryButton" data-ui-skin-mode="button">Reset All Progress</button>
          <p class="settings-scene__hint">This will permanently delete your character progress, including unlocked affinities and crafted fingers. The game will reload once completed.</p>
        </section>
      </div>
    </div>
  `;
  panel.appendChild(settings);
  applyUiSkinTree(settings);

  const backButton = settings.querySelector(".settings-scene__back");
  const displayResolutionSelect = settings.querySelector('[data-role="display-resolution-select"]');
  const renderResolutionSelect = settings.querySelector('[data-role="render-resolution-select"]');
  const resolutionReadout = settings.querySelector('[data-role="resolution-readout"]');
  const cameraZoomSelect = settings.querySelector('[data-role="camera-zoom-select"]');
  const resetSaveButton = settings.querySelector('[data-role="reset-save-button"]');

  for (const option of game.displayResolutionOptions || []) {
    const element = document.createElement("option");
    element.value = `${option.width}x${option.height}`;
    element.textContent = option.label;
    displayResolutionSelect.appendChild(element);
  }
  for (const option of game.renderResolutionOptions || []) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    renderResolutionSelect.appendChild(element);
  }
  for (const option of game.cameraZoomOptions || []) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    cameraZoomSelect.appendChild(element);
  }

  backButton.addEventListener("click", () => {
    game.showStartMenu();
    canvas.focus();
  });

  displayResolutionSelect.addEventListener("change", () => {
    game.setDisplayResolution(displayResolutionSelect.value);
    canvas.focus();
  });
  renderResolutionSelect.addEventListener("change", () => {
    game.setRenderResolution(renderResolutionSelect.value);
    canvas.focus();
  });
  cameraZoomSelect.addEventListener("change", () => {
    game.setCameraZoom(cameraZoomSelect.value);
    canvas.focus();
  });

  resetSaveButton.addEventListener("click", () => {
    if (confirm("Are you sure you want to reset all progress? This cannot be undone.")) {
      const keysToClear = [
        "roguelike.hero",
        "roguelike.interactableAffinity",
        "roguelike.fingerExperiment",
        "roguelike.enemyMovementPatterns"
      ];
      for (const key of keysToClear) {
        window.localStorage.removeItem(key);
      }
      window.location.reload();
    }
  });

  let lastOpen = false;
  let lastResolutionVersion = -1;
  game.registerUiSync(() => {
    const open = game.scene?.id === "settings";
    if (!open) {
      if (lastOpen) settings.classList.remove("is-visible");
      lastOpen = false;
      return;
    }
    lastOpen = true;
    settings.classList.add("is-visible");
    const resolutionVersion = game.getUiVersion("resolution");
    if (resolutionVersion === lastResolutionVersion) return;
    lastResolutionVersion = resolutionVersion;
    const currentDisplayValue = game.getDisplayResolutionValue();
    const currentRenderValue = game.getRenderResolutionValue();
    const currentZoom = game.getCameraZoomValue();
    if (displayResolutionSelect.value !== currentDisplayValue) {
      displayResolutionSelect.value = currentDisplayValue;
    }
    if (renderResolutionSelect.value !== currentRenderValue) {
      renderResolutionSelect.value = currentRenderValue;
    }
    if (cameraZoomSelect.value !== currentZoom) {
      cameraZoomSelect.value = currentZoom;
    }
    const displayLabel = displayResolutionSelect.selectedOptions[0]?.textContent || currentDisplayValue;
    const renderLabel = renderResolutionSelect.selectedOptions[0]?.textContent || currentRenderValue;
    const zoomLabel = cameraZoomSelect.selectedOptions[0]?.textContent || currentZoom;
    resolutionReadout.textContent = `${displayLabel} / ${renderLabel} / ${zoomLabel}`;
  });
}

function mountPauseDebugSpawner(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;
  const spawner = document.createElement("section");
  spawner.className = "pause-debug";
  spawner.innerHTML = `
    <div class="pause-debug__title">Pause Debug Spawn</div>
    <label class="pause-debug__label" for="pause-debug-enemy">Enemy</label>
    <select id="pause-debug-enemy" class="pause-debug__select"></select>
    <button type="button" class="pause-debug__button">Spawn Near Player</button>
    <p class="pause-debug__hint">Only available while paused.</p>
  `;
  panel.appendChild(spawner);

  const select = spawner.querySelector(".pause-debug__select");
  const button = spawner.querySelector(".pause-debug__button");
  const ids = getAllEnemyTypeIds()
    .sort((a, b) => enemyLabel(a).localeCompare(enemyLabel(b)))
    .map((id) => ({ id, label: enemyLabel(id) }));

  for (const entry of ids) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = `${entry.label} (${entry.id})`;
    select.appendChild(option);
  }

  button.addEventListener("click", () => {
    if (game.state !== "paused") return;
    game.spawnEnemyNearPlayer(select.value);
    canvas.focus();
  });

  let lastVisible = false;
  game.registerUiSync(() => {
    const visible = game.state === "paused";
    if (visible === lastVisible) return;
    lastVisible = visible;
    spawner.classList.toggle("is-visible", visible);
  });
}

const LOADOUT_DEMO_CANVAS_SIZE = Object.freeze({ width: 320, height: 360 });
const LOADOUT_DEMO_WORLD = Object.freeze({ width: 420, height: 360 });
const LOADOUT_DEMO_HERO_POSITION = Object.freeze({ x: 112, y: 186 });
const LOADOUT_DEMO_DUMMY_POSITION = Object.freeze({ x: 188, y: 148 });
const LOADOUT_DEMO_DUMMY_RESTORE_INTERVAL = 2;
const LOADOUT_DEMO_TILE_SIZE = 32;

function createLoadoutDemoWorld(assets) {
  const cols = Math.max(1, Math.ceil(LOADOUT_DEMO_WORLD.width / LOADOUT_DEMO_TILE_SIZE));
  const rows = Math.max(1, Math.ceil(LOADOUT_DEMO_WORLD.height / LOADOUT_DEMO_TILE_SIZE));
  const archetypeGrid = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => "openSpace"));
  const playableMacroRects = [];
  const cellW = LOADOUT_DEMO_WORLD.width / 4;
  const cellH = LOADOUT_DEMO_WORLD.height / 4;
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      playableMacroRects.push({
        x: col * cellW,
        y: row * cellH,
        w: cellW,
        h: cellH
      });
    }
  }
  const world = {
    tileSize: LOADOUT_DEMO_TILE_SIZE,
    cols,
    rows,
    width: LOADOUT_DEMO_WORLD.width,
    height: LOADOUT_DEMO_WORLD.height,
    grid: Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0)),
    archetypeGrid: { grid: archetypeGrid },
    playableMacroRects,
    blockerChunkSpaces: [],
    upperCliff: null
  };
  world.cosmeticFloor = buildOpenWorldCosmeticFloor(world, 0x4c6f6164, assets, "grassA");
  return world;
}

function createLoadoutDemoRuntime() {
  return {
    heroId: null,
    lastTimestamp: 0,
    restoreTimer: LOADOUT_DEMO_DUMMY_RESTORE_INTERVAL,
    sandbox: null
  };
}

function resetLoadoutDemoRuntime(rootGame, runtime, previewCanvas, heroId) {
  runtime.heroId = heroId;
  runtime.restoreTimer = LOADOUT_DEMO_DUMMY_RESTORE_INTERVAL;
  runtime.sandbox = createLoadoutDemoSandbox(rootGame, heroId, previewCanvas);
  return runtime.sandbox;
}

function createLoadoutDemoInput(aimRef) {
  return {
    mouse: { clicked: false, rightClicked: false },
    wasPressed() {
      return false;
    },
    getAimWorld() {
      return { x: aimRef.x, y: aimRef.y };
    }
  };
}

function createLoadoutDemoSandbox(rootGame, heroId, previewCanvas) {
  const heroDef = getHeroDef(resolveSelectableHeroId(heroId || DEFAULT_HERO_ID));
  if (!heroDef || !(previewCanvas instanceof HTMLCanvasElement)) return null;

  const aimRef = {
    x: LOADOUT_DEMO_DUMMY_POSITION.x + 40,
    y: LOADOUT_DEMO_DUMMY_POSITION.y + 40
  };
  const sandbox = {
    isLoadoutPreview: true,
    canvas: previewCanvas,
    assets: rootGame.assets,
    heroDef,
    heroId: heroDef.id,
    weaponArt: rootGame.createWeaponArtLoadout(heroDef.defaultWeaponArt),
    input: createLoadoutDemoInput(aimRef),
    camera: {
      x: 0,
      y: 0,
      viewWidth: previewCanvas.width,
      viewHeight: previewCanvas.height
    },
    world: {
      ...createLoadoutDemoWorld(rootGame.assets),
      collisionRects: []
    },
    enemies: [],
    breakables: [],
    goldDrops: [],
    xpDrops: [],
    materialDrops: [],
    ringDrops: [],
    searchables: [],
    selectedRunSkills: [],
    runSkills: [],
    materialInventory: Object.create(null),
    ringInventory: { owned: Object.create(null), essence: 0 },
    equippedRings: Array.from({ length: 20 }, () => null),
    nextRingInstanceId: 1,
    inventoryOverlayOpen: false,
    inventoryPausedGame: false,
    roomCleared: false,
    kills: 0,
    roomKills: 0,
    gold: 0,
    time: 0,
    state: "running",
    roomIndex: 0,
    maxRooms: 1,
    inkFlashTimer: 0,
    player: {
      x: LOADOUT_DEMO_HERO_POSITION.x,
      y: LOADOUT_DEMO_HERO_POSITION.y,
      w: 36,
      h: 36,
      hp: heroDef.maxHp,
      maxHp: heroDef.maxHp,
      level: 1,
      xp: 0,
      xpToNext: 10,
      stats: null,
      facing: "down",
      animClock: 0,
      isMoving: false,
      movement: createMovementState(heroDef),
      dashAfterimages: [],
      dashFlash: null,
      dashVisualSnapshot: null,
      hitTimer: 0,
      hitDuration: 0.34,
      damageBonus: 0,
      damageBonusTimer: 0,
      curseTimer: 0,
      curseTickTimer: 0,
      poisonTimer: 0,
      poisonTickTimer: 0,
      poisonDps: 0,
      damageShield: 0,
      isInvisible: false,
      enemySlowTimer: 0,
      enemySlowMult: 1,
      stunTimer: 0,
      numberOfFingers: 2
    }
  };
  resetPlayerStats(sandbox.player, heroDef);
  sandbox.combat = createCombatState([]);
  initializeWeaponArtRuntime(sandbox);
  initializeRingRuntime(sandbox);
  sandbox.damageEnemy = (enemy, amount, meta = {}) => damageEnemy(sandbox, enemy, amount, meta);
  sandbox.demoAim = aimRef;

  const dummy = spawnEnemyByType("m_bar_ogre_1", LOADOUT_DEMO_DUMMY_POSITION.x, LOADOUT_DEMO_DUMMY_POSITION.y, {
    currentHp: 100,
    assets: sandbox.assets
  });
  if (dummy) {
    dummy.maxHp = 100;
    dummy.hp = 100;
    dummy.attackRuntime = {
      state: "idle",
      currentAttack: null,
      buffs: {}
    };
    dummy.cooldown = 9999;
    dummy.direction = "left";
    dummy.facing = -1;
    dummy.render = { sheetKey: "idle", frame: 0 };
    dummy.affixes = [];
    dummy.affixState = {};
    sandbox.enemies.push(dummy);
    aimRef.x = dummy.x + dummy.w * 0.5;
    aimRef.y = dummy.y + dummy.h * 0.5;
  }
  sandbox.demoDummy = dummy || null;
  return sandbox;
}

function updateLoadoutDemoSandbox(rootGame, runtime, previewCanvas, heroId, dt) {
  if (!(previewCanvas instanceof HTMLCanvasElement)) return null;
  if (!runtime.sandbox || runtime.heroId !== heroId) {
    return resetLoadoutDemoRuntime(rootGame, runtime, previewCanvas, heroId);
  }
  const sandbox = runtime.sandbox;
  if (!sandbox) return null;

  sandbox.canvas = previewCanvas;
  sandbox.camera.viewWidth = previewCanvas.width;
  sandbox.camera.viewHeight = previewCanvas.height;
  sandbox.time += dt;
  sandbox.player.animClock += dt;
  sandbox.player.hitTimer = Math.max(0, sandbox.player.hitTimer - dt);
  sandbox.input.mouse.clicked = false;
  sandbox.input.mouse.rightClicked = false;

  const dummy = sandbox.demoDummy;
  if (dummy) {
    dummy.animClock += dt;
    dummy.render.sheetKey = "idle";
    dummy.render.frame = Math.floor(dummy.animClock * (dummy.sprite.idle?.fps || 8)) % Math.max(1, dummy.sprite.idle?.frames || 1);
    sandbox.demoAim.x = dummy.x + dummy.w * 0.5;
    sandbox.demoAim.y = dummy.y + dummy.h * 0.5;
  }

  updateCombat(sandbox, dt);
  updateCombatFeedback(sandbox, dt);

  if (dummy && (dummy.dead || dummy.hp <= 0)) {
    return resetLoadoutDemoRuntime(rootGame, runtime, previewCanvas, heroId);
  }

  runtime.restoreTimer = Math.max(0, runtime.restoreTimer - dt);
  if (dummy && runtime.restoreTimer <= 0) {
    dummy.maxHp = 100;
    dummy.hp = 100;
    dummy.dead = false;
    dummy.render.sheetKey = "idle";
    if (dummy.attackRuntime) {
      dummy.attackRuntime.state = "idle";
      dummy.attackRuntime.currentAttack = null;
      dummy.attackRuntime.buffs = {};
    }
    runtime.restoreTimer = LOADOUT_DEMO_DUMMY_RESTORE_INTERVAL;
  }

  tryHeroAttack(sandbox);
  return sandbox;
}

function mountLoadoutScene(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;
  const loadout = document.createElement("section");
  loadout.className = "loadout-scene";
  loadout.innerHTML = `
    <div class="loadout-scene__panel" data-ui-skin-token="secondaryPanel" data-ui-skin-mode="panel">
      <canvas class="loadout-scene__backdrop" data-role="loadout-backdrop" aria-hidden="true"></canvas>
      <div class="loadout-scene__header">
        <div>
          <h2 class="loadout-scene__title">Choose Hero And Skills</h2>
        </div>
        <button type="button" class="loadout-scene__enemy-test" data-ui-skin-token="bar_pill_small_gold" data-ui-skin-mode="button">Enemy Test Room</button>
      </div>
      <div class="loadout-scene__body">
        <div class="loadout-scene__content">
          <div class="loadout-scene__selection">
            <section class="loadout-block" data-ui-skin-token="blockPanel" data-ui-skin-mode="panel">
              <div class="loadout-block__head">
                <h3>Hero</h3>
              </div>
              <div class="loadout-hero-grid" data-role="hero-grid"></div>
            </section>
            <section class="loadout-block" data-ui-skin-token="blockPanel" data-ui-skin-mode="panel">
              <div class="loadout-block__head">
                <h3>Skills</h3>
                <span class="loadout-block__count" data-role="skill-count" data-ui-skin-token="countPill" data-ui-skin-mode="pill"></span>
              </div>
              <div class="loadout-skill-slots" data-role="skill-slots"></div>
            </section>
          </div>
          <aside class="loadout-preview" data-ui-skin-token="secondaryPanel" data-ui-skin-mode="panel">
            <div class="loadout-preview__art" data-role="preview-art" aria-hidden="true"></div>
            <div class="loadout-preview__head">
              <p class="loadout-scene__eyebrow">Hero Preview</p>
              <h3 class="loadout-preview__title" data-role="preview-name">No Hero Selected</h3>
              <p class="loadout-preview__weapon" data-role="preview-weapon-name">Weapon Art</p>
              <p class="loadout-preview__description" data-role="preview-weapon-description">Select a hero to inspect their combat style.</p>
              <div class="loadout-preview__hp">
                <div class="loadout-preview__hp-bar" data-ui-skin-token="hpTrack" data-ui-skin-mode="bar">
                  <div class="loadout-preview__hp-fill" data-role="preview-dummy-hp-fill"></div>
                  <span class="loadout-preview__dummy-hp" data-role="preview-dummy-hp">Dummy HP 100 / 100</span>
                </div>
              </div>
            </div>
            <div class="loadout-preview__frame" data-ui-skin-token="secondaryPanel" data-ui-skin-mode="panel">
              <canvas
                class="loadout-preview__canvas"
                data-role="preview-canvas"
                width="${LOADOUT_DEMO_CANVAS_SIZE.width}"
                height="${LOADOUT_DEMO_CANVAS_SIZE.height}"
              ></canvas>
            </div>
          </aside>
        </div>
      </div>
      <div class="loadout-scene__footer">
        <button type="button" class="loadout-scene__start" data-ui-skin-token="primaryButton" data-ui-skin-mode="button">Launch Run</button>
      </div>
      <div class="loadout-skill-picker" data-role="skill-picker" hidden>
        <div class="loadout-skill-picker__backdrop" data-role="skill-picker-close"></div>
        <div class="loadout-skill-picker__panel" data-ui-skin-token="secondaryPanel" data-ui-skin-mode="panel">
          <div class="loadout-skill-picker__head">
            <div>
              <p class="loadout-scene__eyebrow">Skill Picker</p>
              <h3 class="loadout-skill-picker__title">Choose Skill</h3>
            </div>
            <button type="button" class="loadout-skill-picker__close" data-role="skill-picker-close" data-ui-skin-token="bar_pill_small_gold" data-ui-skin-mode="button">Close</button>
          </div>
          <div class="loadout-skill-picker__grid" data-role="skill-picker-grid"></div>
        </div>
      </div>
    </div>
  `;
  panel.appendChild(loadout);
  applyUiSkinTree(loadout);

  const heroGrid = loadout.querySelector('[data-role="hero-grid"]');
  const skillCount = loadout.querySelector('[data-role="skill-count"]');
  const skillSlots = loadout.querySelector('[data-role="skill-slots"]');
  const skillPicker = loadout.querySelector('[data-role="skill-picker"]');
  const skillPickerGrid = loadout.querySelector('[data-role="skill-picker-grid"]');
  const previewName = loadout.querySelector('[data-role="preview-name"]');
  const previewWeaponName = loadout.querySelector('[data-role="preview-weapon-name"]');
  const previewWeaponDescription = loadout.querySelector('[data-role="preview-weapon-description"]');
  const previewArt = loadout.querySelector('[data-role="preview-art"]');
  const previewDummyHp = loadout.querySelector('[data-role="preview-dummy-hp"]');
  const previewDummyHpFill = loadout.querySelector('[data-role="preview-dummy-hp-fill"]');
  const previewCanvas = loadout.querySelector('[data-role="preview-canvas"]');
  const backdropCanvas = loadout.querySelector('[data-role="loadout-backdrop"]');
  const enemyTestButton = loadout.querySelector(".loadout-scene__enemy-test");
  const startButton = loadout.querySelector(".loadout-scene__start");
  const heroes = getHeroList();
  const skills = getAllExtractedSkills().filter((skill) => PLAYABLE_RUN_SKILL_IDS.includes(skill.id));
  const previewRuntime = createLoadoutDemoRuntime();
  let activeSkillSlot = null;
  let lastOpen = false;
  let lastLoadoutVersion = -1;
  let lastActiveSkillSlot = null;

  function setSkillPickerOpen(slotIndex = null) {
    activeSkillSlot = Number.isInteger(slotIndex) ? slotIndex : null;
    if (skillPicker instanceof HTMLElement) {
      skillPicker.hidden = activeSkillSlot == null;
      skillPicker.classList.toggle("is-visible", activeSkillSlot != null);
    }
  }

  function createSkillCardMarkup(skill, icon) {
    const iconMarkup = icon
      ? `<span class="loadout-skill-card__icon" aria-hidden="true"><img class="loadout-skill-card__icon-image" src="${icon.src}" style="width:${icon.width}px;height:${icon.height}px;margin-left:${icon.marginLeft}px;margin-top:${icon.marginTop}px;" alt=""></span>`
      : `<span class="loadout-skill-card__icon" aria-hidden="true"></span>`;
    return `
      <span class="loadout-skill-card__top">
        ${iconMarkup}
        <strong>${skill.name}</strong>
      </span>
      <small>${skill.category} | ${skill.baseCd}s</small>
      <span>${skill.desc}</span>
    `;
  }

  enemyTestButton.addEventListener("click", () => {
    game.showEnemyTestScene();
    canvas.focus();
  });

  startButton.addEventListener("click", () => {
    if (game.startRunWithLoadout()) canvas.focus();
  });

  loadout.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const heroButton = target.closest("[data-loadout-hero]");
    if (heroButton instanceof HTMLElement) {
      game.setLoadoutHero(heroButton.dataset.loadoutHero);
      canvas.focus();
      return;
    }
    const skillButton = target.closest("[data-loadout-skill]");
    if (skillButton instanceof HTMLElement) {
      game.toggleLoadoutSkill(skillButton.dataset.loadoutSkill);
      canvas.focus();
      return;
    }
    const skillSlot = target.closest("[data-loadout-skill-slot]");
    if (skillSlot instanceof HTMLElement) {
      setSkillPickerOpen(Number(skillSlot.dataset.loadoutSkillSlot));
      canvas.focus();
      return;
    }
    const skillPick = target.closest("[data-loadout-skill-pick]");
    if (skillPick instanceof HTMLElement && activeSkillSlot != null) {
      game.setLoadoutSkillAt(activeSkillSlot, skillPick.dataset.loadoutSkillPick);
      setSkillPickerOpen(null);
      canvas.focus();
      return;
    }
    const skillClear = target.closest("[data-loadout-skill-clear]");
    if (skillClear instanceof HTMLElement) {
      game.clearLoadoutSkillAt(Number(skillClear.dataset.loadoutSkillClear));
      canvas.focus();
      return;
    }
    const pickerClose = target.closest("[data-role='skill-picker-close']");
    if (pickerClose instanceof HTMLElement) {
      setSkillPickerOpen(null);
      canvas.focus();
    }
  });

  game.registerUiSync((timestamp = performance.now()) => {
    const open = game.scene?.id === "loadout";
    if (!open) {
      if (lastOpen) loadout.classList.remove("is-visible");
      lastOpen = false;
      previewRuntime.lastTimestamp = 0;
      previewRuntime.heroId = null;
      previewRuntime.sandbox = null;
      previewRuntime.restoreTimer = LOADOUT_DEMO_DUMMY_RESTORE_INTERVAL;
      return;
    }
    lastOpen = true;
    loadout.classList.add("is-visible");
    const previewPaused = activeSkillSlot != null;
    const dt = previewPaused || !previewRuntime.lastTimestamp
      ? 0
      : Math.min(0.05, (timestamp - previewRuntime.lastTimestamp) / 1000);
    previewRuntime.lastTimestamp = timestamp;
    if (backdropCanvas instanceof HTMLCanvasElement) {
      renderMenuBackdrop(backdropCanvas, game.assets, timestamp / 1000);
    }
    const loadoutVersion = game.getUiVersion("loadout");
    if (loadoutVersion !== lastLoadoutVersion || lastActiveSkillSlot !== activeSkillSlot) {
      lastLoadoutVersion = loadoutVersion;
      lastActiveSkillSlot = activeSkillSlot;
      const selectedHero = game.loadoutDraft?.heroId || game.heroId;
      const selectedSkills = game.loadoutDraft?.skillIds || [];
      const selectedHeroDef = heroes.find((hero) => hero.id === selectedHero) || null;
      const selectedWeaponArt = selectedHeroDef ? getWeaponArtDef(selectedHeroDef.defaultWeaponArt) : null;
      skillCount.textContent = `${selectedSkills.length}/3 selected`;
      startButton.disabled = selectedSkills.length !== 3;
      previewName.textContent = selectedHeroDef?.name || "No Hero Selected";
      previewWeaponName.textContent = selectedHeroDef
        ? selectedWeaponArt?.name || selectedHeroDef.defaultWeaponArt
        : "Weapon Art";
      previewWeaponDescription.textContent = selectedHeroDef
        ? selectedWeaponArt?.description || "No weapon art description available."
        : "Select a hero to inspect their combat style.";
      previewDummyHp.textContent = "Dummy HP 100 / 100";
      if (previewArt instanceof HTMLElement) {
        const previewArtSrc = selectedHero ? LOADOUT_HERO_PREVIEW_ART_BY_ID[selectedHero] || null : null;
        previewArt.style.backgroundImage = previewArtSrc ? `url("${previewArtSrc}")` : "none";
        previewArt.classList.toggle("is-visible", Boolean(previewArtSrc));
      }

      if (previewRuntime.heroId !== selectedHero) {
        previewRuntime.heroId = null;
        previewRuntime.sandbox = null;
      }

      heroGrid.innerHTML = "";
      for (const hero of heroes) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `loadout-hero-card${selectedHero === hero.id ? " is-active" : ""}`;
        button.setAttribute("data-ui-skin-token", selectedHero === hero.id ? "panel_fancy_dark_empty" : "progress_bar_fill_dark");
        button.setAttribute("data-ui-skin-mode", "card");
        button.dataset.loadoutHero = hero.id;
        const iconSrc = LOADOUT_HERO_ICON_BY_ID[hero.id];
        button.innerHTML = `
          <img class="loadout-hero-card__icon" src="${iconSrc}" alt="${hero.name}">
        `;
        heroGrid.appendChild(button);
      }

      if (skillSlots instanceof HTMLElement) {
        skillSlots.innerHTML = "";
        for (let slotIndex = 0; slotIndex < 3; slotIndex += 1) {
          const skillId = selectedSkills[slotIndex] || null;
          const skill = skills.find((entry) => entry.id === skillId) || null;
          const button = document.createElement("button");
          button.type = "button";
          button.className = `loadout-skill-slot${skill ? " is-filled" : ""}`;
          button.setAttribute("data-ui-skin-token", "panel_rounded_navy_small");
          button.setAttribute("data-ui-skin-mode", "slot");
          button.dataset.loadoutSkillSlot = String(slotIndex);
          if (skill) {
            const icon = getSkillIconDomStyle(game.assets, skill.id);
            button.innerHTML = `
              <span class="loadout-skill-slot__index">Slot ${slotIndex + 1}</span>
              ${createSkillCardMarkup(skill, icon)}
              <span class="loadout-skill-slot__actions">
                <span class="loadout-skill-slot__replace">Replace</span>
                <span class="loadout-skill-slot__clear" data-loadout-skill-clear="${slotIndex}">Remove</span>
              </span>
            `;
          } else {
            button.innerHTML = `
              <span class="loadout-skill-slot__index">Slot ${slotIndex + 1}</span>
              <strong>Empty Skill Slot</strong>
              <span>Click to choose a skill for this slot.</span>
            `;
          }
          skillSlots.appendChild(button);
        }
      }

      if (skillPickerGrid instanceof HTMLElement) {
        skillPickerGrid.innerHTML = "";
        for (const skill of skills) {
          const selected = selectedSkills.includes(skill.id);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `loadout-skill-card${selected ? " is-active" : ""}`;
        button.setAttribute("data-ui-skin-token", selected ? "cardActive" : "card");
        button.setAttribute("data-ui-skin-mode", "card");
        button.dataset.loadoutSkillPick = skill.id;
        const icon = getSkillIconDomStyle(game.assets, skill.id);
          button.innerHTML = createSkillCardMarkup(skill, icon);
          skillPickerGrid.appendChild(button);
        }
      }
      applyUiSkinTree(loadout);
    }

    const previewHeroId = game.loadoutDraft?.heroId || game.heroId || null;
    const sandbox = previewPaused
      ? previewRuntime.sandbox
      : updateLoadoutDemoSandbox(game, previewRuntime, previewCanvas, previewHeroId, dt);
    if (sandbox && previewCanvas instanceof HTMLCanvasElement && !previewPaused) {
      const previewCtx = previewCanvas.getContext("2d");
      if (previewCtx) renderCombatPreview(previewCtx, sandbox);
      const dummy = sandbox.demoDummy;
      const hpRatio = dummy?.maxHp > 0 ? Math.max(0, Math.min(1, dummy.hp / dummy.maxHp)) : 0;
      previewDummyHpFill?.style.setProperty("--hp-ratio", `${hpRatio}`);
      previewDummyHp.textContent = dummy
        ? `Dummy HP ${Math.max(0, Math.ceil(dummy.hp))} / ${dummy.maxHp}`
        : "Dummy HP -- / --";
    }
  });
}

function mountEnemyTestScene(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;
  const tacticOptions = [
    { id: "feint_entry", label: "Feint Entry" },
    { id: "drift_noise", label: "Noisy Advance" },
    { id: "cooldown_kite", label: "Cooldown Kite" },
    { id: "retreat_reset", label: "Retreat Reset" },
    { id: "strafe_pressure", label: "Strafe Pressure" }
  ];
  const room = document.createElement("section");
  room.className = "enemy-test-scene";
  room.innerHTML = `
    <button type="button" class="enemy-test-scene__toggle enemy-test-scene__toggle--dock">Enemy Test UI</button>
    <div class="enemy-test-scene__panel">
      <div class="enemy-test-scene__header">
        <div>
          <p class="enemy-test-scene__eyebrow">Enemy Test Room</p>
          <h2 class="enemy-test-scene__title">Manual Enemy Sandbox</h2>
        </div>
        <div class="enemy-test-scene__header-actions">
          <button type="button" class="enemy-test-scene__toggle">Hide UI</button>
          <button type="button" class="enemy-test-scene__back">Back</button>
        </div>
      </div>
      <div class="enemy-test-scene__controls">
        <label class="enemy-test-scene__label" for="enemy-test-select">Controlled Enemy</label>
        <select id="enemy-test-select" class="enemy-test-scene__select"></select>
      </div>
      <div class="enemy-test-scene__controls">
        <div class="enemy-test-scene__mapping-head">
          <h3>Movement Recorder</h3>
          <span data-role="movement-status"></span>
        </div>
        <label class="enemy-test-scene__label" for="enemy-test-tactic">Recorded Tactic</label>
        <select id="enemy-test-tactic" class="enemy-test-scene__select"></select>
        <div class="enemy-test-scene__recorder-actions">
          <button type="button" class="enemy-test-scene__action" data-record-action="start">Start Recording</button>
          <button type="button" class="enemy-test-scene__action" data-record-action="stop">Stop And Save</button>
        </div>
        <p class="enemy-test-scene__hint">Records your WASD or arrow movement in the test room, drops the first 2 seconds and last 2 seconds, then saves the remaining pattern as reference data for tactic tuning.</p>
      </div>
      <div class="enemy-test-scene__mapping">
        <div class="enemy-test-scene__mapping-head">
          <h3>Attack Mapping</h3>
          <span data-role="enemy-name"></span>
        </div>
        <div class="enemy-test-scene__attack-list" data-role="attack-list"></div>
      </div>
      <p class="enemy-test-scene__hint">Move with WASD or arrows, aim with mouse, use keys 1-0 to trigger the selected enemy's attack list in order.</p>
    </div>
  `;
  panel.appendChild(room);

  const select = room.querySelector(".enemy-test-scene__select");
  const backButton = room.querySelector(".enemy-test-scene__back");
  const toggleButtons = room.querySelectorAll(".enemy-test-scene__toggle");
  const contentPanel = room.querySelector(".enemy-test-scene__panel");
  const tacticSelect = room.querySelector("#enemy-test-tactic");
  const recordButtons = room.querySelectorAll("[data-record-action]");
  const movementStatus = room.querySelector('[data-role="movement-status"]');
  const attackList = room.querySelector('[data-role="attack-list"]');
  const enemyName = room.querySelector('[data-role="enemy-name"]');
  const ids = getControllableEnemyTypeIds()
    .sort((a, b) => enemyLabel(a).localeCompare(enemyLabel(b)))
    .map((id) => ({ id, label: enemyLabel(id) }));

  for (const entry of ids) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = `${entry.label} (${entry.id})`;
    select.appendChild(option);
  }

  for (const tactic of tacticOptions) {
    const option = document.createElement("option");
    option.value = tactic.id;
    option.textContent = tactic.label;
    tacticSelect.appendChild(option);
  }

  select.addEventListener("change", () => {
    game.setEnemyTestEnemy(select.value);
    canvas.focus();
  });

  tacticSelect.addEventListener("change", () => {
    game.setEnemyTestRecordingTactic(tacticSelect.value);
    canvas.focus();
  });

  backButton.addEventListener("click", () => {
    game.showStartMenu();
    canvas.focus();
  });

  toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      game.toggleEnemyTestUi();
      canvas.focus();
    });
  });

  recordButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-record-action");
      if (action === "start") game.startEnemyTestMovementRecording();
      if (action === "stop") game.stopEnemyTestMovementRecording();
      canvas.focus();
    });
  });

  let lastOpen = false;
  let lastEnemyTestVersion = -1;
  let lastEnemyStatus = "";
  let lastAttackSignature = "";
  game.registerUiSync(() => {
    const open = game.scene?.id === "enemy-test";
    if (!open) {
      if (lastOpen) room.classList.remove("is-visible");
      lastOpen = false;
      return;
    }
    lastOpen = true;
    room.classList.add("is-visible");
    const uiOpen = game.enemyTest?.uiOpen !== false;
    contentPanel.classList.toggle("is-hidden", !uiOpen);
    room.classList.toggle("is-collapsed", !uiOpen);
    const enemyTestVersion = game.getUiVersion("enemyTest");
    if (enemyTestVersion !== lastEnemyTestVersion) {
      lastEnemyTestVersion = enemyTestVersion;
      if (select.value !== (game.enemyTest?.selectedTypeId || "")) {
        select.value = game.enemyTest?.selectedTypeId || ids[0]?.id || "";
      }
      if (tacticSelect.value !== (game.enemyTest?.selectedTactic || "")) {
        tacticSelect.value = game.enemyTest?.selectedTactic || tacticOptions[0].id;
      }
    }

    const enemy = game.enemyTest?.controlledEnemy || null;
    const runtime = enemy?.attackRuntime || null;
    const recorder = game.enemyTest?.movementRecorder || null;
    const persistStatus = game.enemyTest?.lastPersistStatus || null;
    const nextEnemyName = enemy?.name || "No enemy";
    if (enemyName.textContent !== nextEnemyName) enemyName.textContent = nextEnemyName;

    let nextMovementStatus = "Idle";
    if (recorder?.isRecording) {
      nextMovementStatus = `Recording ${recorder.elapsed.toFixed(1)}s ${game.enemyTest?.selectedTactic || ""}`;
    } else if (recorder?.savedPattern) {
      nextMovementStatus =
        `Saved reference ${recorder.savedPattern.tacticId || ""} ${recorder.savedPattern.steps.length} steps / ${recorder.savedPattern.totalDuration.toFixed(1)}s`;
    }
    if (persistStatus) nextMovementStatus = `${nextMovementStatus} | ${persistStatus.message}`;
    if (movementStatus && nextMovementStatus !== lastEnemyStatus) {
      movementStatus.textContent = nextMovementStatus;
      lastEnemyStatus = nextMovementStatus;
    }

    recordButtons.forEach((button) => {
      const action = button.getAttribute("data-record-action");
      if (action === "start") button.disabled = !!recorder?.isRecording;
      if (action === "stop") button.disabled = !recorder?.isRecording;
    });

    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    const nextAttackSignature = keys
      .map((key, index) => {
        const attack = enemy?.attacks?.[index] || null;
        const cooldown = attack ? (runtime?.cooldowns?.[attack.id] ?? 0) : 0;
        const active = attack && runtime?.currentAttack?.id === attack.id && runtime?.state !== "recover";
        const state = attack ? (active ? runtime.state : cooldown > 0 ? `${cooldown.toFixed(1)}s` : "Ready") : "--";
        return `${key}:${attack?.id || "Empty"}:${state}`;
      })
      .join("|");
    if (nextAttackSignature !== lastAttackSignature) {
      lastAttackSignature = nextAttackSignature;
      attackList.innerHTML = "";
      keys.forEach((key, index) => {
        const attack = enemy?.attacks?.[index] || null;
        const row = document.createElement("div");
        row.className = "enemy-test-scene__attack-row";
        const cooldown = attack ? (runtime?.cooldowns?.[attack.id] ?? 0) : 0;
        const active = attack && runtime?.currentAttack?.id === attack.id && runtime?.state !== "recover";
        row.innerHTML = `
          <span class="enemy-test-scene__attack-key">${key}</span>
          <span class="enemy-test-scene__attack-name">${attack?.id || "Empty"}</span>
          <span class="enemy-test-scene__attack-state">${attack ? (active ? runtime.state : cooldown > 0 ? `${cooldown.toFixed(1)}s` : "Ready") : "--"}</span>
        `;
        attackList.appendChild(row);
      });
    }
  });
}

function createRingIconHtml(ringDef, size = 22) {
  const style = getRingItemIconStyle(ringDef, size);
  return `<span class="ring-icon" style="${Object.entries(style)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}:${value}`)
    .join(";")}"></span>`;
}

function createMaterialIconHtml(materialDef, size = 22) {
  if (!materialDef?.iconSrc) return "";
  return `<img class="material-icon" src="${materialDef.iconSrc}" alt="" width="${size}" height="${size}">`;
}

const RING_SLOT_REFERENCE_SIZE = Object.freeze({ width: 1024, height: 683 });
const RING_HAND_BACKGROUND_BY_FINGERS = Object.freeze({
  0: "./assets/UI/UI Sprites/Ring Hands/0 finger.png",
  1: "./assets/UI/UI Sprites/Ring Hands/1 finger.png",
  2: "./assets/UI/UI Sprites/Ring Hands/2 fingers.png",
  3: "./assets/UI/UI Sprites/Ring Hands/3 fingers.png",
  4: "./assets/UI/UI Sprites/Ring Hands/4 fingers.png",
  5: "./assets/UI/UI Sprites/Ring Hands/5 fingers.png",
  6: "./assets/UI/UI Sprites/Ring Hands/6 fingers.png",
  7: "./assets/UI/UI Sprites/Ring Hands/7 fingers.png",
  8: "./assets/UI/UI Sprites/Ring Hands/8 fingers.png",
  9: "./assets/UI/UI Sprites/Ring Hands/9 fingers.png",
  10: "./assets/UI/UI Sprites/Ring Hands/10 Fingers.png"
});
const TWISTED_RING_HAND_BACKGROUND_BY_FINGERS = Object.freeze({
  0: "./assets/UI/UI Sprites/Ring Hands/Twisted Hands/Finger (0).png",
  1: "./assets/UI/UI Sprites/Ring Hands/Twisted Hands/Finger (1).png",
  2: "./assets/UI/UI Sprites/Ring Hands/Twisted Hands/Finger (2).png",
  3: "./assets/UI/UI Sprites/Ring Hands/Twisted Hands/Finger (3).png",
  4: "./assets/UI/UI Sprites/Ring Hands/Twisted Hands/Finger (4).png",
  5: "./assets/UI/UI Sprites/Ring Hands/Twisted Hands/Finger (5).png",
  6: "./assets/UI/UI Sprites/Ring Hands/Twisted Hands/Finger (6).png",
  7: "./assets/UI/UI Sprites/Ring Hands/Twisted Hands/Finger (7).png",
  8: "./assets/UI/UI Sprites/Ring Hands/Twisted Hands/Finger (8).png",
  9: "./assets/UI/UI Sprites/Ring Hands/Twisted Hands/Finger (9).png",
  10: "./assets/UI/UI Sprites/Ring Hands/Twisted Hands/Finger (10).png"
});
const RING_SLOT_POSITIONS = Object.freeze([
  { x: 390, y: 351, w: 18, h: 18 },
  { x: 617, y: 351, w: 18, h: 18 },
  { x: 321, y: 277, w: 18, h: 18 },
  { x: 684, y: 273, w: 18, h: 18 },
  { x: 253, y: 264, w: 18, h: 18 },
  { x: 753, y: 266, w: 18, h: 19 },
  { x: 202, y: 272, w: 18, h: 18 },
  { x: 802, y: 284, w: 18, h: 18 },
  { x: 164, y: 307, w: 18, h: 18 },
  { x: 842, y: 312, w: 18, h: 18 }
]);

function getRingHandBackground(backgroundMap, fingerCount) {
  const clampedFingerCount = Math.max(0, Math.min(10, Math.floor(fingerCount || 0)));
  return backgroundMap[clampedFingerCount] || backgroundMap[10] || "";
}

function applyRingSlotPositionStyles(slot, boardSlotIndex) {
  const position = RING_SLOT_POSITIONS[boardSlotIndex] || { x: 0, y: 0, w: 18, h: 18 };
  slot.style.setProperty("--slot-x", `${(position.x / RING_SLOT_REFERENCE_SIZE.width) * 100}%`);
  slot.style.setProperty("--slot-y", `${(position.y / RING_SLOT_REFERENCE_SIZE.height) * 100}%`);
  slot.style.setProperty("--slot-w", `${(position.w / RING_SLOT_REFERENCE_SIZE.width) * 100}%`);
  slot.style.setProperty("--slot-h", `${(position.h / RING_SLOT_REFERENCE_SIZE.height) * 100}%`);
}

function renderEquippedRingBoards(container, { totalFingers, visibleSlotCount, createSlot }) {
  container.innerHTML = "";
  const normalizedFingerCount = Math.max(0, Math.floor(totalFingers || 0));
  const normalizedVisibleSlotCount = Math.max(0, Math.floor(visibleSlotCount || 0));
  const boardConfigs = [
    {
      fingerCount: Math.min(10, normalizedFingerCount),
      visibleSlotCount: Math.min(10, normalizedVisibleSlotCount),
      slotOffset: 0,
      backgroundMap: RING_HAND_BACKGROUND_BY_FINGERS
    }
  ];
  if (normalizedFingerCount >= 11) {
    boardConfigs.push({
      fingerCount: Math.min(10, Math.max(0, normalizedFingerCount - 10)),
      visibleSlotCount: Math.min(10, Math.max(0, normalizedVisibleSlotCount - 10)),
      slotOffset: 10,
      backgroundMap: TWISTED_RING_HAND_BACKGROUND_BY_FINGERS
    });
  }
  boardConfigs.forEach((config) => {
    const board = document.createElement("div");
    board.className = "ring-slot-board";
    board.style.setProperty("--ring-hand-background", `url("${getRingHandBackground(config.backgroundMap, config.fingerCount)}")`);
    for (let boardSlotIndex = 0; boardSlotIndex < config.visibleSlotCount; boardSlotIndex += 1) {
      const slotIndex = config.slotOffset + boardSlotIndex;
      const slot = createSlot({ slotIndex, boardSlotIndex });
      if (!(slot instanceof HTMLElement)) continue;
      applyRingSlotPositionStyles(slot, boardSlotIndex);
      board.appendChild(slot);
    }
    container.appendChild(board);
  });
}

function mountRingInventory(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;
  const dock = document.createElement("button");
  dock.type = "button";
  dock.className = "ring-inventory-dock";
  dock.setAttribute("data-ui-skin-token", "dockButton");
  dock.setAttribute("data-ui-skin-mode", "button");
  dock.textContent = "Inventory";
  panel.appendChild(dock);

  const inventory = document.createElement("section");
  inventory.className = "ring-inventory";
  inventory.innerHTML = `
    <div class="ring-inventory__header">
      <div>
        <h2 class="ring-inventory__title">Rings & Materials</h2>
      </div>
    </div>
    <div class="ring-inventory__layout">
      <section class="ring-section" data-ui-skin-token="blockPanel" data-ui-skin-mode="panel">
        <p class="ring-inventory__hint"><strong data-role="essence-count">0 Essence</strong></p>
        <p class="ring-inventory__hint" data-role="ring-action-hint"></p>
        <div class="ring-materials" data-role="materials-list"></div>
        <div class="ring-list" data-role="inventory-list"></div>
      </section>
      <section class="ring-section" data-ui-skin-token="blockPanel" data-ui-skin-mode="panel">
        <div class="ring-section__head">
          <h3>Equipped</h3>
          <span class="ring-section__count" data-role="equipped-count" data-ui-skin-token="countPill" data-ui-skin-mode="pill"></span>
        </div>
        <div class="ring-slot-boards" data-role="equipped-list"></div>
      </section>
    </div>
  `;
  panel.appendChild(inventory);
  inventory.setAttribute("data-ui-skin-token", "secondaryPanel");
  inventory.setAttribute("data-ui-skin-mode", "panel");
  applyUiSkinTree(panel);

  const essenceCount = inventory.querySelector('[data-role="essence-count"]');
  const ringActionHint = inventory.querySelector('[data-role="ring-action-hint"]');
  const materialsList = inventory.querySelector('[data-role="materials-list"]');
  const inventoryList = inventory.querySelector('[data-role="inventory-list"]');
  const equippedCount = inventory.querySelector('[data-role="equipped-count"]');
  const equippedList = inventory.querySelector('[data-role="equipped-list"]');
  let lastInventoryVersion = -1;
  let lastSceneVersion = -1;
  let lastOpen = false;
  let lastVisibleSlotCount = -1;

  const syncInventoryScale = () => {
    const canvasWidth = canvas.getBoundingClientRect().width || canvas.width || 1280;
    const scaledWidth = Math.round((canvasWidth / Math.max(1, canvas.width || 1280)) * 740);
    inventory.style.setProperty("--inventory-overlay-width", `${scaledWidth}px`);
  };

  syncInventoryScale();
  const resizeObserver = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => syncInventoryScale())
    : null;
  resizeObserver?.observe(canvas);

  dock.addEventListener("click", () => {
    game.toggleInventoryOverlay();
    canvas.focus();
  });

  inventory.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const slotButton = target.closest("[data-ring-slot]");
    if (slotButton instanceof HTMLElement) {
      const slotIndex = Number(slotButton.dataset.ringSlot);
      const pendingSelection = game.getPendingRingInventorySelection();
      if (pendingSelection?.type === "equipSlot" && pendingSelection.ringId) {
        game.equipRingToSlot(pendingSelection.ringId, slotIndex);
        canvas.focus();
        return;
      }
    }
    const ringCard = target.closest("[data-ring-card]");
    if (ringCard instanceof HTMLElement) {
      const ringId = ringCard.dataset.ringCard;
      if (ringId && game.getPendingRingInventorySelection()?.type === "mirrorUpgrade" && game.canApplyMirrorUpgradeToRing(ringId)) {
        game.applyMirrorUpgradeToRing(ringId);
        canvas.focus();
        return;
      }
    }
    const mirrorButton = target.closest("[data-ring-mirror-select]");
    if (mirrorButton instanceof HTMLElement) {
      game.toggleMirrorRingSelection(mirrorButton.dataset.ringMirrorSelect);
      canvas.focus();
      return;
    }
    const equipButton = target.closest("[data-ring-equip]");
    if (equipButton instanceof HTMLElement) {
      game.equipRing(equipButton.dataset.ringEquip);
      canvas.focus();
      return;
    }
    const upgradeButton = target.closest("[data-ring-upgrade]");
    if (upgradeButton instanceof HTMLElement) {
      game.upgradeOwnedRing(upgradeButton.dataset.ringUpgrade);
      canvas.focus();
      return;
    }
    const scrapButton = target.closest("[data-ring-scrap]");
    if (scrapButton instanceof HTMLElement) {
      game.scrapOwnedRing(scrapButton.dataset.ringScrap);
      canvas.focus();
      return;
    }
    const unequipButton = target.closest("[data-ring-unequip]");
    if (unequipButton instanceof HTMLElement) {
      game.unequipRing(Number(unequipButton.dataset.ringUnequip));
      canvas.focus();
    }
  });

  game.registerUiSync(() => {
    const shouldShow = !game.scene && game.state !== "loading" && game.inventoryOverlayOpen;
    const sceneVersion = game.getUiVersion("scene");
    if (shouldShow !== lastOpen) {
      inventory.classList.toggle("is-open", shouldShow);
      dock.classList.toggle("is-active", shouldShow);
      lastOpen = shouldShow;
    }
    if (sceneVersion !== lastSceneVersion) {
      lastSceneVersion = sceneVersion;
      dock.classList.toggle("is-hidden", !!game.scene);
    }
    if (!shouldShow) return;
    const inventoryVersion = game.getUiVersion("inventory");
    const visibleSlotCount = game.getAvailableRingSlotCount();
    if (inventoryVersion !== lastInventoryVersion || visibleSlotCount !== lastVisibleSlotCount) {
      lastInventoryVersion = inventoryVersion;
      lastVisibleSlotCount = visibleSlotCount;
      const ownedRings = game.getOwnedRings();
      const pendingSelection = game.getPendingRingInventorySelection();
      const materialDefs = getMaterialDefs();
      essenceCount.textContent = `${game.getRingEssence()} Essence`;
      ringActionHint.textContent = pendingSelection?.type === "mirrorUpgrade"
        ? "Ring of Mirror selected. Click any owned non-rare ring that is not max level to upgrade it."
        : pendingSelection?.type === "equipSlot"
          ? "Ring selected for equip. Click any ring slot to place it there. Occupied slots will swap."
          : "";
      equippedCount.textContent = `${game.equippedRings.filter(Boolean).length}/${visibleSlotCount} slots`;

      materialsList.innerHTML = "";
      for (const materialDef of materialDefs) {
        const materialEntry = document.createElement("div");
        materialEntry.className = "ring-materials__entry";
        materialEntry.setAttribute("title", materialDef.name);
        materialEntry.innerHTML = `
          ${createMaterialIconHtml(materialDef, 28)}
          <span class="ring-materials__count">${game.getMaterialCount(materialDef.id)}</span>
        `;
        materialsList.appendChild(materialEntry);
      }

      inventoryList.innerHTML = "";
      if (!ownedRings.length) {
        inventoryList.innerHTML = "";
      } else {
        for (const ring of ownedRings) {
          const ringDef = getRingDefById(ring.ringId);
          if (!ringDef) continue;
          const isMirrorCatalyst = game.isMirrorCatalystRing(ring.ringId);
          const mirrorPending = pendingSelection?.type === "mirrorUpgrade" && pendingSelection.sourceRingId === ring.ringId;
          const mirrorTargetable = pendingSelection?.type === "mirrorUpgrade" && game.canApplyMirrorUpgradeToRing(ring.ringId);
          const equipPending = pendingSelection?.type === "equipSlot" && pendingSelection.ringId === ring.ringId;
          const canEquip = game.canSelectRingForEquip(ring.ringId);
          const upgradeCost = ring.currentLevel < (ringDef.maxLevel || 5) ? getRingUpgradeCost(ring.currentLevel) : 0;
          const canUpgrade = ring.currentLevel < (ringDef.maxLevel || 5) && game.getRingEssence() >= upgradeCost;
          const article = document.createElement("article");
          article.className = "ring-card";
          if (mirrorPending || equipPending) article.classList.add("is-active");
          if (mirrorTargetable) article.classList.add("is-highlighted");
          article.setAttribute("data-ui-skin-token", "card");
          article.setAttribute("data-ui-skin-mode", "card");
          article.dataset.ringCard = ring.ringId;
          const rarityLabel = ringDef.dropRarity === "normal" ? "" : getRingRarityLabel(ringDef.dropRarity);
          const ringNameColor = ({
            normal: "#ffffff",
            uncommon: "#60a5fa",
            rare: "#facc15"
          })[String(ringDef.dropRarity || "").toLowerCase()] || "#ffffff";
          article.innerHTML = `
            <div class="ring-card__meta">
              ${createRingIconHtml(ringDef)}
              <div>
                <strong style="color:${ringNameColor}">${ringDef.name} Lv${ring.currentLevel}</strong>
                <span style="color:${getRingRarityColor(ringDef.dropRarity)}">${[rarityLabel, ring.equipped ? "Equipped" : ""].filter(Boolean).join(" • ")}</span>
              </div>
            </div>
            <p>${ringDef.levels.slice(0, ring.currentLevel).map((level, index) => `Lv${index + 1}: ${level.description}`).join(" ")}</p>
            <div class="ring-card__actions">
              <button type="button" class="ring-card__button" data-ui-skin-token="bar_pill_small_gold" data-ui-skin-mode="button" data-ring-equip="${ring.ringId}" ${canEquip ? "" : "disabled"}>Equip</button>
              <button type="button" class="ring-card__button" data-ui-skin-token="bar_pill_small_gold" data-ui-skin-mode="button" data-ring-upgrade="${ring.ringId}" ${canUpgrade ? "" : "disabled"}>${upgradeCost > 0 ? `Upgrade (${upgradeCost})` : "Max"}</button>
              <button type="button" class="ring-card__button" data-ui-skin-token="bar_pill_small_gold" data-ui-skin-mode="button" data-ring-scrap="${ring.ringId}">Scrap</button>
            </div>
          `;
          const rarityLine = article.querySelector(".ring-card__meta span");
          if (rarityLine instanceof HTMLElement) {
            rarityLine.textContent = [
              rarityLabel,
              ring.equipped ? "Equipped" : "",
              mirrorPending ? "Selecting Target" : "",
              !mirrorPending && mirrorTargetable ? "Eligible Target" : ""
            ].filter(Boolean).join(" • ");
          }
          if (isMirrorCatalyst) {
            const primaryButton = article.querySelector("[data-ring-equip]");
            if (primaryButton instanceof HTMLButtonElement) {
              primaryButton.removeAttribute("data-ring-equip");
              primaryButton.dataset.ringMirrorSelect = ring.ringId;
              primaryButton.disabled = false;
              primaryButton.textContent = mirrorPending ? "Cancel Mirror" : "Use Mirror";
            }
          } else {
            const primaryButton = article.querySelector("[data-ring-equip]");
            if (primaryButton instanceof HTMLButtonElement) {
              primaryButton.disabled = false;
              primaryButton.textContent = equipPending ? "Cancel Equip" : "Equip";
            }
          }
          inventoryList.appendChild(article);
        }
      }

      renderEquippedRingBoards(equippedList, {
        totalFingers: game.player.numberOfFingers,
        visibleSlotCount,
        createSlot: ({ slotIndex }) => {
          const ringId = game.equippedRings[slotIndex];
          const slot = document.createElement("button");
          slot.type = "button";
          slot.className = `ring-slot${ringId ? " is-filled" : ""}`;
          if (pendingSelection?.type === "equipSlot") slot.classList.add("is-highlighted");
          slot.dataset.ringSlot = String(slotIndex);
          if (ringId) slot.dataset.ringUnequip = String(slotIndex);
          if (!ringId) {
            slot.disabled = pendingSelection?.type === "equipSlot" ? false : true;
            slot.setAttribute("aria-label", `Ring slot ${slotIndex + 1} empty`);
            slot.innerHTML = "";
          } else {
            const ringDef = getRingDefById(ringId);
            const ownedRing = game.getOwnedRings().find((entry) => entry.ringId === ringId);
            slot.setAttribute("aria-label", pendingSelection?.type === "equipSlot"
              ? `Equip selected ring into slot ${slotIndex + 1}, swapping with ${ringDef.name}`
              : `Unequip ${ringDef.name} from slot ${slotIndex + 1}`);
            slot.innerHTML = `${createRingIconHtml(ringDef, 30)}<span class="ring-slot__level">Lv${ownedRing?.currentLevel || 1}</span>`;
          }
          return slot;
        }
      });
      applyUiSkinTree(inventory);
    }
  });
}

function mountRingInventorySpriteUi(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;
  const dock = document.createElement("button");
  dock.type = "button";
  dock.className = "ring-inventory-dock";
  dock.setAttribute("data-ui-skin-token", "dockButton");
  dock.setAttribute("data-ui-skin-mode", "button");
  dock.textContent = "Inventory";
  panel.appendChild(dock);

  const inventory = document.createElement("section");
  inventory.className = "ring-inventory ring-inventory--sprite-ui";
  inventory.innerHTML = `
    <div class="ring-inventory__header">
      <div>
        <h2 class="ring-inventory__title">Rings & Materials</h2>
      </div>
    </div>
    <div class="ring-inventory__layout">
      <section class="ring-section" data-ui-skin-token="blockPanel" data-ui-skin-mode="panel">
        <p class="ring-inventory__hint"><strong data-role="essence-count">0 Essence</strong></p>
        <p class="ring-inventory__hint ring-inventory__status" data-role="ring-action-hint"></p>
        <div class="ring-materials" data-role="materials-list"></div>
        <div class="ring-list ring-list--tiles" data-role="inventory-list"></div>
      </section>
      <section class="ring-section" data-ui-skin-token="blockPanel" data-ui-skin-mode="panel">
        <div class="ring-section__head">
          <h3>Equipped</h3>
          <span class="ring-section__count" data-role="equipped-count" data-ui-skin-token="countPill" data-ui-skin-mode="pill"></span>
        </div>
        <div class="ring-slot-boards" data-role="equipped-list"></div>
      </section>
    </div>
    <div class="ring-hover-card" data-role="ring-hover-card"></div>
  `;
  panel.appendChild(inventory);
  inventory.setAttribute("data-ui-skin-token", "secondaryPanel");
  inventory.setAttribute("data-ui-skin-mode", "panel");
  applyUiSkinTree(panel);

  const essenceCount = inventory.querySelector('[data-role="essence-count"]');
  const ringActionHint = inventory.querySelector('[data-role="ring-action-hint"]');
  const materialsList = inventory.querySelector('[data-role="materials-list"]');
  const inventoryList = inventory.querySelector('[data-role="inventory-list"]');
  const equippedCount = inventory.querySelector('[data-role="equipped-count"]');
  const equippedList = inventory.querySelector('[data-role="equipped-list"]');
  const hoverCard = inventory.querySelector('[data-role="ring-hover-card"]');
  let lastInventoryVersion = -1;
  let lastSceneVersion = -1;
  let lastOpen = false;
  let lastVisibleSlotCount = -1;
  let statusText = "";
  let statusExpiresAt = 0;
  let dragRingKey = null;

  const syncInventoryScale = () => {
    const canvasWidth = canvas.getBoundingClientRect().width || canvas.width || 1280;
    const scaledWidth = Math.round((canvasWidth / Math.max(1, canvas.width || 1280)) * 740);
    inventory.style.setProperty("--inventory-overlay-width", `${scaledWidth}px`);
  };
  const findOwnedRing = (ringKey) => game.getOwnedRings().find((entry) => entry.ringKey === ringKey) || null;
  const clearDropHighlights = () => {
    inventory.querySelectorAll(".is-drop-valid, .is-drop-invalid").forEach((element) => {
      element.classList.remove("is-drop-valid", "is-drop-invalid");
    });
  };
  const setStatus = (message, durationMs = 1800) => {
    statusText = String(message || "");
    statusExpiresAt = statusText ? performance.now() + durationMs : 0;
    ringActionHint.textContent = statusText;
  };
  const hideHoverCard = () => {
    if (!(hoverCard instanceof HTMLElement)) return;
    hoverCard.classList.remove("is-visible");
    hoverCard.innerHTML = "";
  };
  const showHoverCard = (ringKey, anchor) => {
    if (!(hoverCard instanceof HTMLElement) || !(anchor instanceof HTMLElement)) return;
    const owned = findOwnedRing(ringKey);
    const ringDef = getRingDefById(ringKey);
    if (!owned || !ringDef) {
      hideHoverCard();
      return;
    }
    const nextLevel = ringDef.levels?.[owned.currentLevel] || null;
    const upgradeCost = nextLevel ? getRingUpgradeCost(owned.currentLevel) : 0;
    hoverCard.innerHTML = `
      <div class="ring-hover-card__title-row">
        ${createRingIconHtml(ringDef)}
        <div>
          <strong style="color:${({
            normal: "#ffffff",
            uncommon: "#60a5fa",
            rare: "#facc15"
          })[String(ringDef.dropRarity || "").toLowerCase()] || "#ffffff"}">${ringDef.name}</strong>
          <span>Lv${owned.currentLevel}${owned.equipped ? " • Equipped" : ""}</span>
        </div>
      </div>
      <div class="ring-hover-card__section">
        <strong>Current</strong>
        <p>${ringDef.levels.slice(0, owned.currentLevel).map((level, index) => `Lv${index + 1}: ${level.description}`).join(" ")}</p>
      </div>
      <div class="ring-hover-card__section">
        <strong>${nextLevel ? `Next Upgrade (${upgradeCost} Essence)` : "Max Level"}</strong>
        <p>${nextLevel ? `Lv${owned.currentLevel + 1}: ${nextLevel.description}` : "This ring cannot be upgraded further."}</p>
      </div>
    `;
    const inventoryRect = inventory.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const desiredLeft = anchorRect.right - inventoryRect.left + 12;
    const desiredTop = anchorRect.top - inventoryRect.top;
    hoverCard.style.left = `${Math.max(12, Math.min(desiredLeft, inventoryRect.width - 292))}px`;
    hoverCard.style.top = `${Math.max(64, Math.min(desiredTop, inventoryRect.height - 172))}px`;
    hoverCard.classList.add("is-visible");
  };
  const updateDropIndicator = (element, valid) => {
    if (!(element instanceof HTMLElement)) return;
    element.classList.toggle("is-drop-valid", !!valid);
    element.classList.toggle("is-drop-invalid", valid === false);
  };
  const stopDraggingRing = () => {
    dragRingKey = null;
    inventory.classList.remove("is-dragging");
    clearDropHighlights();
  };
  syncInventoryScale();
  const resizeObserver = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => syncInventoryScale())
    : null;
  resizeObserver?.observe(canvas);

  dock.addEventListener("click", () => {
    game.toggleInventoryOverlay();
    canvas.focus();
  });

  inventory.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const slotButton = target.closest("[data-ring-slot]");
    if (slotButton instanceof HTMLElement && slotButton.dataset.ringUnequip) {
      game.unequipRing(Number(slotButton.dataset.ringUnequip));
      canvas.focus();
    }
  });

  inventory.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const ringElement = target.closest("[data-ring-key]");
    if (!(ringElement instanceof HTMLElement)) return;
    const ringKey = ringElement.dataset.ringKey;
    if (!ringKey) return;
    dragRingKey = ringKey;
    inventory.classList.add("is-dragging");
    clearDropHighlights();
    hideHoverCard();
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", ringKey);
    }
  });

  inventory.addEventListener("dragend", () => {
    stopDraggingRing();
  });

  inventory.addEventListener("dragover", (event) => {
    if (!dragRingKey) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const slotButton = target.closest("[data-ring-slot]");
    const inventoryRing = target.closest(".ring-tile");
    let valid = false;
    let highlightedElement = null;
    if (slotButton instanceof HTMLElement) {
      highlightedElement = slotButton;
      valid = game.canEquipRingToSlot(dragRingKey, Number(slotButton.dataset.ringSlot));
    } else if (inventoryRing instanceof HTMLElement) {
      const targetRingKey = inventoryRing.dataset.ringKey;
      if (targetRingKey && targetRingKey !== dragRingKey && game.isMirrorCatalystRing(dragRingKey)) {
        highlightedElement = inventoryRing;
        valid = game.canApplyMirrorUpgradeToRing(targetRingKey);
      }
    }
    if (!highlightedElement) return;
    event.preventDefault();
    clearDropHighlights();
    updateDropIndicator(highlightedElement, valid);
  });

  inventory.addEventListener("drop", (event) => {
    if (!dragRingKey) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const slotButton = target.closest("[data-ring-slot]");
    const inventoryRing = target.closest(".ring-tile");
    event.preventDefault();
    clearDropHighlights();
    if (slotButton instanceof HTMLElement) {
      const slotIndex = Number(slotButton.dataset.ringSlot);
      if (!game.canEquipRingToSlot(dragRingKey, slotIndex) || !game.equipRingToSlot(dragRingKey, slotIndex)) {
        setStatus("Cannot equip ring in that slot.");
      } else {
        const ringDef = getRingDefById(dragRingKey);
        setStatus(ringDef ? `${ringDef.name} equipped.` : "Ring equipped.");
      }
      canvas.focus();
      return;
    }
    if (inventoryRing instanceof HTMLElement) {
      const targetRingKey = inventoryRing.dataset.ringKey;
      if (targetRingKey && targetRingKey !== dragRingKey && game.isMirrorCatalystRing(dragRingKey)) {
        const result = game.applyMirrorUpgradeFromRing(dragRingKey, targetRingKey);
        if (result.ok) {
          const ringDef = getRingDefById(targetRingKey);
          setStatus(ringDef ? `${ringDef.name} upgraded by Ring of Mirror.` : "Ring upgraded.");
        } else {
          setStatus("Mirror ring can only upgrade owned non-rare rings that are not max level.");
        }
      }
      canvas.focus();
    }
  });

  inventory.addEventListener("mouseover", (event) => {
    if (dragRingKey) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const ringTile = target.closest(".ring-tile");
    if (!(ringTile instanceof HTMLElement)) return;
    const ringKey = ringTile.dataset.ringKey;
    if (!ringKey) return;
    showHoverCard(ringKey, ringTile);
  });

  inventory.addEventListener("mouseout", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const ringTile = target.closest(".ring-tile");
    if (!(ringTile instanceof HTMLElement)) return;
    hideHoverCard();
  });

  game.registerUiSync(() => {
    if (statusText && statusExpiresAt > 0 && performance.now() > statusExpiresAt) {
      statusText = "";
      statusExpiresAt = 0;
      ringActionHint.textContent = "";
    }

    const shouldShow = !game.scene && game.state !== "loading" && game.inventoryOverlayOpen;
    const sceneVersion = game.getUiVersion("scene");
    if (shouldShow !== lastOpen) {
      inventory.classList.toggle("is-open", shouldShow);
      dock.classList.toggle("is-active", shouldShow);
      lastOpen = shouldShow;
      if (!shouldShow) {
        hideHoverCard();
        stopDraggingRing();
      }
    }
    if (sceneVersion !== lastSceneVersion) {
      lastSceneVersion = sceneVersion;
      dock.classList.toggle("is-hidden", !!game.scene);
    }
    if (!shouldShow) return;
    const inventoryVersion = game.getUiVersion("inventory");
    const visibleSlotCount = game.getAvailableRingSlotCount();
    if (inventoryVersion !== lastInventoryVersion || visibleSlotCount !== lastVisibleSlotCount) {
      lastInventoryVersion = inventoryVersion;
      lastVisibleSlotCount = visibleSlotCount;
      const ownedRings = game.getOwnedRings();
      const materialDefs = getMaterialDefs();
      essenceCount.textContent = `${game.getRingEssence()} Essence`;
      ringActionHint.textContent = statusText;
      equippedCount.textContent = `${game.equippedRings.filter(Boolean).length}/${visibleSlotCount} slots`;

      materialsList.innerHTML = "";
      for (const materialDef of materialDefs) {
        const materialEntry = document.createElement("div");
        materialEntry.className = "ring-materials__entry";
        materialEntry.setAttribute("title", materialDef.name);
        materialEntry.innerHTML = `
          ${createMaterialIconHtml(materialDef, 28)}
          <span class="ring-materials__count">${game.getMaterialCount(materialDef.id)}</span>
        `;
        materialsList.appendChild(materialEntry);
      }

      inventoryList.innerHTML = "";
      for (const ring of ownedRings) {
        const ringDef = getRingDefById(ring.ringKey);
        if (!ringDef) continue;
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = `ring-tile${ring.equipped ? " is-equipped" : ""}`;
        tile.draggable = true;
        tile.dataset.ringKey = ring.ringKey;
        tile.setAttribute("aria-label", `${ringDef.name} level ${ring.currentLevel}`);
        tile.setAttribute("data-ui-skin-token", ring.equipped ? "cardActive" : "card");
        tile.setAttribute("data-ui-skin-mode", "card");
        tile.innerHTML = `
          ${createRingIconHtml(ringDef, 34)}
          ${game.isMirrorCatalystRing(ring.ringKey) ? '<span class="ring-tile__badge">Mirror</span>' : ""}
        `;
        inventoryList.appendChild(tile);
      }

      renderEquippedRingBoards(equippedList, {
        totalFingers: game.player.numberOfFingers,
        visibleSlotCount,
        createSlot: ({ slotIndex }) => {
          const ringKey = game.equippedRings[slotIndex];
          const slot = document.createElement("button");
          slot.type = "button";
          slot.className = `ring-slot${ringKey ? " is-filled" : ""}`;
          slot.dataset.ringSlot = String(slotIndex);
          if (ringKey) {
            slot.dataset.ringUnequip = String(slotIndex);
            slot.dataset.ringKey = ringKey;
            slot.draggable = true;
          }
          if (!ringKey) {
            slot.setAttribute("aria-label", `Ring slot ${slotIndex + 1} empty`);
            slot.innerHTML = "";
          } else {
            const ringDef = getRingDefById(ringKey);
            const ownedRing = findOwnedRing(ringKey);
            slot.setAttribute("aria-label", `Equipped slot ${slotIndex + 1}: ${ringDef?.name || "Ring"}`);
            slot.innerHTML = `${createRingIconHtml(ringDef, 30)}<span class="ring-slot__level">Lv${ownedRing?.currentLevel || 1}</span>`;
          }
          return slot;
        }
      });
      applyUiSkinTree(inventory);
    }
  });
}

function formatCharacterStatValue(value, options = {}) {
  if (options.percent) return `${Math.round((value - 1) * 100)}%`;
  if (options.percentFromZero) return `${Math.round(value * 100)}%`;
  if (options.fixed != null) return Number(value).toFixed(options.fixed);
  return `${Math.round(value)}`;
}

function mountCharacterOverlay(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;

  const dock = document.createElement("button");
  dock.type = "button";
  dock.className = "ring-inventory-dock character-overlay-dock";
  dock.setAttribute("data-ui-skin-token", "dockButton");
  dock.setAttribute("data-ui-skin-mode", "button");
  dock.textContent = "Character";
  panel.appendChild(dock);

  const overlay = document.createElement("section");
  overlay.className = "character-overlay";
  overlay.innerHTML = `
    <div class="character-overlay__header">
      <div>
        <p class="character-overlay__eyebrow">Runtime Sheet</p>
        <h2 class="character-overlay__title">Character</h2>
      </div>
      <p class="character-overlay__hint">Press <code>C</code> to toggle this overlay.</p>
    </div>
    <div class="character-overlay__hero" data-role="character-hero" data-ui-skin-token="blockPanel" data-ui-skin-mode="panel"></div>
    <div class="character-overlay__grid" data-role="character-grid"></div>
  `;
  panel.appendChild(overlay);
  overlay.setAttribute("data-ui-skin-token", "secondaryPanel");
  overlay.setAttribute("data-ui-skin-mode", "panel");
  applyUiSkinTree(panel);

  const heroBlock = overlay.querySelector('[data-role="character-hero"]');
  const statGrid = overlay.querySelector('[data-role="character-grid"]');
  let lastOpen = false;
  let lastSceneVersion = -1;
  let lastOverlayVersion = -1;
  let lastHeroId = "";
  let lastState = "";
  let lastHpLabel = "";
  let lastAttackLabel = "";
  let lastMoveSpeedLabel = "";
  let lastAttackSpeedLabel = "";

  dock.addEventListener("click", () => {
    game.toggleCharacterOverlay();
    canvas.focus();
  });

  game.registerUiSync(() => {
    const shouldShow = !game.scene && game.state !== "loading" && game.characterOverlayOpen;
    const sceneVersion = game.getUiVersion("scene");
    if (shouldShow !== lastOpen) {
      overlay.classList.toggle("is-open", shouldShow);
      dock.classList.toggle("is-active", shouldShow);
      lastOpen = shouldShow;
    }
    if (sceneVersion !== lastSceneVersion) {
      lastSceneVersion = sceneVersion;
      dock.classList.toggle("is-hidden", !!game.scene);
    }
    if (!shouldShow) return;

    const statRows = [
      ["Health", `${Math.ceil(game.player.hp)} / ${game.player.maxHp}`],
      ["Attack", formatCharacterStatValue(getPlayerStat(game.player, "attack"))],
      ["Move Speed", formatCharacterStatValue(getPlayerStat(game.player, "moveSpeed"))],
      ["Attacks / Sec", formatCharacterStatValue(getPlayerStat(game.player, "attackSpeed"), { fixed: 2 })]
    ];
    const overlayVersion = game.getUiVersion("overlay");
    const hpLabel = statRows[0][1];
    const attackLabel = statRows[1][1];
    const moveSpeedLabel = statRows[2][1];
    const attackSpeedLabel = statRows[3][1];
    const needsRefresh =
      overlayVersion !== lastOverlayVersion ||
      game.heroId !== lastHeroId ||
      game.state !== lastState ||
      hpLabel !== lastHpLabel ||
      attackLabel !== lastAttackLabel ||
      moveSpeedLabel !== lastMoveSpeedLabel ||
      attackSpeedLabel !== lastAttackSpeedLabel;

    if (needsRefresh) {
      lastOverlayVersion = overlayVersion;
      lastHeroId = game.heroId;
      lastState = game.state;
      lastHpLabel = hpLabel;
      lastAttackLabel = attackLabel;
      lastMoveSpeedLabel = moveSpeedLabel;
      lastAttackSpeedLabel = attackSpeedLabel;
      heroBlock.innerHTML = `
        <div class="character-overlay__hero-head">
          <strong>${game.heroDef.name}</strong>
          <span>${getWeaponArtDef(game.weaponArt?.id)?.name || game.weaponArt?.id || "Unknown Art"}</span>
        </div>
        <p>${game.heroDef.description}</p>
      `;
      statGrid.innerHTML = statRows
        .map(([label, value]) => `
          <article class="character-stat" data-ui-skin-token="card" data-ui-skin-mode="card">
            <span class="character-stat__label">${label}</span>
            <strong class="character-stat__value">${value}</strong>
          </article>
        `)
        .join("");
      applyUiSkinTree(overlay);
    }
  });
}

function mountAlchemyWorkshop(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;

  const overlay = document.createElement("section");
  overlay.className = "alchemy-workshop";
  overlay.innerHTML = `
    <div class="alchemy-workshop__header">
      <div>
        <p class="alchemy-workshop__eyebrow">Break Room</p>
        <h2 class="alchemy-workshop__title">Alchemy Workshop</h2>
      </div>
      <p class="alchemy-workshop__hint">Consume finger materials to graft a new passive and unlock one more ring slot. Press <code>Esc</code> to close.</p>
    </div>
    <div class="alchemy-workshop__grid">
      <section class="alchemy-workshop__panel" data-ui-skin-token="blockPanel" data-ui-skin-mode="panel">
        <div class="alchemy-workshop__list" data-role="alchemy-materials"></div>
      </section>
      <section class="alchemy-workshop__panel" data-ui-skin-token="blockPanel" data-ui-skin-mode="panel">
        <div class="alchemy-workshop__status" data-role="alchemy-status">Use a material to unlock a new finger.</div>
        <div class="alchemy-workshop__list" data-role="alchemy-fingers"></div>
      </section>
    </div>
  `;
  overlay.setAttribute("data-ui-skin-token", "secondaryPanel");
  overlay.setAttribute("data-ui-skin-mode", "panel");
  panel.appendChild(overlay);
  applyUiSkinTree(panel);

  const materialsList = overlay.querySelector('[data-role="alchemy-materials"]');
  const fingersList = overlay.querySelector('[data-role="alchemy-fingers"]');
  const status = overlay.querySelector('[data-role="alchemy-status"]');
  let lastOpen = false;
  let lastVersion = -1;
  let statusText = "Use a material to unlock a new finger.";

  overlay.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const craftButton = target.closest("[data-alchemy-craft]");
    if (craftButton instanceof HTMLElement) {
      const materialId = craftButton.dataset.alchemyCraft;
      const result = game.craftFingerAtWorkshop(materialId);
      if (result.ok) {
        statusText = `${result.definition.name} grafted onto slot ${result.slotIndex + 1}.`;
      } else if (result.reason === "insufficientMaterials") {
        statusText = "Not enough materials for that graft.";
      } else if (result.reason === "tierComplete") {
        statusText = "That rarity pool is already complete.";
      } else {
        statusText = "Alchemy failed.";
      }
      game.bumpUiVersion("inventory", "overlay", "ringStats");
      canvas.focus();
      return;
    }

    const sellButton = target.closest("[data-alchemy-sell-finger]");
    if (!(sellButton instanceof HTMLElement)) return;
    const slotIndex = Number.parseInt(sellButton.dataset.alchemySellFinger || "", 10);
    const result = game.sellFingerAtWorkshop(slotIndex);
    if (result.ok) {
      statusText = `${result.definition.name} sold for ${result.goldGain} gold and ${result.hpCost} HP.`;
    } else if (result.reason === "insufficientHp") {
      statusText = "Not enough HP to sell a finger right now.";
    } else {
      statusText = "Sale failed.";
    }
    game.bumpUiVersion("inventory", "overlay", "ringStats");
    canvas.focus();
  });

  game.registerUiSync(() => {
    const shouldShow = !game.scene && game.alchemyWorkshopOpen;
    if (shouldShow !== lastOpen) {
      overlay.classList.toggle("is-open", shouldShow);
      lastOpen = shouldShow;
    }
    if (!shouldShow) return;
    const version = game.getUiVersion("inventory");
    if (version === lastVersion) {
      status.textContent = statusText;
      return;
    }
    lastVersion = version;
    status.textContent = statusText;
    materialsList.innerHTML = "";
    const materialDefs = getMaterialDefs();
    for (const materialDef of getMaterialDefs()) {
      const availableFingers = game.getAvailableFingerChoices(materialDef.id);
      const craftCost = getAdjustedFingerCraftCost(game, materialDef.id);
      const card = document.createElement("article");
      card.className = "ring-card";
      card.setAttribute("data-ui-skin-token", "card");
      card.setAttribute("data-ui-skin-mode", "card");
      const count = game.getMaterialCount(materialDef.id);
      const costLabel = craftCost
        .map((entry) => `${entry.amount} ${materialDefs.find((candidate) => candidate.id === entry.materialId)?.name || entry.materialId}`)
        .join(" + ");
      const hasAllMaterials = craftCost.every((entry) => game.getMaterialCount(entry.materialId) >= entry.amount);
      const disabled = !hasAllMaterials || !availableFingers.length;
      card.innerHTML = `
        <div class="ring-card__meta">
          ${createMaterialIconHtml(materialDef)}
          <div>
            <strong>${materialDef.name}</strong>
            <span>${materialDef.rarity}</span>
          </div>
          <strong>${count}</strong>
        </div>
        <p>${availableFingers.length ? `${availableFingers.length} finger${availableFingers.length === 1 ? "" : "s"} remaining in this pool.` : "All fingers in this pool are already unlocked."}</p>
        <p>Cost: ${costLabel || "Unavailable"}</p>
        <div class="ring-card__actions">
          <button type="button" class="ring-card__button" data-ui-skin-token="countPill" data-ui-skin-mode="pill" data-alchemy-craft="${materialDef.id}" ${disabled ? "disabled" : ""}>Craft Finger</button>
        </div>
      `;
      materialsList.appendChild(card);
    }

    fingersList.innerHTML = "";
    const ownedFingers = game.getOwnedFingers();
    const startingFingerCount = getStartingFingerCount(game);
    const startingSlotLabel = startingFingerCount === 1 ? "Slot 1" : `Slots 1-${startingFingerCount}`;
    const nextCraftedSlotLabel = startingFingerCount + 1;
    const baseFingerCard = document.createElement("article");
    baseFingerCard.className = "ring-card";
    baseFingerCard.setAttribute("data-ui-skin-token", "cardMuted");
    baseFingerCard.setAttribute("data-ui-skin-mode", "card");
    baseFingerCard.innerHTML = `
      <div class="ring-card__meta">
        <div>
          <strong>${startingSlotLabel}: Starting Fingers</strong>
          <span>base</span>
        </div>
        <strong>${Array.from({ length: startingFingerCount }, (_, slotIndex) => slotIndex).filter((slotIndex) => game.equippedRings[slotIndex]).length}/${startingFingerCount} rings equipped</strong>
      </div>
      <p>Your run always starts with ${startingFingerCount} base finger${startingFingerCount === 1 ? "" : "s"}. Crafted fingers are added starting at slot ${nextCraftedSlotLabel}.</p>
    `;
    fingersList.appendChild(baseFingerCard);

    if (ownedFingers.length) {
      for (const finger of ownedFingers) {
        const ringState = game.equippedRings[finger.slotIndex] ? "Ring equipped" : "No ring equipped";
        const card = document.createElement("article");
        card.className = "ring-card";
        card.setAttribute("data-ui-skin-token", "cardMuted");
        card.setAttribute("data-ui-skin-mode", "card");
        card.innerHTML = `
          <div class="ring-card__meta">
            <div>
              <strong>Slot ${finger.slotIndex + 1}: ${finger.definition.name}</strong>
              <span>${finger.definition.rarity}</span>
            </div>
            <strong>${ringState}</strong>
          </div>
          <p>${finger.definition.description}</p>
          <div class="ring-card__actions">
            <button
              type="button"
              class="ring-card__button"
              data-ui-skin-token="countPill"
              data-ui-skin-mode="pill"
              data-alchemy-sell-finger="${finger.slotIndex}"
              ${(game.player?.hp || 0) <= 1 ? "disabled" : ""}
            >Sell finger (+50g, -20 HP)</button>
          </div>
        `;
        fingersList.appendChild(card);
      }
    }
    applyUiSkinTree(overlay);
  });
}

function mountBlacksmithWorkshop(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;

  const overlay = document.createElement("section");
  overlay.className = "alchemy-workshop blacksmith-workshop";
  overlay.innerHTML = `
    <div class="alchemy-workshop__header">
      <div>
        <p class="alchemy-workshop__eyebrow">Break Room</p>
        <h2 class="alchemy-workshop__title">Blacksmith</h2>
      </div>
      <p class="alchemy-workshop__hint">Drag a ring into Upgrade or Scrap. Drag Ring of Mirror onto another ring tile to consume it for a free upgrade. Press <code>Esc</code> to close.</p>
    </div>
    <div class="alchemy-workshop__grid">
      <section class="alchemy-workshop__panel" data-ui-skin-token="blockPanel" data-ui-skin-mode="panel">
        <div class="alchemy-workshop__status" data-role="blacksmith-status">Drag a ring to smith it.</div>
        <div class="ring-list ring-list--tiles" data-role="blacksmith-rings"></div>
      </section>
      <section class="alchemy-workshop__panel" data-ui-skin-token="blockPanel" data-ui-skin-mode="panel">
        <p class="ring-inventory__hint"><strong data-role="blacksmith-essence">0 Essence</strong></p>
        <div class="ring-dropzones">
          <div class="ring-dropzone" data-role="blacksmith-upgrade" data-drop-action="upgrade" data-ui-skin-token="card" data-ui-skin-mode="card">
            <strong>Upgrade</strong>
            <span>Spend Essence to level a ring.</span>
          </div>
          <div class="ring-dropzone" data-role="blacksmith-scrap" data-drop-action="scrap" data-ui-skin-token="card" data-ui-skin-mode="card">
            <strong>Scrap</strong>
            <span>Destroy a ring to gain Essence.</span>
          </div>
        </div>
        <div class="ring-slot-boards blacksmith-workshop__board" data-role="blacksmith-equipped"></div>
      </section>
    </div>
    <div class="ring-hover-card" data-role="blacksmith-hover-card"></div>
  `;
  overlay.setAttribute("data-ui-skin-token", "secondaryPanel");
  overlay.setAttribute("data-ui-skin-mode", "panel");
  panel.appendChild(overlay);
  applyUiSkinTree(panel);

  const status = overlay.querySelector('[data-role="blacksmith-status"]');
  const essence = overlay.querySelector('[data-role="blacksmith-essence"]');
  const ringList = overlay.querySelector('[data-role="blacksmith-rings"]');
  const equippedList = overlay.querySelector('[data-role="blacksmith-equipped"]');
  const hoverCard = overlay.querySelector('[data-role="blacksmith-hover-card"]');
  let lastOpen = false;
  let lastVersion = -1;
  let statusText = "Drag a ring to smith it.";
  let dragRingKey = null;
  const findOwnedRing = (ringKey) => game.getOwnedRings().find((entry) => entry.ringKey === ringKey) || null;
  const clearDropHighlights = () => {
    overlay.querySelectorAll(".is-drop-valid, .is-drop-invalid").forEach((element) => {
      element.classList.remove("is-drop-valid", "is-drop-invalid");
    });
  };
  const setStatus = (message) => {
    statusText = String(message || "");
    status.textContent = statusText;
  };
  const hideHoverCard = () => {
    if (!(hoverCard instanceof HTMLElement)) return;
    hoverCard.classList.remove("is-visible");
    hoverCard.innerHTML = "";
  };
  const showHoverCard = (ringKey, anchor) => {
    if (!(hoverCard instanceof HTMLElement) || !(anchor instanceof HTMLElement)) return;
    const owned = findOwnedRing(ringKey);
    const ringDef = getRingDefById(ringKey);
    if (!owned || !ringDef) return;
    const nextLevel = ringDef.levels?.[owned.currentLevel] || null;
    const upgradeCost = nextLevel ? getRingUpgradeCost(owned.currentLevel) : 0;
    hoverCard.innerHTML = `
      <div class="ring-hover-card__title-row">
        ${createRingIconHtml(ringDef)}
        <div>
          <strong style="color:${({
            normal: "#ffffff",
            uncommon: "#60a5fa",
            rare: "#facc15"
          })[String(ringDef.dropRarity || "").toLowerCase()] || "#ffffff"}">${ringDef.name}</strong>
          <span>Lv${owned.currentLevel}${owned.equipped ? " • Equipped" : ""}</span>
        </div>
      </div>
      <div class="ring-hover-card__section">
        <strong>Current</strong>
        <p>${ringDef.levels.slice(0, owned.currentLevel).map((level, index) => `Lv${index + 1}: ${level.description}`).join(" ")}</p>
      </div>
      <div class="ring-hover-card__section">
        <strong>${nextLevel ? `Next Upgrade (${upgradeCost} Essence)` : "Max Level"}</strong>
        <p>${nextLevel ? `Lv${owned.currentLevel + 1}: ${nextLevel.description}` : "This ring cannot be upgraded further."}</p>
      </div>
    `;
    const overlayRect = overlay.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    hoverCard.style.left = `${Math.max(12, Math.min(anchorRect.right - overlayRect.left + 12, overlayRect.width - 292))}px`;
    hoverCard.style.top = `${Math.max(64, Math.min(anchorRect.top - overlayRect.top, overlayRect.height - 172))}px`;
    hoverCard.classList.add("is-visible");
  };
  const updateDropIndicator = (element, valid) => {
    if (!(element instanceof HTMLElement)) return;
    element.classList.toggle("is-drop-valid", !!valid);
    element.classList.toggle("is-drop-invalid", valid === false);
  };
  const stopDragging = () => {
    dragRingKey = null;
    clearDropHighlights();
  };
  const handleUpgrade = (ringKey) => {
    if (game.isMirrorCatalystRing(ringKey)) {
      setStatus("Drop Ring of Mirror onto another ring tile.");
      return;
    }
    const upgradeState = game.getUpgradeRingState(ringKey);
    if (!upgradeState.ok) {
      setStatus(upgradeState.reason === "maxLevel" ? "Ring is max level." : upgradeState.reason === "insufficientEssence" ? "Not enough Essence." : "Cannot upgrade ring.");
      return;
    }
    if (game.upgradeOwnedRing(ringKey)) setStatus(`${upgradeState.def.name} upgraded.`);
  };
  const handleScrap = (ringKey) => {
    const scrapState = game.getScrapRingState(ringKey);
    if (!scrapState.ok) {
      setStatus("Cannot scrap ring.");
      return;
    }
    if (game.scrapOwnedRing(ringKey)) setStatus(`${scrapState.def.name} scrapped.`);
  };

  overlay.addEventListener("dragstart", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const ringElement = target.closest("[data-ring-key]");
    if (!(ringElement instanceof HTMLElement)) return;
    const ringKey = ringElement.dataset.ringKey;
    if (!ringKey) return;
    dragRingKey = ringKey;
    clearDropHighlights();
    hideHoverCard();
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", ringKey);
    }
  });

  overlay.addEventListener("dragend", () => stopDragging());

  overlay.addEventListener("dragover", (event) => {
    if (!dragRingKey) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const zone = target.closest("[data-drop-action]");
    const ringTile = target.closest(".ring-tile");
    let valid = false;
    let highlight = null;
    if (zone instanceof HTMLElement) {
      highlight = zone;
      if (zone.dataset.dropAction === "upgrade") valid = game.isMirrorCatalystRing(dragRingKey) || game.getUpgradeRingState(dragRingKey).ok;
      if (zone.dataset.dropAction === "scrap") valid = game.getScrapRingState(dragRingKey).ok;
    } else if (ringTile instanceof HTMLElement) {
      const targetRingKey = ringTile.dataset.ringKey;
      if (targetRingKey && targetRingKey !== dragRingKey && game.isMirrorCatalystRing(dragRingKey)) {
        highlight = ringTile;
        valid = game.canApplyMirrorUpgradeToRing(targetRingKey);
      }
    }
    if (!highlight) return;
    event.preventDefault();
    clearDropHighlights();
    updateDropIndicator(highlight, valid);
  });

  overlay.addEventListener("drop", (event) => {
    if (!dragRingKey) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const zone = target.closest("[data-drop-action]");
    const ringTile = target.closest(".ring-tile");
    event.preventDefault();
    clearDropHighlights();
    if (zone instanceof HTMLElement) {
      if (zone.dataset.dropAction === "upgrade") handleUpgrade(dragRingKey);
      if (zone.dataset.dropAction === "scrap") handleScrap(dragRingKey);
      canvas.focus();
      return;
    }
    if (ringTile instanceof HTMLElement) {
      const targetRingKey = ringTile.dataset.ringKey;
      if (targetRingKey && targetRingKey !== dragRingKey && game.isMirrorCatalystRing(dragRingKey)) {
        const result = game.applyMirrorUpgradeFromRing(dragRingKey, targetRingKey);
        if (result.ok) {
          const ringDef = getRingDefById(targetRingKey);
          setStatus(ringDef ? `${ringDef.name} upgraded by Ring of Mirror.` : "Ring upgraded.");
        } else {
          setStatus("Mirror ring can only upgrade owned non-rare rings that are not max level.");
        }
      }
      canvas.focus();
    }
  });

  overlay.addEventListener("mouseover", (event) => {
    if (dragRingKey) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const ringTile = target.closest(".ring-tile");
    if (!(ringTile instanceof HTMLElement)) return;
    const ringKey = ringTile.dataset.ringKey;
    if (!ringKey) return;
    showHoverCard(ringKey, ringTile);
  });

  overlay.addEventListener("mouseout", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const ringTile = target.closest(".ring-tile");
    if (!(ringTile instanceof HTMLElement)) return;
    hideHoverCard();
  });

  game.registerUiSync(() => {
    const shouldShow = !game.scene && game.blacksmithOpen;
    if (shouldShow !== lastOpen) {
      overlay.classList.toggle("is-open", shouldShow);
      lastOpen = shouldShow;
      if (!shouldShow) {
        hideHoverCard();
        stopDragging();
      }
    }
    if (!shouldShow) return;
    const version = game.getUiVersion("inventory");
    if (version === lastVersion) {
      status.textContent = statusText;
      essence.textContent = `${game.getRingEssence()} Essence`;
      return;
    }
    lastVersion = version;
    status.textContent = statusText;
    essence.textContent = `${game.getRingEssence()} Essence`;

    ringList.innerHTML = "";
    for (const ring of game.getOwnedRings()) {
      const ringDef = getRingDefById(ring.ringKey);
      if (!ringDef) continue;
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = `ring-tile${ring.equipped ? " is-equipped" : ""}`;
      tile.draggable = true;
      tile.dataset.ringKey = ring.ringKey;
      tile.setAttribute("aria-label", `${ringDef.name} level ${ring.currentLevel}`);
      tile.setAttribute("data-ui-skin-token", ring.equipped ? "cardActive" : "card");
      tile.setAttribute("data-ui-skin-mode", "card");
      tile.innerHTML = `
        ${createRingIconHtml(ringDef, 34)}
        ${game.isMirrorCatalystRing(ring.ringKey) ? '<span class="ring-tile__badge">Mirror</span>' : ""}
      `;
      ringList.appendChild(tile);
    }

    renderEquippedRingBoards(equippedList, {
      totalFingers: game.player.numberOfFingers,
      visibleSlotCount: game.getAvailableRingSlotCount(),
      createSlot: ({ slotIndex }) => {
        const ringKey = game.equippedRings[slotIndex];
        const slot = document.createElement("div");
        slot.className = `ring-slot${ringKey ? " is-filled" : ""}`;
        if (ringKey) {
          const ringDef = getRingDefById(ringKey);
          const ownedRing = findOwnedRing(ringKey);
          slot.innerHTML = `${createRingIconHtml(ringDef, 30)}<span class="ring-slot__level">Lv${ownedRing?.currentLevel || 1}</span>`;
        }
        return slot;
      }
    });
    applyUiSkinTree(overlay);
  });
}

function mountRingSelectionShop(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;

  const overlay = document.createElement("section");
  overlay.className = "ring-selection-shop";
  overlay.innerHTML = `
    <div class="ring-selection-shop__header">
      <div>
        <p class="ring-selection-shop__eyebrow">Map Economy</p>
        <h2 class="ring-selection-shop__title">Ring Selection</h2>
      </div>
      <p class="ring-selection-shop__hint">Choose one ring to buy from this stand. Press <code>Esc</code> to close.</p>
    </div>
    <div class="ring-selection-shop__status" data-role="ring-selection-status">Browse the three rings and buy one.</div>
    <div class="ring-selection-shop__choices" data-role="ring-selection-choices"></div>
  `;
  overlay.setAttribute("data-ui-skin-token", "secondaryPanel");
  overlay.setAttribute("data-ui-skin-mode", "panel");
  panel.appendChild(overlay);
  applyUiSkinTree(panel);

  const status = overlay.querySelector('[data-role="ring-selection-status"]');
  const choices = overlay.querySelector('[data-role="ring-selection-choices"]');
  let lastOpen = false;
  let lastVersion = -1;
  let statusText = "Browse the three rings and buy one.";

  overlay.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const buyButton = target.closest("[data-ring-selection-buy]");
    if (!(buyButton instanceof HTMLElement)) return;
    const ringId = buyButton.dataset.ringSelectionBuy;
    if (!ringId) return;
    const result = game.purchaseRingFromSelection(ringId);
    if (result.ok) {
      statusText = `${result.ringDef.name} purchased.`;
    } else if (result.reason === "insufficientGold") {
      statusText = "Not enough gold for that ring.";
    } else {
      statusText = "That offer is no longer available.";
    }
    canvas.focus();
  });

  game.registerUiSync(() => {
    const shouldShow = !game.scene && game.ringSelectionShopOpen;
    if (shouldShow !== lastOpen) {
      overlay.classList.toggle("is-open", shouldShow);
      lastOpen = shouldShow;
    }
    if (!shouldShow) return;

    const searchable = game.getActiveRingSelectionSearchable();
    const goldCost = searchable ? getSearchableGoldCost(game, searchable) : 0;
    const version = game.getUiVersion("inventory");
    if (version === lastVersion) {
      status.textContent = statusText;
      return;
    }

    lastVersion = version;
    status.textContent = searchable
      ? `${searchable.ringOfferRarity === "uncommon" ? "Uncommon" : "Common"} selection. Each ring costs ${goldCost} gold.`
      : statusText;
    choices.innerHTML = "";
    for (const ringDef of game.getActiveRingSelectionOffers()) {
      const article = document.createElement("article");
      article.className = "ring-selection-shop__choice";
      article.setAttribute("data-ui-skin-token", "card");
      article.setAttribute("data-ui-skin-mode", "card");
      const canAfford = game.gold >= goldCost;
      article.innerHTML = `
        <div class="ring-selection-shop__choice-name">${ringDef.name}</div>
        <div class="ring-selection-shop__choice-art">
          <span class="ring-icon ring-selection-shop__icon" style="${Object.entries(getRingItemIconStyle(ringDef, 44)).map(([key, value]) => `${key}:${value}`).join(";")}"></span>
        </div>
        <div class="ring-selection-shop__choice-meta">
          <span style="color:${getRingRarityColor(ringDef.dropRarity)}">${getRingRarityLabel(ringDef.dropRarity)}</span>
          <span>${goldCost}g</span>
        </div>
        <p>${ringDef.levels?.[0]?.description || ringDef.description || ""}</p>
        <div class="ring-card__actions">
          <button type="button" class="ring-card__button" data-ui-skin-token="bar_pill_small_gold" data-ui-skin-mode="button" data-ring-selection-buy="${ringDef.ringId}" ${canAfford ? "" : "disabled"}>Buy</button>
        </div>
      `;
      choices.appendChild(article);
    }
    applyUiSkinTree(overlay);
  });
}

function mountCursedAnvilUi(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;

  const overlay = document.createElement("section");
  overlay.className = "ring-selection-shop cursed-anvil-ui";
  overlay.innerHTML = `
    <div class="ring-selection-shop__header">
      <div>
        <p class="ring-selection-shop__eyebrow">Cursed Anvil</p>
        <h2 class="ring-selection-shop__title">Place a Ring</h2>
        <button type="button" class="ring-card__button cursed-anvil-ui__back-button" data-ui-skin-token="bar_pill_small_gold" data-ui-skin-mode="button" data-cursed-anvil-close>Back</button>
      </div>
      <p class="ring-selection-shop__hint">50% chance to upgrade — 50% chance to be cursed next biome. Press <code>Esc</code> to close.</p>
    </div>
    <div class="ring-selection-shop__status" data-role="cursed-anvil-status">Choose a ring to gamble.</div>
    <div class="ring-selection-shop__choices" data-role="cursed-anvil-choices"></div>
  `;
  overlay.setAttribute("data-ui-skin-token", "secondaryPanel");
  overlay.setAttribute("data-ui-skin-mode", "panel");
  panel.appendChild(overlay);
  applyUiSkinTree(overlay);

  overlay.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("[data-cursed-anvil-close]")) {
      game.closeCursedAnvilUi();
      return;
    }
    const gambleButton = target.closest("[data-cursed-anvil-ring]");
    if (!(gambleButton instanceof HTMLElement)) return;
    const ringId = gambleButton.dataset.cursedAnvilRing;
    if (!ringId) return;
    game.confirmCursedAnvilGamble(ringId);
  });

  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") game.closeCursedAnvilUi();
  });

  let lastOpen = false;
  let lastVersion = -1;

  game.registerUiSync(() => {
    const shouldShow = !game.scene && !!game.cursedAnvilOpen;
    if (shouldShow !== lastOpen) {
      overlay.classList.toggle("is-open", shouldShow);
      lastOpen = shouldShow;
    }
    if (!shouldShow) return;

    const version = game.getUiVersion("inventory");
    if (version === lastVersion) return;
    lastVersion = version;

    const statusEl = overlay.querySelector("[data-role='cursed-anvil-status']");
    const choices = overlay.querySelector("[data-role='cursed-anvil-choices']");
    if (!(choices instanceof HTMLElement)) return;

    const ownedRings = game.getOwnedRings();
    const eligible = ownedRings.filter((r) => {
      const def = getRingDefById(r.ringKey);
      return def && (r.currentLevel || 1) < (def.maxLevel || 5);
    });

    if (statusEl instanceof HTMLElement) {
      statusEl.textContent = eligible.length
        ? "Choose a ring to gamble."
        : "No rings eligible — all are at max level.";
    }

    choices.innerHTML = "";
    for (const ring of eligible) {
      const ringDef = getRingDefById(ring.ringKey);
      if (!ringDef) continue;
      const article = document.createElement("article");
      article.className = "ring-selection-shop__choice";
      article.setAttribute("data-ui-skin-token", "card");
      article.setAttribute("data-ui-skin-mode", "card");
      const nextLevel = (ring.currentLevel || 1) + 1;
      const levelDesc = ringDef.levels?.[nextLevel - 1]?.description || ringDef.levels?.[0]?.description || "";
      article.innerHTML = `
        <div class="ring-selection-shop__choice-name">${ringDef.name}</div>
        <div class="ring-selection-shop__choice-art">
          <span class="ring-icon ring-selection-shop__icon" style="${Object.entries(getRingItemIconStyle(ringDef, 44)).map(([k, v]) => `${k}:${v}`).join(";")}"></span>
        </div>
        <div class="ring-selection-shop__choice-meta">
          <span style="color:${getRingRarityColor(ringDef.dropRarity)}">${getRingRarityLabel(ringDef.dropRarity)}</span>
          <span>Lv ${ring.currentLevel} → ${nextLevel}</span>
        </div>
        <p>${levelDesc}</p>
        <div class="ring-card__actions">
          <button type="button" class="ring-card__button" data-ui-skin-token="bar_pill_small_gold" data-ui-skin-mode="button" data-cursed-anvil-ring="${ring.ringKey}">Gamble</button>
        </div>
      `;
      choices.appendChild(article);
    }
    applyUiSkinTree(overlay);
  });
}

function mountDevilMerchantUi(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;

  const overlay = document.createElement("section");
  overlay.className = "ring-selection-shop devil-merchant-ui";
  overlay.innerHTML = `
    <div class="ring-selection-shop__header">
      <div>
        <p class="ring-selection-shop__eyebrow">Devil Merchant</p>
        <h2 class="ring-selection-shop__title">A Deal in Blood</h2>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <button type="button" class="ring-card__button" data-ui-skin-token="bar_pill_small_gold" data-ui-skin-mode="button" data-devil-close>Close</button>
        <p class="ring-selection-shop__hint">Buy rings with HP. Sell rings for Max HP. Attack to drive away.</p>
      </div>
    </div>
    <div class="ring-selection-shop__status" data-role="devil-merchant-status">What will you trade?</div>
    <h3 class="ring-selection-shop__section-label">Buy (costs HP)</h3>
    <div class="ring-selection-shop__choices" data-role="devil-merchant-buy-choices"></div>
    <h3 class="ring-selection-shop__section-label">Sell (gain Max HP)</h3>
    <div class="ring-selection-shop__choices" data-role="devil-merchant-sell-choices"></div>
  `;
  overlay.setAttribute("data-ui-skin-token", "secondaryPanel");
  overlay.setAttribute("data-ui-skin-mode", "panel");
  panel.appendChild(overlay);
  applyUiSkinTree(overlay);

  overlay.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("[data-devil-close]")) {
      game.closeDevilMerchantUi();
      return;
    }
    const buyBtn = target.closest("[data-devil-buy-ring]");
    if (buyBtn instanceof HTMLElement) {
      const ringId = buyBtn.dataset.devilBuyRing;
      if (ringId) game.buyDevilMerchantOffer(ringId);
      return;
    }
    const sellBtn = target.closest("[data-devil-sell-ring]");
    if (sellBtn instanceof HTMLElement) {
      const ringId = sellBtn.dataset.devilSellRing;
      if (ringId) game.sellRingToDevilMerchant(ringId);
    }
  });

  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") game.closeDevilMerchantUi();
  });

  let lastOpen = false;
  let lastVersion = -1;

  game.registerUiSync(() => {
    const shouldShow = !game.scene && !!game.devilMerchantOpen;
    if (shouldShow !== lastOpen) {
      overlay.classList.toggle("is-open", shouldShow);
      lastOpen = shouldShow;
    }
    if (!shouldShow) return;

    const version = game.uiVersions?.overlay ?? 0;
    if (version === lastVersion) return;
    lastVersion = version;

    const merchant = game.devilMerchant;
    const statusEl = overlay.querySelector("[data-role='devil-merchant-status']");
    const buyChoices = overlay.querySelector("[data-role='devil-merchant-buy-choices']");
    const sellChoices = overlay.querySelector("[data-role='devil-merchant-sell-choices']");
    if (!merchant || !(buyChoices instanceof HTMLElement) || !(sellChoices instanceof HTMLElement)) return;

    const playerHp = game.player?.hp ?? 0;
    const playerMaxHp = game.player?.maxHp ?? 1;
    const minHp = Math.ceil(playerMaxHp * 0.2);

    if (statusEl instanceof HTMLElement) {
      statusEl.textContent = `HP: ${Math.floor(playerHp)} / ${Math.floor(playerMaxHp)}`;
    }

    // Buy offers
    buyChoices.innerHTML = "";
    if (!merchant.offers.length) {
      buyChoices.innerHTML = `<p style="color:#9ca3af;font-size:12px;padding:4px 0">No more offers.</p>`;
    }
    for (const offer of merchant.offers) {
      const ringDef = getRingDefById(offer.ringId);
      if (!ringDef) continue;
      const canAfford = playerHp - offer.hpCost >= minHp;
      const article = document.createElement("article");
      article.className = "ring-selection-shop__choice";
      article.setAttribute("data-ui-skin-token", "card");
      article.setAttribute("data-ui-skin-mode", "card");
      article.innerHTML = `
        <div class="ring-selection-shop__choice-name">${ringDef.name}</div>
        <div class="ring-selection-shop__choice-art">
          <span class="ring-icon" style="${Object.entries(getRingItemIconStyle(ringDef, 44)).map(([k, v]) => `${k}:${v}`).join(";")}"></span>
        </div>
        <div class="ring-selection-shop__choice-meta">
          <span style="color:${getRingRarityColor(ringDef.dropRarity)}">${getRingRarityLabel(ringDef.dropRarity)}</span>
          <span style="color:#f87171">-${offer.hpCost} HP</span>
        </div>
        <p>${ringDef.levels?.[0]?.description || ringDef.description || ""}</p>
        <div class="ring-card__actions">
          <button type="button" class="ring-card__button" data-ui-skin-token="bar_pill_small_gold" data-ui-skin-mode="button" data-devil-buy-ring="${offer.ringId}" ${canAfford ? "" : "disabled"}>Buy</button>
        </div>
      `;
      buyChoices.appendChild(article);
    }

    // Sell owned rings
    sellChoices.innerHTML = "";
    const owned = game.getOwnedRings?.() ?? [];
    if (!owned.length) {
      sellChoices.innerHTML = `<p style="color:#9ca3af;font-size:12px;padding:4px 0">No rings to sell.</p>`;
    }
    for (const ring of owned) {
      const ringDef = getRingDefById(ring.ringKey);
      if (!ringDef) continue;
      const gain = { normal: 4, uncommon: 8, rare: 14 }[ringDef.dropRarity] ?? 4;
      const article = document.createElement("article");
      article.className = "ring-selection-shop__choice";
      article.setAttribute("data-ui-skin-token", "card");
      article.setAttribute("data-ui-skin-mode", "card");
      article.innerHTML = `
        <div class="ring-selection-shop__choice-name">${ringDef.name}</div>
        <div class="ring-selection-shop__choice-art">
          <span class="ring-icon" style="${Object.entries(getRingItemIconStyle(ringDef, 44)).map(([k, v]) => `${k}:${v}`).join(";")}"></span>
        </div>
        <div class="ring-selection-shop__choice-meta">
          <span style="color:${getRingRarityColor(ringDef.dropRarity)}">${getRingRarityLabel(ringDef.dropRarity)}</span>
          <span style="color:#4ade80">+${gain} Max HP</span>
        </div>
        <p>Lv ${ring.currentLevel}</p>
        <div class="ring-card__actions">
          <button type="button" class="ring-card__button" data-ui-skin-token="bar_pill_small_gold" data-ui-skin-mode="button" data-devil-sell-ring="${ring.ringKey}">Sell</button>
        </div>
      `;
      sellChoices.appendChild(article);
    }

    applyUiSkinTree(overlay);
  });
}

function mountFpsMonitor(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;

  const monitor = document.createElement("div");
  monitor.className = "fps-monitor is-hidden";
  monitor.setAttribute("data-ui-skin-token", "countPillMuted");
  monitor.setAttribute("data-ui-skin-mode", "pill");
  monitor.innerHTML = `
    <div class="fps-monitor__fps">-- FPS</div>
    <div class="fps-monitor__gold">0 Gold</div>
  `;
  panel.appendChild(monitor);
  applyUiSkinTree(panel);
  const fpsLabel = monitor.querySelector(".fps-monitor__fps");
  const goldLabel = monitor.querySelector(".fps-monitor__gold");
  if (!(fpsLabel instanceof HTMLElement) || !(goldLabel instanceof HTMLElement)) return;

  let accumulatedTime = 0;
  let accumulatedFrames = 0;
  let smoothedFps = 0;
  let lastVisible = false;
  let lastFpsLabel = fpsLabel.textContent;
  let lastGoldLabel = goldLabel.textContent;

  game.registerUiSync((timestamp = performance.now(), dt = 0) => {
    const shouldShow = !game.scene && game.state !== "loading";
    if (shouldShow !== lastVisible) {
      monitor.classList.toggle("is-hidden", !shouldShow);
      lastVisible = shouldShow;
    }
    if (!shouldShow) return;

    if (Number.isFinite(dt) && dt > 0) {
      accumulatedTime += dt;
      accumulatedFrames += 1;
    }

    const nextGoldLabel = `${Math.max(0, Math.floor(game.gold || 0))} Gold`;
    if (nextGoldLabel !== lastGoldLabel) {
      lastGoldLabel = nextGoldLabel;
      goldLabel.textContent = nextGoldLabel;
    }

    if (accumulatedTime < 0.25 || accumulatedFrames <= 0) return;

    const fps = accumulatedFrames / Math.max(0.001, accumulatedTime);
    smoothedFps = smoothedFps > 0 ? smoothedFps * 0.65 + fps * 0.35 : fps;
    accumulatedTime = 0;
    accumulatedFrames = 0;

    const nextFpsLabel = `${Math.round(smoothedFps)} FPS`;
    if (nextFpsLabel === lastFpsLabel) return;
    lastFpsLabel = nextFpsLabel;
    fpsLabel.textContent = nextFpsLabel;
  });
}

async function bootstrap() {
  const canvas = document.getElementById("game");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Game canvas was not found.");
  }

  const game = new RoguelikeGame(canvas, { heroId: getInitialHeroId() });
  window.localStorage.setItem(HERO_STORAGE_KEY, game.heroId);
  updateHeroQuery(game.heroId);
  await initializeUiAtlas();
  await game.init();
  mountStartMenu(game, canvas);
  mountAffinityScene(game, canvas);
  mountSettingsScene(game, canvas);
  mountLoadoutScene(game, canvas);
  mountEnemyTestScene(game, canvas);
  mountPauseDebugSpawner(game, canvas);
  mountRingInventorySpriteUi(game, canvas);
  mountCharacterOverlay(game, canvas);
  mountAlchemyWorkshop(game, canvas);
  mountBlacksmithWorkshop(game, canvas);
  mountRingSelectionShop(game, canvas);
  mountCursedAnvilUi(game, canvas);
  mountDevilMerchantUi(game, canvas);
  mountFpsMonitor(game, canvas);
  window.__roguelikeGame = game;
  document.getElementById("loading-screen")?.classList.add("hidden");
  game.start();
}

bootstrap().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<pre style="color:#fecaca;padding:16px;">${String(error?.stack || error)}</pre>`
  );
});
