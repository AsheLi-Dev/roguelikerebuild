import { centerOf, clamp, normalize, playThrottledAudio, rectsOverlap, toDirectionKey } from "../core/runtime-utils.js";
import { getBlockingBreakableRects } from "./breakables.js";
import { enemyCanBeDisplaced } from "./enemy-displacement.js";
import { enemyHasPlates, spawnDamagePopup } from "./combat.js";
import { onFingerSlideStart } from "./fingers.js";
import { getMaxDashCharges, getSprintSpeedMultiplier, getTotalMoveSpeed, onRingDashUsed } from "./rings.js";
import { applyStatusPayload, getEntitySlowMultiplier, isEntityStunned } from "./status-manager.js";
import { getPlayerSkillAttackDamage } from "./player-stats.js";

const BASE_DASH_SPEED = 400;
const DASH_MOVE_SPEED_RATIO = 0.3;
const SLIDE_SFX_PLAYBACK_RATE = 2.5;
const SLIDE_SFX_PLAYBACK_RATE_VARIANCE = 0.12;
const SLIDE_SFX_VOLUME_VARIANCE = 0.14;
const SLIDE_SFX_PLAYBACK_RATE_PROFILES = Object.freeze([1.8, 2.15, 2.5, 2.85, 3.2]);
const SLIDE_SFX_VOLUME_PROFILES = Object.freeze([0.72, 0.88, 1, 1.14]);
const FOOTSTEP_SFX_PLAYBACK_RATE_VARIANCE = 0.08;
const FOOTSTEP_SFX_VOLUME_VARIANCE = 0.08;
const FOOTSTEP_FRAME_AUDIO_KEYS = Object.freeze({
  4: Object.freeze(["footstepStep1Sfx", "footstepStep2Sfx", "footstepStep3Sfx"]),
  11: Object.freeze(["footstepStep4Sfx", "footstepStep5Sfx", "footstepStep6Sfx"])
});

function playAudioClone(audio, options = {}) {
  return playThrottledAudio(audio, options);
}

function stopSlideAudio(game) {
  const activeSlideSfx = game.activeSlideSfx;
  if (!activeSlideSfx) return;
  activeSlideSfx.pause();
  activeSlideSfx.currentTime = 0;
  game.activeSlideSfx = null;
}

function randomRange(min = 0, max = 1) {
  return min + Math.random() * Math.max(0, max - min);
}

function pickRandom(items = []) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] || null;
}

function resetFootstepTracking(player) {
  if (!player?.movement) return;
  player.movement.footstepStateKey = null;
  player.movement.footstepFrame = null;
}

function didFrameTrigger(prevFrame, frame, targetFrame, totalFrames) {
  if (!Number.isFinite(prevFrame) || !Number.isFinite(frame) || totalFrames <= 1 || prevFrame === frame) return false;
  if (prevFrame < frame) return targetFrame > prevFrame && targetFrame <= frame;
  return targetFrame > prevFrame || targetFrame <= frame;
}

function playFootstepForFrame(game, frame) {
  const assetKeys = FOOTSTEP_FRAME_AUDIO_KEYS[frame];
  const assetKey = pickRandom(assetKeys);
  const footstepSfx = assetKey ? game.assets?.[assetKey] : null;
  if (!footstepSfx) return;
  playAudioClone(footstepSfx, {
    volume: Math.min(1, (footstepSfx.volume || 0.18) * randomRange(1 - FOOTSTEP_SFX_VOLUME_VARIANCE, 1 + FOOTSTEP_SFX_VOLUME_VARIANCE)),
    playbackRate: randomRange(1 - FOOTSTEP_SFX_PLAYBACK_RATE_VARIANCE, 1 + FOOTSTEP_SFX_PLAYBACK_RATE_VARIANCE)
  });
}

