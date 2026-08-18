// REAL 5 km flood-proximity analysis (lib/flood-proximity):
// point-in-polygon, distance-to-polygon, the hospitalsNearFlood spatial query
// and the latest-COMPLETE dataset resolution + the stale-request guard idiom.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  FLOOD_PROXIMITY_RADIUS_KM,
  distanceToFloodGeometryKm,
  hospitalsNearFlood,
  pointInFloodGeometry,
  resolveLatestCompleteFlood,
} from "@/lib/flood-proximity";
import {
  FLOOD_DATASET_DATES,
  FLOOD_DATASET_DATE_SET,
} from "@/configs/flood-datasets";
import type { FeatureCollection, Geometry, HospitalFC } from "@/types";

const h = (
  name: string,
  lng: number,
  lat: number,
): HospitalFC["features"][number] => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: { name },
});

// ~0.1° lat ≈ 11.06 km; polygon = 100.0–100.2 lng × 13.0–13.2 lat square.
const square: Geometry = {
  type: "Polygon",
  coordinates: [
    [
      [100.0, 13.0],
      [100.2, 13.0],
      [100.2, 13.2],
      [100.0, 13.2],
      [100.0, 13.0],
    ],
  ],
};
// Same square with a hole covering its centre quarter.
const squareWithHole: Geometry = {
  type: "Polygon",
  coordinates: [
    (square as Extract<Geometry, { type: "Polygon" }>).coordinates[0],
    [
      [100.05, 13.05],
      [100.15, 13.05],
      [100.15, 13.15],
      [100.05, 13.15],
      [100.05, 13.05],
    ],
  ],
};

const floodFC = (
  ...geoms: Geometry[]
): FeatureCollection<Record<string, unknown>> => ({
  type: "FeatureCollection",
  features: geoms.map((geometry) => ({
    type: "Feature",
    geometry,
    properties: {},
  })),
});

