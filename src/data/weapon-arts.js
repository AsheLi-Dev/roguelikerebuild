export const WEAPON_ARTS = Object.freeze([
  {
    id: "projectile",
    name: "Elemental Shot",
    description: "Fire elemental projectiles and cycle between elemental patterns.",
    illustration: "assets/UI/Projectile Shot.png",
    tags: ["projectile", "ranged"]
  },
  {
    id: "windVolley",
    name: "Wind Volley",
    description: "Movement-driven archery that grows stronger as momentum builds.",
    illustration: "assets/UI/Projectile Shot.png",
    tags: ["projectile", "ranged"]
  },
  {
    id: "bladeBlast",
    name: "Blade & Blast",
    description: "A hybrid blade style that chains cutting strikes into explosive follow-through.",
    illustration: "assets/UI/Blade Storm.png",
    tags: ["melee", "hybrid"]
  },
  {
    id: "soulSiphon",
    name: "Soul Siphon",
    description: "A beam-driven spiritcraft style that channels dark power toward the cursor.",
    illustration: "assets/UI/Projectile Shot.png",
    tags: ["ranged", "beam"]
  },
  {
    id: "guardCombo",
    name: "Guard Combo",
    description: "A grounded sword-and-shield combo that rewards deliberate front-line timing.",
    illustration: "assets/UI/Shield Bash.png",
    tags: ["melee"]
  }
]);

const WEAPON_ART_BY_ID = Object.freeze(
  Object.fromEntries(WEAPON_ARTS.map((weaponArt) => [weaponArt.id, weaponArt]))
);

export function getWeaponArtDef(weaponArtId) {
  return WEAPON_ART_BY_ID[weaponArtId] || null;
}

export function getWeaponArtKind(weaponArtId) {
  const tags = new Set(getWeaponArtDef(weaponArtId)?.tags || []);
  if (tags.has("hybrid")) return "hybrid";
  if (tags.has("melee")) return "melee";
  return "ranged";
}

export function hasWeaponArtTag(weaponArtId, tag) {
  return (getWeaponArtDef(weaponArtId)?.tags || []).includes(tag);
}
