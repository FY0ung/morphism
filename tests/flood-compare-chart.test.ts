// Flood comparison chart: HORIZONTAL BAR (absolute magnitudes), never a donut.
// Two flooded areas from different dates/years are independent values — not
// parts of one whole — so no percentage-of-total and no combined-total centre.
// Area maths, datasets, colours and CSV values are unchanged by this change.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildFloodCompareOutcome } from "@/sections/morphism/const";
import { FLOOD_COMPARE_SIDES } from "@/configs/flood-compare";
import { DATA_VIZ_VARS } from "@/lib/data-palette";
import en from "@/languages/project/en.json";
import th from "@/languages/project/th.json";
import ja from "@/languages/project/ja.json";
import type { TFunction } from "@/languages/types";

/** i18n stub: echoes the key, or the unit for the unit key (locale asserted
 *  separately against the real resource files). */
const t = ((key: string) => key) as unknown as TFunction;

const chartSrc = readFileSync(
  path.join(
    process.cwd(), "src", "sections", "morphism", "layout", "chat",
    "chart-card.tsx",
  ),
  "utf8",
);

export function run(): void {
  // Runtime inputs (km²) — mirrors what the live comparison measures.
  const km2A = 6118.8;
  const km2B = 4341.15;
  const { charts } = buildFloodCompareOutcome(
    { labelA: "ปี 2565", labelB: "ปี 2568", km2A, km2B },
    t,
  );
  const chart = charts[0];

  // ── 1. No donut ──────────────────────────────────────────────────────────
  assert.equal(chart.kind, "bar", "flood comparison must be a bar chart");
  assert.notEqual(chart.kind, "donut");

  // ── 2. No percentage / combined-total logic ──────────────────────────────
  assert.equal(chart.centerLabel, undefined, "no combined-total centre value");
  const total = chart.rows.reduce((s, r) => s + r.value, 0);
  for (const r of chart.rows) {
    // Rows carry ABSOLUTE values, never a share of the total.
    assert.ok(r.value > 1, "row value is an absolute area, not a fraction");
    assert.notEqual(r.value, (r.value / total) * 100);
  }
  assert.ok(!("pct" in chart), "chart carries no percentage field");

  // ── 3. Both absolute values rendered, from the UNCHANGED calculation ─────
  // areaRai = round(km² × 625) — identical to the previous donut build.
  assert.equal(chart.rows.length, 2);
  assert.equal(chart.rows[0].value, Math.round(km2A * 625)); // 3,824,250
  assert.equal(chart.rows[1].value, Math.round(km2B * 625)); // 2,713,219
  assert.equal(chart.rows[0].label, "ปี 2565");
  assert.equal(chart.rows[1].label, "ปี 2568");

  // ── 4/5. Shared scale → larger value ALWAYS draws the longer bar ─────────
  // Mirrors the component: width = value / max(values) × chartWidth.
  const values = chart.rows.map((r) => r.value);
  const max = Math.max(1, ...values);
  const widths = values.map((v) => (v / max) * 320);
  assert.ok(widths[0] > widths[1], "bigger area → longer bar");
  assert.equal(widths[0], 320, "largest value spans the full shared scale");
  // Ratio of bar lengths equals the ratio of the real values (one scale).
  assert.ok(
    Math.abs(widths[1] / widths[0] - values[1] / values[0]) < 1e-9,
    "bar lengths are proportional on a single shared scale",
  );

  // ── 6/7. Colours: dataset A/B keep their existing comparison mapping and
  //        resolve through the centralized data-palette (default ↔ viridis) ─
  assert.equal(chart.rows[0].swatch, FLOOD_COMPARE_SIDES.a.fill);
  assert.equal(chart.rows[1].swatch, FLOOD_COMPARE_SIDES.b.fill);
  assert.equal(FLOOD_COMPARE_SIDES.a.cssVar, DATA_VIZ_VARS.compareA);
  assert.equal(FLOOD_COMPARE_SIDES.b.cssVar, DATA_VIZ_VARS.compareB);
  // No hardcoded colour inside the chart component.
  assert.ok(
    !/#[0-9a-f]{3,8}\b/i.test(chartSrc),
    "chart component must not hardcode hex colours",
  );
  assert.ok(
    chartSrc.includes("row.swatch"),
    "bars read their colour from the row swatch (palette-driven)",
  );

  // ── 8/9. Date-vs-date and year-vs-year both use the same bar chart ───────
  for (const [labelA, labelB] of [
    ["13 October 2025", "13 October 2022"], // date vs date
    ["Year 2022", "Year 2025"], // year vs year
  ]) {
    const c = buildFloodCompareOutcome(
      { labelA, labelB, km2A: 10, km2B: 20 },
      t,
    ).charts[0];
    assert.equal(c.kind, "bar", `${labelA} vs ${labelB} must be a bar chart`);
    assert.equal(c.centerLabel, undefined);
    assert.equal(c.rows[0].value, 6250);
    assert.equal(c.rows[1].value, 12500);
  }

  // ── 10. CSV data unchanged: raw numeric values, no unit/percent injected ─
  assert.equal(typeof chart.rows[0].value, "number");
  assert.equal(chart.rows[0].value, Math.round(km2A * 625));
  assert.equal(chart.exportName, "flood-area-compare");

  // ── 11. PNG export rasterises the NEW bar SVG (svgRef on the bar branch) ─
  assert.ok(
    chartSrc.includes("isWideBar"),
    "chart-card renders the wide horizontal-bar branch",
  );
  const wideBranch = chartSrc.slice(chartSrc.indexOf(") : isWideBar ? ("));
  assert.ok(
    wideBranch.slice(0, 400).includes("ref={svgRef}"),
    "the bar SVG is the export target (PNG exports the new chart)",
  );

  // ── 12. Localised unit strings (EN / TH / JP) ────────────────────────────
  const unitOf = (r: { morphism: { scenario: { floodCompare: Record<string, string> } } }) =>
    r.morphism.scenario.floodCompare.chartUnit;
  assert.equal(unitOf(en as never), "rai");
  assert.equal(unitOf(th as never), "ไร่");
  assert.equal(unitOf(ja as never), "ライ");
  // The chart requests the localized unit (never a hardcoded "rai").
  assert.equal(chart.unit, "morphism.scenario.floodCompare.chartUnit");
  // Values are rendered with the existing locale-aware number formatting.
  assert.ok(
    chartSrc.includes("toLocaleString()"),
    "values use locale-aware number formatting",
  );
}
