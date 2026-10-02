import type { Location } from "../core/models";
import { isWalkable, type CircleBlocker, type Point } from "./geometry";

const CELL = 24;
const STEPS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
] as const;

function lineIsClear(location: Location, from: Point, to: Point, radius: number, blockers: CircleBlocker[]): boolean {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  // Fine sampling: a coarse check can step over the corner of an obstacle.
  const samples = Math.max(1, Math.ceil(distance / 2));
  for (let i = 1; i <= samples; i++) {
    const point = { x: from.x + (to.x - from.x) * i / samples, y: from.y + (to.y - from.y) * i / samples };
    if (!isWalkable(location, point, radius, blockers)) return false;
  }
  return true;
}

export interface PathOptions {
  /** Skip waypoint smoothing and follow grid cells. Slower to walk, but hugs nothing. */
  smooth?: boolean;
}

/**
 * A small grid route around authored obstacles, then visible-waypoint smoothing.
 * A request for somewhere unreachable (behind a counter, inside a wall) leads to
 * the closest place the player can actually get to.
 */
export function findPath(
  location: Location,
  from: Point,
  requested: Point,
  radius: number,
  blockers: CircleBlocker[] = [],
  options: PathOptions = {}
): Point[] {
  if (Math.hypot(requested.x - from.x, requested.y - from.y) < 8) return [];

  const cols = Math.ceil(location.size.width / CELL);
  const rows = Math.ceil(location.size.height / CELL);
  const count = cols * rows;
  const cellPoint = (id: number): Point => ({
    x: (id % cols + 0.5) * CELL,
    y: (Math.floor(id / cols) + 0.5) * CELL
  });
  const cellId = (point: Point) => {
    const col = Math.max(0, Math.min(cols - 1, Math.floor(point.x / CELL)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor(point.y / CELL)));
    return row * cols + col;
  };
  const walkable = Array.from({ length: count }, (_, id) => isWalkable(location, cellPoint(id), radius, blockers));
  const nearestOpen = (origin: Point): number | undefined => {
    let best: number | undefined;
    let bestDistance = Infinity;
    for (let id = 0; id < count; id++) {
      if (!walkable[id]) continue;
      const point = cellPoint(id);
      const distance = (point.x - origin.x) ** 2 + (point.y - origin.y) ** 2;
      if (distance < bestDistance) { best = id; bestDistance = distance; }
    }
    return best;
  };

  const start = nearestOpen(from);
  let goal = nearestOpen(requested);
  if (start === undefined || goal === undefined) return [];

  const costs = Array<number>(count).fill(Infinity);
  const previous = Array<number>(count).fill(-1);
  const closed = new Uint8Array(count);
  const open = [start];
  costs[start] = 0;
  let goalPoint = cellPoint(goal);

  while (open.length) {
    let bestIndex = 0;
    let bestScore = Infinity;
    for (let i = 0; i < open.length; i++) {
      const id = open[i];
      const point = cellPoint(id);
      const score = costs[id] + Math.hypot(goalPoint.x - point.x, goalPoint.y - point.y);
      if (score < bestScore) { bestIndex = i; bestScore = score; }
    }
    const current = open.splice(bestIndex, 1)[0];
    if (current === goal) break;
    closed[current] = 1;
    const col = current % cols;
    const row = Math.floor(current / cols);

    for (const [dx, dy] of STEPS) {
      const nextCol = col + dx;
      const nextRow = row + dy;
      if (nextCol < 0 || nextCol >= cols || nextRow < 0 || nextRow >= rows) continue;
      const next = nextRow * cols + nextCol;
      if (!walkable[next] || closed[next]) continue;
      // Do not cut diagonally through the corner of a solid object.
      if (dx && dy && (!walkable[row * cols + nextCol] || !walkable[nextRow * cols + col])) continue;
      const cost = costs[current] + (dx && dy ? Math.SQRT2 : 1) * CELL;
      if (cost >= costs[next]) continue;
      costs[next] = cost;
      previous[next] = current;
      if (!open.includes(next)) open.push(next);
    }
  }

  if (start !== goal && previous[goal] === -1) {
    // The search has now visited everywhere the player can go; settle for the nearest of those.
    let bestDistance = Infinity;
    for (let id = 0; id < count; id++) {
      if (id !== start && previous[id] === -1) continue;
      const point = cellPoint(id);
      const distance = (point.x - requested.x) ** 2 + (point.y - requested.y) ** 2;
      if (distance < bestDistance) { goal = id; bestDistance = distance; }
    }
    goalPoint = cellPoint(goal);
  }

  const raw: Point[] = [];
  for (let id = goal; id !== start; id = previous[id]) raw.unshift(cellPoint(id));
  const exact = previous[cellId(requested)] !== -1 || cellId(requested) === start;
  const target = exact && isWalkable(location, requested, radius, blockers) ? requested : goalPoint;
  if (raw.length === 0 && Math.hypot(target.x - from.x, target.y - from.y) < 8) return [];
  raw.push(target);
  // Start from the cell centre when the first leg would otherwise cut a corner.
  if (!lineIsClear(location, from, raw[0], radius, blockers)) raw.unshift(cellPoint(start));
  if (options.smooth === false) return raw;

  const path: Point[] = [];
  let anchor = from;
  for (let i = 0; i < raw.length;) {
    let furthest = i;
    while (furthest + 1 < raw.length && lineIsClear(location, anchor, raw[furthest + 1], radius, blockers)) furthest++;
    path.push(raw[furthest]);
    anchor = raw[furthest];
    i = furthest + 1;
  }
  return path;
}