export async function run(): Promise<void> {
  // ── point in polygon (holes respected) ────────────────────────────────────
  assert.equal(pointInFloodGeometry([100.1, 13.1], square), true);
  assert.equal(pointInFloodGeometry([100.3, 13.1], square), false);
  assert.equal(pointInFloodGeometry([100.1, 13.1], squareWithHole), false);
  assert.equal(pointInFloodGeometry([100.02, 13.02], squareWithHole), true);

  // ── distance to polygon boundary ──────────────────────────────────────────
  // Inside → 0 (hospital inside a flood polygon counts with distance 0).
  assert.equal(distanceToFloodGeometryKm([100.1, 13.1], square), 0);
  // ~0.03° east of the edge at lat 13 ≈ 3.25 km → within 5 km.
  const near = distanceToFloodGeometryKm([100.23, 13.1], square);
  assert.ok(near > 2.5 && near < 4, `expected ~3.25 km, got ${near}`);
  // ~0.1° east ≈ 10.8 km → farther than 5 km.
  const far = distanceToFloodGeometryKm([100.3, 13.1], square);
  assert.ok(far > 5, `expected > 5 km, got ${far}`);

  // ── hospitalsNearFlood: inside / ≤5 km / >5 km / metadata ────────────────
  const hospitals: HospitalFC = {
    type: "FeatureCollection",
    features: [
      h("inside", 100.1, 13.1), // in polygon → distance 0
      h("near", 100.23, 13.1), // ~3.25 km → included
      h("far", 100.4, 13.1), // ~21 km → excluded
    ],
  };
  const res = hospitalsNearFlood(hospitals, floodFC(square));
  assert.equal(res.count, 2);
  assert.equal(res.count, res.hospitals.features.length); // count == points
  const names = res.hospitals.features.map((f) => f.properties.name).sort();
  assert.deepEqual(names, ["inside", "near"]);
  for (const f of res.hospitals.features) {
    assert.equal(f.properties.risk, true);
    assert.ok(
      (f.properties.distanceKm ?? Infinity) <= FLOOD_PROXIMITY_RADIUS_KM,
      `${f.properties.name} must be within ${FLOOD_PROXIMITY_RADIUS_KM} km`,
    );
  }
  const inside = res.hospitals.features.find(
    (f) => f.properties.name === "inside",
  );
  assert.equal(inside?.properties.distanceKm, 0);
  // Bounds cover the matching points only.
  assert.ok(res.bounds);
  const [w, s, e, n] = res.bounds;
  assert.ok(w <= 100.1 && e >= 100.23 && s <= 13.1 && n >= 13.1);
  assert.ok(e < 100.4, "excluded point must not stretch the bounds");

  // ── empty result: flood far from every hospital ───────────────────────────
  const nowhereNear: Geometry = {
    type: "Polygon",
    coordinates: [
      [
        [99.0, 18.0],
        [99.1, 18.0],
        [99.1, 18.1],
        [99.0, 18.1],
        [99.0, 18.0],
      ],
    ],
  };
  const empty = hospitalsNearFlood(hospitals, floodFC(nowhereNear));
  assert.equal(empty.count, 0);
  assert.equal(empty.hospitals.features.length, 0);
  assert.equal(empty.bounds, null);

  // ── latest COMPLETE dataset resolution ────────────────────────────────────
  const dates = ["2025-10-19", "2025-10-17", "2025-10-13"] as const;
  // Newest is incomplete → resolves to the NEXT complete date (no silent use
  // of the current calendar week; no hardcoded date).
  const flags: Record<string, boolean | null> = {
    "2025-10-19": false,
    "2025-10-17": true,
    "2025-10-13": true,
  };
  const resolved = await resolveLatestCompleteFlood(dates, async (d) => flags[d]);
  assert.deepEqual(resolved, { date: "2025-10-17", complete: true });

  // All incomplete → newest incomplete WITH stats, flagged complete:false
  // (caller must show the partial-data notice — never silently).
  const allPartial = await resolveLatestCompleteFlood(dates, async () => false);
  assert.deepEqual(allPartial, { date: "2025-10-19", complete: false });

  // No reachable stats at all → null (route answers 503, never a fake date).
  const none = await resolveLatestCompleteFlood(dates, async () => null);
  assert.equal(none, null);

  // Stats missing for the newest only → next complete date wins.
  const holey = await resolveLatestCompleteFlood(dates, async (d) =>
    d === "2025-10-19" ? null : true,
  );
  assert.deepEqual(holey, { date: "2025-10-17", complete: true });

  // ── "latest available" regression (resolve_latest_complete_flood) ─────────
  // 1/7. Selects the GLOBALLY newest complete dataset from the REAL registry —
  // and the selected key exists in the registry (nothing is invented).
  const registryResolved = await resolveLatestCompleteFlood(
    FLOOD_DATASET_DATES,
    async (d) => (FLOOD_DATASET_DATE_SET.has(d) ? true : null),
  );
  assert.ok(registryResolved, "registry resolution must succeed");
  assert.equal(
    registryResolved!.date,
    FLOOD_DATASET_DATES[0],
    "latest-available = the first (newest) registry entry",
  );
  assert.ok(FLOOD_DATASET_DATE_SET.has(registryResolved!.date));

  // 2/3. Independent of today's date / any "last week" range: the resolver
  // consumes ONLY registry order + completeness (no Date access in the
  // selection path — asserted at source level), so a mocked "today" far in
  // the future changes nothing.
  const proximitySrc = readFileSync(
    path.join(process.cwd(), "src", "lib", "flood-proximity.ts"),
    "utf8",
  );
  const resolverSection = proximitySrc.slice(
    proximitySrc.indexOf("resolveLatestCompleteFlood"),
  );
  assert.ok(
    !/new Date\(|Date\.now\(/.test(resolverSection),
    "resolver never consults the calendar",
  );

  // 6. Newest-first ordering across months AND years is a registry invariant
  // the resolver depends on — a mis-ordered entry would silently change what
  // "latest" means, so lock it (2025-12-18 must sort above 2025-10-19 etc.).
  for (let i = 1; i < FLOOD_DATASET_DATES.length; i++) {
    assert.ok(
      FLOOD_DATASET_DATES[i - 1] > FLOOD_DATASET_DATES[i],
      `registry strictly newest-first at index ${i}`,
    );
  }
  // No duplicates (Set size = list length).
  assert.equal(FLOOD_DATASET_DATE_SET.size, FLOOD_DATASET_DATES.length);

  // 5b. A REJECTING probe (transient network fault on one date) is skipped —
  // it must never fail the whole resolution (previously it did, and worse,
  // the route negatively CACHED transient nulls so one blip poisoned every
  // later request until a server restart).
  const throwsOnNewest = await resolveLatestCompleteFlood(dates, async (d) => {
    if (d === "2025-10-19") throw new Error("transient fetch failure");
    return true;
  });
  assert.deepEqual(throwsOnNewest, { date: "2025-10-17", complete: true });
  // Transient failure everywhere → null now, but a RETRY with the network
  // back must succeed (nothing may be permanently poisoned at this layer).
  const outage = await resolveLatestCompleteFlood(dates, async () => {
    throw new Error("offline");
  });
  assert.equal(outage, null);
  const afterOutage = await resolveLatestCompleteFlood(dates, async () => true);
  assert.deepEqual(afterOutage, { date: "2025-10-19", complete: true });

  // Route-level guard: statsComplete must not negatively cache `null`
  // (the regression), while definitive true/false stay cached.
  const routeSrc = readFileSync(
    path.join(process.cwd(), "src", "app", "api", "flood-buffer", "route.ts"),
    "utf8",
  );
  assert.ok(
    /if \(value !== null\) completeCache\.set\(date, value\);/.test(routeSrc),
    "statsComplete caches only definitive answers (transient misses retryable)",
  );

  // ── stale-request prevention (the guard idiom the view uses) ─────────────
  // A newer prompt supersedes an older in-flight one: the older result must
  // never be applied even though it finishes later.
  let requestId = 0;
  const applied: string[] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const runScenario = async (label: string, delayMs: number) => {
    const id = ++requestId;
    await sleep(delayMs);
    if (id !== requestId) return; // stale → dropped
    applied.push(label);
  };
  const first = runScenario("first-slow", 30);
  const second = runScenario("second-fast", 5); // supersedes `first`
  await Promise.all([first, second]);
  assert.deepEqual(applied, ["second-fast"]);
}
