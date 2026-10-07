import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DEFAULT_WALK_X, SCENES, SOPHIE_WALK, STREET_PEOPLE, STREET_POSES, placeBetween, streetPlace, type SceneBackdrop, type StreetPlace } from "../../content/scenes";
import type { StreetPose, StreetPresence, WalkInterlude as Walk } from "../../dialogue/models";
import { assetUrl } from "../assets";
import { ScenePainting } from "./OpeningScene";

/** Pulling back from Sophie's close-up before she sets off. */
const PULL_BACK_MS = 1500;
/** One stretch dissolves into the next over this long. */
const DISSOLVE_MS = 900;
/** Without a walk cycle: one step's time, for moving her single pose in step. */
const STEP_MS = 650;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const easeOut = (value: number) => 1 - (1 - value) ** 3;
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const paintingOf = (scene: SceneBackdrop) => ({ ...scene, image: assetUrl(scene.image), standIn: assetUrl(scene.standIn), drift: false });

/** The walk cycle when every frame of it is on disk; otherwise none, and the single pose stands in. */
let walkCycle: Promise<string[] | undefined> | undefined;
function loadWalkCycle(): Promise<string[] | undefined> {
  walkCycle ??= Promise.all(SOPHIE_WALK.frames.map((path) => new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image.src);
    image.onerror = reject;
    image.src = assetUrl(path);
  }))).then((frames) => frames, () => undefined);
  return walkCycle;
}

/** Art that may not be on disk yet; found missing once, it is not asked for again. */
const missing = new Set<string>();
function useOptionalImage(path: string | undefined): string | undefined {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(false);
    if (!path || missing.has(path)) return;
    const image = new Image();
    image.onload = () => setOk(true);
    image.onerror = () => missing.add(path);
    image.src = assetUrl(path);
  }, [path]);
  return ok && path ? assetUrl(path) : undefined;
}

const reducedMotion = () => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

/**
 * Someone in a layer of the shot: where they are now, and where they are heading on a
 * card. `walkMs` is how long they have been walking, while they are on the move.
 */
type Placed = { id: string; place: StreetPlace; wave?: boolean; walkMs?: number; leaving?: StreetPlace };

/** Someone's walk cycle when every frame of it is on disk; otherwise none. */
const walkCycles = new Map<string, Promise<string[] | undefined>>();
function useWalkCycle(id: string): string[] | undefined {
  const frames = STREET_PEOPLE[id]?.walk?.frames;
  const [cycle, setCycle] = useState<string[] | undefined>(undefined);
  useEffect(() => {
    if (!frames) return;
    let live = true;
    if (!walkCycles.has(id)) {
      walkCycles.set(id, Promise.all(frames.map((path) => new Promise<string>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image.src);
        image.onerror = reject;
        image.src = assetUrl(path);
      }))).then((loaded) => loaded, () => undefined));
    }
    void walkCycles.get(id)!.then((loaded) => { if (live) setCycle(loaded); });
    return () => { live = false; };
  }, [id, frames]);
  return cycle;
}

/** Time since this was first shown, ticking every frame while `running`. */
function useClock(running: boolean): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let handle = requestAnimationFrame(function tick(at) {
      setNow(at - start);
      handle = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(handle);
  }, [running]);
  return now;
}
type Layer = { key: string; scene: SceneBackdrop; zoom: number; opacity: number; people?: Placed[] };

/** Walking off past the camera, on a card: over this long. */
const LEAVE_MS = 1800;

/** Someone else on the street. Their mouth moves while they speak, when that art has been drawn. */
function Person({ person, speaking }: { person: Placed; speaking: boolean }) {
  const art = STREET_PEOPLE[person.id];
  const wave = useOptionalImage(person.wave ? art.wave : undefined);
  const talking = useOptionalImage(person.wave && wave ? art.waveTalking : art.talking);
  const cycle = useWalkCycle(person.id);
  const { place, leaving } = person;
  // On a card, walking off keeps its own time; on a walk, the walk's clock is passed in.
  const leavingFor = useClock(Boolean(leaving && art.walk));
  const walkMs = person.walkMs ?? (leaving ? leavingFor : undefined);
  const stepping = walkMs !== undefined && Boolean(art.walk);
  const frame = stepping && cycle ? cycle[Math.floor(walkMs! / art.walk!.frameMs) % cycle.length] : undefined;
  // Without the frames, a still picture bobs in step instead.
  const bob = stepping && !cycle ? -3 * Math.abs(Math.sin((walkMs! / 600) * Math.PI + 0.7)) : 0;
  const style: CSSProperties & Record<string, string> = {
    left: `${place.left * 100}%`,
    bottom: `${place.bottom * 100}%`,
    height: `${place.height * 100}%`,
    ...(bob ? { transform: `translateX(-50%) translateY(${bob}px)` } : {}),
    ...(leaving ? {
      "--to-left": `${leaving.left * 100}%`,
      "--to-bottom": `${leaving.bottom * 100}%`,
      "--to-height": `${leaving.height * 100}%`,
      animationDuration: `${LEAVE_MS}ms`
    } : {})
  };
  return (
    <div className={`street-person${leaving ? " leaving" : ""}`} style={style}>
      <div className="street-person-shadow" aria-hidden="true" />
      <img src={frame ?? wave ?? assetUrl(art.image)} alt="" draggable={false} />
      {talking && !frame && <img className="street-person-talking" src={talking} alt="" draggable={false} style={{ opacity: speaking ? 1 : 0 }} />}
    </div>
  );
}

