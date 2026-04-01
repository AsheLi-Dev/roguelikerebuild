const FOREST_TREE_BASE = "./assets/biomes/openworld/Trees";
const FOREST_ROCK_BASE = "./assets/biomes/openworld/rocks";

function spriteList(basePath, names) {
  return Object.freeze(names.map((name) => `${basePath}/${name}`));
}

export const FOREST_NODE_TIERS = Object.freeze({
  CALM: "calm",
  RISKY: "risky",
  DEADLY: "deadly"
});

export const FOREST_VARIANTS = Object.freeze({
  WOODS: "woods",
  SWAMP: "swamp",
  MAGIC_FOREST: "magic_forest",
  SHALLOW_SPIDER_HABITAT: "shallow_spider_habitat",
  DEAD_FOREST: "dead_forest",
  DEEP_SPIDER_HABITAT: "deep_spider_habitat"
});

export const FOREST_VARIANTS_BY_NODE_TIER = Object.freeze({
  [FOREST_NODE_TIERS.CALM]: Object.freeze([
    FOREST_VARIANTS.WOODS,
    FOREST_VARIANTS.SWAMP
  ]),
  [FOREST_NODE_TIERS.RISKY]: Object.freeze([
    FOREST_VARIANTS.MAGIC_FOREST,
    FOREST_VARIANTS.SHALLOW_SPIDER_HABITAT
  ]),
  [FOREST_NODE_TIERS.DEADLY]: Object.freeze([
    FOREST_VARIANTS.DEAD_FOREST,
    FOREST_VARIANTS.DEEP_SPIDER_HABITAT
  ])
});

const WOODS_TREE_SPRITES = spriteList(FOREST_TREE_BASE, [
  "treeBB_01.png",
  "treeBB_02.png",
  "treeBB_03.png",
  "treeBB_04.png",
  "treeBB_05.png",
  "treeBB_06.png",
  "treeBB_07.png",
  "treeBB_08.png"
]);

const SWAMP_TREE_SPRITES = spriteList(FOREST_TREE_BASE, [
  "treeAAAA_01.png",
  "treeAAAA_02.png",
  "treeAAAA_03.png",
  "treeAAAA_04.png",
  "treeAAAA_05.png",
  "treeAAAA_06.png",
  "treeAAAA_07.png",
  "treeAAAA_08.png",
  "treeAAAA_09.png"
]);

const MAGIC_FOREST_TREE_SPRITES = spriteList(FOREST_TREE_BASE, [
  "treeAA_01.png",
  "treeAA_02.png",
  "treeAA_03.png",
  "treeAA_04.png",
  "treeAA_05.png",
  "treeAA_06.png",
  "treeAA_07.png"
]);

const SHALLOW_SPIDER_HABITAT_TREE_SPRITES = spriteList(FOREST_TREE_BASE, [
  "treeC_01.png",
  "treeC_02.png",
  "treeC_03.png",
  "treeC_04.png",
  "treeC_05.png",
  "treeC_06.png",
  "treeC_07.png",
  "treeC_08.png",
  "treeC_09.png",
  "treeC_10.png",
  "treeC_11.png"
]);

const DEAD_FOREST_TREE_SPRITES = spriteList(FOREST_TREE_BASE, [
  "treeE_01.png",
  "treeE_02.png",
  "treeE_03.png",
  "treeE_04.png",
  "treeE_05.png",
  "treeE_06.png",
  "treeE_07.png"
]);

const DEEP_SPIDER_HABITAT_TREE_SPRITES = spriteList(FOREST_TREE_BASE, [
  "treeCC_01.png",
  "treeCC_02.png",
  "treeCC_03.png",
  "treeCC_04.png",
  "treeCC_05.png",
  "treeCC_06.png",
  "treeCC_07.png",
  "treeCC_08.png",
  "treeCC_09.png",
  "treeCC_10.png",
  "treeCC_11.png"
]);

const DEFAULT_TREE_VAULT_SPRITES = spriteList(FOREST_TREE_BASE, [
  "treeB_01.png",
  "treeB_02.png",
  "treeB_03.png",
  "treeB_04.png"
]);

const DEFAULT_ROCK_SPRITES = spriteList(FOREST_ROCK_BASE, [
  "rockAA_01.png",
  "rockAA_02.png",
  "rockAA_03.png",
  "rockAA_04.png",
  "rockAA_05.png",
  "rockAA_06.png",
  "rockAA_07.png",
  "rockAA_08.png"
]);

// The rebuild does not currently include the archive-only monC vault sprites.
const DEFAULT_VAULT_ROCK_SPRITES = DEFAULT_ROCK_SPRITES;

