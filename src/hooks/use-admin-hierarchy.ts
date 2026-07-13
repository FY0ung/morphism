"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAdmBoundaries } from "@/lib/api";
import { normalizeProvinceName, polygonCentroid, unitsWithData } from "@/lib/geo";
import { readCssColor } from "@/lib/map-tokens";
import { getMapZoomBand, usesAdm2, usesAdm3 } from "@/lib/map-zoom";
import type {
  AdmFC,
  FeatureCollection,
  Position,
  ProvinceBoundaryFC,
  ProvinceCount,
} from "@/types";

type MaplibreMap = import("maplibre-gl").Map;

/**
 * "aggregate" = the scenario already supplies precomputed province counts +
 * region-coloured polygons (hook only adds ADM2/ADM3).
 * "points"    = a point scenario; the hook derives province counts + polygons
 * from the displayed hospital points (so zoom-out aggregates them), then ADM2/3.
 */
type HierarchyMode = "aggregate" | "points";

interface UseAdminHierarchyArgs {
  map: MaplibreMap | null;
  /** True whenever hospitals are on the map (any hospital scenario). */
  active: boolean;
  mode: HierarchyMode;
  /** Focus provinces for "aggregate" mode; ignored in "points" mode. */
  provinceNames: string[];
  /** Displayed hospital coordinates, counted inside each admin unit. */
  points: Position[];
  /** Design-token var for point-mode province outlines (resolved client-side). */
  boundaryColorVar: string;
  setAggregate: (p: ProvinceCount[] | null) => void;
  setBoundaries: (fc: ProvinceBoundaryFC | null) => void;
  setDistricts: (fc: FeatureCollection<unknown> | null) => void;
  setSubdistricts: (fc: FeatureCollection<unknown> | null) => void;
}

interface AdmStatus {
  loading: boolean;
  error: boolean;
  empty: boolean;
}

const DEBOUNCE_MS = 200;

/** Province names → parent pro_code set (empty names = every province). */
function codesForProvinces(adm1: AdmFC, names: string[]): Set<string> {
  const set = new Set<string>();
  const wantAll = names.length === 0;
  const wanted = new Set(names.map(normalizeProvinceName));
  for (const f of adm1.features) {
    const code = f.properties.pro_code;
    if (!code) continue;
    if (wantAll) {
      set.add(code);
      continue;
    }
    // Canonical EXACT match — never loose substring (leaks blanks/partials).
    if (wanted.has(normalizeProvinceName(f.properties.name))) set.add(code);
  }
  return set;
}

/**
 * Lazy multi-level admin aggregation, ported from the HTML `updateAdminHierarchy`:
 *   6–8.5 → ADM1 province counts · 8.5–11 → ADM2 district counts ·
 *   ≥11 points · ≥12 ADM3 boundary context. Datasets are cached + deduped;
 *   recompute is debounced on moveend; any load failure falls back to the
 *   previous level and reports an error. The current level stays visible while a
 *   deeper one loads (no flicker).
 */
