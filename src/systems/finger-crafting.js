/**
 * FINGER CRAFTING & REFORGING SYSTEM
 * 
 * Logic for modifying Finger instances.
 */

import { getModById, getModsByCategory } from "../data/finger-mods.js";

const REFORGE_BASE_COST = 100;
const REFORGE_GROWTH_FACTOR = 1.5;

/**
 * TUNING: Replace Secondary Global based on a tag.
 * Limited to 1 use per finger in this example bone structure.
 */
export function tuneFinger(finger, categoryTag) {
  if (finger.tuningUses >= 1) return { ok: false, reason: "limit_reached" };
  
  const pool = getModsByCategory("secondary").filter(m => m.tags.includes(categoryTag));
  if (!pool.length) return { ok: false, reason: "invalid_tag" };
  
  // Return 3 options for the UI to display
  const options = [];
  const tempPool = [...pool];
  for (let i = 0; i < 3 && tempPool.length > 0; i++) {
    const idx = Math.floor(Math.random() * tempPool.length);
    options.push(tempPool.splice(idx, 1)[0]);
  }
  
  return { ok: true, options };
}

export function applyTuning(finger, modId) {
  finger.secondaryModId = modId;
  finger.tuningUses += 1;
}

/**
 * IMPRINT: Replace Hero Mod.
 */
export function imprintFinger(finger, targetModId) {
  if (finger.imprintUses >= 1) return { ok: false, reason: "limit_reached" };
  const mod = getModById(targetModId);
  if (!mod || !getModsByCategory("hero").includes(mod)) return { ok: false, reason: "invalid_mod" };
  
  finger.heroModId = targetModId;
  finger.imprintUses += 1;
  return { ok: true };
}

/**
 * REFORGE: Reroll a specific slot.
 */
export function reforgeSlot(finger, slotName, currentEssence) {
  const cost = computeReforgeCost(finger.reforgeCount);
  if (currentEssence < cost) return { ok: false, reason: "insufficient_essence", cost };
  if (slotName === "curse") return { ok: false, reason: "cannot_reforge_curse" };
  
  const pool = getModsByCategory(slotName);
  const picked = pool[Math.floor(Math.random() * pool.length)];
  
  const modKey = `${slotName}ModId`;
  finger[modKey] = picked.id;
  finger.reforgeCount += 1;
  
  return { ok: true, cost, newMod: picked };
}

export function computeReforgeCost(count) {
  return Math.round(REFORGE_BASE_COST * Math.pow(REFORGE_GROWTH_FACTOR, count));
}