function updatePlayerFootsteps(game) {
  const { player, heroDef } = game;
  const movementState = player?.movement;
  if (!movementState || !player.isMoving) {
    resetFootstepTracking(player);
    return;
  }

  const stateKey = movementState.state === "sprint" ? "run" : "walk";
  const stateDef = heroDef?.sprite?.states?.[stateKey];
  const totalFrames = Math.max(1, stateDef?.frames || 1);
  if (!stateDef?.loop || totalFrames <= 1) {
    resetFootstepTracking(player);
    return;
  }

  const frame = Math.floor(Math.max(0, player.animClock) * Math.max(1, stateDef.fps || 1)) % totalFrames;
  const prevStateKey = movementState.footstepStateKey;
  const prevFrame = movementState.footstepFrame;
  movementState.footstepStateKey = stateKey;
  movementState.footstepFrame = frame;

  if (prevStateKey !== stateKey || !Number.isFinite(prevFrame)) return;
  if (didFrameTrigger(prevFrame, frame, 4, totalFrames)) playFootstepForFrame(game, 4);
  if (didFrameTrigger(prevFrame, frame, 11, totalFrames)) playFootstepForFrame(game, 11);
}

function getLocomotionAnimationSpeedScale(game) {
  const { player } = game;
  if (!player?.isMoving) return 1;

  const movementState = player.movement;
  const actionMoveMult = game.combat.playerAction?.moveMultiplier ?? 1;
  const drinkMoveMult = player.drinkTimer > 0 ? 0.2 : 1;
  const sprintMult = movementState?.sprintTimer > 0
    ? game.heroDef.sprintMultiplier * getSprintSpeedMultiplier(game)
    : 1;
  const currentMoveSpeed = getTotalMoveSpeed(game)
    * getEntitySlowMultiplier(player)
    * sprintMult
    * actionMoveMult
    * drinkMoveMult;
  const baseline = movementState?.state === "sprint" ? 120 : 100;
  return Math.max(0.0001, Math.min(1.6, currentMoveSpeed / baseline));
}

export function updatePlayerAnimation(game, dt) {
  const state = game.combat.playerAction?.animationKey
    ? "action"
    : game.player.windFlipState?.active
      ? "frontFlip"
      : game.player.hitTimer > 0
        ? "hit"
        : game.player.movement.slideTimer > 0
          ? "slide"
          : game.player.movement.dashTimer > 0
            ? "dash"
            : game.player.isMoving
              ? (game.player.movement.state === "sprint" ? "run" : "walk")
              : "idle";

  if (state === "walk" || state === "run") {
    game.player.animClock += dt * getLocomotionAnimationSpeedScale(game);
  } else {
    game.player.animClock += dt;
  }

  updatePlayerFootsteps(game);
}

function startSlideAudio(game) {
  stopSlideAudio(game);
  const slideSfx = game.assets?.slideSfx;
  if (!slideSfx) {
    game.activeSlideSfx = null;
    return;
  }
  const playbackRateProfile = pickRandom(SLIDE_SFX_PLAYBACK_RATE_PROFILES) || SLIDE_SFX_PLAYBACK_RATE;
  const volumeProfile = pickRandom(SLIDE_SFX_VOLUME_PROFILES) || 1;
  game.activeSlideSfx = playAudioClone(slideSfx, {
    volume: Math.min(
      1,
      (slideSfx.volume || 0.22)
        * volumeProfile
        * randomRange(1 - SLIDE_SFX_VOLUME_VARIANCE, 1 + SLIDE_SFX_VOLUME_VARIANCE)
    ),
    playbackRate: randomRange(
      playbackRateProfile - SLIDE_SFX_PLAYBACK_RATE_VARIANCE,
      playbackRateProfile + SLIDE_SFX_PLAYBACK_RATE_VARIANCE
    )
  }) || null;
}

