export const DEFAULT_HERO_ID = "dark_mage";

const CASTER_PROJECTILE_ANCHORS = Object.freeze({
  right: { x: 15, y: -10 },
  right_down: { x: 13, y: -2 },
  down: { x: 4, y: 8 },
  left_down: { x: -13, y: -2 },
  left: { x: -15, y: -10 },
  left_up: { x: -13, y: -17 },
  up: { x: 0, y: -20 },
  right_up: { x: 13, y: -17 }
});

const HEAVY_PROJECTILE_ANCHORS = Object.freeze({
  right: { x: 17, y: -8 },
  right_down: { x: 14, y: 0 },
  down: { x: 5, y: 9 },
  left_down: { x: -14, y: 0 },
  left: { x: -17, y: -8 },
  left_up: { x: -14, y: -15 },
  up: { x: 0, y: -18 },
  right_up: { x: 14, y: -15 }
});

const BOW_PROJECTILE_ANCHORS = Object.freeze({
  right: { x: 19, y: -9 },
  right_down: { x: 16, y: -1 },
  down: { x: 5, y: 10 },
  left_down: { x: -16, y: -1 },
  left: { x: -19, y: -9 },
  left_up: { x: -16, y: -16 },
  up: { x: 0, y: -19 },
  right_up: { x: 16, y: -16 }
});

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
    name: "Necromancer",
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
      recharge: 1,
      frameSequence: [0, 1, 2, 13, 14],
      afterimage: {
        interval: 0.015,
        duration: 0.28,
        alpha: 0.45,
        tint: "rgba(168, 85, 247, 0.9)",
        stretch: 0.18
      },
      vfx: {
        streakColor: "rgba(76, 29, 149, 0.62)",
        streakCoreColor: "rgba(233, 213, 255, 0.85)",
        flashColor: "rgba(192, 132, 252, 0.9)",
        flashAccentColor: "rgba(255, 255, 255, 0.95)"
      }
    },
    slide: {
      duration: 0.55,
      speedMultiplier: 1.55,
      postDashWindow: 0.3
    },
    combat: {
      cooldown: 0.7,
      damage: 14,
      range: 200,
      beamWidth: 32,
      actionDuration: 7 / 15,
      triggerTime: 2 / 15,
      hitboxTrigger: 2,
      activeDuration: 0.22,
      tickInterval: 0,
      animationKey: "cast",
      moveMultiplier: 0.58
    },
    sprite: {
      frameWidth: 128,
      frameHeight: 128,
      rowOrder: ["right", "right_down", "down", "left_down", "left", "left_up", "up", "right_up"],
      projectileAnchorOffsets: CASTER_PROJECTILE_ANCHORS,
      states: {
        idle: { asset: "darkMageIdle", frames: 15, fps: 8, loop: true },
        walk: { asset: "darkMageWalk", frames: 15, fps: 10, loop: true },
        run: { asset: "darkMageRun", frames: 15, fps: 14, loop: true },
        dash: { asset: "darkMageRolling", frames: 15, fps: 20, loop: false },
        dashStart: { asset: "darkMageDashStart", frames: 15, fps: 20, loop: false },
        dashEnd: { asset: "darkMageDashEnd", frames: 15, fps: 20, loop: false },
        slide: { asset: "darkMageSlide", frames: 15, fps: 18, loop: false },
        hit: { asset: "darkMageTakeDamage", frames: 15, fps: 18, loop: false },
        attack: { asset: "darkMageAttack1", frames: 15, fps: 18, loop: false },
        attack2: { asset: "darkMageAttack2", frames: 15, fps: 18, loop: false },
        attack3: { asset: "darkMageAttack3", frames: 15, fps: 18, loop: false },
        cast: { asset: "darkMageQuickShot", frames: 7, fps: 15, loop: false },
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
      recharge: 1,
      afterimage: {
        interval: 0.015,
        duration: 0.28,
        alpha: 0.45,
        tint: "rgba(239, 68, 68, 0.88)",
        stretch: 0.18
      },
      vfx: {
        streakColor: "rgba(127, 29, 29, 0.62)",
        streakCoreColor: "rgba(254, 202, 202, 0.86)",
        flashColor: "rgba(248, 113, 113, 0.92)",
        flashAccentColor: "rgba(255, 245, 245, 0.98)"
      }
    },
    slide: {
      duration: 0.5,
      speedMultiplier: 1.45,
      postDashWindow: 0.28
    },
    combat: {
      cooldown: 0.7,
      comboReset: 0.7,
      moveMultiplier: 0.48
    },
    sprite: {
      frameWidth: 128,
      frameHeight: 128,
      rowOrder: ["right", "right_down", "down", "left_down", "left", "left_up", "up", "right_up"],
      projectileAnchorOffsets: HEAVY_PROJECTILE_ANCHORS,
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
      recharge: 1,
      frameSequence: [0, 1, 2, 13, 14],
      afterimage: {
        interval: 0.015,
        duration: 0.28,
        alpha: 0.45,
        tint: "rgba(56, 189, 248, 0.9)",
        stretch: 0.18
      },
      vfx: {
        streakColor: "rgba(14, 116, 144, 0.6)",
        streakCoreColor: "rgba(250, 204, 21, 0.85)",
        flashColor: "rgba(125, 211, 252, 0.92)",
        flashAccentColor: "rgba(255, 255, 255, 0.98)"
      }
    },
    slide: {
      duration: 0.5,
      speedMultiplier: 1.52,
      postDashWindow: 0.3
    },
    combat: {
      cooldown: 0.7,
      moveMultiplier: 0.66,
      comboReset: 0.85
    },
    sprite: {
      frameWidth: 128,
      frameHeight: 128,
      rowOrder: ["right", "right_down", "down", "left_down", "left", "left_up", "up", "right_up"],
      projectileAnchorOffsets: CASTER_PROJECTILE_ANCHORS,
      states: createSpriteStates("elementMage", {
        cast: { asset: "elementMageCastSpell", frames: 15, fps: 18, loop: false },
        attack: { asset: "elementMageQuickShot", frames: 15, fps: 18, loop: false },
        attack2: { asset: "elementMageAttack2", frames: 15, fps: 18, loop: false },
        attack3: { asset: "elementMageSpecial1", frames: 15, fps: 18, loop: false },
        dashStart: { asset: "elementMageDashStart", frames: 15, fps: 20, loop: false },
        dashEnd: { asset: "elementMageDashEnd", frames: 15, fps: 20, loop: false }
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
      cooldown: 0.7,
      comboReset: 0.78,
      moveMultiplier: 0.42
    },
    sprite: {
      frameWidth: 128,
      frameHeight: 128,
      rowOrder: ["right", "right_down", "down", "left_down", "left", "left_up", "up", "right_up"],
      projectileAnchorOffsets: HEAVY_PROJECTILE_ANCHORS,
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
      recharge: 0.95,
      afterimage: {
        interval: 0.015,
        duration: 0.28,
        alpha: 0.42,
        tint: "rgba(34, 197, 94, 0.88)",
        stretch: 0.18
      },
      vfx: {
        streakColor: "rgba(21, 128, 61, 0.58)",
        streakCoreColor: "rgba(187, 247, 208, 0.84)",
        flashColor: "rgba(74, 222, 128, 0.9)",
        flashAccentColor: "rgba(240, 253, 244, 0.98)"
      }
    },
    slide: {
      duration: 0.5,
      speedMultiplier: 1.6,
      postDashWindow: 0.3
    },
    combat: {
      cooldown: 0.7,
      moveMultiplier: 0.78
    },
    sprite: {
      frameWidth: 128,
      frameHeight: 128,
      rowOrder: ["right", "right_down", "down", "left_down", "left", "left_up", "up", "right_up"],
      projectileAnchorOffsets: BOW_PROJECTILE_ANCHORS,
      states: createSpriteStates("windArcher", {
        cast: { asset: "windArcherQuickShot", frames: 15, fps: 18, loop: false },
        attack: { asset: "windArcherAttack1", frames: 15, fps: 18, loop: false },
        attack2: { asset: "windArcherAttack2", frames: 15, fps: 18, loop: false },
        attack3: { asset: "windArcherAttack3", frames: 15, fps: 18, loop: false },
        frontFlip: { asset: "windArcherFrontFlip", frames: 15, fps: 18, loop: false }
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

const HIDDEN_HERO_IDS = new Set(["knight"]);
const PLAYABLE_HERO_LIST = Object.freeze(HERO_LIST.filter((hero) => !HIDDEN_HERO_IDS.has(hero.id)));

export const HERO_ASSET_SPECS = Object.freeze([
  ["darkMageAttack1", "./assets/heroes/dark-mage/Attack1.png"],
  ["darkMageAttack2", "./assets/heroes/dark-mage/Attack2.png"],
  ["darkMageAttack3", "./assets/heroes/dark-mage/Attack3.png"],
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
  ["elementMageDashStart", "./assets/heroes/element-mage/SlideStart.png"],
  ["elementMageDashEnd", "./assets/heroes/element-mage/SlideEnd.png"],
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
  ["windArcherFrontFlip", "./assets/heroes/wind-archer/FrontFlip.png"],
  ["windArcherDie", "./assets/heroes/wind-archer/Die.png"],
  ["heroWindArrow", "./assets/Combat VFX/wind arrow.png"]
]);

export function getHeroDef(heroId = DEFAULT_HERO_ID) {
  return HERO_DEFS[heroId] || HERO_DEFS[DEFAULT_HERO_ID];
}

export function isHeroSelectable(heroId) {
  return !!heroId && !!HERO_DEFS[heroId] && !HIDDEN_HERO_IDS.has(heroId);
}

export function resolveSelectableHeroId(heroId = DEFAULT_HERO_ID) {
  if (isHeroSelectable(heroId)) return heroId;
  if (isHeroSelectable(DEFAULT_HERO_ID)) return DEFAULT_HERO_ID;
  return PLAYABLE_HERO_LIST[0]?.id || HERO_LIST[0]?.id || DEFAULT_HERO_ID;
}

export function getHeroList(options = {}) {
  return options.includeHidden ? HERO_LIST : PLAYABLE_HERO_LIST;
}
