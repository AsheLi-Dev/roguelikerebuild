import { DEFAULT_HERO_ID, getHeroDef, getHeroList } from "./data/heroes.js";
import { getEnemyDef } from "./data/enemies.js";
import { getAllExtractedSkills } from "./data/extracted-skills.js";
import { getSkillIconDomStyle } from "./data/skill-icons.js";
import { getRingDefById, getRingRarityColor, getRingRarityLabel } from "./data/rings.js";
import { getUndeadEnemyDef } from "./data/undead-enemies.js";
import { getWeaponArtDef } from "./data/weapon-arts.js";
import { RoguelikeGame } from "./game/roguelike-game.js";
import { createCombatState, damageEnemy, tryHeroAttack, updateCombat } from "./systems/combat.js";
import { getAllEnemyTypeIds, getControllableEnemyTypeIds } from "./systems/enemies.js";
import { createMovementState } from "./systems/movement.js";
import { getPlayerStat, resetPlayerStats } from "./systems/player-stats.js";
import { renderCombatPreview } from "./render/renderer.js";
import { initializeRingRuntime } from "./systems/rings.js";
import { getRingItemIconStyle } from "./systems/searchables.js";
import { spawnEnemyByType } from "./systems/enemies.js";
import { PLAYABLE_RUN_SKILL_IDS } from "./systems/skills.js";
import { initializeWeaponArtRuntime } from "./systems/weapon-art-runtime.js";
import { initMinimap } from "./ui/minimap.js";

const HERO_STORAGE_KEY = "roguelike.hero";
const LOADOUT_HERO_ICON_BY_ID = Object.freeze({
  element_mage: "./assets/UI/UI Sprites/elemental mage.png",
  death_knight: "./assets/UI/UI Sprites/death knight.png",
  dark_mage: "./assets/UI/UI Sprites/dark mage.png",
  knight: "./assets/UI/UI Sprites/knight.png",
  wind_archer: "./assets/UI/UI Sprites/wind archer.png"
});

function getInitialHeroId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("hero") || window.localStorage.getItem(HERO_STORAGE_KEY) || DEFAULT_HERO_ID;
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
        game.setHero(hero.id, { restart: game.scene?.id !== "start-menu" });
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

  const syncVisibility = () => {
    spawner.classList.toggle("is-visible", game.state === "paused");
    requestAnimationFrame(syncVisibility);
  };
  syncVisibility();
}

function mountStartMenu(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;
  const menu = document.createElement("section");
  menu.className = "start-menu";
  menu.innerHTML = `
    <div class="start-menu__panel">
      <p class="start-menu__eyebrow">Standalone Roguelike</p>
      <h2 class="start-menu__title">Start Run</h2>
      <p class="start-menu__copy">Enter loadout setup, choose a hero and three skills, then launch the run.</p>
      <div class="start-menu__actions">
        <button type="button" class="start-menu__button">Start</button>
        <button type="button" class="start-menu__button start-menu__button--secondary">Enemy Test Room</button>
      </div>
    </div>
  `;
  panel.appendChild(menu);

  const button = menu.querySelector(".start-menu__button");
  const enemyTestButton = menu.querySelector(".start-menu__button--secondary");
  button.addEventListener("click", () => {
    game.showLoadoutScene();
    canvas.focus();
  });
  enemyTestButton?.addEventListener("click", () => {
    game.showEnemyTestScene();
    canvas.focus();
  });

  const syncVisibility = () => {
    menu.classList.toggle("is-visible", game.scene?.id === "start-menu");
    requestAnimationFrame(syncVisibility);
  };
  syncVisibility();
}

const LOADOUT_DEMO_CANVAS_SIZE = Object.freeze({ width: 320, height: 360 });
const LOADOUT_DEMO_WORLD = Object.freeze({ width: 420, height: 300 });
const LOADOUT_DEMO_HERO_POSITION = Object.freeze({ x: 112, y: 186 });
const LOADOUT_DEMO_DUMMY_POSITION = Object.freeze({ x: 188, y: 148 });
const LOADOUT_DEMO_DUMMY_RESTORE_INTERVAL = 2;

