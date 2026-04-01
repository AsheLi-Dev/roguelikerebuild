export function createSettingsScene(game) {
  return {
    id: "settings",
    update(dt) {
      game.time += dt;
    },
    render(ctx) {
      const { canvas } = game;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#091019");
      gradient.addColorStop(1, "#030711");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.fillStyle = "rgba(245, 158, 11, 0.08)";
      ctx.beginPath();
      ctx.arc(canvas.width * 0.22, canvas.height * 0.22, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
      ctx.beginPath();
      ctx.arc(canvas.width * 0.78, canvas.height * 0.28, 170, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
}