function tryMove(entity, game, dx, dy, options = {}) {
  const world = game.world;
  const nextX = clamp(entity.x + dx, 0, world.width - entity.w);
  const nextY = clamp(entity.y + dy, 0, world.height - entity.h);
  const currentRect = { x: entity.x, y: entity.y, w: entity.w, h: entity.h };
  const testX = { x: nextX, y: entity.y, w: entity.w, h: entity.h };
  const testY = { x: entity.x, y: nextY, w: entity.w, h: entity.h };
  let moveX = nextX;
  let moveY = nextY;
  const ignoreTrees = !!options.ignoreTrees;
  const ignoreEnemies = !!options.ignoreEnemies;
  const blockers = game.getCollisionBlockers
    ? game.getCollisionBlockers({ includeBreakables: true, ignoreTrees })
    : [
        ...world.collisionRects.filter((wall) => !(ignoreTrees && (world.treeCollisionRects || []).includes(wall))),
        ...getBlockingBreakableRects(game)
      ];

  for (const wall of blockers) {
    if (rectsOverlap(testX, wall)) moveX = entity.x;
    if (rectsOverlap(testY, wall)) moveY = entity.y;
  }

  if (!ignoreEnemies) {
    for (const enemy of game.getLivingEnemies?.() || game.enemies || []) {
      if (!enemy || enemy.dead || enemy === entity) continue;
      const currentlyOverlapping = rectsOverlap(currentRect, enemy);
      if (!currentlyOverlapping && rectsOverlap(testX, enemy)) moveX = entity.x;
      if (!currentlyOverlapping && rectsOverlap(testY, enemy)) moveY = entity.y;
    }
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
    sprintEndStaggerTimer: 0,
    dashTimer: 0,
    dashAfterimageTimer: 0,
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
    windFlipCooldown: 0,
    footstepStateKey: null,
    footstepFrame: null
  };
}

function getDashAfterimageConfig(heroDef) {
  return heroDef?.dash?.afterimage || null;
}

function getDashVfxConfig(heroDef) {
  return heroDef?.dash?.vfx || null;
}

function getDashAnimationStateKey(player) {
  if (player.movement?.sprintTimer > 0) return "run";
  if (player.isMoving) return "walk";
  return "idle";
}

function captureDashVisualSnapshot(player) {
  player.dashVisualSnapshot = {
    stateKey: getDashAnimationStateKey(player),
    animClock: player.animClock
  };
}

function spawnDashAfterimage(game, player, heroDef) {
  const config = getDashAfterimageConfig(heroDef);
  if (!config) return;
  const movement = player.movement;
  const snapshot = player.dashVisualSnapshot || {
    stateKey: getDashAnimationStateKey(player),
    animClock: player.animClock
  };
  player.dashAfterimages ??= [];
  player.dashAfterimages.push({
    x: player.x,
    y: player.y,
    facing: player.facing,
    stateKey: snapshot.stateKey,
    animClock: snapshot.animClock,
    elapsed: 0,
    duration: Math.max(0.01, config.duration ?? 0.22),
    alpha: Math.max(0, config.alpha ?? 0.3),
    tint: config.tint || null,
    stretch: Math.max(0, config.stretch ?? 0)
  });
  if (player.dashAfterimages.length > 18) {
    player.dashAfterimages.splice(0, player.dashAfterimages.length - 18);
  }
  movement.dashAfterimageTimer = Math.max(0.001, config.interval ?? 0.03);
}

function updateDashAfterimages(game, player, heroDef, dt) {
  player.dashAfterimages = (player.dashAfterimages || []).filter((afterimage) => {
    afterimage.elapsed += dt;
    return afterimage.elapsed < afterimage.duration;
  });

  const config = getDashAfterimageConfig(heroDef);
  if (!config) return;
  const movement = player.movement;
  if (movement.dashTimer <= 0) {
    movement.dashAfterimageTimer = 0;
    return;
  }

  movement.dashAfterimageTimer = (movement.dashAfterimageTimer || 0) - dt;
  while (movement.dashAfterimageTimer <= 0) {
    spawnDashAfterimage(game, player, heroDef);
  }
}

function startDashFlash(player, heroDef, kind) {
  const config = getDashVfxConfig(heroDef);
  if (!config) return;
  player.dashFlash = {
    kind,
    elapsed: 0,
    duration: kind === "start" ? 0.12 : 0.14,
    color: config.flashColor || "rgba(255,255,255,0.85)",
    accentColor: config.flashAccentColor || "rgba(255,255,255,0.95)"
  };
}

