export const DEFAULT_HERO_ID = "dark_mage";

function createSpriteStates(prefix, overrides = {}) {
  return {
    idle: { asset: `${prefix}Idle`, frames: 15, fps: 8, loop: true },
    walk: { asset: `${prefix}Walk`, frames: 15, fps: 10, loop: true },
    run: { asset: `${prefix}Run`, frames: 15, fps: 14, loop: true },
    dash: { asset: `${prefix}Rolling`, frames: 15, fps: 20, loop: false },
    slide: { asset: `${prefix}Slide`, frames: 15, fps: 18, loop: false },
    hit: { asset: `${prefix}TakeDamage`, frames: 15, fps: 18, loop: false },
    cast: { asset: `${prefix}CastSpell`, frames: 15, fps: 18, loop: false },
    attack: { asset: `${prefix}Attack1`, frames: 15, fps: 18, loop: false },
    attack2: { asset: `${prefix}Attack2`, frames: 15, fps: 18, loop: false },
    attack3: { asset: `${prefix}Attack3`, frames: 15, fps: 18, loop: false },
    dead: { asset: `${prefix}Die`, frames: 15, fps: 12, loop: false },
    ...overrides
  };
}

export const HERO_DEFS = Object.freeze({
  dark_mage: {
    id: "dark_mage",
    name: "Dark Mage",
    description: "Soul Siphon caster. Fragile spiritcraft hero with dark beam pressure.",
    defaultWeaponArt: "soulSiphon",
    defaultWeaponArtClass: "ranged",
    ownsDefaultWeaponArt: true,
    maxHp: 80,
    moveSpeed: 230,
    sprintMultiplier: 1.6,
    sprintDuration: 2.4,
    dash: {
      duration: 0.2,
      speed: 980,
      distanceMultiplier: 0.52,
      charges: 2,
      recharge: 1
    },
    slide: {
      duration: 0.55,
      speedMultiplier: 1.55,
      postDashWindow: 0.3
    },
    combat: {
      cooldown: 0.46,
      damage: 14,
      range: 280,
      beamWidth: 26,
      actionDuration: 0.52,
      triggerTime: 0.14,
      activeDuration: 0.28,
      tickInterval: 0.09,
      animationKey: "cast",
      moveMultiplier: 0.58
    },
    sprite: {
      frameWidth: 128,
      frameHeight: 128,
      rowOrder: ["right", "right_down", "down", "left_down", "left", "left_up", "up", "right_up"],
      states: {
        idle: { asset: "darkMageIdle", frames: 15, fps: 8, loop: true },
        walk: { asset: "darkMageWalk", frames: 15, fps: 10, loop: true },
        run: { asset: "darkMageRun", frames: 15, fps: 14, loop: true },
        dash: { asset: "darkMageRolling", frames: 15, fps: 20, loop: false },
        slide: { asset: "darkMageSlide", frames: 15, fps: 18, loop: false },
        hit: { asset: "darkMageTakeDamage", frames: 15, fps: 18, loop: false },
        cast: { asset: "darkMageQuickShot", frames: 15, fps: 18, loop: false },
        dead: { asset: "darkMageDie", frames: 15, fps: 12, loop: false }
      }
    }
  },
  death_knight: {
    id: "death_knight",
    name: "Death Knight",
    description: "Blade & Blast hybrid. Dark melee warlord with blast finishers.",
    defaultWeaponArt: "bladeBlast",
    defaultWeaponArtClass: "hybrid",
    ownsDefaultWeaponArt: true,
    maxHp: 92,
    moveSpeed: 236,
    sprintMultiplier: 1.52,
    sprintDuration: 2.2,
    dash: {
      duration: 0.2,
      speed: 930,
      distanceMultiplier: 0.5,
      charges: 2,
      recharge: 1
    },
    slide: {
      duration: 0.5,
      speedMultiplier: 1.45,
      postDashWindow: 0.28
    },
    combat: {
      cooldown: 0.54,
      comboReset: 0.7,
      moveMultiplier: 0.48
    },
    sprite: {
      frameWidth: 128,
      frameHeight: 128,
      rowOrder: ["right", "right_down", "down", "left_down", "left", "left_up", "up", "right_up"],
      states: createSpriteStates("deathKnight", {
        cast: { asset: "deathKnightCastSpell", frames: 15, fps: 16, loop: false },
        attack: { asset: "deathKnightMelee", frames: 15, fps: 18, loop: false },
        attack2: { asset: "deathKnightMelee2", frames: 15, fps: 18, loop: false },
        attack3: { asset: "deathKnightPummel", frames: 15, fps: 16, loop: false }
      })
    }
  },
  element_mage: {
    id: "element_mage",
    name: "Elemental Mage",
    description: "Elemental Shot caster. Fire, frost, and lightning rotate through the attack chain.",
    defaultWeaponArt: "projectile",
    defaultWeaponArtClass: "ranged",
    ownsDefaultWeaponArt: true,
    maxHp: 74,
    moveSpeed: 210,
    sprintMultiplier: 1.65,
    sprintDuration: 2.4,
    dash: {
      duration: 0.2,
      speed: 960,
      distanceMultiplier: 0.5,
      charges: 2,
      recharge: 1
    },
    slide: {
      duration: 0.5,
      speedMultiplier: 1.52,
      postDashWindow: 0.3
    },
    combat: {
      cooldown: 0.5,
      moveMultiplier: 0.66,
      comboReset: 0.85
    },
    sprite: {
      frameWidth: 128,
      frameHeight: 128,
      rowOrder: ["right", "right_down", "down", "left_down", "left", "left_up", "up", "right_up"],
      states: createSpriteStates("elementMage", {
        cast: { asset: "elementMageCastSpell", frames: 15, fps: 18, loop: false },
        attack: { asset: "elementMageQuickShot", frames: 15, fps: 18, loop: false },
        attack2: { asset: "elementMageAttack2", frames: 15, fps: 18, loop: false },
        attack3: { asset: "elementMageSpecial1", frames: 15, fps: 18, loop: false }
      })
    }
  },
  knight: {
    id: "knight",
    name: "Knight",
    description: "Guard Combo frontliner. Grounded sword-and-shield pressure.",
    defaultWeaponArt: "guardCombo",
    defaultWeaponArtClass: "melee",
    ownsDefaultWeaponArt: true,
    maxHp: 112,
    moveSpeed: 182,
    sprintMultiplier: 1.45,
    sprintDuration: 2,
    dash: {
      duration: 0.34,
      speed: 760,
      distanceMultiplier: 0.45,
      charges: 2,
      recharge: 1.15
    },
    slide: {
      duration: 0.58,
      speedMultiplier: 1.4,
      postDashWindow: 0.32
    },
    combat: {
      cooldown: 0.56,
      comboReset: 0.78,
      moveMultiplier: 0.42
    },
    sprite: {
      frameWidth: 128,
      frameHeight: 128,
      rowOrder: ["right", "right_down", "down", "left_down", "left", "left_up", "up", "right_up"],
      states: createSpriteStates("knight", {
        cast: { asset: "knightCastSpell", frames: 15, fps: 15, loop: false },
        attack: { asset: "knightPummel", frames: 15, fps: 16, loop: false },
        attack2: { asset: "knightMelee", frames: 15, fps: 16, loop: false },
        attack3: { asset: "knightMelee2", frames: 15, fps: 15, loop: false }
      })
    }
  },
  wind_archer: {
    id: "wind_archer",
    name: "Wind Archer",
    description: "Wind Volley archer. Movement builds momentum into wider volleys.",
    defaultWeaponArt: "windVolley",
    defaultWeaponArtClass: "ranged",
    ownsDefaultWeaponArt: true,
    maxHp: 76,
    moveSpeed: 248,
    sprintMultiplier: 1.72,
    sprintDuration: 2.5,
    dash: {
      duration: 0.2,
      speed: 1010,
      distanceMultiplier: 0.52,
      charges: 2,
      recharge: 0.95
    },
    slide: {
      duration: 0.5,
      speedMultiplier: 1.6,
      postDashWindow: 0.3
    },
    combat: {
      cooldown: 0.34,
      moveMultiplier: 0.78
    },
    sprite: {
      frameWidth: 128,
      frameHeight: 128,
      rowOrder: ["right", "right_down", "down", "left_down", "left", "left_up", "up", "right_up"],
      states: createSpriteStates("windArcher", {
        cast: { asset: "windArcherQuickShot", frames: 15, fps: 18, loop: false },
        attack: { asset: "windArcherAttack1", frames: 15, fps: 18, loop: false },
        attack2: { asset: "windArcherAttack2", frames: 15, fps: 18, loop: false },
        attack3: { asset: "windArcherAttack3", frames: 15, fps: 18, loop: false }
      })
    }
  }
});

