import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { log, describeError } from "../diagnostics/log";
import type { StoryShot } from "./story";
import type { StoryRenderer } from "./renderer";

type Channel = "opening" | "conversation";
const Context = createContext<{
  ready: boolean;
  shot: StoryShot | null;
  publish: (channel: Channel, shot: StoryShot | null) => void;
}>({ ready: false, shot: null, publish: () => {} });

export function StoryWorldProvider({ children }: { children: ReactNode }) {
  const [shots, setShots] = useState<Record<Channel, StoryShot | null>>({ opening: null, conversation: null });
  const [ready, setReady] = useState(false);
  const publish = useMemo(() => (channel: Channel, shot: StoryShot | null) => setShots(current => ({ ...current, [channel]: shot })), []);
  const value = useMemo(() => ({ ready, shot: shots.conversation ?? shots.opening, publish }), [ready, shots, publish]);
  return <Context.Provider value={value}><ReadyContext.Provider value={setReady}>{children}</ReadyContext.Provider></Context.Provider>;
}
const ReadyContext = createContext<(ready: boolean) => void>(() => {});
export const useStoryWorld = () => useContext(Context);

/** Declarative story cues; no navigation or progression decisions belong to the renderer. */
export function StoryDirector({ channel, shot }: { channel: Channel; shot: StoryShot | null }) {
  const { publish } = useStoryWorld();
  const serialized = JSON.stringify(shot);
  useEffect(() => {
    publish(channel, JSON.parse(serialized) as StoryShot | null);
  }, [channel, serialized, publish]);
  useEffect(() => () => publish(channel, null), [channel, publish]);
  return null;
}

export function StoryWorldViewport() {
  const canvas = useRef<HTMLDivElement>(null);
  const renderer = useRef<StoryRenderer | null>(null);
  const { shot } = useStoryWorld();
  const setReady = useContext(ReadyContext);
  const latest = useRef(shot);
  latest.current = shot;
  const enabled = import.meta.env.VITE_STORY_3D !== "false";
  useEffect(() => {
    if (!enabled || !canvas.current) return;
    const target = canvas.current;
    const abort = new AbortController();
    let disposed = false;
    let instance: StoryRenderer | undefined;
    void import("./renderer").then(async ({ createStoryRenderer }) => {
      if (disposed) return;
      instance = await createStoryRenderer(target, () => latest.current, abort.signal);
      if (disposed) { instance.dispose(); return; }
      renderer.current = instance;
      setReady(true);
      log("info", "world3d", `3D story ready (${instance.backend}; Havok WASM)`);
    }).catch(error => {
      if (!disposed) {
        setReady(false);
        log("warning", "world3d", "3D unavailable; using the illustrated story", describeError(error));
      }
    });
    return () => {
      disposed = true;
      abort.abort();
      setReady(false);
      renderer.current = null;
      instance?.dispose();
    };
  }, [enabled, setReady]);
  return enabled ? <div ref={canvas} className="story-world-canvas" hidden={!shot} aria-label="A 3D walk through Lyon with Sophie" role="img" /> : null;
}
