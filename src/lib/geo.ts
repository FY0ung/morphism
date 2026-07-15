// Pure geospatial helpers — no DOM, no map runtime. Safe to import anywhere.
import type {
  AdmFC,
  AdmProps,
  BBox,
  Feature,
  FeatureCollection,
  Geometry,
  Position,
} from "@/types";

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

/** Ray-cast point-in-polygon for a Polygon/MultiPolygon geometry, hole-aware. */
export function polyContains(geom: Geometry, x: number, y: number): boolean {
  const polys: Position[][][] =
    geom.type === "Polygon"
      ? [geom.coordinates]
      : geom.type === "MultiPolygon"
        ? geom.coordinates
        : [];
  for (const poly of polys) {
    if (!poly.length || !pointInRing([x, y], poly[0])) continue;
    let inHole = false;
    for (let k = 1; k < poly.length; k++) {
      if (pointInRing([x, y], poly[k])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

/** Bounding box of a single geometry (Polygon/MultiPolygon), as [w,s,e,n]. */
function geomBBox(geom: Geometry): BBox {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  const polys: Position[][][] =
    geom.type === "Polygon"
      ? [geom.coordinates]
      : geom.type === "MultiPolygon"
        ? geom.coordinates
        : [];
  polys.forEach((p) =>
    p[0]?.forEach(([x, y]) => {
      if (x < w) w = x;
      if (y < s) s = y;
      if (x > e) e = x;
      if (y > n) n = y;
    }),
  );
  return [w, s, e, n];
}

// Per-feature bbox cache — keyed by the feature object (WeakMap → auto-GC).
const bboxCache = new WeakMap<Feature<AdmProps>, BBox>();

/** bbox prefilter → ray-cast (fast for many features / many points). */
export function fastContains(f: Feature<AdmProps>, x: number, y: number): boolean {
  let bb = bboxCache.get(f);
  if (!bb) {
    bb = geomBBox(f.geometry);
    bboxCache.set(f, bb);
  }
  if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) return false;
  return polyContains(f.geometry, x, y);
}

/**
 * For each admin unit, count how many of `points` fall inside it, and return
 * ONLY the units with count > 0 (count written to properties.count). Mirrors the
 * HTML `unitsWithData()` — the driver of context-aware boundary aggregation.
 */
export function unitsWithData(
  units: Feature<AdmProps>[],
  points: Position[],
): AdmFC {
  const features: Feature<AdmProps>[] = [];
  if (!units.length || !points.length) {
    return { type: "FeatureCollection", features };
  }
  for (const u of units) {
    let count = 0;
    for (const c of points) if (fastContains(u, c[0], c[1])) count++;
    if (count > 0) {
      features.push({
        ...u,
        properties: { ...u.properties, count },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

/**
 * Canonical Thai province name for reliable comparison. Strips the "จังหวัด"
 * prefix, whitespace and a trailing "ฯ", and folds every Bangkok alias
 * (กรุงเทพ / กรุงเทพฯ / Bangkok / BKK) to "กรุงเทพมหานคร". Empty/blank → "".
 * NEVER use loose substring matching for provinces — `"x".includes("")` is
 * always true, which leaks blank-province rows into every query.
 */
export function normalizeProvinceName(raw: string | undefined | null): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  // Strip both province prefixes ("จังหวัด" and the abbreviation "จ.") so
  // records like "จ.กรุงเทพมหานคร" join the same canonical bucket.
  s = s.replace(/^(?:จ\.|จังหวัด)\s*/, "").replace(/\s+/g, "");
  const low = s.toLowerCase();
  if (low === "bangkok" || low === "bkk" || s.startsWith("กรุงเทพ")) {
    return "กรุงเทพมหานคร";
  }
  return s.replace(/ฯ$/, "");
}

/** Rough centroid of a Polygon/MultiPolygon (mean of the outer ring vertices). */
export function polygonCentroid(geom: Geometry): [number, number] {
  const ring: Position[] =
    geom.type === "Polygon"
      ? geom.coordinates[0]
      : geom.type === "MultiPolygon"
        ? // largest outer ring wins
          geom.coordinates
            .map((p) => p[0])
            .sort((a, b) => b.length - a.length)[0] ?? []
        : [];
  if (!ring.length) return [0, 0];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
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

const R_EARTH_M = 6378137; // WGS84 equatorial radius (m) — matches turf.area.

/** Spherical area of a single linear ring, in m² (signed magnitude taken later). */
function ringAreaM2(ring: Position[]): number {
  const n = ring.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const lowerX = toRad(ring[i][0]);
    const midY = toRad(ring[(i + 1) % n][1]);
    const upperX = toRad(ring[(i + 2) % n][0]);
    total += (upperX - lowerX) * Math.sin(midY);
  }
  return (total * R_EARTH_M * R_EARTH_M) / 2;
}

/** Area of one polygon (outer ring minus holes), in m². */
function polygonAreaM2(rings: Position[][]): number {
  if (!rings.length) return 0;
  let area = Math.abs(ringAreaM2(rings[0]));
  for (let i = 1; i < rings.length; i++) area -= Math.abs(ringAreaM2(rings[i]));
  return Math.max(0, area);
}

/**
 * Geodesic area of every Polygon / MultiPolygon in a FeatureCollection, in
 * square kilometres (turf.area algorithm — spherical excess on WGS84). Used for
 * REAL flooded-area stats from the live Vallaris extents (Polygon + MultiPolygon).
 */
export function areaKm2(fc: FeatureCollection<unknown>): number {
  let m2 = 0;
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") {
      m2 += polygonAreaM2(g.coordinates as Position[][]);
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates as Position[][][]) {
        m2 += polygonAreaM2(poly);
      }
    }
  }
  return m2 / 1_000_000;
}
