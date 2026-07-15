"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readMapPalette, readCssColor } from "@/lib/map-tokens";
import { diagRegisterMap, diagUnregisterMap } from "@/lib/dev-diagnostics";
import { FLOOD_COMPARE_SIDES } from "@/configs/flood-compare";
import { ensurePmtilesProtocol } from "@/lib/map/pmtiles";
import {
  applyMorphismLayerOrder,
  FLOOD_A_PM,
  FLOOD_CMP_A_LAYERS,
  FLOOD_PM,
  PM_SOURCE_LAYER,
  pmLayerIds,
} from "@/lib/map/layer-order";
import {
  FLOOD_DETAIL_MIN_ZOOM,
  FLOOD_HEX_LEVELS,
  type FloodHexOverview,
} from "@/lib/flood-overview";
import { getMapZoomBand, isPointBand, usesAdm2, usesAdm3 } from "@/lib/map-zoom";
import type {
  FeatureCollection,
  LayerId,
  LayersState,
  MapCamera,
  MapBounds,
  ProvinceCount,
  ProvinceBoundaryFC,
} from "@/types";

// Live prefers-reduced-motion (re-read at each camera move — Phase 4D).
import { isReducedMotion } from "@/lib/reduced-motion";

type MaplibreMap = import("maplibre-gl").Map;
type Expr = import("maplibre-gl").ExpressionSpecification;
// Per-feature region colour — the view sets `color` (resolved from an existing
// design token) on every province feature before this layer is shown.
const ADM_COLOR = ["get", "color"] as unknown as Expr;
// Properties are opaque to the renderer (setData only), so the layer data is
// kept generic — any resource FC (FloodFC, HospitalFC…) is assignable here.
type LayerData = Record<LayerId, FeatureCollection<unknown>>;

// Basemap styles + initial camera live in configs/map.ts (single source);
// re-exported here for backwards compatibility with existing importers.
export {
  BASEMAP_STYLE,
  DARK_BASEMAP_STYLE,
  LIGHT_BASEMAP_STYLE,
} from "@/configs/map";
import { basemapStyleFor as styleFor, INITIAL_CENTER, INITIAL_ZOOM } from "@/configs/map";

// Initial source payload handed to MapLibre — keep the default props shape so it
// satisfies maplibre's GeoJsonProperties. (LayerData inputs stay generic.)
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * Per-year data for the flood swipe-compare: the SAME zoom LOD as the rest of
 * the app — progressively finer HEX aggregations as you zoom. Each LOD is fed
 * ONCE per compare session into its own source; MapLibre's minzoom/maxzoom pick
 * which resolution renders, so zooming and dragging never re-upload geometry.
 * (The old per-frame vertical geometry clip + setData is gone — the divider is
 * pure CSS clipping of the overlay map, see use-flood-compare-overlay.)
 */
export interface FloodCompareData {
  coarse: FeatureCollection<unknown>;
  medium: FeatureCollection<unknown>;
  fine: FeatureCollection<unknown>;
}

// Layer/source IDs + stacking order live in the CENTRAL registry
// (lib/map/layer-order) — imported above, never re-declared here.

// Single overview marker (z < 6) — the focused dataset's TOTAL count at its
// count-weighted centroid. Mirrors the HTML `summaryFeature()`.
function summaryFC(provinces: ProvinceCount[] | null): FeatureCollection {
  if (!provinces || !provinces.length) return EMPTY;
  let total = 0;
  let sx = 0;
  let sy = 0;
  for (const p of provinces) {
    total += p.count;
    sx += p.center[0] * p.count;
    sy += p.center[1] * p.count;
  }
  const coordinates: [number, number] =
    total > 0 ? [sx / total, sy / total] : [provinces[0].center[0], provinces[0].center[1]];
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { count: total }, geometry: { type: "Point", coordinates } },
    ],
  };
}

const ANALYSIS_LAYERS = ["hospitals", "flood", "buffer", "boundaries"] as const;

interface UseMorphismMapArgs {
  layers: LayersState;
  data?: Partial<LayerData>;
  /** Active UI theme; the map basemap follows it ("dark" | "light"). */
  theme?: string;
  /** Popup body (HTML) for a clicked hospital point — built with i18n by the view. */
  hospitalPopupHtml?: (name: string, h24: boolean) => string;
}

/**
 * Initialises MapLibre and keeps its analysis layers in sync with React state.
 * The basemap follows the UI theme; on theme change the style is swapped and all
 * custom sources/layers + current scenario data are re-installed (camera kept).
 */
