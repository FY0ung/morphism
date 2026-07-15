// Runtime validation + Thai admin-name normalization (lib/normalize).
import assert from "node:assert/strict";
import {
  isValidFeature,
  normalizeH24,
  sanitizeFeatureCollection,
  stripThaiAdminPrefix,
} from "@/lib/normalize";

export function run(): void {
  // ── stripThaiAdminPrefix ────────────────────────────────────────────────
  assert.equal(stripThaiAdminPrefix("จ.เชียงใหม่"), "เชียงใหม่");
  assert.equal(stripThaiAdminPrefix("จังหวัดเชียงใหม่"), "เชียงใหม่");
  assert.equal(stripThaiAdminPrefix("อ.เมืองสุรินทร์"), "เมืองสุรินทร์");
  assert.equal(stripThaiAdminPrefix("อำเภอ เมือง"), "เมือง");
  assert.equal(stripThaiAdminPrefix("ต.ในเมือง"), "ในเมือง");
  assert.equal(stripThaiAdminPrefix("แขวงคลองตัน"), "คลองตัน");
  assert.equal(stripThaiAdminPrefix("เขตบางรัก"), "บางรัก");
  assert.equal(stripThaiAdminPrefix("Chiang Mai"), "Chiang Mai"); // EN unchanged
  assert.equal(stripThaiAdminPrefix("  "), "");
  assert.equal(stripThaiAdminPrefix(null), "");

  // ── normalizeH24 (opening-hour shapes) ──────────────────────────────────
  assert.equal(normalizeH24({ h24: true }), true);
  assert.equal(normalizeH24({ h24: "true" }), true);
  assert.equal(normalizeH24({ open24: 1 }), true);
  assert.equal(normalizeH24({ h24: false }), false);
  assert.equal(normalizeH24({ opening_hours: "Open 24 hours" }), true);
  assert.equal(normalizeH24({ hours: "เปิด 24 ชั่วโมง" }), true);
  // Flagless dataset → undefined (NOT false): callers must skip the filter.
  assert.equal(normalizeH24({ name: "x" }), undefined);

  // ── isValidFeature ───────────────────────────────────────────────────────
  const good = {
    type: "Feature",
    geometry: { type: "Point", coordinates: [100, 15] },
    properties: {},
  };
  assert.equal(isValidFeature(good), true);
  assert.equal(isValidFeature({ type: "Feature", geometry: null }), false);
  assert.equal(
    isValidFeature({ geometry: { type: "Point", coordinates: [] } }),
    false,
  );
  assert.equal(
    isValidFeature({ geometry: { type: "Nope", coordinates: [1, 2] } }),
    false,
  );

  // ── sanitizeFeatureCollection: skips invalid, maps props, never throws ──
  const { fc, skipped } = sanitizeFeatureCollection<{ name: string }>(
    {
      features: [
        good,
        { type: "Feature", geometry: null, properties: { name: "bad" } },
        "garbage",
        {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
          properties: { name: "ok2" },
        },
      ],
    },
    "test",
    (p) => ({ name: String(p.name ?? "") }),
  );
  assert.equal(fc.features.length, 2);
  assert.equal(skipped, 2);
  // Non-FC payloads degrade to an empty collection, never a crash.
  assert.equal(sanitizeFeatureCollection(null, "t", () => null).fc.features.length, 0);
  assert.equal(sanitizeFeatureCollection({ nope: 1 }, "t", () => null).fc.features.length, 0);
}
