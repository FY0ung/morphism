// Static, presentational data + the (mock) intent matcher for the Morphism
// feature. No business logic lives in the views.
import type {
  LayerId,
  Scenario,
  MapCamera,
  MapBounds,
  ProvinceCount,
  ScenarioStep,
  HospitalFC,
  ChartData,
} from "@/types";
import type { FloodScenarioMeta } from "@/types";
import { FLOOD_COMPARE_SIDES } from "@/configs/flood-compare";
import { FLOOD_LATEST_DATA_YEAR, floodYearKey } from "@/configs/flood-data";
import {
  FLOOD_DATASET_BY_MONTH,
  FLOOD_DATASET_BY_YEAR,
  FLOOD_DATASET_DATE_SET,
} from "@/configs/flood-datasets";
import {
  normalizeQuery,
  FLOOD_TERMS,
  HOSPITAL_TERMS,
  BUFFER_TERMS,
  H24_TERMS,
  COMPARE_TERMS,
  COUNT_TERMS,
  NATION_TERMS,
  LATEST_TERMS,
  SONGKRAN_TERMS,
} from "@/configs/intent-keywords";
import {
  resolveFloodDate,
  detectFloodMonth,
  detectMonthPeriod,
  periodCalendarRange,
  periodDayRange,
  formatDate,
  formatMonth,
  toBuddhistYear,
  type FloodDateResolution,
  type MonthPeriod,
} from "@/lib/flood-date";
/* Geographic/dataset config (provinces, regions, centroids, aliases, region
 * colour tokens) lives in configs/geography.ts (Phase 3D) — this module is
 * intent parsing + scenario building only. Re-exported below so existing
 * importers keep working. */
import {
  PRESENTATION_PLACES,
  PROV_CENTROID,
  PROVINCE_ALIASES,
  PROVINCE_EN,
  REGIONS,
  REGION_BG,
  REGION_DEFAULT_TOKEN,
  REGION_EN_LONG,
  REGION_EN_SHORT,
  REGION_FILL,
  REGION_LABEL,
  REGION_TOKEN_VAR,
  provinceRegion,
} from "@/configs/geography";
export {
  PROVINCE_EN,
  REGION_BG,
  REGION_DEFAULT_TOKEN,
  REGION_EN_LONG,
  REGION_EN_SHORT,
  REGION_FILL,
  REGION_TOKEN_VAR,
  provinceRegion,
};
import { CAMERA } from "@/configs/motion";
import type { TFunction } from "@/languages/types";
import { normalizeProvinceName } from "@/lib/geo";
import { totalOfCounts, type ProvinceCounts } from "@/lib/hospital-stats";

/** Active UI language for scenario display. */
export type Lang = "en" | "th" | "ja";

/** Suggestion chips — `labelKey` is also the message sent when tapped. */
export const SUGGESTION_CHIPS = [
  "morphism.chips.c1",
  "morphism.chips.c2",
  "morphism.chips.c3",
  "morphism.chips.c4",
  "morphism.chips.c5",
  "morphism.chips.c6",
] as const;

/** Layer metadata for the panel + legend. Swatch colours use token utilities. */
export interface LayerMeta {
  id: LayerId;
  /** i18n key under `morphism.layer` */
  labelKey: string;
  /** Tailwind token utility for the colour swatch */
  swatchClass: string;
  /** rounded swatch (points) vs square (areas) */
  round: boolean;
}

export const LAYER_META: LayerMeta[] = [
  {
    id: "hospitals",
    labelKey: "morphism.layer.hospitals",
    swatchClass: "bg-data-hospitals",
    round: true,
  },
  {
    id: "flood",
    labelKey: "morphism.layer.flood",
    swatchClass: "bg-data-flood",
    round: false,
  },
  {
    id: "buffer",
    labelKey: "morphism.layer.buffer",
    swatchClass: "bg-data-analysis",
    round: false,
  },
  {
    id: "boundaries",
    labelKey: "morphism.layer.boundaries",
    swatchClass: "bg-background-primary-light",
    round: false,
  },
];

/* ──────────────────────────────────────────────────────────────────────────
 * MOCK GEODATA (demo)
 * Small, typed GeoJSON samples around central Bangkok so each analysis layer is
 * visibly demonstrated until the real services in `lib/api` are wired up.
 * Coordinates are GeoJSON order: [longitude, latitude].
 * ────────────────────────────────────────────────────────────────────────── */

/** Raw hospital rows: [name, lng, lat, h24, province]. */
const HOSPITAL_ROWS = [
  ["รพ. ศิริราช", 100.5345, 13.7563, true, "กรุงเทพมหานคร"],
  ["รพ. รามาธิบดี", 100.5235, 13.7665, true, "กรุงเทพมหานคร"],
  ["รพ. กรุงเทพ", 100.5835, 13.7475, true, "กรุงเทพมหานคร"],
  ["รพ. จุฬาลงกรณ์", 100.5365, 13.7305, true, "กรุงเทพมหานคร"],
  ["รพ. ตากสิน", 100.4985, 13.7235, false, "กรุงเทพมหานคร"],
  ["รพ. เจริญกรุงประชารักษ์", 100.5125, 13.7045, false, "กรุงเทพมหานคร"],
  ["รพ. มหาราชนครเชียงใหม่", 98.9700, 18.7905, true, "เชียงใหม่"],
  ["รพ. นครพิงค์", 98.9690, 18.8480, true, "เชียงใหม่"],
  ["รพ. เชียงใหม่ราม", 98.9785, 18.7995, true, "เชียงใหม่"],
  ["รพ. ลานนา", 98.9870, 18.8150, false, "เชียงใหม่"],
  ["รพ. สันทราย", 99.0480, 18.9120, false, "เชียงใหม่"],
] as const;

export type HospitalRow = (typeof HOSPITAL_ROWS)[number];

export const MOCK_HOSPITALS: HospitalFC = {
  type: "FeatureCollection",
  features: HOSPITAL_ROWS.map(([name, lng, lat, h24, province]) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: { name, h24, province },
  })),
};

// NOTE: the former mock 5 km buffer (two hardcoded Bangkok circles + centre
// markers + a mock "FLOOD_RISK" count) was removed — the buffer5km scenario is
// now a REAL server-side analysis (`/api/flood-buffer`): latest complete flood
// snapshot + real hospital points + real distance(point, polygon) ≤ 5 km.

/* ──────────────────────────────────────────────────────────────────────────
 * DETERMINISTIC SCENARIO CONTROLLER
 * Ported 1:1 from the HTML reference's SCENARIOS engine — exact camera values
 * (flyTo center/zoom/duration), tool-step labels + waits, interim/result copy.
 * Counts are derived from the mock data above so the text matches the dots.
 * ────────────────────────────────────────────────────────────────────────── */

