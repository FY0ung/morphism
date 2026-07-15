// CIRCULAR 5 km flood analysis-radius model (feature/real-flood-hospital-buffer).
//
// Matches the reference visualization: nearby/connected flood polygons are
// grouped into CLUSTERS, one representative CENTER is computed per selected
// major cluster, a true geodesic CIRCLE of exactly `radiusKm` is generated
// around each center, and hospitals are filtered with the SAME geometry the
// map displays: haversine(center, hospital) ≤ radiusKm for ANY selected
// circle. One main circle is preferred; additional circles (max 3) appear
// only for clearly separated major clusters.
//
// Pure + dependency-free. Runs SERVER-SIDE (/api/flood-buffer) or during
// asset preprocessing (scripts) — never in React, never per map movement.
import type { FeatureCollection, Geometry, Position } from "@/types";
import type { HospitalFC } from "@/types";
import { distanceToFloodGeometryKm } from "@/lib/flood-proximity";

const EARTH_R_KM = 6371.0088;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

type BBoxT = [number, number, number, number];

/** Great-circle distance (km) — the ONE distance definition of this model. */
export function haversineKm(a: Position, b: Position): number {
  const dLat = (b[1] - a[1]) * D2R;
  const dLon = (b[0] - a[0]) * D2R;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * D2R) * Math.cos(b[1] * D2R) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.sqrt(s));
}

/** Spherical destination point: from `origin`, `bearingDeg`, `distKm`. */
function destination(origin: Position, bearingDeg: number, distKm: number): Position {
  const δ = distKm / EARTH_R_KM;
  const θ = bearingDeg * D2R;
  const φ1 = origin[1] * D2R;
  const λ1 = origin[0] * D2R;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return [λ2 * R2D, φ2 * R2D];
}

/** True geodesic circle polygon (`segments` points, closed ring, 5 dp). */
export function geodesicCircle(
  center: Position,
  radiusKm: number,
  segments = 96,
): Position[] {
  const ring: Position[] = [];
  for (let i = 0; i <= segments; i++) {
    const p = destination(center, (i / segments) * 360, radiusKm);
    ring.push([Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]);
  }
  return ring;
}

/* ── cluster detection (grid + union-find over feature centroids) ─────────── */

interface FeatureNode {
  index: number;
  center: Position; // bbox centre of the feature
  bbox: BBoxT; // feature bbox [w,s,e,n] (reused by the flood clip prefilter)
  weightKm2: number; // real flooded area (f_area/_area) in km²
  geometry: Geometry;
}

export interface FloodClusterInfo {
  id: number;
  center: [number, number];
  areaKm2: number;
  featureCount: number;
}

export interface FloodRadiusResult {
  clusters: FloodClusterInfo[];
  /** One geodesic circle Polygon per selected cluster ({ clusterId, radiusKm }). */
  circles: FeatureCollection;
  /** One Point per selected cluster ({ clusterId }) — the visible center. */
  centers: FeatureCollection;
  /** Hospitals inside the UNION of the circles (risk + distanceKm to the
   *  nearest selected center — the same geometry the map displays). */
  hospitals: HospitalFC;
  count: number;
  /** [w,s,e,n] over the circles (⊇ all matching hospitals). */
  bounds: BBoxT;
  /** ORIGINAL flood features that INTERSECT the displayed circle union — i.e.
   *  every polygon whose nearest point is ≤ radiusKm from a selected center.
   *  Polygons entirely outside the radius are dropped. Geometry is preserved
   *  as-is (never clipped to the circle edge or replaced with a mock). This is
   *  a small subset, so the browser renders it directly instead of the full
   *  flood snapshot. */
  floodClipped: FeatureCollection;
}

export interface FloodRadiusOptions {
  radiusKm?: number;
  /** Cluster grid cell (km): features whose cells touch (8-neighbour) join. */
  cellKm?: number;
  /** Max circles (1 preferred; 2–3 only for clearly separated majors). */
  maxCircles?: number;
  /** A secondary cluster qualifies only with ≥ this share of the top area. */
  minShareOfTop?: number;
  /** …and only when its center is ≥ this far from every selected center. */
  minSeparationKm?: number;
  segments?: number;
}

function geomBBox(geom: Geometry): BBoxT | null {
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
  return Number.isFinite(w) ? [w, s, e, n] : null;
}

