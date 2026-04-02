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

function createAssetSpecs(folder, files) {
  return Object.entries(files).map(([key, file]) => [
    key,
    `./assets/enemies/Enemies/${folder}/${file}`
  ]);
}

function createDirectionalEnemy({
  id,
  name,
  folder,
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
  sneakBehavior = null
}) {
  return {
    id,
    name,
    folder,
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
    sneakBehavior
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
  })
];

export const SHEPARD_ENEMY_DEFS = Object.freeze({
  m_for_shepard_13: createDirectionalEnemy({
    id: "m_for_shepard_13",
    name: "Shepherd",
    folder: "13Shepard",
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
      { id: "shepard_pounce", kind: "cone", sprite: "attackPounce", telegraph: 0.5, cooldown: 2.4, minRange: 0, maxRange: 120, damageScale: 1, range: 108, arc: 46, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, animFps: 14, weight: 1 },
      { id: "shepard_leap", kind: "circle", sprite: "attackLeap", telegraph: 0.9, cooldown: 5.6, minRange: 40, maxRange: 220, damageScale: 1.2, radius: 74, hitboxTrigger: 11, windupStop: 4, activeAnimDuration: 15 / 14, animFps: 14, leapStartFrame: 4, leapEndFrame: 10, leapSpeedMult: 2.2, weight: 0.62 }
    ]
  })
});

export const SHEPARD_ENEMY_IDS = Object.freeze(Object.keys(SHEPARD_ENEMY_DEFS));

export const SHEPARD_ROOM_ROSTER = Object.freeze([
  [],
  [],
  [],
  ["m_for_shepard_13"],
  ["m_for_shepard_13"]
]);

export function getShepardEnemyDef(id) {
  return SHEPARD_ENEMY_DEFS[id] || null;
}
