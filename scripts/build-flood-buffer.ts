/**
 * build-flood-buffer.ts — generate the REAL dissolved 5 km buffer geometry
 * around a flood snapshot's polygons, as a small static asset the map renders
 * directly (translucent green zone). Reusable for ANY registry date + radius.
 *
 * WHY offline: buffering ~8k polygons is heavy spatial work that must never run
 * in the browser or inside React. This script runs the shared pure pipeline in
 * lib/flood-buffer-geometry (grid EDT + boundary trace + simplify) ONCE per
 * dataset and writes the dissolved result; the browser downloads only that.
 *
 * SAME 5 km DEFINITION as the hospital query (lib/flood-proximity): the mask
 * threshold is radius + a one-cell-diagonal margin, so the drawn zone can only
 * extend OUTWARD (≈ ≤0.4 km at the default 0.2 km cell) — it never cuts inside
 * the true radius. The script VERIFIES this: every hospital the spatial query
 * matches must sit inside the generated geometry, or the script fails.
 *
 * WHAT it writes, per date:
 *   public/flood-assets/flood/<date>/buffer-5km.json.gz
 * (upload to R2 with the existing asset rollout, same key path.)
 *
 * RUN (repo root):
 *   bun run scripts/build-flood-buffer.ts 2025-10-17
 *   bun run scripts/build-flood-buffer.ts 2025-10-17 --radius 5 --cell 0.2
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";
import path from "node:path";
import { buildFloodBufferGeometry } from "@/lib/flood-buffer-geometry";
import {
  FLOOD_PROXIMITY_RADIUS_KM,
  hospitalsNearFlood,
  pointInFloodGeometry,
} from "@/lib/flood-proximity";
import { normalizeH24, sanitizeFeatureCollection } from "@/lib/normalize";
import type {
  FloodApiResponse,
  FloodBufferGeometryAsset,
  HospitalProps,
  Position,
} from "@/types";

const args = process.argv.slice(2);
const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const flag = (name: string, dflt: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : dflt;
};
const radiusKm = flag("radius", FLOOD_PROXIMITY_RADIUS_KM);
const cellKm = flag("cell", 0.2);

async function main(): Promise<void> {
  if (!date) {
    console.error("usage: bun run scripts/build-flood-buffer.ts <YYYY-MM-DD> [--radius 5] [--cell 0.2]");
    process.exit(1);
  }
  const dir = path.join(process.cwd(), "public", "flood-assets", "flood", date);
  const detailPath = path.join(dir, "detail.json.gz");
  const t0 = Date.now();
  const flood = JSON.parse(
    gunzipSync(await readFile(detailPath)).toString("utf8"),
  ) as FloodApiResponse;
  console.log(`flood ${date}: ${flood.features.length} features (${Date.now() - t0} ms)`);

  const tB = Date.now();
  const res = buildFloodBufferGeometry(flood, { radiusKm, cellKm });
  if (!res) throw new Error("no buffer geometry produced");
  console.log(
    `buffer: grid ${res.grid.width}×${res.grid.height} @ ${res.cellKm} km, ` +
      `${res.ringCount} rings, ${res.vertexCount} vertices, margin ${res.marginKm.toFixed(3)} km (${Date.now() - tB} ms)`,
  );

  // ── verification: every hospital the SPATIAL QUERY matches must be inside ──
  const rawHosp = JSON.parse(
    await readFile(path.join(process.cwd(), "public", "data", "hospitals.geojson"), "utf8"),
  ) as unknown;
  const { fc: hospitals } = sanitizeFeatureCollection<HospitalProps>(
    rawHosp,
    "hospitals(buffer-script)",
    (p) => ({
      name: typeof p.name === "string" ? p.name : "",
      h24: normalizeH24(p),
      province: typeof p.province === "string" ? p.province : undefined,
    }),
  );
  const query = hospitalsNearFlood(hospitals, flood, radiusKm);
  let outside = 0;
  for (const f of query.hospitals.features) {
    if (!pointInFloodGeometry(f.geometry.coordinates as Position, res.geometry))
      outside++;
  }
  console.log(`verify: ${query.count} matched hospitals, ${outside} outside the drawn buffer`);
  if (outside > 0) {
    throw new Error(
      `${outside} hospital(s) within ${radiusKm} km fall outside the buffer geometry — increase margin/cell resolution`,
    );
  }

  const asset: FloodBufferGeometryAsset = {
    version: 1,
    date,
    radiusKm,
    cellKm: res.cellKm,
    marginKm: res.marginKm,
    bbox: res.bbox,
    generatedAt: new Date().toISOString(),
    geometry: res.geometry,
  };
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `buffer-${radiusKm}km.json.gz`);
  const gz = gzipSync(Buffer.from(JSON.stringify(asset)), { level: 9 });
  await writeFile(out, gz);
  console.log(`wrote ${out} (${(gz.length / 1024).toFixed(1)} KB gz)`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
