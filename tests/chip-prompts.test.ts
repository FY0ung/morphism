// "Try asking:" chips + the Japanese date/period ALIASES that let the JP chips
// use natural wording. A chip's LABEL is the message sent through the normal
// assistant flow, so every chip in every locale must resolve — and the three
// lead chips must resolve to the SAME scenarios in EN, TH and JP.
//
// Alias-only contract: Japanese support is spelling (yyyy年M月D日, N月,
// 上旬/中旬/下旬) feeding the EXISTING resolvers. No new scenario, no
// duplicated logic, no chip special-casing.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SUGGESTION_CHIPS, resolveScenario } from "@/sections/morphism/const";
import {
  detectFloodMonth,
  detectMonthPeriod,
  resolveFloodDate,
} from "@/lib/flood-date";
import type { TFunction } from "@/languages/types";
import en from "@/languages/project/en.json";
import th from "@/languages/project/th.json";
import ja from "@/languages/project/ja.json";

type Chips = Record<string, string>;
const chips = {
  en: en.morphism.chips as Chips,
  th: th.morphism.chips as Chips,
  ja: ja.morphism.chips as Chips,
};

/** i18n stub returning the real locale string for a chip key. */
const tFor = (loc: keyof typeof chips) =>
  ((key: string) => chips[loc][key.split(".").pop() as string] ?? key) as unknown as TFunction;

const key = ((k: string) => k) as unknown as TFunction;

export function run(): void {
  // ── Japanese date parsing: yyyy年M月D日 → the SAME canonical date ────────
  assert.deepEqual(resolveFloodDate("2025年10月13日"), {
    matchMode: "exact-date",
    resolvedDate: "2025-10-13",
    year: 2025,
    month: 10,
    day: 13,
  });
  // Identical result to the ISO / Thai / English spellings of that date.
  for (const spelling of [
    "2025-10-13",
    "13 October 2025",
    "13 ตุลาคม 2568",
    "2025年10月13日",
  ]) {
    assert.equal(
      resolveFloodDate(spelling).resolvedDate,
      "2025-10-13",
      `spelling → same canonical date: ${spelling}`,
    );
  }
  // Spacing tolerated; a Buddhist-Era year still normalises.
  assert.equal(resolveFloodDate("2025 年 10 月 13 日").resolvedDate, "2025-10-13");
  assert.equal(resolveFloodDate("2568年10月13日").resolvedDate, "2025-10-13");

  // ── Japanese month + period aliases ─────────────────────────────────────
  assert.equal(detectFloodMonth("10月中旬の洪水"), 10);
  assert.equal(detectFloodMonth("12月の洪水"), 12);
  assert.equal(detectMonthPeriod("10月中旬"), "mid");
  assert.equal(detectMonthPeriod("10月上旬"), "early");
  assert.equal(detectMonthPeriod("10月下旬"), "late");
  // The existing periods are untouched.
  assert.equal(detectMonthPeriod("mid-October"), "mid");
  assert.equal(detectMonthPeriod("กลางเดือนตุลาคม"), "mid");
  assert.equal(detectMonthPeriod("ตุลาคม"), undefined);

  // ── The three lead chips resolve identically in EN / TH / JP ────────────
  const leads = ["morphism.chips.c7", "morphism.chips.c8", "morphism.chips.c6"];
  assert.deepEqual(
    SUGGESTION_CHIPS.slice(0, 3),
    leads,
    "c7 (exact date) → c8 (mid-month) → c6 (5 km hospitals) lead the list",
  );
  const expected = [
    { id: "flood-2025-10-13", check: (s: ReturnType<typeof resolveScenario>) =>
        assert.equal(s.flood?.date, "2025-10-13") },
    { id: "flood-2025-10-19", check: (s: ReturnType<typeof resolveScenario>) =>
        assert.equal(s.flood?.queriedMonth, "2025-10") },
    { id: "buffer5km", check: (s: ReturnType<typeof resolveScenario>) =>
        assert.equal(s.analysis, "flood-buffer") },
  ];
  for (const loc of ["en", "th", "ja"] as const) {
    leads.forEach((k, i) => {
      const label = chips[loc][k.split(".").pop() as string];
      assert.ok(label, `${loc}: ${k} exists`);
      // Resolve the LABEL — exactly what clicking the chip sends.
      const s = resolveScenario(label, key, loc === "ja" ? "ja" : loc);
      assert.equal(s.id, expected[i].id, `${loc} chip ${i + 1} → ${expected[i].id}`);
      expected[i].check(s);
    });
  }

  // ── Every chip in every locale routes somewhere real (never "unknown") ──
  for (const loc of ["en", "th", "ja"] as const) {
    for (const k of SUGGESTION_CHIPS) {
      const label = tFor(loc)(k as "morphism.chips.c1");
      const s = resolveScenario(label, key, loc === "ja" ? "ja" : loc);
      assert.notEqual(s.id, "unknown", `${loc}: chip "${label}" must resolve`);
    }
  }

  // ── Exact chip wording (EN/TH/JP), and identical ORDER across locales ───
  assert.equal(chips.en.c7, "Flooded areas on October 13, 2025");
  assert.equal(chips.en.c8, "Flooding in mid-October");
  assert.equal(chips.en.c6, "Hospitals within 5 kilometers of last week's flood");
  assert.equal(chips.th.c7, "พื้นที่น้ำท่วมวันที่ 13 ตุลาคม 2568");
  assert.equal(chips.th.c8, "น้ำท่วมกลางเดือนตุลาคม");
  assert.equal(chips.th.c6, "โรงพยาบาลภายใน 5 กิโลเมตรจากน้ำท่วมสัปดาห์ที่แล้ว");
  assert.equal(chips.ja.c7, "2025年10月13日の洪水地域");
  assert.equal(chips.ja.c8, "10月中旬の洪水");
  assert.equal(chips.ja.c6, "先週の洪水から5km以内の病院");
  // One shared order list drives all locales (no per-locale ordering).
  for (const loc of ["en", "th", "ja"] as const) {
    for (const k of SUGGESTION_CHIPS) {
      assert.ok(chips[loc][k.split(".").pop() as string], `${loc}: ${k} present`);
    }
  }

  // ── No chip special-casing in the UI: the chip component only sends the
  //    label through the shared onPick handler ─────────────────────────────
  const chipSrc = readFileSync(
    path.join(process.cwd(), "src", "sections", "morphism", "layout", "chat", "suggestion-chips.tsx"),
    "utf8",
  );
  assert.ok(chipSrc.includes("SUGGESTION_CHIPS"), "chips come from the config");
  assert.ok(chipSrc.includes("onPick(label)"), "click sends the label as-is");
  assert.ok(
    !/flood|hospital|2025|10月/i.test(chipSrc),
    "no scenario/date knowledge is hard-coded in the chip component",
  );
}
