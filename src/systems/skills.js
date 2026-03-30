import { centerOf, clamp, distance, normalize, resolveHeroProjectileOrigin } from "../core/runtime-utils.js";
import { getExtractedSkillById } from "../data/extracted-skills.js";
import { damageBreakablesInRadius, getBlockingBreakableRects } from "./breakables.js";
import { getMaxDashCharges, onRingSkillCooldownRestored } from "./rings.js";
import { openSearchable } from "./searchables.js";

export const PLAYABLE_RUN_SKILL_IDS = [
  "fireball",
  "iceShard",
  "knifeNova",
  "hunterShot",
  "homingSkullCharges",
  "healPulse",
  "iceRain",
  "chainFrost",
  "blackHole",
  "waveShield",
  "lockpick",
  "meteorRain",
  "purifyingFire",
  "whirlwind",
  "earthquake",
  "escapePlan",
  "cruelFinisher",
  "spiritBanner",
  "hauntingGhostCharges",
  "loyalDragons",
  "spiderTrap",
  "magicHand",
  "assimilativeOrb",
  "bloodFrenzy",
  "bloodSacrifice",
  "bloodPact",
  "bloodAmmo",
  "frenzyProtocol",
  "trickstersKit",
  "ancestralShout",
  "shadowHeist",
  "loadedDice"
];

function aimDirection(game) {
  const target = game.input.getAimWorld(game.camera);
  const center = centerOf(game.player);
  const baseDir = normalize(target.x - center.x, target.y - center.y, { x: 1, y: 0 });
  const origin = resolveHeroProjectileOrigin(game.player, game.heroDef, baseDir);
  return {
    origin,
    target,
    dir: normalize(target.x - origin.x, target.y - origin.y, baseDir)
  };
}

function facingFromDir(dir) {
  const x = dir.x;
  const y = dir.y;
  if (Math.abs(x) > Math.abs(y) * 1.4) return x >= 0 ? "right" : "left";
  if (Math.abs(y) > Math.abs(x) * 1.4) return y >= 0 ? "down" : "up";
  if (x >= 0 && y >= 0) return "right_down";
  if (x >= 0 && y < 0) return "right_up";
  if (x < 0 && y >= 0) return "left_down";
  return "left_up";
}

function resolveSkillAnimationKey(game, preferredKey) {
  const states = game.heroDef?.sprite?.states || {};
  if (states[preferredKey]) return preferredKey;
  if (states.cast) return "cast";
  if (states.attack) return "attack";
  return "idle";
}

function beginSkillCast(game, config) {
  game.combat.playerAction = {
    elapsed: 0,
    duration: config.duration,
    triggerTime: config.triggerTime,
    triggered: false,
    animationKey: config.animationKey,
    facing: config.facing,
    moveMultiplier: config.moveMultiplier ?? 1,
    onTrigger: config.onTrigger
  };
  game.player.facing = config.facing;
}

function skillDamageScale(game) {
  return (1 + (game.player.damageBonus || 0)) * (game.combat.skillRuntime?.procDamageScale || 1);
}

function createSkillSlot(skillId, slotIndex) {
  const def = getExtractedSkillById(skillId);
  const chargeRule = def?.archiveRuntime?.chargeRule || null;
  const maxCharges = chargeRule?.maxCharges || chargeRule?.maxChargesForCastCheck || 0;
  const maxBasicCharges = chargeRule?.uiMax || chargeRule?.basicsRequired || 0;
  return {
    slotIndex,
    skillId,
    def,
    cooldownRemaining: 0,
    cooldownDuration: def?.baseCd ?? 0,
    charges: 0,
    baseMaxCharges: maxCharges,
    maxCharges,
    killProgress: 0,
    basicCharges: 0,
    baseMaxBasicCharges: maxBasicCharges,
    maxBasicCharges
  };
}

function spawnSkillProjectile(game, slot, config) {
  const projectile = {
    x: config.x,
    y: config.y,
    radius: config.radius,
    drawSize: config.drawSize ?? config.radius * 2,
    damage: config.damage,
    speed: config.speed,
    vx: config.vx,
    vy: config.vy,
    traveled: 0,
    maxRange: config.maxRange,
    spriteAsset: config.spriteAsset ?? null,
    color: config.color ?? "#a78bfa",
    pierce: config.pierce ?? 0,
    skillId: slot.skillId,
    source: "skill",
    isDirect: false,
    homingRadius: config.homingRadius ?? 0,
    homingTurnRate: config.homingTurnRate ?? 0,
    hitEnemyIds: new Set(),
    explosionRadius: config.explosionRadius ?? 0,
    explosionDamage: config.explosionDamage ?? 0,
    explosionColor: config.explosionColor ?? config.color ?? "#f97316",
    detonateOnEnemy: config.detonateOnEnemy ?? false,
    detonateOnWall: config.detonateOnWall ?? false,
    bounceOnWall: config.bounceOnWall ?? false,
    projectileClass: config.projectileClass ?? "default",
    onHitEnemy: config.onHitEnemy ?? null,
    lifetime: config.lifetime ?? (game.player.ringProjectileLifetime || null),
    age: 0
  };
  projectile.homingRadius = Math.max(projectile.homingRadius, game.player.ringProjectileHomingRadius || 0);
  projectile.homingTurnRate = Math.max(projectile.homingTurnRate, game.player.ringProjectileHomingTurnRate || 0);
  game.combat.playerProjectiles.push(projectile);
  return projectile;
}

function spawnNeutralSkillProjectile(game, skillId, config) {
  const projectile = {
    x: config.x,
    y: config.y,
    radius: config.radius,
    drawSize: config.drawSize ?? config.radius * 2,
    damage: config.damage,
    speed: config.speed,
    vx: config.vx,
    vy: config.vy,
    traveled: 0,
    maxRange: config.maxRange,
    spriteAsset: config.spriteAsset ?? null,
    color: config.color ?? "#a78bfa",
    pierce: config.pierce ?? 0,
    skillId,
    source: "skill",
    isDirect: false,
    homingRadius: config.homingRadius ?? 0,
    homingTurnRate: config.homingTurnRate ?? 0,
    hitEnemyIds: new Set(),
    explosionRadius: config.explosionRadius ?? 0,
    explosionDamage: config.explosionDamage ?? 0,
    explosionColor: config.explosionColor ?? config.color ?? "#f97316",
    detonateOnEnemy: config.detonateOnEnemy ?? false,
    detonateOnWall: config.detonateOnWall ?? false,
    bounceOnWall: config.bounceOnWall ?? false,
    projectileClass: config.projectileClass ?? "default",
    onHitEnemy: config.onHitEnemy ?? null,
    lifetime: config.lifetime ?? (game.player.ringProjectileLifetime || null),
    age: 0
  };
  projectile.homingRadius = Math.max(projectile.homingRadius, game.player.ringProjectileHomingRadius || 0);
  projectile.homingTurnRate = Math.max(projectile.homingTurnRate, game.player.ringProjectileHomingTurnRate || 0);
  game.combat.playerProjectiles.push(projectile);
  return projectile;
}

function setSlotCooldown(slot) {
  slot.cooldownDuration = slot.def?.baseCd ?? 0;
  slot.cooldownRemaining = slot.cooldownDuration;
}

function healPlayer(game, amount) {
  game.player.hp = Math.min(game.player.maxHp, game.player.hp + amount);
}

function spendNonlethalHealth(game, hpCost) {
  if (hpCost <= 0) return true;
  const nextHp = Math.max(1, game.player.hp - hpCost);
  if (nextHp === game.player.hp) return false;
  game.player.hp = nextHp;
  return true;
}

function addEffect(game, effect) {
  game.combat.skillRuntime.effects.push(effect);
}

function applyEnemyFreeze(enemy, duration) {
  enemy.state ||= {};
  enemy.state.freezeTimer = Math.max(enemy.state.freezeTimer || 0, duration);
}

function applyEnemySlow(enemy, duration, mult) {
  enemy.state ||= {};
  enemy.state.skillSlowTimer = Math.max(enemy.state.skillSlowTimer || 0, duration);
  enemy.state.skillSlowMult = Math.min(enemy.state.skillSlowMult || 1, mult);
}

