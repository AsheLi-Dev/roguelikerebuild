import { centerOf, clamp, normalize, rectsOverlap, toDirectionKey } from "../core/runtime-utils.js";
import { getBlockingBreakableRects } from "./breakables.js";
import { getMaxDashCharges, getTotalMoveSpeed, onRingDashUsed } from "./rings.js";
import { getEntitySlowMultiplier, isEntityStunned } from "./status-manager.js";

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
    lastTreeSafePosition: null
  };
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
  updateDashCharges(game, player, heroDef, dt);
  movement.slideWindowTimer = Math.max(0, movement.slideWindowTimer - dt);

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
