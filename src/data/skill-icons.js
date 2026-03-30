export const SKILL_ICON_ATLASES = Object.freeze({
  primary: {
    imageAssetKey: "skillIconsSheet1",
    defsAssetKey: "skillIconsSheet1Defs",
    src: "./assets/UI/UI Sprites/16 Skill Icons.png",
    defsSrc: "./assets/UI/UI Sprites/16 Skill Icons.json"
  },
  secondary: {
    imageAssetKey: "skillIconsSheet2",
    defsAssetKey: "skillIconsSheet2Defs",
    src: "./assets/UI/UI Sprites/16 Skill 2.png",
    defsSrc: "./assets/UI/UI Sprites/16 Skill 2.json"
  }
});

export const SKILL_ICON_ATLAS_BY_SKILL_ID = Object.freeze({
  fireball: "primary",
  iceShard: "primary",
  healPulse: "primary",
  iceRain: "primary",
  chainFrost: "primary",
  whirlwind: "primary",
  earthquake: "primary",
  escapePlan: "primary",
  meteorRain: "primary",
  hauntingGhostCharges: "primary",
  frenzyProtocol: "primary",
  spiritBanner: "primary",
  spiderTrap: "primary",
  loyalDragons: "primary",
  blackHole: "primary",
  waveShield: "primary",
  knifeNova: "secondary",
  hunterShot: "secondary",
  homingSkullCharges: "secondary",
  lockpick: "secondary",
  purifyingFire: "secondary",
  cruelFinisher: "secondary",
  magicHand: "secondary",
  assimilativeOrb: "secondary",
  bloodFrenzy: "secondary",
  bloodSacrifice: "secondary",
  bloodPact: "secondary",
  bloodAmmo: "secondary",
  trickstersKit: "secondary",
  ancestralShout: "secondary",
  shadowHeist: "secondary",
  loadedDice: "secondary"
});

export function getSkillIconFrame(assets, skillId) {
  const atlasId = SKILL_ICON_ATLAS_BY_SKILL_ID[skillId];
  if (!atlasId) return null;
  const atlas = SKILL_ICON_ATLASES[atlasId];
  const defs = assets?.[atlas.defsAssetKey];
  const image = assets?.[atlas.imageAssetKey];
  const frame = defs?.frames?.[skillId]?.frame;
  if (!defs || !image || !frame) return null;
  return {
    image,
    frame,
    imageSrc: atlas.src,
    size: defs.meta?.size || { w: image.naturalWidth, h: image.naturalHeight }
  };
}

export function getSkillIconCssStyle(assets, skillId, targetWidth = 40, targetHeight = 40) {
  const icon = getSkillIconFrame(assets, skillId);
  if (!icon) return "";
  const scaleX = targetWidth / Math.max(1, icon.frame.w);
  const scaleY = targetHeight / Math.max(1, icon.frame.h);
  return [
    `background-image:url("${icon.imageSrc}")`,
    `background-position:-${icon.frame.x * scaleX}px -${icon.frame.y * scaleY}px`,
    `background-size:${icon.size.w * scaleX}px ${icon.size.h * scaleY}px`,
    "background-repeat:no-repeat"
  ].join(";");
}

export function getSkillIconDomStyle(assets, skillId, targetWidth = 40, targetHeight = 40) {
  const icon = getSkillIconFrame(assets, skillId);
  if (!icon) return null;
  const scaleX = targetWidth / Math.max(1, icon.frame.w);
  const scaleY = targetHeight / Math.max(1, icon.frame.h);
  return {
    src: icon.imageSrc,
    width: icon.size.w * scaleX,
    height: icon.size.h * scaleY,
    marginLeft: -(icon.frame.x * scaleX),
    marginTop: -(icon.frame.y * scaleY)
  };
}