function applyEnemyBleed(enemy, config = {}) {
  enemy.state ||= {};
  enemy.state.bleedStacks = Math.min(99, (enemy.state.bleedStacks || 0) + (config.stacks ?? 1));
  enemy.state.bleedTimer = Math.max(enemy.state.bleedTimer || 0, config.duration ?? 4);
  enemy.state.bleedTickTimer = Math.min(enemy.state.bleedTickTimer || 1, config.tickInterval ?? 1);
  enemy.state.bleedDamagePerStack = Math.max(enemy.state.bleedDamagePerStack || 0, config.damagePerStack ?? 3);
}

function findNearestChest(game, range) {
  const playerCenter = centerOf(game.player);
  let nearest = null;
  let nearestDistance = range;
  for (const searchable of game.searchables || []) {
    if (searchable.isOpen) continue;
    const centerX = searchable.x + searchable.w * 0.5;
    const centerY = searchable.y + searchable.h * 0.5;
    const dist = distance(playerCenter.x, playerCenter.y, centerX, centerY);
    if (dist >= nearestDistance) continue;
    nearest = searchable;
    nearestDistance = dist;
  }
  return nearest;
}

function findNearestEnemy(game, origin, range) {
  let nearest = null;
  let nearestDistance = range;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const center = centerOf(enemy);
    const dist = distance(origin.x, origin.y, center.x, center.y);
    if (dist >= nearestDistance) continue;
    nearest = enemy;
    nearestDistance = dist;
  }
  return nearest;
}

function findEnemyById(game, enemyId) {
  return game.enemies.find((enemy) => enemy.id === enemyId && !enemy.dead) || null;
}

function moveEntitySafely(entity, game, x, y) {
  return moveEntitySafelyWithOptions(entity, game, x, y, {});
}

function moveEntitySafelyWithOptions(entity, game, x, y, options = {}) {
  const world = game.world;
  const next = {
    x: clamp(x, 0, world.width - entity.w),
    y: clamp(y, 0, world.height - entity.h),
    w: entity.w,
    h: entity.h
  };
  const ignoreTrees = !!options.ignoreTrees;
  const blockers = [
    ...world.collisionRects.filter((wall) => !(ignoreTrees && (world.treeCollisionRects || []).includes(wall))),
    ...getBlockingBreakableRects(game)
  ];
  const blocked = blockers.some((wall) => !(
    next.x + next.w <= wall.x ||
    next.x >= wall.x + wall.w ||
    next.y + next.h <= wall.y ||
    next.y >= wall.y + wall.h
  ));
  if (blocked) return false;
  entity.x = next.x;
  entity.y = next.y;
  return true;
}

function pushCircleFlash(game, x, y, radius, duration, color) {
  addEffect(game, {
    kind: "circleFlash",
    x,
    y,
    radius,
    duration,
    elapsed: 0,
    color
  });
}

function castFireball(game, slot, base) {
  spawnSkillProjectile(game, slot, {
    x: base.origin.x,
    y: base.origin.y,
    radius: 18,
    drawSize: 34,
    damage: 34 * skillDamageScale(game),
    speed: 420,
    vx: base.dir.x * 420,
    vy: base.dir.y * 420,
    maxRange: 520,
    color: "#fb923c",
    explosionRadius: 74,
    explosionDamage: 24 * skillDamageScale(game),
    explosionColor: "#f97316",
    detonateOnEnemy: true,
    detonateOnWall: true
  });
  setSlotCooldown(slot);
}

function castIceShard(game, slot, base) {
  spawnSkillProjectile(game, slot, {
    x: base.origin.x,
    y: base.origin.y,
    radius: 11,
    drawSize: 18,
    damage: 18 * skillDamageScale(game),
    speed: 980,
    vx: base.dir.x * 980,
    vy: base.dir.y * 980,
    maxRange: 680,
    color: "#7dd3fc",
    pierce: 2,
    onHitEnemy: (_, enemy) => applyEnemySlow(enemy, 2, 0.7)
  });
  setSlotCooldown(slot);
}

function castKnifeNova(game, slot, base) {
  const startAngle = Math.atan2(base.dir.y, base.dir.x);
  const speed = 520;
  for (let index = 0; index < 8; index += 1) {
    const angle = startAngle + (Math.PI * 2 * index) / 8;
    spawnSkillProjectile(game, slot, {
      x: base.origin.x,
      y: base.origin.y,
      radius: 9,
      drawSize: 22,
      damage: 12 * skillDamageScale(game),
      speed,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      maxRange: 700,
      color: "#fca5a5",
      pierce: 2,
      bounceOnWall: true,
      projectileClass: "knife",
      onHitEnemy: (_, enemy) => applyEnemyBleed(enemy, {
        stacks: 1,
        duration: 4,
        tickInterval: 1,
        damagePerStack: 3
      })
    });
  }
  setSlotCooldown(slot);
}

function addHunterShotStack(skillRuntime, enemy) {
  skillRuntime.hunterShotStacks.push({
    enemyId: enemy.id,
    timer: 5
  });
}

function castHunterShot(game, slot, base) {
  spawnSkillProjectile(game, slot, {
    x: base.origin.x,
    y: base.origin.y,
    radius: 13,
    drawSize: 22,
    damage: 26 * skillDamageScale(game),
    speed: 420,
    vx: base.dir.x * 420,
    vy: base.dir.y * 420,
    maxRange: 500,
    color: "#facc15",
    homingRadius: 340,
    homingTurnRate: 8,
    onHitEnemy: (_, enemy) => addHunterShotStack(game.combat.skillRuntime, enemy)
  });
  setSlotCooldown(slot);
}

function castHomingSkull(game, slot, base) {
  if (slot.charges <= 0) return false;
  slot.charges -= 1;
  spawnSkillProjectile(game, slot, {
    x: base.origin.x,
    y: base.origin.y,
    radius: 14,
    drawSize: 24,
    damage: 20 * skillDamageScale(game),
    speed: 350,
    vx: base.dir.x * 350,
    vy: base.dir.y * 350,
    maxRange: 450,
    color: "#c084fc",
    homingRadius: 360,
    homingTurnRate: 9.5
  });
  return true;
}

function castHealPulse(game, slot) {
  const amount = Math.max(15, Math.round(game.player.maxHp * 0.15));
  healPlayer(game, amount);
  const center = centerOf(game.player);
  pushCircleFlash(game, center.x, center.y, 86, 0.35, "#34d399");
  setSlotCooldown(slot);
}

function castIceRain(game, slot, base) {
  addEffect(game, {
    kind: "iceRain",
    x: base.target.x,
    y: base.target.y,
    radius: 180,
    duration: 4,
    elapsed: 0,
    tickTimer: 0,
    tickInterval: 0.25,
    damage: 10 * skillDamageScale(game),
    slowMult: 0.5,
    slowDuration: 0.45,
    color: "#93c5fd"
  });
  setSlotCooldown(slot);
}

function castChainFrost(game, slot) {
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    applyEnemyFreeze(enemy, 2);
    const center = centerOf(enemy);
    pushCircleFlash(game, center.x, center.y, enemy.w * 0.75, 0.28, "#bfdbfe");
  }
  setSlotCooldown(slot);
}

function castBlackHole(game, slot, base) {
  addEffect(game, {
    kind: "blackHole",
    x: base.target.x,
    y: base.target.y,
    radius: 180,
    duration: 4,
    elapsed: 0,
    tickTimer: 0,
    tickInterval: 0.28,
    damage: 12 * skillDamageScale(game),
    pullStrength: 120,
    color: "#818cf8"
  });
  setSlotCooldown(slot);
}

function castWaveShield(game, slot) {
  addEffect(game, {
    kind: "waveShield",
    orbitAngle: 0,
    orbitRadius: 55,
    duration: 6,
    elapsed: 0,
    damage: 12 * skillDamageScale(game),
    hitCooldowns: {},
    color: "#67e8f9"
  });
  setSlotCooldown(slot);
}

