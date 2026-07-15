// Canonical dataset-facing type names — the shared vocabulary between data
// adapters (lib/api), the normalization layer (lib/normalize) and the map.
// Mostly aliases over the existing resource DTOs so current call-sites keep
// working while adapters can be documented against ONE set of names
// (see docs/data-adapters.md).
import type { FeatureCollection } from "./geo";
import type { HospitalFC } from "./hospital";
import type { AdmFC, ProvinceBoundaryFC } from "./boundary";
import type { FloodStats, SwipeCompare } from "./morphism";

/** One normalized hospital point ({ name, h24?, province? }). */
export type HospitalFeature = HospitalFC["features"][number];

/** One normalized flood polygon — already canonical in types/flood.ts. */
export type { FloodFeature } from "./flood";

/** One normalized administrative boundary (ADM1/2/3: { name, pro_code?, amp_code? }
 *  — or a province polygon with an attached region colour). */
export type AdministrativeBoundaryFeature =
  | AdmFC["features"][number]
  | ProvinceBoundaryFC["features"][number];

/** The three pre-baked hex LODs for one flood dataset (low-zoom overview). */
export type FloodOverview = Record<"coarse" | "medium" | "fine", FeatureCollection>;

/** One side-pair of a flood comparison: the selection (dates/keys/labels).
 *  Geometry/overviews are loaded per side at compare open. */
export type FloodComparisonDataset = SwipeCompare;

/** Precomputed per-dataset metadata (bounds, feature count, areas, tile zoom
 *  range, generation timestamp) — served as `flood/<key>/stats.json.gz`. */
export type DatasetMetadata = FloodStats;
