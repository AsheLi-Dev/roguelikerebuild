const UI_ATLAS_IMAGE_SRC = "./assets/UI/UI Sprites/UI elements.png";
const UI_ATLAS_DEFS_SRC = "./assets/UI/UI Sprites/UI elements.json";

const UI_SKIN_TOKENS = Object.freeze({
  primaryPanel: "panel_fancy_dark_large",
  secondaryPanel: "panel_fancy_dark_large_alt",
  tertiaryPanel: "panel_fancy_dark_outline",
  lightPanel: "panel_fancy_light_large_alt",
  blockPanel: "panel_rounded_dark_small",
  previewPanel: "panel_rounded_navy_small",
  primaryButton: "button_square_gold",
  switchOnButton: "button_square_light",
  dockButton: "button_square_dark",
  activeButton: "button_square_light_alt",
  card: "panel_rounded_dark_small",
  cardActive: "panel_rounded_gold_small",
  cardMuted: "panel_rounded_black_small",
  countPill: "bar_pill_small_gold",
  countPillMuted: "bar_pill_small_dark_alt",
  minimapShell: "panel_fancy_dark_outline",
  hpTrack: "progress_bar_long"
});

const UI_NINE_SLICE = Object.freeze({
  panel_fancy_dark_large: { slice: "24 fill", borderWidth: "24px", padding: "22px" },
  panel_fancy_dark_large_alt: { slice: "24 fill", borderWidth: "24px", padding: "22px" },
  panel_fancy_dark_empty: { slice: "24 fill", borderWidth: "24px", padding: "22px" },
  panel_fancy_dark_outline: { slice: "24 fill", borderWidth: "24px", padding: "1px" },
  panel_fancy_light_large_alt: { slice: "24 fill", borderWidth: "24px", padding: "18px" },
  panel_rounded_dark_small: { slice: "12 fill", borderWidth: "12px", padding: "12px" },
  panel_rounded_navy_small: { slice: "12 fill", borderWidth: "12px", padding: "10px" },
  panel_rounded_gold_small: { slice: "12 fill", borderWidth: "12px", padding: "10px" },
  panel_rounded_black_small: { slice: "12 fill", borderWidth: "12px", padding: "10px" },
  panel_rounded_black_outline_thick: { slice: "12 fill", borderWidth: "12px", padding: "10px" },
  button_square_gold: { slice: "10 fill", borderWidth: "10px 14px", padding: "8px 16px", repeat: "stretch" },
  button_square_light: { slice: "8 fill", borderWidth: "8px 12px", padding: "8px 14px", repeat: "stretch" },
  button_square_dark: { slice: "12 fill", borderWidth: "12px", padding: "8px 12px", repeat: "stretch" },
  button_square_light_alt: { slice: "12 fill", borderWidth: "12px", padding: "8px 12px", repeat: "stretch" },
  bar_pill_small_gold: { slice: "8 fill", borderWidth: "8px 12px", padding: "4px 10px", repeat: "stretch" },
  bar_pill_small_dark_alt: { slice: "8 fill", borderWidth: "8px 12px", padding: "4px 10px", repeat: "stretch" },
  progress_bar_long: { slice: "6 fill", borderWidth: "6px 8px", padding: "4px 8px", repeat: "stretch" },
  progress_bar_fill_dark: { slice: "6 fill", borderWidth: "6px 8px", padding: "10px", repeat: "stretch" }
});

let atlasDefsPromise = null;
let atlasImagePromise = null;
const croppedFrameUrlCache = new Map();
const skinResizeObserver = typeof ResizeObserver !== "undefined"
  ? new ResizeObserver((entries) => {
      for (const entry of entries) {
        syncUiSkinPixelScale(entry.target);
      }
    })
  : null;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

async function loadAtlasDefs() {
  if (!atlasDefsPromise) {
    atlasDefsPromise = fetch(UI_ATLAS_DEFS_SRC).then(async (response) => {
      if (!response.ok) throw new Error(`Failed to load ${UI_ATLAS_DEFS_SRC}`);
      return response.json();
    });
  }
  return atlasDefsPromise;
}

async function loadAtlasImage() {
  if (!atlasImagePromise) {
    atlasImagePromise = loadImage(UI_ATLAS_IMAGE_SRC);
  }
  return atlasImagePromise;
}

function resolveFrameName(tokenOrFrameName) {
  return UI_SKIN_TOKENS[tokenOrFrameName] || tokenOrFrameName;
}

async function getFrameDef(tokenOrFrameName) {
  const defs = await loadAtlasDefs();
  const frameName = resolveFrameName(tokenOrFrameName);
  const frame = defs?.frames?.[frameName];
  if (!frame?.frame) {
    throw new Error(`UI atlas frame "${frameName}" was not found.`);
  }
  return {
    name: frameName,
    frame: frame.frame
  };
}

