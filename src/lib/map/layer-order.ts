// CENTRAL registry of the map's custom layer/source IDs and their stacking
// order (Phase 3C). use-morphism-map installs against these ids and applies
// MORPHISM_LAYER_ORDER after every install/style swap — no other module may
// invent its own copy of an id or an ordering list.
import { FLOOD_HEX_LEVELS } from "@/lib/flood-overview";

/** The `source-layer` name inside every flood PMTiles archive. */
export const PM_SOURCE_LAYER = "flood";
/** PMTiles vector source ids (stable; re-pointed via setUrl, never torn down). */
export const FLOOD_PM = "flood-pm"; // single-date detail
export const FLOOD_A_PM = "flood-a-pm"; // compare side A detail

/** fill+line layer ids for one PMTiles dataset source. */
export const pmLayerIds = (src: string): string[] => [
  `${src}-fill`,
  `${src}-line`,
];

// Compare-side sources on the MAIN map (side A only; side B lives on the swipe
// overlay map). Stable ids — installed once and fed, never torn down/recreated.
export const FLOOD_CMP_A_SOURCES = [
  ...FLOOD_HEX_LEVELS.map((lvl) => `flood-a-${lvl.key}`),
  "flood-a-detail",
] as const;
export const FLOOD_CMP_A_LAYERS: string[] = FLOOD_CMP_A_SOURCES.flatMap((s) => [
  `${s}-fill`,
  `${s}-line`,
]);

/**
 * Bottom→top stacking order of every custom layer. Applied via moveLayer after
 * install and after each theme style swap. Layers missing at apply time are
 * skipped (they may be installed later in a session).
 */
export const MORPHISM_LAYER_ORDER: string[] = [
  // Admin context fills/lines sit low (below flood/points).
  "adm-subdistrict-fill",
  "adm-subdistrict-line",
  "adm-district-fill",
  "adm-district-line",
  // 5 km analysis zone (dissolved buffer around the flood polygons): fill +
  // outline sit UNDER the flood extent so the blue flood data is never
  // obscured — the green zone reads as context around it.
  "buffer",
  "buffer-line",
  // Single-date flood extent (hex overview + detail) sits ABOVE every
  // administrative fill so it can never be hidden behind an admin polygon
  // at any zoom. Overview fills under detail fill; lines above.
  "flood-hex-coarse-fill",
  "flood-hex-medium-fill",
  "flood-hex-fine-fill",
  "flood",
  "flood-hex-coarse-line",
  "flood-hex-medium-line",
  "flood-hex-fine-line",
  "flood-line",
  ...pmLayerIds(FLOOD_PM),
  ...FLOOD_CMP_A_LAYERS,
  ...pmLayerIds(FLOOD_A_PM),
  "hospitals",
  // Count labels stay on top so numbers are never hidden by fills/points.
  "agg-count",
  "adm-district-label",
  "adm-summary-count",
];

type MaplibreMap = import("maplibre-gl").Map;

/** Apply the canonical stacking order (skips layers not installed yet). */
export function applyMorphismLayerOrder(m: MaplibreMap): void {
  MORPHISM_LAYER_ORDER.forEach((id) => {
    if (m.getLayer(id)) m.moveLayer(id);
  });
}
