import { getCanvasDimensions } from "../core/runtime-utils.js";

function drawImageCover(ctx, image, width, height) {
  const imageW = image?.naturalWidth || image?.width || 0;
  const imageH = image?.naturalHeight || image?.height || 0;
  if (!imageW || !imageH || width <= 0 || height <= 0) return;
  const scale = Math.max(width / imageW, height / imageH);
  const drawW = imageW * scale;
  const drawH = imageH * scale;
  const dx = Math.round((width - drawW) * 0.5);
  const dy = Math.round((height - drawH) * 0.5 - height * 0.08);
  ctx.drawImage(image, dx, dy, Math.round(drawW), Math.round(drawH));
}

function drawBackdropCloudLayer(ctx, cloudImages, width, height, time = 0) {
  if (!Array.isArray(cloudImages) || !cloudImages.length) return;
  const upperBandTop = height * 0.04;
  const upperBandHeight = height * 0.28;
  const totalTravel = width + 420;

  ctx.save();
  ctx.globalAlpha = 0.82;
  for (let index = 0; index < 7; index += 1) {
    const image = cloudImages[index % cloudImages.length];
    const imageW = image?.naturalWidth || image?.width || 0;
    const imageH = image?.naturalHeight || image?.height || 0;
    if (!imageW || !imageH) continue;
    const size = 88 + (index % 3) * 26 + (index === 2 || index === 5 ? 18 : 0);
    const drawW = size * 1.9;
    const drawH = drawW * (imageH / Math.max(1, imageW));
    const speed = 5 + index * 0.9;
    const phase = (index * 0.173) % 1;
    const travel = ((phase * totalTravel) + time * speed) % totalTravel;
    const x = -drawW + travel;
    const yBase = upperBandTop + upperBandHeight * (0.12 + (index % 4) * 0.18);
    const yDrift = Math.sin(time * 0.08 + index * 1.7) * 6;
    ctx.drawImage(
      image,
      Math.round(x),
      Math.round(yBase + yDrift),
      Math.round(drawW),
      Math.round(drawH)
    );
  }
  ctx.restore();
}

export function renderMenuBackdrop(canvas, assets, time = 0) {
  if (!(canvas instanceof HTMLCanvasElement) || !assets?.biomeBackdrop) return;
  
  const dims = getCanvasDimensions(canvas);
  const { width, height } = dims;
  
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);
  drawImageCover(ctx, assets.biomeBackdrop, width, height);
  drawBackdropCloudLayer(
    ctx,
    [
      assets.biomeBackdropCloud1,
      assets.biomeBackdropCloud2,
      assets.biomeBackdropCloud3,
      assets.biomeBackdropCloud4,
      assets.biomeBackdropCloud5,
      assets.biomeBackdropCloud6
    ].filter(Boolean),
    width,
    height,
    time
  );

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(6, 12, 20, 0.12)");
  gradient.addColorStop(0.55, "rgba(4, 10, 16, 0.42)");
  gradient.addColorStop(1, "rgba(3, 8, 14, 0.76)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
