// MapLibre paint properties need literal colour strings, but ARCHITECTURE.md
// forbids hardcoding colours in components. So we resolve them from the SAME
// design tokens declared in globals.css at runtime — one source of truth.
import type { LayerId } from "@/types";

/** Map each map layer to a design-token custom property name.
 *  DATA layers (hospitals/flood/buffer) read the colour-vision DATA-ROLE
 *  variables (globals.css): in default mode those alias the exact original
 *  tokens; in viridis mode they resolve to the Viridis samples. Boundaries
 *  (categorical admin context) and semantic danger stay on their original
 *  tokens in every mode. Exported for the palette-consistency tests. */
export const LAYER_TOKEN: Record<
  LayerId | "adminFill" | "hospitalHighlight" | "me" | "danger",
  string
> = {
  hospitals: "--color-data-hospitals",
  flood: "--color-data-flood",
  buffer: "--color-data-analysis",
  boundaries: "--color-data-admin-outline",
  adminFill: "--color-data-admin-fill",
  // Hospitals INSIDE the 5 km analysis radius — a DATA result role (default
  // aliases the semantic error red exactly; viridis maps it onto the ramp).
  hospitalHighlight: "--color-data-hospital-highlight",
  me: "--color-background-secondary-default", // illusion
  // Semantic danger/error red — used to highlight the hospitals INSIDE the 5 km
  // analysis radius (the flood-buffer result set); resolves per theme so
  // contrast holds in both light and dark. NEVER colour-vision-mapped.
  danger: "--color-background-error-default",
};

export type MapPalette = Record<keyof typeof LAYER_TOKEN, string>;

/** Per-role fallback token (the SAME token the role's default aliases in
 *  globals.css). Read only when the data-role variable resolves EMPTY — which
 *  can happen when a stale dev bundle predates the role declarations. An
 *  empty string would be an invalid MapLibre paint value (invisible layer),
 *  so the bridge falls back to the default-mode token and reports loudly in
 *  dev instead of failing silently. */
const LAYER_TOKEN_FALLBACK: Partial<Record<keyof typeof LAYER_TOKEN, string>> = {
  hospitals: "--color-background-primary-default",
  flood: "--color-background-info-default",
  buffer: "--color-background-success-default",
  boundaries: "--color-border-primary-default",
  adminFill: "--color-background-primary-default",
  hospitalHighlight: "--color-background-error-default",
};

/**
 * Read computed token colours from <html>. Custom properties are returned with
 * var() already substituted, so `--color-...` resolves to a usable hsla() string.
 * Must run client-side after mount (needs the document).
 */
/**
 * Read a single CSS custom property as a MapLibre-parseable colour string.
 * Tokens resolve to `hsla(H, S%, L%)` (no alpha); MapLibre rejects the 3-arg
 * `hsla(...)`, so normalise to `hsl(...)`. Must run client-side (needs document).
 */
export function readCssColor(varName: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim()
    .replace(/^hsla\(/, "hsl(");
}

export function readMapPalette(): MapPalette {
  const cs = getComputedStyle(document.documentElement);
  // Tokens resolve to `hsla(H, S%, L%)` (no alpha). MapLibre's colour parser
  // treats `hsla(...)` as requiring 4 components and rejects the 3-arg form, so
  // normalise to `hsl(...)`, which it parses — otherwise the paint colour is
  // invalid and the layer never draws.
  const read = (token: string) =>
    cs.getPropertyValue(token).trim().replace(/^hsla\(/, "hsl(");
  // VALIDITY GUARD: a data-role that resolves empty (stale bundle missing the
  // role declarations) must never reach MapLibre as an invalid paint value.
  // Fall back to the default-mode token and assert loudly in dev.
  const readRole = (key: keyof typeof LAYER_TOKEN): string => {
    const value = read(LAYER_TOKEN[key]);
    if (value) return value;
    const fallback = LAYER_TOKEN_FALLBACK[key];
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[map-tokens] ${LAYER_TOKEN[key]} resolved EMPTY — falling back to ` +
          `${fallback ?? "(none)"}. The stylesheet is likely stale; restart ` +
          `the dev server / clear .next.`,
      );
    }
    return fallback ? read(fallback) : value;
  };
  return {
    hospitals: readRole("hospitals"),
    flood: readRole("flood"),
    buffer: readRole("buffer"),
    boundaries: readRole("boundaries"),
    adminFill: readRole("adminFill"),
    hospitalHighlight: readRole("hospitalHighlight"),
    me: readRole("me"),
    danger: readRole("danger"),
  };
}
