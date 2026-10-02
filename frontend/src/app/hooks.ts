import { useEffect, useState } from "react";

/** Height of the on-screen keyboard where the browser overlays it instead of resizing the layout. */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

const FLAP_INTERVAL_MS = 170;

/**
 * A silent stand-in for speech: a steady mouth flap for roughly the time the line
 * takes to say. Used only when no voice is playing (voices off, or the backend
 * away); with audio the mouth follows the clip's own timeline instead.
 */
export function useSpeakingPulse(lineKey: string, text: string, enabled: boolean): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!enabled || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const duration = Math.min(3200, Math.max(900, text.length * 55));
    const startedAt = performance.now();
    setOpen(true);
    const timer = window.setInterval(() => {
      if (performance.now() - startedAt >= duration) {
        window.clearInterval(timer);
        setOpen(false);
      } else {
        setOpen((current) => !current);
      }
    }, FLAP_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      setOpen(false);
    };
  }, [lineKey, text, enabled]);
  return open;
}
