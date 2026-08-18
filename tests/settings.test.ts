// Settings-popover information architecture (configs/settings + locale
// resources): Theme = appearance only; Color Blindness is its own section with
// THREE fully enabled palettes — Default / Viridis / Gray — plus safe
// normalization of the legacy planned "blues" value to "gray".
import assert from "node:assert/strict";
import {
  COLOR_VISION_OPTIONS,
  DEFAULT_COLOR_VISION,
  THEME_OPTIONS,
  normalizeColorVision,
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
      !["colorblind", "viridis", "gray", "blues", "color-blindness"].includes(
        o.value,
      ),
    );
  }

  // ── 2–5. Colour-vision section: order + ALL options enabled ─────────────
  assert.deepEqual(
    COLOR_VISION_OPTIONS.map((o) => o.value),
    ["default", "viridis", "gray"],
    "options are Default / Viridis / Gray (Blues fully replaced)",
  );
  assert.equal(DEFAULT_COLOR_VISION, "default");
  const byValue = Object.fromEntries(
    COLOR_VISION_OPTIONS.map((o) => [o.value, o]),
  );
  assert.equal(byValue.default.disabled, false, "Default must be enabled");
  assert.equal(byValue.viridis.disabled, false, "Viridis must be ENABLED");
  assert.equal(byValue.gray.disabled, false, "Gray must be ENABLED");

  // ── 6. Selection rules: every shipped palette selectable + restorable ────
  assert.equal(selectColorVision("default", "viridis"), "viridis");
  assert.equal(selectColorVision("viridis", "default"), "default");
  assert.equal(selectColorVision("default", "gray"), "gray");
  assert.equal(selectColorVision("gray", "viridis"), "viridis");
  assert.equal(selectColorVision("gray", "default"), "default"); // restore path
  assert.equal(selectColorVision("default", "default"), "default");
  // Unknown values are rejected (stale/foreign persisted values).
  assert.equal(
    selectColorVision("default", "sepia" as ColorVisionMode),
    "default",
  );

  // ── Legacy persistence: "blues" (planned, never shipped) → "gray" ────────
  assert.equal(normalizeColorVision("gray"), "gray");
  assert.equal(normalizeColorVision("viridis"), "viridis");
  assert.equal(normalizeColorVision("default"), "default");
  assert.equal(normalizeColorVision("blues"), "gray", "legacy blues → gray");
  assert.equal(normalizeColorVision("sepia"), "default");
  assert.equal(normalizeColorVision(undefined), "default");
  assert.equal(normalizeColorVision(null), "default");
  assert.equal(normalizeColorVision(42), "default");

  // ── 7. Palette mode lives OUTSIDE the theme model (structural) ───────────
  for (const v of ["default", "viridis", "gray"] as ColorVisionMode[]) {
    const r = selectColorVision(DEFAULT_COLOR_VISION, v);
    assert.ok(["default", "viridis", "gray"].includes(r));
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
      "gray",
      "grayDesc",
    ]) {
      assert.ok(
        typeof cv?.[key] === "string" && cv[key].length > 0,
        `${name}: morphism.colorVision.${key} missing`,
      );
    }
    // No "Blues" remnants anywhere in the section (labels, descs, aria).
    assert.equal(cv.blues, undefined, `${name}: blues key removed`);
    assert.equal(cv.bluesDesc, undefined, `${name}: bluesDesc key removed`);
    for (const v of Object.values(cv)) {
      assert.ok(!/blues/i.test(v), `${name}: no "Blues" text remains ("${v}")`);
    }
    // Palette NAMES stay recognizable across locales — and the visible
    // segment labels stay SHORT (exact names, no parenthetical descriptions
    // that would wrap or clip inside the segmented control).
    assert.equal(cv.viridis, "Viridis", `${name}: short Viridis segment label`);
    assert.equal(cv.gray, "Gray", `${name}: short Gray segment label`);
    for (const key of ["default", "viridis", "gray"]) {
      assert.ok(
        cv[key].length <= 12 && !cv[key].includes("("),
        `${name}: ${key} label short enough for a segment ("${cv[key]}")`,
      );
    }
    // The LONG description carries the "(Monochrome)" qualifier.
    assert.ok(
      cv.grayDesc.includes("Gray") &&
        (cv.grayDesc.includes("Monochrome") || cv.grayDesc.includes("モノクロ")),
      `${name}: grayDesc is the long "Gray (Monochrome)" form`,
    );
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
  assert.equal(ja.morphism.colorVision.grayDesc, "Gray（モノクロ）");
}
