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

  // Stepped back, a character with full-body art for this moment is shown whole;
  // the portrait resolved above stands in until that art is on disk.
  const wide = definition.conversation.wide;
  const widePath = request.framing === "wide" && wide
    ? wide[requestedExpression] ?? (fallbacks[requestedExpression] ? wide[fallbacks[requestedExpression]!] : undefined)
    : undefined;
  if (widePath) {
    const portrait = resolveConversationVisual({ ...request, framing: "close" }, catalog);
    return {
      character: definition.id,
      requestedExpression,
      expression: requestedExpression,
      activity: "closed",
      path: widePath,
      aspectRatio: canvas.width / canvas.height,
      art: "full-body",
      standIn: portrait
    };
  }

  const rect = asset.mouthRect ?? mouthRect;
  const canSpeak = request.activity === "speaking" && asset.mouthOpen !== undefined && rect !== undefined;
  const fractions = (area: { x: number; y: number; width: number; height: number }) => ({
    left: area.x / canvas.width,
    top: area.y / canvas.height,
    width: area.width / canvas.width,
    height: area.height / canvas.height
  });
  return {
    character: definition.id,
    requestedExpression,
    expression,
    activity: canSpeak ? "speaking" : "closed",
    path: asset.closed,
    mouthOverlay: canSpeak && asset.mouthOpen && rect ? { path: asset.mouthOpen, ...fractions(rect) } : undefined,
    blinkOverlay: asset.blink ? { path: asset.blink.path, ...fractions(asset.blink.rect) } : undefined,
    aspectRatio: canvas.width / canvas.height,
    art: "portrait"
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

/** Full-body art for wide framing. It may not be on disk yet, so it is preloaded but never required. */
export function listOptionalArt(character: string, catalog: Catalog = characterVisuals): string[] {
  return [...new Set(Object.values(catalog[character]?.conversation?.wide ?? {}))];
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
    if (expression.blink) paths.add(expression.blink.path);
  }
  return [...paths];
}
