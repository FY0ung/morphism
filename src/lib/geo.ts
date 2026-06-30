// Pure geospatial helpers — no DOM, no map runtime. Safe to import anywhere.
import type { BBox, Feature, FeatureCollection, Position } from "@/types";

const R_EARTH_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Haversine distance between two [lng,lat] points, in kilometres. */
export function distanceKm(a: Position, b: Position): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Approximate circle polygon (ring of `steps` points) around a centre, radius in km. */
export function circlePolygon(
  center: Position,
  radiusKm: number,
  steps = 64,
): Position[] {
  const [lng, lat] = center;
  const latR = radiusKm / 110.574; // km per degree latitude
  const lngR = radiusKm / (111.32 * Math.cos(toRad(lat))); // km per degree longitude
  const ring: Position[] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    ring.push([lng + lngR * Math.cos(theta), lat + latR * Math.sin(theta)]);
  }
  return ring;
}

/** Ray-casting point-in-polygon for a single ring of [lng,lat] points. */
export function pointInRing(point: Position, ring: Position[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Bounding box of every coordinate in a FeatureCollection. */
export function bboxOf(fc: FeatureCollection<unknown>): BBox | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const visit = (pos: Position) => {
    west = Math.min(west, pos[0]);
    south = Math.min(south, pos[1]);
    east = Math.max(east, pos[0]);
    north = Math.max(north, pos[1]);
  };

  const walk = (coords: unknown): void => {
    if (
      Array.isArray(coords) &&
      typeof coords[0] === "number" &&
      typeof coords[1] === "number"
    ) {
      visit(coords as Position);
      return;
    }
    if (Array.isArray(coords)) coords.forEach(walk);
  };

  fc.features.forEach((f: Feature<unknown>) => walk(f.geometry.coordinates));
  if (!Number.isFinite(west)) return null;
  return [west, south, east, north];
}
