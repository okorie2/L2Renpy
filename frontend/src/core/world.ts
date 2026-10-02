import type { GameSave, Location, Quest, WorldPosition } from "./models";
import { applyGameEvent } from "./quests";

/** Update only authoritative player location/position; Phaser owns the moving visual. */
export function updatePlayerPosition(save: GameSave, position: WorldPosition): GameSave {
  return {
    ...save,
    player: { ...save.player, position }
  };
}

/**
 * Move the player through a portal. When quests are supplied, arriving raises
 * `LOCATION_ENTERED`, so travel and its quest consequences are one transition.
 */
export function travelThroughPortal(save: GameSave, locations: Location[], portalId: string, quests?: Quest[]): GameSave {
  const current = locations.find((location) => location.id === save.player.locationId);
  const portal = current?.portals.find((item) => item.id === portalId);
  if (!portal) return save;

  const destination = locations.find((location) => location.id === portal.destination.locationId);
  const spawn = destination?.spawnPoints[portal.destination.spawnId];
  if (!destination || !spawn) return save;

  const moved: GameSave = {
    ...save,
    visitedLocationIds: save.visitedLocationIds.includes(destination.id) ? save.visitedLocationIds : [...save.visitedLocationIds, destination.id],
    player: {
      ...save.player,
      locationId: destination.id,
      position: { ...spawn }
    }
  };
  return quests ? applyGameEvent(moved, quests, { type: "LOCATION_ENTERED", locationId: destination.id }) : moved;
}
