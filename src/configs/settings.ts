// Settings-popover option registries (pure data — no React). Kept out of the
// component so the information architecture is unit-testable:
//   • Theme = APPEARANCE only (dark/light). Colour-vision palettes are a
//     SEPARATE preference (ColorVisionMode) — never a theme value.
//   • Colour-vision: "default" is the existing palette and the only enabled
//     option; "viridis"/"blues" are visible but disabled until their token
//     sets exist.
import type { ColorVisionMode } from "@/types";

/** Appearance themes — dark/light ONLY (next-themes values). */
export const THEME_OPTIONS = [
  {
    value: "dark",
    labelKey: "morphism.theme.dark",
    descKey: "morphism.theme.darkDesc",
  },
  {
    value: "light",
    labelKey: "morphism.theme.light",
    descKey: "morphism.theme.lightDesc",
  },
] as const;

export type ThemeOptionValue = (typeof THEME_OPTIONS)[number]["value"];

export const DEFAULT_COLOR_VISION: ColorVisionMode = "default";

/**
 * Colour-vision palette options ("Color Blindness" section). Rendered as a
 * SEGMENTED control (same pattern as the Language selector) — labelKey is the
 * SHORT in-segment label (must never wrap); descKey carries the long localized
 * description ("CVD-safe" / "Monochrome") surfaced via tooltip + assistive
 * technology together with the Coming Soon status.
 */
export const COLOR_VISION_OPTIONS: {
  value: ColorVisionMode;
  labelKey: string;
  /** Long description for tooltip / screen readers (undefined = none). */
  descKey?: string;
  /** Not yet implemented — rendered with disabled semantics + Coming Soon. */
  disabled: boolean;
}[] = [
  { value: "default", labelKey: "morphism.colorVision.default", disabled: false },
  {
    value: "viridis",
    labelKey: "morphism.colorVision.viridis",
    descKey: "morphism.colorVision.viridisDesc",
    // ENABLED — the Viridis data-palette tokens ship (globals.css); see
    // docs/color-vision-viridis.md.
    disabled: false,
  },
  {
    value: "blues",
    labelKey: "morphism.colorVision.blues",
    descKey: "morphism.colorVision.bluesDesc",
    disabled: true,
  },
];

/**
 * Apply a colour-vision selection: a DISABLED option can never change the
 * current value (defence in depth behind the disabled input — pointer,
 * keyboard and programmatic form submission all funnel through here).
 */
export function selectColorVision(
  current: ColorVisionMode,
  next: ColorVisionMode,
): ColorVisionMode {
  const opt = COLOR_VISION_OPTIONS.find((o) => o.value === next);
  if (!opt || opt.disabled) return current;
  return next;
}
