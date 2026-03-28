import { centerOf, circleHitsRect, distance, rectsOverlap } from "../core/runtime-utils.js";
import { createWeaponArtRuntime, triggerWeaponArtAttack, updateWeaponArtRuntime } from "./weapon-art-runtime.js";

export function createCombatState() {
  return {
    attackCooldown: 0,
    castTimer: 0,
    contactCooldown: 0,
    playerAction: null,
    playerBeam: null,
    playerProjectiles: [],
    enemyProjectiles: [],
    enemyAreaHitboxes: [],
    weaponArtRuntime: createWeaponArtRuntime()
  };
}

export function spawnEnemyProjectile(game, enemy, directionOrConfig) {
  const origin = centerOf(enemy);
  const config = "dirX" in directionOrConfig
    ? directionOrConfig
    : {
        dirX: directionOrConfig.x,
        dirY: directionOrConfig.y,
        damage: enemy.damage,
        speed: enemy.projectileSpeed || 300,
        radius: 10,
        size: 20,
        color: "#f59e0b"
      };
  const length = Math.hypot(config.dirX, config.dirY) || 1;
  const dirX = config.dirX / length;
  const dirY = config.dirY / length;
  game.combat.enemyProjectiles.push({
    x: origin.x,
    y: origin.y,
    radius: config.radius ?? 10,
    drawSize: config.size ?? (config.radius ?? 10) * 2,
    damage: config.damage ?? enemy.damage,
    speed: config.speed || 300,
    vx: dirX * (config.speed || 300),
    vy: dirY * (config.speed || 300),
    traveled: 0,
    maxRange: config.maxRange ?? 560,
    lifetime: config.lifetime ?? null,
    age: 0,
    color: config.color ?? "#f59e0b",
    spriteAsset: config.spriteAsset ?? null,
    sourceAttackId: config.sourceAttackId ?? null,
    trailInterval: config.trailInterval ?? null,
    trailTimer: config.trailInterval ?? 0,
    trailChild: config.trailChild ?? null
  });
}

export function spawnEnemyAreaHitbox(game, hitbox) {
  game.combat.enemyAreaHitboxes.push({
    ...hitbox,
    duration: hitbox.duration ?? 0.1,
    age: 0,
    hit: false
  });
}

export function damageEnemy(game, enemy, amount) {
  enemy.hp -= amount;
  enemy.hitFlash = 0.12;
  if (enemy.hp > 0) return;
  enemy.dead = true;
  game.kills += 1;
  game.roomKills += 1;
  game.player.damageBonus = Math.min(0.2, game.player.damageBonus + 0.01);
  game.player.damageBonusTimer = 5;
}

export function damagePlayer(game, amount) {
  if (game.combat.contactCooldown > 0 || game.state !== "running") return false;
  game.player.hp = Math.max(0, game.player.hp - amount);
  if (!game.combat.playerAction?.animationKey) {
    game.player.hitDuration = 0.34;
    game.player.hitTimer = game.player.hitDuration;
  }
  game.combat.contactCooldown = 0.5;
  if (game.player.hp <= 0) game.state = "defeat";
  return true;
}

function projectileHitsWall(projectile, room) {
  const bounds = {
    x: projectile.x - projectile.radius,
    y: projectile.y - projectile.radius,
    w: projectile.radius * 2,
    h: projectile.radius * 2
  };
  return room.collisionRects.some((wall) => rectsOverlap(bounds, wall));
}

function updatePlayerAction(game, dt) {
  const action = game.combat.playerAction;
  if (!action) return;
  action.elapsed += dt;
  game.combat.castTimer = Math.max(0, action.duration - action.elapsed);
  if (!action.triggered && action.elapsed >= action.triggerTime) {
    action.triggered = true;
    action.onTrigger?.();
  }
  if (action.elapsed >= action.duration) {
    game.combat.playerAction = null;
    game.combat.castTimer = 0;
  }
}

function updatePlayerProjectiles(game, dt) {
  const room = game.world;
  const remaining = [];
  for (const projectile of game.combat.playerProjectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.traveled += projectile.speed * dt;
    if (projectile.traveled >= projectile.maxRange) continue;
    if (projectile.x < 0 || projectile.y < 0 || projectile.x > room.width || projectile.y > room.height) continue;
    if (projectileHitsWall(projectile, room)) continue;

    let hitsRemaining = projectile.pierce ?? 0;
    let consumed = false;
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      const center = centerOf(enemy);
      const radiusFactor = enemy.collisionRadius ?? 0.32;
      if (distance(projectile.x, projectile.y, center.x, center.y) > projectile.radius + enemy.w * radiusFactor) continue;
      damageEnemy(game, enemy, projectile.damage);
      if (hitsRemaining <= 0) {
        consumed = true;
        break;
      }
      hitsRemaining -= 1;
      projectile.pierce = hitsRemaining;
    }
    if (!consumed) remaining.push(projectile);
  }
  game.combat.playerProjectiles = remaining;
}

