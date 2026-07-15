/**
 * build-flood-assets.ts — generate + publish static flood assets to Cloudflare R2.
 *
 * WHY: at runtime the browser should load flood geometry from the R2 CDN (fast,
 * cached, no live Vallaris pagination per visitor, API key never leaves the
 * server). This script produces those static files ONCE per observation date and
 * uploads them. Re-run it whenever the upstream data (or a new date) changes.
 *
 * WHAT it publishes, per date:
 *   flood/<date>/detail.json    — the full FeatureCollection (single source of truth)
 *   flood/<date>/overview.json  — the 3 pre-baked hex resolutions for low zoom
 *
 * HOW it stays a single source of truth: it does NOT re-implement Vallaris
 * pagination / dedupe / date-matching. It asks the SAME `/api/flood` route the
 * app uses (so start the dev server first), then derives the overview with the
 * SAME `buildFloodHexLevels()` the map uses. No new dependency: Bun's built-in
 * S3 client (`Bun.S3Client`) uploads to R2, `fetch` reads the route.
 *
 * WHAT it publishes, per YEAR key (`year-<CE year>` — annual cumulative union
 * of every observation date in that year):
 *   flood/year-<y>/detail.pmtiles + overview.json.gz + stats.json.gz
 * and per DATE additionally:
 *   flood/<date>/detail.pmtiles — vector tiles (browser range-fetches only the
 *                                 visible tiles; no full-GeoJSON download)
 *   flood/<date>/stats.json.gz  — precomputed bbox / area / totals
 *
 * RUN (from repo root, dev server running on :3000):
 *   bun run build:flood                     # all default dates + years below
 *   bun run build:flood 2025-10-13 year-2025   # only these targets
 *   bun run build:flood:dry                 # generate locally, DO NOT upload
 *   bun run build:flood -- --public         # also copy into public/flood-assets
 *
 * ENV (auto-loaded by Bun from .env.local):
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME
 *   NEXT_PUBLIC_FLOOD_ASSET_BASE_URL   (public URL, for the printed links)
 *   GENERATE_SOURCE_BASE               (optional, default http://localhost:3000)
 */
import { gzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  FLOOD_DATASET_BY_YEAR,
  FLOOD_DATASET_DATES,
} from "@/configs/flood-datasets";
import { buildFloodHexLevels } from "@/lib/flood-overview";
import { areaKm2 } from "@/lib/geo";
import type { FloodApiResponse } from "@/types";
import {
  bboxOfFC,
  buildFloodPMTiles,
  TILE_MAX_ZOOM,
  TILE_MIN_ZOOM,
  type FloodStatsFile,
} from "./flood-tiles";

// Minimal S3 surface we use from Bun (upload runs under Bun only; generation
// also works under node/tsx where `import("bun")` is unavailable).
interface S3FileLike {
  write(bytes: Uint8Array, opts: { type: string }): Promise<number>;
  exists(): Promise<boolean>;
  stat(): Promise<{ size?: number } | undefined>;
  delete(): Promise<void>;
}
interface S3ClientLike {
  file(key: string): S3FileLike;
}

// Dates to publish — the SAME registry the app resolves against
// (configs/flood-datasets.ts). Add a future date there (+ its date→collection
// mapping in configs/flood-server.ts), then re-run — or pass dates as CLI args.
const DEFAULT_DATES: readonly string[] = FLOOD_DATASET_DATES;

// Annual cumulative datasets (key `year-<CE year>`) built from every DEFAULT
// date in that year. B.E. years in user queries map to these CE keys
// client-side. Derived from the registry (newest year first).
const DEFAULT_YEARS: readonly number[] = Object.keys(FLOOD_DATASET_BY_YEAR)
  .map(Number)
  .sort((a, b) => b - a);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_KEY_RE = /^year-(\d{4})$/;
const SOURCE_BASE = process.env.GENERATE_SOURCE_BASE ?? "http://localhost:3000";
const LOCAL_OUT = path.join(process.cwd(), "dist", "flood"); // gitignored, for inspection
// `--public` additionally copies every artifact here, so the Next dev server
// can serve the whole dataset from /flood-assets without touching R2.
const PUBLIC_OUT = path.join(process.cwd(), "public", "flood-assets", "flood");

