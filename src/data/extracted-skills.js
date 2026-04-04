export const EXTRACTED_SKILL_CATEGORIES = {
  projectile: "Projectile",
  melee: "Melee",
  aura: "Aura"
};

export const EXTRACTED_DAMAGE_SCALING_TIERS = {
  S: 0.3,
  A: 0.2,
  B: 0.1,
  C: 0.05
};

export const EXTRACTED_HEAL_SCALING_TIERS = EXTRACTED_DAMAGE_SCALING_TIERS;

export const EXTRACTED_SKILL_IDS = [
  "fireball",
  "iceShard",
  "knifeNova",
  "healPulse",
  "iceRain",
  "chainFrost",
  "whirlwind",
  "earthquake",
  "escapePlan",
  "meteorRain",
  "hauntingGhostCharges",
  "frenzyProtocol",
  "spiritBanner",
  "spiderTrap",
  "loyalDragons",
  "blackHole",
  "waveShield",
  "magicHand",
  "purifyingFire",
  "hunterShot",
  "assimilativeOrb",
  "cruelFinisher",
  "homingSkullCharges",
  "bloodFrenzy",
  "bloodSacrifice",
  "bloodPact",
  "bloodAmmo",
  "bloodDebt",
  "lockpick",
  "shatterPulse",
  "execution",
  "lightningCascade",
  "bloodCrave",
  "trickstersKit",
  "fortuneCollapse",
  "shadowHeist",
  "loadedDice",
  "ancestralShout"
];

