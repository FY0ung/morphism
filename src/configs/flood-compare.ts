// Single source of truth for the flood year-compare colour mapping.
// Year A (left / earlier in the query) = info-blue; Year B (right) =
// primary-indigo (the closest existing purple-leaning token — `secondary` is
// pink, which the design brief forbids here). Every consumer (map polygons,
// outlines, year labels, legend, donut + bar charts) references THESE existing
// design tokens — no new tokens, no hardcoded hex/rgb. `cssVar` feeds MapLibre
// paint via readCssColor; the utility-class fields feed Tailwind (SVG fill +
// DOM background).
// Colour-vision aware: both sides route through the DATA-ROLE variables
// (globals.css). Default mode aliases the ORIGINAL tokens (info-blue /
// primary-indigo) exactly; viridis mode resolves to two widely separated
// Viridis samples per theme. Same vars feed MapLibre (cssVar) and Tailwind
// utilities (fill/bg), so map, charts and legend can never disagree.
export const FLOOD_COMPARE_SIDES = {
  a: {
    cssVar: "--color-data-compare-a",
    fill: "fill-data-compare-a",
    bg: "bg-data-compare-a",
  },
  b: {
    cssVar: "--color-data-compare-b",
    fill: "fill-data-compare-b",
    bg: "bg-data-compare-b",
  },
} as const;

export type FloodCompareSide = keyof typeof FLOOD_COMPARE_SIDES;
