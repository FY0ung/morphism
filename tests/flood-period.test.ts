// Transparent period resolution (lib/flood-date periodCalendarRange +
// sections/morphism/const scnFloodByPeriod via resolveScenario):
//
//   natural-language period → resolved CALENDAR start/end range
//   → registered snapshots INSIDE that range → latest available snapshot.
//
// The chat steps must state BOTH the resolved range (resolve_period) and the
// selected snapshot (select_latest_available_snapshot); a window with no
// registered snapshot is an explicit empty state — never a snapshot outside
// the range. Exact-date and plain-month queries keep the single resolve_date
// step (unchanged pipeline).
import assert from "node:assert/strict";
import {
  daysInMonth,
  formatDate,
  periodCalendarRange,
  periodDayRange,
} from "@/lib/flood-date";
import { resolveScenario } from "@/sections/morphism/const";
import { FLOOD_DATASET_DATE_SET } from "@/configs/flood-datasets";
import type { TFunction } from "@/languages/types";

// i18n stub that KEEPS the interpolated values ("key {json}") so assertions
// can check the runtime range/date actually flow into labels and results.
const t = ((key: string, vars?: Record<string, unknown>) =>
  vars ? `${key} ${JSON.stringify(vars)}` : key) as unknown as TFunction;

export function run(): void {
  // ── 1 · "mid-October 2025" resolves to the intended CALENDAR range ───────
  assert.deepEqual(periodCalendarRange("2025-10", "mid"), [
    "2025-10-11",
    "2025-10-20",
  ]);
  const scn = resolveScenario("Flooding occurred in mid-October 2025", t, "en");
  assert.equal(scn.flood?.periodStart, "2025-10-11");
  assert.equal(scn.flood?.periodEnd, "2025-10-20");

  // ── 2 · latest REGISTERED snapshot inside that range is selected ─────────
  assert.equal(scn.flood?.date, "2025-10-19");
  assert.equal(scn.flood?.hasData, true);
  assert.ok(FLOOD_DATASET_DATE_SET.has(scn.flood!.date), "date is registered");
  assert.ok(
    scn.flood!.date >= scn.flood!.periodStart! &&
      scn.flood!.date <= scn.flood!.periodEnd!,
    "selected snapshot lies INSIDE the resolved range",
  );
  assert.ok(scn.layers.includes("flood"));

  // ── 3 · processing output shows BOTH the range and the selected snapshot ─
  const rangeEn = "11 October 2025 – 20 October 2025";
  assert.equal(scn.steps.length, 5); // resolve_period/select/load/add/fit
  assert.ok(
    scn.steps[0].label.includes("stepResolvePeriod") &&
      scn.steps[0].label.includes(rangeEn),
    "step 1 = resolve_period → resolved range",
  );
  assert.ok(
    scn.steps[1].label.includes("stepSelectSnapshot") &&
      scn.steps[1].label.includes(rangeEn) &&
      scn.steps[1].label.includes("19 October 2025"),
    "step 2 = select_latest_available_snapshot(range) → selected date",
  );
  assert.ok(scn.steps[2].label.includes("stepLoad"));
  assert.ok(scn.steps[3].label.includes("stepAddLayer"));
  assert.ok(scn.steps[4].label.includes("stepFit"));
  // Result text carries the SAME range + snapshot (single resolution result).
  assert.ok(scn.result.includes(rangeEn));
  assert.ok(scn.result.includes("19 October 2025"));

  // ── 4/5 · no snapshot inside the range → truthful EMPTY state, never a
  //          fallback to a date outside the range ──────────────────────────
  // Early October 2025 (1–10): all 2025-10 snapshots are 13–19 → empty.
  const early = resolveScenario("flood in early October 2025", t, "en");
  assert.equal(early.flood?.hasData, false);
  assert.equal(early.layers.length, 0);
  assert.ok(early.id.startsWith("flood-empty"));
  assert.equal(early.flood?.periodStart, "2025-10-01");
  assert.equal(early.flood?.periodEnd, "2025-10-10");
  assert.equal(early.steps.length, 2); // resolve_period + failing selection
  assert.ok(early.steps[1].label.includes("stepSelectSnapshotEmpty"));
  assert.ok(early.result.includes("emptyPeriod"));
  // Late December 2025 (21–31): only 2025-12-18 exists (OUTSIDE the window) —
  // it must NOT be silently substituted.
  const lateDec = resolveScenario("น้ำท่วมปลายเดือนธันวาคม 2568", t, "th");
  assert.equal(lateDec.flood?.hasData, false);
  assert.notEqual(lateDec.flood?.date, "2025-12-18");
  assert.equal(lateDec.layers.length, 0);

  // ── 6 · exact-date and plain-month queries are UNCHANGED ─────────────────
  const exact = resolveScenario("น้ำท่วม 13 ตุลาคม 2568", t, "th");
  assert.equal(exact.flood?.date, "2025-10-13");
  assert.equal(exact.flood?.periodStart, undefined);
  assert.equal(exact.steps.length, 4);
  assert.ok(exact.steps[0].label.includes("stepResolve"));
  assert.ok(!exact.steps[0].label.includes("stepResolvePeriod"));
  const month = resolveScenario("น้ำท่วมตุลาคม 2568", t, "th");
  assert.equal(month.flood?.date, "2025-10-19"); // month → latest in month
  assert.equal(month.flood?.periodStart, undefined);
  assert.equal(month.steps.length, 4);

  // ── 7 · early/mid/late resolution is deterministic ───────────────────────
  assert.deepEqual(periodDayRange("early"), [1, 10]);
  assert.deepEqual(periodDayRange("mid"), [11, 20]);
  assert.deepEqual(periodDayRange("late"), [21, 31]);
  assert.deepEqual(periodCalendarRange("2025-10", "early"), [
    "2025-10-01",
    "2025-10-10",
  ]);
  assert.deepEqual(periodCalendarRange("2025-10", "late"), [
    "2025-10-21",
    "2025-10-31",
  ]);
  // The upper bound clamps to the month's real length (never a fake date).
  assert.equal(daysInMonth("2025-02"), 28);
  assert.deepEqual(periodCalendarRange("2025-02", "late"), [
    "2025-02-21",
    "2025-02-28",
  ]);
  assert.deepEqual(periodCalendarRange("2024-02", "late"), [
    "2024-02-21",
    "2024-02-29", // leap year
  ]);
  // Same input → same output (registry- and clock-independent).
  assert.deepEqual(
    periodCalendarRange("2025-10", "mid"),
    periodCalendarRange("2025-10", "mid"),
  );
  const again = resolveScenario("Flooding occurred in mid-October 2025", t, "en");
  assert.deepEqual(again.flood, scn.flood);
  assert.deepEqual(
    again.steps.map((s) => s.label),
    scn.steps.map((s) => s.label),
  );

  // ── 8 · EN/TH/JP locale-aware date formatting flows into the output ──────
  assert.equal(formatDate("2025-10-11", "en"), "11 October 2025");
  assert.equal(formatDate("2025-10-11", "th"), "11 ตุลาคม 2568"); // Buddhist Era
  assert.equal(formatDate("2025-10-11", "ja"), "2025年10月11日");
  const rangeTh = "11 ตุลาคม 2568 – 20 ตุลาคม 2568";
  const rangeJa = "2025年10月11日 – 2025年10月20日";
  const scnTh = resolveScenario("น้ำท่วมกลางเดือนตุลาคม 2568", t, "th");
  assert.ok(scnTh.steps[0].label.includes(rangeTh));
  assert.ok(scnTh.steps[1].label.includes("19 ตุลาคม 2568"));
  assert.ok(scnTh.result.includes(rangeTh));
  // JP *output* localization (input parsing of 中旬/上旬 is a separate,
  // pre-existing limitation — the UI language is what drives the labels).
  const scnJa = resolveScenario("Flooding occurred in mid-October 2025", t, "ja");
  assert.equal(scnJa.flood?.date, "2025-10-19");
  assert.ok(scnJa.steps[0].label.includes(rangeJa));
  assert.ok(scnJa.steps[1].label.includes("2025年10月19日"));
  assert.ok(scnJa.result.includes(rangeJa));
}