const has = (t: string, ...needles: string[]) =>
  needles.some((n) => t.includes(n));


/** Display name for a province in the active language (falls back to Thai). */
export function provinceLabel(thaiName: string, lang: Lang): string {
  if (lang === "th") return thaiName;
  return PROVINCE_EN[thaiName] ?? thaiName;
}

/** Full (sentence) display name for a region key in the active language. */
export function regionLabel(regionKey: string, lang: Lang): string {
  if (lang === "th") return REGION_LABEL[regionKey] ?? regionKey;
  return REGION_EN_LONG[regionKey] ?? regionKey;
}

/** Short display name for a region key (chart/legend/compare). */
export function regionLabelShort(regionKey: string, lang: Lang): string {
  if (lang === "th") return REGION_LABEL[regionKey] ?? regionKey;
  return REGION_EN_SHORT[regionKey] ?? regionKey;
}

/** Thailand bounds (HTML TH_BOUNDS) for the nationwide camera. */
const TH_BOUNDS: MapBounds = { sw: [97.34, 5.61], ne: [105.64, 20.46], duration: 1200 };

/**
 * Hospital count for one province. When the LIVE dataset counts are available
 * (built from the loaded hospitals.geojson) they are the single source of
 * truth — including an honest 0 for provinces with no record. The static
 * reference figures from the HTML port are ONLY the pre-load fallback.
 */
function countOf(name: string, counts?: ProvinceCounts): number {
  if (counts) return counts.get(normalizeProvinceName(name)) ?? 0;
  return PROV_CENTROID[name]?.[2] ?? 0;
}
function provinceCount(
  name: string,
  counts?: ProvinceCounts,
): ProvinceCount | null {
  const c = PROV_CENTROID[name];
  return c ? { name, center: [c[0], c[1]], count: countOf(name, counts) } : null;
}
function regionProvinces(
  region: string,
  counts?: ProvinceCounts,
): ProvinceCount[] {
  return (REGIONS[region] ?? [])
    .map((n) => provinceCount(n, counts))
    .filter((p): p is ProvinceCount => p !== null);
}
function regionTotal(region: string, counts?: ProvinceCounts): number {
  return regionProvinces(region, counts).reduce((s, p) => s + p.count, 0);
}
/** Mean centroid of a region's provinces (for the region count label). */
function regionCentroid(region: string): [number, number] {
  const ps = regionProvinces(region);
  const cx = ps.reduce((s, p) => s + p.center[0], 0) / ps.length;
  const cy = ps.reduce((s, p) => s + p.center[1], 0) / ps.length;
  return [cx, cy];
}

/** Bounds enclosing a set of points (+ margin) for fitBounds. */
function boundsOf(
  provinces: ProvinceCount[],
  margin = 0.65,
  duration = 1200,
): MapBounds {
  const xs = provinces.map((p) => p.center[0]);
  const ys = provinces.map((p) => p.center[1]);
  return {
    sw: [Math.min(...xs) - margin, Math.min(...ys) - margin],
    ne: [Math.max(...xs) + margin, Math.max(...ys) + margin],
    duration,
  };
}

export const NORTH_PROVINCES = regionProvinces("เหนือ");
export const NORTH_TOTAL = regionTotal("เหนือ"); // 1290

// Region-level aggregation badges (one per region) for the nationwide view.
function regionBadges(counts?: ProvinceCounts): ProvinceCount[] {
  return Object.keys(REGIONS).map((region) => {
    const ps = regionProvinces(region, counts);
    const cx = ps.reduce((s, p) => s + p.center[0], 0) / ps.length;
    const cy = ps.reduce((s, p) => s + p.center[1], 0) / ps.length;
    return {
      name: REGION_LABEL[region],
      center: [cx, cy],
      count: regionTotal(region, counts),
    };
  });
}
function grandTotal(counts?: ProvinceCounts): number {
  if (counts) return totalOfCounts(counts);
  return Object.values(PROV_CENTROID).reduce((s, c) => s + c[2], 0);
}

// Camera presets — exact values from the reference HTML.
const CAM = {
  bkk: { center: [100.528, 13.742], zoom: 11.8, duration: 1100 },
  songkran: { center: [100.484, 13.768], zoom: 12.1, duration: 1100 },
  chiangmai: { center: [98.8964, 18.8507], zoom: 9.2, duration: 1200 },
  north: { center: [99.45, 18.55], zoom: 7.2, duration: 1200 },
  compare: { center: [101.6, 16.3], zoom: 5.6, duration: 1100 },
  nation: { center: [100.99, 13.0], zoom: 5.1, duration: 1200 },
} satisfies Record<string, MapCamera>;

/** Shared catalog-search step (technical label — identical in both languages). */
const catalogStep = (t: TFunction, wait = 430): ScenarioStep => ({
  label: t("morphism.scenario.steps.catalog"),
  wait,
});

/**
 * Hospitals scoped to a province (point mode) — the extracted location is the
 * single source of truth for the camera, the point filter AND the ADM
 * aggregation. `province === null` = no location in the prompt (keep the current
 * map extent, show the full set). NEVER hardcodes Bangkok.
 */
const scnCityHospitals = (
  province: string | null,
  h24: boolean,
  t: TFunction,
  lang: Lang,
): Scenario => {
  const c = province ? PROV_CENTROID[province] : undefined;
  // Bangkok is dense → a slightly tighter zoom; other provinces a touch wider.
  const zoom = province === "กรุงเทพมหานคร" ? 11.8 : 11.2;
  const where = province
    ? provinceLabel(province, lang)
    : t("morphism.scenario.place.currentArea");
  const provDisplay = province ? provinceLabel(province, lang) : "";
  return {
    id: province ? `hosp-${province}` : "hosp-scoped",
    mode: "points",
    layers: ["hospitals"],
    // Camera derives from the SELECTED province's centroid (not Bangkok); when no
    // province is given we omit it so the view keeps the current extent.
    camera: c ? { center: [c[0], c[1]], zoom, duration: 1100 } : undefined,
    hospitalScope: { province: province ?? undefined, h24 },
    interim: h24
      ? t("morphism.scenario.hosp.interim24", { where })
      : t("morphism.scenario.hosp.interim", { where }),
    steps: [
      {
        label: t("morphism.scenario.hosp.stepResolve", {
          target: provDisplay || t("morphism.scenario.hosp.resolveNone"),
        }),
        wait: 380,
      },
      catalogStep(t),
      {
        label: t("morphism.scenario.hosp.stepFilter", {
          province: provDisplay || "*",
        }),
        wait: 380,
      },
      ...(h24
        ? [{ label: t("morphism.scenario.hosp.stepFilter24"), wait: 430 }]
        : []),
    ],
    result: province
      ? h24
        ? t("morphism.scenario.hosp.result24", { province: provDisplay })
        : t("morphism.scenario.hosp.result", { province: provDisplay })
      : h24
        ? t("morphism.scenario.hosp.result24NoProvince")
        : t("morphism.scenario.hosp.resultNoProvince"),
  };
};

