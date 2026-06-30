// Minimal GeoJSON shapes shared by every geospatial resource.
// Self-contained (no coupling to maplibre's geojson types) so services and
// views can import freely without pulling the map runtime into the bundle.

/** [longitude, latitude] — GeoJSON coordinate order. */
export type Position = [number, number];

export type Geometry =
  | { type: "Point"; coordinates: Position }
  | { type: "LineString"; coordinates: Position[] }
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };

export interface Feature<P = Record<string, unknown>> {
  type: "Feature";
  geometry: Geometry;
  properties: P;
}

export interface FeatureCollection<P = Record<string, unknown>> {
  type: "FeatureCollection";
  features: Feature<P>[];
}

/** Empty collection helper — services fall back to this until a backend exists. */
export const emptyFC = <P = Record<string, unknown>>(): FeatureCollection<P> => ({
  type: "FeatureCollection",
  features: [],
});

/** West, South, East, North. */
export type BBox = [number, number, number, number];