function createLoadoutDemoRuntime() {
  return {
    heroId: null,
    lastTimestamp: 0,
    restoreTimer: LOADOUT_DEMO_DUMMY_RESTORE_INTERVAL,
    sandbox: null
  };
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
  const heroDef = getHeroDef(heroId || DEFAULT_HERO_ID);
  if (!heroDef || !(previewCanvas instanceof HTMLCanvasElement)) return null;

  const aimRef = {
    x: LOADOUT_DEMO_DUMMY_POSITION.x + 40,
    y: LOADOUT_DEMO_DUMMY_POSITION.y + 40
  };
  const sandbox = {
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
      width: LOADOUT_DEMO_WORLD.width,
      height: LOADOUT_DEMO_WORLD.height,
      collisionRects: []
    },
    enemies: [],
    breakables: [],
    goldDrops: [],
    ringDrops: [],
    searchables: [],
    affixWallRects: [],
    selectedRunSkills: [],
    runSkills: [],
    ringInventory: [],
    equippedRings: Array.from({ length: 10 }, () => null),
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
      stats: null,
      facing: "right",
      animClock: 0,
      isMoving: false,
      movement: createMovementState(heroDef),
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
      numberOfFingers: 1
    }
  };
  resetPlayerStats(sandbox.player, heroDef);
  sandbox.combat = createCombatState([]);
  initializeWeaponArtRuntime(sandbox);
  initializeRingRuntime(sandbox);
  sandbox.damageEnemy = (enemy, amount, meta = {}) => damageEnemy(sandbox, enemy, amount, meta);
  sandbox.demoAim = aimRef;

  const dummy = spawnEnemyByType("m_bar_ogre_1", LOADOUT_DEMO_DUMMY_POSITION.x, LOADOUT_DEMO_DUMMY_POSITION.y, { currentHp: 100 });
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
    runtime.heroId = heroId;
    runtime.restoreTimer = LOADOUT_DEMO_DUMMY_RESTORE_INTERVAL;
    runtime.sandbox = createLoadoutDemoSandbox(rootGame, heroId, previewCanvas);
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
    <div class="loadout-scene__panel">
      <div class="loadout-scene__header">
        <div>
          <p class="loadout-scene__eyebrow">Loadout Scene</p>
          <h2 class="loadout-scene__title">Choose Hero And Skills</h2>
        </div>
        <button type="button" class="loadout-scene__back">Back</button>
      </div>
      <div class="loadout-scene__body">
        <div class="loadout-scene__content">
          <div class="loadout-scene__selection">
            <section class="loadout-block">
              <div class="loadout-block__head">
                <h3>Hero</h3>
                <span class="loadout-block__count" data-role="hero-name"></span>
              </div>
              <div class="loadout-hero-grid" data-role="hero-grid"></div>
            </section>
            <section class="loadout-block">
              <div class="loadout-block__head">
                <h3>Skills</h3>
                <span class="loadout-block__count" data-role="skill-count"></span>
              </div>
              <div class="loadout-skill-grid" data-role="skill-grid"></div>
            </section>
          </div>
          <aside class="loadout-preview">
            <div class="loadout-preview__frame">
              <canvas
                class="loadout-preview__canvas"
                data-role="preview-canvas"
                width="${LOADOUT_DEMO_CANVAS_SIZE.width}"
                height="${LOADOUT_DEMO_CANVAS_SIZE.height}"
              ></canvas>
            </div>
            <div class="loadout-preview__head">
              <p class="loadout-scene__eyebrow">Hero Preview</p>
              <h3 class="loadout-preview__title" data-role="preview-name">No Hero Selected</h3>
              <p class="loadout-preview__weapon" data-role="preview-weapon-name">Weapon Art</p>
              <p class="loadout-preview__description" data-role="preview-weapon-description">Select a hero to inspect their combat style.</p>
              <p class="loadout-preview__dummy-hp" data-role="preview-dummy-hp">Dummy HP 100 / 100</p>
            </div>
          </aside>
        </div>
      </div>
      <div class="loadout-scene__footer">
        <p class="loadout-scene__hint">Choose exactly 3 skills to bring into the run. The current gameplay pass supports the implemented projectile and utility skill set.</p>
        <button type="button" class="loadout-scene__start">Launch Run</button>
      </div>
    </div>
  `;
  panel.appendChild(loadout);

  const heroGrid = loadout.querySelector('[data-role="hero-grid"]');
  const heroName = loadout.querySelector('[data-role="hero-name"]');
  const skillCount = loadout.querySelector('[data-role="skill-count"]');
  const skillGrid = loadout.querySelector('[data-role="skill-grid"]');
  const previewName = loadout.querySelector('[data-role="preview-name"]');
  const previewWeaponName = loadout.querySelector('[data-role="preview-weapon-name"]');
  const previewWeaponDescription = loadout.querySelector('[data-role="preview-weapon-description"]');
  const previewDummyHp = loadout.querySelector('[data-role="preview-dummy-hp"]');
  const previewCanvas = loadout.querySelector('[data-role="preview-canvas"]');
  const backButton = loadout.querySelector(".loadout-scene__back");
  const startButton = loadout.querySelector(".loadout-scene__start");
  const heroes = getHeroList();
  const skills = getAllExtractedSkills().filter((skill) => PLAYABLE_RUN_SKILL_IDS.includes(skill.id));
  const previewRuntime = createLoadoutDemoRuntime();
  let lastSignature = "";

  backButton.addEventListener("click", () => {
    game.showStartMenu();
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
    }
  });

  const renderLoadout = (timestamp = performance.now()) => {
    const open = game.scene?.id === "loadout";
    loadout.classList.toggle("is-visible", open);
    const dt = previewRuntime.lastTimestamp ? Math.min(0.05, (timestamp - previewRuntime.lastTimestamp) / 1000) : 0;
    previewRuntime.lastTimestamp = timestamp;
    const signature = JSON.stringify({
      open,
      hero: game.loadoutDraft?.heroId || null,
      skills: game.loadoutDraft?.skillIds || []
    });
    if (signature !== lastSignature) {
      lastSignature = signature;
      const selectedHero = game.loadoutDraft?.heroId || game.heroId;
      const selectedSkills = game.loadoutDraft?.skillIds || [];
      const selectedHeroDef = heroes.find((hero) => hero.id === selectedHero) || null;
      const selectedWeaponArt = selectedHeroDef ? getWeaponArtDef(selectedHeroDef.defaultWeaponArt) : null;
      heroName.textContent = selectedHeroDef ? "Choose a hero" : "None";
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

      if (previewRuntime.heroId !== selectedHero) {
        previewRuntime.heroId = selectedHero;
        previewRuntime.restoreTimer = LOADOUT_DEMO_DUMMY_RESTORE_INTERVAL;
        previewRuntime.sandbox = null;
      }

      heroGrid.innerHTML = "";
      for (const hero of heroes) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `loadout-hero-card${selectedHero === hero.id ? " is-active" : ""}`;
        button.dataset.loadoutHero = hero.id;
        const iconSrc = LOADOUT_HERO_ICON_BY_ID[hero.id];
        button.innerHTML = `
          <img class="loadout-hero-card__icon" src="${iconSrc}" alt="${hero.name}">
        `;
        heroGrid.appendChild(button);
      }

      skillGrid.innerHTML = "";
      for (const skill of skills) {
        const selected = selectedSkills.includes(skill.id);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `loadout-skill-card${selected ? " is-active" : ""}`;
        button.dataset.loadoutSkill = skill.id;
        const icon = getSkillIconDomStyle(game.assets, skill.id);
        const iconMarkup = icon
          ? `<span class="loadout-skill-card__icon" aria-hidden="true"><img class="loadout-skill-card__icon-image" src="${icon.src}" style="width:${icon.width}px;height:${icon.height}px;margin-left:${icon.marginLeft}px;margin-top:${icon.marginTop}px;" alt=""></span>`
          : `<span class="loadout-skill-card__icon" aria-hidden="true"></span>`;
        button.innerHTML = `
          <span class="loadout-skill-card__top">
            ${iconMarkup}
            <strong>${skill.name}</strong>
          </span>
          <small>${skill.category} | ${skill.baseCd}s</small>
          <span>${skill.desc}</span>
        `;
        skillGrid.appendChild(button);
      }
    }

    if (open) {
      const previewHeroId = game.loadoutDraft?.heroId || game.heroId || null;
      const sandbox = updateLoadoutDemoSandbox(game, previewRuntime, previewCanvas, previewHeroId, dt);
      if (sandbox && previewCanvas instanceof HTMLCanvasElement) {
        const previewCtx = previewCanvas.getContext("2d");
        if (previewCtx) renderCombatPreview(previewCtx, sandbox);
        const dummy = sandbox.demoDummy;
        previewDummyHp.textContent = dummy
          ? `Dummy HP ${Math.max(0, Math.ceil(dummy.hp))} / ${dummy.maxHp}`
          : "Dummy HP -- / --";
      }
    } else {
      previewRuntime.sandbox = null;
      previewRuntime.restoreTimer = LOADOUT_DEMO_DUMMY_RESTORE_INTERVAL;
    }
    requestAnimationFrame(renderLoadout);
  };

  renderLoadout();
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

  const renderEnemyTest = () => {
    const open = game.scene?.id === "enemy-test";
    room.classList.toggle("is-visible", open);
    if (open) {
      const uiOpen = game.enemyTest?.uiOpen !== false;
      contentPanel.classList.toggle("is-hidden", !uiOpen);
      room.classList.toggle("is-collapsed", !uiOpen);
      if (select.value !== (game.enemyTest?.selectedTypeId || "")) {
        select.value = game.enemyTest?.selectedTypeId || ids[0]?.id || "";
      }
      if (tacticSelect.value !== (game.enemyTest?.selectedTactic || "")) {
        tacticSelect.value = game.enemyTest?.selectedTactic || tacticOptions[0].id;
      }
      const enemy = game.enemyTest?.controlledEnemy || null;
      const runtime = enemy?.attackRuntime || null;
      const recorder = game.enemyTest?.movementRecorder || null;
      const persistStatus = game.enemyTest?.lastPersistStatus || null;
      enemyName.textContent = enemy?.name || "No enemy";
      if (movementStatus) {
        if (recorder?.isRecording) {
          movementStatus.textContent = `Recording ${recorder.elapsed.toFixed(1)}s ${game.enemyTest?.selectedTactic || ""}`;
        } else if (recorder?.savedPattern) {
          movementStatus.textContent = `Saved reference ${recorder.savedPattern.tacticId || ""} ${recorder.savedPattern.steps.length} steps / ${recorder.savedPattern.totalDuration.toFixed(1)}s`;
        } else {
          movementStatus.textContent = "Idle";
        }
      }
      if (persistStatus && movementStatus) {
        movementStatus.textContent = `${movementStatus.textContent} | ${persistStatus.message}`;
      }
      recordButtons.forEach((button) => {
        const action = button.getAttribute("data-record-action");
        if (action === "start") button.disabled = !!recorder?.isRecording;
        if (action === "stop") button.disabled = !recorder?.isRecording;
      });
      attackList.innerHTML = "";
      const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
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
    requestAnimationFrame(renderEnemyTest);
  };

  renderEnemyTest();
}

function createRingIconHtml(ringDef) {
  const style = getRingItemIconStyle(ringDef, 22);
  return `<span class="ring-icon" style="${Object.entries(style)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}:${value}`)
    .join(";")}"></span>`;
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