/** Flood during the last Songkran period. */
const scnSongkran = (t: TFunction): Scenario => ({
  id: "songkran",
  mode: "analysis",
  layers: ["flood"],
  camera: CAM.songkran,
  timeActive: true,
  timeLabel: t("morphism.scenario.songkran.timeLabel"),
  interim: t("morphism.scenario.songkran.interim"),
  steps: [
    { label: t("morphism.scenario.songkran.step1"), wait: 430 },
    { label: t("morphism.scenario.songkran.step2"), wait: 380 },
    { label: t("morphism.scenario.songkran.step3"), wait: 430 },
  ],
  result: t("morphism.scenario.songkran.result"),
});

/**
 * Hospitals within 5 km of flood areas — REAL server-side analysis.
 * The dataset (latest COMPLETE flood snapshot), count, camera bounds and
 * time-pill label are all resolved at RUNTIME from `/api/flood-buffer`; nothing
 * here is baked. `result` is a placeholder only — the view always supplies the
 * live message (with the exact resolved date) via the ScenarioOutcome.
 */
const scnBuffer5km = (t: TFunction): Scenario => ({
  id: "buffer5km",
  mode: "analysis",
  layers: ["flood", "hospitals"],
  analysis: "flood-buffer",
  interim: t("morphism.scenario.buffer.interim"),
  steps: [
    { label: t("morphism.scenario.buffer.step1"), wait: 0 },
    { label: t("morphism.scenario.buffer.step2"), wait: 0 },
    { label: t("morphism.scenario.buffer.step3"), wait: 0 },
    { label: t("morphism.scenario.buffer.step4"), wait: 0 },
    { label: t("morphism.scenario.buffer.step5"), wait: 0 },
  ],
  result: "",
});

/** Hospitals in a single province — province-summary aggregation. */
const scnProvince = (
  name: string,
  t: TFunction,
  lang: Lang,
  counts?: ProvinceCounts,
): Scenario => {
  const p = provinceCount(name, counts)!;
  const prov = provinceLabel(name, lang);
  return {
    id: "province",
    mode: "aggregate",
    layers: [],
    aggregate: [p],
    provinceNames: [name],
    bounds: boundsOf([p], 0.85, 1200),
    interim: t("morphism.scenario.province.interim", { province: prov }),
    steps: [
      { label: t("morphism.scenario.province.step1", { province: prov }), wait: 360 },
      catalogStep(t, 420),
      { label: t("morphism.scenario.province.step2", { province: prov }), wait: 460 },
    ],
    result: t("morphism.scenario.province.result", {
      province: prov,
      count: p.count.toLocaleString(),
    }),
  };
};

/** Hospitals across a region — province aggregation + per-province bar chart. */
const scnRegion = (
  region: string,
  t: TFunction,
  lang: Lang,
  counts?: ProvinceCounts,
): Scenario => {
  const provinces = regionProvinces(region, counts);
  const total = regionTotal(region, counts);
  const regionLong = regionLabel(region, lang);
  const regionShort = regionLabelShort(region, lang);
  return {
    id: "region",
    mode: "aggregate",
    layers: [],
    aggregate: provinces,
    provinceNames: REGIONS[region] ?? [],
    bounds: boundsOf(provinces),
    interim: t("morphism.scenario.region.interim", {
      region: regionLong,
      count: String(provinces.length),
    }),
    steps: [
      {
        label: t("morphism.scenario.region.step1", {
          region: regionShort,
          count: String(provinces.length),
        }),
        wait: 380,
      },
      catalogStep(t, 420),
      { label: t("morphism.scenario.region.step3", { region: regionLong }), wait: 480 },
    ],
    result: t("morphism.scenario.region.result", {
      region: regionLong,
      count: total.toLocaleString(),
      provinces: String(provinces.length),
    }),
    charts: [
      {
        kind: "bar",
        title: t("morphism.scenario.region.chartTitle", { region: regionLong }),
        rows: [...provinces]
          .sort((a, b) => b.count - a.count)
          .map((p) => ({ label: provinceLabel(p.name, lang), value: p.count })),
        exportName: `hospitals-by-province-${region}`,
      },
    ],
  };
};

/** Compare regions (North vs Northeast) — donut/bar of counts. */
/** Regions compared in the fixed "North vs Northeast" scenario. */
const COMPARE_REGIONS = ["เหนือ", "อีสาน"];

/** Localized legend rows for the region-compare (label + region colour class). */
export function compareLegend(lang: Lang): { label: string; swatch: string }[] {
  return COMPARE_REGIONS.map((rg) => ({
    label: regionLabelShort(rg, lang),
    swatch: REGION_BG[rg],
  }));
}

/**
 * Compare hospitals across regions (North vs Northeast) — ported from the HTML
 * CMP mode: region-coloured boundaries + ONE count label per region, hospital
 * points hidden, donut with the region colours.
 */
const scnCompareRegions = (
  t: TFunction,
  lang: Lang,
  counts?: ProvinceCounts,
): Scenario => {
  const provinceNames = COMPARE_REGIONS.flatMap((rg) => REGIONS[rg] ?? []);
  const provincePts = provinceNames
    .map((n) => provinceCount(n, counts))
    .filter((p): p is ProvinceCount => p !== null);
  const regionA = regionLabel(COMPARE_REGIONS[0], lang);
  const regionB = regionLabel(COMPARE_REGIONS[1], lang);
  return {
    id: "cmp",
    mode: "aggregate",
    regionCompare: true,
    layers: ["boundaries"],
    // One aggregate entry per region → one count label at the region centroid.
    aggregate: COMPARE_REGIONS.map((rg) => ({
      name: regionLabelShort(rg, lang),
      center: regionCentroid(rg),
      count: regionTotal(rg, counts),
    })),
    provinceNames,
    // Frame BOTH regions (like the HTML fitBounds over both regions' extent).
    bounds: boundsOf(provincePts, 0.9, 1100),
    interim: t("morphism.scenario.compare.interim", { regionA, regionB }),
    steps: [
      {
        label: t("morphism.scenario.compare.step1", {
          count: String(COMPARE_REGIONS.length),
        }),
        wait: 360,
      },
      catalogStep(t, 420),
      { label: t("morphism.scenario.compare.step3"), wait: 460 },
    ],
    result: t("morphism.scenario.compare.result", { regionA, regionB }),
    charts: [
      {
        kind: "donut",
        title: t("morphism.scenario.compare.chartTitle", { regionA, regionB }),
        centerLabel: t("morphism.scenario.compare.centerLabel"),
        rows: COMPARE_REGIONS.map((rg) => ({
          label: regionLabelShort(rg, lang),
          value: regionTotal(rg, counts),
          swatch: REGION_FILL[rg],
        })),
        exportName: "region-compare",
      },
    ],
  };
};