export const EXTRACTED_SKILL_DEFS = [
  {
    id: "fireball",
    name: "Fireball",
    icon: "spr_skill_fireball",
    illustration: "assets/UI/Fireball.png",
    baseCd: 3,
    desc: "Slow projectile, explodes for area damage + burning ground 3s",
    unlock: "always",
    category: "projectile",
    tags: ["projectile", "ranged", "area"],
    scalingPrimary: "A",
    scalingStat1: "brutality",
    scalingSecondary: "C",
    scalingStat2: "luck",
    archiveRuntime: {
      effectType: "fireball",
      projectileBaseMult: 1.5,
      supportsVolley: true,
      volleySpreadDeg: 30,
      volleyProjectileMult: 0.7
    }
  },
  {
    id: "iceShard",
    name: "Ice Shard",
    icon: "spr_skill_iceShard",
    illustration: "assets/UI/Ice Shard.png",
    baseCd: 2,
    desc: "Fast piercing projectile, slows 30% for 2s",
    unlock: "always",
    category: "projectile",
    tags: ["projectile", "ranged"],
    scalingPrimary: "B",
    scalingStat1: "brutality",
    scalingSecondary: "B",
    scalingStat2: "agility"
  },
  {
    id: "knifeNova",
    name: "Knife Nova",
    icon: "spr_skill_bladeDash",
    illustration: "assets/UI/Blade Dash.png",
    baseCd: 9,
    desc: "Throw 8 knives in a full circle; knives pierce, ricochet, and inflict bleed",
    unlock: "always",
    category: "projectile",
    tags: ["projectile", "area", "ranged"],
    scalingPrimary: "B",
    scalingStat1: "agility",
    scalingSecondary: "C",
    scalingStat2: "luck",
    archiveRuntime: {
      projectileType: "knife",
      projectileCount: 8,
      radialBurst: true,
      pierce: 2,
      bouncesOffWalls: true,
      appliesBleedStacks: 1
    }
  },
  {
    id: "healPulse",
    name: "Heal Pulse",
    icon: "spr_skill_healPulse",
    illustration: "assets/UI/Heal Pulse.png",
    baseCd: 10,
    desc: "Restore 15% max health",
    unlock: "always",
    category: "projectile",
    tags: ["area", "defense", "utility"],
    healScalingPrimary: "C",
    healScalingStat1: "vitality",
    archiveRuntime: {
      healPercentMaxHp: 0.15,
      healMinimumFlat: 15
    }
  },
  {
    id: "iceRain",
    name: "Ice Rain",
    icon: "spr_skill_iceRain",
    illustration: "assets/UI/Ice Rain.png",
    baseCd: 12,
    desc: "Ice storm 4s, continuous damage, slow 50%",
    unlock: "scavengerFull",
    category: "projectile",
    tags: ["area", "ranged"],
    scalingPrimary: "B",
    scalingStat1: "brutality",
    scalingSecondary: "B",
    scalingStat2: "agility",
    archiveRuntime: {
      effectType: "iceRain",
      duration: 4,
      radius: 180,
      tickRatePerSecond: 4,
      slowMult: 0.5
    }
  },
  {
    id: "chainFrost",
    name: "Chain Frost",
    icon: "spr_skill_chainFrost",
    illustration: "assets/UI/Chain Frost.png",
    baseCd: 18,
    desc: "Freeze all enemies 2s",
    unlock: "iceShard5",
    category: "projectile",
    tags: ["area", "crowd_control"],
    scalingPrimary: "A",
    scalingStat1: "brutality",
    scalingSecondary: "B",
    scalingStat2: "luck",
    archiveRuntime: {
      effectType: "chainFrost",
      freezeDuration: 2
    }
  },
  {
    id: "whirlwind",
    name: "Whirlwind",
    icon: "spr_skill_whirlwind",
    illustration: "assets/UI/Whirlwind.png",
    baseCd: 10,
    desc: "Spin 2s hitting nearby enemies, move at half speed",
    unlock: "always",
    category: "melee",
    tags: ["melee", "area"],
    scalingPrimary: "B",
    scalingStat1: "brutality",
    scalingSecondary: "B",
    scalingStat2: "agility",
    archiveRuntime: {
      effectType: "whirlwind",
      duration: 2,
      damageMult: 0.4,
      radius: 80,
      hitIntervalBase: 0.15,
      moveSpeedMult: 0.5
    }
  },
  {
    id: "earthquake",
    name: "Earthquake",
    icon: "spr_skill_earthquake",
    illustration: "assets/UI/Earthquake.png",
    baseCd: 18,
    desc: "Map shake 3s, damage and slow enemies within 200px",
    unlock: "diff4",
    category: "melee",
    tags: ["area", "crowd_control"],
    scalingPrimary: "A",
    scalingStat1: "brutality",
    scalingSecondary: "B",
    scalingStat2: "vitality",
    archiveRuntime: {
      effectType: "earthquake",
      duration: 3,
      damageMult: 0.3,
      slowMult: 0.6,
      slowDuration: 3,
      tickRatePerSecond: 4
    }
  },
  {
    id: "escapePlan",
    name: "Escape Plan",
    icon: "spr_skill_bladeDash",
    illustration: "assets/UI/Blade Dash.png",
    baseCd: 14,
    desc: "Random-direction teleport exactly 200px, damages nearby enemies; if enemies remain nearby, fully refunds cooldown",
    unlock: "always",
    category: "melee",
    tags: ["utility", "area"],
    scalingPrimary: "C",
    scalingStat1: "agility",
    scalingSecondary: "C",
    scalingStat2: "luck",
    archiveRuntime: {
      effectType: "escapePlan",
      teleportDelay: 0.2,
      teleportRadius: 200,
      maxTeleports: 1,
      safeRadius: 100,
      fullCooldownRefundIfEnemiesRemainNearby: true
    }
  },
  {
    id: "meteorRain",
    name: "Meteor Rain",
    icon: "spr_skill_meteor",
    illustration: "assets/UI/Meteor.png",
    baseCd: 18,
    desc: "Charge up to 5s; meteor field around player, follows you",
    unlock: "diff4",
    category: "projectile",
    tags: ["area", "ranged"],
    scalingPrimary: "S",
    scalingStat1: "brutality",
    scalingSecondary: "B",
    scalingStat2: "luck",
    archiveRuntime: {
      charging: {
        enabled: true,
        chargeCapSeconds: 5,
        baseChargeMultiplier: 1,
        releaseMultiplierFormula: "1 + min(1, chargeDuration / 5)"
      },
      effectType: "meteorRainField",
      durationFormula: "3 + chargeSec * 0.5",
      radiusFormula: "80 + chargeSec * 20",
      damageFormula: "(0.5 + chargeSec * 0.1) * chargeMult",
      tickInterval: 0.35,
      followsPlayer: true
    }
  },
  {
    id: "hauntingGhostCharges",
    name: "Haunting Ghost Charges",
    icon: "spr_skill_chainFrost",
    illustration: "assets/UI/Chain Frost.png",
    baseCd: 0,
    desc: "Gain charge per 5 kills; spend to summon ghost that slows and explodes after 2s",
    unlock: "always",
    category: "projectile",
    tags: ["area", "crowd_control"],
    scalingPrimary: "B",
    scalingStat1: "brutality",
    scalingSecondary: "C",
    scalingStat2: "luck",
    archiveRuntime: {
      chargeRule: {
        source: "kills",
        killsPerCharge: 5,
        uiCountMode: "floor(kills / 5)",
        maxChargesForCastCheck: 3,
        chargesConsumedPerCast: 1
      },
      effectType: "hauntingGhost",
      duration: 2,
      radius: 80,
      slowMult: 0.5,
      damageMult: 1
    }
  },
  {
    id: "frenzyProtocol",
    name: "Frenzy Protocol",
    icon: "spr_skill_rapidFire",
    illustration: "assets/UI/Rapid Fire.png",
    baseCd: 15,
    desc: "Basic attack auto-fires 5s, +40% attack speed",
    unlock: "always",
    category: "projectile",
    tags: ["utility"],
    scalingPrimary: "C",
    scalingStat1: "agility",
    scalingSecondary: "C",
    scalingStat2: "brutality",
    archiveRuntime: {
      buffDuration: 5,
      autoAttackDuration: 5,
      attackSpeedBonus: 0.4
    }
  },
  {
    id: "spiritBanner",
    name: "Spirit Banner",
    icon: "spr_skill_healPulse",
    illustration: "assets/UI/Heal Pulse.png",
    baseCd: 20,
    desc: "Summon spirit at location; move and attack speed nearby",
    unlock: "always",
    category: "projectile",
    tags: ["utility", "area"],
    scalingPrimary: "C",
    scalingStat1: "vitality",
    scalingSecondary: "B",
    scalingStat2: "luck",
    archiveRuntime: {
      effectType: "spiritBanner",
      duration: 15,
      radius: 120,
      appliedStatus: {
        statusId: "spiritBanner",
        refreshDuration: 0.15,
        magnitude: 1.15
      }
    }
  },
  {
    id: "spiderTrap",
    name: "Spider Trap",
    icon: "spr_skill_iceShard",
    illustration: "assets/UI/Ice Shard.png",
    baseCd: 10,
    desc: "Dormant trap; spider bite 3s, resets if victim dies during bite",
    unlock: "always",
    category: "projectile",
    tags: ["crowd_control", "area"],
    scalingPrimary: "C",
    scalingStat1: "luck",
    scalingSecondary: "C",
    scalingStat2: "agility",
    archiveRuntime: {
      effectType: "spiderTrap",
      duration: 60,
      radius: 50,
      biteDuration: 3,
      resetsIfVictimDiesDuringBite: true
    }
  },
  {
    id: "loyalDragons",
    name: "Loyal Dragons",
    icon: "spr_skill_phoenixStrike",
    illustration: "assets/UI/Phoenix Strike.png",
    baseCd: 22,
    desc: "2 orbiting dragons, contact damage; spit fireballs on your basic attack",
    unlock: "diff3",
    category: "melee",
    tags: ["melee", "area", "projectile"],
    scalingPrimary: "B",
    scalingStat1: "brutality",
    scalingSecondary: "B",
    scalingStat2: "luck",
    archiveRuntime: {
      effectType: "loyalDragons",
      duration: 12,
      orbitRadius: 70,
      contactHitRadius: 25,
      contactDamageMult: 0.3,
      dragonProjectileInterval: 1
    }
  },
  {
    id: "blackHole",
    name: "Black Hole",
    icon: "spr_skill_voidRift",
    illustration: "assets/UI/Void Rift.png",
    baseCd: 16,
    desc: "Pulls enemies and player",
    unlock: "diff5",
    category: "projectile",
    tags: ["area", "crowd_control"],
    scalingPrimary: "A",
    scalingStat1: "brutality",
    scalingSecondary: "B",
    scalingStat2: "luck",
    archiveRuntime: {
      effectType: "blackHole",
      duration: 4,
      radius: 180,
      pullStrength: 120,
      damageMult: 0.4,
      affectsPlayer: true
    }
  },
  {
    id: "waveShield",
    name: "Wave Shield",
    icon: "spr_skill_shieldBash",
    illustration: "assets/UI/Shield Bash.png",
    baseCd: 8,
    desc: "Orbiting wave knocks back and heals you",
    unlock: "always",
    category: "projectile",
    tags: ["defense", "crowd_control"],
    scalingPrimary: "C",
    scalingStat1: "brutality",
    healScalingPrimary: "C",
    healScalingStat1: "vitality",
    archiveRuntime: {
      effectType: "waveShield",
      duration: 6,
      orbitRadius: 55,
      knockback: 100,
      healPctOnHit: 0.05
    }
  },
  {
    id: "magicHand",
    name: "Magic Hand",
    icon: "spr_skill_voidRift",
    illustration: "assets/UI/Void Rift.png",
    baseCd: 12,
    desc: "Grab enemies in area, move them to location",
    unlock: "always",
    category: "projectile",
    tags: ["crowd_control", "area"],
    scalingPrimary: "C",
    scalingStat1: "luck",
    scalingSecondary: "C",
    scalingStat2: "vitality",
    archiveRuntime: {
      effectType: "magicHand",
      duration: 0.8,
      grabRadius: 80,
      movesVictimsToTarget: true
    }
  },
  {
    id: "purifyingFire",
    name: "Purifying Fire",
    icon: "spr_skill_flameAura",
    illustration: "assets/UI/Flame Aura.png",
    baseCd: 18,
    desc: "Lose 5% HP/s 5s, same damage to nearby; then heal 50% of damage, cap 40% max HP",
    unlock: "always",
    category: "aura",
    tags: ["area", "defense"],
    scalingPrimary: "B",
    scalingStat1: "brutality",
    scalingSecondary: "C",
    scalingStat2: "luck",
    healScalingPrimary: "B",
    healScalingStat1: "vitality",
    archiveRuntime: {
      effectType: "purifyingFire",
      auraMode: "oneShotNonToggle",
      duration: 5,
      hpPctPerSecondCost: 0.05,
      radius: 100,
      damageMult: 1,
      healPctOfDamage: 0.5,
      healCapPctMaxHp: 0.4
    }
  },
  {
    id: "hunterShot",
    name: "Hunter Shot",
    icon: "spr_skill_rapidFire",
    illustration: "assets/UI/Rapid Fire.png",
    baseCd: 5,
    desc: "Homing projectile; on hit gain attack speed; basic attacks reduce its CD 0.1s",
    unlock: "always",
    category: "projectile",
    tags: ["projectile", "ranged"],
    scalingPrimary: "A",
    scalingStat1: "brutality",
    scalingSecondary: "A",
    scalingStat2: "agility",
    archiveRuntime: {
      effectType: "hunterShot",
      projectileSpeed: 420,
      maxRange: 500,
      damageMult: 1,
      homing: true,
      onHitAttackSpeedStackDuration: 5,
      basicAttackCooldownReduction: 0.1
    }
  },
  {
    id: "assimilativeOrb",
    name: "Assimilative Orb",
    icon: "spr_skill_voidRift",
    illustration: "assets/UI/Void Rift.png",
    baseCd: 14,
    desc: "5s orb absorbs projectiles, fires on absorb; explodes on expiry",
    unlock: "diff4",
    category: "projectile",
    tags: ["area", "ranged"],
    scalingPrimary: "A",
    scalingStat1: "brutality",
    scalingSecondary: "B",
    scalingStat2: "luck",
    archiveRuntime: {
      effectType: "assimilativeOrb",
      duration: 5,
      radius: 40,
      absorbedProjectileScalingRadius: 8,
      absorbedProjectileScalingDamage: 0.15,
      expiryBaseDamageMult: 0.5,
      followsPlayer: true
    }
  },
  {
    id: "cruelFinisher",
    name: "Cruel Finisher",
    icon: "spr_skill_bladeDash",
    illustration: "assets/UI/Blade Dash.png",
    baseCd: 10,
    desc: "Usable after 5 basic attacks; massive damage from target missing HP",
    unlock: "always",
    category: "melee",
    tags: ["melee"],
    scalingPrimary: "S",
    scalingStat1: "brutality",
    scalingSecondary: "A",
    scalingStat2: "luck",
    archiveRuntime: {
      chargeRule: {
        source: "basicAttacks",
        basicsRequired: 5,
        uiMax: 5
      },
      targeting: {
        nearestEnemyRange: 300
      },
      damageFormula: "1 + missingHpPct * 2",
      resetsCounterOnCast: true
    }
  },
  {
    id: "homingSkullCharges",
    name: "Homing Skull Charges",
    icon: "spr_skill_chainFrost",
    illustration: "assets/UI/Chain Frost.png",
    baseCd: 0,
    desc: "Fire homing skull; gain charge per 3 kills, max 3",
    unlock: "always",
    category: "projectile",
    tags: ["projectile", "ranged"],
    scalingPrimary: "B",
    scalingStat1: "brutality",
    scalingSecondary: "C",
    scalingStat2: "luck",
    archiveRuntime: {
      chargeRule: {
        source: "kills",
        killsPerCharge: 3,
        maxCharges: 3,
        uiDisplayMode: "min(3, floor(kills / 3))",
        chargesConsumedPerCast: 1
      },
      projectileSpeed: 350,
      maxRange: 450,
      damageMult: 0.9,
      homing: true
    }
  },
  {
    id: "bloodFrenzy",
    name: "Blood Frenzy",
    icon: "spr_skill_rapidFire",
    illustration: "assets/UI/Rapid Fire.png",
    baseCd: 12,
    desc: "Lose 20% HP, gain attack speed",
    unlock: "always",
    category: "projectile",
    tags: ["utility"],
    scalingPrimary: "B",
    scalingStat1: "brutality",
    scalingSecondary: "B",
    scalingStat2: "agility",
    archiveRuntime: {
      selfDamagePctMaxHp: 0.2,
      canKillSelf: false,
      buffDuration: 8,
      attackSpeedMult: 1.4
    }
  },
  {
    id: "bloodSacrifice",
    name: "Blood Sacrifice",
    icon: "spr_skill_healPulse",
    illustration: "assets/UI/Heal Pulse.png",
    baseCd: 20,
    desc: "Lose 20% HP, reduce cooldown of other skills",
    unlock: "always",
    category: "projectile",
    tags: ["utility"],
    scalingPrimary: "C",
    scalingStat1: "vitality",
    scalingSecondary: "B",
    scalingStat2: "luck",
    archiveRuntime: {
      selfDamagePctMaxHp: 0.2,
      canKillSelf: false,
      otherSkillCooldownReduction: 5
    }
  },
  {
    id: "bloodPact",
    name: "Blood Pact",
    icon: "spr_skill_soulAura",
    illustration: "assets/UI/Soul Aura.png",
    baseCd: 15,
    desc: "Lose 20% HP, gain lifesteal",
    unlock: "always",
    category: "projectile",
    tags: ["defense", "utility"],
    scalingPrimary: "B",
    scalingStat1: "vitality",
    scalingSecondary: "B",
    scalingStat2: "brutality",
    archiveRuntime: {
      selfDamagePctMaxHp: 0.2,
      canKillSelf: false,
      lifestealBuffDuration: 5
    }
  },
  {
    id: "bloodAmmo",
    name: "Blood Ammo",
    icon: "spr_skill_rapidFire",
    illustration: "assets/UI/Rapid Fire.png",
    baseCd: 0,
    desc: "Basic attacks cost HP and gain damage",
    unlock: "always",
    category: "projectile",
    tags: ["utility"],
    scalingPrimary: "A",
    scalingStat1: "brutality",
    scalingSecondary: "C",
    scalingStat2: "vitality",
    archiveRuntime: {
      mode: "persistentFlag",
      stateKey: "bloodAmmoActive"
    }
  },
  {
    id: "bloodDebt",
    name: "Blood Debt",
    icon: "spr_skill_healPulse",
    illustration: "assets/UI/Heal Pulse.png",
    baseCd: 0,
    desc: "Blood-risk; kill to recover",
    unlock: "always",
    category: "projectile",
    tags: ["defense", "utility"],
    scalingPrimary: "B",
    scalingStat1: "brutality",
    scalingSecondary: "B",
    scalingStat2: "vitality",
    archiveRuntime: {
      mode: "persistentFlag",
      stateKey: "bloodDebtActive"
    }
  },
  {
    id: "lockpick",
    name: "Lockpick",
    icon: "spr_skill_healPulse",
    illustration: "assets/UI/Heal Pulse.png",
    baseCd: 40,
    desc: "Instantly open nearby chest",
    unlock: "always",
    category: "projectile",
    tags: ["utility"],
    scalingPrimary: "C",
    scalingStat1: "luck",
    scalingSecondary: "C",
    scalingStat2: "agility",
    archiveRuntime: {
      targetType: "searchable",
      range: 120,
      effect: "finishSearchNearestChest"
    }
  },
  {
    id: "shatterPulse",
    name: "Shatter Pulse",
    icon: "spr_skill_groundSlam",
    illustration: "assets/UI/Ground Slam.png",
    baseCd: 6,
    desc: "Break nearby urns/breakables",
    unlock: "always",
    category: "melee",
    tags: ["area", "utility"],
    scalingPrimary: "C",
    scalingStat1: "vitality",
    scalingSecondary: "C",
    scalingStat2: "luck",
    archiveRuntime: {
      targetType: "breakables",
      radius: 120,
      damageFormula: "attack * 1.5"
    }
  },
  {
    id: "trickstersKit",
    name: "Trickster's Kit",
    icon: "spr_skill_healPulse",
    illustration: "assets/UI/Heal Pulse.png",
    baseCd: 12,
    desc: "Random: move speed, dash charge, mimic loot, or luck bomb",
    unlock: "always",
    category: "projectile",
    tags: ["utility"],
    scalingPrimary: "C",
    scalingStat1: "luck",
    scalingSecondary: "A",
    scalingStat2: "agility",
    archiveRuntime: {
      randomOutcomes: ["moveSpeed", "dashCharge", "mimicLoot", "luckBomb"],
      moveSpeedDuration: 6,
      mimicLootCount: 2,
      luckBombDuration: 8
    }
  },
  {
    id: "fortuneCollapse",
    name: "Fortune Collapse",
    icon: "spr_skill_voidRift",
    illustration: "assets/UI/Void Rift.png",
    baseCd: 25,
    desc: "Luck to 0 for 10s, gain shield from lost Luck; restore after",
    unlock: "always",
    category: "projectile",
    tags: ["defense", "utility"],
    scalingPrimary: "B",
    scalingStat1: "luck",
    scalingSecondary: "C",
    scalingStat2: "vitality",
    archiveRuntime: {
      duration: 10,
      setsLuckToZeroTemporarily: true,
      shieldFormula: "min(100, storedLuck * 2)"
    }
  },
  {
    id: "shadowHeist",
    name: "Shadow Heist",
    icon: "spr_skill_bladeDash",
    illustration: "assets/UI/Blade Dash.png",
    baseCd: 18,
    desc: "Invisibility 5s; attacks break it; charge after 2 chests opened",
    unlock: "always",
    category: "melee",
    tags: ["utility"],
    scalingPrimary: "C",
    scalingStat1: "agility",
    scalingSecondary: "C",
    scalingStat2: "luck",
    archiveRuntime: {
      invisibilityDuration: 5,
      brokenByAttacking: true,
      archiveNote: "description references chest-open charge gating; base runtime branch applies invisibility directly"
    }
  },
  {
    id: "execution",
    name: "Execution",
    icon: "spr_skill_bladeDash",
    illustration: "assets/UI/Blade Dash.png",
    baseCd: 14,
    desc: "Slash a target area within 300 range. Hits on frame 3, dealing 50% ATK above 50% HP or 150% ATK at 50% HP and below. Killing refunds skill cooldowns.",
    unlock: "always",
    category: "melee",
    tags: ["melee", "area", "execute"],
    scalingPrimary: "A",
    scalingStat1: "brutality",
    scalingSecondary: "B",
    scalingStat2: "luck",
    archiveRuntime: {
      effectType: "execution",
      maxRange: 300,
      radius: 64,
      frameWidth: 128,
      frameHeight: 128,
      hitFrame: 3,
      damageAboveHalfMult: 0.5,
      damageAtOrBelowHalfMult: 1.5,
      refundAllCooldownsOnKill: true
    }
  },
  {
    id: "lightningCascade",
    name: "Lightning Cascade",
    icon: "spr_skill_chainFrost",
    illustration: "assets/UI/Chain Frost.png",
    baseCd: 16,
    desc: "Call down a lightning strike on a nearby enemy every 0.5s for 5s. Each strike deals 50% ATK damage.",
    unlock: "always",
    category: "projectile",
    tags: ["area", "projectile", "lightning"],
    scalingPrimary: "A",
    scalingStat1: "brutality",
    scalingSecondary: "B",
    scalingStat2: "luck",
    archiveRuntime: {
      effectType: "lightningCascade",
      duration: 5,
      tickInterval: 0.5,
      damageMult: 0.5,
      frameWidth: 128,
      frameHeight: 400,
      hitFrame: 2
    }
  },
  {
    id: "bloodCrave",
    name: "Blood Crave",
    icon: "spr_skill_healPulse",
    illustration: "assets/UI/Heal Pulse.png",
    baseCd: 12,
    desc: "Gain 20% move speed and attack speed for 5s. Kills extend the buff by 1s, up to 5s remaining.",
    unlock: "always",
    category: "aura",
    tags: ["utility", "buff"],
    scalingPrimary: "C",
    scalingStat1: "agility",
    scalingSecondary: "C",
    scalingStat2: "vitality",
    archiveRuntime: {
      effectType: "bloodCrave",
      duration: 5,
      maxDuration: 5,
      moveSpeedMult: 1.2,
      attackSpeedMult: 1.2,
      killExtendSeconds: 1
    }
  },
  {
    id: "loadedDice",
    name: "Loaded Dice",
    icon: "spr_skill_healPulse",
    illustration: "assets/UI/Heal Pulse.png",
    baseCd: 30,
    desc: "Luck-gambling; random powerful effect",
    unlock: "always",
    category: "projectile",
    tags: ["utility"],
    scalingPrimary: "C",
    scalingStat1: "luck",
    scalingSecondary: "B",
    scalingStat2: "agility",
    archiveRuntime: {
      randomOutcomes: ["damageBuff", "cooldownReset", "gold", "heal"],
      damageBuffDuration: 15,
      goldRange: [50, 99],
      healPctMaxHp: 0.4
    }
  },
  {
    id: "ancestralShout",
    name: "Ancestral Shout",
    icon: "spr_skill_healPulse",
    illustration: "assets/UI/Heal Pulse.png",
    baseCd: 20,
    desc: "Nearby allies +10% damage per ancestral spirit",
    unlock: "always",
    category: "projectile",
    tags: ["utility", "area"],
    scalingPrimary: "B",
    scalingStat1: "vitality",
    scalingSecondary: "B",
    scalingStat2: "luck",
    archiveRuntime: {
      effectType: "ancestralShout",
      duration: 8,
      radius: 150,
      perSpiritDamageBonus: 0.1
    }
  }
];

const EXTRACTED_SKILL_DEF_BY_ID = new Map(EXTRACTED_SKILL_DEFS.map((skill) => [skill.id, skill]));

export function getExtractedSkillById(skillId) {
  return EXTRACTED_SKILL_DEF_BY_ID.get(String(skillId || "")) || null;
}

export function getAllExtractedSkills() {
  return [...EXTRACTED_SKILL_DEFS];
}
