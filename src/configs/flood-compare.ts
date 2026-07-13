// Single source of truth for the flood year-compare colour mapping.
// Year A (left / earlier in the query) = info-blue; Year B (right) =
// primary-indigo (the closest existing purple-leaning token — `secondary` is
// pink, which the design brief forbids here). Every consumer (map polygons,
// outlines, year labels, legend, donut + bar charts) references THESE existing
// design tokens — no new tokens, no hardcoded hex/rgb. `cssVar` feeds MapLibre
// paint via readCssColor; the utility-class fields feed Tailwind (SVG fill +
// DOM background).
export const FLOOD_COMPARE_SIDES = {
  a: {
    cssVar: "--color-background-info-default",
    fill: "fill-background-info-default",
    bg: "bg-background-info-default",
  },
  b: {
    cssVar: "--color-background-primary-default",
    fill: "fill-background-primary-default",
    bg: "bg-background-primary-default",
  },
} as const;

export type FloodCompareSide = keyof typeof FLOOD_COMPARE_SIDES;
