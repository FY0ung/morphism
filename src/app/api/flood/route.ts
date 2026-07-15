import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractFileNameDate } from "@/lib/flood-date";
import { LruCache } from "@/lib/lru";
import type { FloodApiResponse, FloodFeature } from "@/types";

// SERVER-ONLY route handler. Fetches the flood collection for one observation
// date from Vallaris (GISTDA), paginates with bounded PARALLEL concurrency,
// filters to the date, dedupes, and returns ONE complete FeatureCollection (the
// single source of truth the map + chat both read). The upstream URL + API key
// never reach the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALLARIS = {
  baseUrl:
    process.env.VALLARIS_BASE_URL ??
    "https://vallaris.dragonfly.gistda.or.th/core/api/features/1.1",
  collectionId:
    process.env.VALLARIS_FLOOD_COLLECTION ?? "68ed51a9b630c46bc8bf4c1d",
  pageSize: 100,
} as const;

// Each observation date is an INDEPENDENT Vallaris collection (server-only).
const FLOOD_COLLECTION_BY_DATE: Record<string, string> = {
  "2025-10-19": "68f47ef0e608127bf78935bd", // Nakhon Ratchasima (Northeast)
  "2025-10-17": "68f22d8be8d7c1423b82f2fa", // Uttaradit (North)
  "2025-10-16": "68f1f85495e7df41088dca4e", // Nakhon Ratchasima (Northeast)
  "2025-10-15": "68f00c16eb83db3c46baa5f3", // Surin (Northeast)
  "2025-10-14": "68ee425aeb83db3c46b5803b", // Surin (Northeast)
  "2025-10-13": "68ed51a9b630c46bc8bf4c1d",
  "2024-10-12": "6780a6099e02acde959d1a28", // Ayutthaya (Central)
  "2024-10-10": "670e0d41460d838f0b6af4bf", // Chiang Mai (North)
  "2024-10-07": "670e04f50094577ee282855f", // Ayutthaya (Central)
  "2024-10-05": "670e00405a1f3cdd42569414", // Ayutthaya (Central)
  "2024-10-02": "670dfe29460d838f0b6acd08", // North + Northeast (wide extent)
  "2023-10-20": "66bb218790e33d5418ab6436", // Ayutthaya (Central)
  "2023-10-18": "66bb214e90e33d5418ab5492", // Nakhon Ratchasima (Northeast)
  "2023-10-12": "66bb208593e1785047ffa20d", // Surin (Northeast)
  "2023-10-11": "66bb1f528b7038347ff6012b", // Ayutthaya (Central)
  "2023-10-10": "66bb1f098b7038347ff5f185", // Ayutthaya (Central)
  "2022-10-20": "66dfd424aac53c8a2e519de7", // Roi Et / Yasothon (Northeast)
  "2022-10-18": "66dfd24e77d16758b4b3eb23", // Nonthaburi / Pathum Thani (Central)
  "2022-10-15": "66dfd0e3f8d72c8a5b566c1c", // Nakhon Ratchasima (Northeast)
  "2022-10-14": "66dfcffc77d16758b4b3e765",
  "2022-10-13": "66dfcf30f8d72c8a5b56699a", // Buriram (Northeast)
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_TIMEOUT_MS = 8000;
const MAX_PAGES = 800;
const MAX_FEATURES = 80000;
// Viewport (bbox) requests only ever cover what's on screen — cap them far lower
// so even if upstream ignores `bbox` the client can never be handed a whole
// nation of detail (which is what OOM-crashed the compare).
const MAX_FEATURES_BBOX = 6000;
const CONCURRENCY = 5; // bounded parallel pages (spec: 4–6)
const CACHE_TTL_MS = 15 * 60 * 1000;

/** Parse a "w,s,e,n" bbox param → validated tuple, or null. */
function parseBbox(raw: string | null): [number, number, number, number] | null {
  if (!raw) return null;
  const p = raw.split(",").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return null;
  return [p[0], p[1], p[2], p[3]];
}

type RawFloodFeature = FloodFeature & { id?: string | number };

const collectionFor = (date: string) =>
  FLOOD_COLLECTION_BY_DATE[date] ?? VALLARIS.collectionId;

/** Stable dedupe key: prefer `id`, then `_id`, then `h3_address`, else index. */
function featureDedupeKey(f: RawFloodFeature, fallback: number): string {
  const p = f.properties as { _id?: unknown; h3_address?: unknown } | undefined;
  return String(f.id ?? p?._id ?? p?.h3_address ?? fallback);
}

/**
 * True when a feature belongs to the requested observation date. Compares a
 * CANONICAL "YYYY-MM-DD" against several upstream date shapes — never a raw
 * string compare:
 *   • file_name contains the compact "YYYYMMDD" (e.g. "cm1_20221014_03_hv")
 *   • properties.date is "20221014" OR "2022-10-14" (digits normalized)
 *   • properties.date_timestamp (unix seconds) maps to the same UTC day
 */
function featureMatchesDate(f: RawFloodFeature, date: string): boolean {
  const compact = date.replace(/-/g, ""); // "2022-10-14" → "20221014"
  const p = f.properties as
    | { file_name?: unknown; date?: unknown; date_timestamp?: unknown }
    | undefined;

  const fn = typeof p?.file_name === "string" ? p.file_name : undefined;
  if (fn && (extractFileNameDate(fn) === date || fn.includes(compact)))
    return true;

  const d = p?.date;
  if (typeof d === "string" && d.replace(/[^0-9]/g, "").slice(0, 8) === compact)
    return true;
  if (typeof d === "number" && String(d) === compact) return true;

  const ts = p?.date_timestamp;
  if (typeof ts === "number") {
    const iso = new Date(ts * 1000).toISOString().slice(0, 10);
    if (iso === date) return true;
  }
  return false;
}

interface RawPage {
  features?: RawFloodFeature[];
  numberMatched?: number;
}

async function fetchPage(url: URL, signal?: AbortSignal): Promise<RawPage> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => ctrl.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/geo+json" },
    });
    if (!res.ok) throw new Error(`flood upstream ${res.status}`);
    return (await res.json()) as RawPage;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Paginate a collection with bounded parallelism: read `numberMatched` from
 *  page 1, then fetch the rest CONCURRENTLY (not serially). */
