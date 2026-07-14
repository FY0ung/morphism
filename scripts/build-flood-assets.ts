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
 * RUN (from repo root, dev server running on :3000):
 *   bun run build:flood                     # all default dates below
 *   bun run build:flood 2025-10-13          # only these dates
 *   bun run build:flood:dry                 # generate locally, DO NOT upload
 *
 * ENV (auto-loaded by Bun from .env.local):
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME
 *   NEXT_PUBLIC_FLOOD_ASSET_BASE_URL   (public URL, for the printed links)
 *   GENERATE_SOURCE_BASE               (optional, default http://localhost:3000)
 */
import { S3Client, gzipSync } from "bun";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFloodHexLevels } from "@/lib/flood-overview";
import type { FloodApiResponse } from "@/types";

// Dates to publish. Add a future date here (and its date→collection mapping in
// src/app/api/flood/route.ts), then re-run — or pass dates as CLI args.
const DEFAULT_DATES = ["2025-10-13", "2022-10-14"] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_BASE = process.env.GENERATE_SOURCE_BASE ?? "http://localhost:3000";
const LOCAL_OUT = path.join(process.cwd(), "dist", "flood"); // gitignored, for inspection

const args = process.argv.slice(2);
const dry = args.includes("--dry") || args.includes("--dry-run");
const dates = args.filter((a) => !a.startsWith("--"));
const targets = dates.length ? dates : [...DEFAULT_DATES];

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

/** Build the R2 client from env, or null when not configured (dry runs allow this). */
function makeClient(): S3Client | null {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) return null;
  return new S3Client({ accessKeyId, secretAccessKey, endpoint, bucket, region: "auto" });
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
  s3: S3Client,
  key: string,
  bytes: Uint8Array,
): Promise<{ ok: boolean; sent: number; wrote: number; size: number }> {
  const file = s3.file(key);
  // Store RAW gzip bytes WITHOUT Content-Encoding: the browser decompresses
  // explicitly via DecompressionStream (r2.dev won't reliably serve the header,
  // and setting it would make the browser double-decode). Key ends in `.json.gz`.
  const wrote = await file.write(bytes, { type: "application/gzip" });
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

async function main() {
  const s3 = dry ? null : makeClient();
  if (!dry && !s3) {
    console.error(
      "❌ R2 ยังไม่ครบใน .env.local (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT / R2_BUCKET_NAME).\n" +
        "   ใส่ให้ครบ หรือรัน `bun run build:flood:dry` เพื่อ generate อย่างเดียวก่อน.",
    );
    process.exit(1);
  }

  const publicBase = process.env.NEXT_PUBLIC_FLOOD_ASSET_BASE_URL?.replace(/\/$/, "");
  console.log(`▶ generating flood assets  (${dry ? "DRY RUN — no upload" : "upload → R2"})`);
  console.log(`  source    : ${SOURCE_BASE}/api/flood`);
  console.log(`  precision : ${PRECISION > 0 ? `${PRECISION} dp` : "off (full)"}`);
  console.log(`  dates     : ${targets.join(", ")}\n`);

  let failures = 0;

  for (const date of targets) {
    if (!DATE_RE.test(date)) {
      console.error(`✗ ${date}: รูปแบบวันที่ต้องเป็น YYYY-MM-DD — ข้าม`);
      failures++;
      continue;
    }

    try {
      const detail = await fetchDetail(date);
      const count = detail.features?.length ?? 0;
      if (count === 0) {
        console.error(
          `✗ ${date}: ได้ 0 features (ตรวจ dev server รันอยู่ไหม + VALLARIS_API_KEY ถูกต้อง) — ` +
            `ไม่ upload เพื่อไม่ทับข้อมูลดีด้วยไฟล์ว่าง`,
        );
        failures++;
        continue;
      }

      const overview = buildFloodHexLevels(detail);
      const hexTotal =
        overview.coarse.features.length +
        overview.medium.features.length +
        overview.fine.features.length;

      // Trim coordinate precision (built overview from full precision first).
      roundFC(detail);
      roundFC(overview.coarse);
      roundFC(overview.medium);
      roundFC(overview.fine);

      const detailStr = JSON.stringify(detail);
      const overviewStr = JSON.stringify(overview);
      const detailGz = gz(detailStr);
      const overviewGz = gz(overviewStr);

      // Always write a local (uncompressed) copy under dist/ for inspection.
      const dir = path.join(LOCAL_OUT, date);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "detail.json"), detailStr);
      await writeFile(path.join(dir, "overview.json"), overviewStr);

      console.log(
        `• ${date}: ${count} features · overview ${hexTotal} hexes ` +
          `(coarse ${overview.coarse.features.length} / medium ${overview.medium.features.length} / fine ${overview.fine.features.length})`,
      );
      console.log(
        `    detail ${fmtBytes(Buffer.byteLength(detailStr))} → gzip ${fmtBytes(detailGz.byteLength)} · ` +
          `overview ${fmtBytes(Buffer.byteLength(overviewStr))} → gzip ${fmtBytes(overviewGz.byteLength)}`,
      );

      if (dry || !s3) {
        console.log(`    ↳ dry run — เขียนลง dist/flood/${date}/ อย่างเดียว (ไม่ upload)\n`);
        continue;
      }

      const dKey = `flood/${date}/detail.json.gz`;
      const oKey = `flood/${date}/overview.json.gz`;
      const dRes = await putAndVerify(s3, dKey, detailGz);
      const oRes = await putAndVerify(s3, oKey, overviewGz);

      // Best-effort: remove the earlier mis-encoded plain-named objects.
      for (const stale of [`flood/${date}/detail.json`, `flood/${date}/overview.json`]) {
        try {
          if (await s3.file(stale).exists()) await s3.file(stale).delete();
        } catch {
          /* ignore cleanup errors */
        }
      }

      const note = (r: { ok: boolean; sent: number; wrote: number; size: number }) =>
        `sent ${fmtBytes(r.sent)} · wrote ${fmtBytes(r.wrote)}` +
        (r.size > 0 ? ` · R2 ${fmtBytes(r.size)}` : "") +
        ` · exists ${r.ok ? "✓" : "✗"}`;
      console.log(`    detail   : ${note(dRes)}`);
      console.log(`    overview : ${note(oRes)}`);

      if (dRes.ok && oRes.ok) {
        console.log(`    ✅ uploaded + verified (exists on R2)`);
        if (publicBase) {
          console.log(`       ${publicBase}/${dKey}`);
          console.log(`       ${publicBase}/${oKey}`);
        }
        console.log("");
      } else {
        console.error(`    ✗ ${date}: upload ไม่พบ object บน R2 (detail exists=${dRes.ok}, overview exists=${oRes.ok})`);
        failures++;
      }
    } catch (err) {
      console.error(`✗ ${date}: ${err instanceof Error ? err.message : String(err)}`);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`\nเสร็จแบบมี error: ${failures}/${targets.length} วันไม่สำเร็จ`);
    process.exit(1);
  }
  console.log(`✅ สำเร็จครบ ${targets.length} วัน`);
}

void main();
