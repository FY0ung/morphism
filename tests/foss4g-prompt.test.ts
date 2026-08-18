// Special FOSS4G Hiroshima demo prompt: the EXACT input "01 September 2026"
// returns a promo message and NOTHING else — no scenario, no date/flood
// resolution, no map/layer/camera/time-filter change, no tool steps. Every
// other date keeps behaving as a normal map query.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  isFoss4gPrompt,
  resolveScenario,
  FOSS4G_PLACE,
  FOSS4G_PROMPT,
} from "@/sections/morphism/const";
import { PRESENTATION_PLACES } from "@/configs/geography";
import { CAMERA } from "@/configs/motion";
import { resolveFloodDate } from "@/lib/flood-date";
import type { TFunction } from "@/languages/types";
import en from "@/languages/project/en.json";
import th from "@/languages/project/th.json";
import ja from "@/languages/project/ja.json";

const TALK_TITLE =
  "Designing Web Map Experiences Beyond Too Much Data and Too Little Time with Intelligent AI Processing";

/** i18n stub that resolves the real locale strings for a given resource. */
const tFor = (res: typeof en) =>
  ((key: string) =>
    key.split(".").reduce<unknown>((a, k) => (a as Record<string, unknown>)[k], res) ??
    key) as unknown as TFunction;

const key = ((k: string) => k) as unknown as TFunction;

