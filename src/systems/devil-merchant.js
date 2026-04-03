import { getRingDefById, getRingDefsByDropRarity } from "../data/rings.js";
import { spawnDamagePopup } from "./combat.js";
import { addRing, getOwnedRings, scrapRing } from "./rings.js";
import { grantAffinityXp } from "./interactable-affinity.js";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------
const OFFER_COUNT_MIN = 2;
const OFFER_COUNT_MAX = 4;

// Weighted rarity pool for merchant offers
const RARITY_WEIGHTS = [
  { rarity: "normal",   weight: 60 },
  { rarity: "uncommon", weight: 30 },
  { rarity: "rare",     weight: 10 },
];

// HP cost to buy a ring (flat, by rarity)
const HP_COST_BY_RARITY = {
  normal:   8,
  uncommon: 16,
  rare:     28,
};

// Max HP gained when selling a ring to the merchant (by rarity)
const MAX_HP_GAIN_BY_RARITY = {
  normal:   4,
  uncommon: 8,
  rare:     14,
};

// Player must keep at least this fraction of maxHp after a purchase
const MIN_HP_FRACTION = 0.2;

// Hits required to drive the merchant away
const ATTACK_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Weighted random pick
// ---------------------------------------------------------------------------
function pickWeightedRarity() {
  const total = RARITY_WEIGHTS.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of RARITY_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.rarity;
  }
  return RARITY_WEIGHTS[RARITY_WEIGHTS.length - 1].rarity;
}

// ---------------------------------------------------------------------------
// Build a unique offer list
// ---------------------------------------------------------------------------
function buildOffers() {
  const count = OFFER_COUNT_MIN + Math.floor(Math.random() * (OFFER_COUNT_MAX - OFFER_COUNT_MIN + 1));
  const seen = new Set();
  const offers = [];
  let attempts = 0;
  while (offers.length < count && attempts < 200) {
    attempts += 1;
    const rarity = pickWeightedRarity();
    const pool = getRingDefsByDropRarity(rarity);
    if (!pool.length) continue;
    const def = pool[Math.floor(Math.random() * pool.length)];
    if (seen.has(def.ringId)) continue;
    seen.add(def.ringId);
    offers.push({ ringId: def.ringId, rarity, hpCost: HP_COST_BY_RARITY[rarity] ?? 10 });
  }
  return offers;
}

// ---------------------------------------------------------------------------
// Activation — called from openSearchable dispatch
// ---------------------------------------------------------------------------
export function activateDevilMerchant(game, searchable) {
  if (game.devilMerchant) return false;

  const cx = searchable.x + searchable.w * 0.5;
  const cy = searchable.y + searchable.h * 0.5;

  game.devilMerchant = {
    searchableId: searchable.id,
    x: cx,
    y: cy,
    state: "shopOpen",
    attackCount: 0,
    offers: buildOffers(),
    bobClock: 0,
  };

  searchable.isOpen = true;
  searchable.openTimer = 0;

  grantAffinityXp(game, "devilMerchant");

  spawnDamagePopup(game, cx, cy - 22, "A deal... with the devil?", {
    color: "#f87171",
    strokeColor: "rgba(127, 29, 29, 0.96)",
    duration: 1.4,
    riseSpeed: 22,
    scale: 1.05,
  });

  game.devilMerchantOpen = true;
  game.devilMerchantPausedGame = false;

  game.bumpUiVersion?.("overlay");
  return true;
}

// ---------------------------------------------------------------------------
// Close the merchant UI (called from game method)
// ---------------------------------------------------------------------------
export function closeDevilMerchant(game) {
  game.devilMerchantOpen = false;
  if (game.devilMerchantPausedGame) {
    game.state = "running";
    game.devilMerchantPausedGame = false;
  }
  game.bumpUiVersion?.("overlay");
}

