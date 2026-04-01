export const MATERIAL_DEFS = Object.freeze({
  witheredFinger: Object.freeze({
    id: "witheredFinger",
    name: "Withered Finger",
    rarity: "common",
    description: "A dried finger kept for future Alchemy Workshop experiments.",
    alchemyHint: "Used by the future Alchemy Workshop to graft common finger traits."
  }),
  monsterFinger: Object.freeze({
    id: "monsterFinger",
    name: "Monster Finger",
    rarity: "uncommon",
    description: "A dense finger taken from stronger prey.",
    alchemyHint: "Used by the future Alchemy Workshop to graft uncommon finger traits."
  }),
  twistedFinger: Object.freeze({
    id: "twistedFinger",
    name: "Twisted Finger",
    rarity: "rare",
    description: "A warped finger pulsing with unstable potential.",
    alchemyHint: "Used by the future Alchemy Workshop to graft rare finger traits."
  })
});

export const MATERIAL_DROP_TABLE = Object.freeze({
  minion: Object.freeze({
    materialId: "witheredFinger",
    chance: 0.1
  }),
  elite: Object.freeze({
    materialId: "monsterFinger",
    chance: 0.1
  }),
  miniBoss: Object.freeze({
    materialId: "twistedFinger",
    chance: 0.1
  })
});

export function getMaterialDefById(materialId) {
  return MATERIAL_DEFS[String(materialId || "")] || null;
}

export function getMaterialDefs() {
  return Object.values(MATERIAL_DEFS);
}