async function getCroppedFrameUrl(tokenOrFrameName) {
  const frameName = resolveFrameName(tokenOrFrameName);
  if (croppedFrameUrlCache.has(frameName)) {
    return croppedFrameUrlCache.get(frameName);
  }
  const [{ frame }, image] = await Promise.all([
    getFrameDef(frameName),
    loadAtlasImage()
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, frame.w);
  canvas.height = Math.max(1, frame.h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(`Failed to create canvas context for ${frameName}.`);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  const url = canvas.toDataURL("image/png");
  croppedFrameUrlCache.set(frameName, url);
  return url;
}

export async function initializeUiAtlas() {
  const [defs] = await Promise.all([loadAtlasDefs(), loadAtlasImage()]);
  const root = document.documentElement;
  root.style.setProperty("--ui-atlas-image", `url("${UI_ATLAS_IMAGE_SRC}")`);
  root.style.setProperty("--ui-atlas-sheet-width", `${defs?.meta?.size?.w || 2048}`);
  root.style.setProperty("--ui-atlas-sheet-height", `${defs?.meta?.size?.h || 224}`);
}

export async function getUiSkinFrame(tokenOrFrameName) {
  const [frameDef, imageUrl] = await Promise.all([
    getFrameDef(tokenOrFrameName),
    getCroppedFrameUrl(tokenOrFrameName)
  ]);
  const nineSlice = UI_NINE_SLICE[frameDef.name] || null;
  return {
    name: frameDef.name,
    width: frameDef.frame.w,
    height: frameDef.frame.h,
    imageUrl,
    nineSlice
  };
}

function syncUiSkinPixelScale(element) {
  if (!(element instanceof HTMLElement)) return;
  const width = Number.parseFloat(element.style.getPropertyValue("--ui-skin-width")) || 0;
  const height = Number.parseFloat(element.style.getPropertyValue("--ui-skin-height")) || 0;
  if (!width || !height) return;

  const rect = element.getBoundingClientRect();
  const targetWidth = Math.max(1, Math.round(rect.width));
  const targetHeight = Math.max(1, Math.round(rect.height));

  element.style.setProperty("--ui-pixel-width", `${targetWidth}px`);
  element.style.setProperty("--ui-pixel-height", `${targetHeight}px`);

  if (element.dataset.uiNineSlice === "true") return;

  const scaleX = targetWidth / width;
  const scaleY = targetHeight / height;
  const integerScale = Math.max(1, Math.round(Math.min(scaleX, scaleY) || 1));
  element.style.setProperty("--ui-pixel-scale", `${integerScale}`);
  element.style.setProperty("--ui-skin-render-width", `${Math.round(width * integerScale)}px`);
  element.style.setProperty("--ui-skin-render-height", `${Math.round(height * integerScale)}px`);
}

export async function applyUiSkin(element, tokenOrFrameName, options = {}) {
  if (!(element instanceof HTMLElement)) return null;
  const frame = await getUiSkinFrame(tokenOrFrameName);
  element.style.setProperty("--ui-skin-image", `url("${frame.imageUrl}")`);
  element.style.setProperty("--ui-skin-width", `${frame.width}px`);
  element.style.setProperty("--ui-skin-height", `${frame.height}px`);
  element.dataset.uiSkin = frame.name;
  if (options.mode) {
    element.dataset.uiSkinMode = options.mode;
  }
  if (frame.nineSlice) {
    element.dataset.uiNineSlice = "true";
    element.style.setProperty("--ui-nine-slice-source", `url("${frame.imageUrl}")`);
    element.style.setProperty("--ui-nine-slice-slice", frame.nineSlice.slice);
    element.style.setProperty("--ui-nine-slice-border-width", frame.nineSlice.borderWidth);
    element.style.setProperty("--ui-nine-slice-repeat", frame.nineSlice.repeat || "stretch");
    if (frame.nineSlice.padding != null) {
      element.style.setProperty("--ui-nine-slice-padding", frame.nineSlice.padding);
    }
  } else {
    delete element.dataset.uiNineSlice;
    element.style.removeProperty("--ui-nine-slice-source");
    element.style.removeProperty("--ui-nine-slice-slice");
    element.style.removeProperty("--ui-nine-slice-border-width");
    element.style.removeProperty("--ui-nine-slice-repeat");
    element.style.removeProperty("--ui-nine-slice-padding");
  }
  element.classList.add("ui-skin");
  syncUiSkinPixelScale(element);
  skinResizeObserver?.observe(element);
  return frame;
}

export function setUiSkinToken(element, tokenOrFrameName, options = {}) {
  if (!(element instanceof HTMLElement)) return;
  element.dataset.uiSkinToken = resolveFrameName(tokenOrFrameName);
  if (options.mode) {
    element.dataset.uiSkinMode = options.mode;
  }
}

export async function applyUiSkinTree(root = document) {
  const elements = [];
  if (root instanceof HTMLElement && root.dataset.uiSkinToken) {
    elements.push(root);
  }
  if (root && "querySelectorAll" in root) {
    elements.push(...root.querySelectorAll("[data-ui-skin-token]"));
  }
  await Promise.all(
    Array.from(elements).map((element) =>
      applyUiSkin(element, element.dataset.uiSkinToken, {
        mode: element.dataset.uiSkinMode || undefined
      })
    )
  );
}

export function getUiSkinTokenName(token) {
  return resolveFrameName(token);
}
