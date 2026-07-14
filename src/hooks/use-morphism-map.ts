"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readMapPalette, readCssColor } from "@/lib/map-tokens";
import { FLOOD_COMPARE_SIDES } from "@/configs/flood-compare";
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

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

type MaplibreMap = import("maplibre-gl").Map;
type Expr = import("maplibre-gl").ExpressionSpecification;
// Per-feature region colour — the view sets `color` (resolved from an existing
// design token) on every province feature before this layer is shown.
const ADM_COLOR = ["get", "color"] as unknown as Expr;
// Properties are opaque to the renderer (setData only), so the layer data is
// kept generic — any resource FC (FloodFC, HospitalFC…) is assignable here.
type LayerData = Record<LayerId, FeatureCollection<unknown>>;

// CARTO vector basemaps (carry their own sources/glyphs/sprite).
export const DARK_BASEMAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
export const LIGHT_BASEMAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
// Backwards-compatible default (dark) — also used by the swipe overlay map.
export const BASEMAP_STYLE = DARK_BASEMAP_STYLE;

const styleFor = (theme?: string) =>
  theme === "light" ? LIGHT_BASEMAP_STYLE : DARK_BASEMAP_STYLE;

// Initial camera — matches the HTML reference (central Bangkok).
const INITIAL_CENTER: [number, number] = [100.53, 13.745];
const INITIAL_ZOOM = 11.4;

// Initial source payload handed to MapLibre — keep the default props shape so it
// satisfies maplibre's GeoJsonProperties. (LayerData inputs stay generic.)
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

// ── Vertical half-plane clipping (for the flood swipe-compare) ──────────────
// Clip each year's polygons to one side of the divider (a vertical line at
// longitude `lng`), so the swipe truly shows year A on the left and year B on
// the right — never both years overlaid on the same side.
type Ring = number[][];

function clipRingVertical(ring: Ring, lng: number, keepLeft: boolean): Ring {
  const closed =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  const pts = closed ? ring.slice(0, -1) : ring.slice();
  if (pts.length < 3) return [];
  const inside = (p: number[]) => (keepLeft ? p[0] <= lng : p[0] >= lng);
  const intersect = (a: number[], b: number[]): number[] => {
    const dx = b[0] - a[0];
    const t = dx === 0 ? 0 : (lng - a[0]) / dx;
    return [lng, a[1] + t * (b[1] - a[1])];
  };
  const out: Ring = [];
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur));
      out.push(cur);
    } else if (prevIn) {
      out.push(intersect(prev, cur));
    }
  }
  if (out.length < 3) return [];
  out.push(out[0]); // re-close the ring
  return out;
}

function clipFCVertical(
  fc: FeatureCollection<unknown>,
  lng: number,
  keepLeft: boolean,
): FeatureCollection<unknown> {
  // Clip one polygon (outer ring + holes); null when the outer ring is fully
  // outside the kept half.
  const clipPolygon = (rings: number[][][]): number[][][] | null => {
    const clipped = rings
      .map((r) => clipRingVertical(r, lng, keepLeft))
      .filter((r) => r.length >= 4);
    return clipped.length ? clipped : null;
  };
  type Feat = FeatureCollection<unknown>["features"][number];
  return {
    type: "FeatureCollection",
    features: fc.features.flatMap((f): Feat[] => {
      const g = f.geometry as { type: string; coordinates: unknown } | null;
      if (!g) return [];
      if (g.type === "Polygon") {
        const poly = clipPolygon(g.coordinates as number[][][]);
        if (!poly) return [];
        return [
          {
            type: "Feature",
            properties: f.properties,
            geometry: { type: "Polygon", coordinates: poly },
          } as Feat,
        ];
      }
      // Real Vallaris extents are MultiPolygon — clip each part and keep the
      // survivors (previously these were dropped entirely → nothing drawn).
      if (g.type === "MultiPolygon") {
        const polys = (g.coordinates as number[][][][])
          .map(clipPolygon)
          .filter((p): p is number[][][] => p !== null);
        if (!polys.length) return [];
        return [
          {
            type: "Feature",
            properties: f.properties,
            geometry: { type: "MultiPolygon", coordinates: polys },
          } as Feat,
        ];
      }
      return [];
    }),
  } as FeatureCollection<unknown>;
}

