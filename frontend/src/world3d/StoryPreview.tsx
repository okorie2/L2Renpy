import { useEffect, useRef, useState } from "react";
import { french } from "../languages/fr";
import { StoryDirector, StoryWorldViewport, useStoryWorld } from "./StoryWorld";
import type { StoryShot } from "./story";

// A separate preview exercises the actual authored walks without changing a learner's save.
const walks = Object.values(french.dialogues.walkToCafe.nodes).flatMap(node => node.interlude ? [node.interlude] : []);
const shots: Array<{ duration: number; shot: StoryShot }> = [
  { duration: 2700, shot: { key: "preview-arrival", scene: "park", mode: "arrival" } },
  { duration: 1800, shot: { key: "preview-hello", scene: "park", mode: "conversation", speakingId: "sophie" } },
  ...walks.flatMap((walk, index) => {
    const last = walk.segments.at(-1)!;
    return [
      { duration: walk.durationMs, shot: { key: `preview-walk-${index}`, scene: walk.segments[0].scene, mode: "walk" as const, walk } },
      { duration: 1600, shot: { key: `preview-stop-${index}`, scene: last.scene, zoom: last.zoom[1], mode: "conversation" as const, people: last.people?.map(person => ({ ...person, at: person.to ?? person.at, to: undefined })), speakingId: "sophie" } }
    ];
  })
];

export function StoryPreview() {
  const { ready } = useStoryWorld();
  const [step, setStep] = useState(-1);
  const [inspect, setInspect] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [paused, setPaused] = useState(false);
  const held = useRef(paused);
  held.current = paused;
  useEffect(() => {
    if (step < 0 || step >= shots.length || !ready) return;
    let total = 0, last = performance.now(), frame = 0;
    const tick = (now: number) => {
      if (!held.current && !document.hidden) total += Math.min(now - last, 100);
      last = now;
      if (total >= shots[step].duration) { setStep(current => current + 1); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step, ready]);
  const finished = step >= shots.length;
  const shot: StoryShot = inspect ? { key: portrait ? "preview-cafe-face" : "preview-cafe-detail", framing: portrait ? "portrait" : undefined, scene: "cafe-exterior", zoom: 1.1, mode: "conversation", speakingId: "sophie" } : step < 0 ? { key: "preview-title", scene: "park", mode: "title" as const } : shots[Math.min(step, shots.length - 1)].shot;
  return (
    <main className={`app${ready ? " has-3d-story" : ""}`}>
      <StoryWorldViewport />
      <StoryDirector channel="opening" shot={{ ...shot, paused }} />
      <div className="story-preview-card">
        <p className="eyebrow">MOVEMENT PREVIEW</p>
        <h1>{inspect ? "At Café Lumière" : finished ? "Welcome to the café" : shot.mode === "walk" ? "Walking with Sophie" : "A morning in Lyon"}</h1>
        <p>{inspect ? "Take a closer look at Sophie’s face, hair and outfit." : step < 0 ? "Meet Sophie, then follow her to the café. The story guides the movement." : "Watch Sophie walk and greet you. Your lesson progress is unchanged."}</p>
        <div className="button-row">
          {inspect ? <button className="primary-pill" onClick={() => setPaused(current => !current)}>{paused ? "Resume" : "Pause"}</button> : step < 0 || finished ? <button className="primary-pill" disabled={!ready} onClick={() => { setPaused(false); setStep(0); }}>{ready ? finished ? "Watch again" : "Start preview" : "Loading the street…"}</button>
            : <button className="primary-pill" onClick={() => setPaused(current => !current)}>{paused ? "Resume" : "Pause"}</button>}
          {(step < 0 || finished) && <button className="assist-chip" disabled={!ready} onClick={() => { setInspect(current => !current); setStep(-1); setPaused(false); }}>{inspect ? "Back to street" : "Inspect café"}</button>}
          {inspect && <button className="assist-chip" onClick={() => { setPortrait(current => !current); setPaused(false); }}>{portrait ? "Whole outfit" : "Inspect face"}</button>}
          <a className="assist-chip" href="/">Back to the app</a>
        </div>
      </div>
    </main>
  );
}
