// Canonical normalization + runtime validation for EXTERNAL geodata.
//
// Every lib/api service passes raw features through here before they reach any
// hook or component, so the rest of the app never interprets raw source fields
// itself. Invalid features (missing/withered geometry) are SKIPPED safely and
// reported once per dataset in development — never allowed to crash the map.
import type { FeatureCollection, Geometry } from "@/types";

/* ── Thai administrative name normalization ──────────────────────────────── */

// Common Thai admin prefixes across open datasets: จ./จังหวัด (province),
// อ./อำเภอ + เขต (district), ต./ตำบล + แขวง (subdistrict).
const ADMIN_PREFIX_RE =
  /^(?:จ\.|จังหวัด|อ\.|อำเภอ|เขต|ต\.|ตำบล|แขวง)\s*/;

/**
 * Strip a leading Thai admin prefix (`จ.`, `อ.`, `ต.`, `จังหวัด`, `อำเภอ`,
 * `ตำบล`, `เขต`, `แขวง`) and collapse whitespace. Safe on English names.
 */
export function stripThaiAdminPrefix(raw: string | undefined | null): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  return s.replace(ADMIN_PREFIX_RE, "").replace(/\s+/g, " ").trim();
}

/* ── Hospital opening-hours normalization ─────────────────────────────────── */

/**
 * Interpret the many shapes a "24-hour" flag appears in across hospital
 * datasets. Returns `undefined` when the dataset simply doesn't carry the
 * information (callers must NOT treat that as `false` — the h24 filter is
 * skipped for flagless datasets, and the UI states the limitation).
 */
export function normalizeH24(props: Record<string, unknown>): boolean | undefined {
  const candidates = [props.h24, props.open24, props.open_24h, props.is24h];
  for (const v of candidates) {
    if (typeof v === "boolean") return v;
    if (v === "true" || v === 1 || v === "1") return true;
    if (v === "false" || v === 0 || v === "0") return false;
  }
  const hours = props.opening_hours ?? props.hours;
  if (typeof hours === "string" && /24\s*(?:hours|hrs|ชั่วโมง|ชม)|24\/7/i.test(hours))
    return true;
  return undefined;
}

/* ── Runtime feature validation ───────────────────────────────────────────── */

const GEOMETRY_TYPES = new Set([
  "Point",
  "MultiPoint",
  "LineString",
  "MultiLineString",
  "Polygon",
  "MultiPolygon",
]);

interface RawFeatureLike {
  type?: unknown;
  geometry?: { type?: unknown; coordinates?: unknown } | null;
  properties?: unknown;
}

/** Structural validity: a Feature with a known geometry type + a non-empty
 *  coordinates array. Cheap (no deep coordinate walk). */
export function isValidFeature(f: unknown): f is RawFeatureLike & {
  geometry: Geometry;
} {
  if (!f || typeof f !== "object") return false;
  const g = (f as RawFeatureLike).geometry;
  if (!g || typeof g !== "object") return false;
  if (!GEOMETRY_TYPES.has(String(g.type))) return false;
  return Array.isArray(g.coordinates) && g.coordinates.length > 0;
}

export interface SanitizeResult<P> {
  fc: FeatureCollection<P>;
  /** How many raw features were dropped as structurally invalid. */
  skipped: number;
}

/**
 * Validate + normalize one raw FeatureCollection payload:
 * - non-array / missing `features` → empty collection (never a crash)
 * - structurally invalid features are skipped (counted, dev-reported)
 * - `mapProps` produces the CANONICAL properties for each surviving feature
 *   (return null to drop a feature on semantic grounds)
 */
export function sanitizeFeatureCollection<P>(
  raw: unknown,
  datasetLabel: string,
  mapProps: (props: Record<string, unknown>, geometry: Geometry) => P | null,
): SanitizeResult<P> {
  const rawFeatures = Array.isArray(
    (raw as { features?: unknown } | null)?.features,
  )
    ? ((raw as { features: unknown[] }).features)
    : [];
  const features: FeatureCollection<P>["features"] = [];
  let skipped = 0;
  for (const f of rawFeatures) {
    if (!isValidFeature(f)) {
      skipped++;
      continue;
    }
    const props = mapProps(
      ((f as RawFeatureLike).properties ?? {}) as Record<string, unknown>,
      f.geometry,
    );
    if (props === null) {
      skipped++;
      continue;
    }
    features.push({ type: "Feature", geometry: f.geometry, properties: props });
  }
  if (skipped > 0 && process.env.NODE_ENV !== "production") {
    console.warn(
      `[normalize] ${datasetLabel}: skipped ${skipped} invalid feature(s) of ${rawFeatures.length}`,
    );
  }
  return { fc: { type: "FeatureCollection", features }, skipped };
}
