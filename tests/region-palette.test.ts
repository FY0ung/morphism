// Categorical region palette: the six Thai regions must stay visually
// DISTINCT in every colour-vision mode (they are categories, not a sequence).
// Default keeps the exact original tokens; Viridis/Gray map each region to a
// stable discrete class by IDENTITY — never by count. Map fills, chart bars
// and legend swatches all resolve from the same centralized mapping.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  REGION_BG,
  REGION_FILL,
  REGION_TOKEN_VAR,
  REGIONS,
} from "@/configs/geography";
import { resolveScenario } from "@/sections/morphism/const";
import type { TFunction } from "@/languages/types";

const t = ((k: string) => k) as unknown as TFunction;
const css = readFileSync(
  path.join(process.cwd(), "src", "app", "globals.css"),
  "utf8",
);
const viewSrc = readFileSync(
  path.join(process.cwd(), "src", "sections", "morphism", "view", "morphism-view.tsx"),
  "utf8",
);

const THAI_REGIONS = ["กลาง", "เหนือ", "อีสาน", "ใต้", "ตะวันออก", "ตะวันตก"];
const ROLE_KEYS = ["central", "north", "northeast", "south", "east", "west"];

/** All definitions of a custom property in the stylesheet. */
const defs = (name: string): string[] =>
  [...css.matchAll(new RegExp(`${name}\\s*:\\s*([^;]+);`, "g"))].map((m) =>
    m[1].trim(),
  );

function relLuminance(hex: string): number {
  const c = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(1) + 0.7152 * c(3) + 0.0722 * c(5);
}

