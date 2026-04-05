import { normalize } from "./runtime-utils.js";

import { getCanvasDimensions } from "./runtime-utils.js";

export class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = {
      x: canvas.width * 0.5,
      y: canvas.height * 0.5,
      down: false,
      clicked: false,
      rightDown: false,
      rightClicked: false
    };

    this.handleKeyDown = (event) => {
      const key = String(event.key || "").toLowerCase();
      if (["w", "a", "s", "d", "c", "e", "f", "i", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "r", "escape"].includes(key)) {
        event.preventDefault();
      }
      if (!this.keys.has(key)) this.pressed.add(key);
      this.keys.add(key);
    };

    this.handleKeyUp = (event) => {
      this.keys.delete(String(event.key || "").toLowerCase());
    };

    this.handleMouseMove = (event) => {
      const rect = getCanvasDimensions(this.canvas);
      const scaleX = this.canvas.width / Math.max(1, rect.width);
      const scaleY = this.canvas.height / Math.max(1, rect.height);
      this.mouse.x = (event.clientX - rect.left) * scaleX;
      this.mouse.y = (event.clientY - rect.top) * scaleY;
    };

    this.handleMouseDown = (event) => {
      if (event.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      } else if (event.button === 2) {
        this.mouse.rightDown = true;
        this.mouse.rightClicked = true;
        event.preventDefault();
      } else {
        return;
      }
      this.canvas.focus();
    };

    this.handleMouseUp = (event) => {
      if (event.button === 0) {
        this.mouse.down = false;
      } else if (event.button === 2) {
        this.mouse.rightDown = false;
      }
    };

    this.handleContextMenu = (event) => {
      event.preventDefault();
    };

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    canvas.addEventListener("mousemove", this.handleMouseMove);
    canvas.addEventListener("mousedown", this.handleMouseDown);
    canvas.addEventListener("contextmenu", this.handleContextMenu);
    window.addEventListener("mouseup", this.handleMouseUp);
  }

  updateFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
    this.mouse.rightClicked = false;
  }

  wasPressed(key) {
    return this.pressed.has(key);
  }

  isHeld(key) {
    return this.keys.has(key);
  }

  getMoveAxis() {
    let x = 0;
    let y = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;
    return normalize(x, y, { x: 0, y: 0 });
  }

  getAimWorld(camera) {
    const viewWidth = camera?.viewWidth || this.canvas.width;
    const viewHeight = camera?.viewHeight || this.canvas.height;
    return {
      x: camera.x + (this.mouse.x / Math.max(1, this.canvas.width)) * viewWidth,
      y: camera.y + (this.mouse.y / Math.max(1, this.canvas.height)) * viewHeight
    };
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.canvas.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
    this.canvas.removeEventListener("contextmenu", this.handleContextMenu);
    window.removeEventListener("mouseup", this.handleMouseUp);
  }
}
