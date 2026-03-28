export const ENEMY_ASSET_SPECS = Object.freeze([
  ["enemySmallSlimeArchive", "./assets/enemies/sprSmallSlime.png"],
  ["enemyMediumSlimeArchive", "./assets/enemies/sprMediumSlime.png"],
  ["enemyBigSlimeArchive", "./assets/enemies/sprBigSlime.png"],
  ["enemyDragonArchive", "./assets/enemies/sprDragon.png"],
  ["enemyGhost1Archive", "./assets/enemies/sprGhost1.png"],
  ["enemyGhost2Archive", "./assets/enemies/sprGhost2.png"],
  ["enemyGhost3Archive", "./assets/enemies/sprGhost3.png"],
  ["enemySkeleton1Archive", "./assets/enemies/sprSkeleton1.png"],
  ["enemySkeleton2Archive", "./assets/enemies/sprSkeleton2.png"],
  ["enemySkeleton3Archive", "./assets/enemies/sprSkeleton3.png"],
  ["enemyBasilisk1Archive", "./assets/enemies/sprBatilisk1.png"],
  ["enemyBasilisk2Archive", "./assets/enemies/sprBatilisk2.png"],
  ["enemyBasilisk3Archive", "./assets/enemies/sprBatilisk3.png"]
]);