export function useAdminHierarchy({
  map,
  active,
  mode,
  provinceNames,
  points,
  boundaryColorVar,
  setAggregate,
  setBoundaries,
  setDistricts,
  setSubdistricts,
}: UseAdminHierarchyArgs): AdmStatus {
  const [status, setStatus] = useState<AdmStatus>({
    loading: false,
    error: false,
    empty: false,
  });
  const lastKeyRef = useRef<string>("");
  const runRef = useRef(0);

  // Update status only when a field actually changes — a fresh object literal
  // would re-render every call and (with the debounced recompute) spin forever.
  const setStatusIfChanged = useCallback((next: AdmStatus) => {
    setStatus((prev) =>
      prev.loading === next.loading &&
      prev.error === next.error &&
      prev.empty === next.empty
        ? prev
        : next,
    );
  }, []);

  const namesKey = provinceNames.join("|");

  const compute = useCallback(async () => {
    if (!map) return;
    // Which ADM levels are needed comes from the ONE shared zoom-band helper.
    const band = getMapZoomBand(map.getZoom());
    const needAdm2 = usesAdm2(band); // z ≥ 8.5
    const needAdm3 = usesAdm3(band); // z ≥ 12

    if (!active) {
      lastKeyRef.current = "";
      setDistricts(null);
      setSubdistricts(null);
      setStatusIfChanged({ loading: false, error: false, empty: false });
      return;
    }

    const key = `${mode}|${band}|${namesKey}|${points.length}`;
    if (key === lastKeyRef.current) return;
    const runId = ++runRef.current;
    setStatus((s) => ({ ...s, loading: true, error: false }));

    // ADM1 is always needed (province counting + parent-code mapping).
    const adm1 = await getAdmBoundaries("ADM1");
    if (runId !== runRef.current) return;
    if (!adm1) {
      setDistricts(null);
      setSubdistricts(null);
      setStatusIfChanged({ loading: false, error: true, empty: false });
      lastKeyRef.current = "";
      return;
    }

    // Determine focus provinces (and, in points mode, drive province aggregation).
    let focusCodes: Set<string>;
    if (mode === "points") {
      const color = readCssColor(boundaryColorVar);
      // Province-specific query → restrict aggregation to EXACTLY that province
      // (no border-spill into neighbours, no region). No name = data-driven.
      const wanted = new Set(provinceNames.map(normalizeProvinceName));
      const provinceFeats = provinceNames.length
        ? adm1.features.filter((f) =>
            wanted.has(normalizeProvinceName(f.properties.name)),
          )
        : adm1.features;
      const provWithCounts = unitsWithData(provinceFeats, points);
      setAggregate(
        provWithCounts.features.map((f) => ({
          name: f.properties.name,
          center: polygonCentroid(f.geometry),
          count: f.properties.count ?? 0,
        })),
      );
      setBoundaries({
        type: "FeatureCollection",
        features: provWithCounts.features.map((f) => ({
          type: "Feature",
          geometry: f.geometry,
          properties: { name: f.properties.name, color },
        })),
      });
      focusCodes = new Set(
        provWithCounts.features
          .map((f) => f.properties.pro_code)
          .filter((c): c is string => Boolean(c)),
      );
    } else {
      focusCodes = codesForProvinces(adm1, provinceNames);
    }

    let empty = false;
    if (needAdm2) {
      const adm2 = await getAdmBoundaries("ADM2");
      if (runId !== runRef.current) return;
      if (!adm2) {
        // Graceful fallback → province aggregation stays, clear error flag set.
        setDistricts(null);
        setSubdistricts(null);
        setStatusIfChanged({ loading: false, error: true, empty: false });
        lastKeyRef.current = "";
        return;
      }
      const districts = adm2.features.filter(
        (f) => f.properties.pro_code && focusCodes.has(f.properties.pro_code),
      );
      const withCounts = unitsWithData(districts, points);
      setDistricts(withCounts);
      empty = withCounts.features.length === 0;

      if (needAdm3) {
        const adm3 = await getAdmBoundaries("ADM3");
        if (runId !== runRef.current) return;
        if (adm3) {
          const subs = adm3.features.filter(
            (f) => f.properties.pro_code && focusCodes.has(f.properties.pro_code),
          );
          setSubdistricts({ type: "FeatureCollection", features: subs });
        }
      } else {
        setSubdistricts(null);
      }
    } else {
      // Province band: no district/subdistrict.
      setDistricts(null);
      setSubdistricts(null);
    }

    lastKeyRef.current = key;
    setStatusIfChanged({ loading: false, error: false, empty });

    // [adm-debug] TEMP — remove after verifying zoom bands / aggregation.
    console.log("[adm-debug] hierarchy", {
      band,
      mode,
      hospitalPoints: points.length,
      focusProvinces: focusCodes.size,
    });
  }, [
    map,
    active,
    mode,
    namesKey,
    points,
    provinceNames,
    boundaryColorVar,
    setAggregate,
    setBoundaries,
    setDistricts,
    setSubdistricts,
    setStatusIfChanged,
  ]);

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

  return status;
}
