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

function createAssetSpecs(folder, files) {
  return Object.entries(files).map(([key, file]) => [
    key,
    `./assets/enemies/undead/${folder}/${file}`
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
  lockedSheetKey = null,
  ignoreStagger = false,
  ignoreKnockback = false
}) {
  return {
    id,
    name,
    folder,
    category: "Undead",
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
    lockedSheetKey,
    ignoreStagger,
    ignoreKnockback,
    rowOrder: ROW_ORDER,
    sprite: {
      ...sheets,
      ...(hitAsset ? { hit: sheet(hitAsset, 15, 18, false) } : {})
    },
    attacks: tuneMeleeAttackReach(attacks, role),
    plates
  };
}

export const UNDEAD_ENEMY_ASSET_SPECS = [
  ["enemyUndeadArrow", "./assets/enemies/undead/Arrow.png"],
  ["enemyUndeadDarkSpinningAxe", "./assets/projectiles/dark-spinning-axe.png"],
  ["enemyWizardChargedFireball", "./assets/Combat VFX/flashing orb/Orange Flashing orb.png"],
  ...createAssetSpecs("1Brute", {
    undeadBruteIdle: "Idle.png",
    undeadBruteWalk: "Walk.png",
    undeadBruteMove: "Run.png",
    undeadBruteHit: "TakeDamage.png",
    undeadBruteRolling: "Rolling.png",
    undeadBruteAttackDown: "Attack1.png",
    undeadBruteAttackUp: "Attack2.png",
    undeadBruteAttackCyclone: "Attack3.png",
    undeadBruteAttackGroundSlam: "groundSlam.png",
    undeadBruteAttackWarcry: "QuickShot.png"
  }),
  ...createAssetSpecs("6Warrior", {
    undeadWarriorIdle: "Idle.png",
    undeadWarriorWalk: "Walk.png",
    undeadWarriorMove: "Run.png",
    undeadWarriorHit: "TakeDamage.png",
    undeadWarriorRolling: "Rolling.png",
    undeadWarriorAttackUp: "Attack1.png",
    undeadWarriorAttackDown: "Attack2.png",
    undeadWarriorAttackCyclone: "Attack3.png",
    undeadWarriorAttackKick: "Kick.png",
    undeadWarriorAttackGroundSlam: "groudSlam.png"
  }),
  ...createAssetSpecs("5Archer", {
    undeadArcherIdle: "Idle.png",
    undeadArcherWalk: "Walk.png",
    undeadArcherMove: "Run.png",
    undeadArcherHit: "TakeDamage.png",
    undeadArcherRolling: "Rolling.png",
    undeadArcherAttackBasic: "Attack1.png",
    undeadArcherAttackSpinShot: "Attack3.png",
    undeadArcherAttackArrowRain: "ArrowRain.png",
    undeadArcherAttackKick: "Kick.png"
  }),
  ...createAssetSpecs("4Berserker", {
    undeadBerserkerIdle: "Idle.png",
    undeadBerserkerWalk: "Walk.png",
    undeadBerserkerMove: "Run.png",
    undeadBerserkerHit: "TakeDamage.png",
    undeadBerserkerRolling: "Rolling.png",
    undeadBerserkerAttackBasic: "Attack1.png",
    undeadBerserkerAttackDown: "Attack2.png",
    undeadBerserkerAttackSpin: "Attack3.png",
    undeadBerserkerAttackCast: "CastSpell.png",
    undeadBerserkerAttackQuickSlash: "Pummel.png",
    undeadBerserkerAttackEmpowered: "Special1.png"
  }),
  ...createAssetSpecs("7DarkArcher", {
    undeadDarkArcherIdle: "Idle.png",
    undeadDarkArcherWalk: "Walk.png",
    undeadDarkArcherMove: "Run.png",
    undeadDarkArcherHit: "TakeDamage.png",
    undeadDarkArcherRolling: "Rolling.png",
    undeadDarkArcherAttackBasic: "Attack1.png",
    undeadDarkArcherAttackSpinShot: "Attack3.png",
    undeadDarkArcherAttackArrowRain: "Special1.png",
    undeadDarkArcherAttackKick: "Kick.png"
  }),
  ...createAssetSpecs("8Necromancer", {
    undeadNecromancerIdle: "Idle.png",
    undeadNecromancerWalk: "Walk.png",
    undeadNecromancerMove: "Run.png",
    undeadNecromancerHit: "TakeDamage.png",
    undeadNecromancerRolling: "Rolling.png",
    undeadNecromancerAttackBasic: "Attack1.png",
    undeadNecromancerAttackAlt: "Attack2.png",
    undeadNecromancerAttackExplosion: "Attack3.png",
    undeadNecromancerAttackDarkfirePillar: "CastSpell.png",
    undeadNecromancerAttackDarkWave: "Kick.png",
    undeadNecromancerAttackSummonWarrior: "Special1.png",
    undeadNecromancerAttackDarkBolt: "Special2.png"
  }),
  ...createAssetSpecs("9Wizard", {
    undeadWizardIdle: "Idle.png",
    undeadWizardWalk: "Walk.png",
    undeadWizardMove: "Run.png",
    undeadWizardHit: "TakeDamage.png",
    undeadWizardRolling: "Rolling.png",
    undeadWizardAttackBasic: "Attack1.png",
    undeadWizardAttackAlt: "Attack2.png",
    undeadWizardAttackCast: "CastSpell.png",
    undeadWizardAttackFireDance: "FrontFlip.png",
    undeadWizardAttackFireThrower: "Kick.png",
    undeadWizardAttackFireWave: "QuickShot.png",
    undeadWizardAttackFireCleanse: "Special1.png",
    undeadWizardAttackFireLeap: "Special1.png"
  }),
  ...createAssetSpecs("2DarkLord", {
    undeadDarkLordIdle: "Idle.png",
    undeadDarkLordWalk: "Walk.png",
    undeadDarkLordMove: "Run.png",
    undeadDarkLordHit: "TakeDamage.png",
    undeadDarkLordRolling: "Rolling.png",
    undeadDarkLordAttackBasic: "Attack1.png",
    undeadDarkLordAttackSpin: "Attack2.png",
    undeadDarkLordAttackSwift: "Attack3.png",
    undeadDarkLordAttackShieldBash: "Pummel.png",
    undeadDarkLordAttackWarcry: "Warcry.png",
    undeadDarkLordAttackDoubleStrike: "double-strike.png",
    undeadDarkLordAttackRun: "AttackRun.png"
  }),
  ...createAssetSpecs("3DarkKnight", {
    undeadDarkKnightIdle: "Idle.png",
    undeadDarkKnightWalk: "Walk.png",
    undeadDarkKnightMove: "Run.png",
    undeadDarkKnightHit: "TakeDamage.png",
    undeadDarkKnightRolling: "Rolling.png",
    undeadDarkKnightAttackUp: "Attack1.png",
    undeadDarkKnightAttackDown: "Attack2.png",
    undeadDarkKnightAttackCast: "CastSpell.png",
    undeadDarkKnightAttackRun: "AttackRun.png"
  }),
  ...createAssetSpecs("../Enemies/11Arcane elemental", {
    arcaneElementalIdle: "Idle.png",
    arcaneElementalIdle2: "Idle2.png",
    arcaneElementalWalk: "Walk.png",
    arcaneElementalMove: "Run.png",
    arcaneElementalHit: "TakeDamage.png",
    arcaneElementalDie: "Die.png",
    arcaneElementalAttack1: "Attack1.png",
    arcaneElementalAttack2: "Attack2.png",
    arcaneElementalAttack3: "Attack3.png",
    arcaneElementalAttack4: "Attack4.png"
  })
];

export const UNDEAD_ENEMY_DEFS = Object.freeze({
  m_ud_brute: createDirectionalEnemy({
    id: "m_ud_brute",
    name: "Undead Brute",
    folder: "1Brute",
    role: "melee",
    plates: 2,
    hp: 88,
    damage: 12,
    speed: 108,
    size: 72,
    drawSize: 192,
    tint: "#c7d2fe",
    hitAsset: "undeadBruteHit",
    sheets: {
      idle: sheet("undeadBruteIdle", 15, 8, true),
      walk: sheet("undeadBruteWalk", 15, 10, true),
      move: sheet("undeadBruteMove", 15, 12, true),
      roll: sheet("undeadBruteRolling", 15, 15, false),
      attackDown: sheet("undeadBruteAttackDown"),
      attackUp: sheet("undeadBruteAttackUp"),
      attackCyclone: sheet("undeadBruteAttackCyclone"),
      attackGroundSlam: sheet("undeadBruteAttackGroundSlam"),
      attackWarcry: sheet("undeadBruteAttackWarcry")
    },
    attacks: [
      { id: "ud_brute_downslash", kind: "cone", sprite: "attackDown", telegraph: 0.58, cooldown: 2.15, minRange: 0, maxRange: 110, damageScale: 1.12, range: 220, arc: 95, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, weight: 1 },
      { id: "ud_brute_upslash", kind: "cone", sprite: "attackUp", telegraph: 0.58, cooldown: 2.15, minRange: 0, maxRange: 110, damageScale: 1.12, range: 210, arc: 95, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, weight: 1 },
      { id: "ud_brute_cyclone_slash", kind: "frame_synced_circle", sprite: "attackCyclone", telegraph: 0.48, cooldown: 3.2, minRange: 0, maxRange: 185, damageScale: 1.05, radius: 150, totalFrames: 15, animFps: 14, hitFrames: [7, 10, 14], windupStop: 4, weight: 0.9 },
      { id: "ud_brute_whirlwind", kind: "whirlwind", sprite: "attackCyclone", telegraph: 0.52, cooldown: 4.5, minRange: 0, maxRange: 200, damageScale: 1, radius: 130, circleDurationMs: 100, hitboxTrigger: 4, windupStop: 2, activeAnimDuration: 15 / 14, animFps: 14, burstCount: 3, burstGap: 0.2, bladeDamageScale: 0.9, bladeSpeed: 400, bladeSize: 14, weight: 0.85 },
      { id: "ud_brute_groundslam", kind: "circle", sprite: "attackGroundSlam", telegraph: 0.62, cooldown: 3.4, minRange: 0, maxRange: 140, damageScale: 1.15, radius: 165, hitboxTrigger: 11, windupStop: 7, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.75 },
      { id: "ud_brute_warcry", kind: "warcry", sprite: "attackWarcry", telegraph: 0.62, cooldown: 8, minRange: 0, maxRange: 999, radius: 300, speedMult: 1.2, buffDuration: 3, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.35 }
    ]
  }),
  m_ud_warrior: createDirectionalEnemy({
    id: "m_ud_warrior",
    name: "Undead Warrior",
    folder: "6Warrior",
    role: "melee",
    movementTactic: "Swarmer",
    hp: 76,
    damage: 11,
    speed: 114,
    size: 68,
    drawSize: 128,
    tint: "#d1d5db",
    hitAsset: "undeadWarriorHit",
    sheets: {
      idle: sheet("undeadWarriorIdle", 15, 8, true),
      walk: sheet("undeadWarriorWalk", 15, 10, true),
      move: sheet("undeadWarriorMove", 15, 12, true),
      roll: sheet("undeadWarriorRolling", 15, 15, false),
      attackUp: sheet("undeadWarriorAttackUp"),
      attackDown: sheet("undeadWarriorAttackDown"),
      attackCyclone: sheet("undeadWarriorAttackCyclone"),
      attackKick: sheet("undeadWarriorAttackKick"),
      attackGroundSlam: sheet("undeadWarriorAttackGroundSlam")
    },
    attacks: [
      { id: "ud_warrior_downslash", kind: "cone", sprite: "attackDown", telegraph: 0.56, cooldown: 2.05, minRange: 0, maxRange: 110, damageScale: 1.05, range: 200, arc: 92, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, weight: 1 },
      { id: "ud_warrior_upslash", kind: "cone", sprite: "attackUp", telegraph: 0.56, cooldown: 2.05, minRange: 0, maxRange: 110, damageScale: 1.05, range: 195, arc: 92, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, weight: 1 },
      { id: "ud_warrior_kick", kind: "cone", sprite: "attackKick", telegraph: 0.42, cooldown: 2.35, minRange: 0, maxRange: 110, damageScale: 0.72, range: 108, arc: 62, knockback: 70, hitboxTrigger: 6, windupStop: 3, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.92 },
      { id: "ud_warrior_shield_bash", kind: "whirlwind", sprite: "attackCyclone", telegraph: 0.48, cooldown: 4.2, minRange: 0, maxRange: 155, damageScale: 0.95, radius: 52, circleDurationMs: 100, hitboxTrigger: 6, windupStop: 3, activeAnimDuration: 15 / 14, animFps: 14, burstCount: 2, burstGap: 0.3, omitBlade: true, weight: 0.9 },
      { id: "ud_warrior_groundslam", kind: "circle", sprite: "attackGroundSlam", telegraph: 0.62, cooldown: 3.4, minRange: 0, maxRange: 140, damageScale: 1.15, radius: 165, hitboxTrigger: 11, windupStop: 7, activeAnimDuration: 15 / 14, animFps: 14, groundImpactScale: 1, groundImpactSprite: "groundImpactLightOrange", groundImpactDuration: 0.32, weight: 0.75 }
    ]
  }),
  m_ud_archer_5: createDirectionalEnemy({
    id: "m_ud_archer_5",
    name: "Undead Archer",
    folder: "5Archer",
    role: "ranged",
    hp: 62,
    damage: 10,
    speed: 102,
    size: 64,
    drawSize: 128,
    preferredRange: 240,
    tint: "#dbeafe",
    hitAsset: "undeadArcherHit",
    sheets: {
      idle: sheet("undeadArcherIdle", 15, 8, true),
      walk: sheet("undeadArcherWalk", 15, 10, true),
      move: sheet("undeadArcherMove", 15, 12, true),
      roll: sheet("undeadArcherRolling", 15, 15, false),
      attackBasic: sheet("undeadArcherAttackBasic"),
      attackSpinShot: sheet("undeadArcherAttackSpinShot"),
      attackArrowRain: sheet("undeadArcherAttackArrowRain"),
      attackKick: sheet("undeadArcherAttackKick")
    },
    attacks: [
      { id: "ud_archer_basic_shot", kind: "projectile", sprite: "attackBasic", telegraph: 0.5, cooldown: 2.1, minRange: 100, maxRange: 420, damageScale: 1, speedValue: 320, projectileSize: 12, hitboxTrigger: 11, windupStop: 9, projectileSpawnWindupT: 0.71, activeAnimDuration: 15 / 14, weight: 1, projectileSprite: "enemyUndeadArrow" },
      { id: "ud_archer_charged_shot", kind: "projectile", sprite: "attackBasic", telegraph: 1, cooldown: 3.5, minRange: 100, maxRange: 420, damageScale: 1, speedValue: 520, projectileSize: 16, hitboxTrigger: 11, windupStop: 9, projectileSpawnWindupT: 11 / 14, activeAnimDuration: 15 / 14, weight: 0.65, projectileSprite: "enemyUndeadArrow" },
      { id: "ud_archer_spin_shot", kind: "frame_synced_projectile", sprite: "attackSpinShot", telegraph: 0.5, cooldown: 5.4, minRange: 80, maxRange: 430, damageScale: 0.78, speedValue: 300, projectileSize: 14, projectileRadius: 10, totalFrames: 15, animFps: 14, hitFrames: [6, 7, 8, 9, 10, 11, 12, 13], windupStop: 3, shotAnglesDeg: [45, 0, -45, -90, -135, 180, 135, 90], weight: 0.56, projectileSprite: "enemyUndeadArrow" },
      { id: "ud_archer_kick", kind: "cone", sprite: "attackKick", telegraph: 0.42, cooldown: 2.35, minRange: 0, maxRange: 110, damageScale: 0.72, range: 108, arc: 62, knockback: 70, hitboxTrigger: 6, windupStop: 3, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.92 },
      { id: "ud_archer_arrow_rain", kind: "targeted_rain_zone", sprite: "attackArrowRain", telegraph: 0.8, cooldown: 6, minRange: 80, maxRange: 430, damageScale: 0.9, radius: 90, hitboxTrigger: 12, windupStop: 8, activeAnimDuration: 15 / 14, animFps: 14, zoneDurationSec: 3, zoneTickSec: 0.5, tickHitDuration: 0.12, weight: 0.5 }
    ]
  }),
  m_ud_berserker_4: createDirectionalEnemy({
    id: "m_ud_berserker_4",
    name: "Undead Berserker",
    folder: "4Berserker",
    role: "melee",
    plates: 2,
    hp: 92,
    damage: 13,
    speed: 110,
    size: 72,
    drawSize: 128,
    tint: "#fecaca",
    hitAsset: "undeadBerserkerHit",
    sheets: {
      idle: sheet("undeadBerserkerIdle", 15, 8, true),
      walk: sheet("undeadBerserkerWalk", 15, 10, true),
      move: sheet("undeadBerserkerMove", 15, 12, true),
      roll: sheet("undeadBerserkerRolling", 15, 15, false),
      attackBasic: sheet("undeadBerserkerAttackBasic"),
      attackDown: sheet("undeadBerserkerAttackDown"),
      attackSpin: sheet("undeadBerserkerAttackSpin"),
      attackCast: sheet("undeadBerserkerAttackCast"),
      attackQuickSlash: sheet("undeadBerserkerAttackQuickSlash"),
      attackEmpowered: sheet("undeadBerserkerAttackEmpowered")
    },
    attacks: [
      { id: "ud_berserker_basic_slash", kind: "cone", sprite: "attackBasic", telegraph: 0.5, cooldown: 2, minRange: 0, maxRange: 110, damageScale: 1.15, range: 190, arc: 95, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, weight: 1 },
      { id: "ud_berserker_axe_slash", kind: "cone", sprite: "attackDown", telegraph: 0.55, cooldown: 2.7, minRange: 0, maxRange: 110, damageScale: 1.2, range: 200, arc: 120, hitboxTrigger: 9, windupStop: 5, activeAnimDuration: 15 / 14, weight: 0.8 },
      { id: "ud_berserker_circle_strike", kind: "circle", sprite: "attackSpin", telegraph: 0.55, cooldown: 3, minRange: 0, maxRange: 140, damageScale: 1.15, radius: 170, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, weight: 0.75 },
      { id: "ud_berserker_fast_strike", kind: "cone", sprite: "attackCast", telegraph: 0.35, cooldown: 2.1, minRange: 0, maxRange: 110, damageScale: 0.95, range: 180, arc: 30, hitboxTrigger: 6, windupStop: 3, activeAnimDuration: 15 / 14, weight: 0.85 },
      { id: "ud_berserker_quickslash", kind: "cone", sprite: "attackQuickSlash", telegraph: 0.25, cooldown: 1.8, minRange: 0, maxRange: 110, damageScale: 0.85, range: 165, arc: 80, hitboxTrigger: 4, windupStop: 2, activeAnimDuration: 15 / 14, weight: 0.9 },
      { id: "ud_berserker_empowered_circle_strike", kind: "circle", sprite: "attackEmpowered", telegraph: 0.9, cooldown: 4.8, minRange: 0, maxRange: 150, damageScale: 1.35, radius: 190, hitboxTrigger: 9, windupStop: 6, activeAnimDuration: 1, weight: 0.6 }
    ]
  }),
  m_ud_dark_archer_7: createDirectionalEnemy({
    id: "m_ud_dark_archer_7",
    name: "Undead Dark Archer",
    folder: "7DarkArcher",
    role: "ranged",
    hp: 64,
    damage: 11,
    speed: 104,
    size: 64,
    drawSize: 128,
    preferredRange: 250,
    tint: "#bfdbfe",
    hitAsset: "undeadDarkArcherHit",
    sheets: {
      idle: sheet("undeadDarkArcherIdle", 15, 8, true),
      walk: sheet("undeadDarkArcherWalk", 15, 10, true),
      move: sheet("undeadDarkArcherMove", 15, 12, true),
      roll: sheet("undeadDarkArcherRolling", 15, 15, false),
      attackBasic: sheet("undeadDarkArcherAttackBasic"),
      attackSpinShot: sheet("undeadDarkArcherAttackSpinShot"),
      attackArrowRain: sheet("undeadDarkArcherAttackArrowRain"),
      attackKick: sheet("undeadDarkArcherAttackKick")
    },
    attacks: [
      { id: "ud_archer_basic_shot", kind: "projectile", sprite: "attackBasic", telegraph: 0.5, cooldown: 2.1, minRange: 100, maxRange: 420, damageScale: 1, speedValue: 320, projectileSize: 12, hitboxTrigger: 11, windupStop: 9, projectileSpawnWindupT: 0.71, activeAnimDuration: 15 / 14, weight: 1, projectileSprite: "enemyUndeadArrow" },
      { id: "ud_archer_charged_shot", kind: "projectile", sprite: "attackBasic", telegraph: 1, cooldown: 3.5, minRange: 100, maxRange: 420, damageScale: 1, speedValue: 520, projectileSize: 16, hitboxTrigger: 11, windupStop: 9, projectileSpawnWindupT: 11 / 14, activeAnimDuration: 15 / 14, weight: 0.65, projectileSprite: "enemyUndeadArrow" },
      { id: "ud_archer_spin_shot", kind: "frame_synced_projectile", sprite: "attackSpinShot", telegraph: 0.5, cooldown: 5.4, minRange: 80, maxRange: 430, damageScale: 0.78, speedValue: 300, projectileSize: 14, projectileRadius: 10, totalFrames: 15, animFps: 14, hitFrames: [6, 7, 8, 9, 10, 11, 12, 13], windupStop: 3, shotAnglesDeg: [45, 0, -45, -90, -135, 180, 135, 90], weight: 0.56, projectileSprite: "enemyUndeadArrow" },
      { id: "ud_archer_kick", kind: "cone", sprite: "attackKick", telegraph: 0.42, cooldown: 2.35, minRange: 0, maxRange: 110, damageScale: 0.72, range: 108, arc: 62, knockback: 70, hitboxTrigger: 6, windupStop: 3, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.92 },
      { id: "ud_archer_arrow_rain", kind: "targeted_rain_zone", sprite: "attackArrowRain", telegraph: 0.8, cooldown: 6, minRange: 80, maxRange: 430, damageScale: 0.9, radius: 90, hitboxTrigger: 12, windupStop: 8, activeAnimDuration: 15 / 14, animFps: 14, zoneDurationSec: 3, zoneTickSec: 0.5, tickHitDuration: 0.12, weight: 0.5 }
    ]
  }),
  m_ud_necromancer_8: createDirectionalEnemy({
    id: "m_ud_necromancer_8",
    name: "Undead Necromancer",
    folder: "8Necromancer",
    role: "ranged",
    movementTactic: "Coward",
    hp: 60,
    damage: 11,
    speed: 98,
    size: 62,
    drawSize: 128,
    preferredRange: 230,
    tint: "#c4b5fd",
    hitAsset: "undeadNecromancerHit",
    sheets: {
      idle: sheet("undeadNecromancerIdle", 15, 8, true),
      walk: sheet("undeadNecromancerWalk", 15, 10, true),
      move: sheet("undeadNecromancerMove", 15, 12, true),
      roll: sheet("undeadNecromancerRolling", 15, 15, false),
      attackBasic: sheet("undeadNecromancerAttackBasic"),
      attackAlt: sheet("undeadNecromancerAttackAlt"),
      attackExplosion: sheet("undeadNecromancerAttackExplosion"),
      attackDarkfirePillar: sheet("undeadNecromancerAttackDarkfirePillar"),
      attackDarkWave: sheet("undeadNecromancerAttackDarkWave"),
      attackSummonWarrior: sheet("undeadNecromancerAttackSummonWarrior"),
      attackDarkBolt: sheet("undeadNecromancerAttackDarkBolt")
    },
    attacks: [
      { id: "ud_necromancer_basic_orb", kind: "projectile", sprite: "attackBasic", alternateSprite: "attackAlt", telegraph: 0.58, cooldown: 2.3, minRange: 90, maxRange: 410, damageScale: 1, speedValue: 260, projectileSize: 13, hitboxTrigger: 7, windupStop: 4, projectileSpawnWindupT: 7 / 14, activeAnimDuration: 15 / 14, weight: 1 },
      { id: "ud_necromancer_darkfire_pillar", kind: "darkfire_pillar", sprite: "attackDarkfirePillar", telegraph: 0.65, cooldown: 3.6, minRange: 0, maxRange: 380, damageScale: 1, radius: 100, hitboxTrigger: 7, windupStop: 4, pillarCount: 5, pillarRingOffset: 72, pillarHitRadius: 28, pillarDurationMs: 140, pillarDamageScale: 0.35, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.75 },
      { id: "ud_necromancer_dark_wave", kind: "cone", sprite: "attackDarkWave", telegraph: 0.55, cooldown: 2.85, minRange: 0, maxRange: 110, damageScale: 1, range: 240, arc: 78, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, animFps: 14, knockback: 200, weight: 0.82 },
      { id: "ud_necromancer_dark_bolt", kind: "projectile_trail", sprite: "attackDarkBolt", telegraph: 0.62, cooldown: 5.2, minRange: 80, maxRange: 420, damageScale: 1.1, speedValue: 40, projectileSize: 32, projectileRadius: 26, hitboxTrigger: 7, windupStop: 4, projectileSpawnWindupT: 7 / 14, activeAnimDuration: 15 / 14, animFps: 14, projectileLifetime: 3, trailInterval: 0.4, trailChild: { speedValue: 240, projectileSize: 11, damageScale: 0.38 }, weight: 0.55 },
      { id: "ud_necromancer_circle_explosion", kind: "necro_explosion", sprite: "attackExplosion", telegraph: 0.8, cooldown: 4.8, minRange: 0, maxRange: 220, damageScale: 1, radius: 140, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, animFps: 14, burstProjectileCount: 8, burstProjectileSpeed: 280, burstProjectileSize: 12, burstProjectileDamageScale: 0.45, weight: 0.7 },
      { id: "ud_necromancer_summon_warrior", kind: "summon", sprite: "attackSummonWarrior", telegraph: 0.72, cooldown: 11, minRange: 40, maxRange: 480, hitboxTrigger: 9, windupStop: 5, spawnType: "m_ud_warrior", summonAroundSelf: true, summonRadius: 120, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.4 }
    ]
  }),
  m_ud_wizard_9: createDirectionalEnemy({
    id: "m_ud_wizard_9",
    name: "Undead Wizard",
    folder: "9Wizard",
    role: "ranged",
    movementTactic: "Coward",
    hp: 58,
    damage: 10,
    speed: 104,
    size: 62,
    drawSize: 128,
    preferredRange: 245,
    tint: "#93c5fd",
    hitAsset: "undeadWizardHit",
    sheets: {
      idle: sheet("undeadWizardIdle", 15, 8, true),
      walk: sheet("undeadWizardWalk", 15, 10, true),
      move: sheet("undeadWizardMove", 15, 12, true),
      roll: sheet("undeadWizardRolling", 15, 15, false),
      attackBasic: sheet("undeadWizardAttackBasic"),
      attackAlt: sheet("undeadWizardAttackAlt"),
      attackCast: sheet("undeadWizardAttackCast"),
      attackFireDance: sheet("undeadWizardAttackFireDance"),
      attackFireThrower: sheet("undeadWizardAttackFireThrower"),
      attackFireWave: sheet("undeadWizardAttackFireWave"),
      attackFireCleanse: sheet("undeadWizardAttackFireCleanse"),
      attackFireLeap: sheet("undeadWizardAttackFireLeap")
    },
    attacks: [
      { id: "ud_wizard_basic_bolt", kind: "projectile", sprite: "attackBasic", alternateSprite: "attackAlt", telegraph: 0.52, cooldown: 2, minRange: 90, maxRange: 420, damageScale: 0.95, speedValue: 300, projectileSize: 11, projectileDrawSize: 22, projectileSprite: "enemyWizardChargedFireball", projectileSpriteFrames: 26, projectileSpriteFrameWidth: 512, projectileSpriteFrameHeight: 512, projectileSpriteFps: 18, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, weight: 1 },
      { id: "ud_wizard_volcano_eruption", kind: "volcano", sprite: "attackBasic", telegraph: 0.58, cooldown: 6.5, minRange: 0, maxRange: 520, damageScale: 0.65, radius: 25, eruptionHits: 10, eruptionGapSec: 0.05, eruptionSpawnRadius: 240, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, weight: 0.35 },
      { id: "ud_wizard_earthquake", kind: "earthquake", sprite: "attackCast", telegraph: 0.58, cooldown: 7.5, minRange: 0, maxRange: 520, damageScale: 0.9, radius: 50, earthquakeRadii: [50, 100, 150], earthquakeGapSec: 0.3, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, weight: 0.32 },
      { id: "ud_wizard_fire_dance", kind: "projectile_burst", sprite: "attackFireDance", telegraph: 0.58, cooldown: 7, minRange: 0, maxRange: 520, damageScale: 0.75, speedValue: 320, projectileSize: 10, projectileDrawSize: 20, projectileCount: 12, random360: true, projectileSprite: "enemyWizardChargedFireball", projectileSpriteFrames: 26, projectileSpriteFrameWidth: 512, projectileSpriteFrameHeight: 512, projectileSpriteFps: 18, hitboxTrigger: 14, windupStop: 9, activeAnimDuration: 15 / 14, weight: 0.3 },
      { id: "ud_wizard_fire_thrower", kind: "fire_thrower", sprite: "attackFireThrower", telegraph: 0.58, cooldown: 8, minRange: 0, maxRange: 520, damageScale: 0.55, range: 260, arc: 55, fireThrowerIntervalSec: 0.2, fireThrowerDurationSec: 2, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, fireVfxSprite: "orangeFireThrowerVfx", fireVfxFrameWidth: 81, fireVfxFrameHeight: 47, fireVfxFps: 15, fireVfxStartFrames: 5, fireVfxLoopStart: 5, fireVfxLoopEnd: 9, fireVfxEndStart: 10, fireVfxEndFrames: 7, fireVfxDrawWidth: 260, fireVfxDrawHeight: 78, weight: 0.28 },
      { id: "ud_wizard_fire_wave", kind: "projectile_backstep", sprite: "attackFireWave", telegraph: 0.58, cooldown: 7.5, minRange: 70, maxRange: 520, damageScale: 1.05, speedValue: 360, projectileSize: 22, projectileDrawSize: 44, projectileSprite: "enemyWizardChargedFireball", projectileSpriteFrames: 26, projectileSpriteFrameWidth: 512, projectileSpriteFrameHeight: 512, projectileSpriteFps: 18, backstepSpeed: 400, backstepDuration: 0.5, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, weight: 0.3 },
      { id: "ud_wizard_fire_cleanse", kind: "fire_cleanse", sprite: "attackFireCleanse", telegraph: 0.58, cooldown: 9, minRange: 0, maxRange: 520, damageScale: 0.35, radius: 45, healFlat: 22, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, weight: 0.22 },
      { id: "ud_wizard_charged_fireball", kind: "projectile", sprite: "attackCast", telegraph: 0.7, cooldown: 9.5, minRange: 120, maxRange: 560, damageScale: 1.35, speedValue: 260, projectileSize: 34, projectileDrawSize: 68, projectileRadius: 30, projectileSprite: "enemyWizardChargedFireball", projectileSpriteFrames: 26, projectileSpriteFrameWidth: 512, projectileSpriteFrameHeight: 512, projectileSpriteFps: 18, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, weight: 0.22 },
      { id: "ud_wizard_fire_leap", kind: "fire_leap", sprite: "attackFireLeap", telegraph: 1.2, cooldown: 10, minRange: 0, maxRange: 520, damageScale: 1.1, radius: 60, leapDistance: 240, hitboxTrigger: 14, windupStop: 9, activeAnimDuration: 15 / 14, weight: 0.18 }
    ]
  }),
  m_ud_dark_lord_2: createDirectionalEnemy({
    id: "m_ud_dark_lord_2",
    name: "Undead Dark Lord",
    folder: "2DarkLord",
    role: "melee",
    movementTactic: "Balance",
    plates: 3,
    hp: 96,
    damage: 13,
    speed: 96,
    size: 74,
    drawSize: 192,
    tint: "#fca5a5",
    hitAsset: "undeadDarkLordHit",
    sheets: {
      idle: sheet("undeadDarkLordIdle", 15, 8, true),
      walk: sheet("undeadDarkLordWalk", 15, 10, true),
      move: sheet("undeadDarkLordMove", 15, 12, true),
      roll: sheet("undeadDarkLordRolling", 15, 15, false),
      attackBasic: sheet("undeadDarkLordAttackBasic"),
      attackSpin: sheet("undeadDarkLordAttackSpin"),
      attackSwift: sheet("undeadDarkLordAttackSwift"),
      attackShieldBash: sheet("undeadDarkLordAttackShieldBash"),
      attackWarcry: sheet("undeadDarkLordAttackWarcry"),
      attackDoubleStrike: sheet("undeadDarkLordAttackDoubleStrike"),
      attackRun: sheet("undeadDarkLordAttackRun")
    },
    attacks: [
      { id: "ud_dark_lord_basic_cleave", kind: "cone", sprite: "attackBasic", telegraph: 0.58, cooldown: 2.3, minRange: 0, maxRange: 110, damageScale: 1.2, range: 210, arc: 100, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, weight: 1 },
      { id: "ud_dark_lord_spin", kind: "circle", sprite: "attackSpin", telegraph: 0.58, cooldown: 3.4, minRange: 0, maxRange: 140, damageScale: 1.1, radius: 170, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, weight: 0.75 },
      { id: "ud_dark_lord_swift_strikes", kind: "circle_combo", sprite: "attackSwift", telegraph: 0.15, cooldown: 4.6, minRange: 20, maxRange: 170, damageScale: 0.95, radius: 160, comboShots: 3, comboGap: 0.05, hitboxTrigger: 5, windupStop: 2, activeAnimDuration: 15 / 14, weight: 0.85 },
      { id: "ud_dark_lord_shield_bash", kind: "cone", sprite: "attackShieldBash", telegraph: 0.45, cooldown: 3, minRange: 0, maxRange: 110, damageScale: 0.85, range: 120, arc: 58, hitboxTrigger: 8, windupStop: 5, activeAnimDuration: 15 / 14, weight: 0.8 },
      { id: "ud_dark_lord_warcry", kind: "warcry", sprite: "attackWarcry", telegraph: 0.62, cooldown: 8, minRange: 0, maxRange: 999, radius: 300, speedMult: 1.2, buffDuration: 3, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, animFps: 14, weight: 0.35 },
      { id: "ud_dark_lord_double_strike", kind: "cone_combo", sprite: "attackDoubleStrike", telegraph: 0.05, cooldown: 3.1, minRange: 0, maxRange: 110, damageScale: 1, range: 180, arc: 90, sameStripComboHits: 2, sameStripComboGap: 0.05, hitboxTrigger: 4, windupStop: 2, activeAnimDuration: 15 / 14, weight: 0.8 },
      { id: "ud_dark_lord_leap_slam", kind: "circle", sprite: "attackRun", telegraph: 15 / 14, cooldown: 5.8, minRange: 50, maxRange: 260, damageScale: 1.35, radius: 190, hitboxTrigger: 14, windupStop: 8, activeAnimDuration: 15 / 14, animFps: 14, leapStartFrame: 4, leapEndFrame: 10, leapSpeedMult: 2, groundImpactScale: 1, groundImpactSprite: "groundImpactLightOrange", groundImpactDuration: 0.32, weight: 0.5 }
    ]
  }),
  m_ud_dark_knight_3: createDirectionalEnemy({
    id: "m_ud_dark_knight_3",
    name: "Undead Dark Knight",
    folder: "3DarkKnight",
    role: "melee",
    plates: 2,
    hp: 94,
    damage: 13,
    speed: 102,
    size: 72,
    drawSize: 128,
    tint: "#cbd5e1",
    hitAsset: "undeadDarkKnightHit",
    sheets: {
      idle: sheet("undeadDarkKnightIdle", 15, 8, true),
      walk: sheet("undeadDarkKnightWalk", 15, 10, true),
      move: sheet("undeadDarkKnightMove", 15, 12, true),
      roll: sheet("undeadDarkKnightRolling", 15, 15, false),
      attackUp: sheet("undeadDarkKnightAttackUp"),
      attackDown: sheet("undeadDarkKnightAttackDown"),
      attackCast: sheet("undeadDarkKnightAttackCast"),
      attackRun: sheet("undeadDarkKnightAttackRun")
    },
    attacks: [
      { id: "ud_dark_knight_downslash", kind: "cone", sprite: "attackDown", telegraph: 0.5, cooldown: 2.5, minRange: 0, maxRange: 110, damageScale: 1.1, range: 190, arc: 94, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, weight: 0.85 },
      { id: "ud_dark_knight_upslash", kind: "cone", sprite: "attackUp", telegraph: 0.5, cooldown: 2.5, minRange: 0, maxRange: 110, damageScale: 1.1, range: 190, arc: 94, hitboxTrigger: 7, windupStop: 4, activeAnimDuration: 15 / 14, weight: 0.85 },
      { id: "ud_dark_knight_throw_blade", kind: "projectile", sprite: "attackCast", telegraph: 0.6, cooldown: 3.6, minRange: 80, maxRange: 420, damageScale: 1.05, speedValue: 240, projectileSize: 28, projectileDrawSize: 112, hitboxTrigger: 9, windupStop: 6, projectileSpawnWindupT: 0.67, weight: 0.7 },
      { id: "ud_dark_knight_leap_slam", kind: "circle", sprite: "attackRun", telegraph: 15 / 14, cooldown: 5.8, minRange: 50, maxRange: 260, damageScale: 1.35, radius: 190, hitboxTrigger: 14, windupStop: 8, activeAnimDuration: 15 / 14, animFps: 14, leapStartFrame: 4, leapEndFrame: 10, leapSpeedMult: 2, groundImpactScale: 1, groundImpactSprite: "groundImpactLightOrange", groundImpactDuration: 0.32, weight: 0.5 }
    ]
  }),
  m_ud_arcane_elemental_boss: createDirectionalEnemy({
    id: "m_ud_arcane_elemental_boss",
    name: "Arcane Elemental",
    folder: "../Enemies/11Arcane elemental",
    role: "ranged",
    movementTactic: "Balance",
    hp: 360,
    damage: 16,
    speed: 90,
    size: 84,
    drawSize: 192,
    preferredRange: 230,
    collisionRadius: 0.36,
    tint: "#c4b5fd",
    lockedSheetKey: "walk",
    ignoreStagger: true,
    ignoreKnockback: true,
    hitAsset: "arcaneElementalHit",
    sheets: {
      idle: sheet("arcaneElementalIdle", 15, 8, true),
      walk: sheet("arcaneElementalWalk", 15, 10, true),
      move: sheet("arcaneElementalMove", 15, 12, true),
      attack1: sheet("arcaneElementalAttack1"),
      attack2: sheet("arcaneElementalAttack2"),
      attack3: sheet("arcaneElementalAttack3"),
      attack4: sheet("arcaneElementalAttack4"),
      die: sheet("arcaneElementalDie", 15, 12, false)
    },
    attacks: [
      {
        id: "arcane_elemental_dark_beam",
        kind: "beam_line",
        sprite: "attack1",
        telegraph: 0.78,
        cooldown: 4.8,
        minRange: 80,
        maxRange: 520,
        damageScale: 1.05,
        hitboxTrigger: 8,
        windupStop: 3,
        activeAnimDuration: 15 / 14,
        animFps: 14,
        beamLength: 420,
        beamStartOffset: 24,
        lineWidth: 26,
        softLineWidth: 62,
        lineVisualDuration: 0.22,
        beamSprite: "arcaneDarkBeamVfx",
        beamSpriteFrames: 6,
        beamSpriteFrameWidth: 256,
        beamSpriteFrameHeight: 128,
        beamSpriteFps: 18,
        weight: 1
      },
      {
        id: "arcane_elemental_orbiting_fireballs",
        kind: "orbiting_projectile_barrage",
        sprite: "attack2",
        telegraph: 0.82,
        cooldown: 7.5,
        minRange: 0,
        maxRange: 560,
        damageScale: 0.8,
        hitboxTrigger: 8,
        windupStop: 5,
        activeAnimDuration: 15 / 14,
        animFps: 14,
        orbitProjectileCount: 8,
        orbitRadius: 86,
        orbitSpinRate: 2.8,
        orbitAngleOffsetsDeg: [-110, -60, -20, 15, 55, 130, 185, 240],
        orbitLaunchIntervalSec: 0.1,
        orbitLaunchStartDelaySec: 0.4,
        speedValue: 400,
        orbitSpeedVariance: 0.12,
        orbitSizeVariance: 0.12,
        orbitBobAmplitude: 24,
        orbitBobAmplitudeVariance: 0.45,
        orbitBobFrequency: 4.2,
        orbitBobFrequencyVariance: 0.2,
        orbitAccelerationDuration: 2,
        orbitAccelerationMaxMult: 1.4,
        homingRadius: 220,
        homingTurnRate: 2.2,
        projectileRadius: 10,
        projectileSize: 30,
        projectileDrawSize: 30,
        projectileSprite: "arcaneDarkSpinningFireball",
        projectileSpriteFrames: 16,
        projectileSpriteFrameWidth: 64,
        projectileSpriteFrameHeight: 64,
        projectileSpriteFps: 16,
        orbitSpriteFpsVariance: 0.2,
        projectileSpriteLoopStart: 0,
        projectileSpriteLoopEnd: 7,
        projectileSpriteEndStart: 8,
        projectileSpriteEndFrames: 8,
        projectileEndSize: 30,
        weight: 0.9
      },
      {
        id: "arcane_elemental_channel_burst",
        kind: "channeling_ground_bursts",
        sprite: "attack3",
        telegraph: 0.74,
        cooldown: 8.2,
        minRange: 0,
        maxRange: 560,
        damageScale: 0.55,
        hitboxTrigger: 8,
        windupStop: 3,
        activeAnimDuration: 15 / 14,
        animFps: 14,
        channelDurationSec: 3,
        channelLoopStart: 7,
        channelLoopEnd: 9,
        postChannelResumeFrame: 9,
        burstTickSec: 0.22,
        burstPreDelaySec: 0.2,
        burstRadius: 42,
        burstScatterRadius: 84,
        burstHitDuration: 0.14,
        groundImpactSprite: "arcaneGroundBurst",
        groundImpactScale: 0.36,
        groundImpactDuration: 0.24,
        weight: 0.7
      },
      {
        id: "arcane_elemental_leap_burst",
        kind: "targeted_leap_slam",
        sprite: "attack4",
        telegraph: 15 / 14,
        cooldown: 6.6,
        minRange: 50,
        maxRange: 360,
        damageScale: 1.15,
        radius: 148,
        hitboxTrigger: 10,
        windupStop: 3,
        activeAnimDuration: 15 / 14,
        animFps: 14,
        leapStartFrame: 2,
        leapEndFrame: 9,
        leapSpeedMult: 2.5,
        groundImpactScale: 0.9,
        groundImpactSprite: "groundImpactPurple",
        groundImpactDuration: 0.32,
        shakeMagnitude: 16,
        shakeDuration: 0.28,
        weight: 0.75
      }
    ]
  })
});

export const UNDEAD_ENEMY_IDS = Object.freeze(Object.keys(UNDEAD_ENEMY_DEFS));

export const UNDEAD_ROOM_ROSTER = Object.freeze([
  ["m_ud_brute", "m_ud_warrior"],
  ["m_ud_archer_5", "m_ud_berserker_4"],
  ["m_ud_dark_archer_7", "m_ud_necromancer_8"],
  ["m_ud_wizard_9", "m_ud_dark_lord_2"],
  ["m_ud_dark_knight_3"]
]);

export function getUndeadEnemyDef(id) {
  return UNDEAD_ENEMY_DEFS[id] || null;
}
