import { MAIN_MOD_POOL, AUXILIARY_MOD_POOL, HERO_MOD_POOL, CURSE_MOD_POOL } from '../data/finger-experiment-mods.js';

const STORAGE_KEY = 'roguelike.fingerExperiment';
const CRAFT_COST = 100;
const REROLL_COST = 50;

/**
 * Standard Finger Schema:
 * {
 *   id: string,
 *   name: string,
 *   rarity: 'common' | 'uncommon' | 'rare',
 *   mainMod: string | null,      // ID from MAIN_MOD_POOL
 *   auxiliaryMod: string | null, // ID from AUXILIARY_MOD_POOL (Always present for new fingers)
 *   heroMod: string | null,      // ID from HERO_MOD_POOL
 *   curseMod: string | null      // ID from CURSE_MOD_POOL
 * }
 */

function createDefaultState() {
  return {
    fingerEssence: 0,
    craftedFingers: [],
    equippedStartingFingers: {} // Map of slotIndex to fingerId
  };
}

let _cache = null;

export function loadMetaState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    const state = createDefaultState();
    
    if (typeof parsed.fingerEssence === 'number') state.fingerEssence = parsed.fingerEssence;
    
    if (Array.isArray(parsed.craftedFingers)) {
      state.craftedFingers = parsed.craftedFingers.map(f => {
        // --- Migration & Standardization Logic ---
        
        // Ensure standard fields exist
        const finger = {
          id: f.id,
          name: f.name,
          rarity: f.rarity || 'common',
          mainMod: f.mainMod || null,
          auxiliaryMod: f.auxiliaryMod || null,
          heroMod: f.heroMod || null,
          curseMod: f.curseMod || null,
          curseValue: f.curseValue || null
        };

        // Migrate from legacy 'mods' object if present
        if (f.mods) {
          if (!finger.mainMod && f.mods.mainModId) finger.mainMod = f.mods.mainModId;
          if (!finger.auxiliaryMod && f.mods.auxiliaryModId) finger.auxiliaryMod = f.mods.auxiliaryModId;
          if (!finger.heroMod && f.mods.heroModId) finger.heroMod = f.mods.heroModId;
          if (!finger.curseMod && f.mods.curseModId) finger.curseMod = f.mods.curseModId;
        }

        // Migrate from mid-phase 'modId' / 'modType' structure
        if (f.modId && !finger.auxiliaryMod && !finger.heroMod) {
          if (f.modType === 'hero') finger.heroMod = f.modId;
          else finger.auxiliaryMod = f.modId;
        }

        // Roll curseValue for existing fingers if they have a curse but no value
        if (finger.curseMod && finger.curseValue === null) {
          const mod = getModById(finger.curseMod);
          if (mod && typeof mod.valueMin === 'number' && typeof mod.valueMax === 'number') {
            finger.curseValue = mod.valueMin + Math.random() * (mod.valueMax - mod.valueMin);
          }
        }

        return finger;
      });
    }

    if (parsed.equippedStartingFingers && typeof parsed.equippedStartingFingers === 'object') {
      state.equippedStartingFingers = parsed.equippedStartingFingers;
    }
    
    return state;
  } catch (err) {
    console.error('Failed to load Finger Experiment meta state:', err);
    return createDefaultState();
  }
}

export function saveMetaState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function getMetaState() {
  if (!_cache) _cache = loadMetaState();
  return _cache;
}

