import { AUXILIARY_MOD_POOL } from '../data/finger-experiment-mods.js';

const STORAGE_KEY = 'roguelike.fingerExperiment';
const CRAFT_COST = 100;
const REROLL_COST = 50;

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
    if (Array.isArray(parsed.craftedFingers)) state.craftedFingers = parsed.craftedFingers;
    if (parsed.equippedStartingFingers && typeof parsed.equippedStartingFingers === 'object') {
      state.equippedStartingFingers = parsed.equippedStartingFingers;
    }
    
    return state;
  } catch {
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
  const auxMod = pickRandom(AUXILIARY_MOD_POOL);

  const newFinger = {
    id,
    name: `Test Finger ${state.craftedFingers.length + 1}`,
    rarity: 'common',
    mods: {
      auxiliaryModId: auxMod.id
    }
  };

  state.fingerEssence -= CRAFT_COST;
  state.craftedFingers.push(newFinger);
  saveMetaState(state);

  return { ok: true, finger: newFinger };
}

export function rerollFingerMod(fingerId) {
  const state = getMetaState();
  const finger = state.craftedFingers.find(f => f.id === fingerId);
  if (!finger) return { ok: false, reason: 'fingerNotFound' };

  if (state.fingerEssence < REROLL_COST) {
    return { ok: false, reason: 'insufficientEssence' };
  }

  const currentModId = finger.mods?.auxiliaryModId;
  const pool = AUXILIARY_MOD_POOL.filter(m => m.id !== currentModId);
  if (pool.length === 0) return { ok: false, reason: 'noOtherMods' };

  const nextMod = pool[Math.floor(Math.random() * pool.length)];
  finger.mods = {
    ...finger.mods,
    auxiliaryModId: nextMod.id
  };

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
    // Unequip from other slots if already equipped
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
