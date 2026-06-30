// MapLibre paint properties need literal colour strings, but ARCHITECTURE.md
// forbids hardcoding colours in components. So we resolve them from the SAME
// design tokens declared in globals.css at runtime — one source of truth.
import type { LayerId } from "@/types";

/** Map each map layer to a design-token custom property name. */
const LAYER_TOKEN: Record<LayerId | "me", string> = {
  hospitals: "--color-background-primary-default", // pigeon
  flood: "--color-background-info-default", // blue
  buffer: "--color-background-success-default", // green
  boundaries: "--color-border-primary-default",
  me: "--color-background-secondary-default", // illusion
};

export type MapPalette = Record<keyof typeof LAYER_TOKEN, string>;

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
  return {
    hospitals: read(LAYER_TOKEN.hospitals),
    flood: read(LAYER_TOKEN.flood),
    buffer: read(LAYER_TOKEN.buffer),
    boundaries: read(LAYER_TOKEN.boundaries),
    me: read(LAYER_TOKEN.me),
  };
}