function castLockpick(game, slot) {
  const searchable = findNearestChest(game, 120);
  if (!searchable) return false;
  if (!openSearchable(game, searchable, { free: true })) return false;
  pushCircleFlash(game, searchable.x + searchable.w * 0.5, searchable.y + searchable.h * 0.5, 44, 0.25, "#facc15");
  setSlotCooldown(slot);
  return true;
}

function castSpiritBanner(game, slot, base) {
  addEffect(game, {
    kind: "spiritBanner",
    x: base.target.x,
    y: base.target.y,
    radius: 120,
    duration: 15,
    elapsed: 0,
    magnitude: 1.15,
    color: "#a78bfa"
  });
  setSlotCooldown(slot);
}

function castHauntingGhostCharges(game, slot) {
  if (slot.charges <= 0) return false;
  slot.charges -= 1;
  const playerCenter = centerOf(game.player);
  addEffect(game, {
    kind: "hauntingGhost",
    x: playerCenter.x,
    y: playerCenter.y - 18,
    radius: 80,
    duration: 2,
    elapsed: 0,
    damage: 26 * skillDamageScale(game),
    slowMult: 0.5,
    color: "#c4b5fd"
  });
  return true;
}

function castLoyalDragons(game, slot) {
  addEffect(game, {
    kind: "loyalDragons",
    duration: 12,
    elapsed: 0,
    orbitAngle: 0,
    orbitRadius: 70,
    contactDamage: 10 * skillDamageScale(game),
    projectileDamage: 16 * skillDamageScale(game),
    projectileCooldown: 0,
    autoFireCooldown: 0,
    hitCooldowns: {},
    dragonPositions: [],
    color: "#fb923c"
  });
  setSlotCooldown(slot);
}

function castSpiderTrap(game, slot, base) {
  const snapEnemy = findNearestEnemy(game, centerOf(game.player), 180) || findNearestEnemy(game, base.target, 96);
  const snapCenter = snapEnemy ? centerOf(snapEnemy) : base.target;
  addEffect(game, {
    kind: "spiderTrap",
    x: clamp(snapCenter.x, 32, game.world.width - 32),
    y: clamp(snapCenter.y, 32, game.world.height - 32),
    radius: 52,
    duration: 60,
    elapsed: 0,
    biteDuration: 3,
    biteTickInterval: 0.35,
    biteTickTimer: 0,
    biteDamage: 8 * skillDamageScale(game),
    targetEnemyId: null,
    color: "#84cc16"
  });
  setSlotCooldown(slot);
}

function castMagicHand(game, slot, base) {
  const playerCenter = centerOf(game.player);
  const targetX = clamp(base.target.x, 48, game.world.width - 48);
  const targetY = clamp(base.target.y, 48, game.world.height - 48);
  const grabbed = game.enemies
    .filter((enemy) => !enemy.dead)
    .map((enemy) => ({ enemy, dist: distance(playerCenter.x, playerCenter.y, centerOf(enemy).x, centerOf(enemy).y) }))
    .filter((entry) => entry.dist <= 220)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5)
    .map(({ enemy }) => ({
      enemyId: enemy.id,
      startX: enemy.x,
      startY: enemy.y
    }));

  addEffect(game, {
    kind: "magicHand",
    x: targetX,
    y: targetY,
    radius: 86,
    duration: 0.8,
    elapsed: 0,
    grabbed,
    color: "#60a5fa"
  });
  setSlotCooldown(slot);
}

function castAssimilativeOrb(game, slot) {
  addEffect(game, {
    kind: "assimilativeOrb",
    x: 0,
    y: 0,
    radius: 40,
    duration: 5,
    elapsed: 0,
    absorbCount: 0,
    absorbFlash: 0,
    explosionDamage: 16 * skillDamageScale(game),
    projectileDamage: 18 * skillDamageScale(game),
    color: "#8b5cf6"
  });
  setSlotCooldown(slot);
}

function castMeteorRain(game, slot) {
  addEffect(game, {
    kind: "meteorRain",
    duration: 3.6,
    elapsed: 0,
    radius: 110,
    tickInterval: 0.35,
    tickTimer: 0,
    impactDamage: 22 * skillDamageScale(game),
    color: "#f97316"
  });
  setSlotCooldown(slot);
}

function castPurifyingFire(game, slot) {
  addEffect(game, {
    kind: "purifyingFire",
    duration: 5,
    elapsed: 0,
    radius: 100,
    tickInterval: 0.25,
    tickTimer: 0,
    selfHpCostPerTick: Math.max(1, game.player.maxHp * 0.05 * 0.25),
    damagePerTick: 10 * skillDamageScale(game),
    totalDamageDealt: 0,
    healRatio: 0.5,
    healCap: game.player.maxHp * 0.4,
    color: "#fb923c"
  });
  setSlotCooldown(slot);
}

function castBloodFrenzy(game, slot) {
  if (!spendNonlethalHealth(game, Math.ceil(game.player.maxHp * 0.2))) return false;
  addEffect(game, {
    kind: "bloodFrenzy",
    duration: 8,
    elapsed: 0,
    attackSpeedMult: 1.4,
    color: "#ef4444"
  });
  setSlotCooldown(slot);
  return true;
}

function castBloodSacrifice(game, slot) {
  if (!spendNonlethalHealth(game, Math.ceil(game.player.maxHp * 0.2))) return false;
  for (const otherSlot of game.combat.skillRuntime.slots) {
    if (otherSlot === slot) continue;
    otherSlot.cooldownRemaining = Math.max(0, otherSlot.cooldownRemaining - 5);
  }
  pushCircleFlash(game, centerOf(game.player).x, centerOf(game.player).y, 54, 0.22, "#f87171");
  setSlotCooldown(slot);
  return true;
}

function castBloodPact(game, slot) {
  if (!spendNonlethalHealth(game, Math.ceil(game.player.maxHp * 0.2))) return false;
  addEffect(game, {
    kind: "bloodPact",
    duration: 5,
    elapsed: 0,
    lifestealRatio: 0.18,
    color: "#fb7185"
  });
  setSlotCooldown(slot);
  return true;
}

function togglePersistentEffect(game, slot, kind, effectData = {}) {
  const existingIndex = game.combat.skillRuntime.effects.findIndex((effect) => effect.kind === kind);
  if (existingIndex >= 0) {
    game.combat.skillRuntime.effects.splice(existingIndex, 1);
    slot.isActive = false;
    return true;
  }
  addEffect(game, { kind, duration: Infinity, elapsed: 0, ...effectData });
  slot.isActive = true;
  return true;
}

function castBloodAmmo(game, slot) {
  return togglePersistentEffect(game, slot, "bloodAmmo", {
    attackDamageBonus: 0.35,
    healthCost: 4,
    color: "#dc2626"
  });
}

function castShadowHeist(game, slot) {
  addEffect(game, {
    kind: "shadowHeist",
    duration: 5,
    elapsed: 0,
    color: "#64748b"
  });
  setSlotCooldown(slot);
  return true;
}

function castLoadedDice(game, slot) {
  const roll = Math.floor(Math.random() * 4);
  if (roll === 0) {
    addEffect(game, {
      kind: "loadedDiceDamage",
      duration: 15,
      elapsed: 0,
      damageBonus: 0.25,
      color: "#f59e0b"
    });
  } else if (roll === 1) {
    for (const otherSlot of game.combat.skillRuntime.slots) {
      if (otherSlot === slot) continue;
      otherSlot.cooldownRemaining = 0;
    }
  } else if (roll === 2) {
    game.gold += 60 + Math.floor(Math.random() * 40);
  } else {
    healPlayer(game, Math.ceil(game.player.maxHp * 0.4));
  }
  pushCircleFlash(game, centerOf(game.player).x, centerOf(game.player).y, 60, 0.25, "#f59e0b");
  setSlotCooldown(slot);
  return true;
}

function castFrenzyProtocol(game, slot) {
  addEffect(game, {
    kind: "frenzyProtocol",
    duration: 5,
    elapsed: 0,
    attackSpeedMult: 1.4,
    color: "#fb7185"
  });
  setSlotCooldown(slot);
  return true;
}

