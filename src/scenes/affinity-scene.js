export function createAffinityScene(game) {
  return {
    id: "affinity",
    update(dt) {
      game.time += dt;
    },
    render(ctx) {
      const { canvas } = game;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#081018");
      gradient.addColorStop(0.55, "#07131d");
      gradient.addColorStop(1, "#030711");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.fillStyle = "rgba(217, 195, 140, 0.08)";
      ctx.beginPath();
      ctx.arc(canvas.width * 0.18, canvas.height * 0.24, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(34, 197, 94, 0.08)";
      ctx.beginPath();
      ctx.arc(canvas.width * 0.76, canvas.height * 0.28, 180, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(59, 130, 246, 0.06)";
      ctx.beginPath();
      ctx.arc(canvas.width * 0.62, canvas.height * 0.78, 220, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
}
