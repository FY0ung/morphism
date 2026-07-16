import { NextResponse } from "next/server";
import { LruCache } from "@/lib/lru";
import { warnFloodServerConfigOnce } from "@/configs/flood-server";
import { buildForDate } from "@/lib/server/flood-upstream";
import type { FloodApiResponse } from "@/types";

// SERVER-ONLY route handler. The actual Vallaris fetch/paginate/date-filter/
// dedupe pipeline lives in lib/server/flood-upstream (shared with the
// /api/flood-buffer analysis); this route adds HTTP caching + in-flight dedupe.
// The upstream URL + API key never reach the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CACHE_TTL_MS = 15 * 60 * 1000;

/** Parse a "w,s,e,n" bbox param → validated tuple, or null. */
function parseBbox(raw: string | null): [number, number, number, number] | null {
  if (!raw) return null;
  const p = raw.split(",").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return null;
  return [p[0], p[1], p[2], p[3]];
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
  warnFloodServerConfigOnce();
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