function updateDashFlash(player, dt) {
  if (!player.dashFlash) return;
  player.dashFlash.elapsed += dt;
  if (player.dashFlash.elapsed >= player.dashFlash.duration) {
    player.dashFlash = null;
  }
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
  if (movement.sprintTimer > 0 || movement.dashTimer > 0 || movement.slideTimer > 0) {
    return;
  }
  // Prevent restoration while channeling
  if (game.combat.playerAction?.kind === "soulSiphonChannel") {
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

function getDashMoveSpeed(game) {
  // Dash speed intentionally ignores slows and scales from the live move-speed stat.
  return BASE_DASH_SPEED + getTotalMoveSpeed(game) * DASH_MOVE_SPEED_RATIO;
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

function clearSprint(player, options = {}) {
  const movement = player.movement;
  const applyStagger = options.applyStagger !== false;
  const hadSprint = movement.sprintTimer > 0 || movement.state === "sprint";
  movement.sprintTimer = 0;
  if (hadSprint && applyStagger) {
    movement.sprintEndStaggerTimer = Math.max(movement.sprintEndStaggerTimer || 0, 0.05);
  }
  if (movement.state === "sprint") {
    setMovementState(player, "walk");
  }
}

function isDashLockedByAttack(game) {
  const action = game.combat.playerAction;
  if (action?.kind !== "attack") return false;
  const duration = Math.max(0.001, action.duration || 0);
  return action.elapsed < duration * 0.5;
}

function cancelDashAndSlideMomentum(game, options = {}) {
  const { player, world } = game;
  const movement = player.movement;
  const preserveSlide = !!options.preserveSlide;
  const wasDashing = movement.dashTimer > 0;
  const wasSliding = !preserveSlide && movement.slideTimer > 0;
  if (!wasDashing && !wasSliding) return;
  if (wasDashing || wasSliding) {
    finalizeTreeIgnoringMovement(player, movement, world);
  }
  movement.dashTimer = 0;
  if (!preserveSlide) {
    movement.slideTimer = 0;
    movement.slideWindowTimer = 0;
    stopSlideAudio(game);
  }
  setMovementState(player, movement.sprintTimer > 0 ? "sprint" : "walk");
  player.isMoving = false;
}

function cancelLifePotion(player) {
  player.lifePotionConsumeTimer = 0;
  if (player.movement.state === "drink") {
    setMovementState(player, "walk");
  }
}

export function updatePlayerMovement(game, dt) {
  const { player, heroDef, input, camera, world } = game;
  const movement = player.movement;
  const moveAxis = input.getMoveAxis();
  const skillAttackDamage = getPlayerSkillAttackDamage(player);
  game.cancelDashAndSlideMomentum = (options) => cancelDashAndSlideMomentum(game, options);
  player.dashAfterimages ??= [];

  resolveFacing(game, input, camera);
  updateDashCharges(game, player, heroDef, dt);
  updateWindFlipCharges(player, heroDef, dt);
  movement.slideWindowTimer = Math.max(0, movement.slideWindowTimer - dt);
  movement.sprintEndStaggerTimer = Math.max(0, movement.sprintEndStaggerTimer - dt);
  movement.spiritCooldown = Math.max(0, movement.spiritCooldown - dt);
  movement.darkGraspCooldown = Math.max(0, movement.darkGraspCooldown - dt);
  movement.lightningDashCooldown = Math.max(0, movement.lightningDashCooldown - dt);
  movement.knightChargeCooldown = Math.max(0, movement.knightChargeCooldown - dt);
  updateDashFlash(player, dt);

  const lifePotionReady = (player.lifePotionCharges || 0) > 0 && player.hp < player.maxHp;
  const canDrinkPotion = !player.spiritMode?.active && !player.darkGraspState && !player.lightningDashState && !player.knightChargeState?.active && !player.windFlipState?.active;
  let isDrinkingPotion = false;
  if (input.isHeld("r") && lifePotionReady && canDrinkPotion && !isEntityStunned(player)) {
    clearSprint(player, { applyStagger: false });
    cancelDashAndSlideMomentum(game);
    player.lifePotionConsumeTimer = Math.min(player.lifePotionConsumeDuration, (player.lifePotionConsumeTimer || 0) + dt);
    setMovementState(player, "drink");
    isDrinkingPotion = true;
    if (player.lifePotionConsumeTimer >= player.lifePotionConsumeDuration) {
      player.lifePotionConsumeTimer = 0;
      player.lifePotionCharges = Math.max(0, (player.lifePotionCharges || 0) - 1);
      player.hp = Math.min(player.maxHp, game.player.hp + game.player.maxHp * game.player.lifePotionHealRatio);
      playAudioClone(game.assets?.drinkPotionSfx);
      setMovementState(player, "walk");
      isDrinkingPotion = false;
    }
  }
  if (!isDrinkingPotion && (player.lifePotionConsumeTimer || 0) > 0) {
    cancelLifePotion(player);
  }

  if (
    input.wasPressed("shift")
    && movement.dashTimer <= 0
    && movement.slideTimer <= 0
  ) {
    if (movement.sprintTimer > 0) {
      clearSprint(player);
    } else if (consumeDashCharge(game, player, heroDef)) {
      movement.sprintEndStaggerTimer = 0;
      movement.sprintTimer = heroDef.sprintDuration;
      setMovementState(player, "sprint");
    }
  }

  if (input.wasPressed(" ") && movement.slideTimer <= 0 && movement.dashTimer <= 0 && !isDashLockedByAttack(game) && consumeDashCharge(game, player, heroDef)) {
    clearSprint(player, { applyStagger: false });
    movement.dashTimer = heroDef.dash.duration;
    movement.dashAfterimageTimer = 0;
    movement.dashDirection = directionFromInputOrAim(player, input, camera);
    movement.lastTreeSafePosition = { x: player.x, y: player.y };
    captureDashVisualSnapshot(player);
    setMovementState(player, "dash");
    startDashFlash(player, heroDef, "start");
    playAudioClone(game.assets?.dashSfx);

    // Slide Tutorial Reminder
    if (!game.hasShownSlideTutorial) {
      spawnDamagePopup(game, player.x + player.w * 0.5, player.y - 40, "Press Ctrl after Dash to Slide", {
        color: "#38bdf8",
        strokeColor: "#082f49",
        duration: 10,
        riseSpeed: 12,
        scale: 1.1
      });
      game.hasShownSlideTutorial = true;
    }
  }

  if (input.wasPressed("control")) {
    if (movement.state === "sprint") {
      clearSprint(player, { applyStagger: false });
      movement.slideTimer = heroDef.slide.duration;
      movement.slideDirection = directionFromInputOrAim(player, input, camera);
      movement.lastTreeSafePosition = { x: player.x, y: player.y };
      setMovementState(player, "slide");
      startSlideAudio(game);
      onFingerSlideStart(game);
    } else if (movement.state === "dash") {
      movement.slideTimer = heroDef.slide.duration;
      movement.slideDirection = { ...movement.dashDirection };
      movement.dashTimer = 0;
      if (!movement.lastTreeSafePosition) movement.lastTreeSafePosition = { x: player.x, y: player.y };
      setMovementState(player, "slide");
      startSlideAudio(game);
      onFingerSlideStart(game);
    } else if (movement.slideWindowTimer > 0) {
      movement.slideTimer = heroDef.slide.duration;
      movement.slideDirection = { ...movement.lastDashDirection };
      movement.lastTreeSafePosition = { x: player.x, y: player.y };
      setMovementState(player, "slide");
      startSlideAudio(game);
      onFingerSlideStart(game);
    }
  }

  if (input.wasPressed("f") && !player.spiritMode && movement.spiritCooldown <= 0 && heroDef.id === "dark_mage") {
    player.spiritMode = {
      active: true,
      duration: 1,
      timer: 1,
      spiritX: player.x,
      spiritY: player.y,
      playerStartX: player.x,
      playerStartY: player.y,
      hitEnemies: new Set()
    };
    movement.spiritCooldown = 7;
  }

  if (input.wasPressed("f") && !player.darkGraspState && movement.darkGraspCooldown <= 0 && heroDef.id === "death_knight") {
    const center = centerOf(player);
    const mouseWorld = input.getAimWorld(camera);
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

  if (input.wasPressed("f") && !player.lightningDashState && movement.lightningDashCooldown <= 0 && heroDef.id === "element_mage") {
    const center = centerOf(player);
    const mouseWorld = input.getAimWorld(camera);
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

  if (input.wasPressed("f") && !player.knightChargeState && movement.knightChargeCooldown <= 0 && heroDef.id === "knight") {
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

  if (input.wasPressed("f") && !player.windFlipState && heroDef.id === "wind_archer" && consumeWindFlipCharge(player, heroDef)) {
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
    resetFootstepTracking(player);
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
      
      const dashCurseMod = game.heroModState?.necro_spirit_dash_curse;
      
      for (const enemy of game.enemies) {
        if (enemy.dead) continue;
        if (!rectsOverlap(spiritRect, enemy)) continue;
        
        // Base spirit form effect: 50% slow
        applyStatusPayload(enemy, { slowDuration: 2, slowMult: 0.5 });

        // Hero Mod effect: Spirit Dash Curse
        if (dashCurseMod?.active && !player.spiritMode.hitEnemies.has(enemy.id)) {
          player.spiritMode.hitEnemies.add(enemy.id);
          applyStatusPayload(enemy, {
            slowDuration: dashCurseMod.slowDuration || 2.0,
            slowMult: dashCurseMod.slowMultiplier || 0.3,
            curseDuration: 2.0 // Existing curse behavior
          });
        }
      }
      return;
    }
  }

  if (player.lightningDashState) {
    resetFootstepTracking(player);
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
    resetFootstepTracking(player);
    const charge = player.knightChargeState;
    charge.elapsed += dt;
    updateHitCooldownMap(charge.hitEnemyCooldowns, dt);

    const ramp = clamp(charge.elapsed / 1, 0, 1);
    const chargeSpeed = getTotalMoveSpeed(game) * getEntitySlowMultiplier(player) * (1 + ramp);
    const moved = tryMove(player, game, charge.dirX * chargeSpeed * dt, charge.dirY * chargeSpeed * dt, {
      ignoreTrees: true,
      ignoreEnemies: true
    });
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
      if (enemyHasPlates(enemy)) continue;
      if (!enemyCanBeDisplaced(enemy)) continue;
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
    resetFootstepTracking(player);
    const flip = player.windFlipState;
    flip.elapsed += dt;
    player.facing = toDirectionKey(flip.dirX, flip.dirY, player.facing);
    const flipSpeed = getTotalMoveSpeed(game) * getEntitySlowMultiplier(player) * 2;
    player.isMoving = tryMove(player, game, flip.dirX * flipSpeed * dt, flip.dirY * flipSpeed * dt, {
      ignoreTrees: true,
      ignoreEnemies: true
    });

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
    resetFootstepTracking(player);
    const mod = game.heroModState?.dk_grasp_of_the_legion;
    
    if (player.darkGraspState.casting) {
      player.darkGraspState.animTimer += dt;
      const currentFrame = Math.floor((player.darkGraspState.animTimer / player.darkGraspState.animDuration) * 4);

      if (currentFrame >= 1 && !player.darkGraspState.hitSpawned) {
        player.darkGraspState.hitSpawned = true;
        
        const chainCount = mod?.active ? (mod.totalChains || 3) : 1;
        const baseAngle = Math.atan2(player.darkGraspState.dirY, player.darkGraspState.dirX);
        const spread = (chainCount > 1) ? Math.PI / 6 : 0; // 30 degree spread
        
        player.darkGraspState.chains = [];

        for (let i = 0; i < chainCount; i++) {
          const angleOffset = (chainCount > 1) ? (i - (chainCount - 1) / 2) * spread : 0;
          const chainAngle = baseAngle + angleOffset;
          const dirX = Math.cos(chainAngle);
          const dirY = Math.sin(chainAngle);
          
          let hitEnemy = null;
          let hitWallPos = null;

          const step = 10;
          for (let dist = 10; dist <= 400; dist += step) {
            const checkX = player.darkGraspState.originX + dirX * dist;
            const checkY = player.darkGraspState.originY + dirY * dist;
            const testRect = { x: checkX - player.w / 2, y: checkY - player.h / 2, w: player.w, h: player.h };

            for (const wall of game.world.collisionRects) {
              if (rectsOverlap(testRect, wall)) {
                hitWallPos = { x: checkX - dirX * step, y: checkY - dirY * step };
                break;
              }
            }
            if (hitWallPos) break;
          }

          if (!hitWallPos) {
            for (const enemy of game.enemies) {
              if (enemy.dead || enemy.isBeingPulled) continue;
              const enemyCenter = centerOf(enemy);
              const dx = enemyCenter.x - player.darkGraspState.originX;
              const dy = enemyCenter.y - player.darkGraspState.originY;
              const dist = Math.hypot(dx, dy);
              if (dist > 400 || dist < 10) continue;

              const enemyAngle = Math.atan2(dy, dx);
              let angleDiff = Math.abs(enemyAngle - chainAngle);
              if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

              if (angleDiff < 0.15) {
                hitEnemy = enemy;
                enemy.isBeingPulled = true; // Temporary flag to prefer different targets
                break;
              }
            }
          }

          // Always add to chains array for rendering, even if it didn't hit
          player.darkGraspState.chains.push({
            targetEnemy: hitEnemy,
            targetPos: hitWallPos,
            dirX,
            dirY,
            angle: chainAngle
          });
        }

        // Cleanup temp flags
        game.enemies.forEach(e => delete e.isBeingPulled);

        if (player.darkGraspState.chains.some(c => c.targetEnemy || c.targetPos)) {
          player.darkGraspState.dashTimer = 0.2;
          player.darkGraspState.stunApplied = false;
          player.darkGraspState.killTimer = 1;
        } else {
          movement.darkGraspCooldown *= 0.5;
        }
      }

      if (player.darkGraspState.animTimer >= player.darkGraspState.animDuration) {
        if (!player.darkGraspState.chains || player.darkGraspState.chains.length === 0) {
          player.darkGraspState = null;
        } else {
          player.darkGraspState.casting = false;
        }
      }
      return;
    }

    player.darkGraspState.dashTimer -= dt;
    player.darkGraspState.killTimer -= dt;

    let movePlayerTo = null;

    for (const chain of player.darkGraspState.chains) {
      if (chain.targetPos) {
        movePlayerTo = chain.targetPos;
      } else if (chain.targetEnemy && !chain.targetEnemy.dead) {
        if (mod?.active) {
          // Pull enemy to player
          const playerCenter = centerOf(player);
          const enemyCenter = centerOf(chain.targetEnemy);
          const dx = playerCenter.x - enemyCenter.x;
          const dy = playerCenter.y - enemyCenter.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 15) {
            const pullSpeed = 1400 * dt;
            const moveX = (dx / dist) * pullSpeed;
            const moveY = (dy / dist) * pullSpeed;
            chain.targetEnemy.x += moveX;
            chain.targetEnemy.y += moveY;
          }
        } else {
          // Normal behavior: Pull player to enemy
          movePlayerTo = centerOf(chain.targetEnemy);
        }
      }
    }

    if (movePlayerTo && player.darkGraspState.dashTimer > 0) {
      const playerPos = { x: player.x + player.w * 0.5, y: player.y + player.h * 0.5 };
      const dx = movePlayerTo.x - playerPos.x;
      const dy = movePlayerTo.y - playerPos.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        const speed = 1200 * dt;
        player.x += (dx / dist) * speed;
        player.y += (dy / dist) * speed;
      }
    }

    if (player.darkGraspState.dashTimer <= 0 && !player.darkGraspState.stunApplied) {
      player.darkGraspState.stunApplied = true;
      for (const chain of player.darkGraspState.chains) {
        if (chain.targetEnemy && !chain.targetEnemy.dead) {
          const hit = game.damageEnemy(chain.targetEnemy, skillAttackDamage, { source: "skill", isDirect: true });
          if (hit.hit) {
            chain.targetEnemy.status.stunTimer = 1;
            if (mod?.active) {
              applyStatusPayload(chain.targetEnemy, {
                slowDuration: mod.slowDuration || 1.5,
                slowMult: mod.slowMultiplier || 0.7
              });
            }
          }
        }
      }
    }

    const anyEnemyDied = player.darkGraspState.chains.some(c => c.targetEnemy?.dead);
    if (anyEnemyDied && player.darkGraspState.killTimer > 0) {
      movement.darkGraspCooldown = 0;
      player.darkGraspState = null;
    } else if (player.darkGraspState.killTimer <= 0 || player.darkGraspState.dashTimer <= 0) {
      player.darkGraspState = null;
    }
  }

  player.isMoving = false;
  if (isEntityStunned(player)) {
    resetFootstepTracking(player);
    movement.sprintTimer = 0;
    movement.sprintEndStaggerTimer = 0;
    movement.dashTimer = 0;
    movement.slideTimer = 0;
    movement.slideWindowTimer = 0;
    stopSlideAudio(game);
    setMovementState(player, "walk");
    return;
  }

  const baseSpeed = getTotalMoveSpeed(game) * getEntitySlowMultiplier(player);

  if (movement.dashTimer > 0) {
    resetFootstepTracking(player);
    movement.dashTimer -= dt;
    rememberTreeSafePosition(player, movement, world);
    const dashDistance = getDashMoveSpeed(game) * dt;
    player.isMoving = tryMove(player, game, movement.dashDirection.x * dashDistance, movement.dashDirection.y * dashDistance, {
      ignoreTrees: true,
      ignoreEnemies: true
    });
    updateDashAfterimages(game, player, heroDef, dt);
    if (movement.dashTimer <= 0) {
      finalizeTreeIgnoringMovement(player, movement, world);
      movement.lastDashDirection = { ...movement.dashDirection };
      movement.slideWindowTimer = heroDef.slide.postDashWindow;
      player.dashVisualSnapshot = null;
      startDashFlash(player, heroDef, "end");
      setMovementState(player, movement.sprintTimer > 0 ? "sprint" : "walk");
    }
    return;
  }

  if (movement.slideTimer > 0) {
    resetFootstepTracking(player);
    updateDashAfterimages(game, player, heroDef, dt);
    rememberTreeSafePosition(player, movement, world);
    const slideDuration = Math.max(0.001, heroDef.slide.duration || 0);
    const slideProgress = clamp(1 - movement.slideTimer / slideDuration, 0, 1);
    const slideSpeedMultiplier = 2 - slideProgress;
    const slideDistance = baseSpeed * slideSpeedMultiplier * dt;
    player.isMoving = tryMove(player, game, movement.slideDirection.x * slideDistance, movement.slideDirection.y * slideDistance, {
      ignoreTrees: true,
      ignoreEnemies: true
    });
    movement.slideTimer -= dt;
    if (movement.slideTimer <= 0) {
      finalizeTreeIgnoringMovement(player, movement, world);
      stopSlideAudio(game);
      setMovementState(player, movement.sprintTimer > 0 ? "sprint" : "walk");
    }
    return;
  }

  if (movement.sprintEndStaggerTimer > 0) {
    resetFootstepTracking(player);
    updateDashAfterimages(game, player, heroDef, dt);
    setMovementState(player, "walk");
    return;
  }

  const hadSprint = movement.sprintTimer > 0;
  movement.sprintTimer = Math.max(0, movement.sprintTimer - dt);
  if (hadSprint && movement.sprintTimer <= 0) {
    resetFootstepTracking(player);
    updateDashAfterimages(game, player, heroDef, dt);
    clearSprint(player);
    setMovementState(player, "walk");
    return;
  }
  const actionMoveMult = game.combat.playerAction?.moveMultiplier ?? 1;
  const drinkMoveMult = isDrinkingPotion ? 0.2 : 1;
  const sprintMult = movement.sprintTimer > 0 ? heroDef.sprintMultiplier * getSprintSpeedMultiplier(game) : 1;
  const speed = baseSpeed * sprintMult * actionMoveMult * drinkMoveMult;
  const dx = moveAxis.x * speed * dt;
  const dy = moveAxis.y * speed * dt;
  if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
    player.isMoving = tryMove(player, game, dx, dy);
  }
  updateDashAfterimages(game, player, heroDef, dt);
  setMovementState(player, isDrinkingPotion ? "drink" : (movement.sprintTimer > 0 ? "sprint" : "walk"));
}
