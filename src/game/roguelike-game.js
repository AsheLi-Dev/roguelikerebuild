import { loadAssetPack } from "../core/assets.js";
import { Camera } from "../core/camera.js";
import { InputController } from "../core/input.js";
import { DEFAULT_HERO_ID, getHeroDef } from "../data/heroes.js";
import { getWeaponArtDef } from "../data/weapon-arts.js";
import { buildRunWeaponArtState, createWeaponArtProgressionState } from "../data/weapon-art-progression.js";
import { createCombatState, damageEnemy, resolveEnemyBodyDamage, spawnEnemyAreaHitbox, spawnEnemyProjectile, updateCombat } from "../systems/combat.js";
import { spawnEnemyByType, spawnRoomEnemies, updateEnemies } from "../systems/enemies.js";
import { createMovementState, updatePlayerMovement } from "../systems/movement.js";
import { generateRoom } from "../systems/world-generation.js";
import { renderGame } from "../render/renderer.js";

export class RoguelikeGame {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assets = null;
    this.input = new InputController(canvas);
    this.camera = new Camera(canvas.width, canvas.height);
    this.heroDef = getHeroDef(options.heroId || DEFAULT_HERO_ID);
    this.heroId = this.heroDef.id;
    this.weaponArt = this.createWeaponArtLoadout(this.heroDef.defaultWeaponArt);
    this.maxRooms = 5;
    this.seed = Date.now();
    this.roomIndex = 0;
    this.roomKills = 0;
    this.kills = 0;
    this.enemies = [];
    this.world = null;
    this.roomCleared = false;
    this.roomTransitionTimer = 0;
    this.state = "loading";
    this.lastFrame = 0;
    this.animationFrame = 0;
    this.time = 0;