function mountRingInventory(game, canvas) {
  const panel = canvas.closest(".game-panel");
  if (!panel) return;
  const dock = document.createElement("button");
  dock.type = "button";
  dock.className = "ring-inventory-dock";
  dock.textContent = "Inventory";
  panel.appendChild(dock);

  const inventory = document.createElement("section");
  inventory.className = "ring-inventory";
  inventory.innerHTML = `
    <div class="ring-inventory__header">
      <div>
        <p class="ring-inventory__eyebrow">Run Inventory</p>
        <h2 class="ring-inventory__title">Rings</h2>
      </div>
      <p class="ring-inventory__hint">Press <code>F</code> near a chest and spend gold to open it instantly. Press <code>I</code> to toggle this overlay.</p>
    </div>
    <div class="ring-inventory__layout">
      <section class="ring-section">
        <div class="ring-section__head">
          <h3>Inventory</h3>
          <span class="ring-section__count" data-role="inventory-count"></span>
        </div>
        <div class="ring-list" data-role="inventory-list"></div>
      </section>
      <section class="ring-section">
        <div class="ring-section__head">
          <h3>Equipped</h3>
          <span class="ring-section__count" data-role="equipped-count"></span>
        </div>
        <div class="ring-slot-board" data-role="equipped-list"></div>
      </section>
    </div>
  `;
  panel.appendChild(inventory);

  const inventoryCount = inventory.querySelector('[data-role="inventory-count"]');
  const inventoryList = inventory.querySelector('[data-role="inventory-list"]');
  const equippedCount = inventory.querySelector('[data-role="equipped-count"]');
  const equippedList = inventory.querySelector('[data-role="equipped-list"]');
  let lastSignature = "";

  const syncInventoryScale = () => {
    const canvasWidth = canvas.getBoundingClientRect().width || 960;
    const scaledWidth = Math.round((canvasWidth / 960) * 740);
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
    const equipButton = target.closest("[data-ring-equip]");
    if (equipButton instanceof HTMLElement) {
      game.equipRing(Number(equipButton.dataset.ringEquip));
      canvas.focus();
      return;
    }
    const unequipButton = target.closest("[data-ring-unequip]");
    if (unequipButton instanceof HTMLElement) {
      game.unequipRing(Number(unequipButton.dataset.ringUnequip));
      canvas.focus();
    }
  });

  const renderInventory = () => {
    const shouldShow = !game.scene && game.state !== "loading" && game.inventoryOverlayOpen;
    inventory.classList.toggle("is-open", shouldShow);
    dock.classList.toggle("is-active", shouldShow);
    dock.classList.toggle("is-hidden", !!game.scene);
    const fingerCount = Math.max(0, Math.floor(game.player.numberOfFingers || 0));
    const backgroundFingerCount = Math.min(10, fingerCount);
    const boardBackground = RING_HAND_BACKGROUND_BY_FINGERS[backgroundFingerCount] || RING_HAND_BACKGROUND_BY_FINGERS[10];
    equippedList.style.setProperty("--ring-hand-background", `url("${boardBackground}")`);
    const signature = JSON.stringify({
      inventory: game.ringInventory.map((ring) => ring.instanceId),
      equipped: game.equippedRings.map((ring) => ring?.instanceId || null),
      open: shouldShow,
      fingers: fingerCount
    });
    if (signature !== lastSignature) {
      lastSignature = signature;
      inventoryCount.textContent = `${game.ringInventory.length} stored`;
      equippedCount.textContent = `${game.equippedRings.filter(Boolean).length}/${game.getAvailableRingSlotCount()} slots`;

      inventoryList.innerHTML = "";
      if (!game.ringInventory.length) {
        inventoryList.innerHTML = `<div class="ring-empty">Pick up dropped rings to store them here.</div>`;
      } else {
        for (const ring of game.ringInventory) {
          const ringDef = getRingDefById(ring.ringId);
          if (!ringDef) continue;
          const canEquip = game.equippedRings.some((entry, index) => index < game.getAvailableRingSlotCount() && entry == null);
          const article = document.createElement("article");
          article.className = "ring-card";
          article.innerHTML = `
            <div class="ring-card__meta">
              ${createRingIconHtml(ringDef)}
              <div>
                <strong>${ringDef.name}</strong>
                <span style="color:${getRingRarityColor(ringDef.dropRarity)}">${getRingRarityLabel(ringDef.dropRarity)}</span>
              </div>
            </div>
            <p>${ringDef.description}</p>
            <button type="button" class="ring-card__button" data-ring-equip="${ring.instanceId}" ${canEquip ? "" : "disabled"}>Equip</button>
          `;
          inventoryList.appendChild(article);
        }
      }

      equippedList.innerHTML = "";
      const visibleSlotCount = game.getAvailableRingSlotCount();
      game.equippedRings.slice(0, visibleSlotCount).forEach((ring, index) => {
        const position = RING_SLOT_POSITIONS[index] || { x: 0, y: 0, w: 18, h: 18 };
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = `ring-slot${ring ? " is-filled" : ""}`;
        if (ring) slot.dataset.ringUnequip = String(index);
        slot.style.setProperty("--slot-x", `${(position.x / RING_SLOT_REFERENCE_SIZE.width) * 100}%`);
        slot.style.setProperty("--slot-y", `${(position.y / RING_SLOT_REFERENCE_SIZE.height) * 100}%`);
        slot.style.setProperty("--slot-w", `${(position.w / RING_SLOT_REFERENCE_SIZE.width) * 100}%`);
        slot.style.setProperty("--slot-h", `${(position.h / RING_SLOT_REFERENCE_SIZE.height) * 100}%`);
        if (!ring) {
          slot.disabled = true;
          slot.setAttribute("aria-label", `Ring slot ${index + 1} empty`);
          slot.innerHTML = "";
        } else {
          const ringDef = getRingDefById(ring.ringId);
          slot.setAttribute("aria-label", `Unequip ${ringDef.name} from slot ${index + 1}`);
          slot.innerHTML = `${createRingIconHtml(ringDef)}`;
        }
        equippedList.appendChild(slot);
      });
    }
    requestAnimationFrame(renderInventory);
  };

  renderInventory();
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
    <div class="character-overlay__hero" data-role="character-hero"></div>
    <div class="character-overlay__grid" data-role="character-grid"></div>
  `;
  panel.appendChild(overlay);

  const heroBlock = overlay.querySelector('[data-role="character-hero"]');
  const statGrid = overlay.querySelector('[data-role="character-grid"]');
  let lastSignature = "";

  dock.addEventListener("click", () => {
    game.toggleCharacterOverlay();
    canvas.focus();
  });

  const renderOverlay = () => {
    const shouldShow = !game.scene && game.state !== "loading" && game.characterOverlayOpen;
    overlay.classList.toggle("is-open", shouldShow);
    dock.classList.toggle("is-active", shouldShow);
    dock.classList.toggle("is-hidden", !!game.scene);

    const statRows = [
      ["Health", `${Math.ceil(game.player.hp)} / ${game.player.maxHp}`],
      ["Attack", formatCharacterStatValue(getPlayerStat(game.player, "attack"))],
      ["Move Speed", formatCharacterStatValue(getPlayerStat(game.player, "moveSpeed"))],
      ["Attacks / Sec", formatCharacterStatValue(getPlayerStat(game.player, "attackSpeed"), { fixed: 2 })]
    ];

    const signature = JSON.stringify({
      open: shouldShow,
      heroId: game.heroId,
      state: game.state,
      hp: game.player.hp,
      maxHp: game.player.maxHp,
      stats: statRows
    });

    if (signature !== lastSignature) {
      lastSignature = signature;
      heroBlock.innerHTML = `
        <div>
          <strong>${game.heroDef.name}</strong>
          <span>${getWeaponArtDef(game.weaponArt?.id)?.name || game.weaponArt?.id || "Unknown Art"}</span>
        </div>
        <p>${game.heroDef.description}</p>
      `;
      statGrid.innerHTML = statRows
        .map(([label, value]) => `
          <article class="character-stat">
            <span class="character-stat__label">${label}</span>
            <strong class="character-stat__value">${value}</strong>
          </article>
        `)
        .join("");
    }

    requestAnimationFrame(renderOverlay);
  };

  renderOverlay();
}

async function bootstrap() {
  const canvas = document.getElementById("game");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Game canvas was not found.");
  }

  const game = new RoguelikeGame(canvas, { heroId: getInitialHeroId() });
  initMinimap();
  await game.init();
  mountStartMenu(game, canvas);
  mountLoadoutScene(game, canvas);
  mountEnemyTestScene(game, canvas);
  mountPauseDebugSpawner(game, canvas);
  mountRingInventory(game, canvas);
  mountCharacterOverlay(game, canvas);
  window.__roguelikeGame = game;
  game.start();
}

bootstrap().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<pre style="color:#fecaca;padding:16px;">${String(error?.stack || error)}</pre>`
  );
});
