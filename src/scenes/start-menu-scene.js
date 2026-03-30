export function createStartMenuScene(game) {
  return {
    id: "start-menu",
    update(dt) {
      game.time += dt;
    },
    render(ctx) {
      const { canvas } = game;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#071018");
      gradient.addColorStop(1, "#020617");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
      ctx.beginPath();
      ctx.arc(canvas.width * 0.2, canvas.height * 0.25, 140, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(139, 92, 246, 0.12)";
      ctx.beginPath();
      ctx.arc(canvas.width * 0.78, canvas.height * 0.32, 180, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const pulse = 0.5 + 0.5 * Math.sin(game.time * 2.2);
      ctx.save();
      ctx.fillStyle = "rgba(8, 15, 26, 0.82)";
      ctx.strokeStyle = "rgba(167, 139, 250, 0.34)";
      ctx.lineWidth = 1.5;
      ctx.fillRect(220, 120, 520, 260);
      ctx.strokeRect(220, 120, 520, 260);

      ctx.textAlign = "center";
      ctx.fillStyle = "#9fb3cb";
      ctx.font = "12px Georgia";
      ctx.fillText("Standalone Roguelike", canvas.width * 0.5, 170);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 36px Georgia";
      ctx.fillText("Dark Mage Roguelike", canvas.width * 0.5, 225);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "16px Georgia";
      ctx.fillText("Step 1: enter loadout setup", canvas.width * 0.5, 270);
      ctx.fillStyle = "rgba(248, 250, 252, 0.72)";
      ctx.font = "14px Georgia";
      ctx.fillText("Press Start to choose your hero and three skills for the run.", canvas.width * 0.5, 308);

      ctx.fillStyle = `rgba(96, 165, 250, ${0.16 + pulse * 0.08})`;
      ctx.fillRect(366, 332, 228, 20);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px Georgia";
      ctx.fillText("Use the buttons below the canvas", canvas.width * 0.5, 346);
      ctx.restore();
    }
  };
}
