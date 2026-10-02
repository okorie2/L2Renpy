import { useEffect, useRef } from "react";
import { createGame } from "../../world/createGame";
import type { WorldSceneConfig } from "../../world/MainScene";

export function GameView({ world }: { world: WorldSceneConfig }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const game = createGame(host.current, world);
    return () => game.destroy(true);
  }, [world]);

  return <div ref={host} className="game-host" />;
}