export const HERO_LIST = Object.freeze([
  HERO_DEFS.dark_mage,
  HERO_DEFS.death_knight,
  HERO_DEFS.element_mage,
  HERO_DEFS.knight,
  HERO_DEFS.wind_archer
]);

export const HERO_ASSET_SPECS = Object.freeze([
  ["deathKnightIdle", "./assets/heroes/death-knight/Idle.png"],
  ["deathKnightWalk", "./assets/heroes/death-knight/Walk.png"],
  ["deathKnightRun", "./assets/heroes/death-knight/Run.png"],
  ["deathKnightRolling", "./assets/heroes/death-knight/Rolling.png"],
  ["deathKnightSlide", "./assets/heroes/death-knight/Slide.png"],
  ["deathKnightTakeDamage", "./assets/heroes/death-knight/TakeDamage.png"],
  ["deathKnightCastSpell", "./assets/heroes/death-knight/CastSpell.png"],
  ["deathKnightMelee", "./assets/heroes/death-knight/Melee.png"],
  ["deathKnightMelee2", "./assets/heroes/death-knight/Melee2.png"],
  ["deathKnightPummel", "./assets/heroes/death-knight/Pummel.png"],
  ["deathKnightDie", "./assets/heroes/death-knight/Die.png"],
  ["elementMageIdle", "./assets/heroes/element-mage/Idle.png"],
  ["elementMageWalk", "./assets/heroes/element-mage/Walk.png"],
  ["elementMageRun", "./assets/heroes/element-mage/Run.png"],
  ["elementMageRolling", "./assets/heroes/element-mage/Rolling.png"],
  ["elementMageSlide", "./assets/heroes/element-mage/Slide.png"],
  ["elementMageTakeDamage", "./assets/heroes/element-mage/TakeDamage.png"],
  ["elementMageCastSpell", "./assets/heroes/element-mage/CastSpell.png"],
  ["elementMageQuickShot", "./assets/heroes/element-mage/QuickShot.png"],
  ["elementMageAttack2", "./assets/heroes/element-mage/Attack2.png"],
  ["elementMageSpecial1", "./assets/heroes/element-mage/Special1.png"],
  ["elementMageDie", "./assets/heroes/element-mage/Die.png"],
  ["knightIdle", "./assets/heroes/knight/Idle.png"],
  ["knightWalk", "./assets/heroes/knight/Walk.png"],
  ["knightRun", "./assets/heroes/knight/Run.png"],
  ["knightRolling", "./assets/heroes/knight/Rolling.png"],
  ["knightSlide", "./assets/heroes/knight/Slide.png"],
  ["knightTakeDamage", "./assets/heroes/knight/TakeDamage.png"],
  ["knightCastSpell", "./assets/heroes/knight/CastSpell.png"],
  ["knightPummel", "./assets/heroes/knight/Pummel.png"],
  ["knightMelee", "./assets/heroes/knight/Melee.png"],
  ["knightMelee2", "./assets/heroes/knight/Melee2.png"],
  ["knightDie", "./assets/heroes/knight/Die.png"],
  ["windArcherIdle", "./assets/heroes/wind-archer/Idle.png"],
  ["windArcherWalk", "./assets/heroes/wind-archer/Walk.png"],
  ["windArcherRun", "./assets/heroes/wind-archer/Run.png"],
  ["windArcherRolling", "./assets/heroes/wind-archer/Rolling.png"],
  ["windArcherSlide", "./assets/heroes/wind-archer/Slide.png"],
  ["windArcherTakeDamage", "./assets/heroes/wind-archer/TakeDamage.png"],
  ["windArcherQuickShot", "./assets/heroes/wind-archer/QuickShot.png"],
  ["windArcherAttack1", "./assets/heroes/wind-archer/Attack1.png"],
  ["windArcherAttack2", "./assets/heroes/wind-archer/Attack2.png"],
  ["windArcherAttack3", "./assets/heroes/wind-archer/Attack3.png"],
  ["windArcherDie", "./assets/heroes/wind-archer/Die.png"],
  ["heroWindArrow", "./assets/projectiles/wind-arrow.png"]
]);

export function getHeroDef(heroId = DEFAULT_HERO_ID) {
  return HERO_DEFS[heroId] || HERO_DEFS[DEFAULT_HERO_ID];
}

export function getHeroList() {
  return HERO_LIST;
}
