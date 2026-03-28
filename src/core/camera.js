import { clamp, lerp } from "./runtime-utils.js";

export class Camera {
  constructor(viewWidth, viewHeight) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.x = 0;
    this.y = 0;
  }

  snapTo(target, world) {
    const desiredX = target.x + target.w * 0.5 - this.viewWidth * 0.5;
    const desiredY = target.y + target.h * 0.5 - this.viewHeight * 0.5;
    this.x = clamp(desiredX, 0, Math.max(0, world.width - this.viewWidth));
    this.y = clamp(desiredY, 0, Math.max(0, world.height - this.viewHeight));
  }

  follow(target, world, dt) {
    const desiredX = clamp(target.x + target.w * 0.5 - this.viewWidth * 0.5, 0, Math.max(0, world.width - this.viewWidth));
    const desiredY = clamp(target.y + target.h * 0.5 - this.viewHeight * 0.5, 0, Math.max(0, world.height - this.viewHeight));
    const t = clamp(dt * 8, 0, 1);
    this.x = Math.round(lerp(this.x, desiredX, t));
    this.y = Math.round(lerp(this.y, desiredY, t));
  }
}
