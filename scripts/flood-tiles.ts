/**
 * flood-tiles.ts — turn one flood FeatureCollection into a PMTiles archive +
 * a stats sidecar, entirely in TypeScript (geojson-vt → vt-pbf → pmtiles-writer;
 * geojson-vt and vt-pbf are the exact libraries MapLibre itself tiles with).
 *
 * The browser then renders `detail.pmtiles` as a normal MapLibre vector source
 * (only visible tiles are ranged-fetched from R2) and reads bbox / flooded area
 * / totals from `stats.json` — it never downloads or parses the complete
 * GeoJSON again.
 */
import geojsonvt from "geojson-vt";
import vtpbf from "vt-pbf";
import { buildPMTiles } from "./pmtiles-writer";

// Tile zoom range. Above TILE_MAX_ZOOM MapLibre overzooms z11 tiles, which is
// plenty for flood polygons; below TILE_MIN_ZOOM the hex overview renders.
export const TILE_MIN_ZOOM = 5;
export const TILE_MAX_ZOOM = 11;
/** Must match the client's source-layer in the vector-source layers. */
export const TILE_SOURCE_LAYER = "flood";

interface AnyFC {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: string; coordinates: unknown } | null;
    properties?: unknown;
  }[];
}

/** Precomputed dataset stats published as flood/<key>/stats.json. */
export interface FloodStatsFile {
  version: 1;
  key: string;
  kind: "date" | "year";
  /** Observation dates included (one for a date key, many for a year key). */
  dates: string[];
  bbox: [number, number, number, number];
  featureCount: number;
  areaKm2: number;
  areaRai: number;
  tileMinZoom: number;
  tileMaxZoom: number;
  generatedAt: string;
  /** False when ANY source response for this key was truncated/partial —
   *  the published dataset must never silently claim completeness. */
  complete: boolean;
}

/** bbox over every coordinate of the FC (same walk the app's bboxOf uses). */
export function bboxOfFC(fc: AnyFC): [number, number, number, number] | null {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
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
  for (const f of fc.features) walk(f.geometry?.coordinates);
  return Number.isFinite(w) ? [w, s, e, n] : null;
}

const lonToTileX = (lon: number, z: number) =>
  Math.floor(((lon + 180) / 360) * 2 ** z);
const latToTileY = (lat: number, z: number) => {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z,
  );
};
const clampTile = (v: number, z: number) => Math.max(0, Math.min(2 ** z - 1, v));

/**
 * Build the PMTiles archive for one dataset. Properties are stripped first —
 * the flood fill/line styling needs geometry only, which keeps tiles small.
 */
export function buildFloodPMTiles(
  fc: AnyFC,
  bbox: [number, number, number, number],
): Uint8Array {
  const bare: AnyFC = {
    type: "FeatureCollection",
    features: fc.features
      .filter((f) => f.geometry)
      .map((f) => ({ type: "Feature", geometry: f.geometry, properties: {} })),
  };

  const index = geojsonvt(bare as never, {
    maxZoom: TILE_MAX_ZOOM,
    indexMaxZoom: TILE_MIN_ZOOM,
    indexMaxPoints: 0,
    tolerance: 3,
    buffer: 64,
    extent: 4096,
  });

  const tiles: { z: number; x: number; y: number; mvt: Uint8Array }[] = [];
  const [w, s, e, n] = bbox;
  for (let z = TILE_MIN_ZOOM; z <= TILE_MAX_ZOOM; z++) {
    const x0 = clampTile(lonToTileX(w, z), z);
    const x1 = clampTile(lonToTileX(e, z), z);
    const y0 = clampTile(latToTileY(n, z), z); // north → smaller y
    const y1 = clampTile(latToTileY(s, z), z);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const tile = index.getTile(z, x, y);
        if (!tile || !tile.features.length) continue;
        const mvt = vtpbf.fromGeojsonVt(
          { [TILE_SOURCE_LAYER]: tile },
          { version: 2 },
        ) as Uint8Array;
        tiles.push({ z, x, y, mvt });
      }
    }
  }
  if (!tiles.length) throw new Error("no non-empty tiles generated");

  return buildPMTiles(tiles, {
    minZoom: TILE_MIN_ZOOM,
    maxZoom: TILE_MAX_ZOOM,
    bounds: bbox,
    metadata: {
      name: "morphism-flood",
      format: "pbf",
      vector_layers: [{ id: TILE_SOURCE_LAYER, fields: {} }],
    },
  });
}
