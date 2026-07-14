// Flood data delivery mode + PMTiles asset addressing.
//
// PMTILES MODE (default): the map renders `flood/<key>/detail.pmtiles` as a
// MapLibre vector source (only visible tiles are ranged-fetched from R2) and
// reads bbox / flooded area / totals from the precomputed `stats.json.gz` —
// the browser never downloads or parses the complete GeoJSON.
//
// GEOJSON MODE (fallback): the previous flow — full FeatureCollection from the
// CDN/proxy, hex LODs derived client-side. Selected with
// `NEXT_PUBLIC_FLOOD_DATA_MODE=geojson`, and every PMTiles fetch failure also
// falls back to it per-request, so missing assets can never blank the map.
import { endpoint } from "@/configs/endpoint";

export type FloodDataMode = "pmtiles" | "geojson";

export const FLOOD_DATA_MODE: FloodDataMode =
  process.env.NEXT_PUBLIC_FLOOD_DATA_MODE === "geojson" ? "geojson" : "pmtiles";

// Optional dedicated base for the PMTiles-era artifacts (pmtiles/stats/year
// overviews). Lets local dev serve `public/flood-assets` (built with
// `bun run build:flood -- --public`) while the legacy gz assets stay on R2.
// Unset ⇒ everything resolves against the existing R2 asset base.
const RAW_PM_BASE = (
  process.env.NEXT_PUBLIC_FLOOD_PMTILES_BASE_URL ?? ""
).replace(/\/+$/, "");

/**
 * Absolute base URL for dataset artifacts (stats/pmtiles/overview by key), or
 * null when nothing is configured. A leading-slash base is resolved against
 * the current origin because the PMTiles protocol needs absolute URLs.
 */
export function floodDatasetBase(): string | null {
  const base = RAW_PM_BASE || endpoint.flood.assetBase;
  if (!base) return null;
  if (base.startsWith("/")) {
    if (typeof window === "undefined") return null;
    return `${window.location.origin}${base}`;
  }
  return base;
}

/** True when the PMTiles delivery path should be attempted. */
export function floodPmtilesEnabled(): boolean {
  return FLOOD_DATA_MODE === "pmtiles" && floodDatasetBase() !== null;
}

/** Dataset key for an annual cumulative dataset (CE year). */
export const floodYearKey = (ceYear: number) => `year-${ceYear}`;

export const floodStatsUrl = (key: string) =>
  `${floodDatasetBase()}/flood/${encodeURIComponent(key)}/stats.json.gz`;
export const floodOverviewUrlByKey = (key: string) =>
  `${floodDatasetBase()}/flood/${encodeURIComponent(key)}/overview.json.gz`;
/** MapLibre vector-source URL (pmtiles protocol) for one dataset. */
export const floodPmtilesUrl = (key: string) =>
  `pmtiles://${floodDatasetBase()}/flood/${encodeURIComponent(key)}/detail.pmtiles`;

/** Latest CE year with real flood observations. Future years in queries (e.g.
 *  B.E. 2569 → CE 2026) clamp to this so "current year" always shows data. */
export const FLOOD_LATEST_DATA_YEAR = 2025;