/** Hospitals nationwide — region-grouped aggregation across all 77 provinces. */
const scnNation = (
  t: TFunction,
  lang: Lang,
  counts?: ProvinceCounts,
): Scenario => {
  // Region-keyed rows so chart labels can be localized (regionBadges' name is a
  // display-only Thai label used for the map aggregate). Each bar carries its
  // REGION CATEGORY colour (same REGION_FILL mapping the map + legend use), so
  // bars stay distinguishable — and identical to the map — in every
  // colour-vision mode. Colour = identity; LENGTH already encodes magnitude.
  const regionRows = Object.keys(REGIONS).map((rg) => ({
    label: regionLabelShort(rg, lang),
    value: regionTotal(rg, counts),
    swatch: REGION_FILL[rg],
  }));
  return {
    id: "nation",
    mode: "aggregate",
    layers: [],
    aggregate: regionBadges(counts),
    provinceNames: Object.keys(PROV_CENTROID),
    bounds: TH_BOUNDS,
    interim: t("morphism.scenario.nation.interim"),
    steps: [
      { label: t("morphism.scenario.nation.step1"), wait: 360 },
      { label: t("morphism.scenario.nation.step2"), wait: 440 },
      { label: t("morphism.scenario.nation.step3"), wait: 480 },
    ],
    result: t("morphism.scenario.nation.result", {
      count: grandTotal(counts).toLocaleString(),
    }),
    charts: [
      {
        kind: "bar",
        title: t("morphism.scenario.nation.chartTitle"),
        rows: [...regionRows].sort((a, b) => b.value - a.value),
        exportName: "hospitals-by-region",
      },
    ],
  };
};

/** One side of a compare: a resolved observation DATE + a display label.
 *  `key` is the PMTiles dataset key (a date, or `year-<CE>` for the annual
 *  cumulative dataset); the geojson fallback ignores it and uses `date`. */
export interface CompareTarget {
  date: string;
  label: string;
  key?: string;
}

/** Resolve one side of a compare (a date, month, or year) → a dated target. */
function compareTargetFor(
  part: string,
  t: TFunction,
  lang: Lang,
): CompareTarget | null {
  const r = resolveFloodDate(part);
  if (r.matchMode === "exact-date" && r.resolvedDate) {
    return {
      date: r.resolvedDate,
      label: formatDate(r.resolvedDate, lang),
      key: r.resolvedDate,
    };
  }
  if (r.matchMode === "month" && r.resolvedMonth) {
    const d = FLOOD_SNAPSHOT_BY_MONTH[r.resolvedMonth];
    if (d)
      return { date: d, label: formatMonth(r.resolvedMonth, lang), key: d };
  }
  if (r.matchMode === "year" && r.year != null) {
    // A future year with no observations yet (e.g. B.E. 2569 -> CE 2026)
    // clamps to the latest year that HAS data, and the label shows the year
    // actually compared - never a fabricated dataset.
    const year = Math.min(r.year, FLOOD_LATEST_DATA_YEAR);
    const d = FLOOD_SNAPSHOT_BY_YEAR[String(year)];
    if (d) {
      const shown = lang === "th" ? toBuddhistYear(year) : year;
      return {
        date: d,
        label: t("morphism.scenario.flood.yearLabel", { year: String(shown) }),
        // Year queries compare the ANNUAL CUMULATIVE dataset in pmtiles mode.
        key: floodYearKey(year),
      };
    }
  }
  return null;
}

/**
 * Resolve BOTH sides of a compare query. Splits on "vs" / "เทียบ" / "กับ"; each
 * side may be a year ("2025"), a month ("oct 2025"), or an exact date
 * ("13 oct 2025"). Falls back to two bare 4-digit years when there is no
 * splitter. Returns null when two sides can't be resolved.
 */
export function resolveCompareTargets(
  raw: string,
  t: TFunction,
  lang: Lang,
): [CompareTarget, CompareTarget] | null {
  // Splitting on "เทียบ" also hits the "เทียบ" INSIDE "เปรียบเทียบ", leaving a
  // junk first part ("เปรียบ") — which used to drop an exact-date compare into
  // the bare-years fallback (silently substituting year datasets). Resolve
  // every part and pair the FIRST and LAST that actually resolve instead.
  const parts = raw
    .split(/\s*(?:\bvs\b|เทียบกับ|เทียบ|กับ)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const resolved = parts
      .map((p) => compareTargetFor(p, t, lang))
      .filter((x): x is CompareTarget => x !== null);
    if (resolved.length >= 2) return [resolved[0], resolved[resolved.length - 1]];
  }
  // Fallback: two bare years anywhere in the text.
  const years = (raw.match(/\d{4}/g) ?? []).map(Number);
  if (years.length >= 2) {
    const a = compareTargetFor(String(years[0]), t, lang);
    const b = compareTargetFor(String(years[1]), t, lang);
    if (a && b) return [a, b];
  }
  return null;
}

/**
 * Build the FINAL compare message + chart from REAL measured areas (km²). Called
 * by the view once both sides' live extents have been fetched + measured. Only
 * flooded AREA is reported — the app has no authoritative population/district
 * dataset, so those (previously mocked) figures are intentionally omitted.
 */