    this.player = {
      x: 0,
      y: 0,
      w: 36,
      h: 36,
      hp: this.heroDef.maxHp,
      maxHp: this.heroDef.maxHp,
      facing: "down",
      animClock: 0,
      isMoving: false,
      movement: createMovementState(this.heroDef),
      hitTimer: 0,
      hitDuration: 0.34,
      damageBonus: 0,
      damageBonusTimer: 0
    };
    this.combat = createCombatState();
  }

  createWeaponArtLoadout(weaponArtId) {
    const progressionState = createWeaponArtProgressionState(weaponArtId);
    return {
      id: weaponArtId,
      def: getWeaponArtDef(weaponArtId),
      progressionState,
      runState: buildRunWeaponArtState(weaponArtId, progressionState)
    };
  }

  async init() {
    this.assets = await loadAssetPack();
    this.restart();
  }

  setHero(heroId, options = {}) {
    this.heroDef = getHeroDef(heroId || DEFAULT_HERO_ID);
    this.heroId = this.heroDef.id;
    this.weaponArt = this.createWeaponArtLoadout(this.heroDef.defaultWeaponArt);
    this.player.maxHp = this.heroDef.maxHp;
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    this.player.movement = createMovementState(this.heroDef);
    this.combat = createCombatState();
    if (options.restart !== false) this.restart();
  }

  restart() {
    this.seed = Date.now();
    this.time = 0;
    this.roomIndex = 0;
    this.kills = 0;
    this.roomKills = 0;
    this.player.maxHp = this.heroDef.maxHp;
    this.player.hp = this.player.maxHp;
    this.player.damageBonus = 0;
    this.player.damageBonusTimer = 0;
    this.player.movement = createMovementState(this.heroDef);
    this.weaponArt = this.createWeaponArtLoadout(this.heroDef.defaultWeaponArt);
    this.combat = createCombatState();
    this.state = "running";
    this.loadRoom(this.roomIndex);
  }

  loadRoom(roomIndex) {
    this.world = generateRoom(this.seed, roomIndex, this.assets);
    this.player.x = this.world.start.x;
    this.player.y = this.world.start.y;
    this.player.animClock = 0;
    this.player.hitTimer = 0;
    this.roomCleared = false;
    this.roomTransitionTimer = 0;
    this.roomKills = 0;
    this.enemies = spawnRoomEnemies(this.world, roomIndex, this.seed);
    this.combat.playerProjectiles = [];
    this.combat.enemyProjectiles = [];
    this.combat.enemyAreaHitboxes = [];
    this.camera.snapTo(this.player, this.world);
  }

  start() {
    this.lastFrame = performance.now();
    this.animationFrame = requestAnimationFrame((time) => this.loop(time));
  }

  loop(time) {
    const dt = Math.min(1 / 15, (time - this.lastFrame) / 1000 || 0);
    this.lastFrame = time;
    this.update(dt);
    renderGame(this.ctx, this);
    this.input.updateFrame();
    this.animationFrame = requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  update(dt) {
    if (this.input.wasPressed("escape")) {
      if (this.state === "running") {
        this.state = "paused";
      } else if (this.state === "paused") {
        this.state = "running";
      }
    }

    if (this.input.wasPressed("r") && (this.state === "defeat" || this.state === "victory")) {
      this.restart();
      return;
    }
    if (!this.world || this.state === "loading") return;

    if (this.state === "running") {
      this.time += dt;
      this.player.animClock += dt;
      this.player.hitTimer = Math.max(0, this.player.hitTimer - dt);
      updatePlayerMovement(this, dt);
      updateCombat(this, dt);
      updateEnemies(this, dt);
      resolveEnemyBodyDamage(this);

      if (!this.roomCleared && this.enemies.length === 0) {
        this.roomCleared = true;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 8);
      }

      if (this.roomCleared) {
        this.roomTransitionTimer += dt;
        if (this.roomTransitionTimer >= 1.2) this.advanceRoom();
      }
    }

    this.camera.follow(this.player, this.world, dt);
  }

  advanceRoom() {
    this.roomIndex += 1;
    if (this.roomIndex >= this.maxRooms) {
      this.state = "victory";
      return;
    }
    this.loadRoom(this.roomIndex);
  }

  spawnEnemyProjectile(enemy, options) {
    spawnEnemyProjectile(this, enemy, options);
  }

  spawnEnemyAreaHitbox(hitbox) {
    spawnEnemyAreaHitbox(this, hitbox);
  }

  damageEnemy(enemy, amount) {
    damageEnemy(this, enemy, amount);
  }

  spawnEnemyByType(typeId, x, y, extras = {}) {
    const enemy = spawnEnemyByType(typeId, x, y);
    if (!enemy) return null;
    Object.assign(enemy, extras);
    enemy.x = Math.max(0, Math.min(this.world.width - enemy.w, enemy.x));
    enemy.y = Math.max(0, Math.min(this.world.height - enemy.h, enemy.y));
    this.enemies.push(enemy);
    return enemy;
  }

  spawnEnemyNearPlayer(typeId) {
    if (!this.world) return null;
    const offsets = [
      { x: 96, y: 0 },
      { x: -96, y: 0 },
      { x: 0, y: 96 },
      { x: 0, y: -96 },
      { x: 128, y: 64 },
      { x: -128, y: 64 },
      { x: 128, y: -64 },
      { x: -128, y: -64 }
    ];
    for (const offset of offsets) {
      const enemy = spawnEnemyByType(typeId, this.player.x + offset.x, this.player.y + offset.y);
      if (!enemy) continue;
      const nextEnemy = {
        x: Math.max(0, Math.min(this.world.width - enemy.w, enemy.x)),
        y: Math.max(0, Math.min(this.world.height - enemy.h, enemy.y)),
        w: enemy.w,
        h: enemy.h
      };
      const blocked = this.world.collisionRects.some((wall) => !(
        nextEnemy.x + nextEnemy.w <= wall.x ||
        nextEnemy.x >= wall.x + wall.w ||
        nextEnemy.y + nextEnemy.h <= wall.y ||
        nextEnemy.y >= wall.y + wall.h
      ));
      if (blocked) continue;
      Object.assign(enemy, { x: nextEnemy.x, y: nextEnemy.y });
      this.enemies.push(enemy);
      return enemy;
    }
    return null;
  }
}
