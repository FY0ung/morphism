// Intent → scenario resolution (sections/morphism/const.tsx resolveScenario).
// Locks the CURRENT accepted mapping of the main prompts before refactoring:
// ids, modes, scopes, flood dates, compare targets — and the unknown fallback.
import assert from "node:assert/strict";
import {
  resolveScenario,
  resolveCompareTargets,
} from "@/sections/morphism/const";
import type { TFunction } from "@/languages/types";

// i18n stub: returns the key (labels/text are not under test here).
const t = ((key: string) => key) as unknown as TFunction;

export function run(): void {
  // ── 24-hour hospitals in Bangkok (baseline scenario) ─────────────────────
  const bkk24 = resolveScenario("Show 24-hour hospitals in Bangkok", t, "en");
  assert.equal(bkk24.mode, "points");
  assert.deepEqual(bkk24.hospitalScope, {
    province: "กรุงเทพมหานคร",
    h24: true,
  });
  assert.ok(bkk24.layers.includes("hospitals"));

  // Thai phrasing resolves to the same scope.
  const bkk24th = resolveScenario("โรงพยาบาลเปิด 24 ชั่วโมงในกรุงเทพมหานคร", t, "th");
  assert.equal(bkk24th.hospitalScope?.province, "กรุงเทพมหานคร");
  assert.equal(bkk24th.hospitalScope?.h24, true);

  // ── province count → aggregate scoped to EXACTLY that province ──────────
  const cm = resolveScenario("โรงพยาบาลในจังหวัดเชียงใหม่มีกี่แห่ง", t, "th");
  assert.equal(cm.mode, "aggregate");
  assert.deepEqual(cm.provinceNames, ["เชียงใหม่"]);

  const ay = resolveScenario("จังหวัดพระนครศรีอยุธยามีโรงพยาบาลกี่แห่ง", t, "th");
  assert.deepEqual(ay.provinceNames, ["พระนครศรีอยุธยา"]);

  // ── nationwide ────────────────────────────────────────────────────────────
  const nation = resolveScenario("โรงพยาบาลทั่วประเทศ", t, "th");
  assert.equal(nation.id, "nation");
  assert.equal(nation.mode, "aggregate");
  assert.equal(nation.provinceNames?.length, 77);

  // ── region compare (North vs Northeast) ──────────────────────────────────
  const cmp = resolveScenario("เปรียบเทียบโรงพยาบาลภาคเหนือกับอีสาน", t, "th");
  assert.equal(cmp.id, "cmp");
  assert.equal(cmp.regionCompare, true);
  assert.equal(cmp.aggregate?.length, 2); // one badge per region

  // ── single-date flood: registered date has data ──────────────────────────
  const flood = resolveScenario("น้ำท่วม 13 ตุลาคม 2568", t, "th");
  assert.equal(flood.flood?.date, "2025-10-13");
  assert.equal(flood.flood?.hasData, true);
  assert.ok(flood.layers.includes("flood"));

  // Unregistered date → EXPLICIT empty (hasData false, no layers, no swap).
  const empty = resolveScenario("น้ำท่วม 1 มกราคม 2560", t, "th");
  assert.equal(empty.flood?.hasData, false);
  assert.equal(empty.layers.length, 0);

  // ── date-to-date flood comparison ─────────────────────────────────────────
  const dcmp = resolveScenario(
    "เปรียบเทียบน้ำท่วม 13 ตุลาคม 2568 กับ 14 ตุลาคม 2565",
    t,
    "th",
  );
  assert.equal(dcmp.swipe?.dateA, "2025-10-13");
  assert.equal(dcmp.swipe?.dateB, "2022-10-14");

  // ── year-to-year flood comparison (annual cumulative keys) ───────────────
  const ycmp = resolveScenario("เทียบน้ำท่วม 2565 กับ 2568", t, "th");
  assert.equal(ycmp.swipe?.dateA, "2022-10-20"); // year → latest snapshot
  assert.equal(ycmp.swipe?.dateB, "2025-10-19");
  assert.equal(ycmp.swipe?.keyA, "year-2022");
  assert.equal(ycmp.swipe?.keyB, "year-2025");

  // resolveCompareTargets handles Gregorian years too.
  const targets = resolveCompareTargets("compare flood 2022 vs 2025", t, "en");
  assert.ok(targets);
  assert.equal(targets![0].key, "year-2022");
  assert.equal(targets![1].key, "year-2025");

  // ── unknown/unsupported → explicit unknown, never a random scenario ─────
  const unknown = resolveScenario("สวัสดี วันนี้อากาศดีไหม", t, "th");
  assert.equal(unknown.id, "unknown");
  assert.equal(unknown.mode, "unknown");
  assert.equal(unknown.layers.length, 0);
}