export const ENEMY_DEFS = Object.freeze({
  slime: {
    id: "slime",
    name: "Small Slime",
    role: "melee",
    hp: 38,
    damage: 7,
    speed: 88,
    size: 44,
    color: "#7ddf8d",
    sprite: {
      idle: { asset: "enemySlime", frames: 4, frameWidth: 39, frameHeight: 26, fps: 8 },
      move: { asset: "enemySlime", frames: 4, frameWidth: 39, frameHeight: 26, fps: 8 }
    }
  },
  skeleton: {
    id: "skeleton",
    name: "Skeleton",
    role: "melee",
    hp: 58,
    damage: 10,
    speed: 96,
    size: 50,
    color: "#dbe4ee",
    sprite: {
      idle: { asset: "enemySkeleton", frames: 4, frameWidth: 19, frameHeight: 20, fps: 6 },
      move: { asset: "enemySkeleton", frames: 4, frameWidth: 19, frameHeight: 20, fps: 6 }
    }
  },
  goblin: {
    id: "goblin",
    name: "Goblin",
    role: "skirmisher",
    hp: 28,
    damage: 8,
    speed: 126,
    size: 46,
    color: "#e0d46f",
    sprite: {
      idle: { asset: "enemyGoblin", frames: 4, frameWidth: 25, frameHeight: 25, fps: 8 },
      move: { asset: "enemyGoblin", frames: 4, frameWidth: 25, frameHeight: 25, fps: 8 }
    }
  },
  goblin_mage: {
    id: "goblin_mage",
    name: "Goblin Mage",
    role: "ranged",
    hp: 26,
    damage: 9,
    speed: 88,
    size: 54,
    color: "#8ba7ff",
    fireRate: 1.8,
    projectileSpeed: 300,
    preferredRange: 220,
    sprite: {
      idle: { asset: "enemyGoblinMageIdle", frames: 2, frameWidth: 41, frameHeight: 42, fps: 3 },
      move: { asset: "enemyGoblinMageMove", frames: 24, frameWidth: 41, frameHeight: 42, fps: 10 }
    }
  },
  troll: {
    id: "troll",
    name: "Troll",
    role: "bruiser",
    hp: 94,
    damage: 14,
    speed: 72,
    size: 92,
    color: "#b28a6c",
    sprite: {
      idle: { asset: "enemyTrollIdle", frames: 6, frameWidth: 128, frameHeight: 128, fps: 4 },
      move: { asset: "enemyTrollWalk", frames: 6, frameWidth: 128, frameHeight: 128, fps: 6 }
    }
  },
  small_slime_archive: {
    id: "small_slime_archive",
    name: "Small Slime",
    role: "melee",
    hp: 40,
    damage: 6,
    speed: 60,
    size: 44,
    drawSize: 56,
    collisionRadius: 0.32,
    color: "#7ddf8d",
    sprite: {
      idle: { asset: "enemySmallSlimeArchive", frames: 4, frameWidth: 39, frameHeight: 26, fps: 8 },
      move: { asset: "enemySmallSlimeArchive", frames: 4, frameWidth: 39, frameHeight: 26, fps: 8 }
    }
  },
  medium_slime_archive: {
    id: "medium_slime_archive",
    name: "Medium Slime",
    role: "melee",
    hp: 60,
    damage: 8,
    speed: 58,
    size: 52,
    drawSize: 66,
    collisionRadius: 0.34,
    color: "#6ee7b7",
    sprite: {
      idle: { asset: "enemyMediumSlimeArchive", frames: 4, frameWidth: 39, frameHeight: 26, fps: 8 },
      move: { asset: "enemyMediumSlimeArchive", frames: 4, frameWidth: 39, frameHeight: 26, fps: 8 }
    }
  },
  big_slime_archive: {
    id: "big_slime_archive",
    name: "Big Slime",
    role: "bruiser",
    hp: 80,
    damage: 9,
    speed: 55,
    size: 64,
    drawSize: 84,
    collisionRadius: 0.38,
    color: "#34d399",
    specialBehavior: "big_slime_split",
    sprite: {
      idle: { asset: "enemyBigSlimeArchive", frames: 4, frameWidth: 39, frameHeight: 26, fps: 8 },
      move: { asset: "enemyBigSlimeArchive", frames: 4, frameWidth: 39, frameHeight: 26, fps: 8 }
    }
  },
  dragon_archive: {
    id: "dragon_archive",
    name: "Dragon",
    role: "ranged",
    hp: 100,
    damage: 15,
    speed: 55,
    size: 76,
    drawSize: 104,
    collisionRadius: 0.42,
    color: "#f97316",
    preferredRange: 190,
    fireRate: 3.5,
    projectileColor: "#fb923c",
    specialBehavior: "dragon_breath",
    sprite: {
      idle: { asset: "enemyDragonArchive", frames: 6, frameWidth: 70, frameHeight: 73, fps: 10 },
      move: { asset: "enemyDragonArchive", frames: 6, frameWidth: 70, frameHeight: 73, fps: 10 }
    }
  },
  ghost_1_archive: {
    id: "ghost_1_archive",
    name: "Ghost I",
    role: "melee",
    hp: 24,
    damage: 6,
    speed: 115,
    size: 40,
    drawSize: 56,
    collisionRadius: 0.28,
    color: "#c4b5fd",
    ignoreWalls: true,
    specialBehavior: "ghost_flicker",
    sprite: {
      idle: { asset: "enemyGhost1Archive", frames: 4, frameWidth: 19, frameHeight: 28, fps: 8 },
      move: { asset: "enemyGhost1Archive", frames: 4, frameWidth: 19, frameHeight: 28, fps: 8 }
    }
  },
  ghost_2_archive: {
    id: "ghost_2_archive",
    name: "Ghost II",
    role: "melee",
    hp: 24,
    damage: 6,
    speed: 115,
    size: 40,
    drawSize: 56,
    collisionRadius: 0.28,
    color: "#ddd6fe",
    ignoreWalls: true,
    specialBehavior: "ghost_flicker",
    sprite: {
      idle: { asset: "enemyGhost2Archive", frames: 4, frameWidth: 19, frameHeight: 28, fps: 8 },
      move: { asset: "enemyGhost2Archive", frames: 4, frameWidth: 19, frameHeight: 28, fps: 8 }
    }
  },
  ghost_3_archive: {
    id: "ghost_3_archive",
    name: "Ghost III",
    role: "melee",
    hp: 24,
    damage: 6,
    speed: 115,
    size: 40,
    drawSize: 56,
    collisionRadius: 0.28,
    color: "#e9d5ff",
    ignoreWalls: true,
    specialBehavior: "ghost_flicker",
    sprite: {
      idle: { asset: "enemyGhost3Archive", frames: 4, frameWidth: 19, frameHeight: 28, fps: 8 },
      move: { asset: "enemyGhost3Archive", frames: 4, frameWidth: 19, frameHeight: 28, fps: 8 }
    }
  },
  skeleton_1_archive: {
    id: "skeleton_1_archive",
    name: "Skeleton I",
    role: "melee",
    hp: 60,
    damage: 10,
    speed: 70,
    size: 48,
    drawSize: 62,
    collisionRadius: 0.32,
    color: "#e2e8f0",
    specialBehavior: "skeleton_dash",
    sprite: {
      idle: { asset: "enemySkeleton1Archive", frames: 4, frameWidth: 19, frameHeight: 20, fps: 8 },
      move: { asset: "enemySkeleton1Archive", frames: 4, frameWidth: 19, frameHeight: 20, fps: 8 }
    }
  },
  skeleton_2_archive: {
    id: "skeleton_2_archive",
    name: "Skeleton II",
    role: "melee",
    hp: 60,
    damage: 10,
    speed: 70,
    size: 48,
    drawSize: 62,
    collisionRadius: 0.32,
    color: "#e5e7eb",
    specialBehavior: "skeleton_dash",
    sprite: {
      idle: { asset: "enemySkeleton2Archive", frames: 4, frameWidth: 19, frameHeight: 20, fps: 8 },
      move: { asset: "enemySkeleton2Archive", frames: 4, frameWidth: 19, frameHeight: 20, fps: 8 }
    }
  },
  skeleton_3_archive: {
    id: "skeleton_3_archive",
    name: "Skeleton III",
    role: "melee",
    hp: 60,
    damage: 10,
    speed: 70,
    size: 48,
    drawSize: 62,
    collisionRadius: 0.32,
    color: "#f1f5f9",
    specialBehavior: "skeleton_dash",
    sprite: {
      idle: { asset: "enemySkeleton3Archive", frames: 4, frameWidth: 19, frameHeight: 20, fps: 8 },
      move: { asset: "enemySkeleton3Archive", frames: 4, frameWidth: 19, frameHeight: 20, fps: 8 }
    }
  },
  basilisk_1_archive: {
    id: "basilisk_1_archive",
    name: "Basilisk I",
    role: "skirmisher",
    hp: 28,
    damage: 7,
    speed: 115,
    size: 42,
    drawSize: 58,
    collisionRadius: 0.3,
    color: "#86efac",
    ignoreWalls: true,
    sprite: {
      idle: { asset: "enemyBasilisk1Archive", frames: 4, frameWidth: 25, frameHeight: 25, fps: 8 },
      move: { asset: "enemyBasilisk1Archive", frames: 4, frameWidth: 25, frameHeight: 25, fps: 8 }
    }
  },
  basilisk_2_archive: {
    id: "basilisk_2_archive",
    name: "Basilisk II",
    role: "skirmisher",
    hp: 28,
    damage: 7,
    speed: 115,
    size: 42,
    drawSize: 58,
    collisionRadius: 0.3,
    color: "#4ade80",
    ignoreWalls: true,
    sprite: {
      idle: { asset: "enemyBasilisk2Archive", frames: 4, frameWidth: 25, frameHeight: 25, fps: 8 },
      move: { asset: "enemyBasilisk2Archive", frames: 4, frameWidth: 25, frameHeight: 25, fps: 8 }
    }
  },
  basilisk_3_archive: {
    id: "basilisk_3_archive",
    name: "Basilisk III",
    role: "skirmisher",
    hp: 28,
    damage: 7,
    speed: 115,
    size: 42,
    drawSize: 58,
    collisionRadius: 0.3,
    color: "#22c55e",
    ignoreWalls: true,
    sprite: {
      idle: { asset: "enemyBasilisk3Archive", frames: 4, frameWidth: 25, frameHeight: 25, fps: 8 },
      move: { asset: "enemyBasilisk3Archive", frames: 4, frameWidth: 25, frameHeight: 25, fps: 8 }
    }
  }
});

export const ROOM_ENEMY_TABLE = [
  ["small_slime_archive", "goblin", "skeleton_1_archive", "ghost_1_archive", "m_ud_brute", "m_ud_warrior"],
  ["small_slime_archive", "medium_slime_archive", "skeleton_2_archive", "basilisk_1_archive", "goblin_mage", "m_ud_archer_5", "m_ud_berserker_4"],
  ["medium_slime_archive", "big_slime_archive", "ghost_2_archive", "skeleton_3_archive", "basilisk_2_archive", "m_ud_dark_archer_7", "m_ud_necromancer_8"],
  ["big_slime_archive", "ghost_3_archive", "dragon_archive", "basilisk_3_archive", "goblin_mage", "m_ud_wizard_9", "m_ud_dark_lord_2"],
  ["dragon_archive", "big_slime_archive", "ghost_2_archive", "skeleton_2_archive", "basilisk_3_archive", "m_ud_dark_knight_3", "m_ud_necromancer_8"]
];

export function getEnemyDef(id) {
  return ENEMY_DEFS[id];
}
