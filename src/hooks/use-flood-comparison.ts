"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getFloodAreas,
  getFloodOverviewAsset,
  getFloodOverviewByKey,
  getFloodStats,
} from "@/lib/api";
import { floodPmtilesEnabled, floodPmtilesUrl } from "@/configs/flood-data";
import { endpoint } from "@/configs/endpoint";
import { areaKm2, bboxOf } from "@/lib/geo";
import {
  buildFloodDetailIndex,
  bboxContains,
  padBBox,
  sliceFloodDetail,
  FLOOD_VIEWPORT_MAX_VERTICES,
  FLOOD_VIEWPORT_PREFETCH_MAX_VERTICES,
  type BBoxTuple,
  type FloodDetailIndex,
} from "@/lib/flood-viewport";
import {
  buildFloodSampleIndex,
  createFloodHexOverview,
  FLOOD_DETAIL_MIN_ZOOM,
  FLOOD_DETAIL_PREFETCH_ZOOM,
} from "@/lib/flood-overview";
import { useFloodCompareOverlay } from "./use-flood-compare-overlay";
import { useFloodSwipe } from "./use-flood-swipe";
import type { FloodCompareData } from "./use-morphism-map";
import type { TFunction } from "@/languages/types";
import type {
  BBox,
  ChartData,
  FeatureCollection,
  MapBounds,
  ScenarioOutcome,
  ScenarioStepReporter,
  SwipeCompare as SwipeCompareState,
} from "@/types";

type MaplibreMap = import("maplibre-gl").Map;

interface UseFloodComparisonArgs {
  map: MaplibreMap | null;
  theme?: string;
  t: TFunction;
  /** Camera fit duration for the union of both extents (same constant the
   *  single-date flow uses). */
  fitDuration: number;
  /** Feed side A's hex LODs (+ optional PMTiles URL) into the MAIN map. */
  setFloodCompare: (data: FloodCompareData | null, pmUrl?: string | null) => void;
  /** Feed side A's high-zoom viewport detail into the MAIN map. */
  setFloodCompareDetail: (fc: FeatureCollection<unknown> | null) => void;
  fitBoundsAndWait: (b: MapBounds) => Promise<void>;
  showToast: (message: string) => void;
  /**
   * Reset every NON-compare overlay/scenario state before a session opens
   * (owned by the view: point override, aggregates, boundaries, admin scope,
   * single-date flood machine, layer set). Behaviour-identical to the old
   * inline openCompare resets.
   */
  resetForCompare: () => void;
  /** Build the final chat message + chart from the REAL measured areas
   *  (injected so this hook stays independent of the scenario module). */
  buildOutcome: (
    args: { labelA: string; labelB: string; km2A: number; km2B: number },
    t: TFunction,
  ) => { message: string; charts: ChartData[] };
}

/**
 * The flood swipe-compare SESSION — extracted whole from MorphismView
 * (Phase 3B): selection state, side-B overlay map, data loading (PMTiles-first
 * with geojson fallback), in-memory viewport detail slicing, divider state and
 * open/close/reopen lifecycle. The view composes it; MapLibre work stays in
 * use-morphism-map / use-flood-compare-overlay.
 */
