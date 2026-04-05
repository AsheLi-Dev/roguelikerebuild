import { setPlayerStatSource } from "./player-stats.js";
import { spawnDamagePopup } from "./combat.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STORAGE_KEY = "roguelike.interactableAffinity";
const MAX_LEVEL = 5;

// XP required to reach each level (index = target level - 1)
const XP_THRESHOLDS = [1, 2, 3, 5, 8];

// Stat multiplier applied once per odd level reached
const STAT_BONUS_PER_ODD_LEVEL = {
  cursedAnvil:    { uncommonDropRate: 1.05 },
  treasureSpirit: { goldGain:         1.10 },
  devilMerchant:  { maxHp:            1.10 },
};

// Spawn weights indexed by affinity level [lvl0, lvl1, lvl2, lvl3, lvl4, lvl5]
const AFFINITY_WEIGHTS = {
  cursedAnvil:    [15, 15, 20, 20, 26, 26],
  treasureSpirit: [ 8,  8, 12, 12, 16, 16],
  devilMerchant:  [ 6,  6,  9,  9, 13, 13],
  alchemyWorkshop:[10, 10, 14, 14, 18, 18],
};

const INTERACTABLE_IDS = Object.keys(AFFINITY_WEIGHTS);

const LEVEL_UP_LABELS = {
  cursedAnvil:    "Cursed Anvil",
  treasureSpirit: "Treasure Spirit",
  devilMerchant:  "Devil Merchant",
  alchemyWorkshop:"Alchemy Workshop",
};

const AFFINITY_UI_DETAILS = Object.freeze({
  cursedAnvil: Object.freeze({
    name: "Cursed Anvil",
    subtitle: "Tempting forge relic",
    oddLevelBonus: "Better uncommon ring drop rate",
    evenLevelBonus: "Spawns more often"
  }),
  treasureSpirit: Object.freeze({
    name: "Treasure Spirit",
    subtitle: "Wayward guide of riches",
    oddLevelBonus: "Higher gold gain",
    evenLevelBonus: "Spawns more often"
  }),
  devilMerchant: Object.freeze({
    name: "Devil Merchant",
    subtitle: "Blood-price ring broker",
    oddLevelBonus: "Higher max HP",
    evenLevelBonus: "Spawns more often"
  }),
  alchemyWorkshop: Object.freeze({
    name: "Alchemy Workshop",
    subtitle: "Finger grafting station",
    oddLevelBonus: "+1 starting finger at Lv1, 3, 5",
    evenLevelBonus: "Cheaper normal and uncommon finger crafting"
  })
});

// ---------------------------------------------------------------------------
// Default state factory
// ---------------------------------------------------------------------------
function createDefaultState() {
  const state = {};
  for (const id of INTERACTABLE_IDS) {
    state[id] = { xp: 0, level: 0 };
  }
  return state;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
let _cache = null;

function loadAffinityState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    // Validate and fill missing keys
    const state = createDefaultState();
    for (const id of INTERACTABLE_IDS) {
      if (parsed[id] && typeof parsed[id].xp === "number" && typeof parsed[id].level === "number") {
        state[id] = {
          xp: Math.max(0, Math.floor(parsed[id].xp)),
          level: Math.max(0, Math.min(MAX_LEVEL, Math.floor(parsed[id].level)))
        };
      }
    }
    return state;
  } catch {
    return createDefaultState();
  }
}

function saveAffinityState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function getAffinityState() {
  if (!_cache) _cache = loadAffinityState();
  return _cache;
}

// ---------------------------------------------------------------------------
// Level helpers
// ---------------------------------------------------------------------------
export function getAffinityLevel(interactableId) {
  return getAffinityState()[interactableId]?.level ?? 0;
}

export function getAffinityXpToNext(interactableId) {
  const entry = getAffinityState()[interactableId];
  if (!entry) return null;
  if (entry.level >= MAX_LEVEL) return null;
  return XP_THRESHOLDS[entry.level] - entry.xp;
}