async function paginateAll(
  collectionId: string,
  apiKey: string,
  signal?: AbortSignal,
  bbox?: [number, number, number, number] | null,
  maxFeatures: number = MAX_FEATURES,
): Promise<{ features: RawFloodFeature[]; truncated: boolean }> {
  const buildUrl = (offset: number) => {
    const u = new URL(`${VALLARIS.baseUrl}/collections/${collectionId}/items`);
    u.searchParams.set("api_key", apiKey);
    u.searchParams.set("limit", String(VALLARIS.pageSize));
    u.searchParams.set("offset", String(offset));
    // OGC Features bbox filter (lon/lat) — server-side viewport crop.
    if (bbox) u.searchParams.set("bbox", bbox.join(","));
    return u;
  };

  const first = await fetchPage(buildUrl(0), signal);
  const numberMatched =
    typeof first.numberMatched === "number"
      ? first.numberMatched
      : (first.features?.length ?? 0);
  const features: RawFloodFeature[] = [...(first.features ?? [])];

  const maxPages = Math.min(Math.ceil(maxFeatures / VALLARIS.pageSize), MAX_PAGES);
  const totalPages = Math.min(
    Math.ceil(numberMatched / VALLARIS.pageSize),
    maxPages,
  );
  const offsets: number[] = [];
  for (let p = 1; p < totalPages; p++) offsets.push(p * VALLARIS.pageSize);
  let truncated = Math.ceil(numberMatched / VALLARIS.pageSize) > maxPages;

  let idx = 0;
  const worker = async () => {
    while (idx < offsets.length && features.length < maxFeatures) {
      const pg = await fetchPage(buildUrl(offsets[idx++]), signal);
      if (pg.features?.length) features.push(...pg.features);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, offsets.length) }, worker),
  );
  if (features.length >= maxFeatures) truncated = true;
  return { features, truncated };
}

