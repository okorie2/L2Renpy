import { useEffect, useState, type CSSProperties } from "react";

/** A painted place shown behind a scene's conversation, with URLs ready to load. */
export interface SceneLayer {
  id: string;
  image: string;
  /** Shown while `image` is not delivered yet. */
  standIn: string;
  standInPosition?: string;
  drift?: boolean;
}

/** Art found missing once is not asked for again. */
const missing = new Set<string>();

/** One painting; it falls back to its stand-in when its own file is not there. */
export function ScenePainting({ layer, style }: { layer: SceneLayer; style?: CSSProperties }) {
  const [failed, setFailed] = useState(() => missing.has(layer.image));
  const useStandIn = failed && layer.image !== layer.standIn;
  return (
    <img
      className={`scene-painting${layer.drift ? " drift" : ""}`}
      src={useStandIn ? layer.standIn : layer.image}
      style={{ ...style, ...(useStandIn && layer.standInPosition ? { objectPosition: layer.standInPosition } : {}) }}
      onError={() => {
        missing.add(layer.image);
        setFailed(true);
      }}
      alt=""
    />
  );
}

/**
 * The place behind the conversation. A new place fades in over the last one,
 * which stays underneath until it has, so there is never a gap between them.
 */
function SceneBackdrop({ scene }: { scene: SceneLayer }) {
  const [layers, setLayers] = useState<SceneLayer[]>([scene]);
  useEffect(() => {
    setLayers((current) => (current.at(-1)?.id === scene.id ? current : [...current.slice(-1), scene]));
  }, [scene]);
  return (
    <div className="scene-backdrop">
      {layers.map((layer) => (
        <div key={layer.id} className="scene-layer">
          <ScenePainting layer={layer} />
        </div>
      ))}
    </div>
  );
}

export type OpeningStage = "title" | "walking" | "talking" | "leaving" | "done";

export interface OpeningArt {
  backdrop: string;
  idle: string;
  waving: string;
  walking: string[];
}

type Props = {
  stage: OpeningStage;
  art: OpeningArt;
  /** The first tap: it starts the scene and lets the game play sound. */
  onStart: () => void;
  /** She has walked up and waved; the welcome can begin. */
  onArrived: () => void;
  /** Shown if the player closed the welcome before it finished. */
  onTalk?: () => void;
  talkLabel?: string;
  /** Where the story has moved on to, such as the street on the way to the café. */
  scene?: SceneLayer;
  title: { eyebrow: string; heading: string; headingLang: string; text: string };
};

/** As in the Ren'Py opening: 1.8 s walking toward the camera, then a wave. */
const WALK_MS = 1800;
/** Two unhurried strides: each foot forward once, then she arrives. */
const STEP_MS = 450;
const WAVE_MS = 900;

/**
 * The game's first scene, after the Ren'Py prototype: the park, Sophie walking
 * up the path toward the camera, a wave, and then her welcome. It is a picture
 * with a figure on it, not a place to walk around; the street comes after.
 */
export function OpeningScene({ stage, art, onStart, onArrived, onTalk, talkLabel = "Talk to Sophie", scene, title }: Props) {
  const [pose, setPose] = useState<"hidden" | "walking" | "waving" | "idle">("hidden");
  const [frame, setFrame] = useState(0);
  const [near, setNear] = useState(false);

  // Fetch the art at once, so the walk does not start on half-loaded images.
  useEffect(() => {
    for (const url of [art.backdrop, art.idle, art.waving, ...art.walking]) {
      const image = new Image();
      image.src = url;
    }
  }, [art]);

  useEffect(() => {
    if (stage !== "walking") return;
    setPose("walking");
    // Start far up the path; the next frame starts the move toward the camera.
    const start = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setNear(true)));
    const steps = window.setInterval(() => setFrame((current) => current + 1), STEP_MS);
    const wave = window.setTimeout(() => {
      window.clearInterval(steps);
      setPose("waving");
    }, WALK_MS);
    const arrive = window.setTimeout(() => {
      setPose("idle");
      onArrived();
    }, WALK_MS + WAVE_MS);
    return () => {
      window.cancelAnimationFrame(start);
      window.clearInterval(steps);
      window.clearTimeout(wave);
      window.clearTimeout(arrive);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  if (stage === "done") return null;
  const source = pose === "walking" ? art.walking[frame % art.walking.length] : pose === "waving" ? art.waving : art.idle;
  // While she talks, her close-up stands in for the small figure.
  const figureVisible = pose !== "hidden" && stage === "walking";

  return (
    <div className={`opening-scene${stage === "leaving" ? " leaving" : ""}`}>
      <img className="opening-backdrop" src={art.backdrop} alt="" />
      {/* Her shadow on the path keeps her feet on the ground as she comes closer. */}
      <div
        className={`opening-shadow${near ? " near" : ""}${figureVisible ? " visible" : ""}`}
        style={{ transitionDuration: `${WALK_MS}ms, ${WALK_MS}ms, ${WALK_MS}ms, 300ms` }}
      />
      <img
        className={`opening-sophie${near ? " near" : ""}${figureVisible ? " visible" : ""}`}
        src={source}
        alt=""
        style={{ transitionDuration: `${WALK_MS}ms, ${WALK_MS}ms, ${WALK_MS}ms, 300ms` }}
      />
      {scene && <SceneBackdrop scene={scene} />}
      {stage === "title" && (
        <div className="opening-card" role="dialog" aria-label="Welcome">
          <p className="eyebrow">{title.eyebrow}</p>
          <h1 lang={title.headingLang}>{title.heading}</h1>
          <p>{title.text}</p>
          <button className="primary-pill" onClick={onStart}>Start</button>
          <p className="field-note">Turn your sound on.</p>
        </div>
      )}
      {stage === "talking" && onTalk && (
        <div className="opening-card compact">
          <button className="primary-pill" onClick={onTalk}>{talkLabel}</button>
        </div>
      )}
    </div>
  );
}
