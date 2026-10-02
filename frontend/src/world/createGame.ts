import Phaser from "phaser";
import { MainScene, type WorldSceneConfig } from "./MainScene";

export function createGame(parent: HTMLElement, world: WorldSceneConfig) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth,
    height: parent.clientHeight,
    backgroundColor: "#d8d1c4",
    scene: [new MainScene(world)],
    // Phaser's sound manager is unused; voiced dialogue will come through the speech layer.
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  });
}
