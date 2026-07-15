// REAL 5 km flood-proximity analysis (feature/real-flood-hospital-buffer).
//
// Pure geometry + dataset-resolution helpers shared by the server route
// (/api/flood-buffer) and the test suite. No React, no fetch — callers inject
// data. Distances use a local equirectangular approximation (error ≪ 1% at a
// 5 km scale), with a haversine-consistent km factor per degree.
//
// Definition implemented:  distance(hospital point, flood polygon) ≤ radiusKm
//   • point INSIDE a polygon (holes respected)  → distance 0
//   • otherwise: minimum distance to any polygon edge
// A per-feature bbox prefilter (expanded by the radius) skips almost every
// polygon before any exact math runs — no nationwide buffering/union anywhere.
import type { FeatureCollection, Geometry, Position } from "@/types";
import type { HospitalFC } from "@/types";

export const FLOOD_PROXIMITY_RADIUS_KM = 5;

const KM_PER_DEG_LAT = 110.574;
const kmPerDegLon = (latDeg: number) =>
  111.32 * Math.cos((latDeg * Math.PI) / 180);

type BBoxT = [number, number, number, number];

/* ── low-level geometry ───────────────────────────────────────────────────── */

/** Ray-casting point-in-ring (lon/lat). */
function pointInRing(pt: Position, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Point inside a Polygon's outer ring and outside every hole. */
function pointInPolygonRings(pt: Position, rings: Position[][]): boolean {
  if (!rings.length || !pointInRing(pt, rings[0])) return false;
  for (let h = 1; h < rings.length; h++) {
    if (pointInRing(pt, rings[h])) return false;
  }
  return true;
}

/** True when the point lies inside the (Multi)Polygon geometry. */
export function pointInFloodGeometry(pt: Position, geom: Geometry): boolean {
  if (geom.type === "Polygon") return pointInPolygonRings(pt, geom.coordinates);
  if (geom.type === "MultiPolygon")
    return geom.coordinates.some((rings) => pointInPolygonRings(pt, rings));
  return false;
}

/** Distance (km) from a point to one segment, equirectangular at the point. */
function segmentDistanceKm(pt: Position, a: Position, b: Position): number {
  const kx = kmPerDegLon(pt[1]);
  const px = 0;
  const py = 0;
  const ax = (a[0] - pt[0]) * kx;
  const ay = (a[1] - pt[1]) * KM_PER_DEG_LAT;
  const bx = (b[0] - pt[0]) * kx;
  const by = (b[1] - pt[1]) * KM_PER_DEG_LAT;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(cx, cy);
}

/**
 * Minimum distance (km) from a point to a (Multi)Polygon boundary — 0 when the
 * point is inside. `cutoffKm` allows early exit once any edge is close enough.
 */
export function distanceToFloodGeometryKm(
  pt: Position,
  geom: Geometry,
  cutoffKm = Infinity,
): number {
  if (pointInFloodGeometry(pt, geom)) return 0;
  const polys =
    geom.type === "Polygon"
      ? [geom.coordinates]
      : geom.type === "MultiPolygon"
        ? geom.coordinates
        : [];
  let best = Infinity;
  for (const rings of polys) {
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const d = segmentDistanceKm(pt, ring[j], ring[i]);
        if (d < best) {
          best = d;
          if (best <= cutoffKm) return best; // early exit — close enough
        }
      }
    }
  }
  return best;
}

/* ── bbox index + analysis ────────────────────────────────────────────────── */

function geomBBox(geom: Geometry): BBoxT {
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const p = c as number[];
      if (p[0] < w) w = p[0];
      if (p[0] > e) e = p[0];
      if (p[1] < s) s = p[1];
      if (p[1] > n) n = p[1];
      return;
    }
    if (Array.isArray(c)) for (const child of c) walk(child);
  };
  walk((geom as { coordinates?: unknown }).coordinates);
  return [w, s, e, n];
}

export interface FloodProximityResult {
  /** Matching hospitals, each with `distanceKm` (0 = inside a flood polygon)
   *  and `risk: true` so the existing point styling highlights them. */
  hospitals: HospitalFC;
  count: number;
  /** BBox [w,s,e,n] of the matching hospitals (null when none matched). */
  bounds: BBoxT | null;
}

/**
 * Hospitals within `radiusKm` of ANY flood polygon. O(hospitals × candidate
 * polygons) with a radius-expanded bbox prefilter per flood feature.
 */
export function hospitalsNearFlood(
  hospitals: HospitalFC,
  flood: FeatureCollection<unknown>,
  radiusKm = FLOOD_PROXIMITY_RADIUS_KM,
): FloodProximityResult {
  // Precompute radius-expanded flood bboxes once.
  const feats = flood.features.filter((f) => f.geometry);
  const boxes: BBoxT[] = feats.map((f) => {
    const [w, s, e, n] = geomBBox(f.geometry);
    const dLat = radiusKm / KM_PER_DEG_LAT;
    const midLat = (s + n) / 2;
    const dLon = radiusKm / Math.max(1e-6, kmPerDegLon(midLat));
    return [w - dLon, s - dLat, e + dLon, n + dLat];
  });

  const matched: HospitalFC["features"] = [];
  let bw = Infinity,
    bs = Infinity,
    be = -Infinity,
    bn = -Infinity;

  for (const h of hospitals.features) {
    if (h.geometry.type !== "Point") continue;
    const pt = h.geometry.coordinates as Position;
    let bestKm = Infinity;
    for (let i = 0; i < feats.length; i++) {
      const b = boxes[i];
      if (pt[0] < b[0] || pt[0] > b[2] || pt[1] < b[1] || pt[1] > b[3]) continue;
      const d = distanceToFloodGeometryKm(pt, feats[i].geometry, 0);
      if (d < bestKm) bestKm = d;
      if (bestKm === 0) break; // inside — cannot get closer
    }
    if (bestKm <= radiusKm) {
      matched.push({
        ...h,
        properties: {
          ...h.properties,
          risk: true,
          distanceKm: Math.round(bestKm * 100) / 100,
        },
      });
      if (pt[0] < bw) bw = pt[0];
      if (pt[0] > be) be = pt[0];
      if (pt[1] < bs) bs = pt[1];
      if (pt[1] > bn) bn = pt[1];
    }
  }

  return {
    hospitals: { type: "FeatureCollection", features: matched },
    count: matched.length,
    bounds: matched.length ? [bw, bs, be, bn] : null,
  };
}

/* ── latest-complete dataset resolution ───────────────────────────────────── */

export interface ResolvedFloodDataset {
  date: string;
  /** False when only incomplete datasets exist (caller must show a notice). */
  complete: boolean;
}

/**
 * Resolve the analysis dataset: the NEWEST registry date whose stats say
 * `complete: true`. If none is complete, fall back to the newest date with
 * stats at all — flagged `complete: false` (an explicit partial-data notice,
 * never a silent substitution). Returns null when no stats are reachable.
 * `getComplete` is injected (server fetch in prod, fixtures in tests).
 */
export async function resolveLatestCompleteFlood(
  datesNewestFirst: readonly string[],
  getComplete: (date: string) => Promise<boolean | null>,
): Promise<ResolvedFloodDataset | null> {
  let newestWithStats: string | null = null;
  for (const date of datesNewestFirst) {
    const complete = await getComplete(date);
    if (complete === null) continue; // stats missing/unreachable for this date
    if (newestWithStats === null) newestWithStats = date;
    if (complete === true) return { date, complete: true };
  }
  return newestWithStats ? { date: newestWithStats, complete: false } : null;
}
