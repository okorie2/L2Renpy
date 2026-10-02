import Phaser from "phaser";
import type { Location } from "../core/models";
import { toWorldPoint, toWorldRect } from "./geometry";

/** Where a building's sign sits below the top of its footprint, in world units. */
export const SIGN_OFFSET_Y = 190;

function rectangle(scene: Phaser.Scene, x: number, y: number, width: number, height: number, color: number, stroke?: number) {
  const shape = scene.add.rectangle(x, y, width, height, color);
  if (stroke !== undefined) shape.setStrokeStyle(3, stroke);
  return shape;
}

function drawNeighborhood(scene: Phaser.Scene, location: Location, labels: Record<string, string>) {
  const { width, height } = location.size;
  rectangle(scene, width / 2, height / 2, width, height, 0xc5d4bf);
  rectangle(scene, width / 2, 485, width, 280, 0xd5c8ad);
  rectangle(scene, width / 2, 705, width, 165, 0x626b72);
  rectangle(scene, width / 2, 835, width, 50, 0xc6b99f);
  for (let x = 40; x < width; x += 120) rectangle(scene, x, 704, 56, 5, 0xe9dfb9);
  for (let x = 0; x < width; x += 64) rectangle(scene, x + 30, 610, 2, 18, 0xb3a98e);

  rectangle(scene, 970, 471, 415, 175, 0xe8d9b7, 0xafa083);
  scene.add.text(967, 405, "COMMUNITY SQUARE", { fontFamily: "Arial", fontSize: "16px", color: "#554e43", fontStyle: "bold" }).setOrigin(0.5);
  scene.add.circle(982, 488, 44, 0x9eb8b2).setStrokeStyle(8, 0xc7af87);
  scene.add.circle(982, 488, 18, 0xb2d1ca);

  const colors = [0xe9d9c4, 0xc8d9dc, 0xf2d3b5];
  location.buildings.forEach((building, index) => {
    const box = toWorldRect(location, building.rect);
    const cx = box.x + box.width / 2;
    rectangle(scene, cx, box.y + box.height / 2, box.width, box.height, colors[index % colors.length], 0x4b4d4e);
    rectangle(scene, cx, box.y + 14, box.width + 14, 28, 0x665c5a);
    for (const offset of [-90, 90]) {
      rectangle(scene, cx + offset, box.y + 100, 58, 86, 0x779ba1, 0x43575a);
      rectangle(scene, cx + offset, box.y + 100, 4, 82, 0xe9e0cf);
    }
    rectangle(scene, cx, box.y + box.height - 40, 68, 80, 0x4f5b60, 0x333b3d);
    rectangle(scene, cx + 22, box.y + box.height - 35, 5, 5, 0xe6bf68);
    rectangle(scene, cx, box.y + SIGN_OFFSET_Y, box.width - 38, 42, 0x5b6061);
    scene.add.text(cx, box.y + SIGN_OFFSET_Y, labels[building.labelKey] ?? building.labelKey, {
      fontFamily: "Arial", fontSize: "20px", fontStyle: "bold", color: "#fffaf0"
    }).setOrigin(0.5);
  });

  // The last obstacle is the fountain; it is drawn above as a circle.
  for (const obstacle of location.obstacles.slice(location.buildings.length, -1)) {
    const box = toWorldRect(location, obstacle);
    rectangle(scene, box.x + box.width / 2, box.y + box.height / 2, box.width, box.height, 0x8d684f, 0x5f493a);
    for (let x = box.x + 15; x < box.x + box.width; x += 22) scene.add.circle(x, box.y + 2, 13, 0x65845a);
  }
}