export function buildFloodCompareOutcome(
  args: { labelA: string; labelB: string; km2A: number; km2B: number },
  t: TFunction,
): { message: string; charts: ChartData[] } {
  const { labelA, labelB, km2A, km2B } = args;
  const raiA = Math.round(km2A * 625); // 1 km² = 625 ไร่
  const raiB = Math.round(km2B * 625);
  const dRai = raiA - raiB;
  const pct = raiB ? Math.round((dRai / raiB) * 1000) / 10 : 0;
  const areaDir = t(
    dRai >= 0
      ? "morphism.scenario.floodCompare.increase"
      : "morphism.scenario.floodCompare.decrease",
  );

  const message = [
    t("morphism.scenario.floodCompare.resultIntro"),
    ``,
    t("morphism.scenario.floodCompare.resultLeft", {
      yearLabel: labelA,
      rai: raiA.toLocaleString(),
      km2: Math.round(km2A).toLocaleString(),
    }),
    t("morphism.scenario.floodCompare.resultRight", {
      yearLabel: labelB,
      rai: raiB.toLocaleString(),
      km2: Math.round(km2B).toLocaleString(),
    }),
    ``,
    t("morphism.scenario.floodCompare.resultSummary", {
      areaDir,
      pct: String(Math.abs(pct)),
      sign: dRai >= 0 ? "+" : "−",
      raiDelta: Math.abs(dRai).toLocaleString(),
    }),
  ].join("\n");

  // HORIZONTAL BAR (never a donut): the two flooded areas are INDEPENDENT
  // absolute magnitudes, not parts of one whole — so no percentage-of-total and
  // no combined-total centre value. Bars share one scale (max = largest value),
  // so length is directly comparable. Colours stay on the centralized
  // data-palette vars (default ↔ viridis) via FLOOD_COMPARE_SIDES.
  const charts: ChartData[] = [
    {
      kind: "bar",
      title: t("morphism.scenario.floodCompare.chartAreaTitle", {
        yearLabelA: labelA,
        yearLabelB: labelB,
      }),
      unit: t("morphism.scenario.floodCompare.chartUnit"),
      rows: [
        { label: labelA, value: raiA, swatch: FLOOD_COMPARE_SIDES.a.fill },
        { label: labelB, value: raiB, swatch: FLOOD_COMPARE_SIDES.b.fill },
      ],
      exportName: `flood-area-compare`,
    },
  ];
  return { message, charts };
}

/**
 * Flood swipe-compare between two dated targets (LEFT = a, RIGHT = b). The
 * scenario only SETS UP the compare (steps + swipe); the view fetches each
 * side's REAL extent, measures the flooded area, draws both layers, and reports
 * the final message + chart via the scenario outcome. `result` here is a
 * fallback shown only if that async measurement fails.
 */
const scnFloodCompare = (
  a: CompareTarget,
  b: CompareTarget,
  t: TFunction,
): Scenario => ({
  id: `floodcmp-${a.date}-${b.date}`,
  mode: "analysis",
  layers: ["flood"],
  timeActive: true,
  timeLabel: `${a.label} · ${b.label}`,
  swipe: {
    dateA: a.date,
    dateB: b.date,
    labelA: a.label,
    labelB: b.label,
    keyA: a.key,
    keyB: b.key,
  },
  interim: t("morphism.scenario.floodCompare.interim", {
    yearLabelA: a.label,
    yearLabelB: b.label,
  }),
  steps: [
    {
      label: t("morphism.scenario.floodCompare.step1", {
        yearLabelA: a.label,
        yearLabelB: b.label,
      }),
      wait: 360,
    },
    {
      label: t("morphism.scenario.floodCompare.step2", {
        yearA: a.date,
        yearB: b.date,
      }),
      wait: 700,
    },
    { label: t("morphism.scenario.floodCompare.step3"), wait: 480 },
  ],
  result: t("morphism.scenario.floodCompare.resultIntro"),
});

/* ──────────────────────────────────────────────────────────────────────────
 * DETERMINISTIC DATE-BASED FLOOD SCENARIO (Vallaris / GISTDA)
 * Deterministic snapshots available in the system. A month query resolves to
 * the available snapshot in that month (and the chat states the snapshot date);
 * any other date/month resolves to an explicit empty state — never a silent
 * substitution of another date.
 * ────────────────────────────────────────────────────────────────────────── */
// Registered flood observation snapshots come from the SINGLE dataset registry
// (configs/flood-datasets.ts) — month/year aliases are DERIVED there, never
// hand-maintained here. Add a new date in the registry (+ its collection in
// configs/flood-server.ts) and this resolver picks it up automatically.
const FLOOD_SNAPSHOTS: ReadonlySet<string> = FLOOD_DATASET_DATE_SET;
const FLOOD_SNAPSHOT_BY_MONTH: Readonly<Record<string, string>> =
  FLOOD_DATASET_BY_MONTH;
/** Gregorian year → the available observation snapshot for that year. */
const FLOOD_SNAPSHOT_BY_YEAR: Readonly<Record<string, string>> =
  FLOOD_DATASET_BY_YEAR;

/**
 * Tool steps mirror the PROGRESSIVE pipeline: resolve → load geometry-free
 * overview → add hex layer → fit. Detailed polygons then stream in the
 * background (not a blocking step). Durations are the nominal fallbacks; the
 * view reports the REAL measured ms per step.
 */
function floodSteps(
  fetchDate: string,
  hasData: boolean,
  queryLabel: string,
  t: TFunction,
): ScenarioStep[] {
  const steps: ScenarioStep[] = [
    {
      label: t("morphism.scenario.flood.stepResolve", {
        query: queryLabel,
        date: fetchDate,
      }),
      wait: 300,
    },
    { label: t("morphism.scenario.flood.stepLoad", { date: fetchDate }), wait: 900 },
  ];
  if (hasData) {
    steps.push(
      { label: t("morphism.scenario.flood.stepAddLayer"), wait: 320 },
      { label: t("morphism.scenario.flood.stepFit"), wait: 300 },
    );
  }
  return steps;
}

function floodEmptyScenario(
  meta: FloodScenarioMeta,
  result: string,
  queryLabel: string,
  t: TFunction,
): Scenario {
  return {
    id: meta.scenarioId,
    mode: "analysis",
    layers: [], // no flood layer toggled — nothing to render
    flood: meta,
    interim: t("morphism.scenario.flood.searching"),
    steps: floodSteps(meta.date, false, queryLabel, t),
    result,
  };
}

/** Build the deterministic flood scenario for a resolved date/month query. */
/** Newest observation date overall (ISO max of the available snapshots). */
function latestSnapshotDate(): string {
  return [...FLOOD_SNAPSHOTS].sort().at(-1)!;
}

/** Newest "YYYY-MM" that has a snapshot for the given month number (1–12). */
function latestMonthKey(monthNum: number): string | undefined {
  const mm = String(monthNum).padStart(2, "0");
  return [...FLOOD_SNAPSHOTS]
    .filter((d) => d.slice(5, 7) === mm)
    .map((d) => d.slice(0, 7))
    .sort()
    .at(-1);
}

/** Snapshots (ISO, ascending) in "YYYY-MM" whose day falls within [lo, hi]. */
function snapshotsInWindow(monthKey: string, lo: number, hi: number): string[] {
  return [...FLOOD_SNAPSHOTS]
    .filter((d) => d.slice(0, 7) === monthKey)
    .filter((d) => {
      const day = Number(d.slice(8, 10));
      return day >= lo && day <= hi;
    })
    .sort();
}

