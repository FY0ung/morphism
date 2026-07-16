// Japanese intent resolution: the same canonical scenarios must resolve from
// Japanese queries, with EN/TH regression + the Japanese unknown fallback.
// Root cause fixed: the parser matched only Thai/English keywords, so every
// Japanese query fell through to scnUnknown. Japanese aliases + full-width
// normalization now live in configs/intent-keywords.ts.
import assert from "node:assert/strict";
import { resolveScenario } from "@/sections/morphism/const";
import { normalizeQuery } from "@/configs/intent-keywords";
import { formatDate } from "@/lib/flood-date";
import type { TFunction } from "@/languages/types";

// i18n stub: returns the key (localized text is asserted at runtime, not here).
const t = ((key: string) => key) as unknown as TFunction;

/** Assert a query resolves to the shared flood-buffer analysis scenario. */
function assertBuffer(query: string): void {
  const s = resolveScenario(query, t, "ja");
  assert.equal(s.id, "buffer5km", `expected buffer5km for: ${query}`);
  assert.equal(s.mode, "analysis");
  assert.equal(s.analysis, "flood-buffer");
  assert.deepEqual(s.layers, ["flood", "hospitals"]);
  assert.equal(s.steps.length, 5);
  assert.equal(s.result, ""); // result is ALWAYS the live runtime outcome
}

export function run(): void {
  // 1. Exact Japanese query (the reported failing case).
  assertBuffer("洪水地域から5km以内の病院");

  // 2. Japanese using 浸水 (inundation) instead of 洪水.
  assertBuffer("浸水地域から5km以内の病院");

  // 3. Japanese using 5キロ (katakana kilometres) instead of "5km".
  assertBuffer("洪水地域から5キロ以内の病院");

  // 4. No-space + natural variations must all reach the same intent.
  for (const q of [
    "洪水区域から5km以内の病院",
    "洪水エリアの周辺5km以内にある病院",
    "洪水地域の近くにある病院", // near, no explicit distance
    "洪水地域から半径5km以内の病院", // radius
    "浸水エリアの周辺にある病院から5キロメートル以内",
  ]) {
    assertBuffer(q);
  }

  // Full-width digits/letters fold to half-width (５ｋｍ → 5km).
  assertBuffer("洪水地域から５ｋｍ以内の病院");
  assert.equal(normalizeQuery("洪水地域から５ｋｍ以内の病院"), "洪水地域から5km以内の病院");
  // Thai must NOT be altered by normalization (NFKC would decompose ำ).
  assert.equal(normalizeQuery("น้ำท่วม"), "น้ำท่วม");

  // 5. English + Thai regression → the SAME canonical scenario.
  for (const q of [
    "Hospitals within 5 km of flood areas",
    "โรงพยาบาลภายในรัศมี 5 กม. จากพื้นที่น้ำท่วม",
  ]) {
    const s = resolveScenario(q, t, "en");
    assert.equal(s.id, "buffer5km", `regression failed for: ${q}`);
    assert.equal(s.analysis, "flood-buffer");
  }

  // 6. Unsupported Japanese queries still return the (Japanese) unknown fallback.
  for (const q of ["こんにちは、今日の天気はどうですか？", "好きな食べ物は何ですか"]) {
    const s = resolveScenario(q, t, "ja");
    assert.equal(s.id, "unknown", `expected unknown for: ${q}`);
    assert.equal(s.mode, "unknown");
    assert.equal(s.layers.length, 0);
  }

  // 7. The Japanese response uses the RUNTIME date + count: the scenario bakes
  //    neither (result === ""); the date is rendered with Japanese formatting.
  assert.equal(formatDate("2025-12-18", "ja"), "2025年12月18日");
}