export const FOREST_VARIANT_ENEMY_POOLS = Object.freeze({
  __categoryWeights: Object.freeze({
    common: 0.65,
    support: 0.2,
    threat: 0.1,
    rare: 0.05
  }),
  default_forest_pool: Object.freeze({
    id: "default_forest_pool",
    categories: Object.freeze({
      common: Object.freeze({ weight: 0.65, enemies: Object.freeze([]) }),
      support: Object.freeze({ weight: 0.2, enemies: Object.freeze([]) }),
      threat: Object.freeze({ weight: 0.1, enemies: Object.freeze([]) }),
      rare: Object.freeze({ weight: 0.05, enemies: Object.freeze([]) })
    }),
    enemies: Object.freeze([])
  }),
  woods_pool: Object.freeze({
    id: "woods_pool",
    categories: Object.freeze({
      common: Object.freeze({
        weight: 0.65,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_1c_goblin", name: "Goblin" }),
          Object.freeze({ enemyTypeId: "m_1a_orc", name: "Orc" }),
          Object.freeze({ enemyTypeId: "m_3e_medium_slime", name: "Medium Slime" }),
          Object.freeze({ enemyTypeId: "m_5s_small_frog", name: "Small Frog" })
        ])
      }),
      support: Object.freeze({
        weight: 0.2,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_1f_goblin_archer", name: "Goblin Archer" }),
          Object.freeze({ enemyTypeId: "m_1g_goblin_mage", name: "Goblin Mage" }),
          Object.freeze({ enemyTypeId: "m_3a_small_slime", name: "Small Slime" })
        ])
      }),
      threat: Object.freeze({
        weight: 0.1,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_3b_big_slime", name: "Big Slime" }),
          Object.freeze({ enemyTypeId: "m_2c_troll", name: "Troll" })
        ])
      }),
      rare: Object.freeze({
        weight: 0.05,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_6d_cultist", name: "Cultist" }),
          Object.freeze({ enemyTypeId: "m_5u_cyclop_archer", name: "Cyclop Archer" })
        ])
      })
    }),
    enemies: Object.freeze([
      "m_1c_goblin",
      "m_1a_orc",
      "m_3e_medium_slime",
      "m_5s_small_frog",
      "m_1f_goblin_archer",
      "m_1g_goblin_mage",
      "m_3a_small_slime",
      "m_3b_big_slime",
      "m_2c_troll",
      "m_6d_cultist",
      "m_5u_cyclop_archer"
    ])
  }),
  swamp_pool: Object.freeze({
    id: "swamp_pool",
    categories: Object.freeze({
      common: Object.freeze({
        weight: 0.65,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_5s_small_frog", name: "Small Frog" }),
          Object.freeze({ enemyTypeId: "m_3a_small_slime", name: "Small Slime" }),
          Object.freeze({ enemyTypeId: "m_1c_goblin", name: "Goblin" })
        ])
      }),
      support: Object.freeze({
        weight: 0.2,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_3e_medium_slime", name: "Medium Slime" }),
          Object.freeze({ enemyTypeId: "m_1f_goblin_archer", name: "Goblin Archer" }),
          Object.freeze({ enemyTypeId: "m_1a_orc", name: "Orc" })
        ])
      }),
      threat: Object.freeze({
        weight: 0.1,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_3b_big_slime", name: "Big Slime" }),
          Object.freeze({ enemyTypeId: "m_2c_troll", name: "Troll" })
        ])
      }),
      rare: Object.freeze({
        weight: 0.05,
        enemies: Object.freeze([
          Object.freeze({ enemyTypeId: "m_7i_giant_spider", name: "Giant Spider" }),
          Object.freeze({ enemyTypeId: "m_8c_rock_golem", name: "Rock Golem" })
        ])
      })
    }),
    enemies: Object.freeze([
      "m_5s_small_frog",
      "m_3a_small_slime",
      "m_1c_goblin",
      "m_3e_medium_slime",
      "m_1f_goblin_archer",
      "m_1a_orc",
      "m_3b_big_slime",
      "m_2c_troll",
      "m_7i_giant_spider",
      "m_8c_rock_golem"
    ])
  }),
  magic_forest_pool: Object.freeze({
    id: "magic_forest_pool",
    categories: Object.freeze({
      common: Object.freeze({ weight: 0.65, enemies: Object.freeze([]) }),
      support: Object.freeze({ weight: 0.2, enemies: Object.freeze([]) }),
      threat: Object.freeze({ weight: 0.1, enemies: Object.freeze([]) }),
      rare: Object.freeze({ weight: 0.05, enemies: Object.freeze([]) })
    }),
    enemies: Object.freeze([])
  }),
  shallow_spider_pool: Object.freeze({
    id: "shallow_spider_pool",
    categories: Object.freeze({
      common: Object.freeze({ weight: 0.65, enemies: Object.freeze([]) }),
      support: Object.freeze({ weight: 0.2, enemies: Object.freeze([]) }),
      threat: Object.freeze({ weight: 0.1, enemies: Object.freeze([]) }),
      rare: Object.freeze({ weight: 0.05, enemies: Object.freeze([]) })
    }),
    enemies: Object.freeze([])
  }),
  dead_forest_pool: Object.freeze({
    id: "dead_forest_pool",
    categories: Object.freeze({
      common: Object.freeze({ weight: 0.65, enemies: Object.freeze([]) }),
      support: Object.freeze({ weight: 0.2, enemies: Object.freeze([]) }),
      threat: Object.freeze({ weight: 0.1, enemies: Object.freeze([]) }),
      rare: Object.freeze({ weight: 0.05, enemies: Object.freeze([]) })
    }),
    enemies: Object.freeze([])
  }),
  deep_spider_pool: Object.freeze({
    id: "deep_spider_pool",
    categories: Object.freeze({
      common: Object.freeze({ weight: 0.65, enemies: Object.freeze([]) }),
      support: Object.freeze({ weight: 0.2, enemies: Object.freeze([]) }),
      threat: Object.freeze({ weight: 0.1, enemies: Object.freeze([]) }),
      rare: Object.freeze({ weight: 0.05, enemies: Object.freeze([]) })
    }),
    enemies: Object.freeze([])
  })
});