/**
 * One shot of the street: the painted place at the camera's zoom (the camera keeps its
 * distance behind Sophie, so zooming in is moving along with her), anyone else who is
 * there, standing in the painting so they come closer as the camera does, and Sophie
 * a few steps ahead.
 */
function StreetShot({ layers, figure, speakingId, children }: {
  layers: Layer[];
  figure: ReactNode;
  /** Whoever's mouth is moving now. */
  speakingId?: string;
  children?: ReactNode;
}) {
  return (
    <div className="walk-interlude" role="img" aria-label="On the street with Sophie">
      {layers.map((layer) => (
        <div key={layer.key} className="walk-camera" style={{ transform: `scale(${layer.zoom})`, opacity: layer.opacity }}>
          <div className="walk-layer"><ScenePainting layer={paintingOf(layer.scene)} /></div>
          {[...(layer.people ?? [])].sort((a, b) => a.place.height - b.place.height).map((person) => (
            <Person key={person.id} person={person} speaking={speakingId === person.id} />
          ))}
        </div>
      ))}
      {figure}
      {children}
    </div>
  );
}

/** Sophie's figure on the street, in the same place whether she walks or stands. */
function Figure({ source, overlay, transform, x }: { source: string; overlay?: { src: string; visible: boolean }; transform?: string; x: number }) {
  return (
    <div className="walk-figure" style={{ left: `${x * 100}%`, transform: transform ?? "translateX(-50%)" }}>
      <div className="walk-shadow" />
      <img src={source} alt="" draggable={false} />
      {overlay && <img className="walk-figure-talking" src={overlay.src} alt="" draggable={false} style={{ opacity: overlay.visible ? 1 : 0 }} />}
    </div>
  );
}

/**
 * Walking with Sophie: the camera follows just behind her. She keeps her size in the
 * middle of the frame while the painting comes toward the camera, which is the ground
 * she covers; a walk through two places dissolves from one into the next. Everything
 * is worked out from the time walked so far, so pausing simply stops the clock.
 */
