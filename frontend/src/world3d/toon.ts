import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import type { MaterialDefines } from "@babylonjs/core/Materials/materialDefines";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

/** Quantize illumination, rather than paint colour, so dark hair and skin retain their hue. */
export class StoryToonMaterial extends MaterialPluginBase {
  constructor(material: StandardMaterial, private readonly softFace = false) {
    super(material, "StoryToon", 200, { STORY_TOON_SOFT_FACE: false }, true, true);
  }
  override prepareDefines(defines: MaterialDefines) {
    (defines as MaterialDefines & { STORY_TOON_SOFT_FACE: boolean }).STORY_TOON_SOFT_FACE = this.softFace;
  }
  override isCompatible(language: ShaderLanguage) {
    return language === ShaderLanguage.GLSL || language === ShaderLanguage.WGSL;
  }
  override getCustomCode(shaderType: string, language = ShaderLanguage.GLSL) {
    if (shaderType !== "fragment") return null;
    const wgsl = language === ShaderLanguage.WGSL;
    const code = wgsl ? `
      let storyAlbedo = diffuseColor * baseColor.rgb;
      let storyLight = dot(color.rgb, vec3f(0.299, 0.587, 0.114)) / max(dot(storyAlbedo, vec3f(0.299, 0.587, 0.114)), 0.025);
      #ifdef STORY_TOON_SOFT_FACE
      let storyBand = 0.86 + 0.10 * smoothstep(0.55, 0.75, storyLight) + 0.08 * smoothstep(0.90, 1.10, storyLight);
      #else
      let storyBand = 0.62 + 0.20 * smoothstep(0.55, 0.65, storyLight) + 0.28 * smoothstep(0.95, 1.05, storyLight);
      #endif
      let storyEdge = 1.0 - smoothstep(0.08, 0.28, abs(dot(normalW, viewDirectionW)));
      color = vec4f(storyAlbedo * storyBand * (1.0 - storyEdge * 0.12), color.a);
    ` : `
      vec3 storyAlbedo = diffuseColor * baseColor.rgb;
      float storyLight = dot(color.rgb, vec3(0.299, 0.587, 0.114)) / max(dot(storyAlbedo, vec3(0.299, 0.587, 0.114)), 0.025);
      #ifdef STORY_TOON_SOFT_FACE
      float storyBand = 0.86 + 0.10 * smoothstep(0.55, 0.75, storyLight) + 0.08 * smoothstep(0.90, 1.10, storyLight);
      #else
      float storyBand = 0.62 + 0.20 * smoothstep(0.55, 0.65, storyLight) + 0.28 * smoothstep(0.95, 1.05, storyLight);
      #endif
      float storyEdge = 1.0 - smoothstep(0.08, 0.28, abs(dot(normalW, viewDirectionW)));
      color.rgb = storyAlbedo * storyBand * (1.0 - storyEdge * 0.12);
    `;
    return { CUSTOM_FRAGMENT_BEFORE_FOG: code };
  }
}
