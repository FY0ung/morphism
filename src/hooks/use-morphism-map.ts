"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readMapPalette, readCssColor } from "@/lib/map-tokens";
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

// Below this zoom the map shows province/region aggregation (counts); at or
// above it, individual hospital points. Matches the HTML reference threshold.
const HOSPITAL_POINT_ZOOM = 11.8;

// Initial source payload handed to MapLibre — keep the default props shape so it
// satisfies maplibre's GeoJsonProperties. (LayerData inputs stay generic.)
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

const ANALYSIS_LAYERS = ["hospitals", "flood", "buffer", "boundaries"] as const;

interface UseMorphismMapArgs {
  layers: LayersState;
  data?: Partial<LayerData>;
  /** Active UI theme; the map basemap follows it ("dark" | "light"). */
  theme?: string;
}

/**
 * Initialises MapLibre and keeps its analysis layers in sync with React state.
 * The basemap follows the UI theme; on theme change the style is swapped and all
 * custom sources/layers + current scenario data are re-installed (camera kept).
 */
export function useMorphismMap({ layers, data, theme }: UseMorphismMapArgs) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);

  // Zoom-gating + current scenario state, kept in refs so they survive a style
  // swap (setStyle wipes custom sources/layers; we re-feed from these).
  const hospitalsDesiredRef = useRef(false);
  const aggregateActiveRef = useRef(false);
  const boundariesActiveRef = useRef(false);
  const layersRef = useRef<LayersState>(layers);
  const dataRef = useRef<Partial<LayerData> | undefined>(data);
  const aggRef = useRef<ProvinceCount[] | null>(null);
  const admRef = useRef<ProvinceBoundaryFC | null>(null);
  const appliedStyleRef = useRef<string>(styleFor(theme));

  const setData = (m: MaplibreMap, id: string, fc: FeatureCollection<unknown>) => {
    const src = m.getSource(id);
    if (src && "setData" in src) {
      (src as { setData: (d: FeatureCollection<unknown>) => void }).setData(fc);
    }
  };

  // Reconcile hospital-point vs aggregation visibility against the live zoom.
  const applyZoomGating = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    const z = m.getZoom();
    const belowPointZoom = z < HOSPITAL_POINT_ZOOM;
    const showPoints = hospitalsDesiredRef.current && !belowPointZoom;
    const showAgg = aggregateActiveRef.current && belowPointZoom;
    const showFill = boundariesActiveRef.current && belowPointZoom;
    const showLine = boundariesActiveRef.current;
    const set = (id: string, on: boolean) => {
      if (m.getLayer(id))
        m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };
    set("hospitals", showPoints);
    set("agg-count", showAgg);
    set("adm-fill", showFill);
    set("adm-line", showLine);
  }, []);

  // (Re)install every custom source + layer, then re-feed the current scenario
  // data. Called on first style load AND after each theme style swap. Colours
  // are read fresh from the design tokens so they follow the active theme.
  const installLayers = useCallback(
    (m: MaplibreMap) => {
      const palette = readMapPalette();

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
      addLayer({
        id: "flood",
        type: "fill",
        source: "flood",
        paint: { "fill-color": palette.flood, "fill-opacity": 0.35 },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "buffer",
        type: "fill",
        source: "buffer",
        paint: { "fill-color": palette.buffer, "fill-opacity": 0.18 },
        layout: { visibility: "none" },
      });
      addLayer({
        id: "hospitals",
        type: "circle",
        source: "hospitals",
        paint: {
          "circle-radius": 5,
          "circle-color": palette.hospitals,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": palette.me,
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

      if (m.getLayer("hospitals")) m.moveLayer("hospitals");

      // Re-feed current scenario data (survives the style swap).
      if (dataRef.current) {
        (Object.keys(dataRef.current) as LayerId[]).forEach((id) => {
          const fc = dataRef.current?.[id];
          if (fc) setData(m, id, fc);
        });
      }
      setData(m, "adm", admRef.current ?? EMPTY);
      setData(m, "agg", {
        type: "FeatureCollection",
        features: (aggRef.current ?? []).map((p) => ({
          type: "Feature",
          properties: { count: p.count, name: p.name },
          geometry: { type: "Point", coordinates: p.center },
        })),
      });

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
      applyZoomGating();
    },
    [applyZoomGating],
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
    (Object.keys(layers) as LayerId[]).forEach((id) => {
      if (id === "hospitals") return;
      if (map.getLayer(id)) {
        map.setLayoutProperty(
          id,
          "visibility",
          layers[id].visible ? "visible" : "none",
        );
      }
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
      aggregateActiveRef.current = Boolean(provinces && provinces.length);
      applyZoomGating();
    },
    [applyZoomGating],
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

  return {
    containerRef,
    map,
    ready,
    zoom,
    flyTo,
    fitBounds,
    setAggregate,
    setBoundaries,
  };
}