/** i18n key for a month-period modifier ("early"/"mid"/"late"). */
const PERIOD_LABEL_KEY: Record<MonthPeriod, string> = {
  early: "morphism.scenario.flood.periodEarly",
  mid: "morphism.scenario.flood.periodMid",
  late: "morphism.scenario.flood.periodLate",
};

/**
 * "ต้น/กลาง/ปลายเดือน" → TRANSPARENT two-step resolution. The pipeline is:
 *
 *   1. resolve_period          — the natural-language period resolves to its
 *      CALENDAR day window (early = 1–10, mid = 11–20, late = 21–end of
 *      month). Deterministic; independent of the dataset registry.
 *   2. select_latest_available_snapshot — the newest REGISTERED snapshot
 *      whose date lies INSIDE that window. A window with no registered
 *      snapshot is an explicit empty state — never a silent fallback to a
 *      date outside the range.
 *
 * The chat steps, the user-facing result and the map all read the SAME
 * runtime resolution (one range + one selected date — never recomputed).
 */
function scnFloodByPeriod(
  monthKey: string,
  period: MonthPeriod,
  t: TFunction,
  lang: Lang,
): Scenario {
  const [lo, hi] = periodDayRange(period);
  const [periodStart, periodEnd] = periodCalendarRange(monthKey, period);
  const inWindow = snapshotsInWindow(monthKey, lo, hi);

  const periodWord = t(PERIOD_LABEL_KEY[period] as "morphism.scenario.flood.periodMid");
  const monthLabel = formatMonth(monthKey, lang); // "ตุลาคม 2568" / "October 2025"
  // The RESOLVED period range (locale-formatted calendar window) — the one
  // range shown in resolve_period, the selection step AND the result text.
  const rangeLabel = `${formatDate(periodStart, lang)} – ${formatDate(periodEnd, lang)}`;
  const resolveStep: ScenarioStep = {
    label: t("morphism.scenario.flood.stepResolvePeriod", {
      period: periodWord,
      month: monthLabel,
      range: rangeLabel,
    }),
    wait: 300,
  };
  const interim = t("morphism.scenario.flood.searchingPeriod", {
    period: periodWord,
    month: monthLabel,
  });

  // No registered snapshot INSIDE the resolved window → truthful empty state.
  // (Previously this silently fell back to the month's snapshot even when it
  // was outside the queried range.) The selection step is the one that FAILS.
  if (!inWindow.length) {
    const meta: FloodScenarioMeta = {
      scenarioId: `flood-empty-${monthKey}-${period}`,
      date: periodEnd, // never fetched — hasData is false
      matchMode: "month",
      queriedMonth: monthKey,
      dateLabel: rangeLabel,
      hasData: false,
      periodStart,
      periodEnd,
    };
    return {
      id: meta.scenarioId,
      mode: "analysis",
      layers: [], // nothing to render
      flood: meta,
      interim,
      steps: [
        resolveStep,
        {
          label: t("morphism.scenario.flood.stepSelectSnapshotEmpty", {
            range: rangeLabel,
          }),
          wait: 300,
        },
      ],
      result: t("morphism.scenario.flood.emptyPeriod", {
        period: periodWord,
        month: monthLabel,
        range: rangeLabel,
      }),
    };
  }

  // Latest registered snapshot INSIDE the range (selection rule unchanged).
  const date = inWindow.at(-1)!;
  const snapLabel = formatDate(date, lang);

  const meta: FloodScenarioMeta = {
    scenarioId: `flood-${date}`,
    date,
    matchMode: "month",
    queriedMonth: monthKey,
    dateLabel: snapLabel,
    hasData: true,
    periodStart,
    periodEnd,
  };
  return {
    id: meta.scenarioId,
    mode: "analysis",
    layers: ["flood"],
    flood: meta,
    timeActive: true,
    timeLabel: rangeLabel,
    interim,
    steps: [
      resolveStep,
      {
        label: t("morphism.scenario.flood.stepSelectSnapshot", {
          range: rangeLabel,
          date: snapLabel,
        }),
        wait: 300,
      },
      { label: t("morphism.scenario.flood.stepLoad", { date }), wait: 900 },
      { label: t("morphism.scenario.flood.stepAddLayer"), wait: 320 },
      { label: t("morphism.scenario.flood.stepFit"), wait: 300 },
    ],
    result: [
      t("morphism.scenario.flood.foundPeriodLine1", {
        period: periodWord,
        month: monthLabel,
        range: rangeLabel,
      }),
      t("morphism.scenario.flood.periodSnapshot", { date: snapLabel }),
    ].join("\n"),
  };
}