function castTrickstersKit(game, slot) {
  const roll = Math.floor(Math.random() * 4);
  if (roll === 0) {
    addEffect(game, {
      kind: "tricksterMove",
      duration: 6,
      elapsed: 0,
      moveSpeedMult: 1.4,
      color: "#22c55e"
    });
  } else if (roll === 1) {
    game.player.movement.dashCharges = Math.min(getMaxDashCharges(game), game.player.movement.dashCharges + 1);
  } else if (roll === 2) {
    for (let i = 0; i < 2; i += 1) {
      game.goldDrops.push({
        id: `gold_trick_${Math.random().toString(36).slice(2, 8)}`,
        type: "mob",
        value: 8,
        x: game.player.x + (i === 0 ? -24 : 24),
        y: game.player.y - 12,
        vx: 0,
        vy: 0,
        radius: 8,
        color: "#facc15",
        age: 0,
        collectDelay: 0.1,
        lifetime: 16
      });
    }
  } else {
    addEffect(game, {
      kind: "tricksterLuckBomb",
      duration: 8,
      elapsed: 0,
      radius: 110,
      tickInterval: 1,
      tickTimer: 0,
      damage: 18 * skillDamageScale(game),
      color: "#a855f7"
    });
  }
  pushCircleFlash(game, centerOf(game.player).x, centerOf(game.player).y, 56, 0.22, "#34d399");
  setSlotCooldown(slot);
  return true;
}

function castAncestralShout(game, slot) {
  addEffect(game, {
    kind: "ancestralShout",
    duration: 8,
    elapsed: 0,
    radius: 150,
    perSpiritDamageBonus: 0.1,
    color: "#c4b5fd"
  });
  setSlotCooldown(slot);
  return true;
}

function castWhirlwind(game, slot) {
  addEffect(game, {
    kind: "whirlwind",
    duration: 2,
    elapsed: 0,
    radius: 80,
    damage: 12 * skillDamageScale(game),
    tickTimer: 0,
    tickInterval: 0.15,
    hitCooldowns: {},
    color: "#f59e0b"
  });
  setSlotCooldown(slot);
}

function castEarthquake(game, slot) {
  addEffect(game, {
    kind: "earthquake",
    duration: 3,
    elapsed: 0,
    pulseTimer: 0,
    pulseInterval: 0.25,
    damage: 14 * skillDamageScale(game),
    slowDuration: 3,
    slowMult: 0.6,
    color: "#c084fc"
  });
  setSlotCooldown(slot);
}

function castEscapePlan(game, slot) {
  const playerCenter = centerOf(game.player);
  const baseAngle = Math.random() * Math.PI * 2;
  const targetDistance = 200;
  let destination = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const angle = baseAngle + attempt * (Math.PI / 12);
    const nextX = playerCenter.x + Math.cos(angle) * targetDistance - game.player.w * 0.5;
    const nextY = playerCenter.y + Math.sin(angle) * targetDistance - game.player.h * 0.5;
    if (moveEntitySafelyWithOptions({ ...game.player }, game, nextX, nextY, { ignoreTrees: true })) {
      destination = {
        x: clamp(nextX, 0, game.world.width - game.player.w),
        y: clamp(nextY, 0, game.world.height - game.player.h)
      };
      break;
    }
  }
  if (!destination) return false;
  moveEntitySafelyWithOptions(game.player, game, destination.x, destination.y, { ignoreTrees: true });
  const center = centerOf(game.player);
  let nearbyEnemies = 0;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const enemyCenter = centerOf(enemy);
    const dist = distance(center.x, center.y, enemyCenter.x, enemyCenter.y);
    if (dist <= 88 + enemy.w * 0.4) {
      game.damageEnemy(enemy, 18 * skillDamageScale(game), { source: "skill", isDirect: true });
    }
    if (dist <= 100 + enemy.w * 0.4) nearbyEnemies += 1;
  }
  damageBreakablesInRadius(game, center.x, center.y, 88, 18 * skillDamageScale(game));
  pushCircleFlash(game, center.x, center.y, 78, 0.25, "#f472b6");
  setSlotCooldown(slot);
  if (nearbyEnemies > 0) slot.cooldownRemaining = 0;
  return true;
}

function castCruelFinisher(game, slot) {
  if (slot.basicCharges < slot.maxBasicCharges) return false;
  const playerCenter = centerOf(game.player);
  const target = findNearestEnemy(game, playerCenter, 300);
  if (!target) return false;
  const enemyCenter = centerOf(target);
  const missingHpPct = 1 - target.hp / Math.max(1, target.maxHp);
  const damage = Math.round((22 + target.maxHp * Math.max(0.5, missingHpPct * 1.8)) * skillDamageScale(game));
  game.damageEnemy(target, damage, { source: "skill", isDirect: true });
  const dir = normalize(enemyCenter.x - playerCenter.x, enemyCenter.y - playerCenter.y, { x: 0, y: 0 });
  moveEntitySafelyWithOptions(game.player, game, target.x - dir.x * 28, target.y - dir.y * 28, { ignoreTrees: true });
  pushCircleFlash(game, enemyCenter.x, enemyCenter.y, 68, 0.22, "#fb7185");
  slot.basicCharges = 0;
  setSlotCooldown(slot);
  return true;
}

const SKILL_CAST_HANDLERS = {
  fireball: {
    duration: 0.42,
    triggerTime: 0.16,
    animationKey: "cast",
    execute: castFireball
  },
  iceShard: {
    duration: 0.34,
    triggerTime: 0.1,
    animationKey: "attack2",
    execute: castIceShard
  },
  knifeNova: {
    duration: 0.34,
    triggerTime: 0.12,
    animationKey: "attack2",
    execute: castKnifeNova
  },
  hunterShot: {
    duration: 0.36,
    triggerTime: 0.12,
    animationKey: "cast",
    execute: castHunterShot
  },
  homingSkullCharges: {
    duration: 0.3,
    triggerTime: 0.08,
    animationKey: "cast",
    execute: castHomingSkull
  },
  healPulse: {
    duration: 0.32,
    triggerTime: 0.08,
    animationKey: "cast",
    execute: castHealPulse
  },
  iceRain: {
    duration: 0.48,
    triggerTime: 0.18,
    animationKey: "cast",
    execute: castIceRain
  },
  chainFrost: {
    duration: 0.46,
    triggerTime: 0.16,
    animationKey: "cast",
    execute: castChainFrost
  },
  blackHole: {
    duration: 0.52,
    triggerTime: 0.18,
    animationKey: "cast",
    execute: castBlackHole
  },
  waveShield: {
    duration: 0.38,
    triggerTime: 0.12,
    animationKey: "cast",
    execute: castWaveShield
  },
  lockpick: {
    duration: 0.24,
    triggerTime: 0.05,
    animationKey: "cast",
    execute: castLockpick
  },
  meteorRain: {
    duration: 0.5,
    triggerTime: 0.18,
    animationKey: "cast",
    execute: castMeteorRain
  },
  purifyingFire: {
    duration: 0.32,
    triggerTime: 0.08,
    animationKey: "cast",
    execute: castPurifyingFire
  },
  whirlwind: {
    duration: 2,
    triggerTime: 0.08,
    animationKey: "attack3",
    moveMultiplier: 0.5,
    execute: castWhirlwind
  },
  earthquake: {
    duration: 0.46,
    triggerTime: 0.16,
    animationKey: "attack3",
    execute: castEarthquake
  },
  escapePlan: {
    duration: 0.26,
    triggerTime: 0.2,
    animationKey: "dash",
    execute: castEscapePlan
  },
  cruelFinisher: {
    duration: 0.34,
    triggerTime: 0.12,
    animationKey: "attack3",
    execute: castCruelFinisher
  },
  spiritBanner: {
    duration: 0.42,
    triggerTime: 0.12,
    animationKey: "cast",
    execute: castSpiritBanner
  },
  hauntingGhostCharges: {
    duration: 0.32,
    triggerTime: 0.08,
    animationKey: "cast",
    execute: castHauntingGhostCharges
  },
  loyalDragons: {
    duration: 0.42,
    triggerTime: 0.12,
    animationKey: "cast",
    execute: castLoyalDragons
  },
  spiderTrap: {
    duration: 0.34,
    triggerTime: 0.1,
    animationKey: "cast",
    execute: castSpiderTrap
  },
  magicHand: {
    duration: 0.42,
    triggerTime: 0.14,
    animationKey: "cast",
    execute: castMagicHand
  },
  assimilativeOrb: {
    duration: 0.34,
    triggerTime: 0.1,
    animationKey: "cast",
    execute: castAssimilativeOrb
  },
  bloodFrenzy: {
    duration: 0.24,
    triggerTime: 0.08,
    animationKey: "cast",
    execute: castBloodFrenzy
  },
  bloodSacrifice: {
    duration: 0.28,
    triggerTime: 0.08,
    animationKey: "cast",
    execute: castBloodSacrifice
  },
  bloodPact: {
    duration: 0.28,
    triggerTime: 0.08,
    animationKey: "cast",
    execute: castBloodPact
  },
  bloodAmmo: {
    duration: 0.18,
    triggerTime: 0.04,
    animationKey: "cast",
    execute: castBloodAmmo
  },
  shadowHeist: {
    duration: 0.24,
    triggerTime: 0.06,
    animationKey: "dash",
    execute: castShadowHeist
  },
  loadedDice: {
    duration: 0.24,
    triggerTime: 0.06,
    animationKey: "cast",
    execute: castLoadedDice
  },
  frenzyProtocol: {
    duration: 0.24,
    triggerTime: 0.06,
    animationKey: "cast",
    execute: castFrenzyProtocol
  },
  trickstersKit: {
    duration: 0.24,
    triggerTime: 0.06,
    animationKey: "cast",
    execute: castTrickstersKit
  },
  ancestralShout: {
    duration: 0.3,
    triggerTime: 0.08,
    animationKey: "cast",
    execute: castAncestralShout
  }
};

