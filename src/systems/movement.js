import { centerOf, clamp, normalize, rectsOverlap, toDirectionKey } from "../core/runtime-utils.js";
import { getBlockingBreakableRects } from "./breakables.js";
import { getMaxDashCharges, getTotalMoveSpeed, onRingDashUsed } from "./rings.js";
import { applyStatusPayload, getEntitySlowMultiplier, isEntityStunned } from "./status-manager.js";
import { getPlayerSkillAttackDamage } from "./player-stats.js";

function tryMove(entity, game, dx, dy, options = {}) {
  const world = game.world;
  const nextX = clamp(entity.x + dx, 0, world.width - entity.w);
  const nextY = clamp(entity.y + dy, 0, world.height - entity.h);
  const testX = { x: nextX, y: entity.y, w: entity.w, h: entity.h };
  const testY = { x: entity.x, y: nextY, w: entity.w, h: entity.h };
  let moveX = nextX;
  let moveY = nextY;
  const ignoreTrees = !!options.ignoreTrees;
  const blockers = [
    ...world.collisionRects.filter((wall) => !(ignoreTrees && (world.treeCollisionRects || []).includes(wall))),
    ...getBlockingBreakableRects(game)
  ];

  for (const wall of blockers) {
    if (rectsOverlap(testX, wall)) moveX = entity.x;
    if (rectsOverlap(testY, wall)) moveY = entity.y;
  }

  const moved = moveX !== entity.x || moveY !== entity.y;
  entity.x = moveX;
  entity.y = moveY;
  return moved;
}

export function createMovementState(heroDef) {
  return {
    state: "walk",
    dashCharges: heroDef.dash.charges,
    dashCooldown: 0,
    sprintTimer: 0,
    dashTimer: 0,
    slideTimer: 0,
    dashDirection: { x: 1, y: 0 },
    slideDirection: { x: 1, y: 0 },
    lastDashDirection: { x: 1, y: 0 },
    slideWindowTimer: 0,
    lastTreeSafePosition: null,
    spiritCooldown: 0,
    darkGraspCooldown: 0,
    lightningDashCooldown: 0,
    knightChargeCooldown: 0,
    windFlipCharges: 2,
    windFlipCooldown: 0
  };
}

function updateHitCooldownMap(map, dt) {
  if (!map) return;
  for (const key of Object.keys(map)) {
    map[key] = Math.max(0, map[key] - dt);
    if (map[key] <= 0) delete map[key];
  }
}

function isOverlappingAnyRect(entity, rects) {
  for (const rect of rects || []) {
    if (rectsOverlap(entity, rect)) return true;
  }
  return false;
}

function rememberTreeSafePosition(player, movement, world) {
  if (!isOverlappingAnyRect(player, world.treeCollisionRects || [])) {
    movement.lastTreeSafePosition = { x: player.x, y: player.y };
  }
}

function resolveOutOfTreeCollisions(player, world) {
  const treeRects = world.treeCollisionRects || [];
  if (!treeRects.length) return false;

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const overlappingRect = treeRects.find((rect) => rectsOverlap(player, rect));
    if (!overlappingRect) return true;

    const overlapLeft = player.x + player.w - overlappingRect.x;
    const overlapRight = overlappingRect.x + overlappingRect.w - player.x;
    const overlapTop = player.y + player.h - overlappingRect.y;
    const overlapBottom = overlappingRect.y + overlappingRect.h - player.y;
    const minX = Math.min(overlapLeft, overlapRight);
    const minY = Math.min(overlapTop, overlapBottom);
    const playerCenterX = player.x + player.w * 0.5;
    const playerCenterY = player.y + player.h * 0.5;
    const rectCenterX = overlappingRect.x + overlappingRect.w * 0.5;
    const rectCenterY = overlappingRect.y + overlappingRect.h * 0.5;

    if (minX <= minY) {
      player.x += playerCenterX < rectCenterX ? -(minX + 0.5) : (minX + 0.5);
    } else {
      player.y += playerCenterY < rectCenterY ? -(minY + 0.5) : (minY + 0.5);
    }

    player.x = clamp(player.x, 0, world.width - player.w);
    player.y = clamp(player.y, 0, world.height - player.h);
  }

  return !isOverlappingAnyRect(player, treeRects);
}