export function WalkInterlude({ walk, paused, onDone, controls }: {
  walk: Walk;
  /** Held by the learner: the walk stops where it is. */
  paused: boolean;
  /** The walk is over; called once. */
  onDone: () => void;
  controls?: ReactNode;
}) {
  const [frames, setFrames] = useState<string[] | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void loadWalkCycle().then((cycle) => { if (live) setFrames(cycle); });
    new Image().src = assetUrl(SOPHIE_WALK.standIn);
    new Image().src = assetUrl(STREET_POSES.glance.image);
    return () => { live = false; };
  }, []);

  const [elapsed, setElapsed] = useState(0);
  const done = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    done.current = false;
    setElapsed(0);
    let last = performance.now();
    let total = 0;
    let handle = requestAnimationFrame(function tick(now) {
      if (!pausedRef.current) total += Math.min(now - last, 100);
      last = now;
      setElapsed(total);
      if (total >= walk.durationMs) {
        if (!done.current) {
          done.current = true;
          onDone();
        }
        return;
      }
      handle = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(handle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk]);

  const reduced = reducedMotion();
  const pullMs = walk.pullBack ? PULL_BACK_MS : 0;
  const pull = easeOut(clamp(elapsed / Math.max(1, pullMs)));
  const walkingMs = Math.max(1, walk.durationMs - pullMs);
  const walkTime = Math.max(0, elapsed - pullMs);
  const segments = walk.segments.filter((segment) => SCENES[segment.scene]);
  const share = walkingMs / Math.max(1, segments.length);

  // Each stretch moves the camera along over its share of the walk; the next one fades in over the join.
  const layers: Layer[] = segments.map((segment, index) => {
    const along = reduced ? 1 : clamp((walkTime - index * share) / share);
    let zoom = lerp(segment.zoom[0], segment.zoom[1], along);
    // The first walk opens close on her and pulls back before she sets off.
    if (index === 0 && elapsed < pullMs) zoom = lerp(segment.zoom[0] * 1.18, segment.zoom[0], pull);
    const opacity = index === 0 ? 1 : clamp((walkTime - index * share + DISSOLVE_MS / 2) / DISSOLVE_MS);
    const people = (segment.people ?? []).flatMap((presence): Placed[] => {
      const from = streetPlace(presence.id, presence.at);
      const to = streetPlace(presence.id, presence.to ?? presence.at);
      if (!from || !to) return [];
      const start = presence.start ?? 0;
      const moved = reduced ? 1 : clamp((along - start) / Math.max(0.01, 1 - start));
      const moving = moved > 0 && moved < 1 && from !== to;
      return [{ id: presence.id, place: placeBetween(from, to, moved), wave: presence.wave, ...(moving ? { walkMs: walkTime } : {}) }];
    });
    return { key: `${index}:${segment.scene}`, scene: SCENES[segment.scene], zoom, opacity, people };
  }).filter((layer, index, all) => index === all.length - 1 || all[index + 1].opacity < 1);

  // Her place across the screen follows the path of whichever place is showing, moving
  // over smoothly as one place dissolves into the next.
  const figureX = layers.reduce((x, layer) => lerp(x, layer.scene.walkX ?? DEFAULT_WALK_X, layer.opacity), layers[0]?.scene.walkX ?? DEFAULT_WALK_X);
  // She sets off a little before the camera has finished pulling back.
  const stepping = elapsed - pullMs * 0.55;
  const figureScale = walk.pullBack ? lerp(2.6, 1, pull) : 1;
  let source = frames ? frames[0] : assetUrl(SOPHIE_WALK.standIn);
  let bob = 0;
  let sway = 0;
  let tilt = 0;
  if (stepping > 0 && !reduced) {
    if (frames) {
      // Frames have their own durations; find the one for this moment of the cycle.
      const cycle = SOPHIE_WALK.frameMs.reduce((sum, ms) => sum + ms, 0);
      let into = stepping % cycle;
      let index = 0;
      while (into >= SOPHIE_WALK.frameMs[index]) into -= SOPHIE_WALK.frameMs[index++];
      source = frames[index];
    } else {
      // One pose, moved in step: up on each stride, leaning onto the leading foot.
      const phase = (stepping / STEP_MS) * Math.PI;
      bob = -7 * Math.abs(Math.sin(phase));
      sway = 4 * Math.sin(phase);
      tilt = 1.8 * Math.sin(phase);
    }
  }

  return (
    <StreetShot
      layers={layers}
      figure={<Figure x={figureX} source={source} transform={`translateX(calc(-50% + ${sway}px)) translateY(${bob}px) scale(${figureScale}) rotate(${tilt}deg)`} />}
    >
      {controls}
    </StreetShot>
  );
}

/**
 * Talking on the street: the shot the last walk ended on, held. Sophie has stopped
 * where she was and looks back over her shoulder (or, at the café, has turned round);
 * her mouth moves while she speaks, when that pose has a talking version.
 */
export function StreetStage({ scene, zoom, pose = "glance", people = [], speakingId }: {
  scene: SceneBackdrop;
  zoom: number;
  pose?: StreetPose;
  people?: StreetPresence[];
  /** Who is speaking, while the voice is sounding (their mouth moves, when drawn). */
  speakingId?: string;
}) {
  const art = STREET_POSES[pose] ?? STREET_POSES.glance;
  const talking = useOptionalImage(art.talking);
  const placed = people.flatMap((presence): Placed[] => {
    const place = streetPlace(presence.id, presence.at);
    if (!place) return [];
    const leaving = presence.to && presence.to !== presence.at ? streetPlace(presence.id, presence.to) : undefined;
    return [{ id: presence.id, place, wave: presence.wave, ...(leaving ? { leaving } : {}) }];
  });
  return (
    <StreetShot
      layers={[{ key: scene.id, scene, zoom, opacity: 1, people: placed }]}
      speakingId={speakingId}
      figure={<Figure x={scene.walkX ?? DEFAULT_WALK_X} source={assetUrl(art.image)} overlay={talking ? { src: talking, visible: speakingId === "sophie" } : undefined} />}
    >
      <div className="street-scrim" aria-hidden="true" />
    </StreetShot>
  );
}