export const FOREST_VARIANT_OBSTACLE_POOLS = Object.freeze({
  default_forest_obstacle_pool: Object.freeze({
    id: "default_forest_obstacle_pool",
    obstacles: Object.freeze([
      Object.freeze({ obstacleTypeId: "giantRock", w: 55 }),
      Object.freeze({ obstacleTypeId: "smallPonds", w: 15 }),
      Object.freeze({ obstacleTypeId: "largePond", w: 10 })
    ])
  }),
  woods_obstacle_pool: Object.freeze({
    id: "woods_obstacle_pool",
    obstacles: Object.freeze([
      Object.freeze({ obstacleTypeId: "giantRock", w: 60 }),
      Object.freeze({ obstacleTypeId: "smallPonds", w: 15 })
    ])
  }),
  swamp_obstacle_pool: Object.freeze({
    id: "swamp_obstacle_pool",
    obstacles: Object.freeze([
      Object.freeze({ obstacleTypeId: "largePond", w: 45 }),
      Object.freeze({ obstacleTypeId: "smallPonds", w: 35 }),
      Object.freeze({ obstacleTypeId: "giantRock", w: 10 })
    ])
  }),
  magic_forest_obstacle_pool: Object.freeze({
    id: "magic_forest_obstacle_pool",
    obstacles: Object.freeze([
      Object.freeze({ obstacleTypeId: "magicPillarSmall", w: 35 }),
      Object.freeze({ obstacleTypeId: "magicPillarMedium", w: 25 }),
      Object.freeze({ obstacleTypeId: "magicPillarLarge", w: 15 }),
      Object.freeze({ obstacleTypeId: "magicAltar", w: 10 }),
      Object.freeze({ obstacleTypeId: "giantRock", w: 10 }),
      Object.freeze({ obstacleTypeId: "smallPonds", w: 5 })
    ])
  }),
  shallow_spider_obstacle_pool: Object.freeze({
    id: "shallow_spider_obstacle_pool",
    obstacles: Object.freeze([
      Object.freeze({ obstacleTypeId: "giantRock", w: 55 }),
      Object.freeze({ obstacleTypeId: "smallPonds", w: 15 }),
      Object.freeze({ obstacleTypeId: "largePond", w: 5 })
    ])
  }),
  dead_forest_obstacle_pool: Object.freeze({
    id: "dead_forest_obstacle_pool",
    obstacles: Object.freeze([
      Object.freeze({ obstacleTypeId: "darkPillarSmall", w: 35 }),
      Object.freeze({ obstacleTypeId: "darkPillarMedium", w: 25 }),
      Object.freeze({ obstacleTypeId: "darkPillarLarge", w: 15 }),
      Object.freeze({ obstacleTypeId: "darkAltar", w: 10 }),
      Object.freeze({ obstacleTypeId: "giantRock", w: 10 })
    ])
  }),
  deep_spider_obstacle_pool: Object.freeze({
    id: "deep_spider_obstacle_pool",
    obstacles: Object.freeze([
      Object.freeze({ obstacleTypeId: "giantRock", w: 60 }),
      Object.freeze({ obstacleTypeId: "largePond", w: 10 }),
      Object.freeze({ obstacleTypeId: "smallPonds", w: 10 })
    ])
  })
});

