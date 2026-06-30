import type { FeatureCollection } from "./geo";

export type BoundaryLevel = "province" | "amphoe";

// DTO ของชั้น "ขอบเขตการปกครอง"
export interface BoundaryProps {
  name: string;
  level: BoundaryLevel;
  code?: string;
}

export type BoundaryFC = FeatureCollection<BoundaryProps>;

// Province polygons fetched from the open GeoJSON dataset. Properties are
// normalised to a single `name` (Thai province name) by the lib/api service;
// `region`/`color` are attached per scenario for region-coloured rendering.
export interface ProvinceBoundaryProps {
  name: string;
  region?: string;
  /** Resolved colour string (from an existing design token). */
  color?: string;
}

export type ProvinceBoundaryFC = FeatureCollection<ProvinceBoundaryProps>;
