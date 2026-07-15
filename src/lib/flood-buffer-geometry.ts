// REAL 5 km buffer GEOMETRY around flood polygons (feature/real-flood-hospital-buffer).
//
// Pure, dependency-free pipeline shared by the build script and the tests:
//
//   flood FeatureCollection
//     → rasterize to a km-square grid (edge sampling + interior fill)
//     → exact euclidean distance transform (Felzenszwalb, O(cells))
//     → binary mask: distance ≤ radius (+ a conservative grid margin)
//     → boundary edge-walk → dissolved rings (outers CCW, holes CW)
//     → collinear collapse + Douglas-Peucker simplification
//     → ONE MultiPolygon in lon/lat
//
// The SAME distance definition as the hospital spatial query
// (lib/flood-proximity): distance(point, flood polygon), inside = 0. The mask
// threshold adds `marginKm` (≈ one cell diagonal) so the drawn buffer NEVER
// cuts inside the true 5 km zone — every point truly within the radius is
// contained; the outline may extend outward by at most margin + simplify
// tolerance (a few hundred metres at the default 0.2 km cell).
//
// This runs OFFLINE (scripts/build-flood-buffer.ts) — never in the browser and
// never inside React. The browser downloads only the small dissolved result.
import type { FeatureCollection, Geometry, Position } from "@/types";
import { pointInFloodGeometry } from "@/lib/flood-proximity";

const KM_PER_DEG_LAT = 110.574;
const kmPerDegLon = (latDeg: number) =>
  111.32 * Math.cos((latDeg * Math.PI) / 180);

type BBoxT = [number, number, number, number];

export interface BufferGeometryOptions {
  radiusKm: number;
  /** Grid cell size (km). Smaller = smoother + slower. Default 0.2. */
  cellKm?: number;
  /** Extra OUTWARD threshold (km) guaranteeing containment of every point
   *  within the radius despite grid discretisation. Default: cell diagonal. */
  marginKm?: number;
  /** Douglas-Peucker tolerance (km). Default: 0.6 × cell (< margin, so the
   *  simplification can never cut back inside the true radius). */
  simplifyKm?: number;
}

export interface BufferGeometryResult {
  /** Dissolved buffer as ONE MultiPolygon (lon/lat, 5-decimal precision). */
  geometry: Extract<Geometry, { type: "MultiPolygon" }>;
  /** [w,s,e,n] of the buffer geometry. */
  bbox: BBoxT;
  ringCount: number;
  vertexCount: number;
  cellKm: number;
  marginKm: number;
  grid: { width: number; height: number };
}

/* ── geometry helpers ─────────────────────────────────────────────────────── */

function floodBBox(flood: FeatureCollection<unknown>): BBoxT | null {
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
  for (const f of flood.features)
    walk((f.geometry as { coordinates?: unknown })?.coordinates);
  return Number.isFinite(w) ? [w, s, e, n] : null;
}

function polygonsOf(geom: Geometry): Position[][][] {
  if (geom.type === "Polygon") return [geom.coordinates];
  if (geom.type === "MultiPolygon") return geom.coordinates;
  return [];
}

/** Exact 1D squared distance transform (Felzenszwalb & Huttenlocher). */
function edt1d(f: Float64Array, n: number, out: Float64Array): void {
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    out[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** 2D squared EDT (cells): seeds have 0, everything else squared cell dist. */
function edt2d(seed: Uint8Array, width: number, height: number): Float64Array {
  const INF = 1e12;
  const d = new Float64Array(width * height);
  for (let i = 0; i < d.length; i++) d[i] = seed[i] ? 0 : INF;
  const f = new Float64Array(Math.max(width, height));
  const out = new Float64Array(Math.max(width, height));
  // columns
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = d[y * width + x];
    edt1d(f, height, out);
    for (let y = 0; y < height; y++) d[y * width + x] = out[y];
  }
  // rows
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) f[x] = d[y * width + x];
    edt1d(f, width, out);
    for (let x = 0; x < width; x++) d[y * width + x] = out[x];
  }
  return d;
}

/* ── boundary extraction (edge-walking, inside kept on the LEFT) ──────────── */

/**
 * Walk the boundary lattice edges of a binary mask into closed rings. The
 * inside-on-the-left convention makes OUTER rings CCW and HOLES CW, so ring
 * role falls out of the signed area — no heuristics. At corner-touching
 * saddles the sharpest left turn is taken, which keeps loops separated.
 */
