// Circular analysis-radius model (lib/flood-radius-analysis): true geodesic
// circles, cluster grouping/selection, representative centers, and hospitals
// filtered with the SAME circle geometry the map displays.
import assert from "node:assert/strict";
import {
  analyzeFloodRadius,
  geodesicCircle,
  haversineKm,
} from "@/lib/flood-radius-analysis";
import { pointInFloodGeometry } from "@/lib/flood-proximity";
import type { FeatureCollection, Geometry, Position } from "@/types";
import type { HospitalFC } from "@/types";

const sq = (w: number, s: number, e: number, n: number, areaM2: number) => ({
  type: "Feature" as const,
  geometry: {
    type: "Polygon" as const,
    coordinates: [
      [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
        [w, s],
      ] as Position[],
    ],
  },
  properties: { f_area: areaM2 },
});

const fc = (
  ...features: ReturnType<typeof sq>[]
): FeatureCollection<unknown> => ({ type: "FeatureCollection", features });

const h = (
  name: string,
  lng: number,
  lat: number,
): HospitalFC["features"][number] => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: { name },
});

export function run(): void {
  // ── true geodesic circle: every vertex is EXACTLY radius from the center ──
  const center: Position = [100.1, 8.0];
  const ring = geodesicCircle(center, 5, 96);
  assert.equal(ring.length, 97); // closed
  for (const p of ring) {
    const d = haversineKm(center, p);
    assert.ok(Math.abs(d - 5) < 0.002, `vertex at ${d} km, expected 5 km`);
  }

  // ── one dense cluster → ONE circle, center on the cluster ────────────────
  // ~10 small patches inside a 2 km neighbourhood near [100.1, 8.0].
  const main = Array.from({ length: 10 }, (_, i) =>
    sq(
      100.09 + (i % 5) * 0.004,
      7.99 + Math.floor(i / 5) * 0.004,
      100.092 + (i % 5) * 0.004,
      7.992 + Math.floor(i / 5) * 0.004,
      50_000,
    ),
  );
  const hospitals: HospitalFC = {
    type: "FeatureCollection",
    features: [
      h("inside-flood", 100.095, 7.995), // on the cluster → distance ~0
      h("in-radius", 100.13, 8.0), // ~3.6 km east of the center
      h("outside", 100.2, 8.0), // ~11 km east → excluded
    ],
  };
  const one = analyzeFloodRadius(fc(...main), hospitals, { radiusKm: 5 });
  assert.ok(one);
  assert.equal(one.clusters.length, 1, "one dense cluster → one circle");
  assert.equal(one.circles.features.length, 1);
  assert.equal(one.centers.features.length, 1);
  // Center falls inside/immediately adjacent to the cluster (≤ ~1.5 km).
  const c = one.clusters[0].center;
  const nearest = Math.min(
    ...main.map((f) =>
      haversineKm(c, [
        (f.geometry.coordinates[0][0][0] + f.geometry.coordinates[0][2][0]) / 2,
        (f.geometry.coordinates[0][0][1] + f.geometry.coordinates[0][2][1]) / 2,
      ]),
    ),
  );
  assert.ok(nearest <= 1.5, `center ${nearest} km from the cluster`);

  // Hospitals: filter geometry == displayed circle geometry.
  assert.equal(one.count, 2);
  const names = one.hospitals.features.map((f) => f.properties.name).sort();
  assert.deepEqual(names, ["in-radius", "inside-flood"]);
  const circleGeom = one.circles.features[0].geometry as Geometry;
  for (const f of one.hospitals.features) {
    assert.ok(
      pointInFloodGeometry(f.geometry.coordinates as Position, circleGeom),
      `${f.properties.name} must be INSIDE the displayed circle polygon`,
    );
    assert.ok((f.properties.distanceKm ?? Infinity) <= 5);
    assert.equal(f.properties.risk, true);
  }
  // No hospital outside the circles is returned.
  assert.ok(!one.hospitals.features.some((f) => f.properties.name === "outside"));
  // Bounds cover the circle (center ±5 km).
  const [w, s, e, n] = one.bounds;
  assert.ok(haversineKm([w, c[1]], c) > 4.5 && haversineKm([e, c[1]], c) > 4.5);
  assert.ok(haversineKm([c[0], s], c) > 4.5 && haversineKm([c[0], n], c) > 4.5);

  // ── two clearly separated MAJOR clusters → two circles ──────────────────
  const far = Array.from({ length: 10 }, (_, i) =>
    sq(
      100.49 + (i % 5) * 0.004, // ~43 km east — clearly separated
      7.99 + Math.floor(i / 5) * 0.004,
      100.492 + (i % 5) * 0.004,
      7.992 + Math.floor(i / 5) * 0.004,
      50_000,
    ),
  );
  const two = analyzeFloodRadius(fc(...main, ...far), hospitals, { radiusKm: 5 });
  assert.ok(two);
  assert.equal(two.clusters.length, 2, "two separated majors → two circles");

  // ── a MINOR far cluster is ignored (main circle preferred) ───────────────
  const tiny = sq(100.49, 7.99, 100.492, 7.992, 5_000); // 1% of the main area
  const pruned = analyzeFloodRadius(fc(...main, tiny), hospitals, { radiusKm: 5 });
  assert.ok(pruned);
  assert.equal(pruned.clusters.length, 1, "minor cluster never adds a circle");

  // ── two majors too CLOSE together → still one circle (no overlap spam) ──
  const near = Array.from({ length: 10 }, (_, i) =>
    sq(
      100.14 + (i % 5) * 0.004, // ~5.5 km east — closer than min separation
      7.99 + Math.floor(i / 5) * 0.004,
      100.142 + (i % 5) * 0.004,
      7.992 + Math.floor(i / 5) * 0.004,
      50_000,
    ),
  );
  const close = analyzeFloodRadius(fc(...main, ...near), hospitals, {
    radiusKm: 5,
    cellKm: 2,
  });
  assert.ok(close);
  assert.ok(
    close.clusters.length === 1,
    "overlapping majors must not produce overlapping circles",
  );
}