function clampEntityIntoWorld(entity, world) {
  entity.x = clamp(entity.x, 0, world.width - entity.w);
  entity.y = clamp(entity.y, 0, world.height - entity.h);
}

function pullEntityToward(entity, targetX, targetY, strength, dt, world) {
  const centerX = entity.x + entity.w * 0.5;
  const centerY = entity.y + entity.h * 0.5;
  const dir = normalize(targetX - centerX, targetY - centerY, { x: 0, y: 0 });
  entity.x += dir.x * strength * dt;
  entity.y += dir.y * strength * dt;
  clampEntityIntoWorld(entity, world);
}

function updateIceRain(game, effect, dt) {
  effect.elapsed += dt;
  effect.tickTimer -= dt;
  if (effect.tickTimer > 0) return effect.elapsed < effect.duration;
  effect.tickTimer += effect.tickInterval;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const center = centerOf(enemy);
    if (distance(effect.x, effect.y, center.x, center.y) > effect.radius + enemy.w * 0.25) continue;
    game.damageEnemy(enemy, effect.damage, { source: "skill", isDirect: false });
    applyEnemySlow(enemy, effect.slowDuration, effect.slowMult);
  }
  damageBreakablesInRadius(game, effect.x, effect.y, effect.radius, effect.damage);
  return effect.elapsed < effect.duration;
}

function updateBlackHole(game, effect, dt) {
  effect.elapsed += dt;
  effect.tickTimer -= dt;
  pullEntityToward(game.player, effect.x, effect.y, effect.pullStrength * 0.55, dt, game.world);
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const center = centerOf(enemy);
    if (distance(effect.x, effect.y, center.x, center.y) > effect.radius + enemy.w * 0.5) continue;
    pullEntityToward(enemy, effect.x, effect.y, effect.pullStrength, dt, game.world);
  }
  if (effect.tickTimer <= 0) {
    effect.tickTimer += effect.tickInterval;
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      const center = centerOf(enemy);
      if (distance(effect.x, effect.y, center.x, center.y) > effect.radius + enemy.w * 0.25) continue;
      game.damageEnemy(enemy, effect.damage, { source: "skill", isDirect: false });
    }
    damageBreakablesInRadius(game, effect.x, effect.y, effect.radius, effect.damage);
  }
  return effect.elapsed < effect.duration;
}

function updateWaveShield(game, effect, dt) {
  effect.elapsed += dt;
  effect.orbitAngle += dt * 4.8;
  const playerCenter = centerOf(game.player);
  effect.x = playerCenter.x + Math.cos(effect.orbitAngle) * effect.orbitRadius;
  effect.y = playerCenter.y + Math.sin(effect.orbitAngle) * effect.orbitRadius;
  for (const key of Object.keys(effect.hitCooldowns)) {
    effect.hitCooldowns[key] = Math.max(0, effect.hitCooldowns[key] - dt);
    if (effect.hitCooldowns[key] <= 0) delete effect.hitCooldowns[key];
  }
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    if ((effect.hitCooldowns[enemy.id] || 0) > 0) continue;
    const center = centerOf(enemy);
    if (distance(effect.x, effect.y, center.x, center.y) > 24 + enemy.w * 0.35) continue;
    game.damageEnemy(enemy, effect.damage, { source: "skill", isDirect: false });
    healPlayer(game, 2);
    effect.hitCooldowns[enemy.id] = 0.4;
    const dir = normalize(center.x - effect.x, center.y - effect.y, { x: 0, y: 0 });
    enemy.x += dir.x * 28;
    enemy.y += dir.y * 28;
    clampEntityIntoWorld(enemy, game.world);
  }
  return effect.elapsed < effect.duration;
}

function updateCircleFlash(effect, dt) {
  effect.elapsed += dt;
  return effect.elapsed < effect.duration;
}

function updateWhirlwind(game, effect, dt) {
  effect.elapsed += dt;
  const playerCenter = centerOf(game.player);
  effect.x = playerCenter.x;
  effect.y = playerCenter.y;
  effect.tickTimer -= dt;
  for (const key of Object.keys(effect.hitCooldowns)) {
    effect.hitCooldowns[key] = Math.max(0, effect.hitCooldowns[key] - dt);
    if (effect.hitCooldowns[key] <= 0) delete effect.hitCooldowns[key];
  }
  if (effect.tickTimer <= 0) {
    effect.tickTimer += effect.tickInterval;
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      if ((effect.hitCooldowns[enemy.id] || 0) > 0) continue;
      const center = centerOf(enemy);
      if (distance(effect.x, effect.y, center.x, center.y) > effect.radius + enemy.w * 0.35) continue;
      game.damageEnemy(enemy, effect.damage, { source: "skill", isDirect: true });
      effect.hitCooldowns[enemy.id] = effect.tickInterval;
    }
    damageBreakablesInRadius(game, effect.x, effect.y, effect.radius, effect.damage);
  }
  return effect.elapsed < effect.duration;
}

function updateEarthquake(game, effect, dt) {
  effect.elapsed += dt;
  effect.pulseTimer -= dt;
  if (effect.pulseTimer <= 0) {
    effect.pulseTimer += effect.pulseInterval;
    const playerCenter = centerOf(game.player);
    pushCircleFlash(game, playerCenter.x, playerCenter.y, 140, 0.16, effect.color);
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      const center = centerOf(enemy);
      if (distance(playerCenter.x, playerCenter.y, center.x, center.y) > Math.max(game.camera.viewWidth, game.camera.viewHeight) * 0.85) continue;
      game.damageEnemy(enemy, effect.damage, { source: "skill", isDirect: false });
      applyEnemySlow(enemy, effect.slowDuration, effect.slowMult);
    }
    damageBreakablesInRadius(game, playerCenter.x, playerCenter.y, Math.max(game.camera.viewWidth, game.camera.viewHeight) * 0.85, effect.damage);
  }
  return effect.elapsed < effect.duration;
}

