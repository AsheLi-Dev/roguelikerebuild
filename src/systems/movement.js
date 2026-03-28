import { centerOf, clamp, normalize, rectsOverlap, toDirectionKey } from "../core/runtime-utils.js";

function tryMove(entity, world, dx, dy) {
  const nextX = clamp(entity.x + dx, 0, world.width - entity.w);
  const nextY = clamp(entity.y + dy, 0, world.height - entity.h);
  const testX = { x: nextX, y: entity.y, w: entity.w, h: entity.h };
  const testY = { x: entity.x, y: nextY, w: entity.w, h: entity.h };
  let moveX = nextX;
  let moveY = nextY;

  for (const wall of world.collisionRects) {
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
    slideWindowTimer: 0
  };
}

function updateDashCharges(player, heroDef, dt) {
  const movement = player.movement;
  if (movement.dashCharges >= heroDef.dash.charges) {
    movement.dashCooldown = 0;
    return;
  }
  movement.dashCooldown = Math.max(0, movement.dashCooldown - dt);
  if (movement.dashCooldown > 0) return;
  movement.dashCharges = Math.min(heroDef.dash.charges, movement.dashCharges + 1);
  if (movement.dashCharges < heroDef.dash.charges) movement.dashCooldown = heroDef.dash.recharge;
}

function consumeDashCharge(player, heroDef) {
  const movement = player.movement;
  if (movement.dashCharges <= 0) return false;
  movement.dashCharges -= 1;
  if (movement.dashCooldown <= 0) movement.dashCooldown = heroDef.dash.recharge;
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

function setMovementState(player, state) {
  player.movement.state = state;
}

export function updatePlayerMovement(game, dt) {
  const { player, heroDef, input, camera, world } = game;
  const movement = player.movement;
  const moveAxis = input.getMoveAxis();

  resolveFacing(game, input, camera);
  updateDashCharges(player, heroDef, dt);
  movement.slideWindowTimer = Math.max(0, movement.slideWindowTimer - dt);

  if (
    input.wasPressed("shift")
    && movement.sprintTimer <= 0
    && movement.dashTimer <= 0
    && movement.slideTimer <= 0
    && consumeDashCharge(player, heroDef)
  ) {
    movement.sprintTimer = heroDef.sprintDuration;
    setMovementState(player, "sprint");
  }

  if (!input.isHeld("shift")) {
    movement.sprintTimer = Math.max(0, Math.min(movement.sprintTimer, 0.15));
  }

  if (input.wasPressed(" ") && movement.slideTimer <= 0 && movement.dashTimer <= 0 && consumeDashCharge(player, heroDef)) {
    movement.dashTimer = heroDef.dash.duration;
    movement.dashDirection = directionFromInputOrAim(player, input, camera);
    setMovementState(player, "dash");
  }

  if (input.wasPressed("control")) {
    if (movement.state === "sprint") {
      movement.sprintTimer = 0;
      movement.slideTimer = heroDef.slide.duration;
      movement.slideDirection = directionFromInputOrAim(player, input, camera);
      setMovementState(player, "slide");
    } else if (movement.state === "dash") {
      movement.slideTimer = heroDef.slide.duration;
      movement.slideDirection = { ...movement.dashDirection };
      movement.dashTimer = 0;
      setMovementState(player, "slide");
    } else if (movement.slideWindowTimer > 0) {
      movement.slideTimer = heroDef.slide.duration;
      movement.slideDirection = { ...movement.lastDashDirection };
      setMovementState(player, "slide");
    }
  }

  player.isMoving = false;
  const baseSpeed = heroDef.moveSpeed;

  if (movement.dashTimer > 0) {
    movement.dashTimer -= dt;
    const dashDistance = heroDef.dash.speed * heroDef.dash.distanceMultiplier * dt;
    player.isMoving = tryMove(player, world, movement.dashDirection.x * dashDistance, movement.dashDirection.y * dashDistance);
    if (movement.dashTimer <= 0) {
      movement.lastDashDirection = { ...movement.dashDirection };
      movement.slideWindowTimer = heroDef.slide.postDashWindow;
      setMovementState(player, movement.sprintTimer > 0 ? "sprint" : "walk");
    }
    return;
  }

  if (movement.slideTimer > 0) {
    movement.slideTimer -= dt;
    const slideDistance = baseSpeed * heroDef.slide.speedMultiplier * dt;
    player.isMoving = tryMove(player, world, movement.slideDirection.x * slideDistance, movement.slideDirection.y * slideDistance);
    if (movement.slideTimer <= 0) setMovementState(player, movement.sprintTimer > 0 ? "sprint" : "walk");
    return;
  }

  movement.sprintTimer = Math.max(0, movement.sprintTimer - dt);
  const actionMoveMult = game.combat.playerAction?.moveMultiplier ?? 1;
  const speed = baseSpeed * (movement.sprintTimer > 0 ? heroDef.sprintMultiplier : 1) * actionMoveMult;
  const dx = moveAxis.x * speed * dt;
  const dy = moveAxis.y * speed * dt;
  if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
    player.isMoving = tryMove(player, world, dx, dy);
  }
  setMovementState(player, movement.sprintTimer > 0 ? "sprint" : "walk");
}