function traceRings(
  mask: Uint8Array,
  width: number,
  height: number,
): Position[][] {
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
  // Directed edges keyed by their start vertex (vertex grid is (w+1)×(h+1)).
  const W1 = width + 1;
  const startKey = (x: number, y: number) => y * W1 + x;
  const edges = new Map<number, [number, number][]>(); // start → list of ends
  const addEdge = (x0: number, y0: number, x1: number, y1: number) => {
    const k = startKey(x0, y0);
    const list = edges.get(k);
    if (list) list.push([x1, y1]);
    else edges.set(k, [[x1, y1]]);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) addEdge(x, y, x + 1, y); // bottom, +x
      if (!inside(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1); // top, -x
      if (!inside(x - 1, y)) addEdge(x, y + 1, x, y); // left, -y
      if (!inside(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1); // right, +y
    }
  }

  const rings: Position[][] = [];
  for (const [k0] of edges) {
    let list = edges.get(k0);
    if (!list || list.length === 0) continue;
    // Start a ring from this vertex.
    let cx = k0 % W1;
    let cy = (k0 - cx) / W1;
    const ring: Position[] = [[cx, cy]];
    let px = cx, // previous vertex (for the left-turn rule)
      py = cy;
    let first = true;
    for (;;) {
      const key = startKey(cx, cy);
      list = edges.get(key);
      if (!list || list.length === 0) break;
      let next: [number, number];
      if (list.length === 1 || first) {
        next = list[0];
      } else {
        // Saddle: pick the sharpest LEFT turn w.r.t. the incoming direction.
        const inx = cx - px;
        const iny = cy - py;
        let bestIdx = 0;
        let bestScore = -Infinity;
        for (let i = 0; i < list.length; i++) {
          const ox = list[i][0] - cx;
          const oy = list[i][1] - cy;
          // left-turn score: cross asc, then opposite of straight-ahead
          const cross = inx * oy - iny * ox;
          const dot = inx * ox + iny * oy;
          const score = cross * 2 - dot; // left turns beat straight beat right
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
        next = list[bestIdx];
      }
      // consume the chosen edge
      const idx = list.indexOf(next);
      list.splice(idx, 1);
      if (list.length === 0) edges.delete(key);
      px = cx;
      py = cy;
      cx = next[0];
      cy = next[1];
      first = false;
      if (cx === ring[0][0] && cy === ring[0][1]) break; // closed
      ring.push([cx, cy]);
    }
    if (ring.length >= 4) {
      ring.push([ring[0][0], ring[0][1]]);
      rings.push(ring);
    }
  }
  return rings;
}

/* ── simplification ───────────────────────────────────────────────────────── */

function collapseCollinear(ring: Position[]): Position[] {
  const out: Position[] = [];
  const n = ring.length - 1; // last === first
  for (let i = 0; i < n; i++) {
    const a = ring[(i + n - 1) % n];
    const b = ring[i];
    const c = ring[(i + 1) % n];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cross !== 0) out.push(b);
  }
  if (out.length < 3) return [];
  out.push([out[0][0], out[0][1]]);
  return out;
}

/** Douglas-Peucker on a CLOSED ring (tolerance in the ring's own units). */
function simplifyRing(ring: Position[], tol: number): Position[] {
  const pts = ring.slice(0, -1);
  if (pts.length <= 4) return ring;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  const tol2 = tol * tol;
  while (stack.length) {
    const [i0, i1] = stack.pop() as [number, number];
    const ax = pts[i0][0],
      ay = pts[i0][1],
      bx = pts[i1][0],
      by = pts[i1][1];
    const dx = bx - ax,
      dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1,
      maxI = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const t =
        len2 === 0
          ? 0
          : Math.max(
              0,
              Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / len2),
            );
      const ex = ax + t * dx - pts[i][0];
      const ey = ay + t * dy - pts[i][1];
      const d = ex * ex + ey * ey;
      if (d > maxD) {
        maxD = d;
        maxI = i;
      }
    }
    if (maxD > tol2 && maxI > 0) {
      keep[maxI] = 1;
      stack.push([i0, maxI], [maxI, i1]);
    }
  }
  const out: Position[] = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  if (out.length < 3) return [];
  out.push([out[0][0], out[0][1]]);
  return out;
}

function signedArea(ring: Position[]): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a / 2;
}

function pointInRing(pt: Position, ring: Position[]): boolean {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
    )
      ins = !ins;
  }
  return ins;
}

/* ── main ─────────────────────────────────────────────────────────────────── */

/**
 * Build the dissolved buffer MultiPolygon for `flood` (see module header).
 * Returns null when the flood collection has no usable geometry.
 */