const args = process.argv.slice(2);
const dry = args.includes("--dry") || args.includes("--dry-run");
const toPublic = args.includes("--public");
const requested = args.filter((a) => !a.startsWith("--"));
const targets = requested.length
  ? requested
  : [...DEFAULT_DATES, ...DEFAULT_YEARS.map((y) => `year-${y}`)];

// Coordinate decimal places kept in the published geometry. 6 dp ≈ 11 cm — far
// finer than flood-extent mapping needs — and roughly halves the gzip payload vs
// the upstream's ~14-digit noise. Properties are untouched. `--precision=0` off.
const precArg = args.find((a) => a.startsWith("--precision="));
const PRECISION = precArg && Number.isFinite(Number(precArg.split("=")[1]))
  ? Number(precArg.split("=")[1])
  : 6;

type Nested = number | Nested[];
/** Round every coordinate in a (possibly deeply nested) position array in place. */
function roundCoords(c: Nested[]): void {
  if (typeof c[0] === "number") {
    const f = 10 ** PRECISION;
    const arr = c as number[];
    for (let i = 0; i < arr.length; i++) arr[i] = Math.round(arr[i] * f) / f;
    return;
  }
  for (const child of c) roundCoords(child as Nested[]);
}

/** Trim coordinate precision across every feature of a FeatureCollection. */
function roundFC(fc: { features: { geometry?: { coordinates?: unknown } | null }[] }): void {
  if (PRECISION <= 0) return;
  for (const f of fc.features) {
    const coords = f.geometry?.coordinates;
    if (Array.isArray(coords)) roundCoords(coords as Nested[]);
  }
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** gzip a JSON string for storage. R2 serves the stored `Content-Encoding: gzip`,
 *  so browser `fetch().json()` transparently decompresses — same bytes on the
 *  wire as today's Next-compressed /api/flood, but cached on the CDN. */
function gz(str: string): Uint8Array {
  return gzipSync(new TextEncoder().encode(str), { level: 9 });
}

/** Build the R2 client from env, or null when not configured (dry runs allow
 *  this). Upload requires Bun (Bun.S3Client); generation alone runs anywhere. */
async function makeClient(): Promise<S3ClientLike | null> {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) return null;
  if (!process.versions.bun) {
    console.error("❌ การ upload ต้องรันด้วย Bun (Bun.S3Client) — ใช้ --dry/--public ได้กับ runtime อื่น");
    return null;
  }
  const { S3Client } = await import("bun");
  return new S3Client({
    accessKeyId,
    secretAccessKey,
    endpoint,
    bucket,
    region: "auto",
  }) as unknown as S3ClientLike;
}

