// Keep both shader families in the lazy renderer bundle; never fetch shader text from a server.
import "@babylonjs/core/ShadersWGSL/default.vertex";
import "@babylonjs/core/ShadersWGSL/default.fragment";
import "@babylonjs/core/ShadersWGSL/shadowMap.vertex";
import "@babylonjs/core/ShadersWGSL/shadowMap.fragment";
import "@babylonjs/core/ShadersWGSL/ShadersInclude/shadowMapFragmentSoftTransparentShadow";
import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/default.fragment";
import "@babylonjs/core/Shaders/shadowMap.vertex";
import "@babylonjs/core/Shaders/shadowMap.fragment";
import "@babylonjs/core/Shaders/ShadersInclude/shadowMapFragmentSoftTransparentShadow";
import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsCharacterController } from "@babylonjs/core/Physics/v2/characterController";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import "@babylonjs/core/Physics/physicsEngineComponent";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import HavokPhysics from "@babylonjs/havok";
import havokUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import { streetSurfaces } from "./surfaces";
import { loadStoryCharacters } from "./characters";
import { personPosition, routePosition, walkFrame, type StoryShot } from "./story";

export interface StoryRenderer { backend: string; dispose(): void }

/** One continuous street with locally packaged skeletal characters and WASM physics. */
export async function createStoryRenderer(host: HTMLDivElement, getShot: () => StoryShot | null, signal: AbortSignal): Promise<StoryRenderer> {
  const makeCanvas = () => {
    const element = document.createElement("canvas");
    element.style.cssText = "display:block;width:100%;height:100%";
    host.appendChild(element);
    return element;
  };
  let canvas = makeCanvas();
  let engine: Engine | WebGPUEngine;
  let gpu: WebGPUEngine | undefined;
  try {
    if (import.meta.env.VITE_STORY_RENDERER !== "webgl" && await WebGPUEngine.IsSupportedAsync) {
      gpu = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: false });
      await gpu.initAsync();
      engine = gpu;
    } else engine = new Engine(canvas, true, { stencil: true }, false);
  } catch {
    gpu?.dispose();
    // A canvas that acquired a WebGPU context cannot also acquire WebGL.
    canvas.remove();
    canvas = makeCanvas();
    engine = new Engine(canvas, true, { stencil: true }, false);
  }
  const scene = new Scene(engine);
  try {
    signal.throwIfAborted();
    // Resolve the WASM through Vite so both web and Capacitor builds ship it locally.
    const havok = await HavokPhysics({ locateFile: () => havokUrl });
    signal.throwIfAborted();
    scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, havok));
    engine.setHardwareScalingLevel(Math.max(1, (window.devicePixelRatio || 1) / 1.5));
    scene.clearColor = new Color4(0.67, 0.81, 0.87, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.017;
    scene.fogColor = new Color3(0.74, 0.83, 0.82);
    scene.ambientColor = new Color3(0.4, 0.36, 0.3);
    const camera = new FreeCamera("story-camera", new Vector3(0.1, 1.65, -4), scene);
    camera.fov = 0.86;
    camera.minZ = 0.08;
    camera.maxZ = 100;
    // No attachControl: movement is directed only by story cues.
    scene.activeCamera = camera;
    const sky = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
    sky.intensity = 0.85;
    sky.groundColor = new Color3(0.42, 0.38, 0.3);
    const sun = new DirectionalLight("morning-sun", new Vector3(-0.6, -1, 0.3), scene);
    sun.position = new Vector3(12, 18, -8);
    sun.intensity = 0.85;
    sun.diffuse = new Color3(1, 0.89, 0.71);
    const shadows = new ShadowGenerator(1024, sun);
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
    shadows.darkness = 0.25;
    shadows.bias = 0.002;
    shadows.normalBias = 0.03;
    const surfaces = streetSurfaces(scene);
    const palette = new Map<string, StandardMaterial>();
    const material = (hex: string) => {
      if (!palette.has(hex)) {
        const mat = new StandardMaterial(hex, scene);
        mat.diffuseColor = Color3.FromHexString(hex);
        mat.specularColor = new Color3(0.035, 0.035, 0.035);
        palette.set(hex, mat);
      }
      return palette.get(hex)!;
    };
    const box = (name: string, size: number[], at: number[], color: string, parent?: TransformNode) => {
      const mesh = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
      mesh.position.set(at[0], at[1], at[2]);
      mesh.material = material(color);
      if (parent) mesh.parent = parent;
      mesh.receiveShadows = true;
      shadows.addShadowCaster(mesh);
      return mesh;
    };
    const sphere = (name: string, size: number[], at: number[], color: string, parent?: TransformNode) => {
      const mesh = MeshBuilder.CreateSphere(name, { diameter: 1, segments: 12 }, scene);
      mesh.scaling.set(size[0], size[1], size[2]);
      mesh.position.set(at[0], at[1], at[2]);
      mesh.material = material(color);
      if (parent) mesh.parent = parent;
      shadows.addShadowCaster(mesh);
      return mesh;
    };
    const cylinder = (name: string, height: number, diameter: number, at: number[], color: string, parent?: TransformNode) => {
      const mesh = MeshBuilder.CreateCylinder(name, { height, diameter, tessellation: 12 }, scene);
      mesh.position.set(at[0], at[1], at[2]);
      mesh.material = material(color);
      if (parent) mesh.parent = parent;
      shadows.addShadowCaster(mesh);
      return mesh;
    };
    const solid = (mesh: ReturnType<typeof box>) => new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);
    const floor = box("collision-floor", [60, 0.2, 90], [0, -0.08, 20], "#a5b68b");
    solid(floor); floor.isVisible = false; shadows.removeShadowCaster(floor);
    // The visual ground sits below the paving; coincident surfaces flicker on a GPU.
    box("ground", [60, 0.1, 90], [0, -0.08, 20], "#a5b68b");
    const paving = box("limestone-walk", [6.4, 0.05, 64], [0, -0.005, 20], "#f4ecdc");
    (paving.material as StandardMaterial).diffuseTexture = surfaces.stone;
    for (const side of [-1, 1]) {
      box("drain-channel", [0.1, 0.012, 60], [side * 3.18, 0.025, 20], "#9b9485");
      box("stone-curb", [0.18, 0.14, 60], [side * 3.34, 0.03, 20], "#bcb5a3");
    }
    const sign = (text: string, x: number, y: number, z: number, width = 2.8) => {
      const tex = new DynamicTexture(text, { width: 512, height: 128 }, scene, false);
      tex.drawText(text, null, 85, "bold 50px Georgia", "#fff2cf", "#294d48", true);
      const mat = new StandardMaterial(`sign-${text}`, scene);
      mat.diffuseTexture = tex;
      mat.specularColor = Color3.Black();
      const plane = MeshBuilder.CreatePlane(text, { width, height: 0.65, sideOrientation: 2 }, scene);
      plane.position.set(x, y, z);
      plane.rotation.y = -Math.PI / 2;
      plane.material = mat;
    };
    // A modular Lyon street: repeated windows, shutters, balconies and shopfronts.
    for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
      const z = 4 + i * 5.2;
      const x = side * 6.1;
      const colors = ["#e7cda8", "#eac39d", "#e9dcbd", "#d2c6ab"];
      const height = 7.6 + (i % 3) * 0.7;
      const facadeColor = colors[(i + (side + 1)) % colors.length];
      solid(box("building", [5, height, 5], [x, height / 2, z], facadeColor));
      material(facadeColor).diffuseTexture = surfaces.plaster;
      box("stone-foundation", [5.12, 0.35, 5.06], [x, 0.18, z], "#b9ae98");
      box("floor-stringcourse", [5.14, 0.11, 5.08], [x, 2.95, z], "#e0d2b9");
      box("cornice", [5.35, 0.23, 5.25], [x, height, z], "#eee1c6");
      box("terracotta-roof", [5.5, 0.48, 5.35], [x, height + 0.3, z], "#ead4b7");
      material("#ead4b7").diffuseTexture = surfaces.tiles;
      box("chimney", [0.5, 1.1, 0.55], [x + side, height + 0.8, z - 1.5], "#af866f");
      const facade = side * 3.56;
      for (const y of [3.6, 5.8, 7.8].filter(y => y < height - 0.2)) for (const dz of [-1.45, 0.9]) {
        box("window-trim", [0.1, 1.65, 1.05], [facade, y, z + dz], "#f7e9cc");
        box("window", [0.12, 1.35, 0.78], [facade - side * 0.04, y, z + dz], "#526d72");
        box("window-mullion", [0.14, 1.35, 0.045], [facade - side * 0.075, y, z + dz], "#e7dec9");
        box("window-crossbar", [0.14, 0.045, 0.78], [facade - side * 0.075, y - 0.05, z + dz], "#e7dec9");
        for (const offset of [-0.63, 0.63]) for (let slat = 0; slat < 6; slat++) box("shutter-slat", [0.17, 0.025, 0.34], [facade - side * 0.075, y - 0.53 + slat * 0.21, z + dz + offset], "#4e6a61");
        for (const offset of [-0.63, 0.63]) box("shutter", [0.15, 1.47, 0.35], [facade - side * 0.06, y, z + dz + offset], i % 2 ? "#657d6b" : "#6a8988");
        box("sill", [0.45, 0.13, 1.4], [facade - side * 0.13, y - 0.79, z + dz], "#ecdfc5");
        if (i % 2 === 0) {
          box("balcony", [0.65, 0.12, 1.5], [facade - side * 0.2, y - 0.85, z + dz], "#b3a58d");
          for (let n = -0.6; n <= 0.6; n += 0.2) box("iron-baluster", [0.04, 0.55, 0.035], [facade - side * 0.5, y - 0.52, z + dz + n], "#344b49");
          box("iron-rail", [0.045, 0.045, 1.5], [facade - side * 0.5, y - 0.25, z + dz], "#344b49");
        }
      }
      box("shop-frame", [0.14, 2.4, 3.7], [facade - side * 0.04, 1.2, z], "#355b51");
      for (const dz of [-1.15, 1.15]) box("shop-glass", [0.17, 1.65, 1.35], [facade - side * 0.08, 1.15, z + dz], "#6d8a83");
      material("#6d8a83").diffuseTexture = surfaces.window;
      material("#6d8a83").specularColor.set(0.2, 0.2, 0.2);
      box("door-handle", [0.045, 0.28, 0.035], [facade - side * 0.23, 1.05, z + 0.23], "#bfa276");
      box("rain-pipe", [0.09, height, 0.09], [facade - side * 0.13, height / 2, z + 2.35], "#787a68");
      box("shop-door", [0.19, 2.12, 0.65], [facade - side * 0.1, 1.06, z], "#233f3b");
      const cafe = side === 1 && i === 2;
      const awningColor = cafe ? "#3c6258" : i % 3 === 0 ? "#ac6856" : "#b8a577";
      box("awning", [1.3, 0.14, 4.2], [facade - side * 0.5, 2.65, z], awningColor).rotation.z = side * 0.14;
      for (let stripe = -1.8; stripe < 2; stripe += 0.6) {
        box("awning-stripe", [1.3, 0.025, 0.24], [facade - side * 0.5, 2.73, z + stripe], "#eee2c9").rotation.z = side * 0.14;
        box("awning-valance", [0.08, 0.23, 0.24], [facade - side * 1.14, 2.54, z + stripe], "#eee2c9");
      }
      if (side === 1 && i === 2) sign("CAFÉ LUMIÈRE", facade - 0.15, 2.2, z);
      if (side === -1 && i === 0) sign("BOULANGERIE", facade + 0.15, 2.2, z);
    }
    // Irregular small crowns leave space to see the façades and distant landmark.
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
      const z = -9 + i * 6;
      const x = side * (i < 2 ? 4.4 : 3.02);
      cylinder("tree-trunk", 3.4, 0.16, [x, 1.7, z], "#796349");
      for (let n = 0; n < 10; n++) {
        const phase = n * 2.4 + i * 0.7;
        const leaf = MeshBuilder.CreateIcoSphere("leaf-cluster", { radius: 0.8 + (n % 3) * 0.1, subdivisions: 2, flat: false }, scene);
        leaf.position.set(x + Math.sin(phase) * 0.82, 3.6 + (n % 3) * 0.38, z + Math.cos(phase) * 0.82);
        leaf.scaling.y = 0.8; leaf.material = material(["#79985d", "#93a66b", "#668756", "#a7b47a"][n % 4]);
        shadows.addShadowCaster(leaf);
      }
      for (const direction of [-1, 1]) cylinder("tree-branch", 1, 0.07, [x + direction * 0.22, 3.1, z], "#796349").rotation.z = direction * 0.55;
      if (i % 2 === 0) {
        cylinder("lamp-post", 2.6, 0.075, [side * 2.7, 1.3, z + 2.2], "#334c45");
        box("lantern", [0.3, 0.4, 0.3], [side * 2.7, 2.7, z + 2.2], "#f6dc9d");
        box("lantern-cap", [0.4, 0.07, 0.4], [side * 2.7, 2.95, z + 2.2], "#334c45");
        for (const dx of [-0.13, 0.13]) box("lantern-frame", [0.025, 0.4, 0.32], [side * 2.7 + dx, 2.7, z + 2.2], "#334c45");
      }
    }
    for (const z of [-4, 1, 12, 17, 22]) {
      box("planter", [0.75, 0.5, 1.2], [2.8, 0.25, z], "#ac785e");
      for (let n = 0; n < 5; n++) {
        sphere("shrub", [0.6, 0.65, 0.6], [2.8, 0.65, z - 0.4 + n * 0.2], "#627d4f");
        sphere("flowers", [0.15, 0.13, 0.15], [2.65 + (n % 2) * 0.2, 0.97, z - 0.4 + n * 0.2], n % 2 ? "#e9ad9c" : "#f2d88d");
      }
    }
    for (const z of [13, 15]) {
      cylinder("cafe-table", 0.08, 0.75, [2.4, 0.78, z], "#e4c594");
      cylinder("table-leg", 0.75, 0.08, [2.4, 0.38, z], "#3c5148");
      for (const dz of [-0.65, 0.65]) {
        box("chair-seat", [0.45, 0.07, 0.45], [2.4, 0.43, z + dz], "#997856");
        box("chair-back", [0.45, 0.5, 0.07], [2.4, 0.7, z + dz * 1.3], "#997856");
        for (const dx of [-0.18, 0.18]) for (const offset of [-0.18, 0.18]) cylinder("chair-leg", 0.43, 0.035, [2.4 + dx, 0.21, z + dz + offset], "#3c5148");
      }
    }

    // Small reusable street props mark the park, bakery and café as distinct places.
    for (const side of [-1, 1]) for (const z of [-3.5, 0.2]) {
      for (let slat = 0; slat < 4; slat++) {
        box("bench-seat", [0.13, 0.06, 1.55], [side * (2.35 + slat * 0.14), 0.48, z], "#967858");
        box("bench-back", [0.07, 0.13, 1.55], [side * 2.88, 0.66 + slat * 0.13, z], "#967858");
      }
      for (const dz of [-0.58, 0.58]) box("bench-support", [0.5, 0.46, 0.06], [side * 2.6, 0.23, z + dz], "#344b49");
    }
    for (const z of [4, 14.4, 24.8]) {
      box("flower-box", [0.45, 0.24, 1.15], [3.23, 3.04, z - 1.45], "#a77761");
      for (let n = 0; n < 7; n++) {
        sphere("balcony-leaves", [0.32, 0.26, 0.35], [3.14, 3.23, z - 1.95 + n * 0.16], "#668756");
        sphere("geranium", [0.13, 0.13, 0.14], [3.1, 3.36, z - 1.95 + n * 0.16], n % 2 ? "#ce8077" : "#ebae9f");
      }
    }
    // Café chalkboard and hanging sign are real surfaces in the same street.
    const boardTexture = new DynamicTexture("cafe-menu", { width: 256, height: 384 }, scene, true);
    const boardContext = boardTexture.getContext() as unknown as CanvasRenderingContext2D;
    boardContext.fillStyle = "#2d4540"; boardContext.fillRect(0, 0, 256, 384);
    boardContext.fillStyle = "#f2e7cc"; boardContext.textAlign = "center";
    boardContext.font = "italic 30px Georgia"; boardContext.fillText("Bienvenue", 128, 65);
    boardContext.font = "20px Georgia";
    ["CAFÉ LUMIÈRE", "─────────", "Café • 2 €", "Croissant • 2,50 €", "Thé • 3 €", "", "À bientôt !"].forEach((line, i) => boardContext.fillText(line, 128, 120 + i * 32));
    boardTexture.update();
    const menuMaterial = new StandardMaterial("chalkboard", scene); menuMaterial.diffuseTexture = boardTexture; menuMaterial.specularColor.set(0, 0, 0);
    box("menu-frame", [0.72, 1.05, 0.09], [2.65, 0.72, 11.9], "#967858").rotation.x = -0.12;
    const menu = MeshBuilder.CreatePlane("cafe-menu", { width: 0.62, height: 0.94, sideOrientation: 2 }, scene);
    menu.position.set(2.65, 0.72, 11.83); menu.rotation.x = -0.12; menu.material = menuMaterial;
    for (const dx of [-0.28, 0.28]) box("menu-leg", [0.045, 0.4, 0.045], [2.65 + dx, 0.2, 11.94], "#967858");
    box("sign-bracket", [1, 0.06, 0.06], [3.05, 3.2, 13.4], "#344b49");
    const hangingTexture = new DynamicTexture("cafe-hanging-sign", { width: 256, height: 128 }, scene, true);
    hangingTexture.drawText("CAFÉ", null, 88, "bold 64px Georgia", "#f6e5bc", "#355b51", true);
    const hangingMaterial = new StandardMaterial("hanging-sign", scene); hangingMaterial.diffuseTexture = hangingTexture; hangingMaterial.specularColor.set(0, 0, 0);
    const hanging = MeshBuilder.CreatePlane("hanging-cafe-sign", { width: 0.85, height: 0.44, sideOrientation: 2 }, scene);
    hanging.position.set(2.65, 2.87, 13.4); hanging.material = hangingMaterial;
    for (const z of [13, 15]) {
      const saucer = cylinder("coffee-saucer", 0.014, 0.14, [2.4, 0.832, z], "#f1e9d8");
      saucer.receiveShadows = true;
      cylinder("coffee-cup", 0.08, 0.085, [2.4, 0.87, z], "#f1e9d8");
      cylinder("coffee", 0.004, 0.068, [2.4, 0.913, z], "#594336");
    }
    // A bicycle at the bakery, assembled once and merged with the static props.
    for (const z of [3.25, 4.35]) {
      const wheel = MeshBuilder.CreateTorus("bicycle-wheel", { diameter: 0.61, thickness: 0.035, tessellation: 24 }, scene);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(-3.02, 0.33, z); wheel.material = material("#344b49"); shadows.addShadowCaster(wheel);
    }
    for (const [z, angle] of [[3.8, 0.7], [3.55, -0.7], [4.05, -0.7]]) cylinder("bicycle-frame", 0.7, 0.035, [-3.02, 0.53, z], "#9b6458").rotation.x = angle;
    box("bicycle-seat", [0.16, 0.04, 0.21], [-3.02, 0.88, 3.65], "#544c40");
    cylinder("bicycle-handlebar", 0.34, 0.025, [-3.02, 0.96, 4.16], "#344b49").rotation.z = Math.PI / 2;

    // A modest hilltop landmark closes the horizon without another background image.
    sphere("distant-hill", [65, 9, 24], [0, 0, 65], "#7d9370");
    box("hilltop-church", [4.6, 4.8, 5], [0, 6, 63], "#ddd1b8");
    box("church-roof", [4.9, 0.5, 5.4], [0, 8.5, 63], "#8d928b");
    for (const x of [-1.7, 1.7]) {
      box("church-tower", [1.05, 7.2, 1.05], [x, 7.2, 60.8], "#e3d6bd");
      const spire = MeshBuilder.CreateCylinder("church-spire", { height: 2.5, diameterBottom: 1.4, diameterTop: 0, tessellation: 4 }, scene);
      spire.rotation.y = Math.PI / 4; spire.position.set(x, 12.05, 60.8); spire.material = material("#788888");
      box("spire-cross", [0.04, 0.55, 0.04], [x, 13.5, 60.8], "#53655f");
      box("cross-arm", [0.3, 0.04, 0.04], [x, 13.57, 60.8], "#53655f");
      box("tower-window", [0.34, 1.1, 0.03], [x, 9.6, 60.25], "#66746c");
    }

    // Batch static decoration by material so a phone does not draw each window and leaf separately.
    const batches = new Map<StandardMaterial, Mesh[]>();
    for (const mesh of scene.meshes) {
      if (!(mesh instanceof Mesh) || mesh.physicsBody || !(mesh.material instanceof StandardMaterial)) continue;
      const batch = batches.get(mesh.material) ?? [];
      batch.push(mesh);
      batches.set(mesh.material, batch);
    }
    for (const batch of batches.values()) {
      if (batch.length < 2) continue;
      const merged = Mesh.MergeMeshes(batch, true, true);
      if (merged) { merged.receiveShadows = true; shadows.addShadowCaster(merged); }
    }
    const renderList = shadows.getShadowMap()?.renderList;
    if (renderList) shadows.getShadowMap()!.renderList = renderList.filter(mesh => !mesh.isDisposed());

    const characters = await loadStoryCharacters(scene, shadows, signal);
    signal.throwIfAborted();
    const { sophie, player, passerby, shopkeeper } = characters;
    const controller = new PhysicsCharacterController(new Vector3(-0.65, 0.95, 1), { capsuleHeight: 1.8, capsuleRadius: 0.22 }, scene);
    const gravity = new Vector3(0, -9.81, 0);
    let stridePhase = 0;
    const previousFoot = controller.getPosition().clone();
    let key = "", elapsed = 0, time = 0, walkingBlend = 0, cameraZ = 0, first = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = new ResizeObserver(() => engine.resize()); resize.observe(canvas);
    engine.resize();
    engine.runRenderLoop(() => {
      const shot = getShot();
      if (!shot || document.hidden) return;
      const delta = Math.min(engine.getDeltaTime() || 16, 100) / 1000;
      const changed = key !== shot.key;
      if (changed) { key = shot.key; elapsed = 0; }
      if (shot.paused && !changed) { scene.render(); return; }
      if (!shot.paused) { elapsed += delta * 1000; time += delta; }
      const frame = shot.walk ? walkFrame(shot.walk, elapsed) : undefined;
      const targetZ = frame?.z ?? routePosition(shot.scene, shot.zoom);
      if (first || (changed && Math.abs(cameraZ - targetZ) > 5)) { cameraZ = targetZ; first = false; }
      cameraZ += (targetZ - cameraZ) * (reducedMotion ? 1 : 1 - Math.exp(-delta * 7));
      const walking = shot.mode === "walk" || (shot.mode === "arrival" && elapsed < 1800);
      const desired = new Vector3(-0.65, 0.95, cameraZ + 2.8);
      if (shot.mode === "arrival") {
        const arrival = Math.min(1, elapsed / 1800);
        desired.z += 3 * (1 - arrival * arrival * (3 - 2 * arrival));
      }
      if ((changed && shot.mode === "arrival") || Vector3.Distance(controller.getPosition(), desired) > 6) controller.setPosition(desired);
      if (!shot.paused) {
        const current = controller.getPosition();
        const velocity = desired.subtract(current).scale(7);
        velocity.y = controller.getVelocity().y;
        controller.setVelocity(velocity);
        controller.integrate(delta, controller.checkSupport(delta, Vector3.Down()), gravity);
      }
      const foot = controller.getPosition();
      const distance = changed ? 0 : Math.hypot(foot.x - previousFoot.x, foot.z - previousFoot.z);
      stridePhase += distance * Math.PI * 2 / 1.2;
      const moving = Math.min(1, distance / Math.max(delta, 0.001) / 0.9);
      walkingBlend += (moving - walkingBlend) * (1 - Math.exp(-delta * 9));
      previousFoot.copyFrom(foot);
      sophie.root.position.copyFrom(foot); sophie.root.position.y -= 0.9;
      const direction = walking && shot.mode !== "arrival" ? 0 : Math.PI;
      let angle = direction - sophie.root.rotation.y;
      angle = Math.atan2(Math.sin(angle), Math.cos(angle));
      if (!shot.paused) sophie.root.rotation.y += angle * (1 - Math.exp(-delta * 5));
      sophie.root.setEnabled(shot.mode !== "title");
      sophie.tick(time, walkingBlend, shot.speakingId === "sophie", Boolean(shot.wave) || (shot.mode === "arrival" && elapsed >= 1800), stridePhase);
      player.root.position.set(0.55, 0.04, cameraZ + 0.5);
      player.root.rotation.y = walking ? 0 : -0.4;
      player.root.setEnabled(shot.mode === "walk");
      player.tick(time + 0.2, walkingBlend, false, false, stridePhase + 0.7);
      const people = frame?.people ?? shot.people ?? [];
      for (const id of ["passerby", "shopkeeper"] as const) {
        const person = people.find(p => p.id === id);
        const actor = characters[id];
        actor.root.setEnabled(Boolean(person));
        if (!person) continue;
        const at = personPosition(person, frame?.segmentProgress ?? Math.min(1, elapsed / 1800), cameraZ);
        actor.root.position.set(at.x, 0.04, at.z);
        actor.root.rotation.y = Math.PI;
        actor.tick(time, at.moving && !shot.paused ? 1 : 0, shot.speakingId === id, Boolean(person.wave));
      }
      const focused = shot.focus === "passerby" ? passerby : shot.focus === "shopkeeper" ? shopkeeper : sophie;
      const close = shot.mode === "conversation";
      const portrait = close && shot.framing === "portrait";
      const aim = new Vector3(portrait ? focused.root.position.x : close ? focused.root.position.x * 0.75 : -0.3, portrait ? 1.57 : close ? 0.85 : 1.45, close ? focused.root.position.z : cameraZ + 6);
      const position = new Vector3(close ? focused.root.position.x + (portrait ? 0.035 : 0.15) : 0.35, portrait ? 1.73 : close ? 1.55 : 1.85, close ? focused.root.position.z - (portrait ? 1.05 : 3.15) : cameraZ - 3.4);
      camera.position.copyFrom(Vector3.Lerp(camera.position, position, reducedMotion ? 1 : 1 - Math.exp(-delta * 3)));
      camera.setTarget(aim);
      scene.render();
    });
    return { backend: engine instanceof WebGPUEngine ? "WebGPU" : "WebGL", dispose() { resize.disconnect(); engine.stopRenderLoop(); controller.dispose(); characters.disposeTemplates(); scene.dispose(); engine.dispose(); canvas.remove(); } };
  } catch (error) { scene.dispose(); engine.dispose(); canvas.remove(); throw error; }
}
