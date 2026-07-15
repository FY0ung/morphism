import { endpoint } from "@/configs/endpoint";
import {
  floodDatasetBase,
  floodOverviewUrlByKey,
  floodStatsUrl,
} from "@/configs/flood-data";
import { emptyFC } from "@/types";
import type { FloodApiResponse, FloodFC, FloodStats } from "@/types";
import type { FloodHexOverview } from "@/lib/flood-overview";
import { LruCache } from "@/lib/lru";
import { ApiError } from "./client";

/**
 * พื้นที่น้ำท่วมตามปี (พ.ศ.) — mock ราย-ปีสำหรับโหมด swipe เทียบปี (ยังไม่มี
 * backend ราย-ปี). คืน FC ว่างไว้ก่อน.
 */
export async function getFlood(year: number): Promise<FloodFC> {
  void endpoint.flood.byYear(year);
  return emptyFC<FloodFC["features"][number]["properties"]>();
}

// Client cache by observation date + in-flight dedupe. Repeated queries for the
// same date (and undo/redo) reuse the cached payload — no refetch. Successful
// responses only; errors are not cached so a later retry can succeed.
// BOUNDED (LRU, latest 3 dates): a full FeatureCollection can be tens of MB,
// so an unbounded Map grows for the whole tab lifetime. 3 covers a compare
// session (2 dates) + one more; an open compare is never broken by eviction —
// its detail indexes reference the feature objects directly, not this cache.
const FLOOD_CACHE_MAX_DATES = 3;
const floodCache = new LruCache<string, FloodApiResponse>(FLOOD_CACHE_MAX_DATES);
const floodInflight = new Map<string, Promise<FloodApiResponse>>();

/**
 * Fetch a gzip-compressed JSON asset and decompress it in the browser. R2's
 * public endpoint stores raw gzip bytes WITHOUT a `Content-Encoding` header (so
 * the browser won't auto-decode), hence we pipe the body through the native
 * `DecompressionStream("gzip")` ourselves. Throws on any HTTP or decode failure
 * so the caller can fall back to the same-origin proxy.
 */
async function fetchGzipJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new ApiError(res.status, `asset ${res.status}`);
  if (typeof DecompressionStream === "undefined" || !res.body) {
    throw new ApiError(0, "DecompressionStream unsupported");
  }
  const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
  return (await new Response(stream).json()) as T;
}

/**
 * CLIENT: fetch the complete flood FeatureCollection for one observation date.
 * Prefers the pre-generated asset on the R2 CDN (fast, edge-cached, no upstream
 * pagination); on ANY failure (not configured, network, empty, decode) it falls
 * back to the same-origin `/api/flood` proxy. Either way this ONE payload is the
 * single source of truth the map + chat both read.
 */
export async function getFloodAreas(
  date: string,
  signal?: AbortSignal,
): Promise<FloodApiResponse> {
  const hit = floodCache.get(date);
  if (hit) return hit;
  const pending = floodInflight.get(date);
  if (pending) return pending;

  const load = async (): Promise<FloodApiResponse> => {
    if (endpoint.flood.assetBase) {
      try {
        const data = await fetchGzipJson<FloodApiResponse>(
          endpoint.flood.assetDetail(date),
          signal,
        );
        if (data?.features?.length) return data;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        // otherwise fall through to the proxy
      }
    }
    const res = await fetch(endpoint.flood.byDate(date), { signal });
    if (!res.ok) throw new ApiError(res.status, `flood proxy failed: ${res.status}`);
    return (await res.json()) as FloodApiResponse;
  };

  const req = load()
    .then((data) => {
      floodCache.set(date, data);
      return data;
    })
    .finally(() => floodInflight.delete(date));
  floodInflight.set(date, req);
  return req;
}

/**
 * CLIENT: fetch the flood detail for ONE date cropped to a viewport bbox
 * ([w,s,e,n]). Goes straight to the same-origin proxy with a `bbox` filter
 * (never the R2 full-extent asset), so the result is only what's on screen —
 * the compare shows real detail at high zoom without loading a whole nation.
 * Not cached (the bbox changes as the user pans).
 */
export async function getFloodDetailInBBox(
  date: string,
  bbox: [number, number, number, number],
  signal?: AbortSignal,
): Promise<FloodApiResponse> {
  const url = `${endpoint.flood.byDate(date)}&bbox=${bbox.join(",")}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new ApiError(res.status, `flood bbox proxy failed: ${res.status}`);
  return (await res.json()) as FloodApiResponse;
}

/**
 * CLIENT: fetch the pre-baked hex overview (3 LODs) for one date from the R2 CDN.
 * Tiny (a few KB gzipped) vs the full detail — used to paint the flood layer
 * instantly at low zoom while the detail streams in. Returns null when no asset
 * base is configured; throws on HTTP/decode failure so the caller can derive the
 * overview from the detail instead.
 */
export async function getFloodOverviewAsset(
  date: string,
  signal?: AbortSignal,
): Promise<FloodHexOverview | null> {
  if (!endpoint.flood.assetBase) return null;
  return fetchGzipJson<FloodHexOverview>(
    endpoint.flood.assetOverview(date),
    signal,
  );
}

// ── PMTiles-era dataset artifacts (addressed by dataset KEY: a date or
//    `year-<CE year>`), fetched from the dataset base. Both are tiny. ─────────

const statsCache = new Map<string, FloodStats>();

/**
 * CLIENT: precomputed stats (bbox / flooded area / totals) for one dataset.
 * Replaces downloading + measuring the complete GeoJSON in pmtiles mode.
 * Returns null when no base is configured; throws on HTTP failure so the
 * caller can fall back to the geojson flow.
 */
export async function getFloodStats(
  key: string,
  signal?: AbortSignal,
): Promise<FloodStats | null> {
  if (!floodDatasetBase()) return null;
  const hit = statsCache.get(key);
  if (hit) return hit;
  const stats = await fetchGzipJson<FloodStats>(floodStatsUrl(key), signal);
  statsCache.set(key, stats);
  return stats;
}

/** CLIENT: hex overview by dataset KEY (covers year keys, which only exist on
 *  the dataset base). Same payload shape as `getFloodOverviewAsset`. */
export async function getFloodOverviewByKey(
  key: string,
  signal?: AbortSignal,
): Promise<FloodHexOverview | null> {
  if (!floodDatasetBase()) return null;
  return fetchGzipJson<FloodHexOverview>(floodOverviewUrlByKey(key), signal);
}
