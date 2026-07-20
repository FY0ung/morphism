// Settings-popover information architecture (configs/settings + locale
// resources): Theme = appearance only; Color Blindness is its own section
// with one enabled option (Default) and two disabled ones (Viridis/Blues).
import assert from "node:assert/strict";
import {
  COLOR_VISION_OPTIONS,
  DEFAULT_COLOR_VISION,
  THEME_OPTIONS,
  selectColorVision,
} from "@/configs/settings";
import type { ColorVisionMode } from "@/types";
import en from "@/languages/project/en.json";
import th from "@/languages/project/th.json";
import ja from "@/languages/project/ja.json";

export function run(): void {
  // ── 1. Theme contains ONLY dark + light (appearance modes) ───────────────
  assert.deepEqual(
    THEME_OPTIONS.map((o) => o.value),
    ["dark", "light"],
    "Theme must contain only Dark and Light",
  );
  // No colour-vision value may ever be modelled as a theme.
  for (const o of THEME_OPTIONS) {
    assert.ok(
      !["colorblind", "viridis", "blues", "color-blindness"].includes(o.value),
    );
  }

  // ── 2–5. Colour-vision section: order + enabled/disabled states ──────────
  assert.deepEqual(
    COLOR_VISION_OPTIONS.map((o) => o.value),
    ["default", "viridis", "blues"],
  );
  assert.equal(DEFAULT_COLOR_VISION, "default");
  const byValue = Object.fromEntries(
    COLOR_VISION_OPTIONS.map((o) => [o.value, o]),
  );
  assert.equal(byValue.default.disabled, false, "Default must be enabled");
  assert.equal(byValue.viridis.disabled, false, "Viridis must be ENABLED");
  assert.equal(byValue.blues.disabled, true, "Blues must be disabled");

  // ── 6. Selection rules: Viridis selectable; Blues (disabled) never is ───
  assert.equal(selectColorVision("default", "viridis"), "viridis");
  assert.equal(selectColorVision("viridis", "default"), "default"); // exact restore path
  assert.equal(selectColorVision("default", "blues"), "default");
  assert.equal(selectColorVision("viridis", "blues"), "viridis");
  assert.equal(selectColorVision("default", "default"), "default");
  // Unknown values are rejected too (stale/foreign persisted values).
  assert.equal(
    selectColorVision("default", "sepia" as ColorVisionMode),
    "default",
  );

  // ── 7. Palette mode lives OUTSIDE the theme model (structural) ───────────
  // selectColorVision never returns a theme value, and THEME_OPTIONS carries
  // no palette entries (asserted above) — switching dark/light goes through
  // next-themes and cannot touch ColorVisionMode state.
  for (const v of ["default", "viridis", "blues"] as ColorVisionMode[]) {
    const r = selectColorVision(DEFAULT_COLOR_VISION, v);
    assert.ok(["default", "viridis", "blues"].includes(r));
  }

  // ── Segmented control contract: SHORT in-segment labels (no wrapping) +
  //    the long description moved to *Desc keys for tooltip/screen readers ──
  for (const opt of COLOR_VISION_OPTIONS) {
    if (opt.value !== "default") {
      assert.ok(opt.descKey, `${opt.value}: palette segment needs a descKey`);
    }
  }

  // ── 8–9. Locale resources: all keys present in EN/TH/JP, no fallbacks ────
  const locales = { en, th, ja } as const;
  for (const [name, res] of Object.entries(locales)) {
    const cv = (res as typeof en).morphism.colorVision as Record<string, string>;
    for (const key of [
      "title",
      "default",
      "viridis",
      "viridisDesc",
      "blues",
      "bluesDesc",
      "comingSoon",
    ]) {
      assert.ok(
        typeof cv?.[key] === "string" && cv[key].length > 0,
        `${name}: morphism.colorVision.${key} missing`,
      );
    }
    // Palette NAMES stay recognizable across locales — and the visible
    // segment labels stay SHORT (exact names, no parenthetical descriptions
    // that would wrap or clip inside the segmented control).
    assert.equal(cv.viridis, "Viridis", `${name}: short Viridis segment label`);
    assert.equal(cv.blues, "Blues", `${name}: short Blues segment label`);
    for (const key of ["default", "viridis", "blues"]) {
      assert.ok(
        cv[key].length <= 12 && !cv[key].includes("("),
        `${name}: ${key} label short enough for a segment ("${cv[key]}")`,
      );
    }
    // Theme section: appearance keys only — the old colour-blindness card
    // keys must be gone.
    const theme = (res as typeof en).morphism.theme as Record<string, string>;
    assert.ok(theme.dark && theme.light, `${name}: theme dark/light present`);
    for (const gone of ["colorblind", "colorblindDesc", "comingSoon"]) {
      assert.equal(theme[gone], undefined, `${name}: theme.${gone} removed`);
    }
  }
  // Localized (not English-fallback) strings for TH/JP where translated.
  assert.equal(th.morphism.colorVision.title, "การมองเห็นสี");
  assert.equal(ja.morphism.colorVision.title, "色覚サポート");
  assert.equal(th.morphism.colorVision.default, "ค่าเริ่มต้น");
  assert.equal(ja.morphism.colorVision.default, "デフォルト");
  assert.notEqual(th.morphism.colorVision.comingSoon, en.morphism.colorVision.comingSoon);
  assert.notEqual(ja.morphism.colorVision.comingSoon, en.morphism.colorVision.comingSoon);
}
