import { useEffect, useState, type CSSProperties } from "react";
import { listCharacterAssetPaths, resolveConversationVisual } from "../../characters/resolve";
import type { CharacterExpression, ConversationVisual } from "../../characters/types";
import { assetUrl } from "../assets";

/** How long the eyes stay shut in a blink. */
const BLINK_MS = 140;

type Props = {
  character: string;
  expression?: CharacterExpression;
  speaking: boolean;
};

/**
 * A character's close-up, described semantically. One master image shows the
 * expression; speaking only fades a small mouth patch in over it, so the rest
 * of the portrait cannot move between mouth states.
 */
export function CharacterPortrait({ character, expression, speaking }: Props) {
  const requested = resolveConversationVisual({ character, expression, activity: "speaking" });
  const [shown, setShown] = useState<ConversationVisual | undefined>(requested);

  // Warm the cache so later pose changes are immediate.
  useEffect(() => {
    for (const path of listCharacterAssetPaths(character)) {
      if (path.includes("/conversation/")) new Image().src = assetUrl(path);
    }
  }, [character]);

  // Swap poses only once the new image is decoded, so there is no blank frame between them.
  useEffect(() => {
    if (!requested) return;
    let cancelled = false;
    const image = new Image();
    image.src = assetUrl(requested.path);
    const ready = typeof image.decode === "function" ? image.decode().catch(() => undefined) : Promise.resolve();
    ready.then(() => {
      if (!cancelled) setShown(requested);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested?.path]);

  // Now and then she blinks: a moment with her eyes shut, at an unhurried, uneven pace.
  const [blinking, setBlinking] = useState(false);
  const canBlink = Boolean(shown?.blinkOverlay);
  useEffect(() => {
    if (!canBlink || (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)) return;
    let timer: number;
    const next = () => {
      timer = window.setTimeout(() => {
        setBlinking(true);
        timer = window.setTimeout(() => {
          setBlinking(false);
          next();
        }, BLINK_MS);
      }, 2500 + Math.random() * 3500);
    };
    next();
    return () => {
      window.clearTimeout(timer);
      setBlinking(false);
    };
  }, [canBlink, shown?.path]);

  if (!shown) return null;
  const mouth = shown.mouthOverlay;
  const blink = shown.blinkOverlay;
  const figureStyle = { "--portrait-ratio": shown.aspectRatio } as CSSProperties;
  return (
    <div className="portrait" aria-hidden="true">
      <div className="portrait-figure" style={figureStyle}>
        <img className="portrait-base" src={assetUrl(shown.path)} alt="" draggable={false} />
        {blink && (
          <img
            className="portrait-blink"
            src={assetUrl(blink.path)}
            alt=""
            draggable={false}
            style={{
              left: `${blink.left * 100}%`,
              top: `${blink.top * 100}%`,
              width: `${blink.width * 100}%`,
              height: `${blink.height * 100}%`,
              opacity: blinking ? 1 : 0
            }}
          />
        )}
        {mouth && (
          <img
            className="portrait-mouth"
            src={assetUrl(mouth.path)}
            alt=""
            draggable={false}
            style={{
              left: `${mouth.left * 100}%`,
              top: `${mouth.top * 100}%`,
              width: `${mouth.width * 100}%`,
              height: `${mouth.height * 100}%`,
              opacity: speaking ? 1 : 0
            }}
          />
        )}
      </div>
    </div>
  );
}
