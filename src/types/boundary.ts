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

// ── Multi-level administrative boundaries (lazy-loaded by zoom) ──
// ADM1 = province, ADM2 = district (อำเภอ/เขต), ADM3 = subdistrict (ตำบล/แขวง).
export type AdmLevel = "ADM1" | "ADM2" | "ADM3";

// Normalised props (from chingchai/OpenGISData-Thailand). `count` is attached
// after point-in-polygon aggregation; `color` after region tagging (optional).
export interface AdmProps {
  name: string;
  /** Parent province code — used to filter ADM2/ADM3 to the focused provinces. */
  pro_code?: string;
  amp_code?: string;
  count?: number;
  color?: string;
}

export type AdmFC = FeatureCollection<AdmProps>;
