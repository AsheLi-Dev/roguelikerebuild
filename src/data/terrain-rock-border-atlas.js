export const ROCK_BORDER_IMAGE_SRC =
  "assets/biomes/openworld/groundhillsa.png";

function sprite(id, x, y, w, h, options = {}) {
  return {
    id,
    x,
    y,
    w,
    h,
    weight: options.weight ?? 1,
    anchorX: options.anchorX ?? Math.floor(w * 0.5),
    anchorY: options.anchorY ?? Math.floor(h * 0.8),
    offsetX: options.offsetX ?? 0,
    offsetY: options.offsetY ?? 0,
    depthHint: options.depthHint ?? 0,
  };
}

export const ROCK_BORDER_ATLAS = {
  // Top edge clusters, left -> right
  top: [
    sprite("top_1", 128, 52, 64, 44, { weight: 2, anchorY: 38 }),
    sprite("top_2", 224, 96, 96, 64, { weight: 3, anchorY: 56 }),
    sprite("top_3", 339, 64, 77, 64, { weight: 2, anchorY: 56 }),
    sprite("top_left", 448, 24, 64, 72, { weight: 2, anchorY: 64 }),
    sprite("top_5", 640, 26, 96, 102, { weight: 3, anchorY: 94 }),
    sprite("top_6", 768, 35, 128, 93, { weight: 4, anchorY: 84 }),
    sprite("top_7", 928, 32, 96, 64, { weight: 4, anchorY: 56 }),
    sprite("top_8", 1056, 21, 128, 75, { weight: 2, anchorY: 66 }),
    sprite("top_9", 1216, 7, 160, 89, { weight: 2, anchorY: 80 }),
    sprite("top_right", 1408, 24, 64, 72, { weight: 1, anchorY: 64 }),
    sprite("top_11", 1504, 64, 77, 64, { weight: 1, anchorY: 56 }),
    sprite("top_12", 1600, 96, 96, 64, { weight: 1, anchorY: 56 }),
    sprite("top_13", 1728, 52, 64, 44, { weight: 1, anchorY: 38 }),
  ],
  topFlat: [
    sprite("top_flat_8", 1056, 21, 128, 75, { weight: 3, anchorY: 66 }),
    sprite("top_flat_9", 1216, 7, 160, 89, { weight: 3, anchorY: 80 }),
  ],

  // Bottom edge chunks, left -> right (CSS background-position negated → x, y)
  bottom: [
    sprite("bottom_left", 24, 864, 104, 128, { weight: 2, anchorY: 16, depthHint: 1 }),
    sprite("bottom_2", 160, 800, 96, 128, { weight: 3, anchorY: 16 }),
    sprite("bottom_3", 288, 832, 96, 160, { weight: 3, anchorY: 18, depthHint: 1 }),
    sprite("bottom_4", 416, 896, 64, 96, { weight: 2, anchorY: 14 }),
    sprite("bottom_5", 512, 896, 160, 128, { weight: 4, anchorY: 16, depthHint: 1 }),
    sprite("bottom_6", 704, 896, 128, 96, { weight: 3, anchorY: 14 }),
    sprite("bottom_7", 864, 896, 64, 96, { weight: 2, anchorY: 14 }),
    sprite("bottom_8", 992, 896, 64, 96, { weight: 2, anchorY: 14 }),
    sprite("bottom_9", 1088, 896, 128, 96, { weight: 3, anchorY: 14 }),
    sprite("bottom_10", 1248, 896, 160, 128, { weight: 4, anchorY: 16, depthHint: 1 }),
    sprite("bottom_11", 1440, 896, 64, 96, { weight: 2, anchorY: 14 }),
    sprite("bottom_12", 1536, 832, 96, 160, { weight: 3, anchorY: 18, depthHint: 1 }),
    sprite("bottom_13", 1664, 800, 96, 128, { weight: 3, anchorY: 16 }),
    sprite("bottom_right", 1792, 864, 104, 128, { weight: 2, anchorY: 16, depthHint: 1 }),
  ],

  // Side verticals (CSS bg pos negated → x,y).
  left: [
    sprite("left_1", 112, 128, 80, 64, { weight: 2, anchorY: 54 }),
    sprite("left_2", 98, 224, 94, 96, { weight: 3, anchorY: 82 }),
    sprite("left_3", 116, 352, 76, 32, { weight: 1, anchorY: 26 }),
    sprite("left_4", 100, 416, 92, 64, { weight: 2, anchorY: 54 }),
    sprite("left_5", 18, 512, 174, 224, { weight: 1, anchorY: 180, depthHint: 1 }),
    sprite("left_6", 26, 768, 38, 64, { weight: 1, anchorY: 54 }),
  ],
  leftFlat: [
    sprite("left_flat_1", 112, 128, 80, 64, { weight: 2, anchorY: 54 }),
    sprite("left_flat_2", 98, 224, 94, 96, { weight: 3, anchorY: 82 }),
    sprite("left_flat_3", 116, 352, 76, 32, { weight: 1, anchorY: 26 }),
    sprite("left_flat_4", 100, 416, 92, 64, { weight: 2, anchorY: 54 }),
  ],

  // Mirrored from left: right_x = ATLAS_W - left_x - w (ATLAS_W = 1920). Same y, w, h as paired left_*.
  right: [
    sprite("right_1", 1728, 128, 80, 64, { weight: 2, anchorY: 54 }),
    sprite("right_2", 1728, 224, 94, 96, { weight: 3, anchorY: 82 }),
    sprite("right_3", 1728, 352, 76, 32, { weight: 1, anchorY: 26 }),
    sprite("right_4", 1728, 416, 92, 64, { weight: 2, anchorY: 54 }),
    sprite("right_5", 1728, 512, 174, 224, { weight: 1, anchorY: 180, depthHint: 1 }),
    sprite("right_6", 1856, 768, 38, 64, { weight: 1, anchorY: 54 }),
  ],
  rightFlat: [
    sprite("right_flat_1", 1728, 128, 80, 64, { weight: 2, anchorY: 54 }),
    sprite("right_flat_2", 1728, 224, 94, 96, { weight: 3, anchorY: 82 }),
    sprite("right_flat_3", 1728, 352, 76, 32, { weight: 1, anchorY: 26 }),
    sprite("right_flat_4", 1728, 416, 92, 64, { weight: 2, anchorY: 54 }),
  ],

  // Real big outer corner masses
  outerCornerTL: [
    sprite("outer_tl_1", 14, 528, 136, 214, {
      weight: 3,
      anchorX: 42,
      anchorY: 162,
      depthHint: 1,
    }),
  ],
  outerCornerTR: [
    sprite("outer_tr_1", 1768, 528, 136, 214, {
      weight: 3,
      anchorX: 94,
      anchorY: 162,
      depthHint: 1,
    }),
  ],
  outerCornerBL: [
    sprite("outer_bl_1", 12, 850, 106, 140, {
      weight: 3,
      anchorX: 34,
      anchorY: 108,
      depthHint: 1,
    }),
  ],
  outerCornerBR: [
    sprite("outer_br_1", 1802, 850, 106, 140, {
      weight: 3,
      anchorX: 72,
      anchorY: 108,
      depthHint: 1,
    }),
  ],

  // Inner corner-ish elbows / turn pieces
  innerCornerTL: [
    sprite("inner_tl_1", 408, 138, 94, 82, { weight: 2, anchorY: 64 }),
  ],
  innerCornerTR: [
    sprite("inner_tr_1", 1412, 138, 94, 82, { weight: 2, anchorY: 64 }),
  ],
  innerCornerBL: [
    sprite("inner_bl_1", 138, 768, 122, 82, { weight: 2, anchorY: 60 }),
  ],
  innerCornerBR: [
    sprite("inner_br_1", 1410, 768, 122, 82, { weight: 2, anchorY: 60 }),
  ],

  // Small joiners / broken top-center pieces
  transition: [
    sprite("transition_1", 956, 170, 56, 24, { weight: 2, anchorY: 18 }),
    sprite("transition_2", 1060, 170, 56, 24, { weight: 2, anchorY: 18 }),
    sprite("transition_3", 838, 30, 50, 40, { weight: 1, anchorY: 28 }),
  ],

  // Loose micro rocks
  detail: [
    sprite("detail_1", 1720, 34, 42, 32, { weight: 2, anchorY: 24 }),
    sprite("detail_2", 1756, 346, 42, 28, { weight: 2, anchorY: 20 }),
    sprite("detail_3", 134, 346, 44, 28, { weight: 2, anchorY: 20 }),
    sprite("detail_4", 432, 22, 34, 24, { weight: 1, anchorY: 18 }),
  ],

  // Large bottom / side masses for special placement
  feature: [
    sprite("feature_1", 14, 528, 136, 214, {
      weight: 1,
      anchorX: 42,
      anchorY: 162,
      depthHint: 1,
    }),
    sprite("feature_2", 1768, 528, 136, 214, {
      weight: 1,
      anchorX: 94,
      anchorY: 162,
      depthHint: 1,
    }),
    sprite("feature_3", 512, 896, 160, 128, {
      weight: 1,
      anchorY: 16,
      depthHint: 1,
    }),
    sprite("feature_4", 1248, 896, 160, 128, {
      weight: 1,
      anchorY: 16,
      depthHint: 1,
    }),
  ],
};
