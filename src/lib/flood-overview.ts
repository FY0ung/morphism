// Low-zoom flood representation. The raw flood dataset is thousands of tiny,
// fragmented MultiPolygons that become sub-pixel (and are dropped by geojson-vt
// simplification) below ~zoom 7. To keep flooding legible when zoomed out, we
// derive HEXAGONAL overviews from the SAME active flood FeatureCollection, at
// THREE geographic resolutions that swap by zoom band (bigger hexes the further
// you zoom out), so the distribution stays readable at country scale instead of
// collapsing into a dense dot cluster.
//
// No new dependency: a flood "spatial index" (sampled outline points per
// feature, built ONCE) is binned arithmetically into each resolution's hex grid
// — O(points) — so we never run booleanIntersects against every polygon, and
// never recompute during zoom.
//
// This is the single source of truth for the flood zoom thresholds + cell sizes
// — never scatter these numbers across components.
import type { FeatureCollection, Geometry, Position } from "@/types";

/** Detail (original) polygons render at/above this zoom (hex fine ends here). */
export const FLOOD_DETAIL_MIN_ZOOM = 6.8;

/**
 * Hex resolution bands. `[minZoom, maxZoom)` are used directly as the MapLibre
 * layer zoom ranges (maxZoom exclusive) so exactly ONE resolution is visible at
 * any zoom — no gaps, no overlap, no doubled fills.
 */
export const FLOOD_HEX_LEVELS = [
  {
    key: "coarse",
    cellSideKm: 45,
    minZoom: 0,
    maxZoom: 5,
    fillOpacity: 0.58,
    lineWidth: 1,
  },
  {
    key: "medium",
    cellSideKm: 24,
    minZoom: 5,
    maxZoom: 6,
    fillOpacity: 0.48,
    lineWidth: 0.8,
  },
  {
    key: "fine",
    cellSideKm: 12,
    minZoom: 6,
    maxZoom: FLOOD_DETAIL_MIN_ZOOM,
    fillOpacity: 0.38,
    lineWidth: 0.6,
  },
] as const;

export type FloodHexKey = (typeof FLOOD_HEX_LEVELS)[number]["key"];
/** The three precomputed hex FeatureCollections for one observation date. */
export type FloodHexOverview = Record<FloodHexKey, FeatureCollection>;

const KM_PER_DEG_LAT = 110.574;
const SQRT3 = Math.sqrt(3);

/** Which representation a zoom level should show. */
export function getFloodDisplayMode(zoom: number): "detail" | "overview" {
  return zoom >= FLOOD_DETAIL_MIN_ZOOM ? "detail" : "overview";
}

/** Visit every coordinate position in a geometry. */
function eachPosition(geom: Geometry, cb: (p: Position) => void): void {
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      cb(c as Position);
      return;
    }
    if (Array.isArray(c)) c.forEach(walk);
  };
  walk((geom as { coordinates?: unknown }).coordinates);
}

// ── Flood spatial index (built once, reused for all resolutions) ─────────────
// Sampling each feature's OUTLINE points (not just the centroid) preserves thin
// flood corridors: a feature marks every hex any of its vertices fall into.
interface FloodSampleIndex {
  cosLat0: number;
  /** One entry per flood feature: its sampled outline positions. */
  features: Position[][];
}

export function buildFloodSampleIndex(
  fc: FeatureCollection<unknown>,
): FloodSampleIndex {
  const features: Position[][] = [];
  let latSum = 0;
  let latN = 0;
  for (const f of fc.features) {
    const pts: Position[] = [];
    eachPosition(f.geometry, (p) => {
      pts.push(p);
      latSum += p[1];
      latN += 1;
    });
    if (pts.length) features.push(pts);
  }
  const lat0 = latN ? latSum / latN : 15;
  const cosLat0 = Math.max(0.01, Math.cos((lat0 * Math.PI) / 180));
  return { cosLat0, features };
}

// ── Pointy-top hex axial math (redblobgames) in an isotropic corrected plane ──
function cubeRound(qf: number, rf: number): [number, number] {
  const x = qf;
  const z = rf;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return [rx, rz];
}

/**
 * Build ONE hex resolution from the shared index. Each feature contributes to
 * every hex its outline touches (thin corridors kept); `floodCount` = number of
 * distinct flood features intersecting the hex.
 */
export function createFloodHexOverview(
  index: FloodSampleIndex,
  cellSideKm: number,
  resolution: FloodHexKey,
): FeatureCollection {
  const R = cellSideKm / KM_PER_DEG_LAT; // hex radius in latitude-degrees
  const cosLat0 = index.cosLat0;
  const counts = new Map<string, number>();

  for (const pts of index.features) {
    const touched = new Set<string>();
    for (const [lng, lat] of pts) {
      const x = lng * cosLat0;
      const y = lat;
      const qf = ((SQRT3 / 3) * x - (1 / 3) * y) / R;
      const rf = ((2 / 3) * y) / R;
      const [q, r] = cubeRound(qf, rf);
      touched.add(`${q}:${r}`);
    }
    for (const key of touched) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const features = [...counts.entries()].map(([key, floodCount]) => {
    const [q, r] = key.split(":").map(Number);
    const cx = R * SQRT3 * (q + r / 2);
    const cy = R * (3 / 2) * r;
    const ring: Position[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 180) * (60 * i - 30);
      ring.push([(cx + R * Math.cos(ang)) / cosLat0, cy + R * Math.sin(ang)]);
    }
    ring.push(ring[0]);
    return {
      type: "Feature" as const,
      properties: { floodCount, resolution },
      geometry: { type: "Polygon" as const, coordinates: [ring] },
    };
  });

  return { type: "FeatureCollection", features };
}

/** Build all three hex resolutions from a shared spatial index (built once,
 *  reused per level — never recomputed three times). */
function hexLevelsFromIndex(index: FloodSampleIndex): FloodHexOverview {
  return {
    coarse: createFloodHexOverview(index, 45, "coarse"),
    medium: createFloodHexOverview(index, 24, "medium"),
    fine: createFloodHexOverview(index, 12, "fine"),
  };
}

/**
 * Hex overview from the ACTUAL loaded geometry — the single source of truth. It
 * always works from whatever the flood layer renders (no dependency on optional
 * lat/long properties), so the overview can never be empty while the detail
 * layer has features.
 */
export function buildFloodHexLevels(
  fc: FeatureCollection<unknown>,
): FloodHexOverview {
  return hexLevelsFromIndex(buildFloodSampleIndex(fc));
}