function finalizeTreeIgnoringMovement(player, movement, world) {
  if (!isOverlappingAnyRect(player, world.treeCollisionRects || [])) {
    movement.lastTreeSafePosition = null;
    return;
  }

  const fallback = movement.lastTreeSafePosition;
  if (fallback) {
    player.x = fallback.x;
    player.y = fallback.y;
  }

  if (isOverlappingAnyRect(player, world.treeCollisionRects || [])) {
    resolveOutOfTreeCollisions(player, world);
  }

  movement.lastTreeSafePosition = null;
}

function updateDashCharges(game, player, heroDef, dt) {
  const movement = player.movement;
  const maxCharges = getMaxDashCharges(game);
  movement.dashCharges = Math.min(movement.dashCharges, maxCharges);
  if (movement.dashCharges >= maxCharges) {
    movement.dashCooldown = 0;
    return;
  }
  movement.dashCooldown = Math.max(0, movement.dashCooldown - dt);
  if (movement.dashCooldown > 0) return;
  movement.dashCharges = Math.min(maxCharges, movement.dashCharges + 1);
  if (movement.dashCharges < maxCharges) movement.dashCooldown = heroDef.dash.recharge;
}

function consumeDashCharge(game, player, heroDef) {
  const movement = player.movement;
  if (movement.dashCharges <= 0) return false;
  movement.dashCharges -= 1;
  if (movement.dashCooldown <= 0) movement.dashCooldown = heroDef.dash.recharge;
  onRingDashUsed(game);
  return true;
}

function updateWindFlipCharges(player, heroDef, dt) {
  const movement = player.movement;
  const maxCharges = heroDef.id === "wind_archer" ? 2 : 0;
  movement.windFlipCharges = Math.min(movement.windFlipCharges, maxCharges);
  if (movement.windFlipCharges >= maxCharges) {
    movement.windFlipCooldown = 0;
    return;
  }
  movement.windFlipCooldown = Math.max(0, movement.windFlipCooldown - dt);
  if (movement.windFlipCooldown > 0) return;
  movement.windFlipCharges = Math.min(maxCharges, movement.windFlipCharges + 1);
  if (movement.windFlipCharges < maxCharges) movement.windFlipCooldown = 5;
}

function consumeWindFlipCharge(player, heroDef) {
  const movement = player.movement;
  if (heroDef.id !== "wind_archer" || movement.windFlipCharges <= 0) return false;
  movement.windFlipCharges -= 1;
  if (movement.windFlipCooldown <= 0) movement.windFlipCooldown = 5;
  return true;
}

function resolveFacing(game, input, camera) {
  const { player, combat } = game;
  if (combat.playerAction?.facing) {
    player.facing = combat.playerAction.facing;
    return;
  }
  const moveAxis = input.getMoveAxis();
  if (Math.abs(moveAxis.x) > 0.001 || Math.abs(moveAxis.y) > 0.001) {
    player.facing = toDirectionKey(moveAxis.x, moveAxis.y, player.facing);
    return;
  }
  const aim = input.getAimWorld(camera);
  const center = centerOf(player);
  player.facing = toDirectionKey(aim.x - center.x, aim.y - center.y, player.facing);
}

function directionFromInputOrAim(player, input, camera) {
  const moveAxis = input.getMoveAxis();
  if (Math.abs(moveAxis.x) > 0.001 || Math.abs(moveAxis.y) > 0.001) return moveAxis;
  const aim = input.getAimWorld(camera);
  const center = centerOf(player);
  return normalize(aim.x - center.x, aim.y - center.y, { x: 1, y: 0 });
}

function directionFromAim(player, input, camera) {
  const aim = input.getAimWorld(camera);
  const center = centerOf(player);
  return normalize(aim.x - center.x, aim.y - center.y, { x: 1, y: 0 });
}

function setMovementState(player, state) {
  player.movement.state = state;
}

