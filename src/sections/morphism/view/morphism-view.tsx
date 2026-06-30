"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import {
  useAiAssistant,
  useChatResizer,
  useFloodSwipe,
  useMapLayers,
  useMorphismMap,
} from "@/hooks";
import { getFlood, getProvinceBoundaries, getHospitals } from "@/lib/api";
import { bboxOf } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { emptyFC } from "@/types";
import type {
  FloodFC,
  FloodProps,
  HospitalFC,
  LayerId,
  LayoutDirection,
  ProvinceBoundaryFC,
  ProvinceCount,
  Scenario,
  SwipeCompare as SwipeCompareState,
} from "@/types";
import {
  resolveScenario,
  MOCK_HOSPITALS,
  MOCK_FLOOD,
  MOCK_BUFFER,
  MOCK_BOUNDARIES,
  REGION_TOKEN_VAR,
  REGION_DEFAULT_TOKEN,
  provinceRegion,
} from "../const";
import { readCssColor } from "@/lib/map-tokens";
import {
  ChatPanel,
  HistoryControls,
  LayerFab,
  LayerPanel,
  Legend,
  MapCanvas,
  MapTopBar,
  Resizer,
  SettingsPopover,
  SwipeCompare,
  Toast,
  ZoomControls,
} from "../layout";
import { Tag } from "@/components/selection/Tag";

const TOAST_MS = 2200;

const MorphismView = () => {
  const { t } = useTranslation();
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
  // Active boundary colour (same source as the polygons) → legend swatch.
  const [boundaryColor, setBoundaryColor] = useState<string | null>(null);
  // Real province polygons fetched from the open GeoJSON service.
  const boundariesRef = useRef<ProvinceBoundaryFC | null>(null);
  const [boundariesError, setBoundariesError] = useState(false);
  // Real hospital points (public registry, 10k+). Fed to the map source so the
  // zoom gate has actual data to reveal at zoom ≥ 11.8.
  const [hospitalsFC, setHospitalsFC] = useState<HospitalFC | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flood swipe-compare: which two years, plus the polygons for each side.
  const [swipe, setSwipe] = useState<SwipeCompareState | null>(null);
  const [floodA, setFloodA] = useState<FloodFC>(() => emptyFC<FloodProps>());
  const [floodB, setFloodB] = useState<FloodFC>(() => emptyFC<FloodProps>());

  const {
    layers,
    visibleCount,
    toggleLayer,
    applyExact,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useMapLayers();

  const { width, active, onPointerDown, onKeyDown } = useChatResizer(direction);
  // Feed every analysis layer with (mock) demo data so toggling a layer renders
  // real geometry on the map. During a flood swipe-compare the main map's flood
  // layer switches to year B (year A is drawn in the clipped overlay).
  // Memoised so the map's data-sync effect only fires when the data changes.
  const mapData = useMemo(
    () => ({
      hospitals: hospitalsFC ?? MOCK_HOSPITALS,
      boundaries: MOCK_BOUNDARIES,
      buffer: MOCK_BUFFER,
      flood: swipe ? floodB : MOCK_FLOOD,
    }),
    [swipe, floodB, hospitalsFC],
  );
  const {
    containerRef,
    map,
    zoom,
    flyTo,
    fitBounds,
    setAggregate,
    setBoundaries,
  } = useMorphismMap({ layers, data: mapData, theme: resolvedTheme });

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

  const {
    containerRef: swipeContainerRef,
    clip,
    setClip,
  } = useFloodSwipe({ active: swipe !== null, mainMap: map, data: floodA });

  // Load both years' polygons whenever a swipe-compare is requested.
  useEffect(() => {
    if (!swipe) return;
    let cancelled = false;
    void (async () => {
      const [a, b] = await Promise.all([
        getFlood(swipe.yearA),
        getFlood(swipe.yearB),
      ]);
      if (cancelled) return;
      setFloodA(a);
      setFloodB(b);
    })();
    return () => {
      cancelled = true;
    };
  }, [swipe]);

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

  // Apply the assistant's interpretation to the map (deterministic scenario).
  const onScenario = useCallback(
    (scenario: Scenario) => {
      if (scenario.mode === "aggregate") {
        // Province-summary view. Hospitals are marked "desired" so the zoom gate
        // can reveal the points at zoom ≥ 11.8 (the scenario stays in
        // aggregation mode logically; only layer visibility flips by zoom).
        applyExact(["hospitals"]);
        setAggregate(scenario.aggregate ?? []);
        setAggregateState(scenario.aggregate ?? null);
        // Draw the real polygons for the scenario's provinces (no fake geometry).
        const all = boundariesRef.current;
        const names = scenario.provinceNames ?? [];
        let fitted = false;

        // Resolve region colour(s) ONCE from the design tokens — this is the
        // single source of truth shared by the polygons AND the legend swatch.
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
        // Single region → its colour; multiple (nationwide) → default boundary.
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
            const feat: AdmFeature = {
              type: "Feature",
              geometry: f.geometry,
              properties: {
                name: n,
                region: region ?? undefined,
                color: colorFor(region),
              },
            };
            return [feat];
          });
          const subset: ProvinceBoundaryFC = {
            type: "FeatureCollection",
            features,
          };
          setBoundaries(subset);
          // Fit to the REAL polygon extent so the overview zoom matches the HTML
          // (whole region/province), not a tight centroid box.
          const bbox = features.length ? bboxOf(subset) : null;
          if (bbox) {
            fitBounds({
              sw: [bbox[0], bbox[1]],
              ne: [bbox[2], bbox[3]],
              duration: scenario.bounds?.duration ?? 1200,
            });
            fitted = true;
          }
        } else {
          setBoundaries(null); // fetch failed/empty → no polygons (badges remain)
        }
        // Fallback camera (centroid bounds) when polygons aren't available.
        if (!fitted && scenario.bounds) fitBounds(scenario.bounds);
      } else {
        // Point / analysis view: clear aggregation + polygons, show exactly this
        // scenario's layers, fly to its camera.
        setAggregate(null);
        setAggregateState(null);
        setBoundaries(null);
        setBoundaryColor(null);
        applyExact(scenario.layers, true);
        if (scenario.camera) flyTo(scenario.camera);
      }
      // Time filter pill: on with the scenario's label, else cleared.
      setTimeActive(Boolean(scenario.timeActive));
      setTimeLabel(scenario.timeActive ? scenario.timeLabel ?? null : null);
      // Enter/leave swipe-compare; a non-swipe query closes any open compare.
      setSwipe(scenario.swipe ?? null);
      showToast(t("morphism.toast.applied"));
    },
    [applyExact, setAggregate, setBoundaries, fitBounds, flyTo, showToast, t],
  );

  const { messages, ask, pending } = useAiAssistant({
    resolve: resolveScenario,
    onScenario,
  });

  const handleUndo = useCallback(() => {
    undo();
    showToast(t("morphism.toast.undone"));
  }, [undo, showToast, t]);

  const handleRedo = useCallback(() => {
    redo();
    showToast(t("morphism.toast.redone"));
  }, [redo, showToast, t]);

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
              canUndo={canUndo}
              canRedo={canRedo}
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
              onChange={(dir) => {
                setDirection(dir);
                setSettingsOpen(false);
              }}
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
          />

        <SwipeCompare
          active={swipe !== null}
          yearA={swipe?.yearA ?? 0}
          yearB={swipe?.yearB ?? 0}
          containerRef={swipeContainerRef}
          clip={clip}
          onClipChange={setClip}
          onClose={() => setSwipe(null)}
        />

        <Toast message={toast} />


      </main>
    </div>
  );
};

export default MorphismView;