export function addFingerEssence(amount) {
  const state = getMetaState();
  state.fingerEssence += amount;
  saveMetaState(state);
}

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function craftFinger() {
  const state = getMetaState();
  if (state.fingerEssence < CRAFT_COST) {
    return { ok: false, reason: 'insufficientEssence' };
  }

  const id = `finger_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // Mandatory Auxiliary
  const auxMod = pickRandom(AUXILIARY_MOD_POOL);

  // Pilot Logic: Whitelist specific probabilities
  const mainMod = (MAIN_MOD_POOL.length > 0 && Math.random() < 0.3) ? pickRandom(MAIN_MOD_POOL) : null;
  const heroMod = (HERO_MOD_POOL.length > 0 && Math.random() < 0.2) ? pickRandom(HERO_MOD_POOL) : null;
  const curseMod = (CURSE_MOD_POOL.length > 0 && Math.random() < 0.2) ? pickRandom(CURSE_MOD_POOL) : null;
  let curseValue = null;
  if (curseMod && typeof curseMod.valueMin === 'number' && typeof curseMod.valueMax === 'number') {
    curseValue = curseMod.valueMin + Math.random() * (curseMod.valueMax - curseMod.valueMin);
  }

  const newFinger = {
    id,
    name: `Experiment ${state.craftedFingers.length + 1}`,
    rarity: heroMod ? 'rare' : (mainMod ? 'uncommon' : 'common'),
    mainMod: mainMod?.id || null,
    auxiliaryMod: auxMod.id,
    heroMod: heroMod?.id || null,
    curseMod: curseMod?.id || null,
    curseValue: curseValue,
    mods: {
      mainModId: mainMod?.id || null,
      auxiliaryModId: auxMod.id,
      heroModId: heroMod?.id || null,
      curseModId: curseMod?.id || null
    }
  };

  state.fingerEssence -= CRAFT_COST;
  state.craftedFingers.push(newFinger);
  saveMetaState(state);

  return { ok: true, finger: newFinger };
}

export function rerollFingerMod(fingerId, category = 'auxiliary') {
  const state = getMetaState();
  const finger = state.craftedFingers.find(f => f.id === fingerId);
  if (!finger) return { ok: false, reason: 'fingerNotFound' };

  if (state.fingerEssence < REROLL_COST) {
    return { ok: false, reason: 'insufficientEssence' };
  }

  let pool = [];
  let key = '';

  if (category === 'main') { pool = MAIN_MOD_POOL; key = 'mainMod'; }
  else if (category === 'hero') { pool = HERO_MOD_POOL; key = 'heroMod'; }
  else if (category === 'curse') { pool = CURSE_MOD_POOL; key = 'curseMod'; }
  else { pool = AUXILIARY_MOD_POOL; key = 'auxiliaryMod'; }

  const currentId = finger[key];
  const filteredPool = pool.filter(m => m.id !== currentId);
  
  if (filteredPool.length === 0) return { ok: false, reason: 'noOtherMods' };

  const nextMod = pickRandom(filteredPool);
  finger[key] = nextMod.id;

  if (category === 'curse') {
    if (nextMod && typeof nextMod.valueMin === 'number' && typeof nextMod.valueMax === 'number') {
      finger.curseValue = nextMod.valueMin + Math.random() * (nextMod.valueMax - nextMod.valueMin);
    } else {
      finger.curseValue = null;
    }
  }

  state.fingerEssence -= REROLL_COST;
  saveMetaState(state);

  return { ok: true, finger };
}

export function equipFinger(fingerId, slotIndex) {
  const state = getMetaState();
  const finger = state.craftedFingers.find(f => f.id === fingerId);
  if (!finger && fingerId !== null) return { ok: false, reason: 'fingerNotFound' };

  if (fingerId === null) {
    delete state.equippedStartingFingers[slotIndex];
  } else {
    for (const idx in state.equippedStartingFingers) {
      if (state.equippedStartingFingers[idx] === fingerId) {
        delete state.equippedStartingFingers[idx];
      }
    }
    state.equippedStartingFingers[slotIndex] = fingerId;
  }

  saveMetaState(state);
  return { ok: true };
}

export function unequipAllFingers() {
  const state = getMetaState();
  state.equippedStartingFingers = {};
  saveMetaState(state);
}

export function getEquippedFingers() {
  const state = getMetaState();
  const equipped = {};
  for (const slotIndex in state.equippedStartingFingers) {
    const fingerId = state.equippedStartingFingers[slotIndex];
    const finger = state.craftedFingers.find(f => f.id === fingerId);
    if (finger) {
      equipped[slotIndex] = finger;
    }
  }
  return equipped;
}