// ── cache by date + in-flight dedupe ─────────────────────────────────────────
// BOUNDED (LRU, latest 3 keys): a full-date payload can hold up to 80k
// features — an unbounded Map (especially with `date|bbox` composite keys)
// grows for the whole process lifetime. TTL staleness is still checked on
// read; in-flight dedupe is unchanged.
interface Entry {
  at: number;
  payload: FloodApiResponse;
}
const CACHE_MAX_ENTRIES = 3;
const cache = new LruCache<string, Entry>(CACHE_MAX_ENTRIES);
const inflight = new Map<string, Promise<FloodApiResponse>>();

function respond(payload: FloodApiResponse, status = 200) {
  // Next.js gzip/brotli-compresses JSON responses by default (compress: true).
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=3600" },
  });
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const date = params.get("date") ?? "";
  if (!DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "query param `date` (YYYY-MM-DD) is required" },
      { status: 400 },
    );
  }
  const bbox = parseBbox(params.get("bbox"));
  // Composite cache key so a viewport crop never collides with the full extent.
  const key = bbox ? `${date}|${bbox.join(",")}` : date;

  const fresh = cache.get(key);
  if (fresh && Date.now() - fresh.at < CACHE_TTL_MS) return respond(fresh.payload);

  let run = inflight.get(key);
  if (!run) {
    run = buildForDate(date, req.signal, bbox)
      .then((payload) => {
        cache.set(key, { at: Date.now(), payload });
        return payload;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, run);
  }

  try {
    return respond(await run);
  } catch (err) {
    return NextResponse.json(
      {
        type: "FeatureCollection",
        features: [],
        date,
        numberMatched: 0,
        numberReturned: 0,
        partial: false,
        error: String(err),
      } satisfies FloodApiResponse & { error: string },
      { status: 502 },
    );
  }
}

async function buildForDate(
  date: string,
  signal?: AbortSignal,
  bbox?: [number, number, number, number] | null,
): Promise<FloodApiResponse> {
  const apiKey = process.env.VALLARIS_API_KEY;
  if (apiKey) {
    try {
      const { features: raw, truncated } = await paginateAll(
        collectionFor(date),
        apiKey,
        signal,
        bbox,
        bbox ? MAX_FEATURES_BBOX : MAX_FEATURES,
      );
      const byId = new Map<string, RawFloodFeature>();
      raw.forEach((f, i) => {
        if (featureMatchesDate(f, date)) byId.set(featureDedupeKey(f, i), f);
      });
      const features = [...byId.values()];
      return {
        type: "FeatureCollection",
        features,
        date,
        numberMatched: features.length,
        numberReturned: features.length,
        partial: truncated,
      };
    } catch {
      /* fall through to the dev fixture */
    }
  }

  const fixture = await loadFixture(date);
  if (fixture) return fixture;

  return {
    type: "FeatureCollection",
    features: [],
    date,
    numberMatched: 0,
    numberReturned: 0,
    partial: false,
  };
}

/** Load the sanitized dev fixture for a date (features only, no key/links). */
async function loadFixture(date: string): Promise<FloodApiResponse | null> {
  if (!DATE_RE.test(date)) return null; // guards path traversal
  const file = path.join(process.cwd(), "src", "data", "flood", `${date}.json`);
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as {
      features?: RawFloodFeature[];
      numberMatched?: number;
    };
    const all = Array.isArray(parsed.features) ? parsed.features : [];
    const byId = new Map<string, RawFloodFeature>();
    all.forEach((f, i) => {
      if (featureMatchesDate(f, date)) byId.set(featureDedupeKey(f, i), f);
    });
    const features = [...byId.values()];
    if (features.length === 0) return null;
    return {
      type: "FeatureCollection",
      features,
      date,
      numberMatched: parsed.numberMatched ?? features.length,
      numberReturned: features.length,
      partial: true,
    };
  } catch {
    return null;
  }
}
