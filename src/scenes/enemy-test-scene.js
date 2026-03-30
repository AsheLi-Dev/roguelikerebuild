export function createEnemyTestScene(game) {
  return {
    id: "enemy-test",
    update(dt) {
      game.time += dt;
    },
    render() {}
  };
}
