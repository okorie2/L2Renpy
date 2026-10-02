import Phaser from "phaser";

export type Facing = "up" | "down" | "left" | "right";
export type Motion = "idle" | "walking";

/** What the scene needs from any character, drawn or sprite-based. */
export interface WorldCharacter extends Phaser.GameObjects.Container {
  /** Distance above the feet at which a name label sits. */
  readonly labelOffset: number;
  setMotion(motion: Motion, facing?: Facing): void;
  tick(delta: number): void;
}

interface Appearance {
  skin: number;
  hair: number;
  coat: number;
  accent: number;
}

/** Drawn figures for the player and for NPCs that have no sprite art in the character catalog. */
const appearances: Record<string, Appearance> = {
  player: { skin: 0xc68e69, hair: 0x2a2227, coat: 0x243441, accent: 0xf4b75e },
  barista: { skin: 0xa6684b, hair: 0x282329, coat: 0x355e60, accent: 0xf5e9d4 },
  baker: { skin: 0xe6b38c, hair: 0x6c4933, coat: 0x6d7a93, accent: 0xffffff },
  neighbor: { skin: 0x8f5a3e, hair: 0x1f2025, coat: 0x899850, accent: 0xf2c76b }
};

export class Character extends Phaser.GameObjects.Container implements WorldCharacter {
  readonly labelOffset = 86;
  private leftLeg: Phaser.GameObjects.Rectangle;
  private rightLeg: Phaser.GameObjects.Rectangle;
  private torso: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Arc;
  private hair: Phaser.GameObjects.Ellipse;
  private eyes: Phaser.GameObjects.Arc[];
  private motion: Motion = "idle";
  private facing: Facing = "down";
  private elapsed = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, appearanceId: string) {
    super(scene, x, y);
    const appearance = appearances[appearanceId] ?? appearances.player;
    const shadow = scene.add.ellipse(0, 4, 35, 12, 0x1f2730, 0.22);
    this.leftLeg = scene.add.rectangle(-7, -6, 8, 19, 0x24252e).setStrokeStyle(1, 0x111820);
    this.rightLeg = scene.add.rectangle(7, -6, 8, 19, 0x24252e).setStrokeStyle(1, 0x111820);
    this.torso = scene.add.rectangle(0, -22, 28, 27, appearance.coat).setStrokeStyle(2, 0x28262a);
    const scarf = scene.add.rectangle(0, -34, 26, 6, appearance.accent);
    this.head = scene.add.circle(0, -46, 13, appearance.skin).setStrokeStyle(1, 0x292026);
    this.hair = scene.add.ellipse(0, -56, 27, 12, appearance.hair);
    this.eyes = [scene.add.circle(-5, -46, 1.8, 0x222222), scene.add.circle(5, -46, 1.8, 0x222222)];
    this.add([shadow, this.leftLeg, this.rightLeg, this.torso, scarf, this.head, this.hair, ...this.eyes]);
    this.setSize(36, 60);
    this.setDepth(y);
    scene.add.existing(this);
  }

  setMotion(motion: Motion, facing: Facing = this.facing) {
    this.motion = motion;
    this.facing = facing;
    const showEyes = facing !== "up";
    this.eyes.forEach((eye) => eye.setVisible(showEyes));
    const side = facing === "left" ? -1 : facing === "right" ? 1 : 0;
    this.eyes[0].x = -5 + side * 3;
    this.eyes[1].x = 5 + side * 3;
  }

  tick(delta: number) {
    this.elapsed += delta;
    const stride = this.motion === "walking" ? Math.sin(this.elapsed * 0.017) * 5 : 0;
    const bob = this.motion === "walking" ? Math.abs(Math.sin(this.elapsed * 0.017)) * 2 : Math.sin(this.elapsed * 0.002) * 0.5;
    this.leftLeg.y = -6 + stride;
    this.rightLeg.y = -6 - stride;
    this.torso.y = -22 - bob;
    this.head.y = -46 - bob;
    this.hair.y = -56 - bob;
    this.eyes.forEach((eye) => { eye.y = -46 - bob; });
    this.setDepth(this.y);
  }
}
