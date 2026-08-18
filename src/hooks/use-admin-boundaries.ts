"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAdmBoundaries } from "@/lib/api";
import { readCssColor } from "@/lib/map-tokens";
import { getMapZoomBand, type MapZoomBand } from "@/lib/map-zoom";
import type { AdmFC, FeatureCollection, Geometry } from "@/types";

type MaplibreMap = import("maplibre-gl").Map;

/** The real administrative level the manual boundaries layer is showing. */
export type AdminBoundaryLevel =
  | "region"
  | "province"
  | "district"
  | "subdistrict";

interface UseAdminBoundariesArgs {
  map: MaplibreMap | null;
  /** The "Administrative boundaries" layer-panel toggle. */
  visible: boolean;
  /** Active UI theme — region colours are re-resolved from tokens on change. */
  theme?: string;
  /** Colour-vision mode — bumps the cache key so the region view re-resolves
   *  its category colours when the palette flips (default/viridis/gray). */
  paletteVersion?: string;
  /** Province name → design-token CSS var for its region colour (region view). */
  regionVarFor: (provinceName: string) => string;
}

interface AdminBoundariesState {
  /** Data for the map's `boundaries` source (null while off / not loaded). */
  fc: FeatureCollection<unknown> | null;
  /** Level currently rendered (drives the legend label), null when off. */
  level: AdminBoundaryLevel | null;
  loading: boolean;
  error: boolean;
}

const DEBOUNCE_MS = 200;
// Viewport padding for the subdistrict slice (fraction of the view size) so
// small pans don't retrigger a re-slice.
const VIEW_PAD = 0.5;

/** Zoom band → admin level (same shared bands as the rest of the app). */
const bandLevel = (b: MapZoomBand): AdminBoundaryLevel =>
  b === "summary"
    ? "region"
    : b === "adm1"
      ? "province"
      : b === "adm3-context"
        ? "subdistrict"
        : "district"; // "adm2" + "points" (8.5 ≤ z < 12)

/** Which ADM dataset feeds each level. */
const ADM_FOR: Record<AdminBoundaryLevel, "ADM1" | "ADM2" | "ADM3"> = {
  region: "ADM1",
  province: "ADM1",
  district: "ADM2",
  subdistrict: "ADM3",
};

type BBoxT = [number, number, number, number];

// Per-feature bbox cache — ADM3 has thousands of polygons; computing each bbox
// once keeps the viewport slice at ~ms cost on every moveend.
const bboxCache = new WeakMap<object, BBoxT>();

function geomBBox(g: Geometry): BBoxT {
  const cached = bboxCache.get(g as object);
  if (cached) return cached;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const p = c as number[];
      if (p[0] < w) w = p[0];
      if (p[0] > e) e = p[0];
      if (p[1] < s) s = p[1];
      if (p[1] > n) n = p[1];
      return;
    }
    if (Array.isArray(c)) for (const child of c) walk(child);
  };
  walk((g as { coordinates?: unknown }).coordinates);
  const bb: BBoxT = [w, s, e, n];
  bboxCache.set(g as object, bb);
  return bb;
}

const intersects = (a: BBoxT, b: BBoxT): boolean =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/**
 * REAL zoom-banded administrative boundaries for the manual "Administrative
 * boundaries" layer toggle (replaces the old mock rectangle):
 *
 *   z < 6      → region       (ADM1 provinces colour-grouped by region)
 *   6 ≤ z <8.5 → province     (ADM1 outlines)
 *   8.5≤ z <12 → district     (ADM2 outlines)
 *   z ≥ 12     → subdistrict  (ADM3 outlines, sliced to the viewport)
 *
 * Datasets come from the SAME cached open-data loader the admin hierarchy uses
 * (`getAdmBoundaries`), so nothing is fetched twice. The produced FC feeds the
 * map's existing `boundaries` source; per-feature `level`/`color` properties
 * drive the line/fill styling data-driven.
 */
