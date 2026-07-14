"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FLOOD_COMPARE_SIDES } from "@/configs/flood-compare";
import {
  FLOOD_DETAIL_MIN_ZOOM,
  FLOOD_HEX_LEVELS,
} from "@/lib/flood-overview";
import { readCssColor } from "@/lib/map-tokens";
import {
  DARK_BASEMAP_STYLE,
  LIGHT_BASEMAP_STYLE,
  type FloodCompareData,
} from "./use-morphism-map";
import type { FeatureCollection } from "@/types";

type MaplibreMap = import("maplibre-gl").Map;

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
const styleFor = (theme?: string) =>
  theme === "light" ? LIGHT_BASEMAP_STYLE : DARK_BASEMAP_STYLE;

const DEV = process.env.NODE_ENV !== "production";
const devLog = (msg: string) => {
  if (DEV)
    console.log(
      `[compare-overlay] ${msg}; canvases:`,
      document.querySelectorAll(".maplibregl-canvas").length,
    );
};

// Side-B source/layer ids on the OVERLAY map — stable for the session.
const B_SOURCES = [
  ...FLOOD_HEX_LEVELS.map((lvl) => `flood-b-${lvl.key}`),
  "flood-b-detail",
] as const;

interface UseFloodCompareOverlayArgs {
  /** The interactive main map — single source of truth for the camera. */
  mainMap: MaplibreMap | null;
  /** Whether swipe-compare mode is on (a session is open). */
  active: boolean;
  /** Side B's hex LODs; null until the compare fetch resolves. */
  data: FloodCompareData | null;
  /** Active UI theme — the overlay basemap follows the main map's. */
  theme?: string;
}

/**
 * Owns the swipe-compare OVERLAY map: a second, NON-interactive MapLibre map
 * stacked on the main one, showing basemap + flood side B only. The divider
 * reveals it with pure CSS `clip-path` on its wrapper (see SwipeCompare) — so
 * dragging costs zero MapLibre work, zero network, zero React renders.
 *
 * Lifecycle guarantees:
 * - Created once per compare session (deps: active/mainMap only — NEVER the
 *   divider position, zoom, camera, theme, or data identity).
 * - Camera syncs ONE WAY (main → overlay jumpTo); the overlay is
 *   `interactive:false`, so no move ping-pong is possible.
 * - Theme switches restyle the existing map (setStyle) — never recreate it.
 * - Cleanup removes the map, the move listener, and the ResizeObserver; canvas
 *   count returns to 1 after every close.
 */