export function getAffinityUiEntries() {
  const state = getAffinityState();
  return INTERACTABLE_IDS.map((id) => {
    const entry = state[id] ?? { xp: 0, level: 0 };
    const threshold = entry.level < MAX_LEVEL ? XP_THRESHOLDS[entry.level] : null;
    const xpToNext = threshold == null ? null : Math.max(0, threshold - entry.xp);
    const meta = AFFINITY_UI_DETAILS[id] ?? {};
    return {
      id,
      name: meta.name ?? LEVEL_UP_LABELS[id] ?? id,
      subtitle: meta.subtitle ?? "",
      level: entry.level,
      xp: entry.xp,
      xpToNext,
      threshold,
      progress: threshold == null ? 1 : Math.max(0, Math.min(1, entry.xp / Math.max(1, threshold))),
      maxLevel: MAX_LEVEL,
      oddLevelBonus: meta.oddLevelBonus ?? "",
      evenLevelBonus: meta.evenLevelBonus ?? ""
    };
  });
}

// ---------------------------------------------------------------------------
// Spawn weight query - called at room spawn time
// ---------------------------------------------------------------------------
export function getAffinitySpawnWeight(interactableId) {
  const level = getAffinityLevel(interactableId);
  return AFFINITY_WEIGHTS[interactableId]?.[level] ?? 0;
}

// ---------------------------------------------------------------------------
// Stat source computation
// ---------------------------------------------------------------------------
export function applyAffinityStatSource(game) {
  const state = getAffinityState();
  const combined = {};

  for (const id of INTERACTABLE_IDS) {
    const level = state[id]?.level ?? 0;
    if (level <= 0) continue;
    const bonusDef = STAT_BONUS_PER_ODD_LEVEL[id];
    if (!bonusDef) continue;

    // Count odd levels reached (1, 3, 5)
    const oddLevels = [1, 3, 5].filter((l) => l <= level).length;
    if (oddLevels <= 0) continue;

    for (const [statId, perLevelMult] of Object.entries(bonusDef)) {
      const totalMult = Math.pow(perLevelMult, oddLevels);
      if (!combined[statId]) {
        combined[statId] = { add: 0, mult: totalMult };
      } else {
        combined[statId].mult *= totalMult;
      }
    }
  }

  setPlayerStatSource(game.player, "affinity", combined);
}

// ---------------------------------------------------------------------------
// Grant XP - call after a confirmed interaction
// ---------------------------------------------------------------------------
export function grantAffinityXp(game, interactableId) {
  const state = getAffinityState();
  const entry = state[interactableId];
  if (!entry) return;
  if (entry.level >= MAX_LEVEL) return;

  entry.xp += 1;

  const threshold = XP_THRESHOLDS[entry.level];
  if (entry.xp >= threshold) {
    entry.xp -= threshold;
    entry.level += 1;
    onAffinityLevelUp(game, interactableId, entry.level);
  }

  saveAffinityState(state);
  applyAffinityStatSource(game);
}

// ---------------------------------------------------------------------------
// Level-up feedback
// ---------------------------------------------------------------------------
function onAffinityLevelUp(game, interactableId, newLevel) {
  const label = LEVEL_UP_LABELS[interactableId] ?? interactableId;
  const isStatLevel = newLevel % 2 === 1;
  const rewardText = isStatLevel
    ? AFFINITY_UI_DETAILS[interactableId]?.oddLevelBonus
    : AFFINITY_UI_DETAILS[interactableId]?.evenLevelBonus;
  const text = rewardText
    ? `${label} Affinity Lv${newLevel}! ${rewardText}`
    : isStatLevel
      ? `${label} Affinity Lv${newLevel}!`
      : `${label} Affinity Lv${newLevel} - Spawns more often!`;

  // Show popup near player if available
  const px = game.player?.x != null ? game.player.x + (game.player.w ?? 0) * 0.5 : 0;
  const py = game.player?.y != null ? game.player.y : 0;

  spawnDamagePopup(game, px, py - 40, text, {
    color: "#c4b5fd",
    strokeColor: "rgba(46, 16, 101, 0.96)",
    duration: 2.0,
    riseSpeed: 18,
    scale: 1.05,
  });
}

// ---------------------------------------------------------------------------
// Debug info - accessible via console
// ---------------------------------------------------------------------------
export function getAffinityDebugInfo() {
  const state = getAffinityState();
  return INTERACTABLE_IDS.map((id) => {
    const entry = state[id] ?? { xp: 0, level: 0 };
    const xpToNext = entry.level < MAX_LEVEL ? XP_THRESHOLDS[entry.level] - entry.xp : null;
    return { id, level: entry.level, xp: entry.xp, xpToNext };
  });
}
