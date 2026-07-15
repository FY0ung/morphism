// i18n coverage: Japanese resource completeness + typed-key parity, locale
// fallback/switch resolution, and Japanese date formatting. Pure (no React) so
// it runs under the zero-dependency runner.
import assert from "node:assert/strict";
import en from "@/languages/project/en.json";
import th from "@/languages/project/th.json";
import ja from "@/languages/project/ja.json";
import { resolveUiLang, UI_LANGS } from "@/lib/locale";
import { formatDate, formatMonth } from "@/lib/flood-date";

type Json = { [k: string]: string | Json };

/** Flatten a nested resource to sorted "a.b.c" leaf-key paths. */
function keyPaths(o: Json, prefix = ""): string[] {
  const out: string[] = [];
  for (const k of Object.keys(o)) {
    const kp = prefix ? `${prefix}.${k}` : k;
    const v = o[k];
    if (v && typeof v === "object") out.push(...keyPaths(v, kp));
    else out.push(kp);
  }
  return out.sort();
}

function getLeaf(o: Json, path: string): string {
  return path.split(".").reduce<unknown>((a, k) => (a as Json)[k], o) as string;
}

/** Sorted interpolation vars ({{x}}) of a string, for parity checks. */
function vars(s: string): string {
  return (s.match(/{{(.*?)}}/g) ?? []).sort().join(",");
}

export function run(): void {
  // ── resource completeness: ja mirrors th (the typed source) exactly ──────
  const thKeys = keyPaths(th as unknown as Json);
  const jaKeys = keyPaths(ja as unknown as Json);
  const enKeys = keyPaths(en as unknown as Json);

  assert.deepEqual(
    jaKeys,
    thKeys,
    "ja.json must have EXACTLY the same keys as th.json (the typed source)",
  );
  // en is kept in lockstep too (existing contract preserved).
  assert.deepEqual(enKeys, thKeys, "en.json and th.json keys must stay in sync");

  // ── every ja value is a non-empty string (no missing translations) ───────
  for (const k of jaKeys) {
    const v = getLeaf(ja as unknown as Json, k);
    assert.equal(typeof v, "string", `ja.${k} must be a string`);
    assert.ok(v.trim().length > 0, `ja.${k} must not be empty`);
  }

  // ── interpolation-var parity: {{vars}} identical across all three locales ─
  for (const k of thKeys) {
    const tv = vars(getLeaf(th as unknown as Json, k));
    const jv = vars(getLeaf(ja as unknown as Json, k));
    const ev = vars(getLeaf(en as unknown as Json, k));
    assert.equal(jv, tv, `ja.${k} interpolation vars must match th.${k}`);
    assert.equal(ev, tv, `en.${k} interpolation vars must match th.${k}`);
  }

  // ── locale resolution: switch + persistence + unknown-locale fallback ────
  assert.deepEqual([...UI_LANGS], ["en", "th", "ja"]);
  assert.equal(resolveUiLang("en"), "en");
  assert.equal(resolveUiLang("th"), "th");
  assert.equal(resolveUiLang("ja"), "ja");
  // Unknown / missing values fall back to English (never a broken locale).
  assert.equal(resolveUiLang("fr"), "en");
  assert.equal(resolveUiLang(undefined), "en");
  assert.equal(resolveUiLang(null), "en");
  assert.equal(resolveUiLang("JP"), "en"); // display label is not a locale code

  // ── Japanese date formatting (Gregorian, 年月日) ─────────────────────────
  assert.equal(formatDate("2025-12-18", "ja"), "2025年12月18日");
  assert.equal(formatDate("2025-10-13", "ja"), "2025年10月13日");
  assert.equal(formatMonth("2025-12", "ja"), "2025年12月");
  // EN / TH date formatting unchanged (regression guard).
  assert.equal(formatDate("2025-12-18", "en"), "18 December 2025");
  assert.equal(formatDate("2025-10-13", "th"), "13 ตุลาคม 2568");

  // ── current buffer-demo result renders naturally in Japanese ─────────────
  // Mirrors how the view interpolates t("morphism.scenario.buffer.result").
  const bufferTpl = getLeaf(ja as unknown as Json, "morphism.scenario.buffer.result");
  const rendered = bufferTpl
    .replace("{{count}}", "2")
    .replace("{{date}}", formatDate("2025-12-18", "ja"));
  assert.ok(
    rendered.includes("2025年12月18日") && rendered.includes("2か所"),
    "ja buffer result must state the JP date and hospital count",
  );
  // No leaked English source words (units like "km" are allowed).
  assert.ok(
    !/hospital|flood|within|found/i.test(rendered),
    "ja buffer result must not leak English words",
  );

  // The compact selector label for ja is "JP" (locale code stays `ja`).
  assert.equal(
    getLeaf(ja as unknown as Json, "morphism.chips.c6"),
    "洪水地域から5km以内の病院",
  );
}
