import { centerOf, distance } from "../core/runtime-utils.js";
import { getRingDefsByDropRarity } from "../data/rings.js";
import { spawnDamagePopup } from "./combat.js";
import { createGoldDrop } from "./gold.js";
import { spawnEnemyByType } from "./enemies.js";
import { createRingDrop } from "./searchables.js";
import { grantAffinityXp } from "./interactable-affinity.js";

// ---------------------------------------------------------------------------
// Tuning constants — adjust here without touching logic
// ---------------------------------------------------------------------------
const SPIRIT_SPEED = 120;            // px/s while guiding
const SPIRIT_BOB_SPEED = 2.2;        // radians/s for hover animation
const SPIRIT_BOB_AMPLITUDE = 4;      // px vertical bob
const ARRIVAL_THRESHOLD = 32;        // px — counts as "arrived" at stop
const MIN_STOP_DISTANCE = 200;       // px minimum between consecutive stops
const STOP_COUNT = 3;

const GOLD_PAYOUT_STOP0 = 18;        // total gold value at stop 0
const GOLD_PAYOUT_STOP1 = 28;        // total gold value at stop 1
const GOLD_SCATTER_COUNT = 4;        // number of individual gold drops per payout

const MINION_WAVE_COUNT = 3;
const ELITE_WAVE_COUNT_STOP1 = 2;
const ELITE_WAVE_COUNT_STOP2 = 3;

// Miniboss for the spirit encounter — NOT the arcane elemental (reserved for boss room)
const MINIBOSS_ENEMY_TYPE = "m_ud_dark_lord_2";

// Enemy pool for minion/elite encounters — varied undead types
const ENCOUNTER_ENEMY_POOL = [
  "m_ud_warrior",
  "m_ud_brute",
  "m_ud_archer_5",
  "m_ud_berserker_4",
  "m_ud_dark_knight_3",
];

// ---------------------------------------------------------------------------
// Outcome pools per stop — weighted entries
// ---------------------------------------------------------------------------
const STOP_OUTCOME_POOLS = [
  // Stop 0 — light hook
  [
    { outcome: "goldPayout",  weight: 60 },
    { outcome: "minionWave",  weight: 40 },
  ],
  // Stop 1 — more interesting
  [
    { outcome: "goldPayout",  weight: 40 },
    { outcome: "commonRing",  weight: 35 },
    { outcome: "eliteWave",   weight: 25 },
  ],
  // Stop 2 — climax
  [
    { outcome: "uncommonRing",  weight: 40 },
    { outcome: "eliteWaveRing", weight: 35 },
    { outcome: "miniboss",      weight: 25 },
  ],
];

// ---------------------------------------------------------------------------
// Weighted random pick from a pool
// ---------------------------------------------------------------------------
function pickWeighted(pool) {
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.outcome;
  }
  return pool[pool.length - 1].outcome;
}

// ---------------------------------------------------------------------------
// Pick a random enemy typeId from the encounter pool
// ---------------------------------------------------------------------------
function pickEnemyType() {
  return ENCOUNTER_ENEMY_POOL[Math.floor(Math.random() * ENCOUNTER_ENEMY_POOL.length)];
}

// ---------------------------------------------------------------------------
// Collect playable cell centers from the world grid
// ---------------------------------------------------------------------------
function getPlayableCellCenters(world) {
  const centers = [];
  const grid = world.archetypeGrid?.grid;
  if (!grid) return centers;
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      const arch = grid[row][col];
      if (!arch || arch === "empty" || arch === "start") continue;
      const bounds = world.biomeCellBounds(col, row);
      centers.push({ x: bounds.x + bounds.w * 0.5, y: bounds.y + bounds.h * 0.5 });
    }
  }
  return centers;
}