/**
 * Per-year data for the flood swipe-compare: the SAME zoom LOD as the rest of
 * the app — progressively finer HEX aggregations as you zoom. Only hexes are
 * kept (never the raw nationwide detail), so two years fit in memory and the
 * per-frame clip stays cheap. `ultra` (fine cells) stands in for the single-date
 * detail level at high zoom; picked by `applyFloodClip`.
 */
export interface FloodCompareData {
  coarse: FeatureCollection<unknown>;
  medium: FeatureCollection<unknown>;
  fine: FeatureCollection<unknown>;
}

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
  const aggregateActiveRef = useRef(false);
  const boundariesActiveRef = useRef(false);
  // Region-compare mode: region-coloured boundaries + ONE count label per region,
  // always visible (not zoom-banded); hospital points + summary/district hidden.
  const compareActiveRef = useRef(false);
  const layersRef = useRef<LayersState>(layers);
  const dataRef = useRef<Partial<LayerData> | undefined>(data);
  const aggRef = useRef<ProvinceCount[] | null>(null);
  const admRef = useRef<ProvinceBoundaryFC | null>(null);
  const bufferCentersRef = useRef<FeatureCollection<unknown> | null>(null);
  const appliedStyleRef = useRef<string>(styleFor(theme));
  // Multi-level admin aggregation (ADM2 district / ADM3 subdistrict), fed by the
  // useAdminHierarchy hook. Kept in refs so they survive a theme style swap.
  const districtDataRef = useRef<FeatureCollection<unknown> | null>(null);
  const subdistrictDataRef = useRef<FeatureCollection<unknown> | null>(null);
  const districtActiveRef = useRef(false);
  const subdistrictActiveRef = useRef(false);
  // Flood year-compare: year A + year B are drawn as their OWN colour-coded
  // layers on the main map (year A = info-blue, year B = secondary-purple), so
  // both years are always visible and distinct regardless of the swipe overlay.
  // Kept in refs so they survive a style swap (re-installed in installLayers).
  const floodCmpARef = useRef<FloodCompareData | null>(null);
  const floodCmpBRef = useRef<FloodCompareData | null>(null);
  const floodCmpActiveRef = useRef(false);
  // High-zoom REAL detail cropped to the current viewport (fetched on demand by
  // the view). When present + zoomed past the detail band it replaces the hex,
  // so compare shows real polygons like the single-date view — kept small
  // (viewport-only) so memory stays bounded regardless of dataset size.
  const floodCmpDetailARef = useRef<FeatureCollection<unknown> | null>(null);
  const floodCmpDetailBRef = useRef<FeatureCollection<unknown> | null>(null);
  // Divider position (0–100, % from the left) driving the per-year clip.
  const floodClipRef = useRef(50);
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
    // points feed the counts but are never rendered.
    const showPoints = hospitalsDesiredRef.current && pointZoom;
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

  // Re-clip the two year layers against the current divider longitude. Year A
  // keeps the left of the divider, year B keeps the right — so the swipe shows
  // each year only on its own side. Re-run on divider move AND camera move.
  const applyFloodClip = useCallback(() => {
    const m = mapRef.current;
    if (!m || !floodCmpActiveRef.current) return;
    const a = floodCmpARef.current;
    const b = floodCmpBRef.current;
    if (!a || !b) return;
    const container = m.getContainer();
    const x = (floodClipRef.current / 100) * container.clientWidth;
    const lng = m.unproject([x, container.clientHeight / 2]).lng;
    const setSrc = (id: string, fc: FeatureCollection<unknown>) => {
      const src = m.getSource(id);
      if (src && "setData" in src)
        (src as { setData: (d: FeatureCollection<unknown>) => void }).setData(fc);
    };

    // SAME zoom bands as the single-date view: coarser hexes when zoomed out,
    // finer as you zoom in (ultra ≈ the detail band). All levels are small
    // aggregations, so the vertical clip is cheap every frame.
    const zoom = m.getZoom();
    const detailZoom = zoom >= FLOOD_DETAIL_MIN_ZOOM;
    const levelFor = (d: FloodCompareData): FeatureCollection<unknown> => {
      if (zoom >= 6) return d.fine; // fine hex is the detail-zoom fallback too
      if (zoom >= 5) return d.medium;
      return d.coarse;
    };
    // At detail zoom, draw the REAL viewport detail once it's loaded (and has
    // features); otherwise fall back to the fine hex until the fetch resolves.
    const geomFor = (
      d: FloodCompareData,
      detail: FeatureCollection<unknown> | null,
    ) =>
      detailZoom && detail && detail.features.length ? detail : levelFor(d);
    setSrc("flood-a", clipFCVertical(geomFor(a, floodCmpDetailARef.current), lng, true));
    setSrc("flood-b", clipFCVertical(geomFor(b, floodCmpDetailBRef.current), lng, false));
  }, []);

  // (Re)install every custom source + layer, then re-feed the current scenario
  // data. Called on first style load AND after each theme style swap. Colours
  // are read fresh from the design tokens so they follow the active theme.
  const installLayers = useCallback(
    (m: MaplibreMap) => {
      const palette = readMapPalette();
      // Per-year compare colours (resolved fresh so they follow the theme).
      const floodColorA = readCssColor(FLOOD_COMPARE_SIDES.a.cssVar);
      const floodColorB = readCssColor(FLOOD_COMPARE_SIDES.b.cssVar);

      // addLayer is guarded so a re-install (theme swap) never throws on a
      // layer that somehow survived; sources guarded the same way.
      const addLayer = (spec: Parameters<MaplibreMap["addLayer"]>[0]) => {
        if (!m.getLayer(spec.id)) m.addLayer(spec);
      };

      ANALYSIS_LAYERS.forEach((id) => {
        if (!m.getSource(id)) m.addSource(id, { type: "geojson", data: EMPTY });
      });
      addLayer({
        id: "boundaries",
        type: "line",
        source: "boundaries",
        paint: { "line-color": palette.boundaries, "line-width": 1.5 },
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

      // ── Flood year-compare layers (own sources so both years show at once) ──
      // Year A = info-blue, Year B = secondary-purple. Hidden until a compare
      // scenario feeds them via setFloodCompare.
      if (!m.getSource("flood-a"))
        m.addSource("flood-a", { type: "geojson", data: EMPTY });
      if (!m.getSource("flood-b"))
        m.addSource("flood-b", { type: "geojson", data: EMPTY });
      addLayer({
        id: "flood-a-fill",
        type: "fill",
        source: "flood-a",
        paint: { "fill-color": floodColorA, "fill-opacity": 0.32 },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "flood-a-line",
        type: "line",
        source: "flood-a",
        paint: { "line-color": floodColorA, "line-width": 1.6, "line-opacity": 0.95 },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "flood-b-fill",
        type: "fill",
        source: "flood-b",
        paint: { "fill-color": floodColorB, "fill-opacity": 0.4 },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "flood-b-line",
        type: "line",
        source: "flood-b",
        paint: { "line-color": floodColorB, "line-width": 1.6, "line-opacity": 0.95 },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "buffer",
        type: "fill",
        source: "buffer",
        paint: { "fill-color": palette.buffer, "fill-opacity": 0.14 },
        layout: { visibility: "none" },
      });
      // Green dashed buffer outline (same source as the fill).
      addLayer({
        id: "buffer-line",
        type: "line",
        source: "buffer",
        paint: {
          "line-color": palette.buffer,
          "line-width": 1.6,
          "line-dasharray": [2, 2],
          "line-opacity": 0.9,
        },
        layout: { visibility: "none" },
      });
      // Buffer centre marker(s).
      if (!m.getSource("buffer-center"))
        m.addSource("buffer-center", { type: "geojson", data: EMPTY });
      addLayer({
        id: "buffer-center",
        type: "circle",
        source: "buffer-center",
        paint: {
          "circle-radius": 5,
          "circle-color": palette.buffer,
          "circle-stroke-width": 2,
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

      // Layer order (bottom→top): boundaries, flood, compare A (blue) then
      // compare B (purple) on top of it, buffer, buffer centre, hospitals.
      [
        // Admin context fills/lines sit low (below flood/points).
        "adm-subdistrict-fill",
        "adm-subdistrict-line",
        "adm-district-fill",
        "adm-district-line",
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
        "flood-a-fill",
        "flood-a-line",
        "flood-b-fill",
        "flood-b-line",
        "buffer-line",
        "buffer-center",
        "hospitals",
        // Count labels stay on top so numbers are never hidden by fills/points.
        "agg-count",
        "adm-district-label",
        "adm-summary-count",
      ].forEach((id) => {
        if (m.getLayer(id)) m.moveLayer(id);
      });

      // Re-feed current scenario data (survives the style swap).
      if (dataRef.current) {
        (Object.keys(dataRef.current) as LayerId[]).forEach((id) => {
          const fc = dataRef.current?.[id];
          if (fc) setData(m, id, fc);
        });
      }
      setData(m, "adm", admRef.current ?? EMPTY);
      setData(m, "adm-district", districtDataRef.current ?? EMPTY);
      setData(m, "adm-subdistrict", subdistrictDataRef.current ?? EMPTY);
      setData(m, "buffer-center", bufferCentersRef.current ?? EMPTY);
      FLOOD_HEX_LEVELS.forEach((lvl) =>
        setData(m, `flood-hex-${lvl.key}`, floodOverviewRef.current?.[lvl.key] ?? EMPTY),
      );
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
      ["flood-a-fill", "flood-a-line", "flood-b-fill", "flood-b-line"].forEach(
        (id) => setVis(id, cmp),
      );
      setVis("flood", cmp ? false : layersRef.current.flood.visible);
      setVis("flood-line", cmp ? false : layersRef.current.flood.visible);
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
      ["buffer-line", "buffer-center"].forEach((id) => {
        if (m.getLayer(id))
          m.setLayoutProperty(
            id,
            "visibility",
            layersRef.current.buffer.visible ? "visible" : "none",
          );
      });
      // Re-feed the clipped per-year data (no-op when not in compare mode).
      applyFloodClip();
      applyZoomGating();
    },
    [applyZoomGating, applyFloodClip],
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
          // [adm-debug] TEMP — remove after verifying point clicks.
          console.log("[adm-debug] hospital click", { name, h24, zoom: m.getZoom() });
        });
        map.on("mouseenter", "hospitals", () => {
          const m = mapRef.current;
          if (m) m.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "hospitals", () => {
          const m = mapRef.current;
          if (m) m.getCanvas().style.cursor = "";
        });
        // [adm-debug] TEMP — confirm the hospital click handler is attached.
        console.log("[adm-debug] hospital click handler attached");
      } catch (err) {
        console.error("[morphism-map] init failed", err);
      }
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
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
    // [theme-debug] TEMP — remove after verifying.
    console.log("[theme-debug] switching", { theme, next });
    // diff:false forces a full style reload (fires "style.load"); the default
    // diff mode would silently drop our custom layers without re-firing it.
    // The camera (center/zoom/bearing/pitch) is preserved across setStyle.
    m.setStyle(next, { diff: false });
    m.once("style.load", () => {
      installLayers(m);
      console.log("[theme-debug] reapplied", {
        styleLoaded: m.isStyleLoaded(),
        admSource: Boolean(m.getSource("adm")),
        aggLayer: Boolean(m.getLayer("agg-count")),
        hospitalsLayer: Boolean(m.getLayer("hospitals")),
        aggregateActive: aggregateActiveRef.current,
        boundariesActive: boundariesActiveRef.current,
      });
    });
  }, [theme, ready, installLayers]);

  // ── sync layer visibility (hospitals are zoom-gated, not set directly) ──
  useEffect(() => {
    layersRef.current = layers;
    const map = mapRef.current;
    if (!map || !ready) return;
    // In compare mode the single flood layer MUST stay hidden — the per-year
    // clipped layers replace it. (The floodcmp scenario marks flood "visible",
    // so without this the global blue extent would render everywhere.)
    const cmp = floodCmpActiveRef.current;
    (Object.keys(layers) as LayerId[]).forEach((id) => {
      if (id === "hospitals") return;
      if (map.getLayer(id)) {
        const on = id === "flood" && cmp ? false : layers[id].visible;
        map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      }
    });
    // Sub-layers follow their parent layer toggle (flood hidden while comparing).
    if (map.getLayer("flood-line"))
      map.setLayoutProperty(
        "flood-line",
        "visibility",
        !cmp && layers.flood.visible ? "visible" : "none",
      );
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
    ["buffer-line", "buffer-center"].forEach((id) => {
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

  // ── re-clip the per-year flood layers whenever the camera moves ──
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    m.on("move", applyFloodClip);
    return () => {
      m.off("move", applyFloodClip);
    };
  }, [ready, applyFloodClip]);

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
      duration: REDUCED ? 0 : cam.duration,
      essential: true,
    });
  }, []);

  const fitBounds = useCallback((b: MapBounds) => {
    const m = mapRef.current;
    if (!m) return;
    m.fitBounds([b.sw, b.ne], {
      padding: 80,
      duration: REDUCED ? 0 : b.duration,
      essential: true,
    });
  }, []);

  // fitBounds that RESOLVES only when the camera transition settles (moveend),
  // with a safety timeout so a no-op move (bounds already in view) still
  // resolves. The listener is always removed on settle — never left attached.
  const fitBoundsAndWait = useCallback((b: MapBounds): Promise<void> => {
    const m = mapRef.current;
    if (!m) return Promise.resolve();
    const duration = REDUCED ? 0 : b.duration;
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

  // Set the buffer centre marker(s) (pass null to clear).
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

  // Flood year-compare: feed year A (blue) + year B (purple) as their own
  // colour-coded layers on the main map, each clipped to its side of the
  // divider. Pass (null, null) to leave compare and restore the single flood
  // layer.
  const setFloodCompare = useCallback(
    (a: FloodCompareData | null, b: FloodCompareData | null) => {
      floodCmpARef.current = a;
      floodCmpBRef.current = b;
      floodCmpActiveRef.current = Boolean(a && b);
      const m = mapRef.current;
      if (!m) return;
      const cmp = floodCmpActiveRef.current;
      const setVis = (id: string, on: boolean) => {
        if (m.getLayer(id))
          m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      };
      ["flood-a-fill", "flood-a-line", "flood-b-fill", "flood-b-line"].forEach(
        (id) => setVis(id, cmp),
      );
      // Hide the single flood layer during compare; restore it afterwards.
      setVis("flood", cmp ? false : layersRef.current.flood.visible);
      setVis("flood-line", cmp ? false : layersRef.current.flood.visible);
      if (cmp) applyFloodClip();
      else {
        floodCmpDetailARef.current = null;
        floodCmpDetailBRef.current = null;
        setData(m, "flood-a", EMPTY);
        setData(m, "flood-b", EMPTY);
      }
    },
    [applyFloodClip],
  );

  // Feed the high-zoom viewport detail for both sides (or clear with null,null).
  const setFloodCompareDetail = useCallback(
    (
      a: FeatureCollection<unknown> | null,
      b: FeatureCollection<unknown> | null,
    ) => {
      floodCmpDetailARef.current = a;
      floodCmpDetailBRef.current = b;
      applyFloodClip();
    },
    [applyFloodClip],
  );

  // Move the compare divider (0–100 % from the left) and re-clip in real time.
  const setFloodCompareClip = useCallback(
    (pct: number) => {
      floodClipRef.current = Math.max(0, Math.min(100, pct));
      applyFloodClip();
    },
    [applyFloodClip],
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

  return {
    containerRef,
    map,
    ready,
    zoom,
    flyTo,
    fitBounds,
    fitBoundsAndWait,
    commitFloodExtent,
    setFloodOverview,
    setAggregate,
    setBoundaries,
    setBufferCenters,
    setFloodCompare,
    setFloodCompareClip,
    setFloodCompareDetail,
    setDistricts,
    setSubdistricts,
    setCompareMode,
  };
}