// Colour-vision data palette (globals.css + lib/data-palette + map-tokens):
// Viridis is ADDITIVE — Default resolves to the exact existing tokens, the
// Viridis tokens are uniquely namespaced, no existing token is renamed or
// redefined, and map + charts + legend read the SAME role variables.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DATA_VIZ_VARS } from "@/lib/data-palette";
import { LAYER_TOKEN } from "@/lib/map-tokens";
import { FLOOD_COMPARE_SIDES } from "@/configs/flood-compare";

const css = readFileSync(
  path.join(process.cwd(), "src", "app", "globals.css"),
  "utf8",
);

/** All definitions of a custom property in the stylesheet. */
const defs = (name: string): string[] =>
  [...css.matchAll(new RegExp(`${name}\\s*:\\s*([^;]+);`, "g"))].map((m) =>
    m[1].trim(),
  );

const VIRIDIS = {
  "--color-vision-viridis-1": "#440154",
  "--color-vision-viridis-2": "#3b528b",
  "--color-vision-viridis-3": "#21918c",
  "--color-vision-viridis-4": "#5ec962",
  "--color-vision-viridis-5": "#fde725",
} as const;

function relLuminance(hex: string): number {
  const c = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(1) + 0.7152 * c(3) + 0.0722 * c(5);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

export function run(): void {
  // ── 1/19. Existing Default tokens unchanged (never renamed/redefined) ────
  // Spot-check the tokens the data roles alias: still defined exactly once
  // in @theme with their original hsla(var(--…)) indirection.
  for (const t of [
    "--color-background-primary-default",
    "--color-background-info-default",
    "--color-background-success-default",
    "--color-background-warning-default",
    "--color-background-error-default",
  ]) {
    const d = defs(t);
    assert.equal(d.length, 1, `${t} must be defined exactly once`);
    assert.match(d[0], /^hsla\(var\(--/, `${t} keeps its original definition`);
  }
  // The raw light/dark HSL triplets still exist (one :root + one .dark def).
  assert.equal(defs("--background-info-default").length, 2);
  assert.equal(defs("--background-primary-default").length, 2);

  // ── 2. Viridis tokens additive + uniquely namespaced + canonical ─────────
  for (const [name, hex] of Object.entries(VIRIDIS)) {
    const d = defs(name);
    assert.equal(d.length, 1, `${name} defined exactly once`);
    assert.equal(d[0].toLowerCase(), hex, `${name} is the canonical sample`);
  }

  // ── 3. Default palette resolves to the EXISTING values ───────────────────
  // The role defaults (first definition, outside any [data-color-vision]
  // block) alias the original tokens 1:1.
  const roleDefault: Record<string, string> = {
    "--data-viz-admin-fill": "--color-background-primary-default",
    "--data-viz-admin-outline": "--color-border-primary-default",
    // Analysis-result markers: default aliases the SAME semantic red used
    // before (the semantic token itself is untouched — asserted below).
    "--data-viz-hospital-highlight": "--color-background-error-default",
    "--data-viz-hospitals": "--color-background-primary-default",
    "--data-viz-flood": "--color-background-info-default",
    "--data-viz-analysis": "--color-background-success-default",
    "--data-viz-compare-a": "--color-background-info-default",
    "--data-viz-compare-b": "--color-background-primary-default",
    "--data-viz-series-1": "--color-background-primary-default",
    "--data-viz-series-2": "--color-background-info-default",
    "--data-viz-series-3": "--color-background-success-default",
    "--data-viz-series-4": "--color-background-warning-default",
  };
  for (const [role, target] of Object.entries(roleDefault)) {
    const d = defs(role);
    assert.ok(d.length >= 2, `${role} has default + viridis definitions`);
    assert.equal(d[0], `var(${target})`, `${role} default aliases ${target}`);
  }

  // ── 4. Viridis palette resolves to the new tokens (light + dark) ─────────
  const lightBlock = css.slice(
    css.indexOf(':root[data-color-vision="viridis"] {'),
    css.indexOf(':root[data-color-vision="viridis"].dark'),
  );
  const darkBlock = css.slice(
    css.indexOf(':root[data-color-vision="viridis"].dark'),
  );
  const inBlock = (block: string, role: string, viridisVar: string) =>
    new RegExp(`${role}\\s*:\\s*var\\(${viridisVar}\\)`).test(block);
  // Light: dark end of the ramp (≥3:1 on the light basemap).
  assert.ok(inBlock(lightBlock, "--data-viz-hospitals", "--color-vision-viridis-1"));
  assert.ok(inBlock(lightBlock, "--data-viz-flood", "--color-vision-viridis-2"));
  assert.ok(inBlock(lightBlock, "--data-viz-analysis", "--color-vision-viridis-3"));
  assert.ok(inBlock(lightBlock, "--data-viz-admin-outline", "--color-vision-viridis-1"));
  assert.ok(inBlock(lightBlock, "--data-viz-admin-area", "--color-vision-viridis-2"));
  assert.ok(inBlock(lightBlock, "--data-viz-hospital-highlight", "--color-vision-viridis-1"));
  // Dark: light end of the ramp.
  assert.ok(inBlock(darkBlock, "--data-viz-hospitals", "--color-vision-viridis-5"));
  assert.ok(inBlock(darkBlock, "--data-viz-flood", "--color-vision-viridis-3"));
  assert.ok(inBlock(darkBlock, "--data-viz-analysis", "--color-vision-viridis-4"));
  assert.ok(inBlock(darkBlock, "--data-viz-admin-outline", "--color-vision-viridis-5"));
  assert.ok(inBlock(darkBlock, "--data-viz-hospital-highlight", "--color-vision-viridis-5"));

  // ── Validity guard: every @theme data-role var carries a CSS-native
  //    fallback to its default-alias token, so a stale bundle can NEVER
  //    resolve a data colour to an empty string (invisible layer/swatch) ────
  const themeFallback: Record<string, string> = {
    "--color-data-hospitals": "--color-background-primary-default",
    "--color-data-flood": "--color-background-info-default",
    "--color-data-analysis": "--color-background-success-default",
    "--color-data-compare-a": "--color-background-info-default",
    "--color-data-compare-b": "--color-background-primary-default",
    "--color-data-admin-fill": "--color-background-primary-default",
    "--color-data-admin-outline": "--color-border-primary-default",
    "--color-data-hospital-highlight": "--color-background-error-default",
  };
  for (const [themeVar, fallbackTok] of Object.entries(themeFallback)) {
    const d = defs(themeVar);
    assert.equal(d.length, 1, `${themeVar} defined once in @theme`);
    assert.match(
      d[0],
      new RegExp(`var\\(--data-viz-[a-z0-9-]+,\\s*var\\(${fallbackTok}\\)\\)`),
      `${themeVar} must fall back to ${fallbackTok}`,
    );
  }
  // Legend swatch: STATIC (Tailwind-detectable) class, same role as the map.
  const legendSrc = readFileSync(
    path.join(
      process.cwd(), "src", "sections", "morphism", "layout", "workspace",
      "legend.tsx",
    ),
    "utf8",
  );
  assert.ok(
    legendSrc.includes("bg-data-hospital-highlight"),
    "legend uses the static hospital-highlight utility (no dynamic class)",
  );

  // ── 14. Legend/map/charts read the SAME palette mapping ──────────────────
  assert.equal(LAYER_TOKEN.hospitals, DATA_VIZ_VARS.hospitals);
  assert.equal(LAYER_TOKEN.flood, DATA_VIZ_VARS.flood);
  assert.equal(LAYER_TOKEN.buffer, DATA_VIZ_VARS.analysis);
  assert.equal(FLOOD_COMPARE_SIDES.a.cssVar, DATA_VIZ_VARS.compareA);
  assert.equal(FLOOD_COMPARE_SIDES.b.cssVar, DATA_VIZ_VARS.compareB);
  // Admin + analysis-result roles: map and legend share the same variables.
  assert.equal(LAYER_TOKEN.boundaries, DATA_VIZ_VARS.adminOutline);
  assert.equal(LAYER_TOKEN.adminFill, DATA_VIZ_VARS.adminFill);
  assert.equal(LAYER_TOKEN.hospitalHighlight, DATA_VIZ_VARS.hospitalHighlight);
  // Semantic danger (UI error status) is NEVER colour-vision-mapped.
  assert.equal(LAYER_TOKEN.danger, "--color-background-error-default");

  // ── 16. Compare A/B distinguishable (≥3:1) in both themes ───────────────
  assert.ok(
    contrast(VIRIDIS["--color-vision-viridis-3"], VIRIDIS["--color-vision-viridis-1"]) >= 3,
    "light compare pair v3↔v1 ≥ 3:1",
  );
  assert.ok(
    contrast(VIRIDIS["--color-vision-viridis-3"], VIRIDIS["--color-vision-viridis-5"]) >= 3,
    "dark compare pair v3↔v5 ≥ 3:1",
  );

  // Lightness order of the ramp is strictly monotone (grayscale-safe).
  const lums = Object.values(VIRIDIS).map(relLuminance);
  for (let i = 1; i < lums.length; i++) {
    assert.ok(lums[i] > lums[i - 1], "viridis lightness strictly increases");
  }
}