// ---------------------------------------------------------------------------
// Choose 3 well-spaced stop destinations
// ---------------------------------------------------------------------------
function chooseStopDestinations(world, spiritX, spiritY) {
  const candidates = getPlayableCellCenters(world);
  // Shuffle
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const chosen = [];
  for (const candidate of candidates) {
    // Must be far enough from spirit start
    if (distance(candidate.x, candidate.y, spiritX, spiritY) < MIN_STOP_DISTANCE) continue;
    // Must be far enough from already-chosen stops
    const tooClose = chosen.some((c) => distance(candidate.x, candidate.y, c.x, c.y) < MIN_STOP_DISTANCE);
    if (tooClose) continue;
    chosen.push(candidate);
    if (chosen.length >= STOP_COUNT) break;
  }

  // Fallback: if not enough spaced candidates, relax distance and fill
  if (chosen.length < STOP_COUNT) {
    for (const candidate of candidates) {
      if (chosen.some((c) => c.x === candidate.x && c.y === candidate.y)) continue;
      chosen.push(candidate);
      if (chosen.length >= STOP_COUNT) break;
    }
  }

  return chosen.slice(0, STOP_COUNT);
}

// ---------------------------------------------------------------------------
// Activation — called from openSearchable dispatch
// ---------------------------------------------------------------------------
export function activateTreasureSpirit(game, searchable) {
  if (!game.world || game.treasureSpirit) return false;

  const spiritX = searchable.x + searchable.w * 0.5;
  const spiritY = searchable.y + searchable.h * 0.5;

  const destinations = chooseStopDestinations(game.world, spiritX, spiritY);
  if (destinations.length < STOP_COUNT) return false;

  const stops = destinations.map((dest, i) => ({
    destX: dest.x,
    destY: dest.y,
    outcome: pickWeighted(STOP_OUTCOME_POOLS[i]),
  }));

  game.treasureSpirit = {
    searchableId: searchable.id,
    x: spiritX,
    y: spiritY,
    state: "guiding",
    stopIndex: 0,
    stops,
    encounterEnemyIds: new Set(),
    bobClock: 0,
  };

  // Mark the searchable open immediately so the spawn-point prompt disappears.
  // advanceSpirit will re-mark it open on completion (it's already open, no-op).
  searchable.isOpen = true;
  searchable.openTimer = 0;

  grantAffinityXp(game, "treasureSpirit");

  spawnDamagePopup(game, spiritX, spiritY - 20, "Treasure Spirit awakens!", {
    color: "#c4b5fd",
    strokeColor: "rgba(46, 16, 101, 0.96)",
    duration: 1.4,
    riseSpeed: 22,
    scale: 1.05
  });

  return true;
}

// ---------------------------------------------------------------------------
// Per-frame update — called from game loop
// ---------------------------------------------------------------------------
export function updateTreasureSpirit(game, dt) {
  const spirit = game.treasureSpirit;
  if (!spirit) return;

  spirit.bobClock += dt;

  if (spirit.state === "guiding") {
    const stop = spirit.stops[spirit.stopIndex];
    const dx = stop.destX - spirit.x;
    const dy = stop.destY - spirit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= ARRIVAL_THRESHOLD) {
      spirit.x = stop.destX;
      spirit.y = stop.destY;
      spirit.state = "waitingAtStop";
      resolveStop(game, spirit);
    } else {
      const move = Math.min(SPIRIT_SPEED * dt, dist);
      spirit.x += (dx / dist) * move;
      spirit.y += (dy / dist) * move;
    }
    return;
  }

  if (spirit.state === "combatLocked") {
    // Check if all encounter enemies are dead
    const livingIds = new Set(game.enemies.map((e) => e.id));
    const anyAlive = [...spirit.encounterEnemyIds].some((id) => livingIds.has(id));
    if (!anyAlive) {
      grantStopReward(game, spirit);
    }
  }
}

