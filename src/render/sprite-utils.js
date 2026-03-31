export function getWorldViewOffsets(canvas, zoom) {
  return {
    x: canvas.width * (1 - zoom) * 0.5,
    y: canvas.height * (1 - zoom) * 0.5
  };
}

export function getSnappedSpriteMetrics({
  canvas,
  camera,
  zoom,
  entityX,
  entityY,
  entityWidth,
  entityHeight,
  spriteWidth,
  spriteHeight,
  targetDrawWidth,
  targetDrawHeight,
  anchorX = 0.5,
  anchorY = 0.7,
  offsetX = 0,
  offsetY = 0
}) {
  const scaleX = Math.max(1, Math.round((targetDrawWidth / Math.max(1, spriteWidth)) * zoom));
  const scaleY = Math.max(1, Math.round((targetDrawHeight / Math.max(1, spriteHeight)) * zoom));
  const drawWidth = (spriteWidth * scaleX) / zoom;
  const drawHeight = (spriteHeight * scaleY) / zoom;
  const viewOffset = getWorldViewOffsets(canvas, zoom);
  const worldX = entityX - camera.x - (drawWidth - entityWidth) * anchorX + offsetX;
  const worldY = entityY - camera.y - (drawHeight - entityHeight) * anchorY + offsetY;
  const screenX = Math.round(viewOffset.x + worldX * zoom);
  const screenY = Math.round(viewOffset.y + worldY * zoom);

  return {
    x: (screenX - viewOffset.x) / zoom,
    y: (screenY - viewOffset.y) / zoom,
    drawWidth,
    drawHeight
  };
}

export function drawSpriteFrame(ctx, {
  image,
  sx,
  sy = 0,
  sw,
  sh,
  dx,
  dy,
  dw,
  dh,
  flip = 1,
  smoothingEnabled = false
}) {
  if (!image) return;
  ctx.save();
  ctx.imageSmoothingEnabled = smoothingEnabled;
  if (flip < 0) {
    ctx.translate(dx + dw * 0.5, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(dx + dw * 0.5), 0);
  }
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}