export function run(): void {
  // ── 1/2. Default: six DISTINCT region roles, aliasing the EXACT original
  //         tokens (declaration values unchanged) ──────────────────────────
  assert.deepEqual(Object.keys(REGION_TOKEN_VAR).sort(), [...THAI_REGIONS].sort());
  assert.equal(new Set(Object.values(REGION_TOKEN_VAR)).size, 6, "6 distinct role vars");
  const expectedDefaultAlias: Record<string, string> = {
    "--data-viz-region-central": "--color-background-primary-default",
    "--data-viz-region-north": "--color-background-success-default",
    "--data-viz-region-northeast": "--color-background-secondary-default",
    "--data-viz-region-south": "--color-background-error-default",
    "--data-viz-region-east": "--color-background-info-default",
    "--data-viz-region-west": "--color-background-warning-default",
  };
  for (const [role, original] of Object.entries(expectedDefaultAlias)) {
    const d = defs(role);
    assert.ok(d.length >= 3, `${role} has default + viridis + gray definitions`);
    assert.equal(d[0], `var(${original})`, `${role} default aliases ${original} exactly`);
  }
  // The @theme role vars fall back to the same original tokens (stale-bundle safe).
  for (const [role, original] of Object.entries(expectedDefaultAlias)) {
    const themeVar = role.replace("--data-viz-", "--color-data-");
    assert.match(
      defs(themeVar)[0],
      new RegExp(`var\\(${role},\\s*var\\(${original}\\)\\)`),
      `${themeVar} falls back to ${original}`,
    );
  }
  // Original default tokens themselves are untouched (defined once, hsla form).
  for (const orig of Object.values(expectedDefaultAlias)) {
    const d = defs(orig);
    assert.equal(d.length, 1, `${orig} still defined exactly once`);
    assert.match(d[0], /^hsla\(var\(--/, `${orig} keeps its original definition`);
  }

  // ── 3/8. Viridis: six distinct discrete samples, none collapse ───────────
  const VIRIDIS_CAT = {
    "--color-vision-viridis-cat-1": "#440154",
    "--color-vision-viridis-cat-2": "#414487",
    "--color-vision-viridis-cat-3": "#2a788e",
    "--color-vision-viridis-cat-4": "#22a884",
    "--color-vision-viridis-cat-5": "#7ad151",
    "--color-vision-viridis-cat-6": "#fde725",
  } as const;
  for (const [name, hex] of Object.entries(VIRIDIS_CAT)) {
    const d = defs(name);
    assert.equal(d.length, 1, `${name} defined exactly once`);
    assert.equal(d[0].toLowerCase(), hex, `${name} canonical viridis 6-class sample`);
  }
  assert.equal(new Set(Object.values(VIRIDIS_CAT)).size, 6, "viridis: 6 unique");

  // ── 4/7. Gray: six distinct achromatic classes, luminance-monotone ───────
  const GRAY_CAT = {
    "--color-vision-gray-cat-1": "#1a1a1a",
    "--color-vision-gray-cat-2": "#454545",
    "--color-vision-gray-cat-3": "#6e6e6e",
    "--color-vision-gray-cat-4": "#969696",
    "--color-vision-gray-cat-5": "#c0c0c0",
    "--color-vision-gray-cat-6": "#e8e8e8",
  } as const;
  for (const [name, hex] of Object.entries(GRAY_CAT)) {
    const d = defs(name);
    assert.equal(d.length, 1, `${name} defined exactly once`);
    assert.equal(d[0].toLowerCase(), hex);
    assert.ok(
      hex.slice(1, 3) === hex.slice(3, 5) && hex.slice(3, 5) === hex.slice(5, 7),
      `${name} is achromatic`,
    );
  }
  assert.equal(new Set(Object.values(GRAY_CAT)).size, 6, "gray: 6 unique");
  const grayLums = Object.values(GRAY_CAT).map(relLuminance);
  for (let i = 1; i < grayLums.length; i++) {
    assert.ok(grayLums[i] > grayLums[i - 1], "gray classes strictly lighten");
  }

  // ── 5. Stable mapping by IDENTITY: each region role → its fixed class in
  //      both palette blocks (independent of any count/value) ───────────────
  const viridisBlock = css.slice(
    css.indexOf(':root[data-color-vision="viridis"] {'),
    css.indexOf(':root[data-color-vision="viridis"].dark'),
  );
  const grayBlock = css.slice(
    css.indexOf(':root[data-color-vision="gray"] {'),
    css.indexOf(':root[data-color-vision="gray"].dark'),
  );
  ROLE_KEYS.forEach((key, i) => {
    assert.match(
      viridisBlock,
      new RegExp(
        `--data-viz-region-${key}\\s*:\\s*var\\(--color-vision-viridis-cat-${i + 1}\\)`,
      ),
      `viridis: region ${key} fixed to cat-${i + 1}`,
    );
    assert.match(
      grayBlock,
      new RegExp(
        `--data-viz-region-${key}\\s*:\\s*var\\(--color-vision-gray-cat-${i + 1}\\)`,
      ),
      `gray: region ${key} fixed to cat-${i + 1}`,
    );
  });
  // Uniqueness per mode: 6 assigned classes, no repeats → nothing collapses.
  for (const [label, block, fam] of [
    ["viridis", viridisBlock, "viridis"],
    ["gray", grayBlock, "gray"],
  ] as const) {
    const assigned = [
      ...block.matchAll(
        new RegExp(
          `--data-viz-region-[a-z]+\\s*:\\s*var\\((--color-vision-${fam}-cat-\\d)`,
          "g",
        ),
      ),
    ].map((m) => m[1]);
    assert.equal(assigned.length, 6, `${label}: all six regions assigned`);
    assert.equal(new Set(assigned).size, 6, `${label}: six UNIQUE classes`);
  }

  // ── 6. Map, chart and legend resolve from the SAME mapping ───────────────
  // Map path: REGION_TOKEN_VAR role vars; chart/legend: fill-/bg- utilities of
  // the SAME roles — key-aligned across all three records.
  for (const rg of THAI_REGIONS) {
    const role = REGION_TOKEN_VAR[rg].replace("--color-data-region-", "");
    assert.equal(REGION_FILL[rg], `fill-data-region-${role}`, `${rg} fill aligned`);
    assert.equal(REGION_BG[rg], `bg-data-region-${role}`, `${rg} bg aligned`);
  }
  // Nationwide chart rows carry the region category swatches (not one colour).
  const nation = resolveScenario("How many hospitals nationwide in total?", t, "en");
  assert.equal(nation.id, "nation");
  const rows = nation.charts?.[0]?.rows ?? [];
  assert.equal(rows.length, Object.keys(REGIONS).length);
  const swatches = rows.map((r) => r.swatch);
  assert.ok(swatches.every(Boolean), "every nation bar has a region swatch");
  assert.equal(new Set(swatches).size, 6, "six DISTINCT bar swatches");
  for (const s of swatches) {
    assert.ok(
      Object.values(REGION_FILL).includes(s as string),
      "bar swatch comes from the shared REGION_FILL mapping",
    );
  }
  // Region-compare donut + legend use the same records (source-level).
  const cmp = resolveScenario("Compare hospitals: North vs Northeast", t, "en");
  assert.equal(cmp.charts?.[0]?.rows[0]?.swatch, REGION_FILL["เหนือ"]);
  assert.equal(cmp.charts?.[0]?.rows[1]?.swatch, REGION_FILL["อีสาน"]);

  // ── 9. Mode switching restores default exactly: the default cascade is the
  //      role's own alias (attribute removed ⇒ overrides vanish) ────────────
  // Structural: overrides live ONLY under [data-color-vision] selectors.
  const beforeViridis = css.slice(0, css.indexOf(':root[data-color-vision="viridis"]'));
  for (const key of ROLE_KEYS) {
    assert.ok(
      !new RegExp(`--data-viz-region-${key}\\s*:\\s*var\\(--color-vision`).test(
        beforeViridis,
      ),
      `region ${key}: no palette sample leaks into the default cascade`,
    );
  }

  // ── 10. Multi-region map draws are categorical in every mode ─────────────
  assert.ok(
    viewSrc.includes("activeRegions.length > 1"),
    "nationwide (multi-region) boundary draw uses the categorical path",
  );
}