// ---------------------------------------------------------------------------
// Resolve the current stop's outcome
// ---------------------------------------------------------------------------
function resolveStop(game, spirit) {
  const stop = spirit.stops[spirit.stopIndex];
  const { destX, destY, outcome } = stop;

  if (outcome === "goldPayout") {
    const goldValue = spirit.stopIndex === 0 ? GOLD_PAYOUT_STOP0 : GOLD_PAYOUT_STOP1;
    spawnGoldAtDest(game, destX, destY, goldValue);
    spawnDamagePopup(game, destX, destY - 18, `+${goldValue} Gold`, {
      color: "#facc15",
      strokeColor: "rgba(120, 53, 15, 0.95)",
      duration: 1.1,
      riseSpeed: 26,
      scale: 1
    });
    advanceSpirit(game, spirit);
    return;
  }

  if (outcome === "commonRing") {
    grantStopReward(game, spirit);
    return;
  }

  if (outcome === "uncommonRing") {
    grantStopReward(game, spirit);
    return;
  }

  if (outcome === "minionWave") {
    spawnDamagePopup(game, destX, destY - 18, "Spirits stir...", {
      color: "#fca5a5",
      strokeColor: "rgba(127, 29, 29, 0.95)",
      duration: 1.1,
      riseSpeed: 20,
      scale: 0.95
    });
    spawnEncounterEnemies(game, spirit, destX, destY, "minion", MINION_WAVE_COUNT);
    spirit.state = "combatLocked";
    return;
  }

  if (outcome === "eliteWave" || outcome === "eliteWaveRing") {
    spawnDamagePopup(game, destX, destY - 18, "Elite guardians!", {
      color: "#fbbf24",
      strokeColor: "rgba(120, 53, 15, 0.95)",
      duration: 1.1,
      riseSpeed: 20,
      scale: 0.95
    });
    const count = spirit.stopIndex === 1 ? ELITE_WAVE_COUNT_STOP1 : ELITE_WAVE_COUNT_STOP2;
    spawnEncounterEnemies(game, spirit, destX, destY, "elite", count);
    spirit.state = "combatLocked";
    return;
  }

  if (outcome === "miniboss") {
    spawnDamagePopup(game, destX, destY - 18, "A guardian awakens!", {
      color: "#f87171",
      strokeColor: "rgba(127, 29, 29, 0.96)",
      duration: 1.3,
      riseSpeed: 20,
      scale: 1.05
    });
    spawnEncounterEnemies(game, spirit, destX, destY, "miniBoss", 1);
    spirit.state = "combatLocked";
  }
}

// ---------------------------------------------------------------------------
// Grant the reward for the current stop (called after combat or immediately)
// ---------------------------------------------------------------------------
function grantStopReward(game, spirit) {
  const stop = spirit.stops[spirit.stopIndex];
  const { destX, destY, outcome } = stop;

  if (outcome === "minionWave") {
    // Minions drop their own gold naturally — no extra reward needed
    advanceSpirit(game, spirit);
    return;
  }

  if (outcome === "commonRing") {
    const pool = getRingDefsByDropRarity("normal");
    if (pool.length) {
      const ringDef = pool[Math.floor(Math.random() * pool.length)];
      createRingDrop(game, ringDef.ringId, destX, destY);
      spawnDamagePopup(game, destX, destY - 18, ringDef.name, {
        color: "#d1d5db",
        strokeColor: "rgba(15, 23, 42, 0.96)",
        duration: 1.1,
        riseSpeed: 26,
        scale: 0.95
      });
    }
    advanceSpirit(game, spirit);
    return;
  }

  if (outcome === "eliteWave") {
    // Elites drop their own loot — no extra ring
    advanceSpirit(game, spirit);
    return;
  }

  if (outcome === "uncommonRing" || outcome === "eliteWaveRing") {
    const pool = getRingDefsByDropRarity("uncommon");
    if (pool.length) {
      const ringDef = pool[Math.floor(Math.random() * pool.length)];
      createRingDrop(game, ringDef.ringId, destX, destY);
      spawnDamagePopup(game, destX, destY - 18, ringDef.name, {
        color: "#a78bfa",
        strokeColor: "rgba(46, 16, 101, 0.96)",
        duration: 1.2,
        riseSpeed: 26,
        scale: 1
      });
    }
    advanceSpirit(game, spirit);
    return;
  }

  if (outcome === "miniboss") {
    // Rare ring reward — easy to upgrade: swap getRingDefsByDropRarity("rare") for a specific ring
    const pool = getRingDefsByDropRarity("rare");
    if (pool.length) {
      const ringDef = pool[Math.floor(Math.random() * pool.length)];
      createRingDrop(game, ringDef.ringId, destX, destY);
      spawnDamagePopup(game, destX, destY - 18, ringDef.name, {
        color: "#fbbf24",
        strokeColor: "rgba(120, 53, 15, 0.96)",
        duration: 1.4,
        riseSpeed: 28,
        scale: 1.1,
        isCrit: true
      });
    }
    advanceSpirit(game, spirit);
  }
}

