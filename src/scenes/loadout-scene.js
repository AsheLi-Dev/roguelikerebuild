export function createLoadoutScene(game) {
  return {
    id: "loadout",
    update(dt) {
      game.time += dt;
    },
    render(ctx) {
      const { canvas } = game;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#09131d");
      gradient.addColorStop(1, "#020617");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.fillStyle = "rgba(16, 185, 129, 0.08)";
      ctx.beginPath();
      ctx.arc(canvas.width * 0.18, canvas.height * 0.24, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(244, 114, 182, 0.08)";
      ctx.beginPath();
      ctx.arc(canvas.width * 0.82, canvas.height * 0.34, 180, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = "rgba(8, 15, 26, 0.76)";
      ctx.strokeStyle = "rgba(190, 210, 255, 0.16)";
      ctx.lineWidth = 1.5;
      ctx.fillRect(120, 64, 720, 410);
      ctx.strokeRect(120, 64, 720, 410);

      ctx.textAlign = "center";
      ctx.fillStyle = "#9fb3cb";
      ctx.font = "12px Georgia";
      ctx.fillText("Loadout Scene", canvas.width * 0.5, 112);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 34px Georgia";
      ctx.fillText("Choose Hero And Skills", canvas.width * 0.5, 162);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "16px Georgia";
      ctx.fillText(`Hero: ${game.loadoutDraft?.heroId ? game.heroDef.name : "None"}`, canvas.width * 0.5, 210);
      ctx.fillText(`Skills Selected: ${(game.loadoutDraft?.skillIds || []).length} / 3`, canvas.width * 0.5, 238);
      ctx.fillStyle = "rgba(248, 250, 252, 0.72)";
      ctx.font = "14px Georgia";
      ctx.fillText("Pick one hero and exactly three skills, then launch the run.", canvas.width * 0.5, 286);
      ctx.restore();
    }
  };
}
