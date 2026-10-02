import Phaser from "phaser";
import { worldFrames } from "../characters/resolve";
import type { WorldDirection, WorldPose, WorldVisual } from "../characters/types";
import type { Facing, Motion, WorldCharacter } from "./Character";

/**
 * A character drawn from catalog art. The scene asks for semantic poses; frame
 * URLs come from the resolved visual and double as Phaser texture keys.
 */
export class SpriteCharacter extends Phaser.GameObjects.Container implements WorldCharacter {
  readonly labelOffset: number;
  private image: Phaser.GameObjects.Image;
  private pose: WorldPose = "idle";
  private direction: WorldDirection = "down";
  private frames: string[];
  private frameIndex = 0;
  private frameElapsed = 0;
  private elapsed = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly visual: WorldVisual, scale = 1) {
    super(scene, x, y);
    const height = visual.displayHeight * scale;
    const shadow = scene.add.ellipse(0, 4, 38 * scale, 12 * scale, 0x1f2730, 0.22);
    this.frames = visual.poses.idle.frames;
    this.image = scene.add.image(0, 4, this.frames[0])
      .setOrigin(0.5, visual.footAnchorY)
      .setDisplaySize(height * visual.aspectRatio, height);
    this.add([shadow, this.image]);
    this.setSize(36, height);
    this.setDepth(y);
    this.labelOffset = height + 12;
    scene.add.existing(this);
  }

  /** Preload every frame of a visual. Call from a scene's `preload`. */
  static preload(scene: Phaser.Scene, visual: WorldVisual) {
    for (const pose of Object.values(visual.poses)) {
      for (const frame of [...pose.frames, ...(pose.back ?? []), ...(pose.side ?? [])]) {
        if (!scene.textures.exists(frame)) scene.load.image(frame, frame);
      }
    }
  }

  /** Show a pose, heading the way the character already faces unless told otherwise. */
  setPose(pose: WorldPose, direction: WorldDirection = this.direction) {
    const { frames, mirrored } = worldFrames(this.visual.poses[pose], direction);
    this.direction = direction;
    this.image.setFlipX(mirrored);
    if (pose === this.pose && frames === this.frames) return;
    this.pose = pose;
    this.frames = frames;
    this.frameIndex = 0;
    this.frameElapsed = 0;
    this.image.setTexture(frames[0]);
  }

  /** A character with front art only keeps facing the camera whichever way it walks. */
  setMotion(motion: Motion, facing?: Facing) {
    this.setPose(motion === "walking" ? "walking" : "idle", facing);
  }

  tick(delta: number) {
    this.elapsed += delta;
    const { frameDurationMs } = this.visual.poses[this.pose];
    if (this.frames.length > 1 && frameDurationMs > 0) {
      this.frameElapsed += delta;
      if (this.frameElapsed >= frameDurationMs) {
        this.frameElapsed %= frameDurationMs;
        this.frameIndex = (this.frameIndex + 1) % this.frames.length;
        this.image.setTexture(this.frames[this.frameIndex]);
      }
    }
    // A slow breath keeps a standing sprite from looking frozen.
    this.image.y = 4 + (this.pose === "walking" ? 0 : Math.sin(this.elapsed * 0.002) * 0.6);
    this.setDepth(this.y);
  }
}
