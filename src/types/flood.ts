import type { FeatureCollection, Feature } from "./geo";

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

// ── 5 km circular analysis-radius (/api/flood-buffer) ───────────────────────
import type { HospitalFC } from "./hospital";

/** One selected flood cluster of the analysis (center is [lng, lat]). */
export interface FloodAnalysisCluster {
  id: number;
  center: [number, number];
  /** Real flooded area of the cluster (km², from upstream f_area). */
  areaKm2: number;
  featureCount: number;
}

/**
 * Result of the circular analysis-radius model (server-computed or served as
 * the precomputed asset flood/<date>/analysis-<radius>km.json.gz): major flood
 * cluster(s) → representative center(s) → true geodesic 5 km circle(s) →
 * hospitals inside the union of those circles. The DISPLAYED circles and the
 * hospital filter use the SAME geometry definition.
 */
export interface FloodRadiusAnalysisResponse {
  /** Bumped to 2 when `floodClipped` was added — v1 assets are recomputed. */
  version: 2;
  /** Resolved flood snapshot date (YYYY-MM-DD) — never silently substituted. */
  date: string;
  radiusKm: number;
  clusters: FloodAnalysisCluster[];
  /** One geodesic circle Polygon per cluster ({ clusterId, radiusKm }). */
  circles: FeatureCollection;
  /** One center Point per cluster ({ clusterId }). */
  centers: FeatureCollection;
  /** Hospitals inside the circle union (risk-flagged, distanceKm = to the
   *  nearest selected center). */
  hospitals: HospitalFC;
  count: number;
  /** [w,s,e,n] over the circles (⊇ every matching hospital). */
  bounds: [number, number, number, number];
  /** ORIGINAL flood polygons that INTERSECT the circle union (the map renders
   *  only these in the buffer scenario — polygons entirely outside the 5 km
   *  radius are dropped server-side; geometry is preserved, never mocked). */
  floodClipped: FeatureCollection;
  /** False when the source flood dataset was truncated (partial notice). */
  complete: boolean;
  generatedAt: string;
  /** Source metadata (dataset key + acquisition file_name of the snapshot). */
  source: { fileName?: string };
  /** Real per-phase durations measured ON THE SERVER (ms) — the chat's tool
   *  steps display these, never fabricated numbers. */
  timings: {
    resolveMs: number;
    floodLoadMs: number;
    hospitalsLoadMs: number;
    spatialMs: number;
  };
}