// ---------------------------------------------------------------------------
// Buy a ring offer — costs HP
// ---------------------------------------------------------------------------
export function buyDevilMerchantOffer(game, ringId) {
  const merchant = game.devilMerchant;
  if (!merchant || merchant.state !== "shopOpen") return { ok: false, reason: "unavailable" };

  const offerIndex = merchant.offers.findIndex((o) => o.ringId === ringId);
  if (offerIndex < 0) return { ok: false, reason: "not_offered" };

  const offer = merchant.offers[offerIndex];
  const hpCost = offer.hpCost;
  const minHp = Math.ceil((game.player?.maxHp ?? 1) * MIN_HP_FRACTION);

  if ((game.player?.hp ?? 0) - hpCost < minHp) {
    return { ok: false, reason: "too_low_hp" };
  }

  const def = getRingDefById(offer.ringId);
  if (!def) return { ok: false, reason: "invalid_ring" };

  // Deduct HP directly (game is paused, damagePlayer won't fire)
  game.player.hp = Math.max(minHp, game.player.hp - hpCost);

  spawnDamagePopup(game, merchant.x, merchant.y - 18, `-${hpCost} HP`, {
    color: "#f87171",
    strokeColor: "rgba(127, 29, 29, 0.96)",
    duration: 1.0,
    riseSpeed: 28,
    scale: 0.95,
  });

  // Add ring to inventory
  addRing(game, offer.ringId);

  // Remove offer from list
  merchant.offers.splice(offerIndex, 1);

  spawnDamagePopup(game, merchant.x, merchant.y - 36, def.name, {
    color: "#fbbf24",
    strokeColor: "rgba(120, 53, 15, 0.96)",
    duration: 1.2,
    riseSpeed: 24,
    scale: 1.0,
  });

  game.bumpUiVersion?.("inventory", "overlay", "ringStats");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sell a ring — grants max HP
// ---------------------------------------------------------------------------
export function sellRingToDevilMerchant(game, ringId) {
  const merchant = game.devilMerchant;
  if (!merchant || merchant.state !== "shopOpen") return { ok: false, reason: "unavailable" };

  const def = getRingDefById(ringId);
  if (!def) return { ok: false, reason: "invalid_ring" };

  const owned = getOwnedRings(game).find((r) => r.ringKey === ringId);
  if (!owned) return { ok: false, reason: "not_owned" };

  const gain = MAX_HP_GAIN_BY_RARITY[def.dropRarity] ?? 4;

  scrapRing(game, ringId);

  game.player.maxHp = (game.player.maxHp ?? 1) + gain;
  game.player.hp = Math.min(game.player.hp ?? 1, game.player.maxHp);

  spawnDamagePopup(game, merchant.x, merchant.y - 18, `+${gain} Max HP`, {
    color: "#4ade80",
    strokeColor: "rgba(5, 46, 22, 0.96)",
    duration: 1.2,
    riseSpeed: 26,
    scale: 1.0,
  });

  game.bumpUiVersion?.("inventory", "overlay", "ringStats");
  return { ok: true, gain };
}

// ---------------------------------------------------------------------------
// Attack the merchant
// ---------------------------------------------------------------------------
export function attackDevilMerchant(game) {
  const merchant = game.devilMerchant;
  if (!merchant || merchant.state !== "shopOpen") return false;

  merchant.attackCount += 1;

  if (merchant.attackCount === 1) {
    merchant.state = "warning1";
    spawnDamagePopup(game, merchant.x, merchant.y - 22, "You dare?!", {
      color: "#f87171",
      strokeColor: "rgba(127, 29, 29, 0.96)",
      duration: 1.2,
      riseSpeed: 20,
      scale: 1.0,
    });
    merchant.state = "shopOpen";
  } else if (merchant.attackCount === 2) {
    spawnDamagePopup(game, merchant.x, merchant.y - 22, "Last warning...", {
      color: "#f87171",
      strokeColor: "rgba(127, 29, 29, 0.96)",
      duration: 1.2,
      riseSpeed: 20,
      scale: 1.0,
    });
  } else if (merchant.attackCount >= ATTACK_THRESHOLD) {
    merchant.state = "closed";
    spawnDamagePopup(game, merchant.x, merchant.y - 22, "The merchant vanishes!", {
      color: "#c4b5fd",
      strokeColor: "rgba(46, 16, 101, 0.96)",
      duration: 1.5,
      riseSpeed: 20,
      scale: 1.05,
    });
    closeDevilMerchant(game);
    game.devilMerchant = null;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Per-frame update
// ---------------------------------------------------------------------------
export function updateDevilMerchant(game, dt) {
  const merchant = game.devilMerchant;
  if (!merchant) return;
  merchant.bobClock += dt;
}

// ---------------------------------------------------------------------------
// Clear — called in loadRoom
// ---------------------------------------------------------------------------
export function clearDevilMerchant(game) {
  if (game.devilMerchant) {
    closeDevilMerchant(game);
  }
  game.devilMerchant = null;
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------
export function getDevilMerchantRenderState(game) {
  return game.devilMerchant || null;
}

// ---------------------------------------------------------------------------
// In-world melee hit check — called from weapon-art-runtime meleeHit
// ---------------------------------------------------------------------------
export function hitDevilMerchantInCone(game, origin, dir, range, arcDeg) {
  const merchant = game.devilMerchant;
  if (!merchant || merchant.state !== "shopOpen") return;
  const cosArc = Math.cos((arcDeg * Math.PI) / 360);
  const dx = merchant.x - origin.x;
  const dy = merchant.y - origin.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (dist > range + 24) return;
  const dot = (dx / dist) * dir.x + (dy / dist) * dir.y;
  if (dot < cosArc) return;
  attackDevilMerchant(game);
}

// ---------------------------------------------------------------------------
// Exported constants for UI
// ---------------------------------------------------------------------------
export { HP_COST_BY_RARITY, MAX_HP_GAIN_BY_RARITY, MIN_HP_FRACTION };
