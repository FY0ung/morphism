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
  resolveLatestCompleteFlood,
} from "@/lib/flood-proximity";
import { analyzeFloodRadius } from "@/lib/flood-radius-analysis";
import { buildForDate } from "@/lib/server/flood-upstream";
import type {
  FloodApiResponse,
  FloodRadiusAnalysisResponse,
  FloodStats,
  HospitalFC,
  HospitalProps,
} from "@/types";

// SERVER-ONLY circular analysis-radius: group the snapshot's flood polygons
// into clusters, select the major cluster(s), compute one representative
// center each, generate TRUE GEODESIC 5 km circles, and return the hospitals
// inside the circle union — the SAME geometry the map displays. The browser
// receives only circles + centers + matching hospitals + metadata; the full
// flood GeoJSON never leaves the server (the map renders flood via PMTiles).
//
//   GET /api/flood-buffer            → resolve the LATEST COMPLETE dataset
//   GET /api/flood-buffer?date=YYYY-MM-DD → analyse that exact date
//
// A precomputed asset (flood/<date>/analysis-5km.json.gz, produced by the
// build:flood pipeline) is served when available; otherwise the analysis runs
// here once per date (LRU-cached, in-flight-deduped). Flood detail is read
// from the local asset copy, then R2, then the live upstream loader — never
// a mock.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CACHE_MAX = 3;

const cache = new LruCache<string, FloodRadiusAnalysisResponse>(CACHE_MAX);
const inflight = new Map<string, Promise<FloodRadiusAnalysisResponse>>();
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

// Detail loaded as a completeness probe is HELD here so the analysis that
// follows immediately never loads the same snapshot twice.
const detailHold = new Map<string, FloodApiResponse>();

async function statsComplete(date: string): Promise<boolean | null> {
  if (completeCache.has(date)) return completeCache.get(date) ?? null;
  const stats = await readGzJson<FloodStats>(`flood/${date}/stats.json.gz`);
  // Older stats lack the flag — flagged false only when stated.
  let value: boolean | null =
    stats == null ? null : stats.complete === undefined ? true : stats.complete;
  if (value === null) {
    // No published stats yet (a freshly registered dataset): probe the LIVE
    // upstream once — the loaded detail is held for the analysis right after,
    // so the snapshot is never fetched twice. No data at all → null (skip).
    const live = await buildForDate(date);
    if (live.features.length) {
      detailHold.set(date, live);
      value = !live.partial;
    }
  }
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

/** Flood detail: probe hold → local asset → R2 asset → live upstream. */
async function loadFloodDetail(date: string): Promise<FloodApiResponse | null> {
  const held = detailHold.get(date);
  if (held) {
    detailHold.delete(date); // consume once — never a long-lived copy
    return held;
  }
  const asset = await readGzJson<FloodApiResponse>(
    `flood/${date}/detail.json.gz`,
  );
  if (asset && asset.features.length) return asset;
  const live = await buildForDate(date);
  return live.features.length ? live : null;
}

/* ── analysis ─────────────────────────────────────────────────────────────── */

async function analyse(
  date: string,
  complete: boolean,
  resolveMs: number,
): Promise<FloodRadiusAnalysisResponse> {
  // Precomputed analysis asset (build:flood pipeline) — served as-is when its
  // radius matches; only the resolve timing is fresh.
  const pre = await readGzJson<FloodRadiusAnalysisResponse>(
    `flood/${date}/analysis-${FLOOD_PROXIMITY_RADIUS_KM}km.json.gz`,
  );
  if (pre && pre.version === 2 && pre.radiusKm === FLOOD_PROXIMITY_RADIUS_KM) {
    return { ...pre, complete: complete && pre.complete, timings: { ...pre.timings, resolveMs } };
  }

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
  const result = analyzeFloodRadius(flood, hospitals, {
    radiusKm: FLOOD_PROXIMITY_RADIUS_KM,
  });
  const spatialMs = Date.now() - tSpatial;
  if (!result) throw new Error(`no analysable flood geometry for ${date}`);
  const fileName = flood.features[0]?.properties?.file_name;
  return {
    version: 2,
    date,
    radiusKm: FLOOD_PROXIMITY_RADIUS_KM,
    clusters: result.clusters,
    circles: result.circles,
    centers: result.centers,
    hospitals: result.hospitals,
    count: result.count,
    bounds: result.bounds,
    floodClipped: result.floodClipped,
    // Truthful completeness: inherit the dataset's own flag; a truncated
    // source can miss flood polygons, so the analysis is partial too.
    complete: complete && flood.partial !== true,
    generatedAt: new Date().toISOString(),
    source: { fileName: typeof fileName === "string" ? fileName : undefined },
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
    return NextResponse.json({ error: String(err), date }, { status: 502 });
  }
}