export function useAdminBoundaries({
  map,
  visible,
  theme,
  paletteVersion,
  regionVarFor,
}: UseAdminBoundariesArgs): AdminBoundariesState {
  const [state, setState] = useState<AdminBoundariesState>({
    fc: null,
    level: null,
    loading: false,
    error: false,
  });
  const runRef = useRef(0);
  // Last committed slice key: level + (for subdistrict) the padded view bbox.
  const keyRef = useRef<string>("");
  const paddedRef = useRef<BBoxT | null>(null);

  const compute = useCallback(async () => {
    if (!map) return;
    if (!visible) {
      runRef.current += 1; // supersede any in-flight load so it can't commit late
      keyRef.current = "";
      paddedRef.current = null;
      setState((s) =>
        s.fc === null && s.level === null && !s.loading && !s.error
          ? s
          : { fc: null, level: null, loading: false, error: false },
      );
      return;
    }

    const level = bandLevel(getMapZoomBand(map.getZoom()));

    // Subdistrict view: skip when the view is still inside the last padded bbox.
    let view: BBoxT | null = null;
    if (level === "subdistrict") {
      const b = map.getBounds();
      view = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      if (
        keyRef.current.startsWith("subdistrict") &&
        paddedRef.current &&
        intersects(paddedRef.current, view) &&
        view[0] >= paddedRef.current[0] &&
        view[1] >= paddedRef.current[1] &&
        view[2] <= paddedRef.current[2] &&
        view[3] <= paddedRef.current[3]
      ) {
        return;
      }
    } else if (keyRef.current === `${level}|${theme ?? ""}|${paletteVersion ?? ""}`) {
      return;
    }

    const runId = ++runRef.current;
    setState((s) => (s.loading && !s.error ? s : { ...s, loading: true, error: false }));

    const adm = await getAdmBoundaries(ADM_FOR[level]);
    if (runId !== runRef.current) return;
    if (!adm) {
      keyRef.current = "";
      setState({ fc: null, level, loading: false, error: true });
      return;
    }

    setState({
      fc: buildLevelFC(adm, level, view, regionVarFor),
      level,
      loading: false,
      error: false,
    });
    if (level === "subdistrict" && view) {
      const padW = (view[2] - view[0]) * VIEW_PAD;
      const padH = (view[3] - view[1]) * VIEW_PAD;
      paddedRef.current = [
        view[0] - padW,
        view[1] - padH,
        view[2] + padW,
        view[3] + padH,
      ];
      keyRef.current = "subdistrict";
    } else {
      paddedRef.current = null;
      keyRef.current = `${level}|${theme ?? ""}|${paletteVersion ?? ""}`;
    }

    function buildLevelFC(
      src: AdmFC,
      lvl: AdminBoundaryLevel,
      viewBox: BBoxT | null,
      varFor: (name: string) => string,
    ): FeatureCollection<unknown> {
      // Region view: colour every province polygon by its region token so the
      // six regions read as colour groups (fill via the data-driven layer).
      const colorCache = new Map<string, string>();
      const colorFor = (name: string): string => {
        const tokenVar = varFor(name);
        let c = colorCache.get(tokenVar);
        if (c === undefined) {
          c = readCssColor(tokenVar);
          colorCache.set(tokenVar, c);
        }
        return c;
      };
      let features = src.features;
      if (lvl === "subdistrict" && viewBox) {
        const padW = (viewBox[2] - viewBox[0]) * VIEW_PAD;
        const padH = (viewBox[3] - viewBox[1]) * VIEW_PAD;
        const padded: BBoxT = [
          viewBox[0] - padW,
          viewBox[1] - padH,
          viewBox[2] + padW,
          viewBox[3] + padH,
        ];
        features = features.filter((f) => intersects(geomBBox(f.geometry), padded));
      }
      return {
        type: "FeatureCollection",
        features: features.map((f) => ({
          type: "Feature" as const,
          geometry: f.geometry,
          properties: {
            name: f.properties.name,
            level: lvl,
            ...(lvl === "region" ? { color: colorFor(f.properties.name) } : {}),
          },
        })),
      };
    }
  }, [map, visible, theme, paletteVersion, regionVarFor]);

  // Recompute on toggle/zoom-band change; for the subdistrict band also on pans
  // that leave the padded slice. Debounced on moveend like the admin hierarchy.
  useEffect(() => {
    if (!map) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void compute(), DEBOUNCE_MS);
    };
    schedule();
    map.on("moveend", schedule);
    return () => {
      if (timer) clearTimeout(timer);
      map.off("moveend", schedule);
    };
  }, [map, compute]);

  return state;
}
