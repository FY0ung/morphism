// CENTRALIZED data-visualization palette (colour-vision support).
//
// Every DATA colour (map layers, chart series, legend swatches, compare
// sides) routes through the `--color-data-*` role variables declared in
// globals.css. In "default" mode each role aliases the EXACT existing design
// token; in "viridis" mode the roles resolve to the canonical Viridis samples
// (theme-aware — see docs/color-vision-viridis.md). UI and semantic tokens
// (success/warning/danger/info as STATUS, backgrounds, text, borders) never
// route through these roles and are unaffected by the colour-vision mode.
//
// Switching modes = flipping ONE dataset attribute on <html>; CSS variables
// re-resolve instantly for every DOM consumer (charts, legends, swatches),
// and the map hook re-reads the same variables and applies them with
// setPaintProperty — no setStyle, no source/layer recreation, no refetch.
import type { ColorVisionMode } from "@/types";
import { readCssColor } from "@/lib/map-tokens";

/** Data-role → CSS custom property (the ONE mapping map+charts+legend share). */
export const DATA_VIZ_VARS = {
  hospitals: "--color-data-hospitals",
  flood: "--color-data-flood",
  analysis: "--color-data-analysis",
  compareA: "--color-data-compare-a",
  compareB: "--color-data-compare-b",
  series1: "--color-data-series-1",
  series2: "--color-data-series-2",
  series3: "--color-data-series-3",
  series4: "--color-data-series-4",
  adminFill: "--color-data-admin-fill",
  adminOutline: "--color-data-admin-outline",
  adminArea: "--color-data-admin-area",
  hospitalHighlight: "--color-data-hospital-highlight",
} as const;

export type DataVisualizationPalette = Record<keyof typeof DATA_VIZ_VARS, string>;

/**
 * Resolve the ACTIVE data palette from the live CSS custom properties (the
 * mode/theme cascade in globals.css is the single source of truth — this
 * never re-implements the mapping in TS). Client-side only.
 */
export function readDataVisualizationPalette(): DataVisualizationPalette {
  const out = {} as Record<keyof typeof DATA_VIZ_VARS, string>;
  (Object.keys(DATA_VIZ_VARS) as (keyof typeof DATA_VIZ_VARS)[]).forEach(
    (k) => {
      out[k] = readCssColor(DATA_VIZ_VARS[k]);
    },
  );
  return out;
}

/**
 * Apply a colour-vision mode to the document. "default" removes the
 * attribute entirely so the default cascade is byte-identical to the
 * pre-colour-vision stylesheet state. Synchronous: computed styles reflect
 * the change immediately, so callers may re-read the palette right after.
 */
export function applyColorVisionMode(mode: ColorVisionMode): void {
  const el = document.documentElement;
  if (mode === "default") delete el.dataset.colorVision;
  else el.dataset.colorVision = mode;
}

/**
 * Resolve the SELECTED administrative-area colour (single-province highlight).
 * Default mode keeps today's per-region CATEGORICAL token (the caller passes
 * its region token var); Viridis mode maps the highlight onto ONE sequential
 * role instead — a categorical→sequential remap per region would falsely
 * imply ranking. This is the ONE place that branches on the mode; components
 * never test colorVision themselves.
 */
export function resolveAdminAreaColor(regionTokenVar: string): string {
  const mode = document.documentElement.dataset.colorVision;
  return readCssColor(
    mode === "viridis" ? DATA_VIZ_VARS.adminArea : regionTokenVar,
  );
}

/**
 * Observe colour-vision mode changes (the <html data-color-vision> attribute).
 * Each map instance subscribes and repaints ITSELF with setPaintProperty —
 * no prop plumbing through hook layers, no setStyle, no data reload. Returns
 * an unsubscribe function. Client-side only.
 */
export function observeColorVisionMode(onChange: () => void): () => void {
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.attributeName === "data-color-vision")) {
      onChange();
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-color-vision"],
  });
  return () => observer.disconnect();
}