/** Real flooded area of a feature in km² (upstream carries m²). */
function featureWeightKm2(props: unknown, bb: BBoxT): number {
  const p = props as { f_area?: unknown; _area?: unknown } | undefined;
  const m2 =
    typeof p?.f_area === "number"
      ? p.f_area
      : typeof p?._area === "number"
        ? p._area
        : null;
  if (m2 != null && m2 > 0) return m2 / 1e6;
  // Fallback: bbox area approximation (equirectangular).
  const kx = 111.32 * Math.cos((((bb[1] + bb[3]) / 2) * Math.PI) / 180);
  return Math.max(1e-6, (bb[2] - bb[0]) * kx * (bb[3] - bb[1]) * 110.574);
}

/**
 * Group nearby/connected flood features into clusters, select the major
 * cluster(s), compute a representative center each (area-weighted centroid,
 * snapped onto the cluster when it drifts off), and build the geodesic
 * circles + hospital selection from that SAME geometry.
 */
export function analyzeFloodRadius(
  flood: FeatureCollection<unknown>,
  hospitals: HospitalFC,
  opts: FloodRadiusOptions = {},
): FloodRadiusResult | null {
  const radiusKm = opts.radiusKm ?? 5;
  const cellKm = opts.cellKm ?? 2;
  const maxCircles = opts.maxCircles ?? 3;
  const minShareOfTop = opts.minShareOfTop ?? 0.35;
  const minSeparationKm = opts.minSeparationKm ?? 3 * radiusKm;
  const segments = opts.segments ?? 96;

  // ── nodes ──
  const nodes: FeatureNode[] = [];
  for (let i = 0; i < flood.features.length; i++) {
    const f = flood.features[i];
    const geom = f.geometry as Geometry;
    if (!geom) continue;
    const bb = geomBBox(geom);
    if (!bb) continue;
    nodes.push({
      index: i,
      center: [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2],
      bbox: bb,
      weightKm2: featureWeightKm2(f.properties, bb),
      geometry: geom,
    });
  }
  if (!nodes.length) return null;

  // ── grid union-find (8-neighbourhood at `cellKm`) ──
  const midLat =
    nodes.reduce((acc, nd) => acc + nd.center[1], 0) / nodes.length;
  const kx = 111.32 * Math.cos((midLat * Math.PI) / 180);
  const ky = 110.574;
  const cellOf = (p: Position): [number, number] => [
    Math.floor((p[0] * kx) / cellKm),
    Math.floor((p[1] * ky) / cellKm),
  ];
  const parent = new Int32Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) parent[i] = i;
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    while (parent[i] !== r) {
      const nx = parent[i];
      parent[i] = r;
      i = nx;
    }
    return r;
  };
  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const byCell = new Map<string, number>(); // cell → representative node
  for (let i = 0; i < nodes.length; i++) {
    const [cx, cy] = cellOf(nodes[i].center);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const k = `${cx + dx}:${cy + dy}`;
        const other = byCell.get(k);
        if (other !== undefined) unite(i, other);
      }
    }
    const self = `${cx}:${cy}`;
    if (!byCell.has(self)) byCell.set(self, i);
  }

  // ── clusters + weighted centers ──
  interface Cluster {
    members: FeatureNode[];
    areaKm2: number;
    center: Position;
  }
  const groups = new Map<number, FeatureNode[]>();
  for (let i = 0; i < nodes.length; i++) {
    const r = find(i);
    const list = groups.get(r);
    if (list) list.push(nodes[i]);
    else groups.set(r, [nodes[i]]);
  }
  const clusters: Cluster[] = [...groups.values()].map((members) => {
    let area = 0;
    let sx = 0;
    let sy = 0;
    for (const m of members) {
      area += m.weightKm2;
      sx += m.center[0] * m.weightKm2;
      sy += m.center[1] * m.weightKm2;
    }
    let center: Position = area > 0 ? [sx / area, sy / area] : members[0].center;
    // Point-on-surface guarantee: the center must fall inside or immediately
    // adjacent to the cluster. If the weighted centroid drifted away (e.g. a
    // crescent-shaped cluster), snap to the centroid of the LARGEST member.
    const near = members.some(
      (m) => distanceToFloodGeometryKm(center, m.geometry, 1.5) <= 1.5,
    );
    if (!near) {
      const largest = members.reduce((a, b) =>
        b.weightKm2 > a.weightKm2 ? b : a,
      );
      center = largest.center;
    }
    return { members, areaKm2: area, center };
  });
  clusters.sort((a, b) => b.areaKm2 - a.areaKm2);

  // ── selection: one main circle; extras only for separated majors ──
  const selected: Cluster[] = [clusters[0]];
  for (const c of clusters.slice(1)) {
    if (selected.length >= maxCircles) break;
    if (c.areaKm2 < clusters[0].areaKm2 * minShareOfTop) break; // sorted desc
    const separated = selected.every(
      (s) => haversineKm(s.center, c.center) >= minSeparationKm,
    );
    if (separated) selected.push(c);
  }

  // ── circles + centers + bounds ──
  const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
  let bw = Infinity,
    bs = Infinity,
    be = -Infinity,
    bn = -Infinity;
  const circleFeatures = selected.map((c, id) => {
    const ring = geodesicCircle(c.center, radiusKm, segments);
    for (const [x, y] of ring) {
      if (x < bw) bw = x;
      if (x > be) be = x;
      if (y < bs) bs = y;
      if (y > bn) bn = y;
    }
    return {
      type: "Feature" as const,
      geometry: { type: "Polygon" as const, coordinates: [ring] },
      properties: { clusterId: id, radiusKm },
    };
  });
  const centerFeatures = selected.map((c, id) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [r5(c.center[0]), r5(c.center[1])] as Position,
    },
    properties: { clusterId: id },
  }));

  // ── hospitals inside the union of the circles — SAME geometry definition ──
  const matched: HospitalFC["features"] = [];
  for (const h of hospitals.features) {
    if (h.geometry.type !== "Point") continue;
    const pt = h.geometry.coordinates as Position;
    let best = Infinity;
    for (const c of selected) {
      const d = haversineKm(c.center, pt);
      if (d < best) best = d;
    }
    if (best <= radiusKm) {
      matched.push({
        ...h,
        properties: {
          ...h.properties,
          risk: true,
          distanceKm: Math.round(best * 100) / 100,
        },
      });
    }
  }

  // ── flood clip: ORIGINAL features intersecting the circle union ──────────
  // A polygon intersects the disk of radius `radiusKm` around a center C iff
  // its minimum distance to C is ≤ radiusKm (0 when C is inside it). Same
  // distance definition as the hospital filter — one geometry model. A
  // radius-expanded bbox prefilter skips almost every polygon before the exact
  // edge math runs, so this stays cheap even on a national snapshot. Features
  // are emitted UNCHANGED (original geometry + properties), deduped across
  // circles, in their source order.
  const dLat = radiusKm / ky;
  const includedIdx = new Set<number>();
  for (const nd of nodes) {
    const midLat = (nd.bbox[1] + nd.bbox[3]) / 2;
    const dLon = radiusKm / Math.max(1e-6, 111.32 * Math.cos((midLat * Math.PI) / 180));
    const hit = selected.some((c) => {
      const cx = c.center[0];
      const cy = c.center[1];
      // Radius-expanded bbox reject before any exact distance work.
      if (
        cx < nd.bbox[0] - dLon ||
        cx > nd.bbox[2] + dLon ||
        cy < nd.bbox[1] - dLat ||
        cy > nd.bbox[3] + dLat
      )
        return false;
      return distanceToFloodGeometryKm(c.center, nd.geometry, radiusKm) <= radiusKm;
    });
    if (hit) includedIdx.add(nd.index);
  }
  const floodClippedFeatures = flood.features.filter((_, i) => includedIdx.has(i));

  return {
    clusters: selected.map((c, id) => ({
      id,
      center: [r5(c.center[0]), r5(c.center[1])],
      areaKm2: Math.round(c.areaKm2 * 100) / 100,
      featureCount: c.members.length,
    })),
    circles: { type: "FeatureCollection", features: circleFeatures },
    centers: { type: "FeatureCollection", features: centerFeatures },
    hospitals: { type: "FeatureCollection", features: matched },
    count: matched.length,
    bounds: [bw, bs, be, bn],
    // Source features are generically typed (Feature<unknown>); emit them
    // unchanged under the response's default-props FeatureCollection.
    floodClipped: {
      type: "FeatureCollection",
      features: floodClippedFeatures,
    } as unknown as FeatureCollection,
  };
}
