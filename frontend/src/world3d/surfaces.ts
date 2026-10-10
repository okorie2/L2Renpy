import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { Scene } from "@babylonjs/core/scene";

/** Small, repeatable material maps drawn locally; one world, no generated scene images. */
export function streetSurfaces(scene: Scene) {
  let seed = 261010;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const texture = (name: string, size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) => {
    const map = new DynamicTexture(name, { width: size, height: size }, scene, true);
    draw(map.getContext() as unknown as CanvasRenderingContext2D, size);
    map.update(); map.anisotropicFilteringLevel = 4;
    map.wrapU = Texture.WRAP_ADDRESSMODE; map.wrapV = Texture.WRAP_ADDRESSMODE;
    return map;
  };
  const stone = texture("limestone-blocks", 512, (ctx, size) => {
    ctx.fillStyle = "#998b78"; ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 4; row++) for (let col = -1; col < 4; col++) {
      const x = col * 171 + (row % 2) * 85, y = row * 128;
      const tone = Math.floor(193 + random() * 25);
      ctx.fillStyle = `rgb(${tone + 12},${tone + 3},${tone - 14})`;
      ctx.fillRect(x + 2, y + 2, 167, 124);
      ctx.strokeStyle = "rgba(255,255,255,.2)"; ctx.strokeRect(x + 4, y + 4, 163, 120);
    }
    for (let n = 0; n < 14000; n++) {
      ctx.fillStyle = random() > 0.5 ? "rgba(255,255,255,.07)" : "rgba(60,45,30,.06)";
      ctx.fillRect(random() * size, random() * size, 1 + random() * 2, 1);
    }
  });
  // Babylon box top faces map U along the street and V across it.
  stone.uScale = 28; stone.vScale = 3;
  const plaster = texture("aged-plaster", 256, (ctx, size) => {
    ctx.fillStyle = "#f4f0e9"; ctx.fillRect(0, 0, size, size);
    for (let n = 0; n < 7000; n++) {
      ctx.fillStyle = `rgba(105,92,70,${random() * 0.045})`;
      ctx.fillRect(random() * size, random() * size, 1 + random() * 4, 1 + random() * 3);
    }
  });
  plaster.uScale = 2; plaster.vScale = 3;
  const tiles = texture("terracotta-tiles", 256, (ctx, size) => {
    ctx.fillStyle = "#794c3d"; ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      ctx.fillStyle = `rgb(${160 + Math.floor(random() * 28)},${96 + Math.floor(random() * 20)},72)`;
      ctx.fillRect(col * 32 + 1, row * 32 + 1, 30, 30);
      ctx.fillStyle = "rgba(255,220,160,.2)"; ctx.fillRect(col * 32 + 2, row * 32 + 2, 5, 28);
    }
  });
  tiles.uScale = 3; tiles.vScale = 3;
  const window = texture("shop-window", 256, (ctx, size) => {
    const glow = ctx.createLinearGradient(0, 0, size, size);
    glow.addColorStop(0, "#263f40"); glow.addColorStop(0.6, "#9a916f"); glow.addColorStop(1, "#263c39");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#3b4238";
    for (const y of [96, 170, 225]) {
      ctx.fillRect(10, y, 236, 6);
      for (let x = 20; x < 235; x += 30) { ctx.fillStyle = "#b6a482"; ctx.fillRect(x, y - 22, 18, 20); }
      ctx.fillStyle = "#3b4238";
    }
    ctx.fillStyle = "rgba(215,236,234,.14)";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(55, 0); ctx.lineTo(220, 256); ctx.lineTo(165, 256); ctx.fill();
  });
  return { stone, plaster, tiles, window };
}
