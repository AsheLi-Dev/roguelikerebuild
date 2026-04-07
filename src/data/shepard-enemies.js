const ROW_ORDER = Object.freeze(["right", "right_down", "down", "left_down", "left", "left_up", "up", "right_up"]);
const MELEE_REACH_RANGE_SCALE = 0.84;
const MELEE_REACH_RADIUS_SCALE = 0.82;
const MELEE_REACH_MAX_RANGE_SCALE = 0.88;
const MELEE_RANGE_KINDS = new Set([
  "cone",
  "frame_synced_cone",
  "cone_combo",
  "circle",
  "frame_synced_circle",
  "circle_combo",
  "whirlwind",
  "rolling_attack",
  "cone_followup_blast"
]);

function sheet(asset, frames = 15, fps = 14, loop = false) {
  return { asset, frames, fps, loop };
}

function scaleValue(value, scale, minimum = 0) {
  if (!Number.isFinite(value)) return value;
  return Math.max(minimum, Math.round(value * scale));
}

function shouldTuneMeleeReach(role, attack) {
  if (!attack || !MELEE_RANGE_KINDS.has(attack.kind)) return false;
  if (role === "melee") return true;
  return attack.id?.includes("kick") || attack.id?.includes("shield_bash");
}

function tuneMeleeAttackReach(attacks, role) {
  return attacks.map((attack) => {
    if (!shouldTuneMeleeReach(role, attack)) return attack;
    const tuned = { ...attack };
    if (Number.isFinite(tuned.range)) tuned.range = scaleValue(tuned.range, MELEE_REACH_RANGE_SCALE, 48);
    if (Number.isFinite(tuned.radius)) tuned.radius = scaleValue(tuned.radius, MELEE_REACH_RADIUS_SCALE, 36);
    if (Number.isFinite(tuned.maxRange) && tuned.maxRange < 300) {
      tuned.maxRange = scaleValue(tuned.maxRange, MELEE_REACH_MAX_RANGE_SCALE, Math.max(48, tuned.minRange ?? 0));
    }
    return tuned;
  });
}

function createAssetSpecs(folder, files, basePath = "./assets/enemies/Enemies") {
  return Object.entries(files).map(([key, file]) => [
    key,
    `${basePath}/${folder}/${file}`
  ]);
}

function createDirectionalEnemy({
  id,
  name,
  folder,
  category = null,
  hp,
  damage,
  speed,
  role,
  size,
  drawSize,
  preferredRange = 0,
  movementTactic = "Brave",
  collisionRadius = 0.34,
  tint = "#e5e7eb",
  hitAsset = null,
  sheets,
  attacks,
  plates = 0,
  sneakBehavior = null,
  shoutBehavior = null
}) {
  return {
    id,
    name,
    folder,
    category,
    role,
    hp,
    damage,
    speed,
    size,
    drawSize,
    preferredRange,
    movementTactic,
    collisionRadius,
    tint,
    rowOrder: ROW_ORDER,
    sprite: {
      ...sheets,
      ...(hitAsset ? { hit: sheet(hitAsset, 15, 18, false) } : {})
    },
    attacks: tuneMeleeAttackReach(attacks, role),
    plates,
    sneakBehavior,
    shoutBehavior
  };
}

function createRaptorVariant(prefix) {
  return {
    idle: sheet(`${prefix}Idle`, 15, 8, true),
    walk: sheet(`${prefix}Walk`, 15, 10, true),
    move: sheet(`${prefix}Run`, 15, 12, true),
    shout: sheet(`${prefix}Shout`, 15, 10, false),
    attackBasic: sheet(`${prefix}Attack1`),
    attackAlt: sheet(`${prefix}Attack2`),
    attackHeavy: sheet(`${prefix}Attack3`),
    attackLeap: sheet(`${prefix}Attack4`),
    hit: sheet(`${prefix}Hit`, 15, 18, false)
  };
}

