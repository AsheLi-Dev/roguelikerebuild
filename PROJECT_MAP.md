# Project Map

## Purpose

This repo is a browser-based canvas roguelike rebuild. The runtime is plain JavaScript with no build step and is served by a small Node static server.

## Top-Level Layout

```text
/
|- index.html                 App shell and canvas host
|- styles.css                 HUD, overlays, menu, and scene styling
|- favicon.ico                Browser tab icon
|- package.json               Minimal scripts (`start`, `serve`)
|- PROJECT_MAP.md             Human-readable repo navigation guide
|- scripts/
|  `- static-dev-server.mjs   Local dev server
|- assets/                    Sprites, VFX, audio, UI sheets, biome art, items
`- src/
   |- main.js                 DOM wiring, bootstrapping, scene/UI mounting
   |- core/                   Shared engine utilities
   |- data/                   Static content definitions and tuning tables
   |- game/                   Main game runtime coordinator
   |- render/                 Canvas renderer
   |- scenes/                 Start menu, loadout, enemy test flows
   |- systems/                Gameplay/runtime systems
   `- ui/                     UI helpers such as minimap
```

## Runtime Entry Flow

1. `index.html` loads [src/main.js](C:\Users\2jonl\Roguelike Rebuild\src\main.js).
2. [src/main.js](C:\Users\2jonl\Roguelike Rebuild\src\main.js) mounts the canvas app, scene UI, debug hooks, and instantiates [src/game/roguelike-game.js](C:\Users\2jonl\Roguelike Rebuild\src\game\roguelike-game.js).
3. `RoguelikeGame.init()` loads assets, sets up state, and opens the start menu flow.
4. `RoguelikeGame.start()` begins the animation loop.
5. The main loop updates either:
   - a scene (`start-menu`, `loadout`, `enemy-test`), or
   - active gameplay state, then renders the frame.

## Main Runtime Owner

[src/game/roguelike-game.js](C:\Users\2jonl\Roguelike Rebuild\src\game\roguelike-game.js) is the central coordinator. It owns:

- player state
- room/world state
- enemy, projectile, and combat state
- ring, skill, searchable, breakable, and gold state
- scene transitions and test-scene setup
- room loading, restart, and run reset logic

If you need the main game loop or want to know where systems are called from, start here.

## Important Systems

### Core gameplay

- [src/systems/movement.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\movement.js)
  Player movement, dash/slide/sprint, collision, and movement-state checks.
- [src/systems/combat.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\combat.js)
  Player attacks, projectiles, hit resolution, damage flow, and combat updates.
- [src/systems/enemies.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\enemies.js)
  Enemy spawning, main enemy update integration, and death cleanup.
- [src/systems/undead-runtime.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\undead-runtime.js)
  Enemy runtime behavior/attack execution for the current enemy roster.
- [src/systems/status-manager.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\status-manager.js)
  Shared status effect handling such as slow, stun, poison, and curse.

### Build/progression/combat extensions

- [src/systems/skills.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\skills.js)
  Active skill runtime, cooldowns, spawned effects, and proc behavior.
- [src/systems/weapon-art-runtime.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\weapon-art-runtime.js)
  Basic attack and weapon-art execution.
- [src/systems/rings.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\rings.js)
  Ring modifiers, derived stat hooks, and runtime application.
- [src/systems/enemy-affixes.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\enemy-affixes.js)
  Affix assignment, modifier hooks, and affix-driven callbacks.

### World/object systems

- [src/systems/world-generation.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\world-generation.js)
  Room generation, biome assembly, and encounter-space layout.
- [src/systems/biome-floor.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\biome-floor.js)
  Floor art placement and biome floor helpers.
- [src/systems/biome-upper-cliff.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\biome-upper-cliff.js)
  Upper cliff generation helpers.
- [src/systems/map-rock-border.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\map-rock-border.js)
  Rock-border generation/layout helpers.
- [src/systems/upper-cliff-ground-mask.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\upper-cliff-ground-mask.js)
  Cliff masking helpers for biome composition.
- [src/systems/breakables.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\breakables.js)
  Destructible object setup, collision, destruction, and rewards.
- [src/systems/searchables.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\searchables.js)
  Searchable object setup and reward payout behavior.
- [src/systems/gold.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\gold.js)
  Gold spawning, attraction, collection, and pickup effects.

### Enemy support logic

- [src/systems/enemy-awareness.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\enemy-awareness.js)
  Detection and awareness helpers.
- [src/systems/enemy-targeting.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\enemy-targeting.js)
  Enemy target selection, including test-scene target logic.
- [src/systems/tactical-movement.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\tactical-movement.js)
  Tactical movement profiles and enemy movement support.

## Data Files

[src/data](C:\Users\2jonl\Roguelike Rebuild\src\data) holds mostly static definitions:

- `heroes.js`: playable hero stats, loadouts, and kits
- `weapon-arts.js`, `weapon-art-progression.js`, `weapon-art-upgrades.js`: weapon-art definitions and upgrade/progression tables
- `extracted-skills.js`: skill definitions and metadata
- `skill-icons.js`: skill icon lookup/configuration
- `rings.js`: ring item definitions
- `undead-enemies.js`, `barbarian-enemies.js`, `enemies.js`: enemy definitions and combined roster wiring
- `enemy-affixes.js`: affix definitions
- `enemy-spawn-plans.js`: spawn planning/encounter tables
- `tactical-movement-profiles.json`: enemy movement tuning profiles
- `enemy-movement-patterns.json`: movement pattern data
- `searchables.js`, `breakables.js`: interactable object definitions
- `terrain-rock-border-atlas.js`: terrain atlas / border lookup data

If a behavior feels data-driven, check `src/data` before editing a system.

## Rendering, Scenes, And UI

- [src/render/renderer.js](C:\Users\2jonl\Roguelike Rebuild\src\render\renderer.js)
  Main canvas renderer for world tiles, entities, projectiles, VFX, and overlays.
- [src/scenes/start-menu-scene.js](C:\Users\2jonl\Roguelike Rebuild\src\scenes\start-menu-scene.js)
  Start menu flow and scene logic.
- [src/scenes/loadout-scene.js](C:\Users\2jonl\Roguelike Rebuild\src\scenes\loadout-scene.js)
  Hero/loadout selection scene.
- [src/scenes/enemy-test-scene.js](C:\Users\2jonl\Roguelike Rebuild\src\scenes\enemy-test-scene.js)
  Enemy test harness scene.
- [src/ui/minimap.js](C:\Users\2jonl\Roguelike Rebuild\src\ui\minimap.js)
  Minimap setup and draw helpers.

## Core Utilities

- [src/core/assets.js](C:\Users\2jonl\Roguelike Rebuild\src\core\assets.js)
  Asset pack loading and asset registration.
- [src/core/input.js](C:\Users\2jonl\Roguelike Rebuild\src\core\input.js)
  Keyboard/mouse input abstraction.
- [src/core/camera.js](C:\Users\2jonl\Roguelike Rebuild\src\core\camera.js)
  Camera follow/snap logic.
- [src/core/runtime-utils.js](C:\Users\2jonl\Roguelike Rebuild\src\core\runtime-utils.js)
  Shared math, geometry, and runtime helper utilities.

## Asset Layout

The asset tree is now broad enough that it helps to think in packs:

- `assets/heroes/`: hero sprite sheets and animation sets
- `assets/enemies/undead/`, `assets/enemies/Barbarian/`, `assets/enemies/Enemies/`: current enemy art grouped by faction/source pack
- `assets/projectiles/`: projectile sprites including newer spell/axe assets
- `assets/items/`: item and pickup sheets
- `assets/Breakables/`: crate, urn, barrel, crystal, and similar destructible art
- `assets/Combat VFX/`: combat effect sprite packs
- `assets/Audio/`: pickup and combat sounds
- `assets/UI/`: UI sprite sheets and HUD art
- `assets/biomes/openworld/`: trees, wells, chests, flowers, and biome decoration art

The work tree also shows removal of several older loose enemy/world PNGs in favor of the newer grouped asset layout.

## Fast Navigation Guide

- Want to change the game loop: [src/game/roguelike-game.js](C:\Users\2jonl\Roguelike Rebuild\src\game\roguelike-game.js)
- Want to change bootstrap or DOM/UI mounting: [src/main.js](C:\Users\2jonl\Roguelike Rebuild\src\main.js)
- Want to change player attacks or damage: [src/systems/combat.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\combat.js)
- Want to change movement feel: [src/systems/movement.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\movement.js)
- Want to change enemy behavior: [src/systems/undead-runtime.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\undead-runtime.js), [src/systems/tactical-movement.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\tactical-movement.js), and [src/systems/enemy-targeting.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\enemy-targeting.js)
- Want to tune enemies: [src/data/enemies.js](C:\Users\2jonl\Roguelike Rebuild\src\data\enemies.js), [src/data/undead-enemies.js](C:\Users\2jonl\Roguelike Rebuild\src\data\undead-enemies.js), [src/data/barbarian-enemies.js](C:\Users\2jonl\Roguelike Rebuild\src\data\barbarian-enemies.js), and [src/data/enemy-affixes.js](C:\Users\2jonl\Roguelike Rebuild\src\data\enemy-affixes.js)
- Want to change skills, rings, or weapon arts: [src/systems/skills.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\skills.js), [src/systems/rings.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\rings.js), and [src/systems/weapon-art-runtime.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\weapon-art-runtime.js)
- Want to change room generation or biome composition: [src/systems/world-generation.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\world-generation.js), [src/systems/biome-floor.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\biome-floor.js), and [src/systems/biome-upper-cliff.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\biome-upper-cliff.js)
- Want to change rendering/UI: [src/render/renderer.js](C:\Users\2jonl\Roguelike Rebuild\src\render\renderer.js), [src/ui/minimap.js](C:\Users\2jonl\Roguelike Rebuild\src\ui\minimap.js), [src/main.js](C:\Users\2jonl\Roguelike Rebuild\src\main.js), and [styles.css](C:\Users\2jonl\Roguelike Rebuild\styles.css)

## Notes

- This project has no build tooling and no formal automated test suite.
- Runtime wiring is intentionally direct rather than framework-driven.
- [src/main.js](C:\Users\2jonl\Roguelike Rebuild\src\main.js) remains a major bootstrap/UI hub.
- [src/game/roguelike-game.js](C:\Users\2jonl\Roguelike Rebuild\src\game\roguelike-game.js) and [src/systems/undead-runtime.js](C:\Users\2jonl\Roguelike Rebuild\src\systems\undead-runtime.js) are still the two biggest navigation hubs.
