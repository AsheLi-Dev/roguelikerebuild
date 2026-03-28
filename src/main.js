import { DEFAULT_HERO_ID, getHeroList } from "./data/heroes.js";
import { getEnemyDef } from "./data/enemies.js";
import { getUndeadEnemyDef } from "./data/undead-enemies.js";
import { getWeaponArtDef } from "./data/weapon-arts.js";
import { RoguelikeGame } from "./game/roguelike-game.js";
import { getAllEnemyTypeIds } from "./systems/enemies.js";

const HERO_STORAGE_KEY = "roguelike.hero";

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
        game.setHero(hero.id);
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

async function bootstrap() {
  const canvas = document.getElementById("game");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Game canvas was not found.");
  }

  const game = new RoguelikeGame(canvas, { heroId: getInitialHeroId() });
  await game.init();
  mountHeroSelector(game, canvas);
  mountPauseDebugSpawner(game, canvas);
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