function updateSpiritBanner(game, effect, dt) {
  effect.elapsed += dt;
  const playerCenter = centerOf(game.player);
  if (distance(effect.x, effect.y, playerCenter.x, playerCenter.y) <= effect.radius) {
    game.player.skillMoveSpeedMult = Math.max(game.player.skillMoveSpeedMult || 1, effect.magnitude);
    game.player.skillAttackSpeedMult = Math.max(game.player.skillAttackSpeedMult || 1, effect.magnitude);
  }
  return effect.elapsed < effect.duration;
}

function updateHauntingGhost(game, effect, dt) {
  effect.elapsed += dt;
  const target = findNearestEnemy(game, effect, 420);
  if (target) {
    const center = centerOf(target);
    const dir = normalize(center.x - effect.x, center.y - effect.y, { x: 0, y: 0 });
    effect.x += dir.x * 180 * dt;
    effect.y += dir.y * 180 * dt;
  } else {
    const playerCenter = centerOf(game.player);
    const dir = normalize(playerCenter.x - effect.x, playerCenter.y - effect.y, { x: 0, y: 0 });
    effect.x += dir.x * 120 * dt;
    effect.y += dir.y * 120 * dt;
  }
  if (effect.elapsed < effect.duration) return true;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const center = centerOf(enemy);
    if (distance(effect.x, effect.y, center.x, center.y) > effect.radius + enemy.w * 0.35) continue;
    game.damageEnemy(enemy, effect.damage, { source: "skill", isDirect: false });
    applyEnemySlow(enemy, 2, effect.slowMult);
  }
  damageBreakablesInRadius(game, effect.x, effect.y, effect.radius, effect.damage);
  pushCircleFlash(game, effect.x, effect.y, effect.radius, 0.3, effect.color);
  return false;
}

function getDragonPositions(game, effect) {
  const playerCenter = centerOf(game.player);
  return [0, Math.PI].map((offset) => ({
    x: playerCenter.x + Math.cos(effect.orbitAngle + offset) * effect.orbitRadius,
    y: playerCenter.y + Math.sin(effect.orbitAngle + offset) * effect.orbitRadius
  }));
}

function updateLoyalDragons(game, effect, dt) {
  effect.elapsed += dt;
  effect.orbitAngle += dt * 2.6;
  effect.projectileCooldown = Math.max(0, effect.projectileCooldown - dt);
  effect.autoFireCooldown = Math.max(0, effect.autoFireCooldown - dt);
  effect.dragonPositions = getDragonPositions(game, effect);
  for (const key of Object.keys(effect.hitCooldowns)) {
    effect.hitCooldowns[key] = Math.max(0, effect.hitCooldowns[key] - dt);
    if (effect.hitCooldowns[key] <= 0) delete effect.hitCooldowns[key];
  }
  for (const dragon of effect.dragonPositions) {
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      const cooldownKey = `${enemy.id}:${Math.round(dragon.x)}:${Math.round(dragon.y)}`;
      const center = centerOf(enemy);
      if (distance(dragon.x, dragon.y, center.x, center.y) > 25 + enemy.w * 0.35) continue;
      if ((effect.hitCooldowns[cooldownKey] || 0) > 0) continue;
      game.damageEnemy(enemy, effect.contactDamage, { source: "skill", isDirect: false });
      effect.hitCooldowns[cooldownKey] = 0.35;
    }
  }
  if (effect.autoFireCooldown <= 0) {
    const target = findNearestEnemy(game, centerOf(game.player), 320);
    if (target) {
      const targetCenter = centerOf(target);
      for (const dragon of effect.dragonPositions) {
        const dir = normalize(targetCenter.x - dragon.x, targetCenter.y - dragon.y, { x: 1, y: 0 });
        spawnNeutralSkillProjectile(game, "loyalDragons", {
          x: dragon.x,
          y: dragon.y,
          radius: 10,
          drawSize: 18,
          damage: effect.projectileDamage,
          speed: 420,
          vx: dir.x * 420,
          vy: dir.y * 420,
          maxRange: 420,
          color: "#fb923c"
        });
      }
      effect.autoFireCooldown = 2;
    }
  }
  return effect.elapsed < effect.duration;
}

function updateSpiderTrap(game, effect, dt) {
  effect.elapsed += dt;
  if (!effect.targetEnemyId) {
    const target = findNearestEnemy(game, effect, effect.radius);
    if (target) {
      effect.targetEnemyId = target.id;
      effect.biteTimer = effect.biteDuration;
      effect.biteTickTimer = 0;
    }
    return effect.elapsed < effect.duration;
  }

  const target = findEnemyById(game, effect.targetEnemyId);
  if (!target) {
    effect.targetEnemyId = null;
    return effect.elapsed < effect.duration;
  }

  effect.biteTimer -= dt;
  effect.biteTickTimer -= dt;
  applyEnemyFreeze(target, 0.2);
  const targetCenter = centerOf(target);
  const desiredX = effect.x - target.w * 0.5;
  const desiredY = effect.y - target.h * 0.5;
  moveEntitySafely(target, game, desiredX, desiredY);
  if (effect.biteTickTimer <= 0) {
    effect.biteTickTimer += effect.biteTickInterval;
      game.damageEnemy(target, effect.biteDamage, { source: "skill", isDirect: false });
  }
  if (target.dead) {
    effect.targetEnemyId = null;
    return effect.elapsed < effect.duration;
  }
  if (effect.biteTimer > 0) return effect.elapsed < effect.duration;
  pushCircleFlash(game, targetCenter.x, targetCenter.y, effect.radius * 0.75, 0.18, effect.color);
  return false;
}

function updateMagicHand(game, effect, dt) {
  effect.elapsed += dt;
  const progress = clamp(effect.elapsed / Math.max(0.001, effect.duration), 0, 1);
  for (const grabbed of effect.grabbed) {
    const enemy = findEnemyById(game, grabbed.enemyId);
    if (!enemy) continue;
    const x = grabbed.startX + (effect.x - enemy.w * 0.5 - grabbed.startX) * progress;
    const y = grabbed.startY + (effect.y - enemy.h * 0.5 - grabbed.startY) * progress;
    moveEntitySafely(enemy, game, x, y);
    applyEnemyFreeze(enemy, 0.12);
  }
  if (effect.elapsed < effect.duration) return true;
  for (const grabbed of effect.grabbed) {
    const enemy = findEnemyById(game, grabbed.enemyId);
    if (!enemy) continue;
    applyEnemySlow(enemy, 1.5, 0.55);
    game.damageEnemy(enemy, 10 * skillDamageScale(game), { source: "skill", isDirect: false });
  }
  pushCircleFlash(game, effect.x, effect.y, effect.radius, 0.2, effect.color);
  return false;
}

function updateAssimilativeOrb(game, effect, dt) {
  effect.elapsed += dt;
  effect.absorbFlash = Math.max(0, effect.absorbFlash - dt * 3);
  const playerCenter = centerOf(game.player);
  effect.x = playerCenter.x + 46;
  effect.y = playerCenter.y - 18;
  effect.radius = 40 + effect.absorbCount * 3;

  const remainingEnemyProjectiles = [];
  for (const projectile of game.combat.enemyProjectiles) {
    if (distance(effect.x, effect.y, projectile.x, projectile.y) <= effect.radius + projectile.radius) {
      effect.absorbCount += 1;
      effect.absorbFlash = 1;
      const target = findNearestEnemy(game, effect, 420);
      if (target) {
        const targetCenter = centerOf(target);
        const dir = normalize(targetCenter.x - effect.x, targetCenter.y - effect.y, { x: 1, y: 0 });
        spawnNeutralSkillProjectile(game, "assimilativeOrb", {
          x: effect.x,
          y: effect.y,
          radius: 11,
          drawSize: 20,
          damage: effect.projectileDamage + effect.absorbCount * 3,
          speed: 460,
          vx: dir.x * 460,
          vy: dir.y * 460,
          maxRange: 460,
          homingRadius: 240,
          homingTurnRate: 8,
          color: "#c084fc"
        });
      }
      continue;
    }
    remainingEnemyProjectiles.push(projectile);
  }
  game.combat.enemyProjectiles = remainingEnemyProjectiles;

  if (effect.elapsed < effect.duration) return true;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const center = centerOf(enemy);
    if (distance(effect.x, effect.y, center.x, center.y) > effect.radius + 54) continue;
    game.damageEnemy(enemy, effect.explosionDamage + effect.absorbCount * 6, { source: "skill", isDirect: false });
  }
  damageBreakablesInRadius(game, effect.x, effect.y, effect.radius + 54, effect.explosionDamage + effect.absorbCount * 6);
  pushCircleFlash(game, effect.x, effect.y, effect.radius + 26, 0.25, effect.color);
  return false;
}

