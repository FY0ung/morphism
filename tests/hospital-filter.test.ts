// Hospital filtering + aggregation over the normalized dataset
// (lib/hospital-filter, lib/hospital-stats).
import assert from "node:assert/strict";
import {
  filterHospitalsByScope,
  filterHospitalsInBuffer,
} from "@/lib/hospital-filter";
import { buildProvinceCounts, totalOfCounts } from "@/lib/hospital-stats";
import type { HospitalFC } from "@/types";

const h = (
  name: string,
  lng: number,
  lat: number,
  province?: string,
  h24?: boolean,
): HospitalFC["features"][number] => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: { name, province, h24 },
});

export function run(): void {
  const flagged: HospitalFC = {
    type: "FeatureCollection",
    features: [
      h("A", 100.5, 13.75, "กรุงเทพมหานคร", true),
      h("B", 100.6, 13.7, "กรุงเทพมหานคร", false),
      h("C", 98.98, 18.79, "เชียงใหม่", true),
      h("D", 100.55, 14.35, "พระนครศรีอยุธยา", false),
      h("E", 100.52, 13.72, "จ.กรุงเทพมหานคร", true), // prefixed alias
    ],
  };

  // ── province scoping: EXACT canonical match, aliases normalize in ────────
  const bkk = filterHospitalsByScope(flagged, { province: "กรุงเทพมหานคร" });
  assert.deepEqual(
    bkk.features.map((f) => f.properties.name).sort(),
    ["A", "B", "E"],
  );
  // English alias resolves to the same canonical province.
  const bkkEn = filterHospitalsByScope(flagged, { province: "Bangkok" });
  assert.equal(bkkEn.features.length, 3);
  // Chiang Mai returns ONLY Chiang Mai records — no region leakage.
  const cm = filterHospitalsByScope(flagged, { province: "เชียงใหม่" });
  assert.deepEqual(cm.features.map((f) => f.properties.name), ["C"]);
  // Ayutthaya (long official name).
  const ay = filterHospitalsByScope(flagged, { province: "พระนครศรีอยุธยา" });
  assert.deepEqual(ay.features.map((f) => f.properties.name), ["D"]);
  // No province → nationwide (unchanged).
  assert.equal(filterHospitalsByScope(flagged, {}).features.length, 5);

  // ── h24: applied when the dataset carries the flag… ─────────────────────
  const bkk24 = filterHospitalsByScope(flagged, {
    province: "กรุงเทพมหานคร",
    h24: true,
  });
  assert.deepEqual(
    bkk24.features.map((f) => f.properties.name).sort(),
    ["A", "E"],
  );
  // …and SKIPPED for a flagless dataset (never silently empty).
  const flagless: HospitalFC = {
    type: "FeatureCollection",
    features: [
      h("X", 100.5, 13.75, "กรุงเทพมหานคร"),
      h("Y", 100.6, 13.7, "กรุงเทพมหานคร"),
    ],
  };
  const flaglass24 = filterHospitalsByScope(flagless, {
    province: "กรุงเทพมหานคร",
    h24: true,
  });
  assert.equal(flaglass24.features.length, 2);

  // ── buffer: geodesic distance, risk-flagged output ───────────────────────
  const inBuf = filterHospitalsInBuffer(flagged, [[100.5, 13.75]], 5);
  assert.ok(inBuf.features.length >= 1);
  assert.ok(inBuf.features.every((f) => f.properties.risk === true));
  assert.ok(
    inBuf.features.every((f) => f.properties.name !== "C"), // Chiang Mai ~600 km away
  );

  // ── counts: canonical grouping (prefix alias joins Bangkok) ──────────────
  const counts = buildProvinceCounts(flagged);
  assert.equal(counts.get("กรุงเทพมหานคร"), 3);
  assert.equal(counts.get("เชียงใหม่"), 1);
  assert.equal(totalOfCounts(counts), 5);
}