function createVariantConfig({
  id,
  displayName,
  nodeTier,
  treeSpriteSources,
  groundTypeId,
  obstaclePoolId,
  enemyPoolId
}) {
  return Object.freeze({
    id,
    displayName,
    nodeTier,
    treeSpriteSet: Object.freeze({
      spriteSources: treeSpriteSources,
      vaultSpriteSources: DEFAULT_TREE_VAULT_SPRITES
    }),
    grassPatchSpriteSet: Object.freeze({ groundTypeId }),
    obstacleSpriteSet: Object.freeze({
      giantRockSpriteSources: DEFAULT_ROCK_SPRITES,
      vaultRockSpriteSources: DEFAULT_VAULT_ROCK_SPRITES
    }),
    obstaclePoolId,
    enemyPoolId,
    ambience: null,
    tint: null,
    decorativeProps: null,
    musicKey: null,
    fogProfile: null
  });
}

export const FOREST_VARIANT_CONFIG = Object.freeze({
  [FOREST_VARIANTS.WOODS]: createVariantConfig({
    id: FOREST_VARIANTS.WOODS,
    displayName: "Woods",
    nodeTier: FOREST_NODE_TIERS.CALM,
    treeSpriteSources: WOODS_TREE_SPRITES,
    groundTypeId: "grass_woods",
    obstaclePoolId: "woods_obstacle_pool",
    enemyPoolId: "woods_pool"
  }),
  [FOREST_VARIANTS.SWAMP]: createVariantConfig({
    id: FOREST_VARIANTS.SWAMP,
    displayName: "Swamp",
    nodeTier: FOREST_NODE_TIERS.CALM,
    treeSpriteSources: SWAMP_TREE_SPRITES,
    groundTypeId: "grass_swamp",
    obstaclePoolId: "swamp_obstacle_pool",
    enemyPoolId: "swamp_pool"
  }),
  [FOREST_VARIANTS.MAGIC_FOREST]: createVariantConfig({
    id: FOREST_VARIANTS.MAGIC_FOREST,
    displayName: "Magic Forest",
    nodeTier: FOREST_NODE_TIERS.RISKY,
    treeSpriteSources: MAGIC_FOREST_TREE_SPRITES,
    groundTypeId: "grass_magic",
    obstaclePoolId: "magic_forest_obstacle_pool",
    enemyPoolId: "magic_forest_pool"
  }),
  [FOREST_VARIANTS.SHALLOW_SPIDER_HABITAT]: createVariantConfig({
    id: FOREST_VARIANTS.SHALLOW_SPIDER_HABITAT,
    displayName: "Shallow Spider Habitat",
    nodeTier: FOREST_NODE_TIERS.RISKY,
    treeSpriteSources: SHALLOW_SPIDER_HABITAT_TREE_SPRITES,
    groundTypeId: "grass_shallow_spider",
    obstaclePoolId: "shallow_spider_obstacle_pool",
    enemyPoolId: "shallow_spider_pool"
  }),
  [FOREST_VARIANTS.DEAD_FOREST]: createVariantConfig({
    id: FOREST_VARIANTS.DEAD_FOREST,
    displayName: "Dead Forest",
    nodeTier: FOREST_NODE_TIERS.DEADLY,
    treeSpriteSources: DEAD_FOREST_TREE_SPRITES,
    groundTypeId: "grass_dead",
    obstaclePoolId: "dead_forest_obstacle_pool",
    enemyPoolId: "dead_forest_pool"
  }),
  [FOREST_VARIANTS.DEEP_SPIDER_HABITAT]: createVariantConfig({
    id: FOREST_VARIANTS.DEEP_SPIDER_HABITAT,
    displayName: "Deep Spider Habitat",
    nodeTier: FOREST_NODE_TIERS.DEADLY,
    treeSpriteSources: DEEP_SPIDER_HABITAT_TREE_SPRITES,
    groundTypeId: "grass_deep_spider",
    obstaclePoolId: "deep_spider_obstacle_pool",
    enemyPoolId: "deep_spider_pool"
  })
});

export const DEFAULT_FOREST_VARIANT_ID = FOREST_VARIANTS.WOODS;

export function getForestVariantConfig(variantId) {
  return FOREST_VARIANT_CONFIG[variantId] || FOREST_VARIANT_CONFIG[DEFAULT_FOREST_VARIANT_ID];
}

export function getForestVariantEnemyPool(enemyPoolId) {
  if (enemyPoolId && FOREST_VARIANT_ENEMY_POOLS[enemyPoolId]) return FOREST_VARIANT_ENEMY_POOLS[enemyPoolId];
  return FOREST_VARIANT_ENEMY_POOLS.default_forest_pool;
}

export function getForestVariantObstaclePool(obstaclePoolId) {
  if (obstaclePoolId && FOREST_VARIANT_OBSTACLE_POOLS[obstaclePoolId]) return FOREST_VARIANT_OBSTACLE_POOLS[obstaclePoolId];
  return FOREST_VARIANT_OBSTACLE_POOLS.default_forest_obstacle_pool;
}