function drawInterior(scene: Phaser.Scene, location: Location) {
  const { width, height } = location.size;
  const floor = location.kind === "apartment" ? 0xd3bfa1 : location.kind === "cafe" ? 0xd6c1a0 : 0xe2d2ab;
  rectangle(scene, width / 2, height / 2, width, height, floor);
  for (let x = 40; x < width; x += 75) rectangle(scene, x, height / 2, 2, height, 0xc1ae91);
  rectangle(scene, width / 2, 48, width, 96, 0xadb9ae, 0x59625b);
  rectangle(scene, 15, height / 2, 30, height, 0x7c8178);
  rectangle(scene, width - 15, height / 2, 30, height, 0x7c8178);
  rectangle(scene, width / 2, height - 12, width, 24, 0x7c8178);
  rectangle(scene, width / 2, 610, 95, 28, 0x687e83, 0x34464a);
  scene.add.text(width / 2, 610, "EXIT", { fontFamily: "Arial", fontSize: "16px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);

  if (location.kind === "apartment") {
    const bed = toWorldRect(location, location.obstacles[0]);
    rectangle(scene, bed.x + bed.width / 2, bed.y + bed.height / 2, bed.width, bed.height, 0x8d695b, 0x5c514b);
    rectangle(scene, bed.x + bed.width / 2, bed.y + 47, bed.width - 22, 65, 0xe7dfd0);
    rectangle(scene, 350, 390, 200, 140, 0xb99382);
    rectangle(scene, 540, 250, 170, 110, 0x795f49, 0x4b4339);
    rectangle(scene, 132, 468, 125, 65, 0x8a7057, 0x514b42);
    scene.add.text(350, 150, "HOME", { fontFamily: "Arial", fontSize: "28px", color: "#4c4f4a", fontStyle: "bold" }).setOrigin(0.5);
  } else {
    const counter = toWorldRect(location, location.obstacles[0]);
    rectangle(scene, counter.x + counter.width / 2, counter.y + counter.height / 2, counter.width, counter.height, location.kind === "cafe" ? 0x765948 : 0x9b7255, 0x4a413b);
    rectangle(scene, 350, 140, 540, 55, 0x6c6155);
    if (location.kind === "cafe") {
      for (const x of [120, 580]) rectangle(scene, x, 430, 115, 90, 0x8c644b, 0x5b453b);
      for (const x of [290, 360, 430]) scene.add.circle(x, 135, 12, 0xe9e1ce);
      scene.add.text(350, 65, "COFFEE & COMPANY", { fontFamily: "Arial", fontSize: "21px", color: "#35483e", fontStyle: "bold" }).setOrigin(0.5);
    } else {
      for (const x of [128, 572]) rectangle(scene, x, 435, 105, 70, 0x986d4c, 0x5b453b);
      for (const x of [260, 325, 390, 455]) scene.add.ellipse(x, 130, 48, 20, 0xc69455);
      scene.add.text(350, 65, "FRESH BREAD", { fontFamily: "Arial", fontSize: "21px", color: "#6d4c3f", fontStyle: "bold" }).setOrigin(0.5);
    }
  }
}

/**
 * A painted location. The picture carries everything except words: place names
 * come from the language pack, so they are laid over the signs the painting
 * leaves blank.
 */
function drawBackdrop(scene: Phaser.Scene, location: Location, labels: Record<string, string>, texture: string, props: NonNullable<Location["props"]>) {
  scene.add.image(0, 0, texture).setOrigin(0).setDisplaySize(location.size.width, location.size.height);
  // The same pixels again, at the depth of each thing's base, so it hides whoever is behind it.
  for (const prop of props) {
    if (!scene.textures.exists(prop.image)) continue;
    const box = toWorldRect(location, prop.rect);
    scene.add.image(box.x, box.y, prop.image).setOrigin(0).setDisplaySize(box.width, box.height).setDepth(prop.base * location.size.height);
  }
  for (const building of location.buildings) {
    const box = toWorldRect(location, building.rect);
    const sign = building.sign ? toWorldPoint(location, building.sign) : { x: box.x + box.width / 2, y: box.y + SIGN_OFFSET_Y };
    // Painted name boards are pale, so the name is written dark.
    scene.add.text(sign.x, sign.y, labels[building.labelKey] ?? building.labelKey, {
      fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "22px", fontStyle: "bold", color: "#3a3f52"
    }).setOrigin(0.5).setResolution(3);
  }
}

export function renderLocation(
  scene: Phaser.Scene, location: Location, labels: Record<string, string>, backdrop?: string, props: NonNullable<Location["props"]> = []
) {
  if (backdrop && scene.textures.exists(backdrop)) drawBackdrop(scene, location, labels, backdrop, props);
  else if (location.kind === "neighborhood") drawNeighborhood(scene, location, labels);
  else drawInterior(scene, location);

  const painted = Boolean(backdrop && scene.textures.exists(backdrop));
  for (const portal of location.portals) {
    const point = toWorldPoint(location, portal.position);
    if (painted) {
      // The painting already shows the door; a soft glow on the ground marks where to stand.
      scene.add.ellipse(point.x, point.y, 64, 22, 0xfff3c4, 0.5).setStrokeStyle(2, 0xffffff, 0.7);
      continue;
    }
    scene.add.ellipse(point.x, point.y, 54, 19, 0xf8d883, 0.46).setStrokeStyle(2, 0x7d6544);
    scene.add.text(point.x, point.y - 32, "⇧", { fontFamily: "Arial", fontSize: "26px", color: "#3c4548", fontStyle: "bold" }).setOrigin(0.5);
  }
}
