export const GOLD_DENOMINATION_SCALE = 10;

export function scaleGoldAmount(amount) {
  return Math.max(0, Math.round((Number(amount) || 0) * GOLD_DENOMINATION_SCALE));
}

export function scaleGoldPrice(amount) {
  return Math.max(0, Math.round((Number(amount) || 0) * GOLD_DENOMINATION_SCALE));
}