function updateEnemyProjectiles(game, dt) {
  const room = game.world;
  const remaining = [];
  for (const projectile of game.combat.enemyProjectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.traveled += projectile.speed * dt;
    projectile.age += dt;
    if (projectile.lifetime != null && projectile.age >= projectile.lifetime) continue;
    if (projectile.traveled >= projectile.maxRange) continue;
    if (projectile.x < 0 || projectile.y < 0 || projectile.x > room.width || projectile.y > room.height) continue;
    if (projectileHitsWall(projectile, room)) continue;
    if (circleHitsRect(projectile.x, projectile.y, projectile.radius, game.player)) {
      damagePlayer(game, projectile.damage);
      continue;
    }
    remaining.push(projectile);
  }
  game.combat.enemyProjectiles = remaining;
}

function pointInCone(px, py, hitbox) {
  const dx = px - hitbox.x;
  const dy = py - hitbox.y;
  const length = Math.hypot(dx, dy);
  if (length > hitbox.range) return false;
  const dirLength = Math.hypot(hitbox.dirX, hitbox.dirY) || 1;
  const nx = hitbox.dirX / dirLength;
  const ny = hitbox.dirY / dirLength;
  const dot = (dx / Math.max(length, 0.0001)) * nx + (dy / Math.max(length, 0.0001)) * ny;
  return dot >= Math.cos(((hitbox.arcDeg ?? 90) * Math.PI) / 360);
}

function hitboxHitsPlayer(hitbox, player) {
  const center = centerOf(player);
  if (hitbox.shape === "circle") {
    return distance(hitbox.x, hitbox.y, center.x, center.y) <= hitbox.radius + Math.min(player.w, player.h) * 0.33;
  }
  if (hitbox.shape === "cone") return pointInCone(center.x, center.y, hitbox);
  return false;
}

function updateEnemyAreaHitboxes(game, dt) {
  const remaining = [];
  for (const hitbox of game.combat.enemyAreaHitboxes) {
    hitbox.age += dt;
    if (!hitbox.hit && hitboxHitsPlayer(hitbox, game.player)) {
      if (damagePlayer(game, hitbox.damage)) hitbox.hit = true;
    }
    if (hitbox.age < hitbox.duration) remaining.push(hitbox);
  }
  game.combat.enemyAreaHitboxes = remaining;
}

export function tryHeroAttack(game) {
  const combat = game.combat;
  if (combat.attackCooldown > 0 || combat.playerAction || game.state !== "running") return false;
  combat.attackCooldown = game.heroDef.combat.cooldown;
  return triggerWeaponArtAttack(game);
}

export function updateCombat(game, dt) {
  const combat = game.combat;
  combat.attackCooldown = Math.max(0, combat.attackCooldown - dt);
  combat.contactCooldown = Math.max(0, combat.contactCooldown - dt);
  game.player.damageBonusTimer = Math.max(0, game.player.damageBonusTimer - dt);
  if (game.player.damageBonusTimer <= 0) game.player.damageBonus = 0;

  updateWeaponArtRuntime(game, dt);

  if ((game.input.mouse.clicked || game.input.wasPressed("f")) && game.state === "running") {
    tryHeroAttack(game);
  }

  updatePlayerAction(game, dt);
  updatePlayerProjectiles(game, dt);
  updateEnemyProjectiles(game, dt);
  updateEnemyAreaHitboxes(game, dt);
}

export function resolveEnemyBodyDamage(game) {
  if (game.combat.contactCooldown > 0 || game.state !== "running") return;
  for (const enemy of game.enemies) {
    if (enemy.dead || enemy.role === "ranged" || enemy.attackRuntime || (enemy.state?.spawnGrace ?? 0) > 0) continue;
    const enemyCenter = centerOf(enemy);
    const playerCenter = centerOf(game.player);
    if (distance(playerCenter.x, playerCenter.y, enemyCenter.x, enemyCenter.y) > (enemy.w + game.player.w) * 0.33) continue;
    damagePlayer(game, enemy.damage);
    break;
  }
}
