// Dissolved buffer geometry pipeline (lib/flood-buffer-geometry): containment
// guarantees, exclusion beyond the radius, dissolution of nearby features and
// hole preservation for enclosed far-away pockets.
import assert from "node:assert/strict";
import { buildFloodBufferGeometry } from "@/lib/flood-buffer-geometry";
import {
  distanceToFloodGeometryKm,
  pointInFloodGeometry,
} from "@/lib/flood-proximity";
import type { FeatureCollection, Geometry, Position } from "@/types";

const fc = (...geoms: Geometry[]): FeatureCollection<unknown> => ({
  type: "FeatureCollection",
  features: geoms.map((geometry) => ({
    type: "Feature",
    geometry,
    properties: {},
  })),
});

const square = (
  w: number,
  s: number,
  e: number,
  n: number,
): Geometry => ({
  type: "Polygon",
  coordinates: [
    [
      [w, s],
      [e, s],
      [e, n],
      [w, n],
      [w, s],
    ],
  ],
});

export function run(): void {
  // ── single square flood, 5 km buffer ─────────────────────────────────────
  const flood = fc(square(100.0, 13.0, 100.1, 13.1)); // ~10.9 × 11.1 km
  const res = buildFloodBufferGeometry(flood, { radiusKm: 5, cellKm: 0.25 });
  assert.ok(res, "buffer produced");
  assert.equal(res.geometry.type, "MultiPolygon");

  // Containment guarantee: every point truly ≤ 5 km is INSIDE the drawn zone
  // (inside the flood itself, near an edge, near a corner diagonal).
  const kmLon = 5 / (111.32 * Math.cos((13.05 * Math.PI) / 180));
  const inSamples: Position[] = [
    [100.05, 13.05], // inside the flood polygon
    [100.1 + kmLon * 0.6, 13.05], // ~3 km east of the edge
    [100.1 + kmLon * 0.98, 13.05], // ~4.9 km east of the edge
    [100.1 + kmLon * 0.69, 13.1 + (5 / 110.574) * 0.69], // ~4.9 km off the corner
  ];
  for (const p of inSamples) {
    const d = distanceToFloodGeometryKm(p, flood.features[0].geometry);
    assert.ok(d <= 5, `sample must be within 5 km (got ${d})`);
    assert.ok(
      pointInFloodGeometry(p, res.geometry),
      `point ${p} (${d.toFixed(2)} km) must be inside the drawn zone`,
    );
  }
  // Exclusion: beyond radius + margin + simplify tolerance → OUTSIDE.
  const outMargin = (5 + res.marginKm + 0.25) / 5;
  const outSamples: Position[] = [
    [100.1 + kmLon * (outMargin + 0.1), 13.05],
    [100.05, 13.1 + (5 / 110.574) * (outMargin + 0.1)],
  ];
  for (const p of outSamples) {
    assert.equal(
      pointInFloodGeometry(p, res.geometry),
      false,
      `point ${p} beyond the zone must be outside`,
    );
  }
  // BBox ≈ flood bbox expanded by ~radius (sanity, ±1 km slack).
  const [w, s, e, n] = res.bbox;
  assert.ok(Math.abs((100.0 - w) * 111.32 * Math.cos((13.05 * Math.PI) / 180) - 5) < 1.5);
  assert.ok(Math.abs((13.0 - s) * 110.574 - 5) < 1.5);
  assert.ok(e > 100.1 && n > 13.1);

  // ── dissolution: two squares 4 km apart merge into ONE outer ring ────────
  const twoNear = fc(
    square(100.0, 13.0, 100.02, 13.02),
    square(100.0, 13.055, 100.02, 13.075), // ~3.9 km gap
  );
  const merged = buildFloodBufferGeometry(twoNear, { radiusKm: 5, cellKm: 0.25 });
  assert.ok(merged);
  assert.equal(
    merged.geometry.coordinates.length,
    1,
    "near features dissolve into one polygon",
  );

  // ── hole preservation: a ring flood keeps its far interior OPEN ──────────
  // Square annulus ~40×40 km outer with a ~29×29 km hole; radius 2 km → the
  // centre is ~12.5 km from the ring, far beyond the zone → must stay a hole.
  const ringFlood: Geometry = {
    type: "Polygon",
    coordinates: [
      square(100.0, 13.0, 100.37, 13.36).coordinates[0] as Position[],
      [
        [100.05, 13.05],
        [100.05, 13.31],
        [100.32, 13.31],
        [100.32, 13.05],
        [100.05, 13.05],
      ],
    ],
  } as Geometry;
  const ringBuf = buildFloodBufferGeometry(fc(ringFlood), {
    radiusKm: 2,
    cellKm: 0.25,
  });
  assert.ok(ringBuf);
  const centre: Position = [100.185, 13.18];
  assert.ok(
    distanceToFloodGeometryKm(centre, ringFlood) > 5,
    "test centre is far from the ring",
  );
  assert.equal(
    pointInFloodGeometry(centre, ringBuf.geometry),
    false,
    "far interior pocket must remain a hole in the zone",
  );
  // …while the ring itself is inside its own zone.
  assert.ok(pointInFloodGeometry([100.02, 13.02], ringBuf.geometry));
}
