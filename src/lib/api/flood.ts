import { endpoint } from "@/configs/endpoint";
import { emptyFC } from "@/types";
import type { FloodApiResponse, FloodFC } from "@/types";
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
const floodCache = new Map<string, FloodApiResponse>();
const floodInflight = new Map<string, Promise<FloodApiResponse>>();

/**
 * CLIENT: fetch the complete flood FeatureCollection for one observation date
 * through the same-origin proxy (/api/flood?date=YYYY-MM-DD). This ONE payload
 * is the single source of truth the map + chat both read.
 */
export async function getFloodAreas(
  date: string,
  signal?: AbortSignal,
): Promise<FloodApiResponse> {
  const hit = floodCache.get(date);
  if (hit) return hit;
  const pending = floodInflight.get(date);
  if (pending) return pending;

  const req = fetch(endpoint.flood.byDate(date), { signal })
    .then(async (res) => {
      if (!res.ok) throw new ApiError(res.status, `flood proxy failed: ${res.status}`);
      const data = (await res.json()) as FloodApiResponse;
      floodCache.set(date, data);
      return data;
    })
    .finally(() => floodInflight.delete(date));
  floodInflight.set(date, req);
  return req;
}
