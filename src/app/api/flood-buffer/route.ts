import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { FLOOD_DATASET_DATES } from "@/configs/flood-datasets";
import { endpoint } from "@/configs/endpoint";
import { LruCache } from "@/lib/lru";
import { normalizeH24, sanitizeFeatureCollection } from "@/lib/normalize";
import {
  FLOOD_PROXIMITY_RADIUS_KM,
  hospitalsNearFlood,
  resolveLatestCompleteFlood,
} from "@/lib/flood-proximity";
import type {
  FloodApiResponse,
  FloodBufferResponse,
  FloodStats,
  HospitalFC,
  HospitalProps,
} from "@/types";

// SERVER-ONLY 5 km flood-proximity analysis: hospitals inside a flood polygon
// or ≤ 5 km from its boundary, for ONE resolved flood snapshot. The browser
// receives ONLY the matching hospital features + metadata — the full flood
// GeoJSON never leaves the server (the map renders flood via PMTiles).
//
//   GET /api/flood-buffer            → resolve the LATEST COMPLETE dataset
//   GET /api/flood-buffer?date=YYYY-MM-DD → analyse that exact date
//
// Assets are read from the local public/flood-assets copy when present (dev),
// else fetched from the public R2 asset base. Results are cached (LRU) per
// date; in-flight requests are deduped.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CACHE_MAX = 3;

const cache = new LruCache<string, FloodBufferResponse>(CACHE_MAX);
const inflight = new Map<string, Promise<FloodBufferResponse>>();
// Completeness per date is tiny — cache it separately so resolution is cheap.
const completeCache = new Map<string, boolean | null>();

/* ── asset access: local file first (dev), else R2 ────────────────────────── */

function localAssetPath(rel: string): string {
  return path.join(process.cwd(), "public", "flood-assets", rel);
}

async function readGzJson<T>(rel: string): Promise<T | null> {
  // 1) local dev copy (public/flood-assets is gitignored but present in dev)
  try {
    const buf = await readFile(localAssetPath(rel));
    return JSON.parse(gunzipSync(buf).toString("utf8")) as T;
  } catch {
    /* fall through to the remote base */
  }
  // 2) public R2 base (raw gzip bytes without Content-Encoding)
  const base = endpoint.flood.assetBase;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/${rel}`);
    if (!res.ok) return null;
    const ab = Buffer.from(await res.arrayBuffer());
    return JSON.parse(gunzipSync(ab).toString("utf8")) as T;
  } catch {
    return null;
  }
}

async function statsComplete(date: string): Promise<boolean | null> {
  if (completeCache.has(date)) return completeCache.get(date) ?? null;
  const stats = await readGzJson<FloodStats>(`flood/${date}/stats.json.gz`);
  // Older stats lack the flag — treat presence of valid stats as complete-
  // unknown → conservative false ONLY when flagged; missing stats → null.
  const value =
    stats == null ? null : stats.complete === undefined ? true : stats.complete;
  completeCache.set(date, value);
  return value;
}

/* ── datasets ─────────────────────────────────────────────────────────────── */

let hospitalsCache: HospitalFC | null = null;
async function loadHospitals(): Promise<HospitalFC> {
  if (hospitalsCache) return hospitalsCache;
  const raw = JSON.parse(
    await readFile(
      path.join(process.cwd(), "public", "data", "hospitals.geojson"),
      "utf8",
    ),
  ) as unknown;
  const { fc } = sanitizeFeatureCollection<HospitalProps>(
    raw,
    "hospitals(server)",
    (p) => ({
      name: typeof p.name === "string" ? p.name : "",
      h24: normalizeH24(p),
      province: typeof p.province === "string" ? p.province : undefined,
    }),
  );
  hospitalsCache = fc;
  return fc;
}

async function loadFloodDetail(date: string): Promise<FloodApiResponse | null> {
  return readGzJson<FloodApiResponse>(`flood/${date}/detail.json.gz`);
}

/* ── analysis ─────────────────────────────────────────────────────────────── */

async function analyse(
  date: string,
  complete: boolean,
  resolveMs: number,
): Promise<FloodBufferResponse> {
  // Load phases are measured individually (they run in parallel; each timing
  // is that phase's own duration) — the chat displays these REAL durations.
  const timed = async <T>(p: Promise<T>): Promise<[T, number]> => {
    const t0 = Date.now();
    const v = await p;
    return [v, Date.now() - t0];
  };
  const [[hospitals, hospitalsLoadMs], [flood, floodLoadMs]] =
    await Promise.all([timed(loadHospitals()), timed(loadFloodDetail(date))]);
  if (!flood || !flood.features.length) {
    throw new Error(`flood detail unavailable for ${date}`);
  }
  const tSpatial = Date.now();
  const result = hospitalsNearFlood(hospitals, flood, FLOOD_PROXIMITY_RADIUS_KM);
  const spatialMs = Date.now() - tSpatial;
  return {
    date,
    radiusKm: FLOOD_PROXIMITY_RADIUS_KM,
    count: result.count,
    bounds: result.bounds,
    hospitals: result.hospitals,
    // Truthful completeness: inherit the dataset's own flag; a truncated
    // source can miss flood polygons, so the analysis is partial too.
    complete: complete && flood.partial !== true,
    generatedAt: new Date().toISOString(),
    timings: { resolveMs, floodLoadMs, hospitalsLoadMs, spatialMs },
  };
}

export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get("date");
  if (requested && !DATE_RE.test(requested)) {
    return NextResponse.json(
      { error: "query param `date` must be YYYY-MM-DD" },
      { status: 400 },
    );
  }

  // Resolve which snapshot to analyse — NEVER a silent substitution: an
  // explicit ?date is used as-is; otherwise the newest complete dataset.
  const tResolve = Date.now();
  let date = requested;
  let complete = true;
  if (!date) {
    const resolved = await resolveLatestCompleteFlood(
      FLOOD_DATASET_DATES,
      statsComplete,
    );
    if (!resolved) {
      return NextResponse.json(
        { error: "no flood dataset with reachable stats" },
        { status: 503 },
      );
    }
    date = resolved.date;
    complete = resolved.complete;
  } else {
    complete = (await statsComplete(date)) ?? false;
  }

  const resolveMs = Date.now() - tResolve;

  const hit = cache.get(date);
  if (hit) return NextResponse.json(hit);

  let run = inflight.get(date);
  if (!run) {
    run = analyse(date, complete, resolveMs)
      .then((payload) => {
        cache.set(date as string, payload);
        return payload;
      })
      .finally(() => inflight.delete(date as string));
    inflight.set(date, run);
  }

  try {
    return NextResponse.json(await run);
  } catch (err) {
    return NextResponse.json(
      { error: String(err), date },
      { status: 502 },
    );
  }
}
