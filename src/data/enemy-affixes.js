export const ENEMY_TIER_DEFS = Object.freeze({
  minion: { id: "minion", name: "Minion", hp: 1, atk: 1, xp: 1, size: 1, affixCount: 0 },
  elite: { id: "elite", name: "Elite", hp: 1.8, atk: 1.2, xp: 1.4, size: 1.08, affixCount: 2 },
  miniBoss: { id: "miniBoss", name: "Mini-Boss", hp: 8, atk: 1.5, xp: 3, size: 1.3, affixCount: 4 }
});

export const AFFIX_DEFS = Object.freeze([
  { id: "swift", name: "Swift", color: "#fbbf24" },
  { id: "volatile", name: "Volatile", color: "#f97316" },
  { id: "evasive", name: "Evasive", color: "#a78bfa" },
  { id: "auraBearer", name: "Aura Bearer", color: "#ec4899" },
  { id: "martyr", name: "Martyr", color: "#78716c" },
  { id: "undying", name: "Undying", color: "#7c3aed" },
  { id: "agile", name: "Agile", color: "#34d399" },
  { id: "invisible", name: "Invisible", color: "#64748b" },
  { id: "wall", name: "Wall", color: "#6b7280" },
  { id: "boulder", name: "Boulder", color: "#a16207" },
  { id: "inking", name: "Inking", color: "#111827" },
  { id: "orbiting", name: "Orbiting", color: "#f59e0b" },
  { id: "lasering", name: "Lasering", color: "#06b6d4" },
  { id: "phantom", name: "Phantom", color: "#94a3b8" },
  { id: "cursing", name: "Cursing", color: "#8b5cf6" },
  { id: "erratic", name: "Erratic", color: "#e879f9" },
  { id: "hive", name: "Hive", color: "#64748b" },
  { id: "guarded", name: "Guarded", color: "#a855f7" },
  { id: "plated", name: "Plated", color: "#cbd5e1" },
  { id: "flying", name: "Flying", color: "#22d3ee" }
]);

const AFFIX_ID_SET = new Set(AFFIX_DEFS.map((affix) => affix.id));

export function normalizeEnemyTier(tier) {
  if (tier === "miniboss") return "miniBoss";
  return ENEMY_TIER_DEFS[tier] ? tier : "minion";
}

export function getEnemyTierDef(tier) {
  return ENEMY_TIER_DEFS[normalizeEnemyTier(tier)];
}

export function getAffixDef(id) {
  return AFFIX_DEFS.find((affix) => affix.id === id) || { id, name: id, color: "#94a3b8" };
}

export function getValidAffixIds(affixIds = []) {
  return affixIds.filter((id) => AFFIX_ID_SET.has(id));
}

export function pickRandomAffixIds(random, count, excludeIds = []) {
  const pool = AFFIX_DEFS.filter((affix) => !excludeIds.includes(affix.id));
  const picks = [];
  for (let index = 0; index < count && pool.length > 0; index += 1) {
    const choiceIndex = Math.floor(random() * pool.length);
    picks.push(pool.splice(choiceIndex, 1)[0].id);
  }
  return picks;
}

export function classifyEnemySize(enemyOrDef) {
  const size = Number(enemyOrDef?.drawSize || enemyOrDef?.size || 64);
  if (size <= 64) return "small";
  if (size > 96) return "large";
  return "medium";
}