function createKickerSheets(prefix) {
  return {
    idle: sheet(`${prefix}Idle`, 15, 8, true),
    walk: sheet(`${prefix}Walk`, 15, 10, true),
    move: sheet(`${prefix}Run`, 15, 12, true),
    attackBasic: sheet(`${prefix}Attack1`),
    attackAlt: sheet(`${prefix}Attack2`),
    attackHeavy: sheet(`${prefix}Attack3`),
    attackLeap: sheet(`${prefix}Attack4`),
    hit: sheet(`${prefix}Hit`, 15, 18, false)
  };
}

function createStegosaurusSheets(prefix) {
  return {
    idle: sheet(`${prefix}Idle`, 15, 8, true),
    walk: sheet(`${prefix}Walk`, 15, 9, true),
    move: sheet(`${prefix}Run`, 15, 11, true),
    attackBasic: sheet(`${prefix}Attack1`),
    attackAlt: sheet(`${prefix}Attack2`),
    attackHeavy: sheet(`${prefix}Attack3`),
    attackSlam: sheet(`${prefix}Attack4`),
    hit: sheet(`${prefix}Hit`, 15, 18, false)
  };
}

function createTriceratopsSheets(prefix) {
  return {
    idle: sheet(`${prefix}Idle`, 15, 8, true),
    walk: sheet(`${prefix}Walk`, 15, 9, true),
    move: sheet(`${prefix}Run`, 15, 11, true),
    attackBasic: sheet(`${prefix}Attack1`),
    attackAlt: sheet(`${prefix}Attack2`),
    attackHeavy: sheet(`${prefix}Attack3`),
    attackLeap: sheet(`${prefix}Attack4`),
    hit: sheet(`${prefix}Hit`, 15, 18, false)
  };
}

export const SHEPARD_ENEMY_ASSET_SPECS = [
  ...createAssetSpecs("13Shepard", {
    shepardIdle: "Idle.png",
    shepardWalk: "Walk.png",
    shepardMove: "Run.png",
    shepardSneak: "Sneak.png",
    shepardHit: "TakeDamage.png",
    shepardAttackPounce: "Pounce.png",
    shepardAttackLeap: "Leap Attack.png"
  }),
  ...createAssetSpecs("Blue Raptor", {
    raptorBlueIdle: "Raptor Idle.png",
    raptorBlueWalk: "Raptor Walk.png",
    raptorBlueRun: "Raptor run.png",
    raptorBlueShout: "Raptor Shout2.png",
    raptorBlueAttack1: "Raptor Attack1.png",
    raptorBlueAttack2: "Raptor Attack2.png",
    raptorBlueAttack3: "Raptor Attack3.png",
    raptorBlueAttack4: "Raptor Attack4.png",
    raptorBlueHit: "Raptor TakeDamage.png"
  }, "./assets/enemies/Beast"),
  ...createAssetSpecs("Green Raptor", {
    raptorGreenIdle: "Raptor Idle.png",
    raptorGreenWalk: "Raptor Walk.png",
    raptorGreenRun: "Raptor run.png",
    raptorGreenShout: "Raptor Shout2.png",
    raptorGreenAttack1: "Raptor Attack1.png",
    raptorGreenAttack2: "Raptor Attack2.png",
    raptorGreenAttack3: "Raptor Attack3.png",
    raptorGreenAttack4: "Raptor Attack4.png",
    raptorGreenHit: "Raptor TakeDamage.png"
  }, "./assets/enemies/Beast"),
  ...createAssetSpecs("Red Raptor", {
    raptorRedIdle: "Raptor Idle.png",
    raptorRedWalk: "Raptor Walk.png",
    raptorRedRun: "Raptor run.png",
    raptorRedShout: "Raptor Shout2.png",
    raptorRedAttack1: "Raptor Attack1.png",
    raptorRedAttack2: "Raptor Attack2.png",
    raptorRedAttack3: "Raptor Attack3.png",
    raptorRedAttack4: "Raptor Attack4.png",
    raptorRedHit: "Raptor TakeDamage.png"
  }, "./assets/enemies/Beast"),
  ...createAssetSpecs("Kicker", {
    kickerIdle: "Idle.png",
    kickerWalk: "Walk.png",
    kickerRun: "Run.png",
    kickerAttack1: "Attack1.png",
    kickerAttack2: "Attack2.png",
    kickerAttack3: "Attack3.png",
    kickerAttack4: "Attack4.png",
    kickerHit: "TakeDamage.png"
  }, "./assets/enemies/Beast"),
  ...createAssetSpecs("Stegosaurus", {
    stegosaurusIdle: "Idle.png",
    stegosaurusWalk: "Walk.png",
    stegosaurusRun: "Run.png",
    stegosaurusAttack1: "Attack1.png",
    stegosaurusAttack2: "Attack2.png",
    stegosaurusAttack3: "Attack3.png",
    stegosaurusAttack4: "Attack 4.png",
    stegosaurusHit: "TakeDamage.png"
  }, "./assets/enemies/Beast"),
  ...createAssetSpecs("Triceratops", {
    triceratopsIdle: "Idle.png",
    triceratopsWalk: "Walk.png",
    triceratopsRun: "Run.png",
    triceratopsAttack1: "Attack1.png",
    triceratopsAttack2: "Attack2.png",
    triceratopsAttack3: "Attack3.png",
    triceratopsAttack4: "Attack4.png",
    triceratopsHit: "TakeDamage.png"
  }, "./assets/enemies/Beast")
];

