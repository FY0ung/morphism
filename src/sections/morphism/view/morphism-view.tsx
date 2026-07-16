"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import {
  useAdminBoundaries,
  useAdminHierarchy,
  useAiAssistant,
  useChatResizer,
  useFloodComparison,
  useMapLayers,
  useMorphismMap,
  useSceneHistory,
} from "@/hooks";
import {
  getFloodAreas,
  getFloodBufferAnalysis,
  getFloodOverviewAsset,
  getFloodOverviewByKey,
  getFloodStats,
  getProvinceBoundaries,
  getHospitals,
} from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { floodPmtilesEnabled, floodPmtilesUrl } from "@/configs/flood-data";
import { endpoint } from "@/configs/endpoint";
import { CAMERA } from "@/configs/motion";
import { cn } from "@/lib/utils";
import type {
  BBox,
  FeatureCollection,
  FloodAreaFC,
  FloodScenarioMeta,
  HospitalFC,
  LayerId,
  LayoutDirection,
  Position,
  ProvinceBoundaryFC,
  ProvinceCount,
  Scenario,
  ScenarioStepReporter,
  ScenarioOutcome,
  SwipeCompare as SwipeCompareState,
} from "@/types";
import {
  resolveScenario,
  MOCK_HOSPITALS,
  buildFloodCompareOutcome,
  REGION_TOKEN_VAR,
  REGION_DEFAULT_TOKEN,
  provinceRegion,
  compareLegend as buildCompareLegend,
  type Lang,
} from "../const";
import { readCssColor } from "@/lib/map-tokens";
import { bboxOf, normalizeProvinceName } from "@/lib/geo";
import { formatDate } from "@/lib/flood-date";
import { buildProvinceCounts } from "@/lib/hospital-stats";
import { filterHospitalsByScope } from "@/lib/hospital-filter";
import {
  buildFloodHexLevels,
  type FloodHexOverview,
} from "@/lib/flood-overview";
import {
  ChatPanel,
  HistoryControls,
  LayerFab,
  LayerPanel,
  Legend,
  MapCanvas,
  MapLoadingOverlay,
  MapTopBar,
  Resizer,
  SettingsPopover,
  SwipeCompare,
  Toast,
  ZoomControls,
} from "../layout";
import { Tag } from "@/components/selection/Tag";

const TOAST_MS = 2200;
// No mock geometry — layers without real data render nothing (empty source).
const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };
// Flood camera transition — centralized in configs/motion (same value).
const FLOOD_FIT_DURATION = CAMERA.floodFit;

/**
 * Explicit flood-scenario lifecycle. Completion ("complete") is only reached
 * AFTER the data is committed to the map source AND the camera transition has
 * finished (moveend) — so the chat/tool-steps never report done before the map
 * has actually updated.
 */
type FloodScenarioStatus =
  | "idle"
  | "loading-data"
  | "updating-map"
  | "moving-camera"
  | "complete"
  | "empty"
  | "error";

