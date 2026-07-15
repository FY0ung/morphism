// Pure hospital filtering over the NORMALIZED dataset — extracted from the
// view so intent filtering is testable and never mixed with map mutation or
// camera work. Filtering is always by DATA (canonical province names, radii),
// never by camera bounds or visual clipping.
import { distanceKm, normalizeProvinceName } from "@/lib/geo";
import type { HospitalFC, Position } from "@/types";

export interface HospitalScopeFilter {
  /** Thai province name (any common alias — canonicalized internally). */
  province?: string;
  /** Keep only 24-hour hospitals — SKIPPED when the dataset carries no flag
   *  (flagless data must not silently produce an empty result). */
  h24?: boolean;
}

/**
 * Scope the dataset to a province (exact canonical match — no substring
 * leaking across provinces) and optionally the 24-hour flag.
 */
export function filterHospitalsByScope(
  source: HospitalFC,
  scope: HospitalScopeFilter,
): HospitalFC {
  const canonScope = normalizeProvinceName(scope.province);
  const inProvince = (pv: string | undefined) => {
    if (!scope.province) return true;
    const canon = normalizeProvinceName(pv);
    return canon !== "" && canon === canonScope;
  };
  // h24 only bites when the dataset actually carries the flag.
  const datasetHasH24 = source.features.some((f) => f.properties.h24);
  const features = source.features
    .filter((f) => inProvince(f.properties.province))
    .filter((f) => !(scope.h24 && datasetHasH24 && !f.properties.h24));
  return { type: "FeatureCollection", features };
}

/**
 * Keep only hospitals within `radiusKm` of ANY given centre, flagged as risk
 * (red points). Geodesic distance on the data — never a bbox approximation.
 */
export function filterHospitalsInBuffer(
  source: HospitalFC,
  centers: readonly Position[],
  radiusKm: number,
): HospitalFC {
  const inBuffer = (p: Position) =>
    centers.some((c) => distanceKm(p, c) <= radiusKm);
  const features = source.features
    .filter(
      (f) =>
        f.geometry.type === "Point" &&
        inBuffer(f.geometry.coordinates as Position),
    )
    .map((f) => ({ ...f, properties: { ...f.properties, risk: true } }));
  return { type: "FeatureCollection", features };
}
