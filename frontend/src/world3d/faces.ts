import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { MorphTarget } from "@babylonjs/core/Morph/morphTarget";
import { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { facialPose } from "./facialPose";

/** Use authored Sophie expressions; retain bind-space facial motion for the CC0 actors. */
export function addStoryFace(root: TransformNode, scene: Scene, female: boolean, offset: number) {
  const heads = root.getChildMeshes().filter(mesh => /Head/.test(mesh.name) && mesh.skeleton) as Mesh[];
  const skin = heads.find(mesh => /Skin$/.test(mesh.material?.name ?? ""));
  const eyes = heads.find(mesh => /(?:Brown|Eye)$/.test(mesh.material?.name ?? "") && !/Hair_Brown$/.test(mesh.material?.name ?? ""));
  const headJoint = root.getChildTransformNodes().find(node => node.name === `${root.name}-Head`);
  const authored: MorphTarget[] = [];
  for (const mesh of root.getChildMeshes()) {
    const manager = (mesh as Mesh).morphTargetManager;
    if (manager) for (let i = 0; i < manager.numTargets; i++) authored.push(manager.getTarget(i));
  }
  if (authored.some(target => target.name === "blink_L")) {
    return (time: number, speaking: number) => {
      const pose = facialPose(time, speaking, offset);
      for (const target of authored) {
        if (target.name === "blink_L" || target.name === "blink_R") target.influence = pose.blink;
        else if (target.name === "jawOpen") target.influence = pose.mouth;
        else if (target.name === "smile") target.influence = 0.15;
      }
      if (headJoint?.rotationQuaternion) headJoint.rotationQuaternion.multiplyInPlace(Quaternion.FromEulerAngles(pose.nod, pose.glance, 0));
    };
  }
  const makeTarget = (mesh: Mesh, name: string, positions: Float32Array) => {
    const manager = mesh.morphTargetManager ?? new MorphTargetManager(scene);
    const target = new MorphTarget(name, 0, scene);
    target.setPositions(positions);
    manager.addTarget(target);
    mesh.morphTargetManager = manager;
    return target;
  };
  let blink: MorphTarget | undefined, jaw: MorphTarget | undefined, mouthOpen: MorphTarget | undefined;
  if (eyes) {
    const positions = Float32Array.from(eyes.getVerticesData(VertexBuffer.PositionKind)!);
    let low = Infinity, high = -Infinity;
    for (let i = 1; i < positions.length; i += 3) { low = Math.min(low, positions[i]); high = Math.max(high, positions[i]); }
    const middle = (low + high) / 2;
    for (let i = 1; i < positions.length; i += 3) positions[i] = middle + (positions[i] - middle) * 0.06;
    blink = makeTarget(eyes, "blink", positions);
  }
  if (skin) {
    const positions = Float32Array.from(skin.getVerticesData(VertexBuffer.PositionKind)!);
    // These two supplied rigs have fixed facial landmarks in their bind geometry.
    const lipY = female ? 1.612 : 1.619;
    for (let i = 0; i < positions.length; i += 3) {
      const influence = Math.max(0, 1 - Math.abs(positions[i]) / 0.085) * Math.max(0, Math.min(1, (lipY + 0.015 - positions[i + 1]) / 0.06));
      if (positions[i + 2] > 0.08) positions[i + 1] -= influence * 0.007;
    }
    jaw = makeTarget(skin, "jaw", positions);
    const bone = skin.skeleton!.bones.find(b => /Head$/.test(b.name))?.getIndex() ?? -1;
    if (bone >= 0) {
      const mouth = MeshBuilder.CreateSphere(`${root.name}-mouth`, { diameter: 1, segments: 12 }, scene);
      mouth.scaling.set(0.038, 0.0035, 0.007);
      mouth.position.set(0, lipY, female ? 0.157 : 0.159);
      mouth.bakeCurrentTransformIntoVertices();
      mouth.parent = skin.parent;
      mouth.skeleton = skin.skeleton;
      const count = mouth.getTotalVertices();
      const indices = new Float32Array(count * 4), weights = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) { indices[i * 4] = bone; weights[i * 4] = 1; }
      mouth.setVerticesData(VertexBuffer.MatricesIndicesKind, indices, false, 4);
      mouth.setVerticesData(VertexBuffer.MatricesWeightsKind, weights, false, 4);
      const mat = new StandardMaterial(`${root.name}-lips`, scene);
      mat.diffuseColor = Color3.FromHexString("#70453f"); mat.specularColor.set(0, 0, 0);
      mouth.material = mat;
      const open = Float32Array.from(mouth.getVerticesData(VertexBuffer.PositionKind)!);
      for (let i = 1; i < open.length; i += 3) open[i] = lipY + (open[i] - lipY) * 4 - 0.003;
      mouthOpen = makeTarget(mouth, "mouth-open", open);
    }
  }
  return (time: number, speaking: number) => {
    const pose = facialPose(time, speaking, offset);
    if (blink) blink.influence = pose.blink;
    if (jaw) jaw.influence = pose.mouth;
    if (mouthOpen) mouthOpen.influence = pose.mouth;
    if (headJoint?.rotationQuaternion) headJoint.rotationQuaternion.multiplyInPlace(Quaternion.FromEulerAngles(pose.nod, pose.glance, 0));
  };
}