export function buildFloodBufferGeometry(
  flood: FeatureCollection<unknown>,
  opts: BufferGeometryOptions,
): BufferGeometryResult | null {
  const bb = floodBBox(flood);
  if (!bb) return null;
  const cellKm = opts.cellKm ?? 0.2;
  const marginKm = opts.marginKm ?? cellKm * Math.SQRT2;
  const simplifyKm = opts.simplifyKm ?? cellKm * 0.6;
  const radius = opts.radiusKm + marginKm;
  const padKm = radius + cellKm * 2;

  const midLat = (bb[1] + bb[3]) / 2;
  const kx = kmPerDegLon(midLat); // km per deg lon
  const ky = KM_PER_DEG_LAT;
  const lon0 = bb[0] - padKm / kx;
  const lat0 = bb[1] - padKm / ky;
  const width = Math.ceil(((bb[2] - bb[0]) * kx + 2 * padKm) / cellKm) + 1;
  const height = Math.ceil(((bb[3] - bb[1]) * ky + 2 * padKm) / cellKm) + 1;

  // grid index of a lon/lat (cell centres at (i+0.5, j+0.5) in cell units)
  const toX = (lon: number) => ((lon - lon0) * kx) / cellKm;
  const toY = (lat: number) => ((lat - lat0) * ky) / cellKm;
  const toLon = (x: number) => lon0 + (x * cellKm) / kx;
  const toLat = (y: number) => lat0 + (y * cellKm) / ky;

  // ── rasterize flood → seed cells ──
  const seed = new Uint8Array(width * height);
  const mark = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < width && y < height) seed[y * width + x] = 1;
  };
  for (const f of flood.features) {
    const geom = f.geometry as Geometry;
    if (!geom) continue;
    for (const rings of polygonsOf(geom)) {
      // edges (covers polygons smaller than one cell)
      for (const ring of rings) {
        for (let i = 0; i < ring.length - 1; i++) {
          const x0 = toX(ring[i][0]);
          const y0 = toY(ring[i][1]);
          const x1 = toX(ring[i + 1][0]);
          const y1 = toY(ring[i + 1][1]);
          const steps = Math.max(
            1,
            Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2),
          );
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            mark(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t));
          }
        }
      }
      // interior fill (cell centres inside the polygon, holes respected)
      const outer = rings[0];
      let ow = Infinity,
        os = Infinity,
        oe = -Infinity,
        on = -Infinity;
      for (const p of outer) {
        if (p[0] < ow) ow = p[0];
        if (p[0] > oe) oe = p[0];
        if (p[1] < os) os = p[1];
        if (p[1] > on) on = p[1];
      }
      const gx0 = Math.max(0, Math.floor(toX(ow)));
      const gx1 = Math.min(width - 1, Math.ceil(toX(oe)));
      const gy0 = Math.max(0, Math.floor(toY(os)));
      const gy1 = Math.min(height - 1, Math.ceil(toY(on)));
      const poly: Geometry = { type: "Polygon", coordinates: rings };
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          if (seed[gy * width + gx]) continue;
          const pt: Position = [toLon(gx + 0.5), toLat(gy + 0.5)];
          if (pointInFloodGeometry(pt, poly)) seed[gy * width + gx] = 1;
        }
      }
    }
  }

  // ── distance transform + threshold ──
  const d2 = edt2d(seed, width, height);
  const maxCells2 = (radius / cellKm) * (radius / cellKm);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = d2[i] <= maxCells2 ? 1 : 0;

  // ── boundary → rings → simplify (in cell units) ──
  const raw = traceRings(mask, width, height);
  const tolCells = simplifyKm / cellKm;
  const outers: Position[][] = [];
  const holes: Position[][] = [];
  for (const r of raw) {
    const collapsed = collapseCollinear(r);
    if (!collapsed.length) continue;
    const simplified = simplifyRing(collapsed, tolCells);
    if (simplified.length < 4) continue;
    (signedArea(simplified) > 0 ? outers : holes).push(simplified);
  }
  if (!outers.length) return null;

  // ── nest holes into their smallest containing outer ──
  const outerAreas = outers.map((o) => Math.abs(signedArea(o)));
  const polys: Position[][][] = outers.map((o) => [o]);
  for (const h of holes) {
    const probe = h[0];
    let best = -1;
    let bestArea = Infinity;
    for (let i = 0; i < outers.length; i++) {
      if (outerAreas[i] < bestArea && pointInRing(probe, outers[i])) {
        best = i;
        bestArea = outerAreas[i];
      }
    }
    if (best >= 0) polys[best].push(h);
    // A hole with no containing outer is a tracing artefact — drop it.
  }

  // ── to lon/lat MultiPolygon (5 decimals ≈ 1.1 m) ──
  const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
  let vertexCount = 0;
  let gw = Infinity,
    gs = Infinity,
    ge = -Infinity,
    gn = -Infinity;
  const coordinates = polys.map((rings) =>
    rings.map((ring) =>
      ring.map(([x, y]) => {
        const lon = r5(toLon(x));
        const lat = r5(toLat(y));
        vertexCount++;
        if (lon < gw) gw = lon;
        if (lon > ge) ge = lon;
        if (lat < gs) gs = lat;
        if (lat > gn) gn = lat;
        return [lon, lat] as Position;
      }),
    ),
  );

  return {
    geometry: { type: "MultiPolygon", coordinates },
    bbox: [gw, gs, ge, gn],
    ringCount: outers.length + holes.length,
    vertexCount,
    cellKm,
    marginKm,
    grid: { width, height },
  };
}
