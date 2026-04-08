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
const PROJECTILE_ATTACK_KINDS = new Set([
  "projectile",
  "frame_synced_projectile",
  "frame_synced_random_projectile_burst",
  "projectile_burst",
  "sacrifice_burst",
  "projectile_spin",
  "projectile_trail",
  "projectile_backstep",
  "cone_projectile",
  "cone_arc_projectiles",
  "running_shot",
  "run_spread_shot"
]);
const SPINNING_AXE_PROJECTILE_EXCLUDED_ENEMY_IDS = new Set([
  "m_bar_archer_5",
  "m_bar_bowman_7",
  "m_bar_shaman_9"
]);
const SPINNING_AXE_PROJECTILE_DEFAULTS = Object.freeze({
  projectileSprite: "barbarianSpinningAxeProjectile",
  projectileSpriteFrames: 15,
  projectileSpriteFrameWidth: 256,
  projectileSpriteFrameHeight: 256,
  projectileSpriteCropWidth: 200,
  projectileSpriteCropHeight: 70,
  projectileSpriteFps: 18
});
const SPINNING_AXE_DEATH_PROJECTILE_DEFAULTS = Object.freeze({
  deathProjectileSprite: SPINNING_AXE_PROJECTILE_DEFAULTS.projectileSprite,
  deathProjectileSpriteFrames: SPINNING_AXE_PROJECTILE_DEFAULTS.projectileSpriteFrames,
  deathProjectileSpriteFrameWidth: SPINNING_AXE_PROJECTILE_DEFAULTS.projectileSpriteFrameWidth,
  deathProjectileSpriteFrameHeight: SPINNING_AXE_PROJECTILE_DEFAULTS.projectileSpriteFrameHeight,
  deathProjectileSpriteCropWidth: SPINNING_AXE_PROJECTILE_DEFAULTS.projectileSpriteCropWidth,
  deathProjectileSpriteCropHeight: SPINNING_AXE_PROJECTILE_DEFAULTS.projectileSpriteCropHeight,
  deathProjectileSpriteFps: SPINNING_AXE_PROJECTILE_DEFAULTS.projectileSpriteFps
});

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
    if (Array.isArray(tuned.hitConfigs)) {
      tuned.hitConfigs = tuned.hitConfigs.map((hitConfig) => ({
        ...hitConfig,
        range: Number.isFinite(hitConfig.range) ? scaleValue(hitConfig.range, MELEE_REACH_RANGE_SCALE, 48) : hitConfig.range,
        radius: Number.isFinite(hitConfig.radius) ? scaleValue(hitConfig.radius, MELEE_REACH_RADIUS_SCALE, 36) : hitConfig.radius
      }));
    }
    return tuned;
  });
}

function applySpinningAxeProjectileVisuals(enemyId, attacks) {
  if (SPINNING_AXE_PROJECTILE_EXCLUDED_ENEMY_IDS.has(enemyId)) return attacks;
  return attacks.map((attack) => {
    if (PROJECTILE_ATTACK_KINDS.has(attack.kind)) {
      return {
        ...attack,
        ...SPINNING_AXE_PROJECTILE_DEFAULTS
      };
    }
    if (attack.kind === "poisonous_blessing") {
      return {
        ...attack,
        ...SPINNING_AXE_DEATH_PROJECTILE_DEFAULTS
      };
    }
    return attack;
  });
}