export function updatePlayerMovement(game, dt) {
  const { player, heroDef, input, camera, world } = game;
  const movement = player.movement;
  const moveAxis = input.getMoveAxis();
  const skillAttackDamage = getPlayerSkillAttackDamage(player);

  resolveFacing(game, input, camera);
  updateDashCharges(game, player, heroDef, dt);
  updateWindFlipCharges(player, heroDef, dt);
  movement.slideWindowTimer = Math.max(0, movement.slideWindowTimer - dt);
  movement.spiritCooldown = Math.max(0, movement.spiritCooldown - dt);
  movement.darkGraspCooldown = Math.max(0, movement.darkGraspCooldown - dt);
  movement.lightningDashCooldown = Math.max(0, movement.lightningDashCooldown - dt);
  movement.knightChargeCooldown = Math.max(0, movement.knightChargeCooldown - dt);

  if (
    input.wasPressed("shift")
    && movement.sprintTimer <= 0
    && movement.dashTimer <= 0
    && movement.slideTimer <= 0
    && consumeDashCharge(game, player, heroDef)
  ) {
    movement.sprintTimer = heroDef.sprintDuration;
    setMovementState(player, "sprint");
  }

  if (!input.isHeld("shift")) {
    movement.sprintTimer = Math.max(0, Math.min(movement.sprintTimer, 0.15));
  }

  if (input.wasPressed(" ") && movement.slideTimer <= 0 && movement.dashTimer <= 0 && consumeDashCharge(game, player, heroDef)) {
    movement.dashTimer = heroDef.dash.duration;
    movement.dashDirection = directionFromInputOrAim(player, input, camera);
    movement.lastTreeSafePosition = { x: player.x, y: player.y };
    setMovementState(player, "dash");
  }

  if (input.wasPressed("control")) {
    if (movement.state === "sprint") {
      movement.sprintTimer = 0;
      movement.slideTimer = heroDef.slide.duration;
      movement.slideDirection = directionFromInputOrAim(player, input, camera);
      movement.lastTreeSafePosition = { x: player.x, y: player.y };
      setMovementState(player, "slide");
    } else if (movement.state === "dash") {
      movement.slideTimer = heroDef.slide.duration;
      movement.slideDirection = { ...movement.dashDirection };
      movement.dashTimer = 0;
      if (!movement.lastTreeSafePosition) movement.lastTreeSafePosition = { x: player.x, y: player.y };
      setMovementState(player, "slide");
    } else if (movement.slideWindowTimer > 0) {
      movement.slideTimer = heroDef.slide.duration;
      movement.slideDirection = { ...movement.lastDashDirection };
      movement.lastTreeSafePosition = { x: player.x, y: player.y };
      setMovementState(player, "slide");
    }
  }

  if (input.wasPressed("e") && !player.spiritMode && movement.spiritCooldown <= 0 && heroDef.id === "dark_mage") {
    player.spiritMode = {
      active: true,
      duration: 1,
      timer: 1,
      spiritX: player.x,
      spiritY: player.y,
      playerStartX: player.x,
      playerStartY: player.y
    };
    movement.spiritCooldown = 7;
  }

  if (input.wasPressed("e") && !player.darkGraspState && movement.darkGraspCooldown <= 0 && heroDef.id === "death_knight") {
    const center = centerOf(player);
    const mouseWorld = {
      x: input.mouse.x + camera.x,
      y: input.mouse.y + camera.y
    };
    const dx = mouseWorld.x - center.x;
    const dy = mouseWorld.y - center.y;
    const dist = Math.hypot(dx, dy) || 1;
    const aimDir = { x: dx / dist, y: dy / dist };
    player.darkGraspState = {
      casting: true,
      animTimer: 0,
      animDuration: 4 / 15,
      dirX: aimDir.x,
      dirY: aimDir.y,
      originX: center.x,
      originY: center.y,
      hitSpawned: false
    };
    movement.darkGraspCooldown = 5;
  }

  if (input.wasPressed("e") && !player.lightningDashState && movement.lightningDashCooldown <= 0 && heroDef.id === "element_mage") {
    const center = centerOf(player);
    const mouseWorld = {
      x: input.mouse.x + camera.x,
      y: input.mouse.y + camera.y
    };
    const dx = mouseWorld.x - center.x;
    const dy = mouseWorld.y - center.y;
    const dist = Math.min(Math.hypot(dx, dy), 300);
    const dir = { x: dx / (Math.hypot(dx, dy) || 1), y: dy / (Math.hypot(dx, dy) || 1) };
    const targetX = center.x + dir.x * dist;
    const targetY = center.y + dir.y * dist;

    const strikes = [];
    for (let i = 0; i < 8; i++) {
      const strikePos = Math.random() * dist;
      strikes.push({
        x: center.x + dir.x * strikePos,
        y: center.y + dir.y * strikePos,
        animTimer: null,
        spawned: false,
        delay: i * 0.05
      });
    }

    player.lightningDashState = {
      dashing: true,
      dashTimer: 0.15,
      startX: player.x,
      startY: player.y,
      targetX: targetX - player.w / 2,
      targetY: targetY - player.h / 2,
      flashStartTimer: 8 / 15,
      flashEndTimer: 0,
      strikeTimer: 0.3,
      strikes: strikes,
      enemyHitCounts: {}
    };
    movement.lightningDashCooldown = 7;
  }

  if (input.wasPressed("e") && !player.knightChargeState && movement.knightChargeCooldown <= 0 && heroDef.id === "knight") {
    const dir = directionFromAim(player, input, camera);
    player.knightChargeState = {
      active: true,
      elapsed: 0,
      duration: 2,
      dirX: dir.x,
      dirY: dir.y,
      hitEnemyCooldowns: {}
    };
    movement.knightChargeCooldown = 7;
    setMovementState(player, "sprint");
  }

  if (input.wasPressed("e") && !player.windFlipState && heroDef.id === "wind_archer" && consumeWindFlipCharge(player, heroDef)) {
    const dir = directionFromAim(player, input, camera);
    player.windFlipState = {
      active: true,
      elapsed: 0,
      duration: 0.3,
      dirX: dir.x,
      dirY: dir.y,
      firedLandingAttack: false
    };
    player.facing = toDirectionKey(dir.x, dir.y, player.facing);
    setMovementState(player, "sprint");
  }

  if (player.spiritMode?.active) {
    player.spiritMode.timer -= dt;
    if (player.spiritMode.timer <= 0) {
      const testRect = { x: player.spiritMode.spiritX, y: player.spiritMode.spiritY, w: player.w, h: player.h };
      let canTeleport = true;
      for (const wall of game.world.collisionRects) {
        if (rectsOverlap(testRect, wall)) {
          canTeleport = false;
          break;
        }
      }
      if (canTeleport) {
        player.x = player.spiritMode.spiritX;
        player.y = player.spiritMode.spiritY;
      }
      player.spiritMode = null;
    } else {
      const spiritSpeed = getTotalMoveSpeed(game) * 2;
      const spiritDx = moveAxis.x * spiritSpeed * dt;
      const spiritDy = moveAxis.y * spiritSpeed * dt;
      const nextX = clamp(player.spiritMode.spiritX + spiritDx, 0, world.width - player.w);
      const nextY = clamp(player.spiritMode.spiritY + spiritDy, 0, world.height - player.h);
      player.spiritMode.spiritX = nextX;
      player.spiritMode.spiritY = nextY;
      const spiritRect = { x: nextX, y: nextY, w: player.w, h: player.h };
      for (const enemy of game.enemies) {
        if (enemy.dead) continue;
        if (!rectsOverlap(spiritRect, enemy)) continue;
        applyStatusPayload(enemy, { slowDuration: 2, slowMult: 0.5 });
      }
      return;
    }
  }

  if (player.lightningDashState) {
    if (player.lightningDashState.dashing) {
      player.lightningDashState.dashTimer -= dt;
      player.lightningDashState.flashStartTimer -= dt;
      const progress = 1 - player.lightningDashState.dashTimer / 0.15;
      player.x = player.lightningDashState.startX + (player.lightningDashState.targetX - player.lightningDashState.startX) * progress;
      player.y = player.lightningDashState.startY + (player.lightningDashState.targetY - player.lightningDashState.startY) * progress;

      if (player.lightningDashState.dashTimer <= 0) {
        player.lightningDashState.dashing = false;
        player.lightningDashState.flashEndTimer = 8 / 15;

        const testRect = { x: player.x, y: player.y, w: player.w, h: player.h };
        let inWall = false;
        for (const wall of game.world.collisionRects) {
          if (rectsOverlap(testRect, wall)) {
            inWall = true;
            break;
          }
        }

        if (inWall) {
          player.x = player.lightningDashState.startX;
          player.y = player.lightningDashState.startY;
        }
      }
    } else {
      player.lightningDashState.flashEndTimer -= dt;
      player.lightningDashState.strikeTimer -= dt;

      for (const strike of player.lightningDashState.strikes) {
        const timeSinceStrikeStart = Math.abs(Math.min(0, player.lightningDashState.strikeTimer));
        if (!strike.spawned && timeSinceStrikeStart >= strike.delay) {
          strike.spawned = true;
          strike.animTimer = 8 / 15;
        }
        if (strike.animTimer != null) {
          strike.animTimer -= dt;
          const currentFrame = Math.floor(((8 / 15 - strike.animTimer) / (8 / 15)) * 8);
          if (currentFrame >= 2 && !strike.hitApplied) {
            strike.hitApplied = true;
            for (const enemy of game.enemies) {
              if (enemy.dead) continue;
              const enemyCenter = centerOf(enemy);
              const dist = Math.hypot(enemyCenter.x - strike.x, enemyCenter.y - strike.y);
              if (dist < 40) {
                const hitCounts = player.lightningDashState.enemyHitCounts;
                const previousHits = hitCounts[enemy.id] || 0;
                const damageMultiplier = previousHits > 0 ? 0.1 : 0.5;
                hitCounts[enemy.id] = previousHits + 1;
                game.damageEnemy(enemy, skillAttackDamage * damageMultiplier, { source: "lightning_strike" });
              }
            }
          }
        }
      }

      const allStrikesDone = player.lightningDashState.strikes.every(s => s.animTimer != null && s.animTimer <= 0);
      if (player.lightningDashState.flashEndTimer <= 0 && player.lightningDashState.strikeTimer <= 0 && allStrikesDone) {
        player.lightningDashState = null;
      }
    }
  }

  if (player.knightChargeState?.active) {
    const charge = player.knightChargeState;
    charge.elapsed += dt;
    updateHitCooldownMap(charge.hitEnemyCooldowns, dt);

    const ramp = clamp(charge.elapsed / 1, 0, 1);
    const chargeSpeed = getTotalMoveSpeed(game) * getEntitySlowMultiplier(player) * (1 + ramp);
    const moved = tryMove(player, game, charge.dirX * chargeSpeed * dt, charge.dirY * chargeSpeed * dt, { ignoreTrees: true });
    player.isMoving = moved;

    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      if (!rectsOverlap(player, enemy)) continue;
      if ((charge.hitEnemyCooldowns[enemy.id] || 0) > 0) continue;
      charge.hitEnemyCooldowns[enemy.id] = 0.22;
      const playerCenter = centerOf(player);
      const enemyCenter = centerOf(enemy);
      const cross = charge.dirX * (enemyCenter.y - playerCenter.y) - charge.dirY * (enemyCenter.x - playerCenter.x);
      const sideSign = cross >= 0 ? 1 : -1;
      const sideDirX = -charge.dirY * sideSign;
      const sideDirY = charge.dirX * sideSign;
      tryMove(enemy, game, sideDirX * 44, sideDirY * 44);
      enemy.hitTimer = Math.max(enemy.hitTimer || 0, 0.12);
      enemy.staggerTimer = Math.max(enemy.staggerTimer || 0, 0.16);
      enemy.staggerDuration = Math.max(enemy.staggerDuration || 0, 0.16);
      enemy.hitDirX = sideDirX;
      enemy.hitDirY = sideDirY;
      enemy.staggerMoveSpeed = 240;
    }

    if (charge.elapsed >= charge.duration) {
      player.knightChargeState = null;
      setMovementState(player, "walk");
    }
    return;
  }

  if (player.windFlipState?.active) {
    const flip = player.windFlipState;
    flip.elapsed += dt;
    player.facing = toDirectionKey(flip.dirX, flip.dirY, player.facing);
    const flipSpeed = getTotalMoveSpeed(game) * getEntitySlowMultiplier(player) * 2;
    player.isMoving = tryMove(player, game, flip.dirX * flipSpeed * dt, flip.dirY * flipSpeed * dt, { ignoreTrees: true });

    if (flip.elapsed >= flip.duration) {
      player.windFlipState = null;
      setMovementState(player, "walk");
      if (!flip.firedLandingAttack) {
        flip.firedLandingAttack = true;
        let nearestEnemy = null;
        let nearestDistance = Infinity;
        const playerCenter = centerOf(player);
        for (const enemy of game.enemies) {
          if (enemy.dead) continue;
          const enemyCenter = centerOf(enemy);
          const dist = Math.hypot(enemyCenter.x - playerCenter.x, enemyCenter.y - playerCenter.y);
          if (dist >= nearestDistance) continue;
          nearestEnemy = enemy;
          nearestDistance = dist;
        }
        if (nearestEnemy) {
          game.combat.overrideAimPointOnce = centerOf(nearestEnemy);
        }
        game.combat.attackCooldown = 0;
        game.tryHeroAttack?.();
      }
    }
    return;
  }

  if (player.darkGraspState) {
    if (player.darkGraspState.casting) {
      player.darkGraspState.animTimer += dt;
      const currentFrame = Math.floor((player.darkGraspState.animTimer / player.darkGraspState.animDuration) * 4);

      if (currentFrame >= 1 && !player.darkGraspState.hitSpawned) {
        player.darkGraspState.hitSpawned = true;
        const angle = Math.atan2(player.darkGraspState.dirY, player.darkGraspState.dirX);
        let hitEnemy = null;
        let hitWallPos = null;

        const step = 10;
        for (let dist = 10; dist <= 400; dist += step) {
          const checkX = player.darkGraspState.originX + player.darkGraspState.dirX * dist;
          const checkY = player.darkGraspState.originY + player.darkGraspState.dirY * dist;
          const testRect = { x: checkX - player.w / 2, y: checkY - player.h / 2, w: player.w, h: player.h };

          for (const wall of game.world.collisionRects) {
            if (rectsOverlap(testRect, wall)) {
              hitWallPos = { x: checkX - player.darkGraspState.dirX * step, y: checkY - player.darkGraspState.dirY * step };
              break;
            }
          }
          if (hitWallPos) break;
        }

        if (!hitWallPos) {
          for (const enemy of game.enemies) {
            if (enemy.dead) continue;
            const enemyCenter = centerOf(enemy);
            const dx = enemyCenter.x - player.darkGraspState.originX;
            const dy = enemyCenter.y - player.darkGraspState.originY;
            const dist = Math.hypot(dx, dy);
            if (dist > 400 || dist < 10) continue;

            const enemyAngle = Math.atan2(dy, dx);
            let angleDiff = Math.abs(enemyAngle - angle);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

            if (angleDiff < 0.15) {
              hitEnemy = enemy;
              break;
            }
          }
        }

        if (hitWallPos) {
          player.darkGraspState.targetPos = hitWallPos;
          player.darkGraspState.dashTimer = 0.2;
        } else if (hitEnemy) {
          player.darkGraspState.targetEnemy = hitEnemy;
          player.darkGraspState.dashTimer = 0.2;
          player.darkGraspState.stunApplied = false;
          player.darkGraspState.killTimer = 1;
        } else {
          movement.darkGraspCooldown *= 0.5;
        }
      }

      if (player.darkGraspState.animTimer >= player.darkGraspState.animDuration) {
        if (!player.darkGraspState.targetEnemy && !player.darkGraspState.targetPos) {
          player.darkGraspState = null;
        } else {
          player.darkGraspState.casting = false;
        }
      }
      return;
    }

    player.darkGraspState.dashTimer -= dt;
    player.darkGraspState.killTimer -= dt;

    if (player.darkGraspState.dashTimer > 0) {
      if (player.darkGraspState.targetPos) {
        const dx = player.darkGraspState.targetPos.x - (player.x + player.w * 0.5);
        const dy = player.darkGraspState.targetPos.y - (player.y + player.h * 0.5);
        const dist = Math.hypot(dx, dy);
        if (dist > 5) {
          const speed = 1200 * dt;
          player.x += (dx / dist) * speed;
          player.y += (dy / dist) * speed;
        }
      } else if (player.darkGraspState.targetEnemy && !player.darkGraspState.targetEnemy.dead) {
        const targetCenter = centerOf(player.darkGraspState.targetEnemy);
        const dx = targetCenter.x - (player.x + player.w * 0.5);
        const dy = targetCenter.y - (player.y + player.h * 0.5);
        const dist = Math.hypot(dx, dy);
        if (dist > 5) {
          const speed = 1200 * dt;
          player.x += (dx / dist) * speed;
          player.y += (dy / dist) * speed;
        }
      }
    } else if (player.darkGraspState.dashTimer <= 0 && !player.darkGraspState.stunApplied) {
      if (player.darkGraspState.targetEnemy && !player.darkGraspState.targetEnemy.dead) {
        game.damageEnemy(player.darkGraspState.targetEnemy, skillAttackDamage, { source: "skill", isDirect: true });
        player.darkGraspState.targetEnemy.status.stunTimer = 1;
        player.darkGraspState.stunApplied = true;
      }
    }

    if (player.darkGraspState.targetEnemy?.dead && player.darkGraspState.killTimer > 0) {
      movement.darkGraspCooldown = 0;
      player.darkGraspState = null;
    } else if (player.darkGraspState.killTimer <= 0 || player.darkGraspState.dashTimer <= 0) {
      player.darkGraspState = null;
    }
  }

  player.isMoving = false;
  if (isEntityStunned(player)) {
    movement.sprintTimer = 0;
    movement.dashTimer = 0;
    movement.slideTimer = 0;
    movement.slideWindowTimer = 0;
    setMovementState(player, "walk");
    return;
  }

  const baseSpeed = getTotalMoveSpeed(game) * getEntitySlowMultiplier(player);

  if (movement.dashTimer > 0) {
    movement.dashTimer -= dt;
    rememberTreeSafePosition(player, movement, world);
    const dashDistance = heroDef.dash.speed * heroDef.dash.distanceMultiplier * dt;
    player.isMoving = tryMove(player, game, movement.dashDirection.x * dashDistance, movement.dashDirection.y * dashDistance, { ignoreTrees: true });
    if (movement.dashTimer <= 0) {
      finalizeTreeIgnoringMovement(player, movement, world);
      movement.lastDashDirection = { ...movement.dashDirection };
      movement.slideWindowTimer = heroDef.slide.postDashWindow;
      setMovementState(player, movement.sprintTimer > 0 ? "sprint" : "walk");
    }
    return;
  }

  if (movement.slideTimer > 0) {
    movement.slideTimer -= dt;
    rememberTreeSafePosition(player, movement, world);
    const slideDistance = baseSpeed * heroDef.slide.speedMultiplier * dt;
    player.isMoving = tryMove(player, game, movement.slideDirection.x * slideDistance, movement.slideDirection.y * slideDistance, { ignoreTrees: true });
    if (movement.slideTimer <= 0) {
      finalizeTreeIgnoringMovement(player, movement, world);
      setMovementState(player, movement.sprintTimer > 0 ? "sprint" : "walk");
    }
    return;
  }

  movement.sprintTimer = Math.max(0, movement.sprintTimer - dt);
  const actionMoveMult = game.combat.playerAction?.moveMultiplier ?? 1;
  const speed = baseSpeed * (movement.sprintTimer > 0 ? heroDef.sprintMultiplier : 1) * actionMoveMult;
  const dx = moveAxis.x * speed * dt;
  const dy = moveAxis.y * speed * dt;
  if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
    player.isMoving = tryMove(player, game, dx, dy);
  }
  setMovementState(player, movement.sprintTimer > 0 ? "sprint" : "walk");
}