// ---------------------------------------------------------------------------
// Advance to the next stop or complete the event
// ---------------------------------------------------------------------------
function advanceSpirit(game, spirit) {
  spirit.encounterEnemyIds.clear();
  spirit.stopIndex += 1;

  if (spirit.stopIndex >= STOP_COUNT) {
    spirit.state = "complete";
    // Mark the searchable consumed so it can't be re-interacted
    const searchable = (game.searchables || []).find((s) => s.id === spirit.searchableId);
    if (searchable) {
      searchable.isOpen = true;
      searchable.openTimer = 0;
    }
    spawnDamagePopup(game, spirit.x, spirit.y - 22, "Treasure Spirit departs!", {
      color: "#c4b5fd",
      strokeColor: "rgba(46, 16, 101, 0.96)",
      duration: 1.5,
      riseSpeed: 20,
      scale: 1.05
    });
    return;
  }

  spirit.state = "guiding";
}

// ---------------------------------------------------------------------------
// Spawn gold drops scattered around a destination
// ---------------------------------------------------------------------------
function spawnGoldAtDest(game, destX, destY, totalValue) {
  const perDrop = Math.max(1, Math.round(totalValue / GOLD_SCATTER_COUNT));
  for (let i = 0; i < GOLD_SCATTER_COUNT; i += 1) {
    const angle = (i / GOLD_SCATTER_COUNT) * Math.PI * 2 + Math.random() * 0.5;
    game.goldDrops.push(createGoldDrop({
      id: `ts_gold_${game.time.toFixed(3)}_${i}`,
      type: "elite",
      value: perDrop,
      x: destX,
      y: destY,
      radius: 10,
      color: "#facc15",
      burstAngle: angle,
      burstSpeed: 80 + Math.random() * 60,
    }));
  }
}

// ---------------------------------------------------------------------------
// Spawn encounter enemies near a destination
// ---------------------------------------------------------------------------
function spawnEncounterEnemies(game, spirit, destX, destY, tier, count) {
  spirit.encounterEnemyIds.clear();
  const spread = 80;

  for (let i = 0; i < count; i += 1) {
    const typeId = tier === "miniBoss" ? MINIBOSS_ENEMY_TYPE : pickEnemyType();
    const angle = (i / count) * Math.PI * 2;
    const spawnX = destX + Math.cos(angle) * spread;
    const spawnY = destY + Math.sin(angle) * spread;

    const enemy = spawnEnemyByType(typeId, spawnX, spawnY, {
      tier,
      assets: game.assets,
    });
    if (!enemy) continue;

    // Tag so the spirit can track this encounter group
    enemy.treasureSpiritEncounter = true;
    game.enemies.push(enemy);
    spirit.encounterEnemyIds.add(enemy.id);
  }

  game.markEnemiesDirty();
}

// ---------------------------------------------------------------------------
// Clear — called in loadRoom to prevent state leaks
// ---------------------------------------------------------------------------
export function clearTreasureSpirit(game) {
  game.treasureSpirit = null;
}

// ---------------------------------------------------------------------------
// Render helper — exported so renderer.js can call it
// ---------------------------------------------------------------------------
export function getTreasureSpiritRenderState(game) {
  return game.treasureSpirit || null;
}
