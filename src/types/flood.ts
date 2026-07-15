import type { FeatureCollection, Feature, Geometry } from "./geo";

// DTO ของชั้น "พื้นที่น้ำท่วม" — โพลิกอนพร้อมระดับความรุนแรง (mock ราย-ปี)
export interface FloodProps {
  /** พ.ศ. ของเหตุการณ์ เช่น 2569 */
  year: number;
  /** ระดับความรุนแรง 1–3 */
  severity: 1 | 2 | 3;
  areaKm2?: number;
}

export type FloodFC = FeatureCollection<FloodProps>;

/**
 * Live flood-extent feature from the Vallaris (GISTDA) OGC Features service,
 * proxied through /api/flood. Only the fields the UI/date-filter needs are typed
 * (the upstream payload carries many more, kept as an index signature).
 */
export interface FloodFeatureProperties {
  /**
   * Acquisition source filename(s) — the AUTHORITATIVE observation date lives
   * here (e.g. "S1C_20251013_0559, rd2_20251013_1817"). Never use `_createdAt`
   * (metadata creation time) as the flood date.
   */
  file_name?: string;
  /** อำเภอ (Thai, e.g. "อ.ด่านขุนทด"). */
  ap_tn?: string;
  /** จังหวัด (Thai, e.g. "จ.นครราชสีมา"). */
  pv_tn?: string;
  /** ตำบล (Thai). */
  tb_tn?: string;
  /** พื้นที่น้ำท่วม (ตร.ม. ตามชุดข้อมูล). */
  flood_area?: number;
  /** พื้นที่ feature (ตร.ม.). */
  f_area?: number;
  /** ภาค (NESDB). */
  re_nesdb?: string;
  lat?: number;
  long?: number;
  /** Metadata creation time — NOT the observation date. */
  _createdAt?: string;
  [key: string]: unknown;
}

export type FloodFeature = Feature<FloodFeatureProperties>;
export type FloodFeatureCollection = FeatureCollection<FloodFeatureProperties>;

// Backwards-compatible aliases (existing map hook treats flood data generically).
export type FloodAreaProps = FloodFeatureProperties;
export type FloodAreaFC = FloodFeatureCollection;

/** Response returned by the /api/flood proxy: the FC + pagination metadata. */
export interface FloodApiResponse extends FloodFeatureCollection {
  /** Observation date the features were filtered to (YYYY-MM-DD). */
  date: string;
  /** Upstream total for the query (may exceed features.length). */
  numberMatched: number;
  /** Features actually returned by the proxy. */
  numberReturned: number;
  /**
   * True when the proxy could not load the full matched set (e.g. the local dev
   * fixture, or a truncated upstream). The UI must state it is a limited sample.
   */
  partial: boolean;
}

// ── 5 km flood-proximity analysis (/api/flood-buffer) ────────────────────────
import type { HospitalFC } from "./hospital";

export interface FloodBufferResponse {
  /** Resolved flood snapshot date (YYYY-MM-DD) — never silently substituted. */
  date: string;
  radiusKm: number;
  count: number;
  /** BBox [w,s,e,n] of matching hospitals (null when count = 0). */
  bounds: [number, number, number, number] | null;
  /** Matching hospitals only (risk-flagged, with real distanceKm each). */
  hospitals: HospitalFC;
  /** False when the source flood dataset was truncated (partial notice). */
  complete: boolean;
  generatedAt: string;
  /** Real per-phase durations measured ON THE SERVER (ms) — the chat's tool
   *  steps display these, never fabricated numbers. */
  timings: {
    resolveMs: number;
    floodLoadMs: number;
    hospitalsLoadMs: number;
    spatialMs: number;
  };
}

/**
 * Precomputed dissolved buffer GEOMETRY asset
 * (flood/<date>/buffer-<radius>km.json.gz, built by scripts/build-flood-buffer).
 * ONE MultiPolygon derived from the SAME flood snapshot + 5 km definition as
 * the hospital spatial query — the map renders it as the green analysis zone.
 */
export interface FloodBufferGeometryAsset {
  version: 1;
  date: string;
  radiusKm: number;
  /** Grid resolution the contour was traced at (km). */
  cellKm: number;
  /** Conservative OUTWARD threshold margin (km) — the zone never cuts inside
   *  the true radius; it may extend outward by ≤ margin + simplify tolerance. */
  marginKm: number;
  bbox: [number, number, number, number];
  generatedAt: string;
  geometry: Geometry;
}