function scnFloodByDate(
  res: FloodDateResolution,
  t: TFunction,
  lang: Lang,
): Scenario {
  // Exact date.
  if (res.matchMode === "exact-date" && res.resolvedDate) {
    const date = res.resolvedDate;
    const label = formatDate(date, lang); // "13 ตุลาคม 2568" / "13 October 2025"
    const hasData = FLOOD_SNAPSHOTS.has(date);
    const meta: FloodScenarioMeta = {
      scenarioId: hasData ? `flood-${date}` : `flood-empty-${date}`,
      date,
      matchMode: "exact-date",
      dateLabel: label,
      hasData,
    };
    if (!hasData) {
      return floodEmptyScenario(
        meta,
        t("morphism.flood.emptyDate", { date: label }),
        label,
        t,
      );
    }
    return {
      id: meta.scenarioId,
      mode: "analysis",
      layers: ["flood"],
      flood: meta,
      timeActive: true,
      timeLabel: label,
      interim: t("morphism.scenario.flood.searchingDate", { date: label }),
      steps: floodSteps(date, true, label, t),
      result: [
        t("morphism.scenario.flood.foundDateLine1", { date: label }),
        t("morphism.scenario.flood.foundDateLine2"),
      ].join("\n"),
    };
  }

  // Year only (e.g. "น้ำท่วมปี 2565") → the year's available snapshot.
  if (res.matchMode === "year" && res.year != null) {
    const yearNum = lang === "th" ? toBuddhistYear(res.year) : res.year;
    const yearLabel = t("morphism.scenario.flood.yearLabel", {
      year: String(yearNum),
    });
    const snapshot = FLOOD_SNAPSHOT_BY_YEAR[String(res.year)];
    if (!snapshot) {
      const meta: FloodScenarioMeta = {
        scenarioId: `flood-empty-${res.year}`,
        date: `${res.year}-01-01`,
        matchMode: "year",
        dateLabel: yearLabel,
        hasData: false,
      };
      return floodEmptyScenario(
        meta,
        t("morphism.scenario.flood.emptyYear", { year: yearLabel }),
        yearLabel,
        t,
      );
    }
    const snapLabel = formatDate(snapshot, lang);
    const meta: FloodScenarioMeta = {
      scenarioId: `flood-${snapshot}`,
      date: snapshot,
      matchMode: "year",
      dateLabel: snapLabel,
      hasData: true,
    };
    return {
      id: meta.scenarioId,
      mode: "analysis",
      layers: ["flood"],
      flood: meta,
      timeActive: true,
      timeLabel: snapLabel,
      interim: t("morphism.scenario.flood.searchingYear", { year: yearLabel }),
      steps: floodSteps(snapshot, true, yearLabel, t),
      result: [
        t("morphism.scenario.flood.foundYearLine1", { year: yearLabel }),
        t("morphism.scenario.flood.snapshotLine", { date: snapLabel }),
      ].join("\n"),
    };
  }

  // Month only.
  const month = res.resolvedMonth!;
  const monthLabel = formatMonth(month, lang); // "ตุลาคม 2568" / "October 2025"
  const snapshot = FLOOD_SNAPSHOT_BY_MONTH[month];
  if (!snapshot) {
    const meta: FloodScenarioMeta = {
      scenarioId: `flood-empty-${month}`,
      date: `${month}-01`,
      matchMode: "month",
      queriedMonth: month,
      dateLabel: monthLabel,
      hasData: false,
    };
    return floodEmptyScenario(
      meta,
      t("morphism.flood.emptyMonth", { month: monthLabel }),
      monthLabel,
      t,
    );
  }
  const snapLabel = formatDate(snapshot, lang);
  const meta: FloodScenarioMeta = {
    scenarioId: `flood-${snapshot}`,
    date: snapshot,
    matchMode: "month",
    queriedMonth: month,
    dateLabel: snapLabel,
    hasData: true,
  };
  return {
    id: meta.scenarioId,
    mode: "analysis",
    layers: ["flood"],
    flood: meta,
    timeActive: true,
    timeLabel: snapLabel,
    interim: t("morphism.scenario.flood.searchingMonth", { month: monthLabel }),
    steps: floodSteps(snapshot, true, monthLabel, t),
    result: [
      t("morphism.scenario.flood.foundMonthLine1", { month: monthLabel }),
      t("morphism.scenario.flood.snapshotLine", { date: snapLabel }),
    ].join("\n"),
  };
}

/* ── FOSS4G Hiroshima — special presentation prompt ────────────────────────
 * The EXACT input "01 September 2026" (case/space-insensitive only) is a demo
 * easter egg, never a data query: it must not resolve a flood date, run a
 * scenario, touch layers/camera/time-filter, or search datasets. It rides the
 * `mode: "unknown"` contract, which the view returns from BEFORE any map
 * state, initial-context or scene-history mutation — so the map is provably
 * left exactly as it was, with no tool-processing steps rendered.
 * ────────────────────────────────────────────────────────────────────────── */

/** Canonical form of the trigger (compared against the normalized query). */
export const FOSS4G_PROMPT = "01 september 2026";

/** True only for the exact special input (ignoring case + outer/inner spacing). */
export function isFoss4gPrompt(raw: string): boolean {
  return raw.trim().toLowerCase().replace(/\s+/g, " ") === FOSS4G_PROMPT;
}

/** Where the FOSS4G prompt flies the camera (deterministic registry entry —
 *  no geocoding round-trip, no coordinates inside components). */
export const FOSS4G_PLACE = PRESENTATION_PLACES.hiroshima;

/** Pill text for the presentation state — the trigger date itself, rendered
 *  in the app's long-date style (never a flood-snapshot label). */
export const FOSS4G_PILL_LABEL = "01 September 2026";

/** Bounds of the real Hiroshima City outline — what the camera fits to. */
export function foss4gBounds(): MapBounds {
  const pts = FOSS4G_PLACE.boundary.flat();
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return {
    sw: [Math.min(...lngs), Math.min(...lats)],
    ne: [Math.max(...lngs), Math.max(...lats)],
    duration: CAMERA.scopeFit,
  };
}

/**
 * Promo reply for the FOSS4G Hiroshima session. Localized intro copy; the
 * event name and the talk title are proper nouns and stay in English in every
 * locale.
 *
 * Carries a CAMERA ONLY: the view flies to Hiroshima (existing `flyTo` helper
 * → shared CAMERA duration token + live reduced-motion handling) and returns
 * before any layer/dataset/time-filter/history mutation, because the scenario
 * stays `mode: "unknown"`. Existing scenes keep their state; nothing is re-run
 * or re-labelled for Hiroshima.
 */
const scnFoss4g = (t: TFunction): Scenario => {
  const message = [
    t("morphism.scenario.foss4g.intro"),
    ``,
    t("morphism.scenario.foss4g.join"),
    t("morphism.scenario.foss4g.title"),
  ].join("\n");
  return {
    id: "foss4g",
    mode: "unknown", // ← no layers, no steps, no history entry, no time filter
    layers: [],
    // Frame the REAL city boundary (fitBounds + padding) instead of a fixed
    // zoom, so the outline sits comfortably in view at any window size. The
    // camera below is only the fallback when bounds can't be applied.
    bounds: foss4gBounds(),
    camera: {
      center: FOSS4G_PLACE.center,
      zoom: FOSS4G_PLACE.zoom,
      duration: CAMERA.scopeFit,
    },
    presentation: {
      placeName: FOSS4G_PLACE.name,
      boundary: FOSS4G_PLACE.boundary,
      pillLabel: FOSS4G_PILL_LABEL,
    },
    interim: message,
    steps: [],
    result: message,
  };
};

/**
 * Unknown / unmatched query — NO map side-effects (the view skips everything for
 * mode "unknown"), no tool steps, just a friendly fallback message.
 */
const scnUnknown = (t: TFunction): Scenario => {
  const message = t("morphism.scenario.unknown");
  return {
    id: "unknown",
    mode: "unknown",
    layers: [],
    interim: message,
    steps: [],
    result: message,
  };
};

/** Detect a region keyword in the query. */
function detectRegion(t: string): string | null {
  if (has(t, "อีสาน", "ตะวันออกเฉียงเหนือ")) return "อีสาน";
  if (has(t, "ภาคเหนือ") || (has(t, "เหนือ") && !has(t, "ตะวันออกเฉียง")))
    return "เหนือ";
  if (has(t, "ภาคใต้") || has(t, "ภาค ใต้") || (has(t, "ใต้") && has(t, "ภาค")))
    return "ใต้";
  if (has(t, "ตะวันออก")) return "ตะวันออก";
  if (has(t, "ตะวันตก")) return "ตะวันตก";
  if (has(t, "ภาคกลาง") || (has(t, "กลาง") && has(t, "ภาค"))) return "กลาง";
  return null;
}


