// SERVER-ONLY flood upstream loader (extracted from app/api/flood/route.ts so
// OTHER server routes — e.g. /api/flood-buffer's analysis — can load the same
// canonical per-date FeatureCollection without an HTTP self-call). Fetches one
// observation date from Vallaris (GISTDA), paginates with bounded PARALLEL
// concurrency, filters to the date, dedupes, and returns ONE complete
// FeatureCollection. The upstream URL + API key never reach the browser.
//
// Import ONLY from server code (API route handlers). Never from client code.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractFileNameDate } from "@/lib/flood-date";
import { VALLARIS, collectionForDate } from "@/configs/flood-server";
import type { FloodApiResponse, FloodFeature } from "@/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_TIMEOUT_MS = 8000;
const MAX_PAGES = 800;
const MAX_FEATURES = 80000;
// Viewport (bbox) requests only ever cover what's on screen — cap them far lower
// so even if upstream ignores `bbox` the client can never be handed a whole
// nation of detail (which is what OOM-crashed the compare).
const MAX_FEATURES_BBOX = 6000;
const CONCURRENCY = 5; // bounded parallel pages (spec: 4–6)

type RawFloodFeature = FloodFeature & { id?: string | number };

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

/**
 * Load the canonical FeatureCollection for one observation date: live Vallaris
 * when the API key is configured (date-filtered + deduped, truncation flagged
 * as `partial`), else the sanitized dev fixture, else an explicit empty FC.
 */
export async function buildForDate(
  date: string,
  signal?: AbortSignal,
  bbox?: [number, number, number, number] | null,
): Promise<FloodApiResponse> {
  const apiKey = process.env.VALLARIS_API_KEY;
  if (apiKey) {
    try {
      const { features: raw, truncated } = await paginateAll(
        collectionForDate(date),
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