export const SHEPARD_ENEMY_DEFS = Object.freeze({
  m_for_shepard_13: createDirectionalEnemy({
    id: "m_for_shepard_13",
    name: "Shepherd",
    folder: "13Shepard",
    category: "Beast",
    role: "melee",
    movementTactic: "Brave",
    hp: 84,
    damage: 13,
    speed: 122,
    size: 64,
    drawSize: 128,
    preferredRange: 56,
    collisionRadius: 0.32,
    tint: "#d1d5db",
    hitAsset: "shepardHit",
    sheets: {
      idle: sheet("shepardIdle", 15, 8, true),
      walk: sheet("shepardWalk", 15, 10, true),
      move: sheet("shepardMove", 15, 12, true),
      sneak: sheet("shepardSneak", 15, 10, true),
      attackPounce: sheet("shepardAttackPounce"),
      attackLeap: sheet("shepardAttackLeap")
    },
    sneakBehavior: {
      sprite: "sneak",
      speedMult: 0.5,
      alpha: 0.5,
      duration: 1.5,
      chance: 0.38,
      cooldown: 4.5,
      minRange: 110,
      maxRange: 260
    },
    attacks: [
      { id: "shepard_pounce", kind: "cone", sprite: "attackPounce", telegraph: 0.5, cooldown: 2.4, minRange: 0, maxRange: 110, damageScale: 1, range: 108, arc: 46, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, animFps: 14, weight: 1 },
      { id: "shepard_leap", kind: "circle", sprite: "attackLeap", telegraph: 0.9, cooldown: 5.6, minRange: 40, maxRange: 220, damageScale: 1.2, radius: 74, hitboxTrigger: 11, windupStop: 4, activeAnimDuration: 15 / 14, animFps: 14, leapStartFrame: 4, leapEndFrame: 10, leapSpeedMult: 2.2, weight: 0.62 }
    ]
  }),
  m_for_raptor_14: {
    ...createDirectionalEnemy({
      id: "m_for_raptor_14",
      name: "Raptor",
      folder: "Beast/Raptor",
      category: "Beast",
      role: "melee",
      movementTactic: "Swarmer",
      hp: 72,
      damage: 12,
      speed: 148,
      size: 58,
      drawSize: 56,
      preferredRange: 46,
      collisionRadius: 0.3,
      tint: "#7dd3fc",
      shoutBehavior: {
        sprite: "shout",
        duration: 1.1,
        cooldownMin: 3.5,
        cooldownMax: 7
      },
      sheets: createRaptorVariant("raptorBlue"),
      attacks: [
        { id: "raptor_bite", kind: "cone", sprite: "attackBasic", telegraph: 0.56, cooldown: 2.05, minRange: 0, maxRange: 110, damageScale: 1, range: 92, arc: 36, hitboxTrigger: 9, windupStop: 6, activeAnimDuration: 15 / 14, animFps: 14, rarity: "uncommon", weight: 1 },
        { id: "raptor_tail_swing", kind: "cone", sprite: "attackHeavy", telegraph: 0.42, cooldown: 2.8, minRange: 0, maxRange: 110, damageScale: 1.2, range: 144, arc: 118, hitboxTrigger: 5, windupStop: 3, activeAnimDuration: 15 / 14, animFps: 14, rarity: "uncommon", weight: 0.9 }
      ]
    }),
    spriteVariants: [
      {
        id: "blue",
        tint: "#7dd3fc",
        sprite: createRaptorVariant("raptorBlue")
      },
      {
        id: "green",
        tint: "#86efac",
        sprite: createRaptorVariant("raptorGreen")
      },
      {
        id: "red",
        tint: "#fca5a5",
        sprite: createRaptorVariant("raptorRed")
      }
    ]
  },
  m_for_kicker_15: createDirectionalEnemy({
    id: "m_for_kicker_15",
    name: "Kicker",
    folder: "Beast/Kicker",
    category: "Beast",
    role: "melee",
    movementTactic: "Brave",
    hp: 88,
    damage: 14,
    speed: 126,
    size: 58,
    drawSize: 56,
    preferredRange: 56,
    collisionRadius: 0.31,
    tint: "#d1d5db",
    sheets: createKickerSheets("kicker"),
    attacks: [
      { id: "kicker_thrust_bite", kind: "cone", sprite: "attackBasic", telegraph: 0.8, cooldown: 3.1, minRange: 0, maxRange: 110, damageScale: 1.15, range: 178, arc: 28, hitboxTrigger: 11, windupStop: 7, activeAnimDuration: 15 / 14, animFps: 14, rarity: "uncommon", weight: 0.72 },
      { id: "kicker_kick", kind: "cone", sprite: "attackAlt", telegraph: 0.66, cooldown: 2.6, minRange: 0, maxRange: 110, damageScale: 1, range: 172, arc: 26, knockback: 260, hitboxTrigger: 9, windupStop: 5, activeAnimDuration: 15 / 14, animFps: 14, rarity: "normal", weight: 1 },
      { id: "kicker_bite", kind: "cone", sprite: "attackHeavy", telegraph: 0.42, cooldown: 2.05, minRange: 0, maxRange: 110, damageScale: 0.92, range: 88, arc: 42, hitboxTrigger: 6, windupStop: 3, activeAnimDuration: 15 / 14, animFps: 14, rarity: "normal", weight: 0.95 },
      { id: "kicker_heavy_tail_swing", kind: "cone", sprite: "attackLeap", telegraph: 0.86, cooldown: 3.9, minRange: 0, maxRange: 110, damageScale: 1.28, range: 150, arc: 126, hitboxTrigger: 10, windupStop: 3, activeAnimDuration: 15 / 14, animFps: 14, rarity: "uncommon", weight: 0.68 }
    ]
  }),
  m_for_stegosaurus_16: createDirectionalEnemy({
    id: "m_for_stegosaurus_16",
    name: "Stegosaurus",
    folder: "Beast/Stegosaurus",
    category: "Beast",
    role: "melee",
    movementTactic: "Brave",
    hp: 108,
    damage: 18,
    speed: 92,
    size: 72,
    drawSize: 72,
    preferredRange: 62,
    collisionRadius: 0.36,
    tint: "#d6d3d1",
    sheets: createStegosaurusSheets("stegosaurus"),
    attacks: [
      { id: "stegosaurus_tail_swing", kind: "cone", sprite: "attackBasic", telegraph: 0.68, cooldown: 2.8, minRange: 0, maxRange: 110, damageScale: 1.1, range: 142, arc: 116, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, animFps: 14, rarity: "normal", weight: 1 },
      { id: "stegosaurus_upward_tail_swing", kind: "cone", sprite: "attackAlt", telegraph: 0.96, cooldown: 3.5, minRange: 0, maxRange: 110, damageScale: 1.2, range: 184, arc: 28, hitboxTrigger: 11, windupStop: 8, activeAnimDuration: 15 / 14, animFps: 14, rarity: "uncommon", weight: 0.76 },
      { id: "stegosaurus_head_attack", kind: "cone", sprite: "attackHeavy", telegraph: 0.62, cooldown: 2.2, minRange: 0, maxRange: 110, damageScale: 0.95, range: 92, arc: 38, hitboxTrigger: 9, windupStop: 5, activeAnimDuration: 15 / 14, animFps: 14, rarity: "normal", weight: 0.92 },
      { id: "stegosaurus_ground_slam", kind: "circle", sprite: "attackSlam", telegraph: 0.92, cooldown: 4.8, minRange: 0, maxRange: 150, damageScale: 1.28, radius: 128, hitboxTrigger: 13, windupStop: 6, activeAnimDuration: 15 / 14, animFps: 14, rarity: "uncommon", weight: 0.7 }
    ]
  }),
  m_for_triceratops_17: createDirectionalEnemy({
    id: "m_for_triceratops_17",
    name: "Triceratops",
    folder: "Beast/Triceratops",
    category: "Beast",
    role: "melee",
    movementTactic: "Brave",
    hp: 120,
    damage: 20,
    speed: 96,
    size: 76,
    drawSize: 76,
    preferredRange: 66,
    collisionRadius: 0.37,
    tint: "#d6d3d1",
    sheets: createTriceratopsSheets("triceratops"),
    attacks: [
      { id: "triceratops_horn_thrust", kind: "cone", sprite: "attackBasic", telegraph: 0.62, cooldown: 2.9, minRange: 0, maxRange: 110, damageScale: 1.15, range: 186, arc: 26, hitboxTrigger: 9, windupStop: 5, activeAnimDuration: 15 / 14, animFps: 14, rarity: "normal", weight: 1 },
      { id: "triceratops_leap_slam", kind: "circle", sprite: "attackAlt", telegraph: 0.9, cooldown: 5.2, minRange: 40, maxRange: 220, damageScale: 1.25, radius: 98, hitboxTrigger: 11, windupStop: 5, activeAnimDuration: 15 / 14, animFps: 14, leapStartFrame: 4, leapEndFrame: 10, leapSpeedMult: 2.1, rarity: "uncommon", weight: 0.72 },
      { id: "triceratops_upward_horn_attack", kind: "cone", sprite: "attackLeap", telegraph: 0.58, cooldown: 3.2, minRange: 0, maxRange: 110, damageScale: 1.12, range: 138, arc: 64, knockback: 240, hitboxTrigger: 8, windupStop: 4, activeAnimDuration: 15 / 14, animFps: 14, rarity: "normal", weight: 0.88 }
    ]
  })
});

export const SHEPARD_ENEMY_IDS = Object.freeze(Object.keys(SHEPARD_ENEMY_DEFS));

export const SHEPARD_ROOM_ROSTER = Object.freeze([
  [],
  [],
  ["m_for_raptor_14", "m_for_kicker_15", "m_for_stegosaurus_16", "m_for_triceratops_17"],
  ["m_for_shepard_13", "m_for_raptor_14", "m_for_kicker_15", "m_for_stegosaurus_16", "m_for_triceratops_17"],
  ["m_for_shepard_13", "m_for_raptor_14", "m_for_kicker_15", "m_for_stegosaurus_16", "m_for_triceratops_17"]
]);

export function getShepardEnemyDef(id) {
  return SHEPARD_ENEMY_DEFS[id] || null;
}