export function run(): void {
  // ── 1. The exact input triggers the FOSS4G response ──────────────────────
  const s = resolveScenario("01 September 2026", key, "en");
  assert.equal(s.id, "foss4g");
  assert.ok(isFoss4gPrompt("01 September 2026"));
  // Case / surrounding + inner whitespace tolerated; nothing else is.
  for (const variant of [
    "01 september 2026",
    "  01 September 2026  ",
    "01  September   2026",
  ]) {
    assert.equal(resolveScenario(variant, key, "en").id, "foss4g", variant);
  }
  assert.equal(FOSS4G_PROMPT, "01 september 2026");

  // ── 2. Camera target resolves to Hiroshima, Japan (registry-driven) ─────
  assert.ok(s.camera, "the prompt carries a presentation camera");
  // Explicitly the CITY (広島市), never an ambiguous "Hiroshima" that could
  // resolve to the prefecture.
  assert.equal(FOSS4G_PLACE.name, "Hiroshima City, Japan");
  assert.deepEqual(s.camera!.center, FOSS4G_PLACE.center, "flies to Hiroshima");
  assert.deepEqual(s.camera!.center, PRESENTATION_PLACES.hiroshima.center);
  // Sanity-check the coordinates really are Hiroshima (and not Thailand).
  const [lng, lat] = s.camera!.center;
  assert.ok(lng > 132 && lng < 133, `lng ${lng} is Hiroshima's meridian`);
  assert.ok(lat > 34 && lat < 35, `lat ${lat} is Hiroshima's parallel`);
  // City/metro level — recognisable context, never street level.
  assert.equal(s.camera!.zoom, FOSS4G_PLACE.zoom);
  assert.ok(s.camera!.zoom >= 8 && s.camera!.zoom <= 12, "city-level zoom");
  // ── 8. Motion uses the SHARED camera token (flyTo applies live
  //      prefers-reduced-motion → duration 0; no separate animation system).
  assert.equal(s.camera!.duration, CAMERA.scopeFit, "shared CAMERA token");
  const viewSrc = readFileSync(
    path.join(process.cwd(), "src", "sections", "morphism", "view", "morphism-view.tsx"),
    "utf8",
  );
  assert.ok(
    /if \(scenario\.camera\) flyTo\(scenario\.camera\);\s*\n\s*return;/.test(viewSrc),
    "the unknown branch flies via the existing flyTo helper, then returns",
  );

  // ── Time pill: the trigger date itself, cleanly, with no snapshot wording ─
  const pres = s.presentation;
  assert.ok(pres, "the prompt carries a presentation payload");
  assert.equal(pres!.pillLabel, "01 September 2026", "pill shows the date");
  assert.ok(!/flood|snapshot/i.test(pres!.pillLabel), "no 'Flood snapshot'");
  assert.ok(!pres!.pillLabel.includes("2025"), "never the old flood date");
  assert.ok(
    /setTimeLabel\(pres\.pillLabel\)/.test(viewSrc) &&
      /setTimeActive\(true\)/.test(viewSrc),
    "the view drives the pill from the presentation payload",
  );
  // The default flood CONTEXT (Thai data + its dated pill) is released, so
  // neither its label nor its layer lingers over Japan.
  assert.ok(
    /const pres = scenario\.presentation;[\s\S]{0,400}dismissInitialContext\(\)/.test(
      viewSrc,
    ),
    "presentation mode releases the Thai default flood context",
  );

  // ── Boundary: the REAL Hiroshima City admin outline (MultiPolygon) ──────
  const rings = pres!.boundary;
  assert.ok(Array.isArray(rings) && Array.isArray(rings[0]), "ring array");
  assert.deepEqual(rings, PRESENTATION_PLACES.hiroshima.boundary);
  assert.equal(FOSS4G_PLACE.name, "Hiroshima City, Japan", "city, not prefecture");
  // A detailed administrative outline — not a circle/buffer/hand-drawn blob.
  const pts = rings.flat();
  assert.ok(pts.length >= 150, `detailed outline (${pts.length} vertices)`);
  assert.ok(rings.length >= 2, "mainland + detached island parts");
  for (const ring of rings) {
    assert.ok(ring.length >= 4, "each ring is a real polygon");
    assert.deepEqual(ring[0], ring[ring.length - 1], "ring is closed");
    for (const [bLng, bLat] of ring) {
      assert.ok(bLng > 132 && bLng < 133, `lng ${bLng} near Hiroshima`);
      assert.ok(bLat > 34 && bLat < 35, `lat ${bLat} near Hiroshima`);
    }
  }
  // Extent matches the real Hiroshima City bbox (wide inland north, bay south)
  // — a radial buffer around the centre could not produce this asymmetry.
  const lngs = pts.map((c) => c[0]);
  const lats = pts.map((c) => c[1]);
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  assert.ok(Math.abs(minLng - 132.1786) < 0.01, "west edge ≈ 132.18");
  assert.ok(Math.abs(maxLng - 132.6961) < 0.01, "east edge ≈ 132.70");
  assert.ok(Math.abs(minLat - 34.2981) < 0.01, "south edge ≈ 34.30");
  assert.ok(Math.abs(maxLat - 34.6148) < 0.01, "north edge ≈ 34.61");
  // Not a circle: the outline is markedly wider than it is tall, and the
  // centroid of the vertices is NOT the camera centre (a buffer's would be).
  const wKm = (maxLng - minLng) * 111 * Math.cos((34.45 * Math.PI) / 180);
  const hKm = (maxLat - minLat) * 111;
  assert.ok(wKm / hKm > 1.2, "asymmetric extent — not a radial buffer");
  // The camera fits the BOUNDARY (bounds), not a fixed zoom guess.
  assert.ok(s.bounds, "presentation frames the boundary via bounds");
  assert.deepEqual(s.bounds!.sw, [minLng, minLat], "fit sw = boundary sw");
  assert.deepEqual(s.bounds!.ne, [maxLng, maxLat], "fit ne = boundary ne");
  assert.ok(
    /if \(scenario\.bounds\) fitBounds\(scenario\.bounds\);/.test(viewSrc),
    "the view fits the boundary with the shared padded fitBounds helper",
  );
  // The fallback camera centre still sits inside the outline's extent.
  assert.ok(lng > minLng && lng < maxLng);
  assert.ok(lat > minLat && lat < maxLat);
  // Drawn through the EXISTING boundary layer + admin colour role (theme and
  // colour-vision correct), not a bespoke layer.
  assert.ok(
    /setBoundaries\(\{[\s\S]{0,800}type: "MultiPolygon",[\s\S]{0,200}pres\.boundary\.map\(\(ring\) => \[ring\]\)/.test(
      viewSrc,
    ),
    "boundary goes through the existing setBoundaries polygon layer",
  );
  assert.ok(
    /color: readCssColor\(REGION_DEFAULT_TOKEN\)/.test(viewSrc),
    "outline uses the shared admin colour role",
  );

  // ── 4/5. No scenario machinery: no layers, steps, filter or analysis ────
  // `mode: "unknown"` is the contract the view returns from BEFORE touching
  // layer state, the initial flood context or scene history.
  assert.equal(s.mode, "unknown");
  assert.equal(s.layers.length, 0, "no analytical layers");
  assert.equal(s.steps.length, 0, "no tool-processing steps");
  // (`bounds` IS set — it frames the boundary; asserted above.)
  // No FLOOD time-filter machinery: the pill text comes from the presentation
  // payload above, not from the scenario's flood time-filter fields.
  assert.equal(s.timeActive, undefined, "no flood time filter");
  assert.equal(s.timeLabel, undefined);
  assert.equal(s.flood, undefined, "no flood dataset attached");
  assert.equal(s.swipe, undefined);
  assert.equal(s.analysis, undefined, "no analysis run");
  assert.equal(s.aggregate, undefined);
  assert.equal(s.charts, undefined, "no result card");

  // ── 3. No date/flood resolver runs for this input ────────────────────────
  // (The date IS parseable — proving the special case short-circuits BEFORE
  // the flood-date path rather than relying on it failing.)
  const parsed = resolveFloodDate("01 September 2026");
  assert.equal(parsed.matchMode, "exact-date");
  assert.equal(parsed.resolvedDate, "2026-09-01");
  assert.equal(s.flood, undefined, "…yet the scenario carries no flood meta");

  // ── 4. Map state unchanged: the view's guard is `mode === "unknown"` and
  //      it returns before any mutation (source-level contract) ────────────
  // Asserted structurally above (no layers/camera/bounds/time/flood/analysis).

  // ── 5. Other dates still resolve normally (unchanged behaviour) ─────────
  // A dated FLOOD query resolves its snapshot exactly as before.
  const normal = resolveScenario("flood 18 December 2025", key, "en");
  assert.notEqual(normal.id, "foss4g");
  assert.equal(normal.flood?.date, "2025-12-18", "registered date still works");
  assert.ok(normal.layers.includes("flood"));
  // A BARE date keeps its pre-existing behaviour (the flood branch needs a
  // flood term, so it falls through to the friendly unknown fallback) — the
  // special case must not have changed this either way.
  const bare = resolveScenario("18 December 2025", key, "en");
  assert.notEqual(bare.id, "foss4g", "a normal date never hits the easter egg");
  assert.equal(bare.id, "unknown", "bare-date behaviour unchanged");

  // ── 7. A normal scenario runs immediately AFTER the FOSS4G interaction ──
  // (The easter egg is stateless — it records no history and mutates no
  // resolver state, so the very next prompt resolves exactly as usual and
  // brings the camera back to its own target.)
  resolveScenario("01 September 2026", key, "en");
  const after = resolveScenario("Show 24-hour hospitals in Bangkok", key, "en");
  assert.equal(after.mode, "points");
  assert.deepEqual(after.hospitalScope, {
    province: "กรุงเทพมหานคร",
    h24: true,
  });
  assert.ok(after.camera, "the follow-up scenario sets its own Bangkok camera");
  assert.ok(
    after.camera!.center[0] > 100 && after.camera!.center[0] < 101,
    "camera returns to Bangkok, not Hiroshima",
  );
  const afterFlood = resolveScenario("flood 18 December 2025", key, "en");
  assert.equal(afterFlood.flood?.date, "2025-12-18", "flood flow still fine");
  // Neighbouring/near-miss inputs must NOT trigger the easter egg.
  for (const other of [
    "1 September 2026",
    "01 September 2025",
    "02 September 2026",
    "01 October 2026",
    "flood 01 September 2026",
  ]) {
    assert.ok(!isFoss4gPrompt(other), `must not trigger: ${other}`);
    assert.notEqual(resolveScenario(other, key, "en").id, "foss4g", other);
  }

  // ── 6. EN / TH / JP localized copy (event name + talk title unchanged) ───
  for (const [name, res] of Object.entries({ en, th, ja })) {
    const f = (res as typeof en).morphism.scenario.foss4g as Record<string, string>;
    for (const k of ["intro", "join", "title"]) {
      assert.ok(
        typeof f?.[k] === "string" && f[k].length > 0,
        `${name}: scenario.foss4g.${k} missing`,
      );
    }
    assert.ok(
      f.intro.includes("FOSS4G Hiroshima"),
      `${name}: event name spelled "FOSS4G Hiroshima"`,
    );
    assert.equal(f.title, TALK_TITLE, `${name}: talk title preserved exactly`);
    // The rendered message carries intro + join + title.
    const msg = resolveScenario(
      "01 September 2026",
      tFor(res as typeof en),
      name === "th" ? "th" : name === "ja" ? "ja" : "en",
    ).result;
    assert.ok(msg.includes("FOSS4G Hiroshima"));
    assert.ok(msg.includes(TALK_TITLE));
    assert.ok(msg.includes(f.join));
  }
  // TH/JP intros are actually localized (not English fallbacks).
  assert.notEqual(th.morphism.scenario.foss4g.intro, en.morphism.scenario.foss4g.intro);
  assert.notEqual(ja.morphism.scenario.foss4g.intro, en.morphism.scenario.foss4g.intro);
}