/** Detect a province in the query → canonical name (aliases + English). */
function detectProvince(raw: string): string | null {
  const t = raw.toLowerCase();
  // 1. Full canonical province names (most specific — win over aliases).
  for (const name of Object.keys(PROV_CENTROID)) {
    if (raw.includes(name)) return name;
  }
  // 2. Aliases / nicknames / English spellings.
  for (const [alias, canon] of Object.entries(PROVINCE_ALIASES)) {
    if (t.includes(alias)) return canon;
  }
  return null;
}

/**
 * Deterministic intent resolver — maps a free-text query to a fixed scenario.
 * Every "how many / count" query (and any region/province scope) routes to the
 * boundary-aggregation display mode; specific "show hospitals" queries stay in
 * point mode. Mirrors the reference HTML's query detection (no random output).
 */
export function resolveScenario(
  raw: string,
  t: TFunction,
  lang: Lang,
  /** LIVE per-province hospital counts from the loaded dataset — when present,
   *  every aggregate scenario (province/region/nationwide/compare) reports
   *  these instead of the static reference table. */
  counts?: ProvinceCounts,
): Scenario {
  // SPECIAL demo prompt — checked FIRST so it can never reach the date/flood
  // resolvers. Only the exact "01 September 2026" matches; every other date
  // (e.g. "18 December 2025") falls through to the normal query paths below.
  if (isFoss4gPrompt(raw)) return scnFoss4g(t);

  // Normalise the query (NFKC folds full-width → half-width, then lowercase) so
  // Latin, Thai and Japanese aliases all match — see configs/intent-keywords.ts.
  const q = normalizeQuery(raw);
  const isCompare = has(q, ...COMPARE_TERMS);
  const countIntent = has(q, ...COUNT_TERMS);
  const isNation = has(q, ...NATION_TERMS);

  // Flood swipe-compare → two dated targets (year, month, or exact date).
  if (isCompare && has(q, ...FLOOD_TERMS)) {
    const targets = resolveCompareTargets(raw, t, lang);
    if (targets) return scnFloodCompare(targets[0], targets[1], t);
  }
  // Region/province comparison → chart.
  if (isCompare) return scnCompareRegions(t, lang, counts);

  // Flood during Songkran (specific analysis).
  if (has(q, ...SONGKRAN_TERMS)) return scnSongkran(t);

  // Within N km of flood → buffer analysis (hospitals within 5 km of flood).
  // A distance/spatial-relation term + a flood term is enough (TH · EN · JA).
  if (has(q, ...BUFFER_TERMS) && has(q, ...FLOOD_TERMS)) {
    return scnBuffer5km(t);
  }

  // "Show 24-hour hospitals" (+ optional location) → POINT mode, scoped to the
  // EXTRACTED province (never hardcoded Bangkok). No province = current extent.
  // The EN suggestion chip is literally "Show 24-hour hospitals in Bangkok".
  if (!countIntent && has(q, ...H24_TERMS)) {
    return scnCityHospitals(detectProvince(raw), true, t, lang);
  }

  // Nationwide count → region-grouped aggregation.
  if (isNation || (countIntent && has(q, "ทุกที่", "ทั้งหมด"))) {
    return scnNation(t, lang, counts);
  }

  // Region scope → region aggregation.
  const region = detectRegion(q);
  if (region) return scnRegion(region, t, lang, counts);

  // Province scope (with a count/“จังหวัด” intent) → province aggregation.
  const province = detectProvince(raw);
  if (province && (countIntent || has(q, "จังหวัด"))) {
    return scnProvince(province, t, lang, counts);
  }

  // Any remaining count query with no explicit scope → nationwide.
  if (countIntent) return scnNation(t, lang, counts);

  // Flood + a resolvable date/month → deterministic date-based flood scenario
  // (exact date or month snapshot; unknown dates give an explicit empty state).
  if (has(q, ...FLOOD_TERMS)) {
    const floodDate = resolveFloodDate(raw);

    // "ต้น/กลาง/ปลายเดือน" → a CALENDAR RANGE within the month (mid-October =
    // 11–20). Resolve the target month from an explicit date/month if present,
    // else the newest year that has that month's data. The period scenario is
    // ALWAYS final: a window with no registered snapshot shows a truthful
    // empty state — it never falls back to a snapshot outside the range.
    const period = detectMonthPeriod(raw);
    if (period) {
      let monthKey: string | undefined;
      if (floodDate.matchMode === "month" && floodDate.resolvedMonth) {
        monthKey = floodDate.resolvedMonth;
      } else if (floodDate.matchMode === "exact-date" && floodDate.resolvedDate) {
        monthKey = floodDate.resolvedDate.slice(0, 7);
      } else {
        const m = detectFloodMonth(raw);
        if (m != null) monthKey = latestMonthKey(m);
      }
      if (monthKey) return scnFloodByPeriod(monthKey, period, t, lang);
    }

    if (floodDate.matchMode !== "none")
      return scnFloodByDate(floodDate, t, lang);

    // No explicit year, but a month word (e.g. "น้ำท่วมเดือนตุลาล่าสุด" /
    // "latest October flood") → the most recent snapshot for that month.
    const monthNum = detectFloodMonth(raw);
    const monthKey = monthNum != null ? latestMonthKey(monthNum) : undefined;
    if (monthNum != null && monthKey) {
      return scnFloodByDate(
        {
          matchMode: "month",
          resolvedMonth: monthKey,
          year: Number(monthKey.slice(0, 4)),
          month: monthNum,
        },
        t,
        lang,
      );
    }

    // "latest / most recent flood" with no month or date → newest snapshot.
    if (has(q, ...LATEST_TERMS)) {
      const d = latestSnapshotDate();
      return scnFloodByDate(
        {
          matchMode: "exact-date",
          resolvedDate: d,
          year: Number(d.slice(0, 4)),
          month: Number(d.slice(5, 7)),
          day: Number(d.slice(8, 10)),
        },
        t,
        lang,
      );
    }
  }

  // Generic flood request (no date) → survey extent.
  if (has(q, ...FLOOD_TERMS)) return scnSongkran(t);

  // A hospital query with no more specific match → point view scoped to the
  // extracted province (or the current extent when none is mentioned).
  if (has(q, ...HOSPITAL_TERMS)) {
    return scnCityHospitals(detectProvince(raw), false, t, lang);
  }

  // Nothing recognised (random/gibberish text) → unknown: no map change, a
  // friendly fallback message. Do NOT default to a hospital scenario.
  return scnUnknown(t);
}
