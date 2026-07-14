// Viewport slicing for the flood swipe-compare's high-zoom DETAIL.
//
// Measured bottleneck (2026-07): fetching a viewport crop from the /api/flood
// proxy re-paginates the Vallaris upstream at 100 features/page and took
// 15–22 s with 17–26 MB payloads PER SIDE — while the complete detail
// FeatureCollection was ALREADY in browser memory (getFloodAreas downloads it
// once per date at compare open, to measure the flooded area, and caches it).
//
// So instead of any network round-trip, we index the loaded features by their
// bounding box ONCE (O(total vertices), done in the compare-open flow), then
// slice the current viewport locally in ~a millisecond per move. Zooming in
// therefore shows real polygons as fast as MapLibre can tile them, and zooming
// out/in again is instant — no request, no re-parse, no duplicate work.
import type { FeatureCollection, Geometry, Position } from "@/types";

/** Feature cap per side — visual parity with the old /api/flood viewport cap. */
export const FLOOD_VIEWPORT_MAX_FEATURES = 6000;
/**
 * VERTEX budget per slice. Feature count alone is not a real bound — 6,000
 * dense MultiPolygons can be tens of MB and stall MapLibre's geojson worker
 * for 30 s+ (observed: the overlay map never reached "idle"). Positions are
 * counted while indexing, so a slice can enforce a hard geometry budget.
 */
export const FLOOD_VIEWPORT_MAX_VERTICES = 350_000;
/** Tighter budget for the PREFETCH band (nothing is visible there yet — the
 *  feed only warms the tile pipeline before the detail threshold). */
export const FLOOD_VIEWPORT_PREFETCH_MAX_VERTICES = 120_000;

type Feature = FeatureCollection<unknown>["features"][number];
export type BBoxTuple = [number, number, number, number]; // w, s, e, n

export interface FloodDetailIndex {
  /** Same feature objects as the source FC — never copied, only referenced. */
  features: Feature[];
  /** Flat per-feature bounds [w,s,e,n] × n — 32 bytes/feature. */
  boxes: Float64Array;
  /** Per-feature position count (for the slice's vertex budget). */
  vertexCounts: Uint32Array;
}

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

/** Build the per-feature bbox index — ONE pass over the geometry, run once per
 *  date when a compare session opens (never during map interaction). */
export function buildFloodDetailIndex(
  fc: FeatureCollection<unknown>,
): FloodDetailIndex {
  const features: Feature[] = [];
  const bounds: number[] = [];
  const counts: number[] = [];
  for (const f of fc.features) {
    if (!f.geometry) continue;
    let w = Infinity;
    let s = Infinity;
    let e = -Infinity;
    let n = -Infinity;
    let v = 0;
    eachPosition(f.geometry as Geometry, (p) => {
      v += 1;
      if (p[0] < w) w = p[0];
      if (p[0] > e) e = p[0];
      if (p[1] < s) s = p[1];
      if (p[1] > n) n = p[1];
    });
    if (!Number.isFinite(w)) continue;
    features.push(f);
    bounds.push(w, s, e, n);
    counts.push(v);
  }
  return {
    features,
    boxes: Float64Array.from(bounds),
    vertexCounts: Uint32Array.from(counts),
  };
}

export interface FloodViewportSlice {
  fc: FeatureCollection<unknown>;
  /** True when the cap dropped features — a pan then needs a re-slice. */
  truncated: boolean;
}

/** Collect the features whose bounds intersect `bbox` (typically the padded
 *  viewport). Pure arithmetic over the flat index — safe to run per moveend. */
export function sliceFloodDetail(
  index: FloodDetailIndex,
  bbox: BBoxTuple,
  maxVertices: number = FLOOD_VIEWPORT_MAX_VERTICES,
  maxFeatures: number = FLOOD_VIEWPORT_MAX_FEATURES,
): FloodViewportSlice {
  const [w, s, e, n] = bbox;
  const { features, boxes, vertexCounts } = index;
  const out: Feature[] = [];
  let vertices = 0;
  let truncated = false;
  for (let i = 0; i < features.length; i++) {
    const o = i * 4;
    if (boxes[o] > e || boxes[o + 2] < w || boxes[o + 1] > n || boxes[o + 3] < s)
      continue;
    if (out.length >= maxFeatures || vertices + vertexCounts[i] > maxVertices) {
      truncated = true;
      break;
    }
    out.push(features[i]);
    vertices += vertexCounts[i];
  }
  return { fc: { type: "FeatureCollection", features: out }, truncated };
}

/** Expand a viewport bbox by `pad` (fraction per side) so small pans stay
 *  inside the last slice and need no re-slice at all. */
export function padBBox(bbox: BBoxTuple, pad = 0.25): BBoxTuple {
  const dw = (bbox[2] - bbox[0]) * pad;
  const dh = (bbox[3] - bbox[1]) * pad;
  return [bbox[0] - dw, bbox[1] - dh, bbox[2] + dw, bbox[3] + dh];
}

/** True when `inner` is fully contained by `outer`. */
export function bboxContains(outer: BBoxTuple, inner: BBoxTuple): boolean {
  return (
    inner[0] >= outer[0] &&
    inner[1] >= outer[1] &&
    inner[2] <= outer[2] &&
    inner[3] <= outer[3]
  );
}