function updateMeteorRain(game, effect, dt) {
  effect.elapsed += dt;
  effect.tickTimer -= dt;
  const playerCenter = centerOf(game.player);
  effect.x = playerCenter.x;
  effect.y = playerCenter.y;
  if (effect.tickTimer > 0) return effect.elapsed < effect.duration;
  effect.tickTimer += effect.tickInterval;
  for (let i = 0; i < 2; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * effect.radius;
    const hitX = effect.x + Math.cos(angle) * dist;
    const hitY = effect.y + Math.sin(angle) * dist;
    pushCircleFlash(game, hitX, hitY, 34, 0.18, effect.color);
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      const center = centerOf(enemy);
      if (distance(hitX, hitY, center.x, center.y) > 36 + enemy.w * 0.3) continue;
      game.damageEnemy(enemy, effect.impactDamage, { source: "skill", isDirect: false });
    }
    damageBreakablesInRadius(game, hitX, hitY, 36, effect.impactDamage);
  }
  return effect.elapsed < effect.duration;
}

function updatePurifyingFire(game, effect, dt) {
  effect.elapsed += dt;
  const playerCenter = centerOf(game.player);
  effect.x = playerCenter.x;
  effect.y = playerCenter.y;
  effect.tickTimer -= dt;
  if (effect.tickTimer > 0) return effect.elapsed < effect.duration;
  effect.tickTimer += effect.tickInterval;
  spendNonlethalHealth(game, effect.selfHpCostPerTick);
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const center = centerOf(enemy);
    if (distance(effect.x, effect.y, center.x, center.y) > effect.radius + enemy.w * 0.35) continue;
    const before = enemy.hp;
    game.damageEnemy(enemy, effect.damagePerTick, { source: "skill", isDirect: false });
    effect.totalDamageDealt += Math.max(0, before - Math.max(0, enemy.hp));
  }
  damageBreakablesInRadius(game, effect.x, effect.y, effect.radius, effect.damagePerTick);
  if (effect.elapsed < effect.duration) return true;
  healPlayer(game, Math.min(effect.healCap, effect.totalDamageDealt * effect.healRatio));
  pushCircleFlash(game, effect.x, effect.y, effect.radius, 0.24, "#fde68a");
  return false;
}

function updateTimedBuff(effect, dt) {
  effect.elapsed += dt;
  return effect.elapsed < effect.duration;
}

function countAncestralSpirits(game, effect) {
  let count = 0;
  for (const activeEffect of game.combat.skillRuntime?.effects || []) {
    if (activeEffect.kind === "spiritBanner" && distance(effect.x, effect.y, activeEffect.x, activeEffect.y) <= effect.radius) count += 1;
    else if (activeEffect.kind === "hauntingGhost" && distance(effect.x, effect.y, activeEffect.x, activeEffect.y) <= effect.radius) count += 1;
    else if (activeEffect.kind === "loyalDragons") count += (activeEffect.dragonPositions || []).filter((dragon) => distance(effect.x, effect.y, dragon.x, dragon.y) <= effect.radius).length;
  }
  const spirit = game.combat.weaponArtRuntime?.soulSiphonSpirit;
  if (spirit && distance(effect.x, effect.y, spirit.x, spirit.y) <= effect.radius) count += 1;
  return count;
}

function updateTricksterLuckBomb(game, effect, dt) {
  effect.elapsed += dt;
  effect.tickTimer -= dt;
  const playerCenter = centerOf(game.player);
  effect.x = playerCenter.x;
  effect.y = playerCenter.y;
  if (effect.tickTimer > 0) return effect.elapsed < effect.duration;
  effect.tickTimer += effect.tickInterval;
  pushCircleFlash(game, effect.x, effect.y, effect.radius, 0.2, effect.color);
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const center = centerOf(enemy);
    if (distance(effect.x, effect.y, center.x, center.y) > effect.radius + enemy.w * 0.35) continue;
    game.damageEnemy(enemy, effect.damage, { source: "skill", isDirect: false });
  }
  damageBreakablesInRadius(game, effect.x, effect.y, effect.radius, effect.damage);
  return effect.elapsed < effect.duration;
}

export function getDefaultRunSkillIds(skillIds = []) {
  const filtered = skillIds.filter((skillId) => PLAYABLE_RUN_SKILL_IDS.includes(skillId) && getExtractedSkillById(skillId));
  if (filtered.length >= 3) return filtered.slice(0, 3);
  const merged = [...filtered];
  for (const skillId of PLAYABLE_RUN_SKILL_IDS) {
    if (merged.includes(skillId)) continue;
    merged.push(skillId);
    if (merged.length >= 3) break;
  }
  return merged.slice(0, 3);
}

export function createSkillRuntime(skillIds = []) {
  const orderedSkillIds = getDefaultRunSkillIds(skillIds);
  return {
    slots: orderedSkillIds.map((skillId, slotIndex) => createSkillSlot(skillId, slotIndex)),
    hunterShotStacks: [],
    effects: [],
    totalDamageDealt: 0,
    procDamageScale: 1
  };
}

export function getRunSkillSlots(game) {
  return game.combat.skillRuntime?.slots || [];
}

export function getRunSkillEffects(game) {
  return game.combat.skillRuntime?.effects || [];
}

export function tryUseSkillSlot(game, slotIndex) {
  if (game.state !== "running" || game.combat.playerAction) return false;
  const slot = getRunSkillSlots(game)[slotIndex];
  if (!slot?.def) return false;
  const handler = SKILL_CAST_HANDLERS[slot.skillId];
  if (!handler) return false;
  if (slot.cooldownRemaining > 0) return false;
  if (slot.skillId === "homingSkullCharges" && slot.charges <= 0) return false;
  if (slot.skillId === "hauntingGhostCharges" && slot.charges <= 0) return false;
  if (slot.skillId === "cruelFinisher" && slot.basicCharges < (slot.maxBasicCharges || 5)) return false;
  if (slot.skillId === "lockpick" && !findNearestChest(game, 120)) return false;
  if (slot.skillId !== "shadowHeist") {
    game.combat.skillRuntime.effects = game.combat.skillRuntime.effects.filter((effect) => effect.kind !== "shadowHeist");
  }

  const base = aimDirection(game);
  beginSkillCast(game, {
    duration: handler.duration,
    triggerTime: handler.triggerTime,
    animationKey: resolveSkillAnimationKey(game, handler.animationKey),
    facing: facingFromDir(base.dir),
    moveMultiplier: handler.moveMultiplier ?? game.heroDef.combat.moveMultiplier,
    onTrigger: () => handler.execute(game, slot, base)
  });
  return true;
}

export function triggerSkillProc(game, slotIndex, damageScale = 1) {
  const slot = getRunSkillSlots(game)[slotIndex];
  if (!slot?.def) return false;
  const handler = SKILL_CAST_HANDLERS[slot.skillId];
  if (!handler) return false;
  if (slot.skillId === "lockpick" && !findNearestChest(game, 120)) return false;

  const skillRuntime = game.combat.skillRuntime;
  const snapshot = {
    cooldownRemaining: slot.cooldownRemaining,
    cooldownDuration: slot.cooldownDuration,
    charges: slot.charges,
    basicCharges: slot.basicCharges,
    isActive: slot.isActive
  };
  const previousScale = skillRuntime.procDamageScale || 1;
  skillRuntime.procDamageScale = damageScale;
  try {
    handler.execute(game, slot, aimDirection(game));
  } finally {
    skillRuntime.procDamageScale = previousScale;
    slot.cooldownRemaining = snapshot.cooldownRemaining;
    slot.cooldownDuration = snapshot.cooldownDuration;
    slot.charges = snapshot.charges;
    slot.basicCharges = snapshot.basicCharges;
    slot.isActive = snapshot.isActive;
  }
  return true;
}

