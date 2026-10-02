import type { Location, WorldPosition, WorldRect } from "../core/models";

export interface Point { x: number; y: number }
export interface Rect extends Point { width: number; height: number }
export interface CircleBlocker extends Point { radius: number }

export function toWorldPoint(location: Location, position: WorldPosition): Point {
  return { x: position.x * location.size.width, y: position.y * location.size.height };
}

export function toWorldRect(location: Location, rect: WorldRect): Rect {
  return {
    x: rect.x * location.size.width,
    y: rect.y * location.size.height,
    width: rect.width * location.size.width,
    height: rect.height * location.size.height
  };
}

export function toNormalizedPoint(location: Location, point: Point): WorldPosition {
  return { x: point.x / location.size.width, y: point.y / location.size.height };
}

export function isWalkable(location: Location, point: Point, radius: number, blockers: CircleBlocker[] = []): boolean {
  if (point.x < radius || point.y < radius || point.x > location.size.width - radius || point.y > location.size.height - radius) {
    return false;
  }
  if (blockers.some((blocker) => Math.hypot(point.x - blocker.x, point.y - blocker.y) < radius + blocker.radius)) {
    return false;
  }
  return !location.obstacles.some((obstacle) => {
    const rect = toWorldRect(location, obstacle);
    const closestX = Math.max(rect.x, Math.min(point.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(point.y, rect.y + rect.height));
    return (point.x - closestX) ** 2 + (point.y - closestY) ** 2 < radius ** 2;
  });
}

/** Axis-wise resolution lets the player slide along walls instead of clipping through them. */
export function moveWithCollision(location: Location, from: Point, delta: Point, radius: number, blockers: CircleBlocker[] = []): Point {
  const nextX = { x: from.x + delta.x, y: from.y };
  const afterX = isWalkable(location, nextX, radius, blockers) ? nextX : from;
  const nextY = { x: afterX.x, y: afterX.y + delta.y };
  return isWalkable(location, nextY, radius, blockers) ? nextY : afterX;
}

// Tried in order when the straight step is blocked: small turns first, then wider ones.
const STEER_ANGLES = [20, -20, 40, -40, 60, -60, 75, -75].map((degrees) => degrees * Math.PI / 180);
const MIN_PROGRESS = 0.05;

/**
 * Take one step toward a waypoint. A step that would clip a corner is steered around
 * it instead of stopping, as long as it still gets closer. Returns undefined only when
 * no direction makes progress, which means the route itself needs replanning.
 */
export function advanceToward(
  location: Location,
  from: Point,
  target: Point,
  stepLength: number,
  radius: number,
  blockers: CircleBlocker[] = []
): Point | undefined {
  const distance = Math.hypot(target.x - from.x, target.y - from.y);
  if (distance === 0) return from;
  const step = Math.min(stepLength, distance);
  const dx = (target.x - from.x) / distance * step;
  const dy = (target.y - from.y) / distance * step;

  const direct = { x: from.x + dx, y: from.y + dy };
  if (isWalkable(location, direct, radius, blockers)) return direct;
  // Already inside something solid (bad content, or an obstacle added later): always allow walking out.
  if (!isWalkable(location, from, radius, blockers)) return direct;

  const closer = (point: Point) => Math.hypot(target.x - point.x, target.y - point.y) < distance - MIN_PROGRESS;
  for (const angle of STEER_ANGLES) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const turned = { x: from.x + dx * cos - dy * sin, y: from.y + dx * sin + dy * cos };
    if (isWalkable(location, turned, radius, blockers) && closer(turned)) return turned;
  }

  const slid = moveWithCollision(location, from, { x: dx, y: dy }, radius, blockers);
  return closer(slid) ? slid : undefined;
}
