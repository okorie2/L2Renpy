import "@babylonjs/core/Rendering/outlineRenderer";
import "@babylonjs/core/Shaders/outline.vertex";
import "@babylonjs/core/Shaders/outline.fragment";
import "@babylonjs/core/ShadersWGSL/outline.vertex";
import "@babylonjs/core/ShadersWGSL/outline.fragment";
import { StoryToonMaterial } from "./toon";
// glTF's temporary PBR materials expand the built-in lighting texture during import.
// Keep those preprocessing shaders local, just like the street's standard shaders.
import "@babylonjs/core/ShadersWGSL/postprocess.vertex";
import "@babylonjs/core/ShadersWGSL/rgbdDecode.fragment";
import "@babylonjs/core/Shaders/postprocess.vertex";
import "@babylonjs/core/Shaders/rgbdDecode.fragment";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { addStoryFace } from "./faces";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { Scene } from "@babylonjs/core/scene";
import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";

/** Sample baked skeletal clips with story time, so pause freezes the entire pose. */
export async function loadStoryCharacters(scene: Scene, shadows: ShadowGenerator, signal: AbortSignal) {
  // Review a supplied auto-rig without changing the character in saved lessons.
  const query = new URLSearchParams(window.location.search);
  const reviewRig = query.has("preview3d") && query.get("model") === "meshy-rigged";
  const results = await Promise.allSettled(["sophie", "player"].map(async id => {
    const asset = id === "sophie" && import.meta.env.VITE_SOPHIE_PROXY !== "true"
      ? reviewRig ? "sophie-meshy-rigged" : import.meta.env.VITE_SOPHIE_MODEL === "study" ? "sophie-study" : "sophie-meshy"
      : id;
    const response = await fetch(`${import.meta.env.BASE_URL}assets/3d/characters/${asset}.glb`, { signal });
    if (!response.ok) throw new Error(`Character ${id}: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    signal.throwIfAborted();
    return LoadAssetContainerAsync(bytes, scene, { pluginExtension: ".glb" });
  }));
  const containers = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  const failed = results.find(result => result.status === "rejected");
  if (failed?.status === "rejected") { containers.forEach(c => c.dispose()); throw failed.reason; }
  if (signal.aborted) { containers.forEach(c => c.dispose()); signal.throwIfAborted(); }
  const make = (id: string, female = false) => {
    const entries = containers[female ? 0 : 1].instantiateModelsToScene(name => `${id}-${name}`, true, { doNotInstantiate: true });
    const root = new TransformNode(id, scene);
    for (const node of entries.rootNodes) node.parent = root;
    // Use the street's diffuse lighting and locally bundled standard shaders on both backends.
    const toon = import.meta.env.VITE_STORY_TOON !== "false";
    // Keep the original proxy palette consistent with the editable Sophie study.
    const sophiePalette: Record<string, string> = {
      Skin: "#efc1a5", White: "#f1e5d1", Grey: "#e7e2da", Orange: "#91aecb",
      Hair_Blond: "#947455", Hair_Brown: "#574132", Brown: "#46362b",
      Sophie_Hair: "#806049", Sophie_HairHighlight: "#a08161",
      Sophie_Knit: "#eee1c9", Sophie_Rib: "#d9cbb5",
      Sophie_Leather: "#49372f", Sophie_Seam: "#6c5140", Sophie_Gold: "#b88a43",
      Sophie_FaceSkin: "#efc1a5", Sophie_EyeWhite: "#fff5e9", Sophie_Lash: "#443029",
      Sophie_Iris: "#835333", Sophie_IrisLight: "#b98a58", Sophie_Pupil: "#30241f",
      Sophie_EyeShine: "#fffdf7", Sophie_Lip: "#b97565", Sophie_Mouth: "#78483f",
    };
    const materials = new Map<object, StandardMaterial>();
    for (const mesh of root.getChildMeshes()) {
      const source = mesh.material;
      // The layered facial geometry has its own colours and authored contours.
      // Keep shadow maps and shell outlines off these sub-millimetre surfaces.
      const faceDetail = /Sophie_(?:EyeWhite|Lash|Iris|IrisLight|Pupil|EyeShine|Lip|Mouth)$/.test(source?.name ?? "");
      if (source) {
        let mat = materials.get(source);
        if (!mat) {
          mat = new StandardMaterial(`${id}-${source.name}`, scene);
          const pbr = source as PBRMaterial;
          mat.diffuseColor = pbr.albedoColor?.clone() ?? Color3.White();
          // The Meshy character's likeness lives in its embedded colour atlas.
          // Retain it when converting PBR to the street's diffuse materials.
          mat.diffuseTexture = pbr.albedoTexture ?? null;
          const sourceName = Object.keys(sophiePalette).find(name => source.name.endsWith(`-${name}`));
          if (id === "sophie" && sourceName) mat.diffuseColor = Color3.FromHexString(sophiePalette[sourceName]);
          mat.specularColor.set(0.015, 0.015, 0.015);
          if (faceDetail) {
            mat.disableLighting = true;
            mat.emissiveColor = mat.diffuseColor.clone();
          } else if (toon) new StoryToonMaterial(mat, !!mat.diffuseTexture || /Sophie_FaceSkin$/.test(source.name));
          mat.backFaceCulling = false;
          materials.set(source, mat);
        }
        mesh.material = mat;
      }
      if (toon && source && !(source as PBRMaterial).albedoTexture && !faceDetail && !/(?:Skin|Brown|Eye|Eyebrows|Sophie_Gold|Sophie_Rib)$/.test(source.name)) {
        mesh.renderOutline = true;
        mesh.outlineColor = Color3.FromHexString("#51473f");
        mesh.outlineWidth = 0.0025;
      }
      mesh.receiveShadows = !faceDetail;
      if (!faceDetail) shadows.addShadowCaster(mesh);
    }
    const face = addStoryFace(root, scene, female, id === "sophie" ? 1.3 : id === "player" ? 2.7 : 3.6);
    const clip = (name: string) => entries.animationGroups.find(g => g.name.endsWith(name));
    const idle = clip("Idle_Neutral"), walk = clip("Walk");
    if (!idle || !walk) throw new Error(`Character ${id} is missing idle or walk animation`);
    const wave = clip("Wave") ?? idle, talk = clip("Idle") ?? idle;
    entries.animationGroups.forEach(group => group.stop());
    type Track = AnimationGroup["targetedAnimations"][number];
    const tracks = (group: AnimationGroup) => new Map(group.targetedAnimations.map(t => [`${t.target.uniqueId}:${t.animation.targetProperty}`, t]));
    const walking = tracks(walk), waving = tracks(wave), talking = tracks(talk);
    let waveBlend = 0, talkBlend = 0, lastTime = 0;
    const sample = (track: Track, frame: number) => track.animation.evaluate(frame) as Vector3 | Quaternion;
    const mix = (a: Vector3 | Quaternion, b: Vector3 | Quaternion, weight: number) => a instanceof Quaternion && b instanceof Quaternion ? Quaternion.Slerp(a, b, weight) : Vector3.Lerp(a as Vector3, b as Vector3, weight);
    const frameAt = (group: AnimationGroup, seconds: number) => group.from + (seconds * (group.targetedAnimations[0]?.animation.framePerSecond ?? 60)) % Math.max(1, group.to - group.from);
    return { root, tick(time: number, movement: number, speaking: boolean, greeting: boolean, stride = time * 9) {
      const delta = Math.max(0, Math.min(0.1, time - lastTime)); lastTime = time;
      const ease = 1 - Math.exp(-delta * 9);
      waveBlend += ((greeting ? 1 : 0) - waveBlend) * ease;
      talkBlend += ((speaking ? 1 : 0) - talkBlend) * ease;
      const walkFrame = walk.from + ((stride / (Math.PI * 2)) % 1) * (walk.to - walk.from);
      for (const base of idle.targetedAnimations) {
        const key = `${base.target.uniqueId}:${base.animation.targetProperty}`;
        let pose = sample(base, frameAt(idle, time));
        const step = walking.get(key), hello = waving.get(key), conversation = talking.get(key);
        if (conversation) pose = mix(pose, sample(conversation, frameAt(talk, time)), talkBlend * (1 - movement));
        if (step) pose = mix(pose, sample(step, walkFrame), movement);
        if (hello) pose = mix(pose, sample(hello, frameAt(wave, time)), waveBlend * (1 - movement));
        const target = base.target as TransformNode;
        const property = base.animation.targetProperty as "position" | "scaling" | "rotationQuaternion";
        if (property === "rotationQuaternion") target.rotationQuaternion = pose as Quaternion;
        else if (property === "position" || property === "scaling") target[property].copyFrom(pose as Vector3);
      }
      face(time, talkBlend * (1 - movement));
    } };
  };
  const characters = { sophie: make("sophie", true), player: make("player"), passerby: make("passerby"), shopkeeper: make("shopkeeper") };
  return { ...characters, disposeTemplates: () => containers.forEach(c => c.dispose()) };
}
