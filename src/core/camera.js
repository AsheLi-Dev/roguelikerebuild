import { clamp } from "./runtime-utils.js";

const FOLLOW_LERP_PER_SECOND = 8;
const FOLLOW_SNAP_EPSILON = 0.01;

function getAxisBounds(worldSize, viewSize) {
  if (worldSize <= viewSize) {
    const offset = (worldSize - viewSize) * 0.5;
    return { min: offset, max: offset };
  }
  return { min: 0, max: worldSize - viewSize };
}

export class Camera {
  constructor(viewWidth, viewHeight) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.x = 0;
    this.y = 0;
    this.smoothX = 0;
    this.smoothY = 0;
    this.renderScale = 1;
    this.shakeTimer = 0;
    this.shakeDuration = 0;
    this.shakeMagnitude = 0;
  }

  snapTo(target, world) {
    const desiredX = target.x + target.w * 0.5 - this.viewWidth * 0.5;
    const desiredY = target.y + target.h * 0.5 - this.viewHeight * 0.5;
    const xBounds = getAxisBounds(world.width, this.viewWidth);
    const yBounds = getAxisBounds(world.height, this.viewHeight);
    this.smoothX = clamp(desiredX, xBounds.min, xBounds.max);
    this.smoothY = clamp(desiredY, yBounds.min, yBounds.max);
    this.applyShake(world, 0);
  }

  follow(target, world, dt) {
    const xBounds = getAxisBounds(world.width, this.viewWidth);
    const yBounds = getAxisBounds(world.height, this.viewHeight);
    const desiredX = clamp(target.x + target.w * 0.5 - this.viewWidth * 0.5, xBounds.min, xBounds.max);
    const desiredY = clamp(target.y + target.h * 0.5 - this.viewHeight * 0.5, yBounds.min, yBounds.max);
    const t = 1 - Math.exp(-FOLLOW_LERP_PER_SECOND * Math.max(0, dt));
    this.smoothX += (desiredX - this.smoothX) * t;
    this.smoothY += (desiredY - this.smoothY) * t;
    if (Math.abs(desiredX - this.smoothX) <= FOLLOW_SNAP_EPSILON) this.smoothX = desiredX;
    if (Math.abs(desiredY - this.smoothY) <= FOLLOW_SNAP_EPSILON) this.smoothY = desiredY;
    this.applyShake(world, dt);
  }

  triggerShake(magnitude = 8, duration = 0.22) {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  applyShake(world, dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - Math.max(0, dt));
    }
    const xBounds = getAxisBounds(world.width, this.viewWidth);
    const yBounds = getAxisBounds(world.height, this.viewHeight);
    const baseX = clamp(this.smoothX, xBounds.min, xBounds.max);
    const baseY = clamp(this.smoothY, yBounds.min, yBounds.max);
    if (this.shakeTimer <= 0 || this.shakeDuration <= 0 || this.shakeMagnitude <= 0) {
      this.x = Math.round(baseX);
      this.y = Math.round(baseY);
      if (this.shakeTimer <= 0) {
        this.shakeDuration = 0;
        this.shakeMagnitude = 0;
      }
      return;
    }
    const progress = this.shakeTimer / this.shakeDuration;
    const amplitude = this.shakeMagnitude * progress;
    const offsetX = (Math.random() * 2 - 1) * amplitude;
    const offsetY = (Math.random() * 2 - 1) * amplitude;
    this.x = Math.round(clamp(baseX + offsetX, xBounds.min, xBounds.max));
    this.y = Math.round(clamp(baseY + offsetY, yBounds.min, yBounds.max));
  }
}
