"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import {
  useAdminHierarchy,
  useAiAssistant,
  useChatResizer,
  useFloodSwipe,
  useMapLayers,
  useMorphismMap,
  type FloodCompareData,
} from "@/hooks";
import {
  getFloodAreas,
  getFloodDetailInBBox,
  getFloodOverviewAsset,
  getProvinceBoundaries,
  getHospitals,
} from "@/lib/api";
import { endpoint } from "@/configs/endpoint";
import { cn } from "@/lib/utils";
import type {
  BBox,
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
  MOCK_FLOOD,
  MOCK_BUFFER,
  MOCK_BUFFER_CENTERS,
  MOCK_BOUNDARIES,
  FLOOD_ANALYSIS_CENTERS,
  FLOOD_ANALYSIS_RADIUS_KM,
  buildFloodCompareOutcome,
  REGION_TOKEN_VAR,
  REGION_DEFAULT_TOKEN,
  provinceRegion,
  compareLegend as buildCompareLegend,
} from "../const";
import { readCssColor } from "@/lib/map-tokens";
import { areaKm2, bboxOf, distanceKm, normalizeProvinceName } from "@/lib/geo";
import {
  buildFloodHexLevels,
  buildFloodSampleIndex,
  createFloodHexOverview,
  FLOOD_DETAIL_MIN_ZOOM,
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
// Flood camera transition — capped short (still smooth, uses the map's easing)
// so scenario completion isn't gated on an unnecessarily long animation.
const FLOOD_FIT_DURATION = 700;

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
  // Active scenario display language (default English; the other is Thai).
  const lang: "en" | "th" = i18n.language === "th" ? "th" : "en";
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
  // Live flood areas for the active date-based flood scenario (Vallaris via the
  // /api/flood proxy). Null → the map's flood source falls back to MOCK_FLOOD
  // (only shown when another scenario toggles the flood layer).
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
  // Flood-compare (swipe) in-flight controller + monotonic id (same pattern as
  // the single-date flood run, so a superseded compare can't commit late).
  const compareAbortRef = useRef<AbortController | null>(null);
  const compareRequestIdRef = useRef(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flood swipe-compare: which two years. Both years are drawn + clipped per-side
  // directly on the main map (setFloodCompare / setFloodCompareClip); this state
  // only tracks the active years.
  const [swipe, setSwipe] = useState<SwipeCompareState | null>(null);

  // ── Scene-level undo/redo ────────────────────────────────────────────────
  // The layer-visibility stack (useMapLayers) only rewinds WHICH layers are on —
  // meaningless when two flood dates share the same layers. This records the
  // whole APPLIED SCENARIO instead, so undo/redo step between real map states
  // (flood date, aggregation, compare, camera). `null` = the initial blank map.
  // Replaying re-runs onScenario, which is deterministic, so the scene is
  // reconstructed exactly (flood re-fetches + refits).
  const sceneRef = useRef<{
    past: (Scenario | null)[];
    present: Scenario | null;
    future: (Scenario | null)[];
  }>({ past: [], present: null, future: [] });
  // True while an undo/redo is re-applying a scenario, so onScenario skips
  // recording it as a new history entry.
  const replayingRef = useRef(false);
  const [sceneNav, setSceneNav] = useState({ canUndo: false, canRedo: false });
  const syncSceneNav = useCallback(() => {
    setSceneNav({
      canUndo: sceneRef.current.past.length > 0,
      canRedo: sceneRef.current.future.length > 0,
    });
  }, []);
  const recordScene = useCallback(
    (scenario: Scenario) => {
      const s = sceneRef.current;
      s.past.push(s.present);
      s.present = scenario;
      s.future = [];
      syncSceneNav();
    },
    [syncSceneNav],
  );

  const {
    layers,
    visibleCount,
    toggleLayer,
    applyExact,
  } = useMapLayers();

  const { width, active, onPointerDown, onKeyDown } = useChatResizer(direction);
  // Feed every analysis layer with (mock) demo data so toggling a layer renders
  // real geometry on the map. In compare mode the single flood layer is hidden
  // (the per-year layers take over), so its data is left as the normal extent.
  // Memoised so the map's data-sync effect only fires when the data changes.
  const mapData = useMemo(
    () => ({
      // Buffer scenario feeds only the in-radius (risk) subset; otherwise full.
      hospitals: pointOverride ?? hospitalsFC ?? MOCK_HOSPITALS,
      boundaries: MOCK_BOUNDARIES,
      buffer: MOCK_BUFFER,
      // Live flood areas when the proxy succeeds; else the ported survey polygons.
      flood: floodAreas ?? MOCK_FLOOD,
    }),
    [hospitalsFC, pointOverride, floodAreas],
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
  } = useMorphismMap({
    layers,
    data: mapData,
    theme: resolvedTheme,
    hospitalPopupHtml,
  });

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
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const fc = await getProvinceBoundaries();
        if (!cancelled) {
          boundariesRef.current = fc;
          setBoundariesError(false);
          setBoundariesVersion((v) => v + 1); // trigger redraw of pending scenario
        }
      } catch {
        if (!cancelled) {
          boundariesRef.current = null;
          setBoundariesError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch the real hospital points once (client-side) and feed them to the map
  // source so the zoom gate has real data to reveal at zoom ≥ 11.8.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const fc = await getHospitals();
        if (!cancelled) setHospitalsFC(fc);
      } catch {
        /* keep the mock fallback so the map still renders something */
      }
    })();
    return () => {
      cancelled = true;
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
      setFloodOverview,
      fitBoundsAndWait,
      showToast,
      t,
    ],
  );

  // Flood swipe-compare with REAL data: fetch each year's live extent, measure
  // the flooded area geodesically, draw both layers, frame the union, and report
  // the computed message + chart back to the chat. Only real flooded AREA is
  // reported (the app has no authoritative population/district dataset).
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

      // Load ONE side: fetch its live extent, measure the real area, and reduce
      // it to hex LODs for low/mid zoom. The raw detail is measured then dropped
      // (high-zoom detail comes from the viewport fetch, memory-safe for any
      // dataset size). One shared index feeds every hex level.
      const loadSide = async (
        date: string,
      ): Promise<{ km2: number; data: FloodCompareData; bbox: BBox } | null> => {
        const resp = await getFloodAreas(date, controller.signal);
        if (!resp.features.length) return null;
        const bbox = bboxOf(resp);
        if (!bbox) return null;
        const idx = buildFloodSampleIndex(resp);
        return {
          km2: areaKm2(resp),
          data: {
            coarse: createFloodHexOverview(idx, 45, "coarse"),
            medium: createFloodHexOverview(idx, 24, "medium"),
            fine: createFloodHexOverview(idx, 12, "fine"),
          },
          bbox,
        };
      };

      report?.done(0, 0); // resolve_periods — instant
      const tLoad = performance.now();
      try {
        // Sequential so only ONE full dataset is parsed at a time (lower peak).
        const A = await loadSide(sel.dateA);
        if (stale()) return { ok: true };
        const B = await loadSide(sel.dateB);
        if (stale()) return { ok: true };
        if (!A || !B) {
          report?.fail(1, since(tLoad));
          return { ok: false, message: errorMsg };
        }
        report?.done(1, since(tLoad));

        const tMeasure = performance.now();
        setFloodCompare(A.data, B.data);
        report?.done(2, since(tMeasure));

        // Frame the union of both sides' extents.
        await fitBoundsAndWait({
          sw: [Math.min(A.bbox[0], B.bbox[0]), Math.min(A.bbox[1], B.bbox[1])],
          ne: [Math.max(A.bbox[2], B.bbox[2]), Math.max(A.bbox[3], B.bbox[3])],
          duration: FLOOD_FIT_DURATION,
        });
        if (stale()) return { ok: true };

        const { message, charts } = buildFloodCompareOutcome(
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
    [setFloodCompare, fitBoundsAndWait, showToast, t],
  );

  const { clip, setClip } = useFloodSwipe({ active: swipe !== null });

  // Drive the real-time per-year clip on the map from the divider position.
  useEffect(() => {
    if (swipe) setFloodCompareClip(clip);
  }, [clip, swipe, setFloodCompareClip]);

  // High-zoom REAL detail for compare: when zoomed past the hex→detail band,
  // fetch BOTH sides' live extent cropped to the CURRENT viewport (server-side
  // bbox) and draw the real polygons — the SAME LOD boundary as the single-date
  // view. Debounced on move; only the viewport is loaded so any dataset size is
  // memory-safe. Below the band it clears back to hex.
  useEffect(() => {
    if (!swipe || !map) return;
    const { dateA, dateB } = swipe;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let abort: AbortController | null = null;
    const update = () => {
      if (map.getZoom() < FLOOD_DETAIL_MIN_ZOOM) {
        setFloodCompareDetail(null, null);
        return;
      }
      const b = map.getBounds();
      const bbox: [number, number, number, number] = [
        b.getWest(),
        b.getSouth(),
        b.getEast(),
        b.getNorth(),
      ];
      abort?.abort();
      abort = new AbortController();
      const sig = abort.signal;
      void Promise.all([
        getFloodDetailInBBox(dateA, bbox, sig),
        getFloodDetailInBBox(dateB, bbox, sig),
      ])
        .then(([a, bfc]) => {
          if (sig.aborted) return;
          // TEMP diagnostic — confirms the upstream bbox crop returns features
          // (remove once high-zoom compare detail is verified in the browser).
          console.log("[compare-detail]", {
            zoom: map.getZoom().toFixed(1),
            a: a.features.length,
            b: bfc.features.length,
          });
          setFloodCompareDetail(a, bfc);
        })
        .catch((err) => {
          if (!sig.aborted) console.warn("[compare-detail] fetch failed", err);
        });
    };
    const onMove = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(update, 300);
    };
    map.on("moveend", onMove);
    update();
    return () => {
      map.off("moveend", onMove);
      if (debounce) clearTimeout(debounce);
      abort?.abort();
      setFloodCompareDetail(null, null);
    };
  }, [swipe, map, setFloodCompareDetail]);

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
    compareAbortRef.current?.abort();
    compareRequestIdRef.current += 1;
    setFloodMeta(null);
    setFloodAreas(null);
    setFloodPartial(false);
    setPointOverride(null);
    setBufferCenters(null);
    setAggregate(null);
    setAggregateState(null);
    setBoundaries(null);
    setBoundaryColor(null);
    setCompareMode(false);
    setCompareLegend(null);
    setAdmScope(null);
    pendingAggScenarioRef.current = null;
    setSwipe(null);
    setFloodCompare(null, null);
    setTimeActive(false);
    setTimeLabel(null);
    applyExact([]);
  }, [
    applyExact,
    setAggregate,
    setBoundaries,
    setBufferCenters,
    setCompareMode,
    setFloodCompare,
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

      // Record this scene for undo/redo (skipped while replaying a history step).
      if (!replayingRef.current) recordScene(scenario);

      // Invalidate any in-flight flood run (aborts its fetch + supersedes its id)
      // so a superseded scenario can never commit late.
      floodAbortRef.current?.abort();
      floodRequestIdRef.current += 1;

      // Flood swipe-compare (two years, REAL data). Reset other overlays, enter
      // compare mode, then hand the async fetch/measure/draw to runFloodCompare —
      // whose promise the assistant awaits for the computed result + chart.
      if (scenario.swipe) {
        const sel = scenario.swipe;
        setPointOverride(null);
        setBufferCenters(null);
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
        setTimeActive(Boolean(scenario.timeActive));
        setTimeLabel(scenario.timeActive ? scenario.timeLabel ?? null : null);
        setSwipe(sel);
        return runFloodCompare(sel, report);
      }

      // Date-based flood scenario: render the real MultiPolygon extent for a
      // single observation date. Only the flood layer is shown (hospital points
      // stay hidden). The whole fetch → commit → camera flow is owned by
      // runFloodScenario, whose returned promise the assistant awaits.
      if (scenario.flood) {
        const meta = scenario.flood;
        setPointOverride(null);
        setBufferCenters(null);
        setAggregate(null);
        setAggregateState(null);
        setBoundaries(null);
        setBoundaryColor(null);
        setCompareMode(false);
        setCompareLegend(null);
        setAdmScope(null);
        pendingAggScenarioRef.current = null;
        setSwipe(null);
        setFloodCompare(null, null);
        // Reflect the observation date/range in the time-filter pill (real
        // snapshots set timeActive; empty-date scenarios leave it cleared).
        setTimeActive(Boolean(scenario.timeActive));
        setTimeLabel(scenario.timeActive ? scenario.timeLabel ?? null : null);
        // Hide every overlay while loading — crucially this prevents the MOCK
        // flood extent from flashing at Bangkok. The flood layer is revealed
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
      // source (other scenarios use MOCK_FLOOD), deactivate the low-zoom overview
      // (so mock flood never shows stale overview cells) and reset the machine.
      setFloodMeta(null);
      setFloodAreas(null);
      setFloodPartial(false);
      setFloodOverview(null);
      setFloodStatus("idle");
      floodBoundsRef.current = null;

      if (scenario.mode === "aggregate") {
        // Province-summary view. Hospitals are marked "desired" so the zoom gate
        // can reveal the points at zoom ≥ 11.8 (the scenario stays in
        // aggregation mode logically; only layer visibility flips by zoom).
        const isCmp = Boolean(scenario.regionCompare);
        setPointOverride(null);
        setBufferCenters(null);
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
        // [region-comparison] TEMP — remove after verifying.
        if (isCmp) {
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

        if (scenario.id === "buffer5km") {
          // Spatial query: keep only hospitals within the 5 km buffer (red risk
          // points); draw the buffer centre; fit the camera to the buffer.
          const source = hospitalsFC ?? MOCK_HOSPITALS;
          const inBuffer = (p: Position) =>
            FLOOD_ANALYSIS_CENTERS.some(
              (c) => distanceKm(p, c) <= FLOOD_ANALYSIS_RADIUS_KM,
            );
          const features = source.features
            .filter(
              (f) =>
                f.geometry.type === "Point" &&
                inBuffer(f.geometry.coordinates as Position),
            )
            .map((f) => ({
              ...f,
              properties: { ...f.properties, risk: true },
            }));
          setPointOverride({ type: "FeatureCollection", features });
          setBufferCenters(MOCK_BUFFER_CENTERS);
          const bb = bboxOf(MOCK_BUFFER);
          if (bb) {
            fitBounds({
              sw: [bb[0], bb[1]],
              ne: [bb[2], bb[3]],
              duration: scenario.camera?.duration ?? 1100,
            });
          } else if (scenario.camera) {
            flyTo(scenario.camera);
          }
        } else if (scenario.hospitalScope) {
          // POI search scoped to a province (+ 24h): filter province → 24h, then
          // render the filtered points and fit the camera to them. NO aggregate.
          const scope = scenario.hospitalScope;
          const source = hospitalsFC ?? MOCK_HOSPITALS;
          // Canonical EXACT province match (no substring — that leaks blanks).
          const canonScope = normalizeProvinceName(scope.province);
          const inProvince = (pv: string | undefined) => {
            if (!scope.province) return true;
            const canon = normalizeProvinceName(pv);
            return canon !== "" && canon === canonScope;
          };
          // h24 only bites when the dataset actually carries the flag.
          const datasetHasH24 = source.features.some((f) => f.properties.h24);
          const afterProvince = source.features.filter((f) =>
            inProvince(f.properties.province),
          );
          const features = afterProvince.filter(
            (f) => !(scope.h24 && datasetHasH24 && !f.properties.h24),
          );
          const subset: HospitalFC = { type: "FeatureCollection", features };
          setPointOverride(subset);
          setBufferCenters(null);
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

          // [morphism-query] TEMP — verify province scope (remove after fixing).
          console.log("[morphism-query]", {
            scenarioId: scenario.id,
            renderMode: "points",
            intent: "poi-search",
            resolvedProvince: scope.province ?? null,
            totalHospitalsBeforeFilter: source.features.length,
            afterProvinceFilter: afterProvince.length,
            afterHoursFilter: features.length,
            renderedFeatureCount: features.length,
            sampleRenderedFeatures: features
              .slice(0, 5)
              .map((f) => f.properties),
          });
        } else {
          setPointOverride(null);
          setBufferCenters(null);
          if (scenario.camera) flyTo(scenario.camera);
        }
      }
      // Time filter pill: on with the scenario's label, else cleared.
      setTimeActive(Boolean(scenario.timeActive));
      setTimeLabel(scenario.timeActive ? scenario.timeLabel ?? null : null);
      // Any non-swipe scenario closes an open compare (swipe is handled earlier
      // via its own async branch and never reaches here).
      setSwipe(null);
      setFloodCompare(null, null);
      showToast(t("morphism.toast.applied"));
    },
    [
      applyExact,
      setAggregate,
      setBoundaries,
      setBufferCenters,
      setFloodCompare,
      setCompareMode,
      drawAggregateBoundaries,
      fitBounds,
      flyTo,
      hospitalsFC,
      runFloodScenario,
      runFloodCompare,
      setFloodOverview,
      showToast,
      recordScene,
      t,
      lang,
    ],
  );

  // Re-apply a stored scene during undo/redo. `null` = the initial blank map.
  // Runs with the replay flag set so onScenario doesn't re-record the step.
  const applyReplay = useCallback(
    (s: Scenario | null) => {
      replayingRef.current = true;
      try {
        if (s === null) clearScene();
        else void Promise.resolve(onScenario(s));
      } finally {
        replayingRef.current = false;
      }
    },
    [clearScene, onScenario],
  );

  const sceneUndo = useCallback(() => {
    const s = sceneRef.current;
    if (s.past.length === 0) return;
    s.future.unshift(s.present);
    s.present = s.past.pop() ?? null;
    syncSceneNav();
    applyReplay(s.present);
  }, [applyReplay, syncSceneNav]);

  const sceneRedo = useCallback(() => {
    const s = sceneRef.current;
    if (s.future.length === 0) return;
    s.past.push(s.present);
    s.present = s.future.shift() ?? null;
    syncSceneNav();
    applyReplay(s.present);
  }, [applyReplay, syncSceneNav]);

  // Resolve queries with the CURRENT language so scenario text (interim, result,
  // steps, chart labels, dates) renders in the active i18n language and
  // re-resolves when the user switches languages.
  const resolve = useCallback(
    (text: string) => resolveScenario(text, t, lang),
    [t, lang],
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
            swipe={swipe}
            compareRegions={compareLegend}
            floodDateLabel={
              floodStatus === "complete" ? floodMeta?.dateLabel ?? null : null
            }
            floodPartial={floodPartial}
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
          labelA={swipe?.labelA ?? ""}
          labelB={swipe?.labelB ?? ""}
          clip={clip}
          onClipChange={setClip}
          onClose={() => {
            // Abort any in-flight compare fetch so it can't re-draw after close.
            compareAbortRef.current?.abort();
            compareRequestIdRef.current += 1;
            setSwipe(null);
            setFloodCompare(null, null);
          }}
        />

        <Toast message={toast} />


      </main>
    </div>
  );
};

export default MorphismView;