export function useFloodComparison({
  map,
  theme,
  t,
  fitDuration,
  setFloodCompare,
  setFloodCompareDetail,
  fitBoundsAndWait,
  showToast,
  resetForCompare,
  buildOutcome,
}: UseFloodComparisonArgs) {
  // Which two dates are being compared. Side A draws on the main map; side B
  // on a display-only OVERLAY map the divider reveals with CSS clip-path.
  const [swipe, setSwipe] = useState<SwipeCompareState | null>(null);
  // Side B's hex LODs — null until the compare fetch resolves.
  const [swipeB, setSwipeB] = useState<FloodCompareData | null>(null);
  // Side B's PMTiles detail URL (pmtiles mode; null in the geojson fallback).
  const [swipeBPmUrl, setSwipeBPmUrl] = useState<string | null>(null);
  // Wrapper of the overlay map — the divider writes clip-path on this node.
  const overlayWrapRef = useRef<HTMLDivElement | null>(null);
  // Per-feature bbox indexes over each side's ALREADY-LOADED full detail
  // (built once at compare open). High-zoom detail is sliced from these in
  // memory — never fetched from the slow bbox proxy.
  const cmpDetailIdxARef = useRef<FloodDetailIndex | null>(null);
  const cmpDetailIdxBRef = useRef<FloodDetailIndex | null>(null);
  // In-flight controller + monotonic id (same pattern as the single-date flood
  // run, so a superseded compare can never commit late).
  const compareAbortRef = useRef<AbortController | null>(null);
  const compareRequestIdRef = useRef(0);

  // Swipe-compare overlay map (side B). Created once per compare session,
  // camera-synced one-way from the main map, destroyed on close.
  const { overlayContainerRef, overlayReady, setOverlayDetail } =
    useFloodCompareOverlay({
      mainMap: map,
      active: swipe !== null,
      data: swipeB,
      pmUrl: swipeBPmUrl,
      theme,
    });

  // Committed divider position (rAF-drag lives inside SwipeCompare; React
  // state updates ONCE on pointerup / keyboard step — never per pointermove).
  const { clip, setClip } = useFloodSwipe({ active: swipe !== null });

  // Fetch each side's live extent, measure the flooded area, draw both layers,
  // frame the union, and report the computed message + chart back to the chat.
  const runFloodCompare = useCallback(
    async (
      sel: SwipeCompareState,
      report?: ScenarioStepReporter,
    ): Promise<ScenarioOutcome> => {
      const errorMsg = t("morphism.flood.error");
      compareAbortRef.current?.abort();
      const controller = new AbortController();
      compareAbortRef.current = controller;
      const requestId = ++compareRequestIdRef.current;
      const stale = () =>
        controller.signal.aborted || requestId !== compareRequestIdRef.current;
      const since = (t0: number) => Math.round(performance.now() - t0);

      // Load ONE side (geojson fallback): live extent for area/bbox + hex LODs
      // from the CDN overview asset when available.
      const loadSide = async (
        date: string,
      ): Promise<{
        km2: number;
        data: FloodCompareData;
        bbox: BBox;
        detailIndex: FloodDetailIndex;
      } | null> => {
        const resp = await getFloodAreas(date, controller.signal);
        if (!resp.features.length) return null;
        const bbox = bboxOf(resp);
        if (!bbox) return null;
        let data: FloodCompareData | null = null;
        if (endpoint.flood.assetBase) {
          try {
            data = await getFloodOverviewAsset(date, controller.signal);
          } catch {
            data = null; // fall through to detail-derived hexes
          }
        }
        if (
          !data ||
          !(
            data.coarse.features.length ||
            data.medium.features.length ||
            data.fine.features.length
          )
        ) {
          const idx = buildFloodSampleIndex(resp);
          data = {
            coarse: createFloodHexOverview(idx, 45, "coarse"),
            medium: createFloodHexOverview(idx, 24, "medium"),
            fine: createFloodHexOverview(idx, 12, "fine"),
          };
        }
        return {
          km2: areaKm2(resp),
          data,
          bbox,
          detailIndex: buildFloodDetailIndex(resp),
        };
      };

      report?.done(0, 0); // resolve_periods — instant
      const tLoad = performance.now();
      try {
        // ── PMTILES MODE: stats + overview per side (a few KB each). ────────
        if (floodPmtilesEnabled()) {
          const loadSidePm = async (
            date: string,
            key?: string,
          ): Promise<{
            km2: number;
            data: FloodCompareData;
            bbox: BBox;
            pmUrl: string;
          } | null> => {
            const k = key ?? date;
            const [stats, overview] = await Promise.all([
              getFloodStats(k, controller.signal),
              getFloodOverviewByKey(k, controller.signal),
            ]);
            if (!stats || stats.featureCount === 0 || !overview) return null;
            const hexCount =
              overview.coarse.features.length +
              overview.medium.features.length +
              overview.fine.features.length;
            if (!hexCount) return null;
            return {
              km2: stats.areaKm2,
              data: overview,
              bbox: stats.bbox as BBox,
              pmUrl: floodPmtilesUrl(k),
            };
          };
          try {
            const [A, B] = await Promise.all([
              loadSidePm(sel.dateA, sel.keyA),
              loadSidePm(sel.dateB, sel.keyB),
            ]);
            if (stale()) return { ok: true };
            if (A && B) {
              report?.done(1, since(tLoad));
              const tMeasure = performance.now();
              // No geojson indexes in pmtiles mode — tiles stream per viewport.
              cmpDetailIdxARef.current = null;
              cmpDetailIdxBRef.current = null;
              setFloodCompare(A.data, A.pmUrl);
              setSwipeB(B.data);
              setSwipeBPmUrl(B.pmUrl);
              report?.done(2, since(tMeasure));

              await fitBoundsAndWait({
                sw: [
                  Math.min(A.bbox[0], B.bbox[0]),
                  Math.min(A.bbox[1], B.bbox[1]),
                ],
                ne: [
                  Math.max(A.bbox[2], B.bbox[2]),
                  Math.max(A.bbox[3], B.bbox[3]),
                ],
                duration: fitDuration,
              });
              if (stale()) return { ok: true };

              const { message, charts } = buildOutcome(
                {
                  labelA: sel.labelA,
                  labelB: sel.labelB,
                  km2A: A.km2,
                  km2B: B.km2,
                },
                t,
              );
              showToast(t("morphism.toast.applied"));
              return { ok: true, message, charts };
            }
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError")
              throw err;
            // assets missing/unreachable → geojson fallback below
          }
          setSwipeBPmUrl(null);
        }

        // ── GEOJSON FALLBACK: both sides in parallel. ────────────────────────
        const [A, B] = await Promise.all([
          loadSide(sel.dateA),
          loadSide(sel.dateB),
        ]);
        if (stale()) return { ok: true };
        if (!A || !B) {
          report?.fail(1, since(tLoad));
          return { ok: false, message: errorMsg };
        }
        report?.done(1, since(tLoad));

        const tMeasure = performance.now();
        cmpDetailIdxARef.current = A.detailIndex;
        cmpDetailIdxBRef.current = B.detailIndex;
        setFloodCompare(A.data);
        setSwipeB(B.data);
        report?.done(2, since(tMeasure));

        await fitBoundsAndWait({
          sw: [Math.min(A.bbox[0], B.bbox[0]), Math.min(A.bbox[1], B.bbox[1])],
          ne: [Math.max(A.bbox[2], B.bbox[2]), Math.max(A.bbox[3], B.bbox[3])],
          duration: fitDuration,
        });
        if (stale()) return { ok: true };

        const { message, charts } = buildOutcome(
          { labelA: sel.labelA, labelB: sel.labelB, km2A: A.km2, km2B: B.km2 },
          t,
        );
        showToast(t("morphism.toast.applied"));
        return { ok: true, message, charts };
      } catch {
        if (stale()) return { ok: true };
        report?.fail(1);
        return { ok: false, message: errorMsg };
      }
    },
    [setFloodCompare, fitBoundsAndWait, fitDuration, showToast, t, buildOutcome],
  );

  // Open (or RE-open) a compare session — ONE shared path for the scenario
  // branch and the chat card's reopen action.
  const openCompare = useCallback(
    (
      sel: SwipeCompareState,
      report?: ScenarioStepReporter,
    ): Promise<void | ScenarioOutcome> => {
      resetForCompare();
      // Clear the previous session's side-B data BEFORE opening the new one,
      // so the overlay can never flash a stale year while the fetch runs.
      setSwipeB(null);
      setSwipeBPmUrl(null);
      setFloodCompare(null);
      setSwipe(sel);
      return Promise.resolve(runFloodCompare(sel, report));
    },
    [resetForCompare, runFloodCompare, setFloodCompare],
  );

  // Close from the divider UI: abort any in-flight fetch so it can't re-draw
  // after close, then drop the session.
  const closeCompare = useCallback(() => {
    compareAbortRef.current?.abort();
    compareRequestIdRef.current += 1;
    setSwipe(null);
    setSwipeB(null);
    setSwipeBPmUrl(null);
    setFloodCompare(null);
  }, [setFloodCompare]);

  // Non-swipe scenario applied → the compare session ends (same state clears
  // the old inline path performed; the request id/abort is handled by the
  // scenario flow itself, exactly as before).
  const detachCompare = useCallback(() => {
    setSwipe(null);
    setSwipeB(null);
    setSwipeBPmUrl(null);
    setFloodCompare(null);
  }, [setFloodCompare]);

  // Full reset (scene undo to blank map): abort + supersede + clear.
  const abortAndClearCompare = useCallback(() => {
    compareAbortRef.current?.abort();
    compareRequestIdRef.current += 1;
    detachCompare();
  }, [detachCompare]);

  // High-zoom REAL detail for compare — sliced LOCALLY from the per-feature
  // bbox indexes built at compare open. Debounced on moveend; starts at the
  // PREFETCH band so polygons are tiled before they become visible.
  useEffect(() => {
    if (!swipe || !map || !swipeB) return;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let sliced: BBoxTuple | null = null;
    let slicedTruncated = false;
    const update = () => {
      const zoom = map.getZoom();
      if (zoom < FLOOD_DETAIL_PREFETCH_ZOOM) return; // hex bands cover this
      const idxA = cmpDetailIdxARef.current;
      const idxB = cmpDetailIdxBRef.current;
      if (!idxA || !idxB) return;
      const b = map.getBounds();
      const view: BBoxTuple = [
        b.getWest(),
        b.getSouth(),
        b.getEast(),
        b.getNorth(),
      ];
      if (sliced && !slicedTruncated && bboxContains(sliced, view)) return;
      const padded = padBBox(view);
      const budget =
        zoom >= FLOOD_DETAIL_MIN_ZOOM
          ? FLOOD_VIEWPORT_MAX_VERTICES
          : FLOOD_VIEWPORT_PREFETCH_MAX_VERTICES;
      const t0 = performance.now();
      const a = sliceFloodDetail(idxA, padded, budget);
      const bSlice = sliceFloodDetail(idxB, padded, budget);
      sliced = padded;
      slicedTruncated = a.truncated || bSlice.truncated;
      setFloodCompareDetail(a.fc);
      setOverlayDetail(bSlice.fc);
      if (process.env.NODE_ENV !== "production") {
        console.log("[compare-detail] slice", {
          zoom: map.getZoom().toFixed(1),
          a: a.fc.features.length,
          b: bSlice.fc.features.length,
          truncated: slicedTruncated,
          ms: Math.round(performance.now() - t0),
        });
      }
    };
    const onMove = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(update, 200);
    };
    map.on("moveend", onMove);
    update();
    return () => {
      map.off("moveend", onMove);
      if (debounce) clearTimeout(debounce);
      setFloodCompareDetail(null);
      setOverlayDetail(null);
    };
  }, [swipe, swipeB, map, setFloodCompareDetail, setOverlayDetail]);

  // Detail indexes live exactly as long as the compare session.
  useEffect(() => {
    if (swipe === null) {
      cmpDetailIdxARef.current = null;
      cmpDetailIdxBRef.current = null;
    }
  }, [swipe]);

  return {
    swipe,
    openCompare,
    closeCompare,
    detachCompare,
    abortAndClearCompare,
    overlayWrapRef,
    overlayContainerRef,
    overlayReady,
    clip,
    setClip,
  };
}
