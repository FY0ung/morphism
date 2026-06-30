"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readMapPalette } from "@/lib/map-tokens";
import { BASEMAP_STYLE } from "./use-morphism-map";
import { emptyFC } from "@/types";
import type { FeatureCollection, FloodFC, FloodProps } from "@/types";

const empty = (): FloodFC => emptyFC<FloodProps>();

type MaplibreMap = import("maplibre-gl").Map;
type GeoSource = { setData: (d: FloodFC) => void };

const SOURCE = "flood-swipe";
// Default-props payload for the initial addSource (satisfies maplibre's typing);
// the real polygons are pushed via the cast setData below.
const EMPTY_SOURCE: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
// Clip stays inside [4, 96] so a sliver of each side is always visible — mirrors
// the reference `setSwipe` clamp.
const MIN = 4;
const MAX = 96;
const clamp = (n: number) => Math.max(MIN, Math.min(MAX, n));

interface UseFloodSwipeArgs {
  /** Whether the compare overlay is on. */
  active: boolean;
  /** The main map instance (basemap beneath) — the overlay locks onto its camera. */
  mainMap: MaplibreMap | null;
  /** Polygons drawn in the clipped overlay (left side / year A). */
  data?: FloodFC;
}

/**
 * Owns the SECOND MapLibre instance that is overlaid on the workspace for the
 * flood swipe-compare. It mirrors the camera of the main map (so panning/zooming
 * stays in lockstep) and exposes the clip percentage that the divider drives.
 * Mirrors the lifecycle pattern of `use-morphism-map`.
 */
export function useFloodSwipe({ active, mainMap, data }: UseFloodSwipeArgs) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const swipeMapRef = useRef<MaplibreMap | null>(null);
  const dataRef = useRef<FloodFC>(data ?? empty());
  const [ready, setReady] = useState(false);
  const [clip, setClipState] = useState(50);

  const setClip = useCallback((pct: number) => setClipState(clamp(pct)), []);

  // ── init / teardown the overlay map when the mode toggles ──
  useEffect(() => {
    if (!active || !mainMap) return;
    let cancelled = false;
    let map: MaplibreMap | null = null;
    let onMove: (() => void) | null = null;

    setClipState(50); // re-centre the divider on each open
    setReady(false);

    void (async () => {
      // maplibre-gl is CommonJS; under the bundler's ESM interop `.default`
      // can be undefined, so fall back to the module namespace itself.
      const mod = await import("maplibre-gl");
      const maplibregl = mod.default ?? mod;
      if (cancelled || !containerRef.current) return;

      const palette = readMapPalette();
      map = new maplibregl.Map({
        container: containerRef.current,
        style: BASEMAP_STYLE,
        center: mainMap.getCenter(),
        zoom: mainMap.getZoom(),
        bearing: mainMap.getBearing(),
        pitch: mainMap.getPitch(),
        interactive: false,
        attributionControl: false,
      });
      swipeMapRef.current = map;

      map.on("load", () => {
        if (cancelled || !map) return;
        map.addSource(SOURCE, { type: "geojson", data: EMPTY_SOURCE });
        map.addLayer({
          id: SOURCE,
          type: "fill",
          source: SOURCE,
          paint: { "fill-color": palette.flood, "fill-opacity": 0.35 },
        });
        // Populate immediately — the data sync effect only fires on later changes.
        const src = map.getSource(SOURCE);
        if (src && "setData" in src) (src as GeoSource).setData(dataRef.current);
        map.resize();
        setReady(true);
      });

      // Keep the overlay camera locked to the main map.
      onMove = () => {
        if (!map) return;
        map.jumpTo({
          center: mainMap.getCenter(),
          zoom: mainMap.getZoom(),
          bearing: mainMap.getBearing(),
          pitch: mainMap.getPitch(),
        });
      };
      mainMap.on("move", onMove);
    })();

    return () => {
      cancelled = true;
      setReady(false);
      if (onMove) mainMap.off("move", onMove);
      swipeMapRef.current = null;
      map?.remove();
    };
  }, [active, mainMap]);

  // ── keep the overlay polygons in sync ──
  useEffect(() => {
    dataRef.current = data ?? empty();
    const map = swipeMapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(SOURCE);
    if (src && "setData" in src) {
      (src as GeoSource).setData(dataRef.current);
    }
  }, [data, ready]);

  return { containerRef, ready, clip, setClip };
}
