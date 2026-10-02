import { characterVisuals } from "./catalog";
import type {
  CharacterVisualDefinition, ConversationVisual, ConversationVisualRequest, WorldDirection, WorldPoseAsset, WorldVisual
} from "./types";

type Catalog = Record<string, CharacterVisualDefinition>;

/**
 * Resolve `{ character, expression, activity }` to an image. Returns undefined for
 * characters without conversation art, so callers can present them without a portrait.
 */
export function resolveConversationVisual(
  request: ConversationVisualRequest,
  catalog: Catalog = characterVisuals
): ConversationVisual | undefined {
  const definition = catalog[request.character];
  if (!definition?.conversation) return undefined;

  const { expressions, fallbacks, defaultExpression, canvas, mouthRect } = definition.conversation;
  const requestedExpression = request.expression ?? defaultExpression;
  const expression = expressions[requestedExpression]
    ? requestedExpression
    : fallbacks[requestedExpression] && expressions[fallbacks[requestedExpression]]
      ? fallbacks[requestedExpression]
      : defaultExpression;
  const asset = expressions[expression];
  if (!asset) return undefined;

  const canSpeak = request.activity === "speaking" && asset.mouthOpen !== undefined && mouthRect !== undefined;
  return {
    character: definition.id,
    requestedExpression,
    expression,
    activity: canSpeak ? "speaking" : "closed",
    path: asset.closed,
    mouthOverlay: canSpeak && asset.mouthOpen && mouthRect
      ? {
          path: asset.mouthOpen,
          left: mouthRect.x / canvas.width,
          top: mouthRect.y / canvas.height,
          width: mouthRect.width / canvas.width,
          height: mouthRect.height / canvas.height
        }
      : undefined,
    aspectRatio: canvas.width / canvas.height
  };
}

export function resolveWorldVisual(character: string, catalog: Catalog = characterVisuals): WorldVisual | undefined {
  const definition = catalog[character];
  if (!definition) return undefined;
  return { character: definition.id, ...definition.world };
}

/**
 * The frames that show a pose while heading in a direction. A character with only
 * front art keeps facing the camera; side art is mirrored for the left.
 */
export function worldFrames(asset: WorldPoseAsset, direction: WorldDirection): { frames: string[]; mirrored: boolean } {
  if (direction === "up" && asset.back?.length) return { frames: asset.back, mirrored: false };
  if ((direction === "left" || direction === "right") && asset.side?.length) return { frames: asset.side, mirrored: direction === "left" };
  return { frames: asset.frames, mirrored: false };
}

/** Every image a character can show; used for preloading and asset checks. */
export function listCharacterAssetPaths(character: string, catalog: Catalog = characterVisuals): string[] {
  const definition = catalog[character];
  if (!definition) return [];
  const paths = new Set<string>();
  for (const pose of Object.values(definition.world.poses)) {
    for (const frame of [...pose.frames, ...(pose.back ?? []), ...(pose.side ?? [])]) paths.add(frame);
  }
  for (const expression of Object.values(definition.conversation?.expressions ?? {})) {
    paths.add(expression.closed);
    if (expression.mouthOpen) paths.add(expression.mouthOpen);
  }
  return [...paths];
}
