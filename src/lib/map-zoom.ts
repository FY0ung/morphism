// SINGLE source of truth for the map's zoom-band behaviour. Every map renderer
// (use-morphism-map, use-admin-hierarchy) derives visibility + ADM loading from
// getMapZoomBand — no scenario invents its own thresholds.
//
//   z < 6        → "summary"      : one total count, no points, no ADM2/ADM3
//   6 ≤ z < 8.5  → "adm1"         : province aggregation + province count labels
//   8.5 ≤ z < 11 → "adm2"         : district aggregation + district count labels
//   11 ≤ z < 12  → "points"       : clickable hospital points, no count labels
//   z ≥ 12       → "adm3-context" : points + ADM3 boundary context (no labels)
export const ZOOM_BANDS = {
  /** below this → summary total */
  SUMMARY_MAX: 6,
  /** at/above this → ADM2 district level */
  ADM2_MIN: 8.5,
  /** at/above this → individual hospital points */
  POINT_MIN: 11,
  /** at/above this → ADM3 subdistrict context */
  ADM3_MIN: 12,
} as const;

export type MapZoomBand =
  | "summary"
  | "adm1"
  | "adm2"
  | "points"
  | "adm3-context";

/** The shared zoom → band mapping. Use this EVERYWHERE, never inline literals. */
export function getMapZoomBand(zoom: number): MapZoomBand {
  if (zoom < ZOOM_BANDS.SUMMARY_MAX) return "summary";
  if (zoom < ZOOM_BANDS.ADM2_MIN) return "adm1";
  if (zoom < ZOOM_BANDS.POINT_MIN) return "adm2";
  if (zoom < ZOOM_BANDS.ADM3_MIN) return "points";
  return "adm3-context";
}

/** True for the bands that render individual hospital points (z ≥ 11). */
export const isPointBand = (b: MapZoomBand): boolean =>
  b === "points" || b === "adm3-context";

/** True once ADM2 (district) data is in play (z ≥ 8.5). */
export const usesAdm2 = (b: MapZoomBand): boolean =>
  b === "adm2" || isPointBand(b);

/** True once ADM3 (subdistrict) context is in play (z ≥ 12). */
export const usesAdm3 = (b: MapZoomBand): boolean => b === "adm3-context";