/** Fetch the assembled FeatureCollection for one date from the app's own route. */
async function fetchDetail(date: string): Promise<FloodApiResponse> {
  const url = `${SOURCE_BASE}/api/flood?date=${encodeURIComponent(date)}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`source route ${res.status} for ${date} (${url})`);
  return (await res.json()) as FloodApiResponse;
}

/** Upload gzipped bytes, then confirm the object is really there via exists()
 *  (a HEAD check — reliable across Bun/R2 versions, unlike stat().size which R2
 *  can report as 0). `wrote` is the byte count the PUT actually sent. Size is a
 *  best-effort extra. (No secrets printed.) */
async function putAndVerify(
  s3: S3ClientLike,
  key: string,
  bytes: Uint8Array,
  contentType = "application/gzip",
): Promise<{ ok: boolean; sent: number; wrote: number; size: number }> {
  const file = s3.file(key);
  // Store RAW gzip bytes WITHOUT Content-Encoding: the browser decompresses
  // explicitly via DecompressionStream (r2.dev won't reliably serve the header,
  // and setting it would make the browser double-decode). Key ends in `.json.gz`.
  const wrote = await file.write(bytes, { type: contentType });
  const ok = await file.exists();
  let size = 0;
  try {
    const stat = await file.stat();
    if (typeof stat?.size === "number") size = stat.size;
  } catch {
    /* stat unsupported/flaky on some R2 setups — exists() already confirmed it */
  }
  return { ok, sent: bytes.byteLength, wrote, size };
}

// ── target resolution (date key vs annual-cumulative year key) ──────────────
interface LoadedTarget {
  key: string; // "2025-10-13" | "year-2025"
  kind: "date" | "year";
  dates: string[];
  fc: FloodApiResponse;
}

/** Union of every observation date in a year, deduped so a cell/polygon that
 *  flooded on several dates counts once in the cumulative dataset. */
function mergeYear(parts: { date: string; fc: FloodApiResponse }[]): FloodApiResponse {
  type F = FloodApiResponse["features"][number] & { id?: string | number };
  const byId = new Map<string, F>();
  for (const { date, fc } of parts) {
    fc.features.forEach((f, i) => {
      const p = (f as F).properties as
        | { _id?: unknown; h3_address?: unknown }
        | undefined;
      const key = String(
        (p?.h3_address ?? (f as F).id ?? p?._id) ?? `${date}:${i}`,
      );
      if (!byId.has(key)) byId.set(key, f as F);
    });
  }
  const features = [...byId.values()];
  return {
    type: "FeatureCollection",
    features,
    date: parts[0]?.date ?? "",
    numberMatched: features.length,
    numberReturned: features.length,
    partial: parts.length === 0,
  } as FloodApiResponse;
}

async function loadTarget(target: string): Promise<LoadedTarget> {
  if (DATE_RE.test(target)) {
    return { key: target, kind: "date", dates: [target], fc: await fetchDetail(target) };
  }
  const m = YEAR_KEY_RE.exec(target);
  if (!m) throw new Error(`target ต้องเป็น YYYY-MM-DD หรือ year-YYYY (ได้ "${target}")`);
  const year = m[1];
  const dates = DEFAULT_DATES.filter((d) => d.startsWith(`${year}-`));
  if (!dates.length) throw new Error(`year-${year}: ไม่มีวันที่ของปีนี้ใน DEFAULT_DATES`);
  const parts: { date: string; fc: FloodApiResponse }[] = [];
  for (const d of dates) {
    const fc = await fetchDetail(d);
    if (fc.features.length) parts.push({ date: d, fc });
  }
  if (!parts.length) throw new Error(`year-${year}: ทุกวันได้ 0 features`);
  return { key: target, kind: "year", dates: [...dates], fc: mergeYear(parts) };
}

/** Write one artifact to dist/ (+ public/ with --public) and upload unless dry. */
async function publishArtifact(
  s3: S3ClientLike | null,
  key: string,
  fileName: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<boolean> {
  const localDir = path.join(LOCAL_OUT, key);
  await mkdir(localDir, { recursive: true });
  await writeFile(path.join(localDir, fileName), bytes);
  if (toPublic) {
    const pubDir = path.join(PUBLIC_OUT, key);
    await mkdir(pubDir, { recursive: true });
    await writeFile(path.join(pubDir, fileName), bytes);
  }
  if (dry || !s3) return true;
  const r2Key = `flood/${key}/${fileName}`;
  const res = await putAndVerify(s3, r2Key, bytes, contentType);
  console.log(
    `    ${fileName.padEnd(18)}: sent ${fmtBytes(res.sent)}` +
      (res.size > 0 ? ` · R2 ${fmtBytes(res.size)}` : "") +
      ` · exists ${res.ok ? "✓" : "✗"}`,
  );
  return res.ok;
}

async function main() {
  const s3 = dry ? null : await makeClient();
  if (!dry && !s3) {
    console.error(
      "❌ R2 ยังไม่ครบใน .env.local (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT / R2_BUCKET_NAME).\n" +
        "   ใส่ให้ครบ หรือรัน `bun run build:flood:dry` เพื่อ generate อย่างเดียวก่อน.",
    );
    process.exit(1);
  }

  const publicBase = process.env.NEXT_PUBLIC_FLOOD_ASSET_BASE_URL?.replace(/\/$/, "");
  console.log(`▶ generating flood assets  (${dry ? "DRY RUN — no upload" : "upload → R2"}${toPublic ? " + public/flood-assets" : ""})`);
  console.log(`  source    : ${SOURCE_BASE}/api/flood`);
  console.log(`  precision : ${PRECISION > 0 ? `${PRECISION} dp` : "off (full)"}`);
  console.log(`  tiles     : z${TILE_MIN_ZOOM}–z${TILE_MAX_ZOOM} (MVT → PMTiles)`);
  console.log(`  targets   : ${targets.join(", ")}\n`);

  let failures = 0;

  for (const target of targets) {
    try {
      const { key, kind, dates: srcDates, fc } = await loadTarget(target);
      const count = fc.features?.length ?? 0;
      if (count === 0) {
        console.error(`✗ ${key}: ได้ 0 features — ไม่ publish เพื่อไม่ทับข้อมูลดี`);
        failures++;
        continue;
      }

      // Stats + tiles are computed from FULL precision, before rounding.
      const bbox = bboxOfFC(fc);
      if (!bbox) throw new Error("bbox คำนวณไม่ได้ (ไม่มี geometry)");
      const km2 = areaKm2(fc as never);
      const stats: FloodStatsFile = {
        version: 1,
        key,
        kind,
        dates: srcDates,
        bbox,
        featureCount: count,
        areaKm2: km2,
        areaRai: km2 * 625,
        tileMinZoom: TILE_MIN_ZOOM,
        tileMaxZoom: TILE_MAX_ZOOM,
        generatedAt: new Date().toISOString(),
        // Truthful completeness: a truncated/partial source is NEVER
        // published as complete (5B requirement).
        complete: !fc.partial,
      };
      const pmtiles = buildFloodPMTiles(fc as never, bbox);
      const overview = buildFloodHexLevels(fc);

      roundFC(fc);
      roundFC(overview.coarse);
      roundFC(overview.medium);
      roundFC(overview.fine);

      const overviewGz = gz(JSON.stringify(overview));
      const statsGz = gz(JSON.stringify(stats));

      console.log(
        `• ${key} (${kind}): ${count} features · area ${km2.toFixed(1)} km² · ` +
          `pmtiles ${fmtBytes(pmtiles.byteLength)} · overview gz ${fmtBytes(overviewGz.byteLength)}`,
      );

      let ok = true;
      ok = (await publishArtifact(s3, key, "detail.pmtiles", pmtiles, "application/octet-stream")) && ok;
      ok = (await publishArtifact(s3, key, "overview.json.gz", overviewGz, "application/gzip")) && ok;
      ok = (await publishArtifact(s3, key, "stats.json.gz", statsGz, "application/gzip")) && ok;
      // The complete GeoJSON stays published for DATE keys only — it is the
      // geojson-mode fallback. Year keys are pmtiles-only (fallback uses the
      // year's snapshot date instead).
      if (kind === "date") {
        const detailGz = gz(JSON.stringify(fc));
        ok = (await publishArtifact(s3, key, "detail.json.gz", detailGz, "application/gzip")) && ok;
      }

      if (!ok) {
        console.error(`    ✗ ${key}: มี artifact ที่ upload ไม่สำเร็จ`);
        failures++;
      } else if (!dry && s3 && publicBase) {
        console.log(`    ✅ ${publicBase}/flood/${key}/detail.pmtiles\n`);
      } else {
        console.log(`    ↳ เขียนลง dist/flood/${key}/${toPublic ? " + public/flood-assets" : ""}\n`);
      }
    } catch (err) {
      console.error(`✗ ${target}: ${err instanceof Error ? err.message : String(err)}`);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`\nเสร็จแบบมี error: ${failures}/${targets.length} targets ไม่สำเร็จ`);
    process.exit(1);
  }
  console.log(`✅ สำเร็จครบ ${targets.length} targets`);
}

void main();