export function useMorphismMap({
  layers,
  data,
  theme,
  hospitalPopupHtml,
}: UseMorphismMapArgs) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  // Latest popup formatter (read at click time so it always uses current i18n).
  const hospitalPopupRef = useRef(hospitalPopupHtml);
  useEffect(() => {
    hospitalPopupRef.current = hospitalPopupHtml;
  }, [hospitalPopupHtml]);

  // Zoom-gating + current scenario state, kept in refs so they survive a style
  // swap (setStyle wipes custom sources/layers; we re-feed from these).
  const hospitalsDesiredRef = useRef(false);
  // Analysis-result mode (e.g. hospitals within 5 km of flood): the point set
  // IS the result, so points render at ANY zoom — the z≥11 gate would hide the
  // answer after the camera fits nationwide result bounds.
  const pointsAlwaysRef = useRef(false);
  const aggregateActiveRef = useRef(false);
  const boundariesActiveRef = useRef(false);
  // Region-compare mode: region-coloured boundaries + ONE count label per region,
  // always visible (not zoom-banded); hospital points + summary/district hidden.
  const compareActiveRef = useRef(false);
  const layersRef = useRef<LayersState>(layers);
  const dataRef = useRef<Partial<LayerData> | undefined>(data);
  const aggRef = useRef<ProvinceCount[] | null>(null);
  const admRef = useRef<ProvinceBoundaryFC | null>(null);
  // Analysis center point(s) — survives a theme style swap via this ref.
  const bufferCentersRef = useRef<FeatureCollection<unknown> | null>(null);
  const appliedStyleRef = useRef<string>(styleFor(theme));
  // Camera duration multiplier — 1 normally; the view lowers it while an
  // undo/redo replays a scene so history steps use SHORTER flights than a new
  // analysis (Phase 4C). Never affects data flow, only animation time.
  const cameraFactorRef = useRef(1);
  const setCameraFactor = useCallback((f: number) => {
    cameraFactorRef.current = f;
  }, []);
  // Multi-level admin aggregation (ADM2 district / ADM3 subdistrict), fed by the
  // useAdminHierarchy hook. Kept in refs so they survive a theme style swap.
  const districtDataRef = useRef<FeatureCollection<unknown> | null>(null);
  const subdistrictDataRef = useRef<FeatureCollection<unknown> | null>(null);
  // Manual "Administrative boundaries" layer data (real admin hierarchy).
  const adminBoundariesRef = useRef<FeatureCollection<unknown> | null>(null);
  const districtActiveRef = useRef(false);
  const subdistrictActiveRef = useRef(false);
  // Flood year-compare: side A (info-blue) is drawn on the MAIN map as hex-LOD
  // + viewport-detail layers; side B lives on the swipe OVERLAY map (see
  // use-flood-compare-overlay), whose container the divider clips with pure
  // CSS. Kept in refs so a theme style swap re-installs the same data.
  const floodCmpARef = useRef<FloodCompareData | null>(null);
  const floodCmpActiveRef = useRef(false);
  // High-zoom REAL detail cropped to the current viewport (fetched on demand by
  // the view, debounced on moveend). Viewport-only, so memory stays bounded
  // regardless of dataset size. GEOJSON-FALLBACK path only.
  const floodCmpDetailARef = useRef<FeatureCollection<unknown> | null>(null);
  // PMTiles URLs (pmtiles mode): single-date detail + compare side A detail.
  // Kept in refs so a theme style swap re-installs the same vector sources.
  const floodPmUrlRef = useRef<string | null>(null);
  const floodCmpAPmUrlRef = useRef<string | null>(null);
  // Low-zoom flood hex OVERVIEWS (coarse/medium/fine) derived from the active
  // date dataset — swapped by zoom band so flooding stays legible when zoomed
  // out. Kept in refs so it survives a theme style swap; active only for a
  // date-based flood scenario (never for the mock songkran/buffer flood).
  const floodOverviewRef = useRef<FloodHexOverview | null>(null);
  const floodOverviewActiveRef = useRef(false);

  const setData = (m: MaplibreMap, id: string, fc: FeatureCollection<unknown>) => {
    const src = m.getSource(id);
    if (src && "setData" in src) {
      (src as { setData: (d: FeatureCollection<unknown>) => void }).setData(fc);
    }
  };

  // Create-or-repoint one PMTiles vector dataset. The source id is STABLE: it
  // is added once and re-pointed with setUrl on later sessions/dates — sources
  // and layers are never torn down and recreated during interaction.
  const ensurePmDataset = (
    m: MaplibreMap,
    src: string,
    url: string,
    color: string,
    fillOpacity: number,
  ) => {
    const existing = m.getSource(src) as unknown as
      | { setUrl?: (u: string) => void }
      | undefined;
    if (existing) {
      existing.setUrl?.(url);
    } else {
      m.addSource(src, { type: "vector", url });
    }
    if (!m.getLayer(`${src}-fill`)) {
      m.addLayer({
        id: `${src}-fill`,
        type: "fill",
        source: src,
        "source-layer": PM_SOURCE_LAYER,
        minzoom: FLOOD_DETAIL_MIN_ZOOM,
        paint: { "fill-color": color, "fill-opacity": fillOpacity },
        layout: { visibility: "none" },
      });
      m.addLayer({
        id: `${src}-line`,
        type: "line",
        source: src,
        "source-layer": PM_SOURCE_LAYER,
        minzoom: FLOOD_DETAIL_MIN_ZOOM,
        paint: { "line-color": color, "line-width": 1, "line-opacity": 0.85 },
        layout: { visibility: "none" },
      });
      // Slot under the marker/label layers when they exist (mid-session add):
      // flood tiles ABOVE the circle fill but UNDER the dashed radius outline.
      if (m.getLayer("buffer-line")) {
        m.moveLayer(`${src}-fill`, "buffer-line");
        m.moveLayer(`${src}-line`, "buffer-line");
      }
    }
  };

  // Reconcile hospital-point vs multi-level aggregation visibility against the
  // live zoom, following the HTML's band model + activeLevelIdx exactly:
  //   z<6 summary · 6–8.5 province counts · 8.5–11 district counts · ≥11 points
  //   (+ ADM2/ADM3 boundary context from their load-zoom upward).
  const applyZoomGating = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    const set = (id: string, on: boolean) => {
      if (m.getLayer(id))
        m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };

    // ── Flood extent is NEVER zoom-gated ──────────────────────────────────────
    // The single-date flood fill/line follow ONLY the flood toggle (and are
    // hidden while the per-year compare layers take over). This runs on every
    // "zoom" event, so re-asserting here guarantees the active flood polygons
    // stay visible at zoom 5, 6, 7 … — the hospital zoom-band model below must
    // never touch them.
    // NOTE: flood detail + hex-overview visibility is intentionally NOT touched
    // here. It follows only the flood toggle (set in the layer-sync effect /
    // commit), and which detail-vs-overview resolution renders is decided
    // declaratively by each layer's minzoom/maxzoom — so zooming never calls
    // setLayoutProperty on the flood layers and never causes flicker.

    // Region-compare: region boundaries + one count label per region, ALWAYS on
    // (intent-driven, not zoom-banded); no points, no summary, no ADM2/ADM3.
    if (compareActiveRef.current) {
      set("adm-fill", boundariesActiveRef.current);
      set("adm-line", boundariesActiveRef.current);
      set("agg-count", aggregateActiveRef.current);
      [
        "hospitals",
        "adm-summary-count",
        "adm-district-label",
        "adm-district-fill",
        "adm-district-line",
        "adm-subdistrict-fill",
        "adm-subdistrict-line",
      ].forEach((id) => set(id, false));
      return;
    }

    // The ONE shared zoom-band rule (getMapZoomBand) drives everything below.
    const band = getMapZoomBand(m.getZoom());
    const pointZoom = isPointBand(band); // z ≥ 11
    const adm2Zoom = usesAdm2(band); // z ≥ 8.5
    const adm3Zoom = usesAdm3(band); // z ≥ 12
    // District aggregation takes over from province once ADM2 data is ready.
    const districtReady = districtActiveRef.current && adm2Zoom;

    // Points ONLY at z ≥ 11 ("points"/"adm3-context"). Below that the filtered
    // points feed the counts but are never rendered — EXCEPT in analysis-result
    // mode, where the points are the answer and show at any zoom.
    const showPoints =
      hospitalsDesiredRef.current && (pointZoom || pointsAlwaysRef.current);
    // Count labels: province in "adm1" (and "adm2" until districts load),
    // district in "adm2" once ready, single total in "summary".
    const showProvCount =
      aggregateActiveRef.current &&
      (band === "adm1" || (band === "adm2" && !districtReady));
    const showDistCount = band === "adm2" && districtReady;
    const showSummary = aggregateActiveRef.current && band === "summary";

    // Boundary context: province fill in non-point bands, outline always;
    // district/subdistrict fills+lines as context from their load-band upward.
    const showProvFill = boundariesActiveRef.current && !pointZoom;
    const showProvLine = boundariesActiveRef.current;
    const showDistCtx = districtActiveRef.current && adm2Zoom;
    const showSubCtx = subdistrictActiveRef.current && adm3Zoom;

    set("hospitals", showPoints);
    set("agg-count", showProvCount);
    set("adm-district-label", showDistCount);
    set("adm-summary-count", showSummary);
    set("adm-fill", showProvFill);
    set("adm-line", showProvLine);
    set("adm-district-fill", showDistCtx);
    set("adm-district-line", showDistCtx);
    set("adm-subdistrict-fill", showSubCtx);
    set("adm-subdistrict-line", showSubCtx);
  }, []);

  // Fine-hex ↔ detail hand-off for compare side A. While the viewport detail
  // is absent (still fetching, or zoomed below the band) the FINE hex extends
  // past FLOOD_DETAIL_MIN_ZOOM so the side never goes blank; once real detail
  // has features the fine hex hands back to its normal band. Runs only when
  // detail presence flips (event-driven) — NEVER per frame.
  const applyFloodCmpDetailRange = useCallback((m: MaplibreMap) => {
    const fine = FLOOD_HEX_LEVELS.find((l) => l.key === "fine");
    if (!fine) return;
    // PMTiles detail (URL set) counts as "detail available" — tiles stream per
    // viewport, so the fine hex keeps its normal band and never doubles up.
    const hasDetail =
      Boolean(floodCmpDetailARef.current?.features.length) ||
      Boolean(floodCmpAPmUrlRef.current);
    const maxZoom = hasDetail ? fine.maxZoom : 24;
    ["flood-a-fine-fill", "flood-a-fine-line"].forEach((id) => {
      if (m.getLayer(id)) m.setLayerZoomRange(id, fine.minZoom, maxZoom);
    });
  }, []);

  // (Re)install every custom source + layer, then re-feed the current scenario
  // data. Called on first style load AND after each theme style swap. Colours
  // are read fresh from the design tokens so they follow the active theme.
  const installLayers = useCallback(
    (m: MaplibreMap) => {
      const palette = readMapPalette();
      // Side-A compare colour (resolved fresh so it follows the theme). Side B's
      // colour is resolved by the overlay-map hook.
      const floodColorA = readCssColor(FLOOD_COMPARE_SIDES.a.cssVar);

      // addLayer is guarded so a re-install (theme swap) never throws on a
      // layer that somehow survived; sources guarded the same way.
      const addLayer = (spec: Parameters<MaplibreMap["addLayer"]>[0]) => {
        if (!m.getLayer(spec.id)) m.addLayer(spec);
      };

      ANALYSIS_LAYERS.forEach((id) => {
        if (!m.getSource(id)) m.addSource(id, { type: "geojson", data: EMPTY });
      });
      // Manual "Administrative boundaries" toggle — REAL admin hierarchy fed by
      // use-admin-boundaries (region / province / district / subdistrict by
      // zoom band). Region view carries a per-feature `color` (region token);
      // the other levels fall back to the boundaries palette token. Line width
      // steps down with the level so subdistricts stay a hairline.
      const boundaryColor = [
        "coalesce",
        ["get", "color"],
        palette.boundaries,
      ] as unknown as Expr;
      const boundaryWidth = [
        "match",
        ["get", "level"],
        "region",
        1.6,
        "province",
        1.4,
        "district",
        1,
        "subdistrict",
        0.6,
        1.5,
      ] as unknown as Expr;
      // Soft fill ONLY for the region view (features carrying a region colour);
      // province/district/subdistrict render as outlines.
      const boundaryFillOpacity = [
        "case",
        ["has", "color"],
        0.14,
        0,
      ] as unknown as Expr;
      addLayer({
        id: "boundaries-fill",
        type: "fill",
        source: "boundaries",
        paint: {
          "fill-color": boundaryColor,
          "fill-opacity": boundaryFillOpacity,
        },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "boundaries",
        type: "line",
        source: "boundaries",
        paint: {
          "line-color": boundaryColor,
          "line-width": boundaryWidth,
          "line-opacity": 0.9,
        },
        layout: { visibility: "none" },
      });
      // DETAIL flood (original geometry) — only from FLOOD_DETAIL_MIN_ZOOM up,
      // where the polygons are large enough to perceive. Below that the overview
      // layers below take over.
      addLayer({
        id: "flood",
        type: "fill",
        source: "flood",
        minzoom: FLOOD_DETAIL_MIN_ZOOM,
        paint: { "fill-color": palette.flood, "fill-opacity": 0.3 },
        layout: { visibility: "none" },
      });
      // Blue flood outline (same source as the fill).
      addLayer({
        id: "flood-line",
        type: "line",
        source: "flood",
        minzoom: FLOOD_DETAIL_MIN_ZOOM,
        paint: { "line-color": palette.flood, "line-width": 1, "line-opacity": 0.85 },
        layout: { visibility: "none" },
      });

      // ── OVERVIEW flood hexes — THREE resolutions swapped by zoom band ─────────
      // Bigger hexes the further you zoom out (coarse < z5, medium 5–6, fine
      // 6–detail). minzoom/maxzoom (maxzoom exclusive) make exactly ONE resolution
      // visible at any zoom — no gaps, no doubled fills. Same flood token colour;
      // resolution changes through geographic cell size, never colour.
      FLOOD_HEX_LEVELS.forEach((lvl) => {
        const src = `flood-hex-${lvl.key}`;
        if (!m.getSource(src)) m.addSource(src, { type: "geojson", data: EMPTY });
        addLayer({
          id: `${src}-fill`,
          type: "fill",
          source: src,
          minzoom: lvl.minZoom,
          maxzoom: lvl.maxZoom,
          paint: {
            "fill-color": palette.flood,
            "fill-opacity": lvl.fillOpacity,
            // Same-token outline blends adjacent hexes into one distribution.
            "fill-outline-color": palette.flood,
          },
          layout: { visibility: "none" },
        });
        addLayer({
          id: `${src}-line`,
          type: "line",
          source: src,
          minzoom: lvl.minZoom,
          maxzoom: lvl.maxZoom,
          paint: {
            // Subtle hairline — NOT thick borders that make cells look like icons.
            "line-color": palette.flood,
            "line-width": lvl.lineWidth,
            "line-opacity": 0.6,
          },
          layout: { visibility: "none" },
        });
      });

      // ── Flood year-compare layers (side A on the MAIN map only) ─────────────
      // Side A = info-blue hex LODs + viewport detail, banded by minzoom/maxzoom
      // exactly like the single-date view — data is fed ONCE per session, so
      // zooming/dragging never re-uploads geometry. Side B is rendered by the
      // swipe overlay map (use-flood-compare-overlay) and revealed by pure CSS
      // clipping — it has NO layers here.
      FLOOD_HEX_LEVELS.forEach((lvl) => {
        const src = `flood-a-${lvl.key}`;
        if (!m.getSource(src)) m.addSource(src, { type: "geojson", data: EMPTY });
        addLayer({
          id: `${src}-fill`,
          type: "fill",
          source: src,
          minzoom: lvl.minZoom,
          maxzoom: lvl.maxZoom,
          paint: {
            "fill-color": floodColorA,
            "fill-opacity": 0.32,
            "fill-outline-color": floodColorA,
          },
          layout: { visibility: "none" },
        });
        addLayer({
          id: `${src}-line`,
          type: "line",
          source: src,
          minzoom: lvl.minZoom,
          maxzoom: lvl.maxZoom,
          paint: {
            "line-color": floodColorA,
            "line-width": lvl.lineWidth,
            "line-opacity": 0.6,
          },
          layout: { visibility: "none" },
        });
      });
      if (!m.getSource("flood-a-detail"))
        m.addSource("flood-a-detail", { type: "geojson", data: EMPTY });
      addLayer({
        id: "flood-a-detail-fill",
        type: "fill",
        source: "flood-a-detail",
        minzoom: FLOOD_DETAIL_MIN_ZOOM,
        paint: { "fill-color": floodColorA, "fill-opacity": 0.32 },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "flood-a-detail-line",
        type: "line",
        source: "flood-a-detail",
        minzoom: FLOOD_DETAIL_MIN_ZOOM,
        paint: { "line-color": floodColorA, "line-width": 1.2, "line-opacity": 0.9 },
        layout: { visibility: "none" },
      });

      // PMTiles vector datasets (single-date + compare side A) — re-installed
      // after a theme style swap from the URL refs; colours re-read from the
      // active theme's tokens.
      if (floodPmUrlRef.current)
        ensurePmDataset(m, FLOOD_PM, floodPmUrlRef.current, palette.flood, 0.3);
      if (floodCmpAPmUrlRef.current)
        ensurePmDataset(m, FLOOD_A_PM, floodCmpAPmUrlRef.current, floodColorA, 0.32);
      // 5 km ANALYSIS RADIUS — true geodesic circle(s) around the selected
      // flood cluster center(s). Translucent green fill sits UNDER the flood
      // layers (blue flood stays readable); the dashed outline + the center
      // marker render ABOVE the flood, under the hospital points.
      addLayer({
        id: "buffer",
        type: "fill",
        source: "buffer",
        paint: { "fill-color": palette.buffer, "fill-opacity": 0.16 },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "buffer-line",
        type: "line",
        source: "buffer",
        paint: {
          "line-color": palette.buffer,
          "line-width": 2,
          "line-dasharray": [2, 2],
          "line-opacity": 0.9,
        },
        layout: { visibility: "none" },
      });
      // Analysis CENTER marker: hollow green ring + solid inner dot.
      if (!m.getSource("buffer-center"))
        m.addSource("buffer-center", { type: "geojson", data: EMPTY });
      addLayer({
        id: "buffer-center-ring",
        type: "circle",
        source: "buffer-center",
        paint: {
          "circle-radius": 9,
          "circle-opacity": 0, // hollow — only the stroke ring is visible
          "circle-stroke-width": 2,
          "circle-stroke-color": palette.buffer,
        },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "buffer-center",
        type: "circle",
        source: "buffer-center",
        paint: {
          "circle-radius": 3.5,
          "circle-color": palette.buffer,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": readCssColor("--color-background-default-default"),
        },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "hospitals",
        type: "circle",
        source: "hospitals",
        paint: {
          "circle-radius": 5,
          // Clean solid marker — the Design System primary token only.
          "circle-color": palette.hospitals,
          // Stroke matches the fill (primary) so the dot reads as solid; no
          // pink/red/secondary outline.
          "circle-stroke-width": 1.5,
          "circle-stroke-color": palette.hospitals,
        },
        layout: { visibility: "none" },
      });

      // Real province polygons (fetched GeoJSON): fill + line under the labels.
      if (!m.getSource("adm")) m.addSource("adm", { type: "geojson", data: EMPTY });
      addLayer({
        id: "adm-fill",
        type: "fill",
        source: "adm",
        paint: { "fill-color": ADM_COLOR, "fill-opacity": 0.12 },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "adm-line",
        type: "line",
        source: "adm",
        paint: {
          "line-color": ADM_COLOR,
          "line-width": 1.5,
          "line-blur": 0.6,
          "line-opacity": 0.9,
        },
        layout: { visibility: "none" },
      });

      // ── ADM2 district level (z ≥ 8.5): fill + line context + count labels ──
      const admLineColor = readCssColor("--color-border-primary-default");
      const admFillColor = readCssColor("--color-background-primary-default");
      if (!m.getSource("adm-district"))
        m.addSource("adm-district", { type: "geojson", data: EMPTY });
      addLayer({
        id: "adm-district-fill",
        type: "fill",
        source: "adm-district",
        paint: { "fill-color": admFillColor, "fill-opacity": 0.06 },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "adm-district-line",
        type: "line",
        source: "adm-district",
        paint: { "line-color": admLineColor, "line-width": 1.4, "line-opacity": 0.65 },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "adm-district-label",
        type: "symbol",
        source: "adm-district",
        layout: {
          "text-field": "{count}",
          "text-font": ["Open Sans Semibold", "Open Sans Regular"],
          "text-size": 13,
          "text-allow-overlap": true,
          visibility: "none",
        },
        paint: {
          "text-color": readCssColor("--color-text-default-default"),
          "text-halo-color": readCssColor("--color-background-default-default"),
          "text-halo-width": 1.6,
        },
      });

      // ── ADM3 subdistrict level (z ≥ 12): boundary CONTEXT only, no labels ──
      if (!m.getSource("adm-subdistrict"))
        m.addSource("adm-subdistrict", { type: "geojson", data: EMPTY });
      addLayer({
        id: "adm-subdistrict-fill",
        type: "fill",
        source: "adm-subdistrict",
        paint: { "fill-color": admFillColor, "fill-opacity": 0.04 },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "adm-subdistrict-line",
        type: "line",
        source: "adm-subdistrict",
        paint: { "line-color": admLineColor, "line-width": 1, "line-opacity": 0.55 },
        layout: { visibility: "none" },
      });

      // Plain numeric aggregation labels (no circle/badge).
      if (!m.getSource("agg")) m.addSource("agg", { type: "geojson", data: EMPTY });
      addLayer({
        id: "agg-count",
        type: "symbol",
        source: "agg",
        layout: {
          "text-field": "{count}",
          "text-font": ["Open Sans Semibold", "Open Sans Regular"],
          "text-size": 14,
          "text-allow-overlap": true,
          visibility: "none",
        },
        paint: {
          "text-color": readCssColor("--color-text-default-default"),
          "text-halo-color": readCssColor("--color-background-default-default"),
          "text-halo-width": 1.6,
        },
      });

      // Single overview total (z < 6) — larger label at the dataset centroid.
      if (!m.getSource("adm-summary"))
        m.addSource("adm-summary", { type: "geojson", data: EMPTY });
      addLayer({
        id: "adm-summary-count",
        type: "symbol",
        source: "adm-summary",
        layout: {
          "text-field": "{count}",
          "text-font": ["Open Sans Semibold", "Open Sans Regular"],
          "text-size": 22,
          "text-allow-overlap": true,
          visibility: "none",
        },
        paint: {
          "text-color": readCssColor("--color-text-default-default"),
          "text-halo-color": readCssColor("--color-background-default-default"),
          "text-halo-width": 2,
        },
      });

      // Canonical stacking order — ONE registry (lib/map/layer-order).
      applyMorphismLayerOrder(m);

      // Re-feed current scenario data (survives the style swap).
      if (dataRef.current) {
        (Object.keys(dataRef.current) as LayerId[]).forEach((id) => {
          const fc = dataRef.current?.[id];
          if (fc) setData(m, id, fc);
        });
      }
      setData(m, "adm", admRef.current ?? EMPTY);
      setData(m, "boundaries", adminBoundariesRef.current ?? EMPTY);
      setData(m, "adm-district", districtDataRef.current ?? EMPTY);
      setData(m, "adm-subdistrict", subdistrictDataRef.current ?? EMPTY);
      setData(m, "buffer-center", bufferCentersRef.current ?? EMPTY);
      FLOOD_HEX_LEVELS.forEach((lvl) =>
        setData(m, `flood-hex-${lvl.key}`, floodOverviewRef.current?.[lvl.key] ?? EMPTY),
      );
      // Compare side A data survives a theme style swap too.
      FLOOD_HEX_LEVELS.forEach((lvl) =>
        setData(m, `flood-a-${lvl.key}`, floodCmpARef.current?.[lvl.key] ?? EMPTY),
      );
      setData(m, "flood-a-detail", floodCmpDetailARef.current ?? EMPTY);
      applyFloodCmpDetailRange(m);
      setData(m, "agg", {
        type: "FeatureCollection",
        features: (aggRef.current ?? []).map((p) => ({
          type: "Feature",
          properties: { count: p.count, name: p.name },
          geometry: { type: "Point", coordinates: p.center },
        })),
      });
      setData(m, "adm-summary", summaryFC(aggRef.current));

      // Re-apply non-hospital layer visibility, then the zoom gate.
      (Object.keys(layersRef.current) as LayerId[]).forEach((id) => {
        if (id === "hospitals") return;
        if (m.getLayer(id))
          m.setLayoutProperty(
            id,
            "visibility",
            layersRef.current[id].visible ? "visible" : "none",
          );
      });
      // Compare mode: show the per-year layers and hide the single flood layer;
      // otherwise flood-line follows the flood toggle and compare layers hide.
      const cmp = floodCmpActiveRef.current;
      const setVis = (id: string, on: boolean) => {
        if (m.getLayer(id))
          m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      };
      FLOOD_CMP_A_LAYERS.forEach((id) => setVis(id, cmp));
      pmLayerIds(FLOOD_A_PM).forEach((id) =>
        setVis(id, cmp && Boolean(floodCmpAPmUrlRef.current)),
      );
      // Single-date flood detail: pmtiles layers when a URL is committed, the
      // geojson layers otherwise — never both.
      const pmSingle = Boolean(floodPmUrlRef.current);
      pmLayerIds(FLOOD_PM).forEach((id) =>
        setVis(id, !cmp && pmSingle && layersRef.current.flood.visible),
      );
      setVis("flood", cmp || pmSingle ? false : layersRef.current.flood.visible);
      setVis("flood-line", cmp || pmSingle ? false : layersRef.current.flood.visible);
      // Overview hexes follow the flood toggle too (active only for date
      // scenarios); MapLibre's minzoom/maxzoom pick which resolution renders.
      const overviewOn =
        floodOverviewActiveRef.current &&
        !cmp &&
        layersRef.current.flood.visible;
      FLOOD_HEX_LEVELS.forEach((lvl) => {
        setVis(`flood-hex-${lvl.key}-fill`, overviewOn);
        setVis(`flood-hex-${lvl.key}-line`, overviewOn);
      });
      ["buffer-line", "buffer-center-ring", "buffer-center"].forEach((id) => {
        if (m.getLayer(id))
          m.setLayoutProperty(
            id,
            "visibility",
            layersRef.current.buffer.visible ? "visible" : "none",
          );
      });
      applyZoomGating();
    },
    [applyZoomGating, applyFloodCmpDetailRange],
  );

  // ── init (client only, dynamic import keeps maplibre out of SSR) ──
  useEffect(() => {
    let cancelled = false;
    let map: MaplibreMap | null = null;
    let ro: ResizeObserver | null = null;

    void (async () => {
      try {
        const mod = await import("maplibre-gl");
        const maplibregl = mod.default ?? mod;
        // PMTiles protocol — registered ONCE per app lifecycle (idempotent),
        // never per map instance or per compare session.
        ensurePmtilesProtocol(maplibregl);
        if (cancelled || !containerRef.current) return;

        map = new maplibregl.Map({
          container: containerRef.current,
          style: appliedStyleRef.current,
          center: INITIAL_CENTER,
          zoom: INITIAL_ZOOM,
          attributionControl: false,
        });
        mapRef.current = map;

        map.on("error", (e) => console.error("[morphism-map]", e.error ?? e));
        diagRegisterMap("main", map);

        requestAnimationFrame(() => map?.resize());
        ro = new ResizeObserver(() => map?.resize());
        ro.observe(containerRef.current);

        map.on("load", () => {
          if (cancelled || !map) return;
          installLayers(map);
          map.resize();
          setMap(map);
          setReady(true);
        });

        map.on("move", () => {
          if (map) setZoom(map.getZoom());
        });

        // ── Hospital point popup (click) + pointer cursor (hover) — mirrors the
        // HTML `map.on('click','hosp', …)`. Layer-scoped, so overlay/boundary
        // layers above never block it; survives theme style swaps.
        map.on("click", "hospitals", (e) => {
          const m = mapRef.current;
          const f = e.features?.[0];
          if (!m || !f || f.geometry.type !== "Point") return;
          const props = f.properties as { name?: string; h24?: boolean | string } | null;
          const name = props?.name ?? "";
          const h24 = props?.h24 === true || props?.h24 === "true";
          const html = hospitalPopupRef.current
            ? hospitalPopupRef.current(name, h24)
            : `<b>${name}</b>`;
          new maplibregl.Popup({ closeButton: false, offset: 10 })
            .setLngLat(f.geometry.coordinates as [number, number])
            .setHTML(html)
            .addTo(m);
          // [adm-debug] dev diagnostics only.
          if (process.env.NODE_ENV !== "production") {
            console.log("[adm-debug] hospital click", {
              name,
              h24,
              zoom: m.getZoom(),
            });
          }
        });
        map.on("mouseenter", "hospitals", () => {
          const m = mapRef.current;
          if (m) m.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "hospitals", () => {
          const m = mapRef.current;
          if (m) m.getCanvas().style.cursor = "";
        });
        // [adm-debug] dev diagnostics only.
        if (process.env.NODE_ENV !== "production") {
          console.log("[adm-debug] hospital click handler attached");
        }
      } catch (err) {
        console.error("[morphism-map] init failed", err);
      }
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      diagUnregisterMap("main");
      mapRef.current = null;
      setMap(null);
      map?.remove();
    };
  }, [installLayers]);

  // ── swap basemap style when the theme changes (keeps camera + re-installs) ──
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const next = styleFor(theme);
    if (next === appliedStyleRef.current) return;
    appliedStyleRef.current = next;
    // [theme-debug] dev diagnostics only.
    if (process.env.NODE_ENV !== "production") {
      console.log("[theme-debug] switching", { theme, next });
    }
    // diff:false forces a full style reload (fires "style.load"); the default
    // diff mode would silently drop our custom layers without re-firing it.
    // The camera (center/zoom/bearing/pitch) is preserved across setStyle.
    // Soften the swap: the container dips briefly instead of flashing the raw
    // blank basemap; data/camera are untouched. Skipped under reduced motion.
    const el = containerRef.current;
    if (el && !isReducedMotion()) {
      el.style.transition = "opacity 150ms ease";
      el.style.opacity = "0.55";
    }
    m.setStyle(next, { diff: false });
    m.once("style.load", () => {
      if (el) el.style.opacity = "1";
      installLayers(m);
      if (process.env.NODE_ENV !== "production") {
        console.log("[theme-debug] reapplied", {
          styleLoaded: m.isStyleLoaded(),
          admSource: Boolean(m.getSource("adm")),
          aggLayer: Boolean(m.getLayer("agg-count")),
          hospitalsLayer: Boolean(m.getLayer("hospitals")),
          aggregateActive: aggregateActiveRef.current,
          boundariesActive: boundariesActiveRef.current,
        });
      }
    });
  }, [theme, ready, installLayers]);

  // ── sync layer visibility (hospitals are zoom-gated, not set directly) ──
  useEffect(() => {
    layersRef.current = layers;
    const map = mapRef.current;
    if (!map || !ready) return;
    // In compare mode the single flood layer MUST stay hidden — the per-year
    // layers replace it. When a PMTiles URL is committed the vector layers
    // stand in for the geojson detail the same way.
    const cmp = floodCmpActiveRef.current;
    const pmSingle = Boolean(floodPmUrlRef.current);
    (Object.keys(layers) as LayerId[]).forEach((id) => {
      if (id === "hospitals") return;
      if (map.getLayer(id)) {
        const on = id === "flood" && (cmp || pmSingle) ? false : layers[id].visible;
        map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      }
    });
    // Sub-layers follow their parent layer toggle (flood hidden while comparing).
    if (map.getLayer("boundaries-fill"))
      map.setLayoutProperty(
        "boundaries-fill",
        "visibility",
        layers.boundaries.visible ? "visible" : "none",
      );
    if (map.getLayer("flood-line"))
      map.setLayoutProperty(
        "flood-line",
        "visibility",
        !cmp && !pmSingle && layers.flood.visible ? "visible" : "none",
      );
    pmLayerIds(FLOOD_PM).forEach((id) => {
      if (map.getLayer(id))
        map.setLayoutProperty(
          id,
          "visibility",
          !cmp && pmSingle && layers.flood.visible ? "visible" : "none",
        );
    });
    // Hex overview layers follow the flood toggle (active only for date
    // scenarios); minzoom/maxzoom then pick which resolution actually renders.
    const overviewOn =
      !cmp && layers.flood.visible && floodOverviewActiveRef.current;
    FLOOD_HEX_LEVELS.forEach((lvl) => {
      [`flood-hex-${lvl.key}-fill`, `flood-hex-${lvl.key}-line`].forEach((id) => {
        if (map.getLayer(id))
          map.setLayoutProperty(id, "visibility", overviewOn ? "visible" : "none");
      });
    });
    ["buffer-line", "buffer-center-ring", "buffer-center"].forEach((id) => {
      if (map.getLayer(id))
        map.setLayoutProperty(
          id,
          "visibility",
          layers.buffer.visible ? "visible" : "none",
        );
    });
    hospitalsDesiredRef.current = layers.hospitals.visible;
    applyZoomGating();
  }, [layers, ready, applyZoomGating]);

  // ── keep hospital points / aggregation in sync with the live zoom ──
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    applyZoomGating();
    m.on("zoom", applyZoomGating);
    return () => {
      m.off("zoom", applyZoomGating);
    };
  }, [ready, applyZoomGating]);

  // ── sync layer data ──
  useEffect(() => {
    dataRef.current = data;
    const map = mapRef.current;
    if (!map || !ready || !data) return;
    (Object.keys(data) as LayerId[]).forEach((id) => {
      const fc = data[id];
      if (fc) setData(map, id, fc);
    });
  }, [data, ready]);

  const flyTo = useCallback((cam: MapCamera) => {
    const m = mapRef.current;
    if (!m) return;
    m.flyTo({
      center: cam.center,
      zoom: cam.zoom,
      duration: isReducedMotion() ? 0 : cam.duration * cameraFactorRef.current,
      essential: true,
    });
  }, []);

  const fitBounds = useCallback((b: MapBounds) => {
    const m = mapRef.current;
    if (!m) return;
    m.fitBounds([b.sw, b.ne], {
      padding: 80,
      duration: isReducedMotion() ? 0 : b.duration * cameraFactorRef.current,
      essential: true,
    });
  }, []);

  // fitBounds that RESOLVES only when the camera transition settles (moveend),
  // with a safety timeout so a no-op move (bounds already in view) still
  // resolves. The listener is always removed on settle — never left attached.
  const fitBoundsAndWait = useCallback((b: MapBounds): Promise<void> => {
    const m = mapRef.current;
    if (!m) return Promise.resolve();
    const duration = isReducedMotion() ? 0 : b.duration * cameraFactorRef.current;
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        m.off("moveend", finish);
        clearTimeout(timer);
        resolve();
      };
      // Safety net (created before the move so it is set if moveend fires sync).
      const timer = setTimeout(finish, duration + 600);
      m.on("moveend", finish);
      m.fitBounds([b.sw, b.ne], { padding: 80, duration, essential: true });
    });
  }, []);

  // Imperatively commit the flood extent to the map in one shot: replace the
  // "flood" source data AND reveal the fill + outline synchronously, so the
  // geometry is on the map BEFORE the camera starts moving (no black frame, no
  // reliance on a React re-render landing first). React state is kept in sync by
  // the caller so a later theme/style swap re-installs the same extent.
  const commitFloodExtent = useCallback(
    (fc: FeatureCollection<unknown>) => {
      const m = mapRef.current;
      if (!m) return;
      setData(m, "flood", fc);
      ["flood", "flood-line"].forEach((id) => {
        if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", "visible");
      });
    },
    [],
  );

  // Commit (or clear) the single-date PMTiles detail. Replaces the geojson
  // "flood"/"flood-line" pair: the browser range-fetches only visible tiles —
  // the complete GeoJSON is never downloaded in pmtiles mode.
  const commitFloodTiles = useCallback((url: string | null) => {
    floodPmUrlRef.current = url;
    const m = mapRef.current;
    if (!m) return;
    const setVis = (id: string, on: boolean) => {
      if (m.getLayer(id))
        m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };
    if (url) {
      ensurePmDataset(m, FLOOD_PM, url, readMapPalette().flood, 0.3);
      const on = !floodCmpActiveRef.current && layersRef.current.flood.visible;
      pmLayerIds(FLOOD_PM).forEach((id) => setVis(id, on));
      setVis("flood", false);
      setVis("flood-line", false);
    } else {
      pmLayerIds(FLOOD_PM).forEach((id) => setVis(id, false));
    }
  }, []);

  // Feed (or clear) the low-zoom hex overviews (all resolutions) for the active
  // flood date. Pass null to deactivate (mock flood scenarios have no overview).
  // Visibility is set imperatively so the overview appears in the same commit as
  // the detail extent; MapLibre's minzoom/maxzoom then render only one
  // resolution per zoom band.
  const setFloodOverview = useCallback((hex: FloodHexOverview | null) => {
    floodOverviewRef.current = hex;
    const hasData = Boolean(
      hex &&
        (hex.coarse.features.length ||
          hex.medium.features.length ||
          hex.fine.features.length),
    );
    floodOverviewActiveRef.current = hasData;
    const m = mapRef.current;
    if (!m) return;
    FLOOD_HEX_LEVELS.forEach((lvl) => {
      setData(m, `flood-hex-${lvl.key}`, hex?.[lvl.key] ?? EMPTY);
      [`flood-hex-${lvl.key}-fill`, `flood-hex-${lvl.key}-line`].forEach((id) => {
        if (m.getLayer(id))
          m.setLayoutProperty(id, "visibility", hasData ? "visible" : "none");
      });
    });
  }, []);

  // Show/hide the province-aggregation labels. Pass null to clear.
  const setAggregate = useCallback(
    (provinces: ProvinceCount[] | null) => {
      aggRef.current = provinces;
      const m = mapRef.current;
      if (m && m.getSource("agg")) {
        setData(m, "agg", {
          type: "FeatureCollection",
          features: (provinces ?? []).map((p) => ({
            type: "Feature",
            properties: { count: p.count, name: p.name },
            geometry: { type: "Point", coordinates: p.center },
          })),
        });
      }
      if (m && m.getSource("adm-summary")) {
        setData(m, "adm-summary", summaryFC(provinces));
      }
      aggregateActiveRef.current = Boolean(provinces && provinces.length);
      applyZoomGating();
    },
    [applyZoomGating],
  );

  // Set the analysis center marker(s) (pass null to clear).
  const setBufferCenters = useCallback(
    (fc: FeatureCollection<unknown> | null) => {
      bufferCentersRef.current = fc;
      const m = mapRef.current;
      if (m && m.getSource("buffer-center")) {
        setData(m, "buffer-center", fc ?? EMPTY);
      }
    },
    [],
  );

  // Flood year-compare: feed side A's hex LODs ONCE into their banded sources
  // (side B is fed to the overlay map by the view). Pass null to leave compare
  // and restore the single flood layer. NO per-frame work happens after this —
  // zoom picks the LOD via minzoom/maxzoom, the divider is CSS-only.
  // `aPmUrl` (pmtiles mode) points side A's high-zoom detail at a PMTiles
  // archive instead of the geojson viewport slices.
  const setFloodCompare = useCallback(
    (a: FloodCompareData | null, aPmUrl: string | null = null) => {
      floodCmpARef.current = a;
      floodCmpAPmUrlRef.current = a ? aPmUrl : null;
      floodCmpActiveRef.current = Boolean(a);
      const m = mapRef.current;
      if (!m) return;
      const cmp = floodCmpActiveRef.current;
      const setVis = (id: string, on: boolean) => {
        if (m.getLayer(id))
          m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      };
      FLOOD_HEX_LEVELS.forEach((lvl) =>
        setData(m, `flood-a-${lvl.key}`, a?.[lvl.key] ?? EMPTY),
      );
      if (!cmp) {
        floodCmpDetailARef.current = null;
        setData(m, "flood-a-detail", EMPTY);
      }
      if (cmp && aPmUrl) {
        ensurePmDataset(
          m,
          FLOOD_A_PM,
          aPmUrl,
          readCssColor(FLOOD_COMPARE_SIDES.a.cssVar),
          0.32,
        );
      }
      FLOOD_CMP_A_LAYERS.forEach((id) => setVis(id, cmp));
      pmLayerIds(FLOOD_A_PM).forEach((id) => setVis(id, cmp && Boolean(aPmUrl)));
      // Hide the single flood layer (detail + hex overview) during compare;
      // restore it afterwards (pm single-date detail included).
      const pmSingle = Boolean(floodPmUrlRef.current);
      setVis("flood", cmp || pmSingle ? false : layersRef.current.flood.visible);
      setVis("flood-line", cmp || pmSingle ? false : layersRef.current.flood.visible);
      pmLayerIds(FLOOD_PM).forEach((id) =>
        setVis(id, !cmp && pmSingle && layersRef.current.flood.visible),
      );
      const overviewOn =
        !cmp && layersRef.current.flood.visible && floodOverviewActiveRef.current;
      FLOOD_HEX_LEVELS.forEach((lvl) => {
        setVis(`flood-hex-${lvl.key}-fill`, overviewOn);
        setVis(`flood-hex-${lvl.key}-line`, overviewOn);
      });
      applyFloodCmpDetailRange(m);
    },
    [applyFloodCmpDetailRange],
  );

  // Feed (or clear) side A's high-zoom viewport detail. setData runs here only
  // — i.e. once per debounced moveend fetch — never during divider dragging.
  const setFloodCompareDetail = useCallback(
    (a: FeatureCollection<unknown> | null) => {
      floodCmpDetailARef.current = a;
      const m = mapRef.current;
      if (!m) return;
      setData(m, "flood-a-detail", a ?? EMPTY);
      applyFloodCmpDetailRange(m);
    },
    [applyFloodCmpDetailRange],
  );

  // Set the real province polygons to draw (pass null/empty to clear).
  const setBoundaries = useCallback(
    (fc: ProvinceBoundaryFC | null) => {
      admRef.current = fc;
      const m = mapRef.current;
      if (m && m.getSource("adm")) {
        setData(m, "adm", fc ?? { type: "FeatureCollection", features: [] });
      }
      boundariesActiveRef.current = Boolean(fc && fc.features.length);
      applyZoomGating();
    },
    [applyZoomGating],
  );

  // Toggle region-compare mode (region labels always on, no points/districts).
  const setCompareMode = useCallback(
    (on: boolean) => {
      compareActiveRef.current = on;
      applyZoomGating();
    },
    [applyZoomGating],
  );

  // Manual "Administrative boundaries" layer data (real zoom-banded admin
  // hierarchy from use-admin-boundaries). Pass null to clear. Kept in a ref so
  // a theme style swap re-feeds the same data.
  const setAdminBoundaries = useCallback(
    (fc: FeatureCollection<unknown> | null) => {
      adminBoundariesRef.current = fc;
      const m = mapRef.current;
      if (m && m.getSource("boundaries")) setData(m, "boundaries", fc ?? EMPTY);
    },
    [],
  );

  // ADM2 district aggregation (fill/line context + count labels). Pass null to
  // clear — the province aggregation then takes over again (fallback path).
  const setDistricts = useCallback(
    (fc: FeatureCollection<unknown> | null) => {
      districtDataRef.current = fc;
      districtActiveRef.current = Boolean(fc && fc.features.length);
      const m = mapRef.current;
      if (m && m.getSource("adm-district")) setData(m, "adm-district", fc ?? EMPTY);
      applyZoomGating();
    },
    [applyZoomGating],
  );

  // ADM3 subdistrict boundary CONTEXT (no labels). Pass null to clear.
  const setSubdistricts = useCallback(
    (fc: FeatureCollection<unknown> | null) => {
      subdistrictDataRef.current = fc;
      subdistrictActiveRef.current = Boolean(fc && fc.features.length);
      const m = mapRef.current;
      if (m && m.getSource("adm-subdistrict"))
        setData(m, "adm-subdistrict", fc ?? EMPTY);
      applyZoomGating();
    },
    [applyZoomGating],
  );

  /** Toggle analysis-result point mode (points visible at ANY zoom). */
  const setPointsAlwaysVisible = useCallback(
    (on: boolean) => {
      pointsAlwaysRef.current = on;
      applyZoomGating();
    },
    [applyZoomGating],
  );

  return {
    containerRef,
    map,
    ready,
    zoom,
    flyTo,
    fitBounds,
    fitBoundsAndWait,
    setPointsAlwaysVisible,
    commitFloodExtent,
    commitFloodTiles,
    setFloodOverview,
    setAggregate,
    setBoundaries,
    setAdminBoundaries,
    setBufferCenters,
    setFloodCompare,
    setFloodCompareDetail,
    setDistricts,
    setSubdistricts,
    setCompareMode,
    setCameraFactor,
  };
}