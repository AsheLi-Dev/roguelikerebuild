import { GLOBAL_LIGHTING } from "../core/lighting.js";

function parseShadowColor(color, alpha) {
  if (typeof color !== "string" || !color.trim()) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  if (color.startsWith("rgba(")) {
    return color.replace(/rgba\(([^)]+),[^,]+\)\s*$/, `rgba($1, ${alpha})`);
  }
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  return color;
}

export function drawGroundContactShadow(ctx, {
  x,
  y,
  w,
  h,
  shadow
}) {
  if (!ctx || !shadow) return;
  const directionalShadow = GLOBAL_LIGHTING.shadow;
  const alpha = Math.max(0, Math.min(1, (shadow.shadowAlpha ?? 0.22) * 1.65 * directionalShadow.alphaScale));
  if (alpha <= 0) return;
  const shadowWidth = Math.max(2, (shadow.shadowWidth ?? 0.66) * w * 0.88 * directionalShadow.stretchX);
  const shadowHeight = Math.max(2, (shadow.shadowHeight ?? 0.18) * h * 0.82 * directionalShadow.stretchY);
  const centerX = x + w * 0.5 + ((shadow.shadowOffsetX ?? 0) + directionalShadow.driftXRatio) * w;
  const centerY = y + h + ((shadow.shadowOffsetY ?? -0.06) + directionalShadow.driftYRatio) * h;
  const blurScale = Math.max(1.02, (shadow.shadowBlurScale ?? 1.8) * 0.9 * (directionalShadow.blurScale / 1.8));
  const color = shadow.shadowColor || "rgba(0, 0, 0, 1)";
  const outerWidth = shadowWidth * blurScale;
  const outerHeight = shadowHeight * blurScale;

  ctx.save();
  ctx.translate(Math.round(centerX), Math.round(centerY));
  ctx.scale(outerWidth * 0.5, outerHeight * 0.5);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, parseShadowColor("rgba(0, 0, 0, 1)", alpha));
  gradient.addColorStop(0.48, parseShadowColor("rgba(0, 0, 0, 1)", alpha * 0.74));
  gradient.addColorStop(1, parseShadowColor(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