const MorphismView = () => {
  const { t, i18n } = useTranslation();
  // Active scenario display language (default English; Thai and Japanese also
  // supported). Kept in sync with the i18n language so every runtime-built
  // string (results, dates, chart labels) follows the active locale.
  const lang: Lang =
    i18n.language === "th" ? "th" : i18n.language === "ja" ? "ja" : "en";
  // Basemap follows the UI theme (next-themes). Undefined on first paint → the
  // hook defaults to dark, matching the app default (no hydration mismatch).
  const { resolvedTheme } = useTheme();

  const [direction, setDirection] = useState<LayoutDirection>("ltr");
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeActive, setTimeActive] = useState(false);
  const [timeLabel, setTimeLabel] = useState<string | null>(null);
  // Province-aggregation summary currently on the map (for the legend).
  const [aggregate, setAggregateState] = useState<ProvinceCount[] | null>(null);
  // Region-compare legend rows (label + colour class), null when not comparing.
  const [compareLegend, setCompareLegend] = useState<
    { label: string; swatch: string }[] | null
  >(null);
  // Active boundary colour (same source as the polygons) → legend swatch.
  const [boundaryColor, setBoundaryColor] = useState<string | null>(null);
  // Real province polygons fetched from the open GeoJSON service. A version
  // counter bumps when they arrive so a scenario that ran BEFORE the fetch
  // completed can redraw its region boundaries (fixes "labels but no polygons").
  const boundariesRef = useRef<ProvinceBoundaryFC | null>(null);
  const [boundariesVersion, setBoundariesVersion] = useState(0);
  const [boundariesError, setBoundariesError] = useState(false);
  // Last aggregate scenario — replayed when the province polygons finish loading.
  const pendingAggScenarioRef = useRef<Scenario | null>(null);
  // Real hospital points (public registry, 10k+). Fed to the map source so the
  // zoom gate has actual data to reveal at zoom ≥ 11.8.
  const [hospitalsFC, setHospitalsFC] = useState<HospitalFC | null>(null);
  // For the flood-buffer scenario: only the hospitals inside the 5 km buffer
  // (flagged risk → red). Null = feed the full dataset.
  const [pointOverride, setPointOverride] = useState<HospitalFC | null>(null);
  // Active 5 km flood-proximity analysis (REAL server-side result): resolved
  // snapshot date label + partial flag — drives the legend. Null = not active.
  const [bufferAnalysis, setBufferAnalysis] = useState<{
    dateLabel: string;
    partial: boolean;
  } | null>(null);
  // REAL dissolved 5 km buffer geometry (precomputed asset for the resolved
  // snapshot) — rendered as the green analysis zone. Null = empty source.
  const [bufferGeometry, setBufferGeometry] = useState<FeatureCollection | null>(
    null,
  );
  // Live flood areas for the active date-based flood scenario (Vallaris via the
  // /api/flood proxy). Null → the flood source is EMPTY (no mock geometry; the
  // layer renders nothing until real data is committed).
  const [floodAreas, setFloodAreas] = useState<FloodAreaFC | null>(null);
  // Active date-based flood scenario metadata (STABLE PRIMITIVES drive the fetch
  // effect — never the fetched FeatureCollection). Null when not in flood mode.
  const [floodMeta, setFloodMeta] = useState<FloodScenarioMeta | null>(null);
  // True when the proxy returned a partial sample (dev fixture / truncated).
  const [floodPartial, setFloodPartial] = useState(false);
  // Explicit flood load state machine. Drives an ATOMIC transition: during
  // "loading" the current map (basemap + previous geometry) is preserved and the
  // camera never moves; only on "success" is the source replaced in one shot,
  // the flood layer revealed, and the camera fitted exactly once.
  const [floodStatus, setFloodStatus] = useState<FloodScenarioStatus>("idle");
  // Monotonic request id → ignore stale responses (rapid re-query / switch-away).
  const floodRequestIdRef = useRef(0);
  // Bounds already fitted (keyed by scenario+bbox) → fitBounds runs once/dataset.
  const floodBoundsRef = useRef<string | null>(null);
  // In-flight flood request controller → aborted when a new scenario starts.
  const floodAbortRef = useRef<AbortController | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Scene-level undo/redo — extracted to useSceneHistory (Phase 3B) ──────
  // The hook owns the history bookkeeping; HOW a scene is applied stays here
  // (assigned into applyReplayRef once onScenario/clearScene exist below —
  // an effect keeps the assignment out of render).
  const applyReplayRef = useRef<(s: Scenario | null) => void>(() => {});
  const {
    nav: sceneNav,
    record: recordScene,
    undo: sceneUndo,
    redo: sceneRedo,
  } = useSceneHistory(
    useCallback((s: Scenario | null) => applyReplayRef.current(s), []),
  );

  const {
    layers,
    visibleCount,
    toggleLayer,
    applyExact,
  } = useMapLayers();

  const { width, active, onPointerDown, onKeyDown, rootRef } = useChatResizer(direction);
  // Layer data for the map. The flood layer carries ONLY real processed data
  // (never mock geometry — no data means an empty layer), and the manual
  // administrative-boundaries layer is fed separately by useAdminBoundaries.
  // Memoised so the map's data-sync effect only fires when the data changes.
  const mapData = useMemo(
    () => ({
      // Buffer scenario feeds only the analysis-result subset; otherwise full.
      hospitals: pointOverride ?? hospitalsFC ?? MOCK_HOSPITALS,
      // REAL dissolved 5 km zone (precomputed offline from the SAME flood
      // snapshot as the spatial query) — never mock geometry.
      buffer: bufferGeometry ?? EMPTY_FC,
      // Live flood areas only — real data flow, no mock fallback.
      flood: floodAreas ?? EMPTY_FC,
    }),
    [hospitalsFC, pointOverride, bufferGeometry, floodAreas],
  );

  // Popup body for a clicked hospital point — name + 24h status (i18n), mirrors
  // the HTML popup. Read via a ref inside the map hook, so identity is free.
  const hospitalPopupHtml = useCallback(
    (name: string, h24: boolean) => {
      const esc = (s: string) =>
        s.replace(
          /[&<>"]/g,
          (c) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
        );
      const statusText = h24
        ? t("morphism.popup.open24")
        : t("morphism.popup.normalHours");
      return `<b>${esc(name)}</b><br><span style="color:var(--color-text-success-onlight);font-size:12px">${esc(statusText)}</span>`;
    },
    [t],
  );

  const {
    containerRef,
    map,
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
  } = useMorphismMap({
    layers,
    data: mapData,
    theme: resolvedTheme,
    hospitalPopupHtml,
  });


  // Manual "Administrative boundaries" layer: REAL zoom-banded admin hierarchy
  // (region → province → district → subdistrict) from the open ADM datasets.
  const regionVarFor = useCallback(
    (provinceName: string) =>
      REGION_TOKEN_VAR[provinceRegion(provinceName) ?? ""] ??
      REGION_DEFAULT_TOKEN,
    [],
  );
  const adminBounds = useAdminBoundaries({
    map,
    visible: layers.boundaries.visible,
    theme: resolvedTheme,
    regionVarFor,
  });
  // Push the computed level FC into the map's `boundaries` source (ref-backed,
  // so a theme style swap re-feeds the same data).
  useEffect(() => {
    setAdminBoundaries(adminBounds.fc);
  }, [adminBounds.fc, setAdminBoundaries]);

  // Scope for the zoom-driven admin hierarchy: `mode` = "aggregate" (scenario
  // supplies province counts) or "points" (derive counts from the shown points);
  // null when no hospitals are on the map.
  const [admScope, setAdmScope] = useState<{
    mode: "aggregate" | "points";
    names: string[];
  } | null>(null);

  // Displayed hospital coordinates (buffer subset when active, else full set) —
  // counted inside each admin unit for the aggregation.
  const hospitalPoints = useMemo<Position[]>(() => {
    const src = pointOverride ?? hospitalsFC ?? MOCK_HOSPITALS;
    return src.features.flatMap((f) =>
      f.geometry.type === "Point" ? [f.geometry.coordinates as Position] : [],
    );
  }, [hospitalsFC, pointOverride]);

  // Stable array identity across renders — `admScope?.names ?? []` would
  // allocate a NEW array every render, which flows into the admin-hierarchy
  // hook's `compute` deps and re-subscribes its debounced recompute effect on
  // every render (→ infinite re-render loop). Memoised on admScope so it only
  // changes when the scope actually changes.
  const admNames = useMemo(() => admScope?.names ?? [], [admScope]);

  const adm = useAdminHierarchy({
    map,
    active: admScope !== null,
    mode: admScope?.mode ?? "aggregate",
    provinceNames: admNames,
    points: hospitalPoints,
    boundaryColorVar: REGION_DEFAULT_TOKEN,
    setAggregate,
    setBoundaries,
    setDistricts,
    setSubdistricts,
  });

  // Fetch the real province polygons once (client-side). On failure we keep a
  // flag so the UI shows an empty/error state instead of any fake geometry.
  // Unmount ABORTS the network request (not just ignores the result).
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const fc = await getProvinceBoundaries(controller.signal);
        if (!controller.signal.aborted) {
          boundariesRef.current = fc;
          setBoundariesError(false);
          setBoundariesVersion((v) => v + 1); // trigger redraw of pending scenario
        }
      } catch {
        if (!controller.signal.aborted) {
          boundariesRef.current = null;
          setBoundariesError(true);
        }
      }
    })();
    return () => {
      controller.abort();
    };
  }, []);

  // Fetch the real hospital points once (client-side) and feed them to the map
  // source so the zoom gate has real data to reveal at zoom ≥ 11.8.
  // Unmount ABORTS the request; no state update can land after cancellation.
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const fc = await getHospitals({}, controller.signal);
        if (!controller.signal.aborted) setHospitalsFC(fc);
      } catch {
        /* keep the mock fallback so the map still renders something */
      }
    })();
    return () => {
      controller.abort();
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // Reset every NON-compare overlay/scenario state before a compare session
  // opens — behaviour-identical to the old inline openCompare resets. Owned by
  // the view because these states belong to the other scenario domains.
  const resetForCompare = useCallback(() => {
    // Invalidate any in-flight single-date flood run so it can't commit late.
    floodAbortRef.current?.abort();
    floodRequestIdRef.current += 1;
    setPointOverride(null);
    setBufferAnalysis(null);
    setBufferGeometry(null);
    setBufferCenters(null);
    setPointsAlwaysVisible(false);
    setAggregate(null);
    setAggregateState(null);
    setBoundaries(null);
    setBoundaryColor(null);
    setCompareMode(false);
    setCompareLegend(null);
    setAdmScope(null);
    pendingAggScenarioRef.current = null;
    setFloodMeta(null);
    setFloodAreas(null);
    setFloodPartial(false);
    applyExact(["flood"]);
  }, [
    applyExact,
    setAggregate,
    setBoundaries,
    setBufferCenters,
    setPointsAlwaysVisible,
    setCompareMode,
  ]);

  // The whole swipe-compare SESSION (selection, overlay map, loading, viewport
  // slicing, divider state, open/close/reopen) — extracted to its own hook.
  const {
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
  } = useFloodComparison({
    map,
    theme: resolvedTheme,
    t,
    fitDuration: FLOOD_FIT_DURATION,
    setFloodCompare,
    setFloodCompareDetail,
    fitBoundsAndWait,
    showToast,
    resetForCompare,
    buildOutcome: buildFloodCompareOutcome,
  });

  // ONE controlled async function owns the flood scenario. The loaded
  // FeatureCollection is the SINGLE SOURCE OF TRUTH — the chat can only report
  // success when that FC actually has features; otherwise the load step is
  // marked failed and the chat shows the empty/error message (never green).
  // The hex LODs are built from that SAME geometry (never optional lat/long),
  // so the overview can't be empty while the flood layer has data.
  //
  //   loading-data  → fetch the FC; current map/camera untouched.
  //   updating-map  → commit the detail source + hex LODs + reveal flood layers.
  //   moving-camera → fitBounds once (actual bounds) and WAIT for moveend.
  //   complete      → the flood layer is visible + framed with real data.
  //   empty / error → keep the previous valid view; step FAILS, no fake success.
  const runFloodScenario = useCallback(
    async (
      meta: FloodScenarioMeta,
      report?: ScenarioStepReporter,
    ): Promise<ScenarioOutcome> => {
      const emptyMsg = `ไม่พบข้อมูลพื้นที่น้ำท่วมวันที่ ${meta.dateLabel} ในระบบขณะนี้`;
      const errorMsg = "ไม่สามารถโหลดข้อมูลพื้นที่น้ำท่วมได้ในขณะนี้";

      // Empty resolution (unknown date/month) → no dataset for this date.
      if (!meta.hasData) {
        setFloodStatus("empty");
        report?.fail(1);
        return { ok: false, message: emptyMsg };
      }
      const controller = new AbortController();
      floodAbortRef.current = controller;
      const requestId = ++floodRequestIdRef.current;
      const stale = () =>
        controller.signal.aborted || requestId !== floodRequestIdRef.current;
      const since = (t0: number) => Math.round(performance.now() - t0);

      // Step 0 · resolve_date — already parsed during query resolution (instant).
      report?.done(0, since(performance.now()));

      // Clear a stale empty/error badge WITHOUT clearing the existing layer.
      setFloodStatus("loading-data");
      try {
        const tLoad = performance.now();

        // ── PMTILES MODE ─────────────────────────────────────────────────────
        // stats.json (bbox/area/totals) + hex overview + vector tiles: the
        // complete GeoJSON is never downloaded or parsed. Any miss falls
        // through to the geojson flow below (per-request fallback).
        if (floodPmtilesEnabled()) {
          try {
            const [stats, pmOverview] = await Promise.all([
              getFloodStats(meta.date, controller.signal),
              getFloodOverviewByKey(meta.date, controller.signal),
            ]);
            if (stale()) return { ok: true };
            const pmHexCount = pmOverview
              ? pmOverview.coarse.features.length +
                pmOverview.medium.features.length +
                pmOverview.fine.features.length
              : 0;
            if (stats && stats.featureCount > 0 && pmOverview && pmHexCount > 0) {
              setFloodStatus("updating-map");
              setFloodOverview(pmOverview);
              setFloodAreas(null);
              setFloodPartial(false);
              applyExact(["flood"]);
              commitFloodTiles(floodPmtilesUrl(meta.date));
              report?.done(1, since(tLoad));
              report?.done(2, since(tLoad));

              setFloodStatus("moving-camera");
              const tCam = performance.now();
              const bb = stats.bbox;
              const key = `${meta.scenarioId}:${bb.join(",")}`;
              if (floodBoundsRef.current !== key) {
                floodBoundsRef.current = key;
                await fitBoundsAndWait({
                  sw: [bb[0], bb[1]],
                  ne: [bb[2], bb[3]],
                  duration: FLOOD_FIT_DURATION,
                });
              }
              if (stale()) return { ok: true };
              report?.done(3, since(tCam));
              setFloodStatus("complete");
              showToast(t("morphism.toast.applied"));
              return { ok: true };
            }
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") throw err;
            // asset missing/unreachable → geojson flow below
          }
          commitFloodTiles(null);
        }

        // Phase 3b · overview-first. Start the (large) detail download NOW, in the
        // background, and meanwhile fetch the tiny pre-baked hex overview from the
        // CDN so the flood layer paints INSTANTLY at the current (wide) zoom while
        // the detail streams in — no blank wait. If the asset is unavailable we
        // derive the overview from the detail instead (prior behaviour).
        const detailPromise = getFloodAreas(meta.date, controller.signal);
        let overview: FloodHexOverview | null = null;
        if (endpoint.flood.assetBase) {
          try {
            overview = await getFloodOverviewAsset(meta.date, controller.signal);
          } catch {
            overview = null; // fall through to detail-derived overview
          }
          if (stale()) return { ok: true };
          const hexCount = overview
            ? overview.coarse.features.length +
              overview.medium.features.length +
              overview.fine.features.length
            : 0;
          if (overview && hexCount > 0) {
            // Step 1 · load_flood_overview + Step 2 · add_overview_layer('flood_hex').
            setFloodStatus("updating-map");
            setFloodOverview(overview);
            applyExact(["flood"]);
            report?.done(1, since(tLoad));
            report?.done(2, since(tLoad));
          } else {
            overview = null;
          }
        }

        // Detail = SINGLE SOURCE OF TRUTH for the success/empty gate + exact
        // bounds (already in flight from above).
        const resp = await detailPromise;
        if (stale()) return { ok: true };

        // TRUTHFUL success gate: no features → the step FAILS (not green) and the
        // chat shows the empty message; the previous valid map is kept.
        const bb = resp.features.length ? bboxOf(resp) : null;
        if (!resp.features.length || !bb) {
          report?.fail(overview ? 3 : 1, since(tLoad));
          setFloodStatus("empty");
          if (overview) setFloodOverview(null); // roll back the optimistic hexes
          return { ok: false, message: emptyMsg };
        }

        if (!overview) {
          // No CDN overview → derive the hex LODs from the actual geometry.
          report?.done(1, since(tLoad));
          setFloodStatus("updating-map");
          setFloodOverview(buildFloodHexLevels(resp));
          report?.done(2, since(tLoad));
        }

        // Commit the detailed geometry (renders at zoom ≥ FLOOD_DETAIL_MIN_ZOOM).
        setFloodAreas(resp);
        setFloodPartial(Boolean(resp.partial));
        applyExact(["flood"]);
        commitFloodExtent(resp);

        // Step 3 · fit_bounds — detail is loaded, so the target zoom shows real
        // polygons (never a blank frame). One fitBounds, WAIT for moveend.
        setFloodStatus("moving-camera");
        const tCam = performance.now();
        const key = `${meta.scenarioId}:${bb.join(",")}`;
        if (floodBoundsRef.current !== key) {
          floodBoundsRef.current = key;
          await fitBoundsAndWait({
            sw: [bb[0], bb[1]],
            ne: [bb[2], bb[3]],
            duration: FLOOD_FIT_DURATION,
          });
        }
        if (stale()) return { ok: true };
        report?.done(3, since(tCam));

        // ── complete: the flood layer is visible + framed with real data. ───
        setFloodStatus("complete");
        showToast(t("morphism.toast.applied"));
        return { ok: true };
      } catch {
        if (stale()) return { ok: true };
        report?.fail(1);
        setFloodStatus("error"); // keep previous valid map state
        return { ok: false, message: errorMsg };
      }
    },
    [
      applyExact,
      commitFloodExtent,
      commitFloodTiles,
      setFloodOverview,
      fitBoundsAndWait,
      showToast,
      t,
    ],
  );

  // REAL 5 km flood-proximity analysis. ONE server request
  // (/api/flood-buffer) resolves the LATEST COMPLETE flood snapshot, loads the
  // flood detail + hospitals server-side and runs the spatial query — the
  // browser receives ONLY the matching hospital points + metadata. The flood
  // layer renders via PMTiles (never the full GeoJSON here). Step durations
  // 0–3 are the server's own measurements; step 4 (render + camera) is
  // measured here and reported only after moveend — no fake success.
  const runBufferScenario = useCallback(
    async (report?: ScenarioStepReporter): Promise<ScenarioOutcome> => {
      const controller = new AbortController();
      floodAbortRef.current = controller;
      const requestId = ++floodRequestIdRef.current;
      const stale = () =>
        controller.signal.aborted || requestId !== floodRequestIdRef.current;

      setFloodStatus("loading-data");
      try {
        const resp = await getFloodBufferAnalysis(undefined, controller.signal);
        if (stale()) return { ok: true };
        const dateLabel = formatDate(resp.date, lang);
        const partial = !resp.complete;
        // Truthful steps: relabel load_flood_event with the RESOLVED date,
        // then report the server-measured phase durations.
        report?.relabel?.(
          1,
          t("morphism.scenario.buffer.step2Resolved", { date: resp.date }),
        );
        report?.done(0, resp.timings.resolveMs);
        report?.done(1, resp.timings.floodLoadMs);
        report?.done(2, resp.timings.hospitalsLoadMs);
        report?.done(3, resp.timings.spatialMs);

        // ── render: flood CLIPPED to the analysis radius + circles + hospitals
        // Only the ORIGINAL flood polygons that intersect the 5 km circle union
        // (computed server-side, delivered in the analysis response) are drawn —
        // the complete snapshot is never fetched or rendered in this scenario,
        // so nothing outside the circle shows. They go through the SAME geojson
        // flood layer + hex overview the date scenarios use; any single-date
        // PMTiles flood is cleared so the two never render together.
        const tRender = performance.now();
        setFloodStatus("updating-map");
        const clipped = (resp.floodClipped ?? EMPTY_FC) as FloodAreaFC;
        commitFloodTiles(null);
        setFloodOverview(buildFloodHexLevels(clipped));
        setFloodAreas(clipped);
        setFloodPartial(partial);
        commitFloodExtent(clipped);
        const fallbackBB: BBox | null = clipped.features.length
          ? bboxOf(clipped)
          : null;

        // The circular analysis geometry — the SAME circles the hospital
        // filter used server-side (never a different display geometry).
        setBufferGeometry(resp.circles);
        setBufferCenters(resp.centers);

        // Hospitals: ONLY the analysis result set; points are the answer, so
        // they render at any zoom (result bounds are far below z11).
        setPointOverride(resp.hospitals);
        setPointsAlwaysVisible(true);
        applyExact(["hospitals", "flood", "buffer"], true);
        setBufferAnalysis({ dateLabel, partial });
        setTimeActive(true);
        setTimeLabel(dateLabel);

        // Camera → the circle bounds (⊇ all matching hospitals); step 4 is
        // done only after the camera finished (moveend).
        setFloodStatus("moving-camera");
        const bb = resp.bounds ?? fallbackBB;
        if (bb) {
          await fitBoundsAndWait({
            sw: [bb[0], bb[1]],
            ne: [bb[2], bb[3]],
            duration: FLOOD_FIT_DURATION,
          });
        }
        if (stale()) return { ok: true };
        report?.done(4, Math.round(performance.now() - tRender));
        setFloodStatus("complete");
        showToast(t("morphism.toast.applied"));

        const partialSuffix = partial
          ? ` ${t("morphism.scenario.buffer.partialNotice")}`
          : "";
        const message =
          resp.count === 0
            ? t("morphism.scenario.buffer.resultEmpty", { date: dateLabel })
            : t(
                resp.clusters.length > 1
                  ? "morphism.scenario.buffer.resultMulti"
                  : "morphism.scenario.buffer.result",
                {
                  count: String(resp.count),
                  circles: String(resp.clusters.length),
                  date: dateLabel,
                },
              );
        return { ok: true, message: message + partialSuffix };
      } catch (err) {
        if (stale()) return { ok: true };
        report?.fail(0);
        setFloodStatus("error"); // keep previous valid map state
        const noDataset = err instanceof ApiError && err.status === 503;
        return {
          ok: false,
          message: noDataset
            ? t("morphism.scenario.buffer.errorNoDataset")
            : t("morphism.scenario.buffer.errorLoad"),
        };
      }
    },
    [
      applyExact,
      commitFloodExtent,
      commitFloodTiles,
      fitBoundsAndWait,
      lang,
      setBufferCenters,
      setFloodOverview,
      setPointsAlwaysVisible,
      showToast,
      t,
    ],
  );

  // Reopen from the chat compare-result card (after "Close comparison").
  const reopenCompare = useCallback(
    (sel: SwipeCompareState) => {
      void openCompare(sel);
    },
    [openCompare],
  );

  // Build + draw the region-coloured province polygons for an aggregate scenario
  // from the loaded province GeoJSON. Draw-only (no camera) → returns the polygon
  // bbox (or null). Camera framing is decided by the caller so region-comparison
  // can always frame BOTH regions regardless of which polygons matched.
  const drawAggregateBoundaries = useCallback(
    (scenario: Scenario): BBox | null => {
      const all = boundariesRef.current;
      const names = scenario.provinceNames ?? [];
      const colorCache = new Map<string, string>();
      const colorFor = (region: string | null) => {
        const tokenVar =
          (region && REGION_TOKEN_VAR[region]) || REGION_DEFAULT_TOKEN;
        let c = colorCache.get(tokenVar);
        if (c === undefined) {
          c = readCssColor(tokenVar);
          colorCache.set(tokenVar, c);
        }
        return c;
      };
      const activeRegions = [
        ...new Set(
          names
            .map((pn) => provinceRegion(pn))
            .filter((r): r is string => r !== null),
        ),
      ];
      setBoundaryColor(
        activeRegions.length === 1 ? colorFor(activeRegions[0]) : colorFor(null),
      );

      if (all && names.length) {
        type AdmFeature = ProvinceBoundaryFC["features"][number];
        const features = all.features.flatMap<AdmFeature>((f) => {
          const n = f.properties.name;
          const matched = names.find(
            (pn) => n === pn || n.includes(pn) || pn.includes(n),
          );
          if (!matched) return [];
          const region = provinceRegion(matched);
          return [
            {
              type: "Feature",
              geometry: f.geometry,
              properties: {
                name: n,
                region: region ?? undefined,
                color: colorFor(region),
              },
            },
          ];
        });
        const subset: ProvinceBoundaryFC = { type: "FeatureCollection", features };
        setBoundaries(subset);
        return features.length ? bboxOf(subset) : null;
      }
      setBoundaries(null);
      return null;
    },
    [setBoundaries, setBoundaryColor],
  );

  // Redraw the last aggregate scenario's boundaries once the province polygons
  // arrive (they fetch async; a query can resolve before they load).
  useEffect(() => {
    const s = pendingAggScenarioRef.current;
    if (s && boundariesRef.current) drawAggregateBoundaries(s);
  }, [boundariesVersion, drawAggregateBoundaries]);

  // Reset the map to the initial blank state (used when undo rewinds past the
  // first scenario). Mirrors the resets each scenario branch performs, but
  // toggles every layer off and drops all overlays.
  const clearScene = useCallback(() => {
    floodAbortRef.current?.abort();
    floodRequestIdRef.current += 1;
    abortAndClearCompare();
    setFloodMeta(null);
    setFloodAreas(null);
    setFloodPartial(false);
    setPointOverride(null);
    setBufferAnalysis(null);
    setBufferGeometry(null);
    setBufferCenters(null);
    setPointsAlwaysVisible(false);
    setAggregate(null);
    setAggregateState(null);
    setBoundaries(null);
    setBoundaryColor(null);
    setCompareMode(false);
    setCompareLegend(null);
    setAdmScope(null);
    pendingAggScenarioRef.current = null;
    commitFloodTiles(null);
    setTimeActive(false);
    setTimeLabel(null);
    applyExact([]);
  }, [
    applyExact,
    abortAndClearCompare,
    setAggregate,
    setBoundaries,
    setBufferCenters,
    setPointsAlwaysVisible,
    setCompareMode,
    commitFloodTiles,
  ]);

  // Apply the assistant's interpretation to the map (deterministic scenario).
  // Returns a Promise for flood scenarios that resolves ONLY after the map has
  // committed the data and finished moving — the assistant awaits it before
  // marking the chat complete. Non-flood scenarios resolve synchronously.
  const onScenario = useCallback(
    (
      scenario: Scenario,
      report?: ScenarioStepReporter,
    ): void | Promise<void | ScenarioOutcome> => {
      // Unknown/unmatched query: keep the current map result untouched — no
      // layers, no camera move, no toast. (The chat shows the fallback message.)
      if (scenario.mode === "unknown") return;

      // Record this scene for undo/redo (the hook ignores calls made while a
      // history step is replaying).
      recordScene(scenario);

      // Invalidate any in-flight flood run (aborts its fetch + supersedes its id)
      // so a superseded scenario can never commit late.
      floodAbortRef.current?.abort();
      floodRequestIdRef.current += 1;

      // Flood swipe-compare (two years, REAL data). openCompare resets the
      // other overlays, enters compare mode, then hands the async
      // fetch/measure/draw to runFloodCompare — whose promise the assistant
      // awaits for the computed result + chart.
      if (scenario.swipe) {
        setTimeActive(Boolean(scenario.timeActive));
        setTimeLabel(scenario.timeActive ? scenario.timeLabel ?? null : null);
        return openCompare(scenario.swipe, report);
      }

      // REAL 5 km flood-proximity analysis (dataset resolved at RUNTIME on the
      // server — never a baked date/count). runBufferScenario owns the whole
      // request → render → camera flow; its promise carries the live result.
      if (scenario.analysis === "flood-buffer") {
        setAggregate(null);
        setAggregateState(null);
        setBoundaries(null);
        setBoundaryColor(null);
        setCompareMode(false);
        setCompareLegend(null);
        setAdmScope(null);
        pendingAggScenarioRef.current = null;
        detachCompare();
        setFloodMeta(null);
        setFloodAreas(null);
        setFloodPartial(false);
        floodBoundsRef.current = null;
        // Previous zone is dropped only when the NEW result commits (the map
        // keeps the last valid view while loading).
        // Hide overlays while loading — layers are revealed atomically once
        // the real analysis result is committed (no camera move here).
        applyExact([]);
        return runBufferScenario(report);
      }

      // Date-based flood scenario: render the real MultiPolygon extent for a
      // single observation date. Only the flood layer is shown (hospital points
      // stay hidden). The whole fetch → commit → camera flow is owned by
      // runFloodScenario, whose returned promise the assistant awaits.
      if (scenario.flood) {
        const meta = scenario.flood;
        setPointOverride(null);
        setBufferAnalysis(null);
        setBufferGeometry(null);
        setBufferCenters(null);
        setPointsAlwaysVisible(false);
        setAggregate(null);
        setAggregateState(null);
        setBoundaries(null);
        setBoundaryColor(null);
        setCompareMode(false);
        setCompareLegend(null);
        setAdmScope(null);
        pendingAggScenarioRef.current = null;
        detachCompare();
        // Reflect the observation date/range in the time-filter pill (real
        // snapshots set timeActive; empty-date scenarios leave it cleared).
        setTimeActive(Boolean(scenario.timeActive));
        setTimeLabel(scenario.timeActive ? scenario.timeLabel ?? null : null);
        // Hide every overlay while loading. The flood layer is revealed
        // atomically only once the real dataset is committed. Camera NOT moved
        // here; runFloodScenario moves it after the commit and awaits moveend.
        applyExact([]);
        setFloodMeta(meta);
        // No toast here — "Map updated" is shown by runFloodScenario only after
        // the camera has finished moving (status "complete"). The reporter feeds
        // real per-step durations back to the chat.
        return runFloodScenario(meta, report);
      }
      // Any non-flood scenario leaves date-based flood mode: release the flood
      // source (it becomes empty — no mock geometry), deactivate the low-zoom
      // overview and reset the machine (incl. the 5 km analysis result).
      setFloodMeta(null);
      setFloodAreas(null);
      setFloodPartial(false);
      setFloodOverview(null);
      setFloodStatus("idle");
      floodBoundsRef.current = null;
      setBufferAnalysis(null);
      setBufferGeometry(null);
      setBufferCenters(null);
      setPointsAlwaysVisible(false);

      if (scenario.mode === "aggregate") {
        // Province-summary view. Hospitals are marked "desired" so the zoom gate
        // can reveal the points at zoom ≥ 11.8 (the scenario stays in
        // aggregation mode logically; only layer visibility flips by zoom).
        const isCmp = Boolean(scenario.regionCompare);
        setPointOverride(null);
        // Region-compare hides hospital points entirely (region boundaries +
        // per-region counts only); normal aggregate reveals points at z≥11.
        applyExact(isCmp ? [] : ["hospitals"]);
        setCompareMode(isCmp);
        setCompareLegend(isCmp ? buildCompareLegend(lang) : null);
        setAggregate(scenario.aggregate ?? []);
        setAggregateState(scenario.aggregate ?? null);
        // Region-compare draws region boundaries only (no ADM2/ADM3 drill-down).
        setAdmScope(
          isCmp
            ? null
            : { mode: "aggregate", names: scenario.provinceNames ?? [] },
        );
        // Draw region-coloured province polygons. Remember the scenario so the
        // redraw effect can replay it if the province GeoJSON loads late.
        pendingAggScenarioRef.current = scenario;
        const bbox = drawAggregateBoundaries(scenario);
        // Camera: region-comparison ALWAYS frames BOTH regions from the fixed
        // combined bounds (never the possibly-partial polygon subset, never one
        // region). Normal aggregate fits the drawn polygon extent.
        if (isCmp) {
          if (scenario.bounds) fitBounds(scenario.bounds);
        } else if (bbox) {
          fitBounds({
            sw: [bbox[0], bbox[1]],
            ne: [bbox[2], bbox[3]],
            duration: scenario.bounds?.duration ?? 1200,
          });
        } else if (scenario.bounds) {
          fitBounds(scenario.bounds);
        }
        // [region-comparison] dev diagnostics only.
        if (isCmp && process.env.NODE_ENV !== "production") {
          console.log("[region-comparison]", {
            scenarioType: "region-comparison",
            comparedRegions: scenario.aggregate?.map((a) => a.name),
            regionLabels: scenario.aggregate?.map((a) => a.count),
            polygonBbox: bbox,
            bounds: scenario.bounds,
          });
        }
      } else {
        // Point / analysis view. A hospital query drives the SAME zoom-band
        // aggregation as statistics, but SCOPED to the extracted province: points
        // at z≥11, district counts 8.5–11, province count 6–8.5, summary <6.
        setAggregate(null);
        setAggregateState(null);
        setBoundaries(null);
        setBoundaryColor(null);
        setCompareMode(false);
        setCompareLegend(null);
        pendingAggScenarioRef.current = null; // leaving aggregate/compare
        applyExact(scenario.layers, true);
        // Scope the zoom-band hierarchy to the query's province (points mode
        // derives counts from the filtered points); no province = data-driven.
        setAdmScope(
          scenario.layers.includes("hospitals")
            ? {
                mode: "points",
                names: scenario.hospitalScope?.province
                  ? [scenario.hospitalScope.province]
                  : [],
              }
            : null,
        );

        if (scenario.hospitalScope) {
          // POI search scoped to a province (+ 24h): filter province → 24h, then
          // render the filtered points and fit the camera to them. NO aggregate.
          const scope = scenario.hospitalScope;
          const source = hospitalsFC ?? MOCK_HOSPITALS;
          // Canonical EXACT province match + h24 (skipped for flagless data) —
          // pure data filtering in lib/hospital-filter, never camera clipping.
          const canonScope = normalizeProvinceName(scope.province);
          const subset: HospitalFC = filterHospitalsByScope(source, scope);
          const features = subset.features;
          setPointOverride(subset);
          // The province boundary + counts are drawn by the zoom-band hierarchy
          // (scoped to this province); the view only frames the camera.

          // Fit the camera to the found hospitals (frames the province). Points
          // render only at z≥11 — below that the band shows aggregation.
          const all = boundariesRef.current;
          const bb = features.length
            ? bboxOf(subset)
            : all && scope.province
              ? bboxOf({
                  type: "FeatureCollection",
                  features: all.features.filter(
                    (f) => normalizeProvinceName(f.properties.name) === canonScope,
                  ),
                })
              : null;
          if (bb) {
            fitBounds({
              sw: [bb[0], bb[1]],
              ne: [bb[2], bb[3]],
              duration: scenario.camera?.duration ?? 1100,
            });
          } else if (scenario.camera) {
            flyTo(scenario.camera);
          }

          // [morphism-query] dev diagnostics only.
          if (process.env.NODE_ENV !== "production") {
            console.log("[morphism-query]", {
              scenarioId: scenario.id,
              renderMode: "points",
              intent: "poi-search",
              resolvedProvince: scope.province ?? null,
              totalHospitalsBeforeFilter: source.features.length,
              renderedFeatureCount: features.length,
              sampleRenderedFeatures: features
                .slice(0, 5)
                .map((f) => f.properties),
            });
          }
        } else {
          setPointOverride(null);
          if (scenario.camera) flyTo(scenario.camera);
        }
      }
      // Time filter pill: on with the scenario's label, else cleared.
      setTimeActive(Boolean(scenario.timeActive));
      setTimeLabel(scenario.timeActive ? scenario.timeLabel ?? null : null);
      // Any non-swipe scenario closes an open compare (swipe is handled earlier
      // via its own async branch and never reaches here). Non-flood scenarios
      // also release the single-date PMTiles detail.
      detachCompare();
      commitFloodTiles(null);
      showToast(t("morphism.toast.applied"));
    },
    [
      applyExact,
      setAggregate,
      setBoundaries,
      setBufferCenters,
      detachCompare,
      openCompare,
      commitFloodTiles,
      setCompareMode,
      drawAggregateBoundaries,
      fitBounds,
      flyTo,
      hospitalsFC,
      runFloodScenario,
      runBufferScenario,
      setPointsAlwaysVisible,
      setFloodOverview,
      showToast,
      recordScene,
      t,
      lang,
    ],
  );

  // Wire the scene-history replay target now that clearScene/onScenario exist.
  // `null` = the initial blank map. (Assigned in an effect — never in render.)
  useEffect(() => {
    applyReplayRef.current = (s: Scenario | null) => {
      // History steps are "going back", not a new flight: shorten the camera
      // transitions for the whole replay, restore once it has applied.
      setCameraFactor(CAMERA.replayFactor);
      const restore = () => setCameraFactor(1);
      if (s === null) {
        clearScene();
        restore();
      } else {
        void Promise.resolve(onScenario(s)).finally(restore);
      }
    };
  }, [clearScene, onScenario, setCameraFactor]);

  // LIVE per-province hospital counts from the loaded dataset — the single
  // source aggregate scenarios (province/region/nationwide/compare) report, so
  // map labels, charts and chat summaries match the rendered points. Undefined
  // until the dataset arrives (scenarios then use the static reference table).
  const provinceCounts = useMemo(
    () => (hospitalsFC ? buildProvinceCounts(hospitalsFC) : undefined),
    [hospitalsFC],
  );

  // Resolve queries with the CURRENT language so scenario text (interim, result,
  // steps, chart labels, dates) renders in the active i18n language and
  // re-resolves when the user switches languages (and when the live counts
  // arrive, so past aggregate replies update to the real numbers too).
  const resolve = useCallback(
    (text: string) => resolveScenario(text, t, lang, provinceCounts),
    [t, lang, provinceCounts],
  );

  const { messages, ask, pending } = useAiAssistant({
    resolve,
    onScenario,
  });

  const handleUndo = useCallback(() => {
    if (!sceneNav.canUndo) return;
    sceneUndo();
    showToast(t("morphism.toast.undone"));
  }, [sceneNav.canUndo, sceneUndo, showToast, t]);

  const handleRedo = useCallback(() => {
    if (!sceneNav.canRedo) return;
    sceneRedo();
    showToast(t("morphism.toast.redone"));
  }, [sceneNav.canRedo, sceneRedo, showToast, t]);

  const handleToggleLayer = useCallback(
    (id: LayerId) => toggleLayer(id),
    [toggleLayer],
  );

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex h-dvh w-full flex-col overflow-hidden bg-background-default-default",
        direction === "rtl" ? "md:flex-row-reverse" : "md:flex-row",
      )}
      style={{ ["--chat-w" as string]: `${width}px` } as React.CSSProperties}
    >
      {/* Chat sidebar: fixed ~400px on desktop, stacked panel on mobile */}
      <ChatPanel
        messages={messages}
        pending={pending}
        onSend={ask}
        onReopenCompare={reopenCompare}
        activeSwipe={swipe}
        className={cn(
          "order-2 w-full shrink-0 basis-[46%] border-t border-border-default-default",
          "md:order-0 md:w-auto md:grow-0 md:basis-(--chat-w,400px) md:border-t-0 md:border-x",
        )}
      />

      <Resizer active={active} onPointerDown={onPointerDown} onKeyDown={onKeyDown} />

      {/* Map workspace */}
      <main className="relative order-1 min-w-0 flex-1 bg-background-default-default md:order-0"
        aria-label={t("morphism.workspaceAria")}
      >
        <MapCanvas containerRef={containerRef} ariaLabel={t("morphism.mapAria")} />

        {/* Swipe-compare overlay map (side B), revealed right of the divider by
            CSS clip-path — written DIRECTLY on this wrapper by SwipeCompare's
            rAF drag path, so it must never appear as a React inline style.
            Display-only (pointer-events-none): the main map keeps all gestures. */}
        {swipe !== null && (
          <div
            ref={overlayWrapRef}
            aria-hidden
            className={cn(
              // Fade side B in once it is READY (was a hard `invisible` flip).
              "pointer-events-none absolute inset-0 z-10 transition-opacity duration-200 motion-reduce:transition-none",
              overlayReady ? "opacity-100" : "opacity-0",
            )}
          >
            <div
              ref={overlayContainerRef}
              className="absolute inset-0 size-full"
            />
          </div>
        )}

        {/* Cover the basemap's blank-tile flash while a flood scenario loads +
            the camera flies to the new extent. */}
        <MapLoadingOverlay
          active={
            floodStatus === "loading-data" ||
            floodStatus === "updating-map" ||
            floodStatus === "moving-camera"
          }
        />

        <MapTopBar
          timeActive={timeActive}
          timeLabel={timeLabel}
          onClearTime={() => {
            setTimeActive(false);
            setTimeLabel(null);
          }}
        />
        <div className="flex flex-col max-h-full justify-between items-end absolute right-4 top-4 bottom-4 z-50">
          <div className="flex flex-col gap-4">
            <LayerFab
              open={layerPanelOpen}
              onToggle={() => setLayerPanelOpen((v) => !v)}
            />

            <LayerPanel
              open={layerPanelOpen}
              layers={layers}
              onToggle={handleToggleLayer}
              onClose={() => setLayerPanelOpen(false)}
            />

            <HistoryControls
              canUndo={sceneNav.canUndo}
              canRedo={sceneNav.canRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />
            {/* zoom-in/out — above the Settings gear */}
            <ZoomControls map={map} />
          </div>
          <div className="flex flex-col items-end gap-4">
            <SettingsPopover
              open={settingsOpen}
              onToggle={() => setSettingsOpen((v) => !v)}
              direction={direction}
              onChange={(dir) => setDirection(dir)}
            />

            <Tag variant="filled" color="default" size="small" className="text-xs border border-border-default-default pointer-events-none">
              {t("morphism.context", {
                layers: String(visibleCount),
                zoom: zoom.toFixed(1),
              })}
            </Tag>

            {/* Basemap attribution, pinned bottom-right like the HTML reference. */}
            {/* <div className="pointer-events-auto  select-none truncate text-[8px] text-text-default-disable"
              aria-label={t("morphism.attributionAria")}
            >
              {"Morphism mockup · © "}
              <a
                href="https://carto.com/about-carto/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-default-onlight hover:underline"
              >
                CARTO
              </a>
              {" · © "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-default-onlight hover:underline"
              >
                OpenStreetMap
              </a>
            </div> */}
          </div>
        </div>

        <Legend
            layers={layers}
            aggregate={aggregate}
            boundaryColor={boundaryColor}
            boundariesError={boundariesError}
            boundariesLevel={layers.boundaries.visible ? adminBounds.level : null}
            swipe={swipe}
            compareRegions={compareLegend}
            floodDateLabel={
              floodStatus === "complete" ? floodMeta?.dateLabel ?? null : null
            }
            floodPartial={floodPartial}
            floodBuffer={bufferAnalysis}
          />

        {/* Lazy ADM2/ADM3 status — loading / error(fallback) / empty */}
        {(adm.loading || adm.error || adm.empty) && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-md",
              adm.error
                ? "border-border-error-default bg-background-error-light text-text-error-onlight"
                : "border-border-default-default bg-background-default-default text-text-default-onlight",
            )}
          >
            {adm.loading
              ? t("morphism.admStatus.loading")
              : adm.error
                ? t("morphism.admStatus.error")
                : t("morphism.admStatus.empty")}
          </div>
        )}

        {/* Flood scenario TERMINAL status only — empty / error. Processing state
            (loading / committing / camera) lives solely in the sidebar tool
            steps; there is deliberately no map-level "loading" badge. */}
        {(floodStatus === "empty" || floodStatus === "error") && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-md",
              floodStatus === "error"
                ? "border-border-error-default bg-background-error-light text-text-error-onlight"
                : "border-border-default-default bg-background-default-default text-text-default-onlight",
            )}
          >
            {floodStatus === "error"
              ? t("morphism.flood.error")
              : floodMeta?.matchMode === "month"
                ? t("morphism.flood.emptyMonth", { month: floodMeta.dateLabel })
                : t("morphism.flood.emptyDate", { date: floodMeta?.dateLabel ?? "" })}
          </div>
        )}

        <SwipeCompare
          active={swipe !== null}
          ready={overlayReady}
          overlayRef={overlayWrapRef}
          clip={clip}
          onClipChange={setClip}
          onClose={closeCompare}
        />

        <Toast message={toast} />


      </main>
    </div>
  );
};

export default MorphismView;