export function updateSkillRuntime(game, dt) {
  const skillRuntime = game.combat.skillRuntime;
  if (!skillRuntime) return;
  const previousCooldowns = skillRuntime.slots.map((slot) => slot.cooldownRemaining);
  game.player.skillMoveSpeedMult = 1;
  game.player.skillAttackSpeedMult = 1;
  game.player.basicAttackDamageBonus = 0;
  game.player.lifestealRatio = 0;
  game.player.isInvisible = false;
  for (const slot of skillRuntime.slots) {
    slot.cooldownRemaining = Math.max(0, slot.cooldownRemaining - dt);
    if (slot.skillId === "bloodAmmo") {
      slot.isActive = skillRuntime.effects.some((effect) => effect.kind === slot.skillId);
    }
  }
  skillRuntime.hunterShotStacks = skillRuntime.hunterShotStacks
    .map((stack) => ({ ...stack, timer: stack.timer - dt }))
    .filter((stack) => stack.timer > 0);

  const nextEffects = [];
  for (const effect of skillRuntime.effects) {
    let keep = true;
    if (effect.kind === "circleFlash") keep = updateCircleFlash(effect, dt);
    else if (effect.kind === "iceRain") keep = updateIceRain(game, effect, dt);
    else if (effect.kind === "blackHole") keep = updateBlackHole(game, effect, dt);
    else if (effect.kind === "waveShield") keep = updateWaveShield(game, effect, dt);
    else if (effect.kind === "whirlwind") keep = updateWhirlwind(game, effect, dt);
    else if (effect.kind === "earthquake") keep = updateEarthquake(game, effect, dt);
    else if (effect.kind === "spiritBanner") keep = updateSpiritBanner(game, effect, dt);
    else if (effect.kind === "hauntingGhost") keep = updateHauntingGhost(game, effect, dt);
    else if (effect.kind === "loyalDragons") keep = updateLoyalDragons(game, effect, dt);
    else if (effect.kind === "spiderTrap") keep = updateSpiderTrap(game, effect, dt);
    else if (effect.kind === "magicHand") keep = updateMagicHand(game, effect, dt);
    else if (effect.kind === "assimilativeOrb") keep = updateAssimilativeOrb(game, effect, dt);
    else if (effect.kind === "meteorRain") keep = updateMeteorRain(game, effect, dt);
    else if (effect.kind === "purifyingFire") keep = updatePurifyingFire(game, effect, dt);
    else if (effect.kind === "bloodFrenzy") {
      game.player.skillAttackSpeedMult = Math.max(game.player.skillAttackSpeedMult, effect.attackSpeedMult);
      keep = updateTimedBuff(effect, dt);
    } else if (effect.kind === "frenzyProtocol") {
      game.player.skillAttackSpeedMult = Math.max(game.player.skillAttackSpeedMult, effect.attackSpeedMult);
      if (game.state === "running" && !game.combat.playerAction && game.combat.attackCooldown <= 0) {
        game.input.mouse.clicked = true;
      }
      keep = updateTimedBuff(effect, dt);
    } else if (effect.kind === "bloodPact") {
      game.player.lifestealRatio = Math.max(game.player.lifestealRatio, effect.lifestealRatio);
      keep = updateTimedBuff(effect, dt);
    } else if (effect.kind === "bloodAmmo") {
      game.player.basicAttackDamageBonus = Math.max(game.player.basicAttackDamageBonus, effect.attackDamageBonus);
      effect.elapsed += dt;
      keep = true;
    } else if (effect.kind === "shadowHeist") {
      game.player.isInvisible = true;
      keep = updateTimedBuff(effect, dt);
    } else if (effect.kind === "loadedDiceDamage") {
      game.player.basicAttackDamageBonus = Math.max(game.player.basicAttackDamageBonus, effect.damageBonus);
      keep = updateTimedBuff(effect, dt);
    } else if (effect.kind === "tricksterMove") {
      game.player.skillMoveSpeedMult = Math.max(game.player.skillMoveSpeedMult, effect.moveSpeedMult);
      keep = updateTimedBuff(effect, dt);
    } else if (effect.kind === "tricksterLuckBomb") keep = updateTricksterLuckBomb(game, effect, dt);
    else if (effect.kind === "ancestralShout") {
      effect.elapsed += dt;
      effect.x = centerOf(game.player).x;
      effect.y = centerOf(game.player).y;
      const spirits = countAncestralSpirits(game, effect);
      if (spirits > 0) {
        game.player.basicAttackDamageBonus = Math.max(game.player.basicAttackDamageBonus, spirits * effect.perSpiritDamageBonus);
      }
      keep = effect.elapsed < effect.duration;
    }
    if (keep) nextEffects.push(effect);
  }
  skillRuntime.effects = nextEffects;
  skillRuntime.slots.forEach((slot, index) => {
    if (previousCooldowns[index] > 0 && slot.cooldownRemaining <= 0) {
      onRingSkillCooldownRestored(game, index);
    }
  });
}

export function onEnemyKilledForSkills(game) {
  const slots = getRunSkillSlots(game);
  for (const slot of slots) {
    if ((slot.skillId === "homingSkullCharges" || slot.skillId === "hauntingGhostCharges") && slot.charges < slot.maxCharges) {
      const killsPerCharge = slot.skillId === "hauntingGhostCharges" ? 5 : 3;
      slot.killProgress += 1;
      if (slot.killProgress >= killsPerCharge) {
        slot.killProgress = 0;
        slot.charges = clamp(slot.charges + 1, 0, slot.maxCharges);
      }
    }
  }
}

export function onBasicAttackUsedForSkills(game) {
  const skillRuntime = game.combat.skillRuntime;
  const shadowHeistIndex = skillRuntime?.effects?.findIndex((effect) => effect.kind === "shadowHeist") ?? -1;
  if (shadowHeistIndex >= 0) skillRuntime.effects.splice(shadowHeistIndex, 1);
  const bloodAmmo = skillRuntime?.effects?.find((effect) => effect.kind === "bloodAmmo");
  if (bloodAmmo) spendNonlethalHealth(game, bloodAmmo.healthCost || 4);

  for (const slot of getRunSkillSlots(game)) {
    if (slot.skillId === "hunterShot") {
      slot.cooldownRemaining = Math.max(0, slot.cooldownRemaining - 0.1);
      continue;
    }
    if (slot.skillId === "cruelFinisher") {
      slot.basicCharges = clamp(slot.basicCharges + 1, 0, slot.maxBasicCharges || 5);
    }
  }
  for (const effect of game.combat.skillRuntime?.effects || []) {
    if (effect.kind !== "loyalDragons" || effect.projectileCooldown > 0 || !effect.dragonPositions?.length) continue;
    const target = findNearestEnemy(game, centerOf(game.player), 420);
    if (!target) continue;
    const targetCenter = centerOf(target);
    for (const dragon of effect.dragonPositions) {
      const dir = normalize(targetCenter.x - dragon.x, targetCenter.y - dragon.y, { x: 1, y: 0 });
      spawnNeutralSkillProjectile(game, "loyalDragons", {
        x: dragon.x,
        y: dragon.y,
        radius: 10,
        drawSize: 18,
        damage: effect.projectileDamage,
        speed: 420,
        vx: dir.x * 420,
        vy: dir.y * 420,
        maxRange: 420,
        color: "#fb923c"
      });
    }
    effect.projectileCooldown = 1;
  }
}

export function onPlayerDealtDamageForSkills(game, damage) {
  const skillRuntime = game.combat.skillRuntime;
  if (!skillRuntime || damage <= 0) return;
  skillRuntime.totalDamageDealt += damage;
  if (game.player.lifestealRatio > 0) {
    healPlayer(game, damage * game.player.lifestealRatio);
  }
}
