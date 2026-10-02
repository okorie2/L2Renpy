import { chapterOneLocations, chapterOneNpcs } from "../src/content/chapter1";
import { french } from "../src/languages/fr";
import { SIGN_OFFSET_Y } from "../src/world/renderLocation";

/** Everything a painter needs to know about where things are, straight from the game's own data. */
export const layouts = chapterOneLocations.map((location) => ({
  id: location.id,
  name: location.name,
  kind: location.kind,
  size: location.size,
  signOffsetY: SIGN_OFFSET_Y,
  figureScale: location.figureScale ?? 1,
  buildings: location.buildings.map((building) => ({ ...building, label: french.placeLabels[building.labelKey] ?? building.labelKey })),
  obstacles: location.obstacles,
  portals: location.portals.map((portal) => ({ position: portal.position, label: portal.label })),
  npcs: chapterOneNpcs.filter((npc) => npc.locationId === location.id).map((npc) => ({ name: npc.name, position: npc.position })),
  spawnPoints: Object.values(location.spawnPoints)
}));