function createAssetSpecs(folder, files) {
  return Object.entries(files).map(([key, file]) => [
    key,
    `./assets/enemies/Barbarian/${folder}/${file}`
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
  movementTactic = "Balance",
  collisionRadius = 0.34,
  tint = "#e5e7eb",
  hitAsset = null,
  sheets,
  attacks,
  plates = 0,
  guardStance = null,
  awakenBehavior = null,
  swiftStep = null
}) {
  return {
    id,
    name,
    folder,
    category: "Barbarian",
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
    attacks: applySpinningAxeProjectileVisuals(id, tuneMeleeAttackReach(attacks, role)),
    plates,
    guardStance,
    awakenBehavior,
    swiftStep
  };
}

export const BARBARIAN_ENEMY_ASSET_SPECS = [
  ["barbarianSpinningAxeProjectile", "./assets/projectiles/barbarian-spinning-axe.png"],
  ["barbarianShamanFireOrb", "./assets/Combat VFX/None Pixel VFX/Lightning/Lightning Orb/Fire Orb.png"],
  ["enemyUndeadArrow", "./assets/enemies/undead/Arrow.png"],
  ...createAssetSpecs("1Ogre", {
    barbarianOgreIdle: "Idle frame Ogre.png",
    barbarianOgreWalk: "Walk.png",
    barbarianOgreMove: "Run.png",
    barbarianOgreHit: "TakeDamage.png",
    barbarianOgreRolling: "Rolling.png",
    barbarianOgreAwaken: "UnSheath.png",
    barbarianOgreAttackBasic: "Attack1.png",
    barbarianOgreAttackAlt: "Attack2.png",
    barbarianOgreAttackHeavy: "Attack3.png",
    barbarianOgreAttackPummel: "Pummel.png",
    barbarianOgreAttackCast: "CastSpell.png",
    barbarianOgreAttackSpecial: "Special1.png",
    barbarianOgreAttackGroundSlam: "Special2.png",
    barbarianOgreAttackQuickShot: "QuickShot.png"
  }),
  ...createAssetSpecs("2Golem", {
    barbarianGolemIdle: "Golem Idle Frame.png",
    barbarianGolemWalk: "Walk.png",
    barbarianGolemMove: "Run.png",
    barbarianGolemHit: "TakeDamage.png",
    barbarianGolemRolling: "Rolling.png",
    barbarianGolemAwaken: "UnSheath.png",
    barbarianGolemAttackBasic: "Attack1.png",
    barbarianGolemAttackAlt: "Attack2.png",
    barbarianGolemAttackHeavy: "Attack3.png",
    barbarianGolemAttackPummel: "Pummel.png",
    barbarianGolemAttackCast: "CastSpell.png",
    barbarianGolemAttackRollingAttack: "rolling atack.png",
    barbarianGolemAttackBullCharge: "QuickSlide.png",
    barbarianGolemAttackSpecial: "Special1.png",
    barbarianGolemAttackQuickShot: "QuickShot.png"
  }),
  ...createAssetSpecs("3Nomad", {
    barbarianNomadIdle: "Idle.png",
    barbarianNomadWalk: "Walk.png",
    barbarianNomadMove: "Run.png",
    barbarianNomadHit: "TakeDamage.png",
    barbarianNomadRolling: "Rolling.png",
    barbarianNomadAttackBasic: "Attack1.png",
    barbarianNomadAttackAlt: "Attack2.png",
    barbarianNomadAttackHeavy: "Attack3.png",
    barbarianNomadAttackCast: "CastSpell.png",
    barbarianNomadAttackRun: "AttackRun.png",
    barbarianNomadBlockStart: "BlockStart.png",
    barbarianNomadBlockMid: "BlockMid.png",
    barbarianNomadAttackKick: "Kick.png",
    barbarianNomadAttackPummel: "Pummel.png",
    barbarianNomadAttackSpecial: "Special1.png"
  }),
  ...createAssetSpecs("4Berserker", {
    barbarianBerserkerIdle: "Idle.png",
    barbarianBerserkerWalk: "Walk.png",
    barbarianBerserkerMove: "Run.png",
    barbarianBerserkerHit: "TakeDamage.png",
    barbarianBerserkerRolling: "Rolling.png",
    barbarianBerserkerAttackBasic: "Attack1.png",
    barbarianBerserkerAttackAlt: "Attack2.png",
    barbarianBerserkerAttackHeavy: "Attack3.png",
    barbarianBerserkerAttackCast: "CastSpell.png",
    barbarianBerserkerAttackRun: "AttackRun.png",
    barbarianBerserkerAttackQuickShot: "QuickShot.png",
    barbarianBerserkerAttackKick: "Kick.png",
    barbarianBerserkerAttackPummel: "Pummel.png",
    barbarianBerserkerAttackSpecial: "Special1.png"
  }),
  ...createAssetSpecs("5BarbArcher", {
    barbarianBarbArcherIdle: "Idle.png",
    barbarianBarbArcherWalk: "Walk.png",
    barbarianBarbArcherMove: "Run.png",
    barbarianBarbArcherHit: "TakeDamage.png",
    barbarianBarbArcherCrouchIdle: "CrouchIdle.png",
    barbarianBarbArcherCrouchRun: "CrouchRun.png",
    barbarianBarbArcherRolling: "Rolling.png",
    barbarianBarbArcherAttackBasic: "Attack1.png",
    barbarianBarbArcherAttackAlt: "Attack2.png",
    barbarianBarbArcherAttackRun: "AttackRun.png",
    barbarianBarbArcherAttackSpin: "Attack3.png",
    barbarianBarbArcherAttackRain: "Special1.png",
    barbarianBarbArcherAttackKick: "Kick.png"
  }),
  ...createAssetSpecs("6Barbarian", {
    barbarianBarbarianIdle: "Idle.png",
    barbarianBarbarianWalk: "Walk.png",
    barbarianBarbarianMove: "Run.png",
    barbarianBarbarianHit: "TakeDamage.png",
    barbarianBarbarianRolling: "Rolling.png",
    barbarianBarbarianAttackBasic: "Attack1.png",
    barbarianBarbarianAttackAlt: "Attack2.png",
    barbarianBarbarianAttackHeavy: "Attack3.png",
    barbarianBarbarianAttackCast: "CastSpell.png",
    barbarianBarbarianAttackRun: "AttackRun.png",
    barbarianBarbarianAttackPummel: "Pummel.png",
    barbarianBarbarianAttackQuickShot: "QuickShot.png",
    barbarianBarbarianAttackSpecial: "Special1.png"
  }),
  ...createAssetSpecs("7BowMan", {
    barbarianBowManIdle: "Idle.png",
    barbarianBowManWalk: "Walk.png",
    barbarianBowManMove: "Run.png",
    barbarianBowManHit: "TakeDamage.png",
    barbarianBowManCrouchRun: "CrouchRun.png",
    barbarianBowManRolling: "Rolling.png",
    barbarianBowManAttackBasic: "Attack1.png",
    barbarianBowManAttackRun: "AttackRun.png",
    barbarianBowManAttackSpin: "Attack3.png",
    barbarianBowManAttackRain: "Special1.png",
    barbarianBowManAttackKick: "Kick.png"
  }),
  ...createAssetSpecs("8Witchdoctor", {
    barbarianWitchdoctorIdle: "Idle.png",
    barbarianWitchdoctorWalk: "Walk.png",
    barbarianWitchdoctorMove: "Run.png",
    barbarianWitchdoctorHit: "TakeDamage.png",
    barbarianWitchdoctorRolling: "QuickSlide.png",
    barbarianWitchdoctorAttackRun: "AttackRun.png",
    barbarianWitchdoctorAttackBasic: "Attack1.png",
    barbarianWitchdoctorAttackAlt: "Attack2.png",
    barbarianWitchdoctorAttackExplosion: "Attack3.png",
    barbarianWitchdoctorAttackCast: "CastSpell.png",
    barbarianWitchdoctorAttackPummel: "Pummel.png",
    barbarianWitchdoctorAttackWave: "Kick.png",
    barbarianWitchdoctorAttackSummon: "Special1.png",
    barbarianWitchdoctorAttackBolt: "Special2.png"
  }),
  ...createAssetSpecs("9Shaman", {
    barbarianShamanIdle: "Idle.png",
    barbarianShamanWalk: "Walk.png",
    barbarianShamanMove: "Run.png",
    barbarianShamanHit: "TakeDamage.png",
    barbarianShamanRolling: "QuickSlide.png",
    barbarianShamanAttackBasic: "Attack1.png",
    barbarianShamanAttackAlt: "Attack2.png",
    barbarianShamanAttackCast: "CastSpell.png",
    barbarianShamanAttackDance: "Attack3.png",
    barbarianShamanAttackThrower: "Kick.png",
    barbarianShamanAttackWave: "QuickShot.png",
    barbarianShamanAttackCleanse: "Special1.png",
    barbarianShamanAttackLeap: "Special2.png"
  })
];

export const BARBARIAN_ENEMY_DEFS = Object.freeze({
  m_bar_ogre_1: createDirectionalEnemy({
    id: "m_bar_ogre_1",
    name: "Barbarian Ogre",
    folder: "1Ogre",
    role: "melee",
    movementTactic: "Brave",
    hp: 104,
    damage: 14,
    speed: 104,
    size: 76,
    drawSize: 192,
    tint: "#fde68a",
    hitAsset: "barbarianOgreHit",
    sheets: {
      idle: sheet("barbarianOgreIdle", 1, 1, false),
      walk: sheet("barbarianOgreWalk", 15, 10, true),
      move: sheet("barbarianOgreMove", 15, 12, true),
      roll: sheet("barbarianOgreRolling", 15, 15, false),
      awaken: sheet("barbarianOgreAwaken"),
      attackBasic: sheet("barbarianOgreAttackBasic"),
      attackAlt: sheet("barbarianOgreAttackAlt"),
      attackHeavy: sheet("barbarianOgreAttackHeavy"),
      attackPummel: sheet("barbarianOgreAttackPummel"),
      attackCast: sheet("barbarianOgreAttackCast"),
      attackSpecial: sheet("barbarianOgreAttackSpecial"),
      attackGroundSlam: sheet("barbarianOgreAttackGroundSlam"),
      attackQuickShot: sheet("barbarianOgreAttackQuickShot")
    },
    awakenBehavior: {
      sprite: "awaken",
      duration: 15 / 14
    },
    attacks: [
      { id: "bar_ogre_heavy_slash", kind: "cone", sprite: "attackBasic", telegraph: 0.72, cooldown: 2.5, minRange: 0, maxRange: 110, damageScale: 1.25, range: 110, arc: 98, hitboxTrigger: 9, windupStop: 5, activeAnimDuration: 15 / 14, rarity: "normal", weight: 1 },
      { id: "bar_ogre_quick_slash", kind: "cone", sprite: "attackAlt", telegraph: 0.64, cooldown: 2.1, minRange: 0, maxRange: 110, damageScale: 1.05, range: 110, arc: 92, hitboxTrigger: 9, windupStop: 3, activeAnimDuration: 15 / 14, rarity: "normal", weight: 1 },
      { id: "bar_ogre_double_slash", kind: "frame_synced_cone", sprite: "attackSpecial", telegraph: 0.72, cooldown: 3.1, minRange: 0, maxRange: 40, damageScale: 0.95, range: 220, arc: 98, totalFrames: 15, animFps: 14, hitFrames: [4, 10], windupStop: 2, rarity: "uncommon", weight: 0.78 },
      { id: "bar_ogre_triple_strike", kind: "frame_synced_cone", sprite: "attackHeavy", telegraph: 0.86, cooldown: 4.2, minRange: 0, maxRange: 40, damageScale: 0.8, range: 222, arc: 102, totalFrames: 15, animFps: 14, hitFrames: [4, 8, 11], windupStop: 2, rarity: "rare", weight: 0.72 },
      { id: "bar_ogre_pummel", kind: "cone", sprite: "attackPummel", telegraph: 0.34, cooldown: 4.2, minRange: 0, maxRange: 110, damageScale: 1, range: 110, arc: 88, stunDuration: 0.3, hitboxTrigger: 6, windupStop: 3, activeAnimDuration: 15 / 14, animFps: 14, rarity: "uncommon", weight: 0.8 },
      { id: "bar_ogre_groundslam", kind: "circle", sprite: "attackGroundSlam", telegraph: 0.7, cooldown: 4.6, minRange: 0, maxRange: 165, damageScale: 1.2, radius: 185, hitboxTrigger: 9, windupStop: 6, activeAnimDuration: 15 / 14, animFps: 14, rarity: "uncommon", groundImpactScale: 1, groundImpactSprite: "groundImpactLightOrange", groundImpactDuration: 0.32, weight: 0.7 },
      { id: "bar_ogre_warcry", kind: "warcry", sprite: "attackQuickShot", telegraph: 0.62, cooldown: 8, minRange: 0, maxRange: 999, radius: 300, speedMult: 1.2, buffDuration: 3, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, animFps: 14, rarity: "rare", weight: 0.3 }
    ]
  }),
  m_bar_golem_2: createDirectionalEnemy({
    id: "m_bar_golem_2",
    name: "Barbarian Golem",
    folder: "2Golem",
    role: "melee",
    movementTactic: "Brave",
    hp: 112,
    damage: 15,
    speed: 96,
    plates: 3,
    size: 80,
    drawSize: 192,
    tint: "#cbd5e1",
    hitAsset: "barbarianGolemHit",
    sheets: {
      idle: sheet("barbarianGolemIdle", 1, 1, false),
      walk: sheet("barbarianGolemWalk", 15, 10, true),
      move: sheet("barbarianGolemMove", 15, 12, true),
      roll: sheet("barbarianGolemRolling", 15, 15, false),
      awaken: sheet("barbarianGolemAwaken"),
      attackBasic: sheet("barbarianGolemAttackBasic"),
      attackAlt: sheet("barbarianGolemAttackAlt"),
      attackHeavy: sheet("barbarianGolemAttackHeavy"),
      attackPummel: sheet("barbarianGolemAttackPummel"),
      attackCast: sheet("barbarianGolemAttackCast"),
      attackRollingAttack: sheet("barbarianGolemAttackRollingAttack", 15, 14, true),
      attackBullCharge: sheet("barbarianGolemAttackBullCharge", 15, 14, true),
      attackSpecial: sheet("barbarianGolemAttackSpecial"),
      attackQuickShot: sheet("barbarianGolemAttackQuickShot")
    },
    awakenBehavior: {
      sprite: "awaken",
      duration: 15 / 14
    },
    attacks: [
      { id: "bar_golem_downward_slash", kind: "cone", sprite: "attackBasic", telegraph: 0.72, cooldown: 2.6, minRange: 0, maxRange: 110, damageScale: 1.2, range: 110, arc: 98, hitboxTrigger: 9, windupStop: 5, activeAnimDuration: 15 / 14, rarity: "normal", weight: 1 },
      { id: "bar_golem_upward_slash", kind: "cone", sprite: "attackAlt", telegraph: 0.72, cooldown: 2.6, minRange: 0, maxRange: 110, damageScale: 1.2, range: 110, arc: 98, hitboxTrigger: 9, windupStop: 5, activeAnimDuration: 15 / 14, rarity: "normal", weight: 1 },
      { id: "bar_golem_whirlwind", kind: "frame_synced_circle", sprite: "attackHeavy", telegraph: 0.8, cooldown: 4.4, minRange: 0, maxRange: 165, damageScale: 0.95, radius: 172, totalFrames: 15, animFps: 14, hitFrames: [5, 8, 11], windupStop: 3, moveSpeedMultDuringActive: 0.3, rarity: "uncommon", weight: 0.7 },
      { id: "bar_golem_leap_slam", kind: "circle", sprite: "attackCast", telegraph: 15 / 14, cooldown: 5.8, minRange: 50, maxRange: 260, damageScale: 1.35, radius: 110, hitboxTrigger: 14, windupStop: 8, activeAnimDuration: 15 / 14, animFps: 14, leapStartFrame: 4, leapEndFrame: 10, leapSpeedMult: 3.0, leapDistance: 380, rarity: "rare", weight: 0.45 },
      { id: "bar_golem_bull_charge", kind: "rolling_attack", sprite: "attackBullCharge", telegraph: 0.42, cooldown: 6.8, minRange: 40, maxRange: 280, damageScale: 0.7, radius: 46, hitboxTrigger: 0, windupStop: 0, activeDurationSec: 1.2, animFps: 14, loopDuringActive: true, accelDurationSec: 0.01, startSpeedMult: 3, endSpeedMult: 3, turnResponse: 0, hitIntervalSec: 0.1, rarity: "uncommon", weight: 0.42 },
      { id: "bar_golem_rolling_attack", kind: "rolling_attack", sprite: "attackRollingAttack", telegraph: 0.48, cooldown: 8.4, minRange: 40, maxRange: 280, damageScale: 0.7, radius: 58, hitboxTrigger: 0, windupStop: 0, activeDurationSec: 5, animFps: 14, loopDuringActive: true, accelDurationSec: 3, startSpeedMult: 1, endSpeedMult: 3, turnResponse: 2.1, hitIntervalSec: 0.12, rarity: "rare", weight: 0.32 },
      { id: "bar_golem_warcry", kind: "warcry", sprite: "attackQuickShot", telegraph: 0.62, cooldown: 8.2, minRange: 0, maxRange: 999, radius: 300, buffMode: "ally_damage", damageMult: 1.25, buffDuration: 3, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, animFps: 14, rarity: "rare", weight: 0.28 }
    ]
  }),
  m_bar_nomad_3: createDirectionalEnemy({
    id: "m_bar_nomad_3",
    name: "Barbarian Nomad",
    folder: "3Nomad",
    role: "melee",
    plates: 3,
    hp: 74,
    damage: 11,
    speed: 116,
    size: 66,
    drawSize: 128,
    tint: "#fdba74",
    hitAsset: "barbarianNomadHit",
    sheets: {
      idle: sheet("barbarianNomadIdle", 15, 8, true),
      walk: sheet("barbarianNomadWalk", 15, 10, true),
      move: sheet("barbarianNomadMove", 15, 12, true),
      roll: sheet("barbarianNomadRolling", 15, 15, false),
      attackBasic: sheet("barbarianNomadAttackBasic"),
      attackAlt: sheet("barbarianNomadAttackAlt"),
      attackHeavy: sheet("barbarianNomadAttackHeavy"),
      attackCast: sheet("barbarianNomadAttackCast"),
      attackRun: sheet("barbarianNomadAttackRun"),
      guardStart: sheet("barbarianNomadBlockStart"),
      guardHold: sheet("barbarianNomadBlockMid", 15, 14, true),
      attackKick: sheet("barbarianNomadAttackKick"),
      attackPummel: sheet("barbarianNomadAttackPummel"),
      attackSpecial: sheet("barbarianNomadAttackSpecial")
    },
    guardStance: {
      threshold: 0.3,
      duration: 4,
      startDuration: 15 / 14,
      healPerSecond: 0.05
    },
    attacks: [
      { id: "bar_nomad_hammer_strike", kind: "cone", sprite: "attackBasic", telegraph: 0.6, cooldown: 2.3, minRange: 0, maxRange: 110, damageScale: 1.05, range: 110, arc: 86, knockback: 220, hitboxTrigger: 6, windupStop: 3, activeAnimDuration: 15 / 14, animFps: 14, weight: 1 },
      { id: "bar_nomad_heavy_swing", kind: "cone", sprite: "attackAlt", telegraph: 1.2, cooldown: 3.4, minRange: 0, maxRange: 110, damageScale: 1.4, range: 110, arc: 94, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.85 },
      { id: "bar_nomad_charged_strike", kind: "cone", sprite: "attackHeavy", telegraph: 1.5, cooldown: 4.8, minRange: 0, maxRange: 110, damageScale: 1.9, range: 110, arc: 92, stunDuration: 0.5, hitboxTrigger: 9, windupStop: 6, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.6 },
      { id: "bar_nomad_leap_slam", kind: "circle", sprite: "attackRun", telegraph: 15 / 14, cooldown: 5.8, minRange: 50, maxRange: 260, damageScale: 1.35, radius: 110, hitboxTrigger: 14, windupStop: 8, activeAnimDuration: 15 / 14, animFps: 14, leapStartFrame: 4, leapEndFrame: 10, leapSpeedMult: 3.0, leapDistance: 380, groundImpactScale: 1, groundImpactSprite: "groundImpactGreen", groundImpactDuration: 0.32, weight: 0.48 },
      { id: "bar_nomad_hammer_thrust", kind: "cone_projectile", sprite: "attackCast", telegraph: 0.68, cooldown: 5.1, minRange: 0, maxRange: 40, damageScale: 1, range: 210, arc: 34, hitboxTrigger: 6, windupStop: 3, activeAnimDuration: 15 / 14, animFps: 14, speedValue: 280, projectileSize: 18, projectileRadius: 14, projectileDrawSize: 112, projectileDamageScale: 0.9, projectileColor: "#f59e0b", boomerang: true, returnAfter: 180, returnSpeedMult: 1.2, weight: 0.58 },
      { id: "bar_nomad_double_strike", kind: "frame_synced_cone", sprite: "attackSpecial", telegraph: 0.86, cooldown: 5.4, minRange: 0, maxRange: 40, damageScale: 1, range: 198, arc: 90, totalFrames: 15, animFps: 14, hitFrames: [4, 9], windupStop: 2, hitConfigs: [{ range: 198, arc: 124, damageScale: 0.85, slowMult: 0.5, slowDuration: 0.5 }, { range: 216, arc: 42, damageScale: 1.25, stunDuration: 0.5 }], weight: 0.55 }
    ]
  }),
  m_bar_berserker_4: createDirectionalEnemy({
    id: "m_bar_berserker_4",
    name: "Barbarian Berserker",
    folder: "4Berserker",
    role: "melee",
    plates: 2,
    hp: 90,
    damage: 13,
    speed: 112,
    size: 68,
    drawSize: 128,
    tint: "#fca5a5",
    hitAsset: "barbarianBerserkerHit",
    sheets: {
      idle: sheet("barbarianBerserkerIdle", 15, 8, true),
      walk: sheet("barbarianBerserkerWalk", 15, 10, true),
      move: sheet("barbarianBerserkerMove", 15, 12, true),
      roll: sheet("barbarianBerserkerRolling", 15, 15, false),
      attackBasic: sheet("barbarianBerserkerAttackBasic"),
      attackAlt: sheet("barbarianBerserkerAttackAlt"),
      attackHeavy: sheet("barbarianBerserkerAttackHeavy"),
      attackCast: sheet("barbarianBerserkerAttackCast"),
      attackRun: sheet("barbarianBerserkerAttackRun"),
      attackQuickShot: sheet("barbarianBerserkerAttackQuickShot"),
      attackKick: sheet("barbarianBerserkerAttackKick"),
      attackPummel: sheet("barbarianBerserkerAttackPummel"),
      attackSpecial: sheet("barbarianBerserkerAttackSpecial")
    },
    attacks: [
      { id: "bar_berserker_upward_slash", kind: "cone", sprite: "attackBasic", telegraph: 0.5, cooldown: 2.1, minRange: 0, maxRange: 110, damageScale: 1.12, range: 110, arc: 92, hitboxTrigger: 6, windupStop: 3, activeAnimDuration: 15 / 14, animFps: 14, weight: 1 },
      { id: "bar_berserker_heavy_attack", kind: "cone", sprite: "attackAlt", telegraph: 0.8, cooldown: 3.1, minRange: 0, maxRange: 110, damageScale: 1.42, range: 110, arc: 96, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.82 },
      { id: "bar_berserker_double_slash", kind: "frame_synced_cone", sprite: "attackQuickShot", telegraph: 0.72, cooldown: 3.6, minRange: 0, maxRange: 40, damageScale: 1, range: 196, arc: 90, totalFrames: 15, animFps: 14, hitFrames: [6, 10], windupStop: 3, weight: 0.68 },
      { id: "bar_berserker_headshot_slash", kind: "cone_projectile", sprite: "attackHeavy", telegraph: 0.8, cooldown: 4.4, minRange: 0, maxRange: 40, damageScale: 1.35, range: 196, arc: 34, hitboxTrigger: 9, windupStop: 5, activeAnimDuration: 15 / 14, animFps: 14, speedValue: 300, projectileSize: 18, projectileDrawSize: 112, projectileRadius: 14, projectileDamageScale: 0.9, projectileSprite: "barbarianSpinningAxeProjectile", projectileSpriteFrames: 15, projectileSpriteFrameWidth: 256, projectileSpriteFrameHeight: 256, projectileSpriteCropWidth: 200, projectileSpriteCropHeight: 70, projectileSpriteFps: 18, weight: 0.64 },
      { id: "bar_berserker_throw_swords", kind: "projectile_burst", sprite: "attackCast", telegraph: 0.5, cooldown: 5.2, minRange: 0, maxRange: 220, damageScale: 0.82, radius: 58, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, animFps: 14, projectileCount: 8, random360: true, speedValue: 280, projectileSize: 18, projectileDrawSize: 112, projectileRadius: 14, boomerang: true, returnAfter: 180, returnSpeedMult: 1.2, projectileSprite: "barbarianSpinningAxeProjectile", projectileSpriteFrames: 15, projectileSpriteFrameWidth: 256, projectileSpriteFrameHeight: 256, projectileSpriteCropWidth: 200, projectileSpriteCropHeight: 70, projectileSpriteFps: 18, weight: 0.52 },
      { id: "bar_berserker_engage", kind: "engage", sprite: "attackKick", telegraph: 0.5, cooldown: 8.5, minRange: 0, maxRange: 999, hpSacrificePct: 0.2, speedMult: 1.5, buffDuration: 5, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.36 },
      { id: "bar_berserker_slash_combo", kind: "frame_synced_cone", sprite: "attackSpecial", telegraph: 0.86, cooldown: 5, minRange: 0, maxRange: 40, damageScale: 1, range: 204, arc: 92, totalFrames: 15, animFps: 14, hitFrames: [4, 10], windupStop: 2, hitConfigs: [{ range: 204, arc: 128, damageScale: 0.92 }, { range: 212, arc: 42, damageScale: 1.45 }], weight: 0.58 },
      { id: "bar_berserker_leap_slam", kind: "circle", sprite: "attackRun", telegraph: 15 / 14, cooldown: 5.8, minRange: 50, maxRange: 260, damageScale: 1.35, radius: 110, hitboxTrigger: 14, windupStop: 8, activeAnimDuration: 15 / 14, animFps: 14, leapStartFrame: 4, leapEndFrame: 10, leapSpeedMult: 3.0, leapDistance: 380, groundImpactScale: 1, groundImpactSprite: "groundImpactLightOrange", groundImpactDuration: 0.32, weight: 0.48 }
    ]
  }),
  m_bar_archer_5: createDirectionalEnemy({
    id: "m_bar_archer_5",
    name: "Barbarian Archer",
    folder: "5BarbArcher",
    role: "ranged",
    hp: 60,
    damage: 10,
    speed: 104,
    size: 62,
    drawSize: 128,
    preferredRange: 240,
    tint: "#bfdbfe",
    hitAsset: "barbarianBarbArcherHit",
    sheets: {
      idle: sheet("barbarianBarbArcherIdle", 15, 8, true),
      walk: sheet("barbarianBarbArcherWalk", 15, 10, true),
      move: sheet("barbarianBarbArcherMove", 15, 12, true),
      crouchIdle: sheet("barbarianBarbArcherCrouchIdle", 15, 8, true),
      crouchRun: sheet("barbarianBarbArcherCrouchRun", 15, 12, true),
      roll: sheet("barbarianBarbArcherRolling", 15, 15, false),
      attackBasic: sheet("barbarianBarbArcherAttackBasic"),
      attackAlt: sheet("barbarianBarbArcherAttackAlt"),
      attackRun: sheet("barbarianBarbArcherAttackRun"),
      attackSpin: sheet("barbarianBarbArcherAttackSpin"),
      attackRain: sheet("barbarianBarbArcherAttackRain"),
      attackKick: sheet("barbarianBarbArcherAttackKick")
    },
    swiftStep: {
      threshold: 0.5,
      runDuration: 2,
      holdDuration: 1,
      speedMult: 1.5,
      targetAlpha: 0.2
    },
    attacks: [
      { id: "bar_archer_sniper_shot", kind: "projectile", sprite: "attackBasic", telegraph: 0.9, cooldown: 2.8, minRange: 140, maxRange: 500, damageScale: 1.15, speedValue: 720, projectileSize: 12, hitboxTrigger: 11, windupStop: 9, projectileSpawnWindupT: 9 / 14, activeAnimDuration: 15 / 14, animFps: 14, weight: 1, projectileSprite: "enemyUndeadArrow" },
      { id: "bar_archer_arrow_volley", kind: "projectile_spin", sprite: "attackAlt", telegraph: 0.62, cooldown: 3.9, minRange: 100, maxRange: 450, damageScale: 0.85, speedValue: 340, projectileSize: 13, hitboxTrigger: 10, windupStop: 9, projectileSpawnWindupT: 9 / 14, spinStartDeg: -15, spinStepDeg: 15, spinCount: 3, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.72, projectileSprite: "enemyUndeadArrow" },
      { id: "bar_archer_running_shot", kind: "running_shot", sprite: "attackRun", telegraph: 15 / 14, cooldown: 4.8, minRange: 90, maxRange: 380, damageScale: 1, speedValue: 720, projectileSize: 12, projectileRadius: 8, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, animFps: 14, runSpeedMult: 3, runAngleDeg: 20, spreadDeg: 30, weight: 0.62, projectileSprite: "enemyUndeadArrow" },
      { id: "bar_archer_spin_shot", kind: "frame_synced_projectile", sprite: "attackSpin", telegraph: 0.5, cooldown: 5.4, minRange: 80, maxRange: 430, damageScale: 0.78, speedValue: 300, projectileSize: 14, projectileRadius: 10, totalFrames: 15, animFps: 14, hitFrames: [6, 7, 8, 9, 10, 11, 12, 13], windupStop: 3, shotAnglesDeg: [45, 0, -45, -90, -135, 180, 135, 90], weight: 0.56, projectileSprite: "enemyUndeadArrow" }
      ,{ id: "bar_archer_rain_arrow", kind: "targeted_rain_zone", sprite: "attackRain", telegraph: 0.8, cooldown: 6, minRange: 80, maxRange: 430, damageScale: 0.9, radius: 90, hitboxTrigger: 12, windupStop: 8, activeAnimDuration: 15 / 14, animFps: 14, zoneDurationSec: 3, zoneTickSec: 0.5, tickHitDuration: 0.12, weight: 0.5 }
    ]
  }),
  m_bar_barbarian_6: createDirectionalEnemy({
    id: "m_bar_barbarian_6",
    name: "Barbarian Warrior",
    folder: "6Barbarian",
    role: "melee",
    movementTactic: "Swarmer",
    hp: 78,
    damage: 12,
    speed: 114,
    size: 64,
    drawSize: 128,
    tint: "#fcd34d",
    hitAsset: "barbarianBarbarianHit",
    sheets: {
      idle: sheet("barbarianBarbarianIdle", 15, 8, true),
      walk: sheet("barbarianBarbarianWalk", 15, 10, true),
      move: sheet("barbarianBarbarianMove", 15, 12, true),
      roll: sheet("barbarianBarbarianRolling", 15, 15, false),
      attackBasic: sheet("barbarianBarbarianAttackBasic"),
      attackAlt: sheet("barbarianBarbarianAttackAlt"),
      attackHeavy: sheet("barbarianBarbarianAttackHeavy"),
      attackCast: sheet("barbarianBarbarianAttackCast"),
      attackRun: sheet("barbarianBarbarianAttackRun"),
      attackPummel: sheet("barbarianBarbarianAttackPummel"),
      attackQuickShot: sheet("barbarianBarbarianAttackQuickShot"),
      attackSpecial: sheet("barbarianBarbarianAttackSpecial")
    },
      attacks: [
        { id: "bar_barbarian_upward_swing", kind: "cone", sprite: "attackBasic", telegraph: 0.5, cooldown: 2.05, minRange: 0, maxRange: 110, damageScale: 1.08, range: 110, arc: 92, hitboxTrigger: 6, windupStop: 3, activeAnimDuration: 15 / 14, animFps: 14, weight: 1 },
        { id: "bar_barbarian_downward_swing", kind: "cone", sprite: "attackAlt", telegraph: 0.68, cooldown: 2.25, minRange: 0, maxRange: 110, damageScale: 1.2, range: 110, arc: 108, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.92 },
        { id: "bar_barbarian_charged_swing", kind: "cone", sprite: "attackHeavy", telegraph: 0.9, cooldown: 3.2, minRange: 0, maxRange: 110, damageScale: 1.55, range: 110, arc: 118, knockback: 220, hitboxTrigger: 9, windupStop: 6, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.72 },
        { id: "bar_barbarian_double_strike", kind: "frame_synced_cone", sprite: "attackQuickShot", telegraph: 0.72, cooldown: 3.6, minRange: 0, maxRange: 40, damageScale: 1, range: 202, arc: 92, totalFrames: 15, animFps: 14, hitFrames: [6, 10], windupStop: 3, weight: 0.68 },
        { id: "bar_barbarian_axe_thrust", kind: "cone_projectile", sprite: "attackCast", telegraph: 0.62, cooldown: 4.8, minRange: 0, maxRange: 40, damageScale: 1, range: 208, arc: 28, hitboxTrigger: 6, windupStop: 3, activeAnimDuration: 15 / 14, animFps: 14, speedValue: 180, projectileSize: 28, projectileDrawSize: 176, projectileRadius: 22, projectileDamageScale: 1.15, projectileSprite: "barbarianSpinningAxeProjectile", projectileSpriteFrames: 15, projectileSpriteFrameWidth: 256, projectileSpriteFrameHeight: 256, projectileSpriteCropWidth: 200, projectileSpriteCropHeight: 70, projectileSpriteFps: 18, weight: 0.62 },
        { id: "bar_barbarian_leap_slam", kind: "circle", sprite: "attackRun", telegraph: 15 / 14, cooldown: 5.8, minRange: 50, maxRange: 260, damageScale: 1.35, radius: 110, hitboxTrigger: 14, windupStop: 8, activeAnimDuration: 15 / 14, animFps: 14, leapStartFrame: 4, leapEndFrame: 10, leapSpeedMult: 3.0, leapDistance: 380, groundImpactScale: 1, groundImpactSprite: "groundImpactLightOrange", groundImpactDuration: 0.32, weight: 0.48 }
        ]
  }),
  m_bar_bowman_7: createDirectionalEnemy({
    id: "m_bar_bowman_7",
    name: "Barbarian Bow Man",
    folder: "7BowMan",
    role: "ranged",
    hp: 64,
    damage: 11,
    speed: 104,
    size: 62,
    drawSize: 128,
    preferredRange: 250,
    tint: "#93c5fd",
    hitAsset: "barbarianBowManHit",
    sheets: {
      idle: sheet("barbarianBowManIdle", 15, 8, true),
      walk: sheet("barbarianBowManWalk", 15, 10, true),
      move: sheet("barbarianBowManMove", 15, 12, true),
      crouchRun: sheet("barbarianBowManCrouchRun", 15, 12, true),
      roll: sheet("barbarianBowManRolling", 15, 15, false),
      attackBasic: sheet("barbarianBowManAttackBasic"),
      attackRun: sheet("barbarianBowManAttackRun"),
      attackSpin: sheet("barbarianBowManAttackSpin"),
      attackRain: sheet("barbarianBowManAttackRain"),
      attackKick: sheet("barbarianBowManAttackKick")
    },
      attacks: [
        { id: "bar_bowman_arrow_volley", kind: "projectile_spin", sprite: "attackBasic", telegraph: 0.72, cooldown: 2.8, minRange: 100, maxRange: 420, damageScale: 0.72, speedValue: 560, projectileSize: 10, projectileRadius: 6, hitboxTrigger: 11, windupStop: 9, projectileSpawnWindupT: 9 / 14, spinStartDeg: -45, spinStepDeg: 18, spinCount: 6, activeAnimDuration: 15 / 14, animFps: 14, weight: 1, projectileSprite: "enemyUndeadArrow" },
        { id: "bar_bowman_charged_shot", kind: "projectile", sprite: "attackBasic", telegraph: 1.2, cooldown: 3.8, minRange: 100, maxRange: 440, damageScale: 1.45, speedValue: 760, projectileSize: 18, projectileRadius: 10, hitboxTrigger: 11, windupStop: 9, projectileSpawnWindupT: 11 / 14, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.68, projectileSprite: "enemyUndeadArrow" },
        { id: "bar_bowman_spin_shot", kind: "frame_synced_projectile", sprite: "attackSpin", telegraph: 0.5, cooldown: 5.4, minRange: 80, maxRange: 430, damageScale: 0.78, speedValue: 300, projectileSize: 14, projectileRadius: 10, totalFrames: 15, animFps: 14, hitFrames: [6, 7, 8, 9, 10, 11, 12, 13], windupStop: 3, shotAnglesDeg: [45, 0, -45, -90, -135, 180, 135, 90], weight: 0.56, projectileSprite: "enemyUndeadArrow" },
        { id: "bar_bowman_rain_arrow", kind: "targeted_rain_zone", sprite: "attackRain", telegraph: 0.8, cooldown: 6, minRange: 80, maxRange: 430, damageScale: 0.9, radius: 90, hitboxTrigger: 12, windupStop: 8, activeAnimDuration: 15 / 14, animFps: 14, zoneDurationSec: 3, zoneTickSec: 0.5, tickHitDuration: 0.12, weight: 0.5 },
        { id: "bar_bowman_tactical_retreat_shot", kind: "running_shot", sprite: "attackRun", telegraph: 15 / 14, cooldown: 5.4, minRange: 0, maxRange: 999, damageScale: 1.1, speedValue: 760, projectileSize: 14, projectileRadius: 8, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, animFps: 14, runSpeedMult: 1.5, runAngleDeg: 0, spreadDeg: 0, projectileCount: 1, weight: 0, projectileSprite: "enemyUndeadArrow" }
        ],
    swiftStep: {
      threshold: 0.5,
      runDuration: 1.5,
      holdDuration: 0,
      speedMult: 1.5,
      targetAlpha: 1,
      followupAttackId: "bar_bowman_tactical_retreat_shot"
    }
    }),
  m_bar_witchdoctor_8: createDirectionalEnemy({
    id: "m_bar_witchdoctor_8",
    name: "Barbarian Witchdoctor",
    folder: "8Witchdoctor",
    role: "ranged",
    plates: 2,
    hp: 60,
    damage: 11,
    speed: 98,
    size: 62,
    drawSize: 128,
    preferredRange: 230,
    tint: "#c4b5fd",
    hitAsset: "barbarianWitchdoctorHit",
    sheets: {
      idle: sheet("barbarianWitchdoctorIdle", 15, 8, true),
      walk: sheet("barbarianWitchdoctorWalk", 15, 10, true),
      move: sheet("barbarianWitchdoctorMove", 15, 12, true),
      roll: sheet("barbarianWitchdoctorRolling", 15, 15, false),
      attackRun: sheet("barbarianWitchdoctorAttackRun"),
      attackBasic: sheet("barbarianWitchdoctorAttackBasic"),
      attackAlt: sheet("barbarianWitchdoctorAttackAlt"),
      attackExplosion: sheet("barbarianWitchdoctorAttackExplosion"),
      attackCast: sheet("barbarianWitchdoctorAttackCast"),
      attackPummel: sheet("barbarianWitchdoctorAttackPummel"),
      attackWave: sheet("barbarianWitchdoctorAttackWave"),
      attackSummon: sheet("barbarianWitchdoctorAttackSummon"),
      attackBolt: sheet("barbarianWitchdoctorAttackBolt")
    },
    attacks: [
      { id: "bar_witchdoctor_upward_slash", kind: "cone_followup_blast", sprite: "attackBasic", telegraph: 0.54, cooldown: 2.6, minRange: 0, maxRange: 40, damageScale: 1, range: 92, arc: 42, hitboxTrigger: 6, windupStop: 3, followupFrame: 8, followupOffset: 72, followupRadius: 42, followupDamageScale: 0.65, followupPoisonDps: 3, followupPoisonDuration: 4, groundImpactSprite: "groundImpactGreen", groundImpactScale: 1, activeAnimDuration: 15 / 14, animFps: 14, weight: 1 },
      { id: "bar_witchdoctor_acid_spill", kind: "cone_arc_projectiles", sprite: "attackAlt", telegraph: 0.5, cooldown: 3.4, minRange: 0, maxRange: 40, damageScale: 0.7, range: 115, arc: 70, hitboxTrigger: 5, windupStop: 3, projectileCount: 8, projectileSpreadDeg: 90, projectileSpeed: 260, projectileSize: 10, projectileRadius: 5, projectileDamageScale: 0.42, projectileLifetime: 1, projectileGravityY: 560, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.95 },
      { id: "bar_witchdoctor_poison_pool", kind: "poison_pool", sprite: "attackExplosion", telegraph: 0.72, cooldown: 4.8, minRange: 0, maxRange: 220, radius: 110, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, animFps: 14, zoneDurationSec: 4, zoneTickSec: 0.5, poisonDps: 3, poisonDuration: 4, allySpeedMult: 1.35, buffTickSec: 0.15, allyBuffRefreshSec: 0.24, visualTickSec: 0.12, visualDurationSec: 0.2, poolColor: "#84cc16", weight: 0.55 },
      { id: "bar_witchdoctor_poisonous_blessing", kind: "poisonous_blessing", sprite: "attackPummel", telegraph: 0.68, cooldown: 8.4, minRange: 0, maxRange: 260, radius: 180, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, animFps: 14, blessingDuration: 5, allySpeedMult: 1.3, deathProjectileSpeed: 240, deathProjectileSize: 10, deathProjectileRadius: 6, deathProjectileDamageScale: 0.5, deathProjectilePoisonDps: 3, deathProjectilePoisonDuration: 4, weight: 0.28 },
      { id: "bar_witchdoctor_wave", kind: "projectile_spin", sprite: "attackWave", telegraph: 0.88, cooldown: 5.6, minRange: 70, maxRange: 420, damageScale: 0.72, speedValue: 260, projectileSize: 16, hitboxTrigger: 6, windupStop: 3, projectileSpawnWindupT: 6 / 14, spinStartDeg: 60, spinStepDeg: -30, spinCount: 6, spinFrameInterval: 0.09, activeAnimDuration: 15 / 14, weight: 0.48 },
      { id: "bar_witchdoctor_poison_burst", kind: "sacrifice_burst", sprite: "attackSummon", telegraph: 0.72, cooldown: 8.8, minRange: 0, maxRange: 999, hitboxTrigger: 9, windupStop: 5, hpSacrificePct: 0.3, healRadius: 180, projectileCount: 10, projectileSpeed: 260, projectileSize: 10, projectileRadius: 5, projectileDamageScale: 0.42, projectileLifetime: 1, projectileGravityY: 560, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.34 },
      { id: "bar_witchdoctor_poison_cascade", kind: "frame_synced_random_projectile_burst", sprite: "attackBolt", telegraph: 0.7, cooldown: 7.2, minRange: 0, maxRange: 999, speedValue: 220, projectileSize: 10, projectileRadius: 5, projectileDamageScale: 0.4, totalFrames: 15, animFps: 14, hitFrames: [5, 6, 7, 8, 9, 10], windupStop: 3, projectilesPerFrame: 4, activeAnimDuration: 15 / 14, weight: 0.3 },
      { id: "bar_witchdoctor_summon", kind: "summon", sprite: "attackSummon", telegraph: 0.72, cooldown: 11, minRange: 40, maxRange: 480, hitboxTrigger: 9, windupStop: 5, spawnType: "m_bar_barbarian_6", summonAroundSelf: true, summonRadius: 120, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.38 }
    ]
  }),
  m_bar_shaman_9: createDirectionalEnemy({
    id: "m_bar_shaman_9",
    name: "Barbarian Shaman",
    folder: "9Shaman",
    role: "ranged",
    movementTactic: "Coward",
    hp: 58,
    damage: 12,
    speed: 102,
    size: 64,
    drawSize: 128,
    preferredRange: 240,
    tint: "#fca5a5",
    hitAsset: "barbarianShamanHit",
    sheets: {
      idle: sheet("barbarianShamanIdle", 15, 8, true),
      walk: sheet("barbarianShamanWalk", 15, 10, true),
      move: sheet("barbarianShamanMove", 15, 12, true),
      roll: sheet("barbarianShamanRolling", 15, 15, false),
      attackBasic: sheet("barbarianShamanAttackBasic"),
      attackAlt: sheet("barbarianShamanAttackAlt"),
      attackCast: sheet("barbarianShamanAttackCast"),
      attackDance: sheet("barbarianShamanAttackDance"),
      attackThrower: sheet("barbarianShamanAttackThrower"),
      attackWave: sheet("barbarianShamanAttackWave"),
      attackCleanse: sheet("barbarianShamanAttackCleanse"),
      attackLeap: sheet("barbarianShamanAttackLeap")
    },
    attacks: [
      { id: "bar_shaman_basic", kind: "projectile", sprite: "attackBasic", telegraph: 0.56, cooldown: 2.3, minRange: 120, maxRange: 440, damageScale: 1, speedValue: 340, projectileSize: 14, projectileDrawSize: 48, projectileSprite: "barbarianShamanFireOrb", projectileSpriteFrames: 16, projectileSpriteFrameWidth: 64, projectileSpriteFrameHeight: 64, projectileSpriteFps: 18, projectileImpactSprite: "fireExplosion", projectileImpactSize: 48, hitboxTrigger: 7, windupStop: 4, projectileSpawnWindupT: 7 / 14, activeAnimDuration: 15 / 14, weight: 1 },
      { id: "bar_shaman_alt", kind: "projectile", sprite: "attackAlt", telegraph: 0.62, cooldown: 2.7, minRange: 120, maxRange: 440, damageScale: 1.05, speedValue: 320, projectileSize: 16, projectileDrawSize: 52, projectileSprite: "barbarianShamanFireOrb", projectileSpriteFrames: 16, projectileSpriteFrameWidth: 64, projectileSpriteFrameHeight: 64, projectileSpriteFps: 18, projectileImpactSprite: "fireExplosion", projectileImpactSize: 48, hitboxTrigger: 8, windupStop: 5, projectileSpawnWindupT: 8 / 14, activeAnimDuration: 15 / 14, weight: 0.9 },
      { id: "bar_shaman_dance", kind: "fire_circle_expand", sprite: "attackDance", telegraph: 0.88, cooldown: 5.6, minRange: 70, maxRange: 420, damageScale: 0.65, hitboxTrigger: 9, windupStop: 6, startRadius: 50, endRadius: 150, expandDurationSec: 1, expandTickSec: 0.1, hitDuration: 0.12, knockback: 90, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.45 },
      { id: "bar_shaman_thrower", kind: "fire_thrower", sprite: "attackThrower", telegraph: 0.92, cooldown: 5.8, minRange: 40, maxRange: 220, damageScale: 0.42, range: 180, arc: 65, fireThrowerIntervalSec: 0.18, fireThrowerDurationSec: 1.4, hitboxTrigger: 5, windupStop: 3, activeAnimDuration: 15 / 14, loopDuringActive: true, fireVfxSprite: "orangeFireThrowerVfx", fireVfxFrameWidth: 81, fireVfxFrameHeight: 47, fireVfxFps: 15, fireVfxStartFrames: 5, fireVfxLoopStart: 5, fireVfxLoopEnd: 9, fireVfxEndStart: 10, fireVfxEndFrames: 7, fireVfxDrawWidth: 180, fireVfxDrawHeight: 72, weight: 0.5 },
      { id: "bar_shaman_wave", kind: "projectile_spin", sprite: "attackWave", telegraph: 0.86, cooldown: 5.4, minRange: 80, maxRange: 420, damageScale: 0.75, speedValue: 300, projectileSize: 16, projectileDrawSize: 52, projectileSprite: "barbarianShamanFireOrb", projectileSpriteFrames: 16, projectileSpriteFrameWidth: 64, projectileSpriteFrameHeight: 64, projectileSpriteFps: 18, hitboxTrigger: 6, windupStop: 3, projectileSpawnWindupT: 6 / 14, spinStartDeg: 30, spinStepDeg: -30, spinCount: 6, spinFrameInterval: 0.09, activeAnimDuration: 15 / 14, weight: 0.42 },
      { id: "bar_shaman_cleanse", kind: "circle", sprite: "attackCleanse", telegraph: 0.82, cooldown: 6.2, minRange: 50, maxRange: 420, damageScale: 1.1, radius: 120, hitboxTrigger: 9, windupStop: 6, activeAnimDuration: 15 / 14, weight: 0.45 },
      { id: "bar_shaman_leap", kind: "fire_leap", sprite: "attackLeap", telegraph: 0.78, cooldown: 6.4, minRange: 50, maxRange: 240, damageScale: 1.15, radius: 95, hitboxTrigger: 10, windupStop: 6, activeAnimDuration: 15 / 14, animFps: 14, leapDistance: 220, weight: 0.4 }
    ]
  })
});

export const BARBARIAN_ENEMY_IDS = Object.freeze(Object.keys(BARBARIAN_ENEMY_DEFS));

export const BARBARIAN_ROOM_ROSTER = Object.freeze([
  ["m_bar_ogre_1", "m_bar_barbarian_6"],
  ["m_bar_archer_5", "m_bar_berserker_4"],
  ["m_bar_nomad_3", "m_bar_witchdoctor_8"],
  ["m_bar_shaman_9", "m_bar_golem_2"],
  ["m_bar_bowman_7"]
]);

export function getBarbarianEnemyDef(id) {
  return BARBARIAN_ENEMY_DEFS[id] || null;
}