export function useFloodCompareOverlay({
  mainMap,
  active,
  data,
  theme,
}: UseFloodCompareOverlayArgs) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<MaplibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  // Mirror of mapReady for non-React callbacks (feed guards).
  const mapReadyRef = useRef(false);
  // Data/theme mirrored in refs so the create effect never depends on them.
  const dataRef = useRef<FloodCompareData | null>(data);
  const detailRef = useRef<FeatureCollection<unknown> | null>(null);
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);
  const appliedStyleRef = useRef(styleFor(theme));

  const setSrc = (
    m: MaplibreMap,
    id: string,
    fc: FeatureCollection<unknown>,
  ) => {
    const src = m.getSource(id);
    if (src && "setData" in src)
      (src as { setData: (d: FeatureCollection<unknown>) => void }).setData(fc);
  };

  // Fine-hex ↔ detail hand-off (same rule as side A on the main map): fine hex
  // extends past the detail band until real viewport detail has features.
  const applyDetailRange = useCallback((m: MaplibreMap) => {
    const fine = FLOOD_HEX_LEVELS.find((l) => l.key === "fine");
    if (!fine) return;
    const hasDetail = Boolean(detailRef.current?.features.length);
    const maxZoom = hasDetail ? fine.maxZoom : 24;
    ["flood-b-fine-fill", "flood-b-fine-line"].forEach((id) => {
      if (m.getLayer(id)) m.setLayerZoomRange(id, fine.minZoom, maxZoom);
    });
  }, []);

  // Feed the current side-B data into the (already installed) sources.
  const feed = useCallback(
    (m: MaplibreMap) => {
      if (!m.getSource(B_SOURCES[0])) return;
      FLOOD_HEX_LEVELS.forEach((lvl) =>
        setSrc(m, `flood-b-${lvl.key}`, dataRef.current?.[lvl.key] ?? EMPTY),
      );
      setSrc(m, "flood-b-detail", detailRef.current ?? EMPTY);
      applyDetailRange(m);
    },
    [applyDetailRange],
  );

  // Install side B's sources + banded layers (idempotent), EMPTY. Data is fed
  // only after the overlay reaches its first idle — feeding geojson while the
  // style is still bringing itself up was observed to wedge MapLibre's render
  // loop (style.loaded() stuck false → "idle" never fires → no divider). Runs
  // on first style.load and after each theme swap; colour is re-read from the
  // design tokens so it follows the theme.
  const installLayers = useCallback(
    (m: MaplibreMap) => {
      const color = readCssColor(FLOOD_COMPARE_SIDES.b.cssVar);
      const addLayer = (spec: Parameters<MaplibreMap["addLayer"]>[0]) => {
        if (!m.getLayer(spec.id)) m.addLayer(spec);
      };
      FLOOD_HEX_LEVELS.forEach((lvl) => {
        const src = `flood-b-${lvl.key}`;
        if (!m.getSource(src)) m.addSource(src, { type: "geojson", data: EMPTY });
        addLayer({
          id: `${src}-fill`,
          type: "fill",
          source: src,
          minzoom: lvl.minZoom,
          maxzoom: lvl.maxZoom,
          paint: {
            "fill-color": color,
            "fill-opacity": 0.4,
            "fill-outline-color": color,
          },
        });
        addLayer({
          id: `${src}-line`,
          type: "line",
          source: src,
          minzoom: lvl.minZoom,
          maxzoom: lvl.maxZoom,
          paint: {
            "line-color": color,
            "line-width": lvl.lineWidth,
            "line-opacity": 0.6,
          },
        });
      });
      if (!m.getSource("flood-b-detail"))
        m.addSource("flood-b-detail", { type: "geojson", data: EMPTY });
      addLayer({
        id: "flood-b-detail-fill",
        type: "fill",
        source: "flood-b-detail",
        minzoom: FLOOD_DETAIL_MIN_ZOOM,
        paint: { "fill-color": color, "fill-opacity": 0.4 },
      });
      addLayer({
        id: "flood-b-detail-line",
        type: "line",
        source: "flood-b-detail",
        minzoom: FLOOD_DETAIL_MIN_ZOOM,
        paint: { "line-color": color, "line-width": 1.2, "line-opacity": 0.9 },
      });
      // Theme re-install happens on a LIVE map — re-feed immediately. The
      // initial install stays empty; markReady feeds after the first idle.
      if (mapReadyRef.current) feed(m);
    },
    [feed],
  );

  // ── create/destroy the overlay map — ONCE per compare session ──────────────
  useEffect(() => {
    if (!active || !mainMap) return;
    let cancelled = false;
    let overlay: MaplibreMap | null = null;
    let sync: (() => void) | null = null;
    let ro: ResizeObserver | null = null;
    let readyTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      try {
        const mod = await import("maplibre-gl");
        const maplibregl = mod.default ?? mod;
        if (cancelled || !containerRef.current) return;

        appliedStyleRef.current = styleFor(themeRef.current);
        overlay = new maplibregl.Map({
          container: containerRef.current,
          style: appliedStyleRef.current,
          center: mainMap.getCenter(),
          zoom: mainMap.getZoom(),
          bearing: mainMap.getBearing(),
          pitch: mainMap.getPitch(),
          // Display-only: the main map owns ALL interaction, so there is
          // exactly ONE camera authority and no sync ping-pong.
          interactive: false,
          attributionControl: false,
        });
        overlayRef.current = overlay;
        devLog("created");
        if (DEV) {
          // Dev-only handle for console diagnostics (never in production).
          (window as unknown as Record<string, unknown>).__cmpOverlay = overlay;
        }

        overlay.on("error", (e) =>
          console.error("[compare-overlay]", e.error ?? e),
        );

        // ONE-WAY camera sync: main → overlay. jumpTo is a pure camera update
        // (no animation, no data work); the overlay emits no user move events.
        sync = () => {
          overlayRef.current?.jumpTo({
            center: mainMap.getCenter(),
            zoom: mainMap.getZoom(),
            bearing: mainMap.getBearing(),
            pitch: mainMap.getPitch(),
          });
        };
        mainMap.on("move", sync);

        ro = new ResizeObserver(() => overlayRef.current?.resize());
        ro.observe(containerRef.current);

        // Install on style.load (fires as soon as the style JSON is parsed) —
        // NOT on "load", which additionally waits for a visually-complete
        // first render and can be delayed many seconds while the main thread
        // is busy committing the compare data to the main map. Sources are
        // installed EMPTY; the data is fed by markReady after the basemap's
        // first idle (with a short fallback timer as a safety net).
        const markReady = (via: string) => {
          if (cancelled || mapReadyRef.current || !overlay) return;
          mapReadyRef.current = true;
          devLog(`ready (${via})`);
          feed(overlay);
          setMapReady(true);
        };
        overlay.once("style.load", () => {
          if (cancelled || !overlay) return;
          devLog("style loaded");
          installLayers(overlay);
          overlay.once("idle", () => markReady("idle"));
          readyTimer = setTimeout(() => markReady("timeout"), 2500);
        });
      } catch (err) {
        console.error("[compare-overlay] init failed", err);
      }
    })();

    return () => {
      cancelled = true;
      if (readyTimer) clearTimeout(readyTimer);
      if (sync) mainMap.off("move", sync);
      ro?.disconnect();
      detailRef.current = null;
      overlayRef.current = null;
      overlay?.remove();
      mapReadyRef.current = false;
      setMapReady(false);
      devLog("removed");
    };
  }, [active, mainMap, installLayers, feed]);

  // ── feed data when it arrives/changes (no map recreation) ──────────────────
  useEffect(() => {
    dataRef.current = data;
    const m = overlayRef.current;
    if (m && mapReadyRef.current) feed(m);
  }, [data, feed, mapReady]);

  // ── theme: restyle the EXISTING overlay map — never recreate it ────────────
  useEffect(() => {
    const m = overlayRef.current;
    if (!m) return;
    const next = styleFor(theme);
    if (next === appliedStyleRef.current) return;
    appliedStyleRef.current = next;
    m.setStyle(next, { diff: false });
    m.once("style.load", () => installLayers(m));
  }, [theme, installLayers]);

  // Feed (or clear) side B's high-zoom viewport detail — called once per
  // debounced moveend fetch, never while dragging.
  const setOverlayDetail = useCallback(
    (fc: FeatureCollection<unknown> | null) => {
      detailRef.current = fc;
      const m = overlayRef.current;
      if (!m || !mapReadyRef.current || !m.getSource("flood-b-detail")) return;
      setSrc(m, "flood-b-detail", fc ?? EMPTY);
      applyDetailRange(m);
    },
    [applyDetailRange],
  );

  return {
    /** Attach to the overlay map's container div (inside the clipped wrapper). */
    overlayContainerRef: containerRef,
    /** True once the overlay map is idle AND side-B data has been fed. */
    overlayReady: mapReady && Boolean(data),
    setOverlayDetail,
  };
}
