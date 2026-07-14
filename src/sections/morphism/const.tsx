// Static, presentational data + the (mock) intent matcher for the Morphism
// feature. No business logic lives in the views.
import type {
  LayerId,
  Scenario,
  MapCamera,
  MapBounds,
  ProvinceCount,
  ScenarioStep,
  Position,
  FeatureCollection,
  HospitalFC,
  ChartData,
} from "@/types";
import type { FloodScenarioMeta } from "@/types";
import { FLOOD_COMPARE_SIDES } from "@/configs/flood-compare";
import { FLOOD_LATEST_DATA_YEAR, floodYearKey } from "@/configs/flood-data";
import {
  resolveFloodDate,
  detectFloodMonth,
  detectMonthPeriod,
  periodDayRange,
  formatDate,
  formatMonth,
  toBuddhistYear,
  type FloodDateResolution,
  type MonthPeriod,
} from "@/lib/flood-date";
import type { TFunction } from "@/languages/types";

/** Active UI language for scenario display. */
export type Lang = "en" | "th";

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
    swatchClass: "bg-background-primary-default",
    round: true,
  },
  {
    id: "flood",
    labelKey: "morphism.layer.flood",
    swatchClass: "bg-background-info-default",
    round: false,
  },
  {
    id: "buffer",
    labelKey: "morphism.layer.buffer",
    swatchClass: "bg-background-success-default",
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

/** Approximate a circle as a polygon ring (used for the buffer-radius layer). */
function circleRing(center: Position, radiusKm: number, steps = 48): Position[][] {
  const [lng, lat] = center;
  const degPerKm = 1 / 110.574; // ~km per degree latitude
  const ring: Position[] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const dLat = radiusKm * degPerKm * Math.sin(theta);
    const dLng =
      (radiusKm * degPerKm * Math.cos(theta)) /
      Math.cos((lat * Math.PI) / 180);
    ring.push([lng + dLng, lat + dLat]);
  }
  return [ring];
}

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

/** Deterministic counts derived from the mock (so chat text matches the dots). */
const countWhere = (pred: (r: HospitalRow) => boolean) =>
  HOSPITAL_ROWS.filter(pred).length;
// Hospitals near the flood polygon / buffer (central Bangkok) — risk set.
const FLOOD_RISK = countWhere(
  (r) => r[4] === "กรุงเทพมหานคร" && r[1] <= 100.55,
);

/* Flood analysis — TWO 5 km buffers around the exact BUFFER_CENTERS_RAW
 * centres (ported from the HTML reference). Hospitals are filtered (in the
 * view) to within 5 km of EITHER centre so only "at-risk" ones are shown.
 * NOTE: the flood layer itself has NO mock geometry — it renders only the real
 * processed data flow (PMTiles / CDN assets / the /api/flood proxy). */
export const FLOOD_ANALYSIS_CENTERS: Position[] = [
  [100.481, 13.784],
  [100.486, 13.745],
];
export const FLOOD_ANALYSIS_RADIUS_KM = 5;

/** One 5 km analysis buffer (green dashed circle) per centre. */
export const MOCK_BUFFER: FeatureCollection = {
  type: "FeatureCollection",
  features: FLOOD_ANALYSIS_CENTERS.map((c) => ({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: circleRing(c, FLOOD_ANALYSIS_RADIUS_KM) },
    properties: { radiusKm: FLOOD_ANALYSIS_RADIUS_KM },
  })),
};

/** Buffer centre markers — one point per centre. */
export const MOCK_BUFFER_CENTERS: FeatureCollection = {
  type: "FeatureCollection",
  features: FLOOD_ANALYSIS_CENTERS.map((c) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: c },
    properties: { label: "ศูนย์กลางรัศมี" },
  })),
};

/* ──────────────────────────────────────────────────────────────────────────
 * DETERMINISTIC SCENARIO CONTROLLER
 * Ported 1:1 from the HTML reference's SCENARIOS engine — exact camera values
 * (flyTo center/zoom/duration), tool-step labels + waits, interim/result copy.
 * Counts are derived from the mock data above so the text matches the dots.
 * ────────────────────────────────────────────────────────────────────────── */

const has = (t: string, ...needles: string[]) =>
  needles.some((n) => t.includes(n));

/* Province aggregation (region/province/nation summary mode).
 * The full centroid + per-province hospital-count table and the region→province
 * grouping are the exact deterministic values from the reference HTML
 * (PROV_CENTROID + REGIONS). [lng, lat, count]. */
const PROV_CENTROID: Record<string, [number, number, number]> = {
  อุตรดิตถ์: [100.3376, 17.6549, 97], กรุงเทพมหานคร: [100.552, 13.7491, 88],
  ลพบุรี: [100.8023, 15.0384, 143], อุดรธานี: [102.8711, 17.3938, 231],
  ขอนแก่น: [102.5969, 16.3781, 276], ปทุมธานี: [100.6355, 14.0514, 83],
  ชลบุรี: [101.1436, 13.2429, 128], สงขลา: [100.5513, 7.0193, 193],
  ปัตตานี: [101.3707, 6.749, 138], เชียงใหม่: [98.8964, 18.8507, 286],
  ตรัง: [99.5923, 7.5407, 133], นครปฐม: [100.1116, 13.8769, 145],
  แม่ฮ่องสอน: [98.1072, 18.8706, 89], นครสวรรค์: [100.1846, 15.6766, 203],
  สมุทรปราการ: [100.6776, 13.6102, 82], นครราชสีมา: [102.189, 15.0548, 372],
  นครพนม: [104.4795, 17.3461, 159], อุบลราชธานี: [105.0158, 15.2636, 344],
  สุราษฎร์ธานี: [99.2761, 9.0467, 184], เลย: [101.6652, 17.4391, 139],
  นนทบุรี: [100.4224, 13.8958, 83], สระแก้ว: [102.3495, 13.7626, 116],
  เพชรบุรี: [99.8679, 13.0296, 124], ระยอง: [101.3918, 12.8112, 102],
  สุรินทร์: [103.6706, 14.9404, 222], ฉะเชิงเทรา: [101.2304, 13.6607, 120],
  ลำปาง: [99.4882, 18.294, 152], นครศรีธรรมราช: [99.8463, 8.3392, 263],
  ปราจีนบุรี: [101.5746, 14.0079, 97], ตาก: [98.8363, 16.8758, 121],
  อำนาจเจริญ: [104.7214, 15.86, 83], จันทบุรี: [102.1178, 12.7704, 113],
  ตราด: [102.526, 12.2391, 75], เพชรบูรณ์: [101.1211, 16.3107, 159],
  พระนครศรีอยุธยา: [100.5327, 14.3713, 209], มุกดาหาร: [104.5778, 16.528, 83],
  เชียงราย: [99.9393, 19.9132, 228], กำแพงเพชร: [99.6132, 16.3718, 135],
  ชัยนาท: [100.0782, 15.1411, 79], พิษณุโลก: [100.4037, 16.8949, 153],
  พัทลุง: [100.0797, 7.5135, 135], ร้อยเอ็ด: [103.8173, 15.9431, 245],
  ศรีสะเกษ: [104.337, 14.915, 274], กาฬสินธุ์: [103.6286, 16.5853, 171],
  บุรีรัมย์: [102.9758, 14.8642, 244], พะเยา: [100.1275, 19.2988, 101],
  สกลนคร: [103.8431, 17.3773, 186], น่าน: [100.7995, 18.8825, 132],
  สุโขทัย: [99.7828, 17.1843, 125], หนองคาย: [102.8049, 17.9262, 82],
  ราชบุรี: [99.7599, 13.6002, 168], สตูล: [99.9223, 6.83, 60],
  พิจิตร: [100.3556, 16.2716, 119], มหาสารคาม: [103.1848, 15.9884, 186],
  ชัยภูมิ: [101.9132, 15.9627, 180], แพร่: [100.0681, 18.1522, 126],
  ยะลา: [101.2418, 6.3428, 87], กระบี่: [98.9773, 8.1268, 77],
  บึงกาฬ: [103.6779, 18.1601, 69], หนองบัวลำภู: [102.3108, 17.1791, 88],
  ระนอง: [98.6643, 9.9645, 51], สระบุรี: [100.918, 14.579, 138],
  ยโสธร: [104.3217, 15.8464, 119], สุพรรณบุรี: [99.9903, 14.5551, 181],
  ภูเก็ต: [98.3539, 7.9517, 24], พังงา: [98.4302, 8.5864, 68],
  กาญจนบุรี: [99.3561, 14.297, 153], นครนายก: [101.1385, 14.1825, 56],
  อุทัยธานี: [99.7513, 15.3713, 97], ลำพูน: [98.939, 18.3313, 79],
  ประจวบคีรีขันธ์: [99.6855, 11.8229, 90], นราธิวาส: [101.7525, 6.223, 121],
  สมุทรสงคราม: [99.9603, 13.4286, 51], อ่างทอง: [100.388, 14.6033, 87],
  ชุมพร: [99.1203, 10.3336, 103], สิงห์บุรี: [100.3612, 14.9064, 50],
  สมุทรสาคร: [100.2118, 13.5864, 56],
};

const REGIONS: Record<string, string[]> = {
  เหนือ: ["เชียงใหม่", "เชียงราย", "ลำปาง", "ลำพูน", "แม่ฮ่องสอน", "น่าน", "พะเยา", "แพร่", "อุตรดิตถ์"],
  กลาง: ["กรุงเทพมหานคร", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "สมุทรสาคร", "สมุทรสงคราม", "นครปฐม", "พระนครศรีอยุธยา", "อ่างทอง", "ลพบุรี", "สิงห์บุรี", "ชัยนาท", "สระบุรี", "สุพรรณบุรี", "นครสวรรค์", "อุทัยธานี", "กำแพงเพชร", "สุโขทัย", "พิษณุโลก", "พิจิตร", "เพชรบูรณ์", "ตาก"],
  อีสาน: ["นครราชสีมา", "บุรีรัมย์", "สุรินทร์", "ศรีสะเกษ", "อุบลราชธานี", "ยโสธร", "ชัยภูมิ", "อำนาจเจริญ", "หนองบัวลำภู", "ขอนแก่น", "อุดรธานี", "เลย", "หนองคาย", "มหาสารคาม", "ร้อยเอ็ด", "กาฬสินธุ์", "สกลนคร", "นครพนม", "มุกดาหาร", "บึงกาฬ"],
  ตะวันออก: ["ชลบุรี", "ระยอง", "จันทบุรี", "ตราด", "ฉะเชิงเทรา", "ปราจีนบุรี", "สระแก้ว", "นครนายก"],
  ตะวันตก: ["ราชบุรี", "กาญจนบุรี", "เพชรบุรี", "ประจวบคีรีขันธ์"],
  ใต้: ["นครศรีธรรมราช", "กระบี่", "พังงา", "ภูเก็ต", "สุราษฎร์ธานี", "ระนอง", "ชุมพร", "สงขลา", "สตูล", "ตรัง", "พัทลุง", "ปัตตานี", "ยะลา", "นราธิวาส"],
};

const REGION_LABEL: Record<string, string> = {
  เหนือ: "ภาคเหนือ", กลาง: "ภาคกลาง", อีสาน: "ภาคอีสาน",
  ตะวันออก: "ภาคตะวันออก", ตะวันตก: "ภาคตะวันตก", ใต้: "ภาคใต้",
};

/* ──────────────────────────────────────────────────────────────────────────
 * ENGLISH DISPLAY LOOKUPS (display-only — the Thai names above remain the
 * canonical object keys / data / query-match keywords used everywhere else).
 * ────────────────────────────────────────────────────────────────────────── */

/** Thai province name → standard English (RTGS) display name. */
export const PROVINCE_EN: Record<string, string> = {
  กรุงเทพมหานคร: "Bangkok",
  อุตรดิตถ์: "Uttaradit",
  ลพบุรี: "Lopburi",
  อุดรธานี: "Udon Thani",
  ขอนแก่น: "Khon Kaen",
  ปทุมธานี: "Pathum Thani",
  ชลบุรี: "Chonburi",
  สงขลา: "Songkhla",
  ปัตตานี: "Pattani",
  เชียงใหม่: "Chiang Mai",
  ตรัง: "Trang",
  นครปฐม: "Nakhon Pathom",
  แม่ฮ่องสอน: "Mae Hong Son",
  นครสวรรค์: "Nakhon Sawan",
  สมุทรปราการ: "Samut Prakan",
  นครราชสีมา: "Nakhon Ratchasima",
  นครพนม: "Nakhon Phanom",
  อุบลราชธานี: "Ubon Ratchathani",
  สุราษฎร์ธานี: "Surat Thani",
  เลย: "Loei",
  นนทบุรี: "Nonthaburi",
  สระแก้ว: "Sa Kaeo",
  เพชรบุรี: "Phetchaburi",
  ระยอง: "Rayong",
  สุรินทร์: "Surin",
  ฉะเชิงเทรา: "Chachoengsao",
  ลำปาง: "Lampang",
  นครศรีธรรมราช: "Nakhon Si Thammarat",
  ปราจีนบุรี: "Prachinburi",
  ตาก: "Tak",
  อำนาจเจริญ: "Amnat Charoen",
  จันทบุรี: "Chanthaburi",
  ตราด: "Trat",
  เพชรบูรณ์: "Phetchabun",
  พระนครศรีอยุธยา: "Phra Nakhon Si Ayutthaya",
  มุกดาหาร: "Mukdahan",
  เชียงราย: "Chiang Rai",
  กำแพงเพชร: "Kamphaeng Phet",
  ชัยนาท: "Chai Nat",
  พิษณุโลก: "Phitsanulok",
  พัทลุง: "Phatthalung",
  ร้อยเอ็ด: "Roi Et",
  ศรีสะเกษ: "Sisaket",
  กาฬสินธุ์: "Kalasin",
  บุรีรัมย์: "Buriram",
  พะเยา: "Phayao",
  สกลนคร: "Sakon Nakhon",
  น่าน: "Nan",
  สุโขทัย: "Sukhothai",
  หนองคาย: "Nong Khai",
  ราชบุรี: "Ratchaburi",
  สตูล: "Satun",
  พิจิตร: "Phichit",
  มหาสารคาม: "Maha Sarakham",
  ชัยภูมิ: "Chaiyaphum",
  แพร่: "Phrae",
  ยะลา: "Yala",
  กระบี่: "Krabi",
  บึงกาฬ: "Bueng Kan",
  หนองบัวลำภู: "Nong Bua Lamphu",
  ระนอง: "Ranong",
  สระบุรี: "Saraburi",
  ยโสธร: "Yasothon",
  สุพรรณบุรี: "Suphan Buri",
  ภูเก็ต: "Phuket",
  พังงา: "Phang Nga",
  กาญจนบุรี: "Kanchanaburi",
  นครนายก: "Nakhon Nayok",
  อุทัยธานี: "Uthai Thani",
  ลำพูน: "Lamphun",
  ประจวบคีรีขันธ์: "Prachuap Khiri Khan",
  นราธิวาส: "Narathiwat",
  สมุทรสงคราม: "Samut Songkhram",
  อ่างทอง: "Ang Thong",
  ชุมพร: "Chumphon",
  สิงห์บุรี: "Sing Buri",
  สมุทรสาคร: "Samut Sakhon",
};

/** Region key → short English name (for chart/legend/compare labels). */
export const REGION_EN_SHORT: Record<string, string> = {
  เหนือ: "North",
  กลาง: "Central",
  อีสาน: "Northeast",
  ตะวันออก: "East",
  ตะวันตก: "West",
  ใต้: "South",
};

/** Region key → full English name used in sentences (mirrors "ภาคเหนือ"). */
export const REGION_EN_LONG: Record<string, string> = {
  เหนือ: "the North",
  กลาง: "the Central region",
  อีสาน: "the Northeast",
  ตะวันออก: "the East",
  ตะวันตก: "the West",
  ใต้: "the South",
};

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

/**
 * Region → CLOSEST EXISTING design-token colour var (no new tokens added).
 * The HTML uses bespoke region colours; until real tokens exist we map each
 * region to the nearest semantic background token. Resolved to a real colour
 * at runtime via readCssColor.
 */
export const REGION_TOKEN_VAR: Record<string, string> = {
  กลาง: "--color-background-primary-default", // pigeon → primary
  เหนือ: "--color-background-success-default", // tower/teal → success
  อีสาน: "--color-background-secondary-default", // lilac → secondary
  ใต้: "--color-background-error-default", // illusion/rose → error
  ตะวันออก: "--color-background-info-default", // blue → info
  ตะวันตก: "--color-background-warning-default", // green → warning
};
/** Default token when a province's region is unknown. */
export const REGION_DEFAULT_TOKEN = "--color-border-primary-default";

// Region → Tailwind utility classes for the SAME tokens as REGION_TOKEN_VAR
// (literal strings so Tailwind emits them). Used by the donut swatch + legend so
// map, chart and legend colours stay identical. เหนือ = tower/teal (success),
// อีสาน = lilac/purple (secondary).
export const REGION_FILL: Record<string, string> = {
  กลาง: "fill-background-primary-default",
  เหนือ: "fill-background-success-default",
  อีสาน: "fill-background-secondary-default",
  ใต้: "fill-background-error-default",
  ตะวันออก: "fill-background-info-default",
  ตะวันตก: "fill-background-warning-default",
};
export const REGION_BG: Record<string, string> = {
  กลาง: "bg-background-primary-default",
  เหนือ: "bg-background-success-default",
  อีสาน: "bg-background-secondary-default",
  ใต้: "bg-background-error-default",
  ตะวันออก: "bg-background-info-default",
  ตะวันตก: "bg-background-warning-default",
};

/** Which region a province belongs to (null if not found). */
export function provinceRegion(name: string): string | null {
  for (const region of Object.keys(REGIONS)) {
    if ((REGIONS[region] ?? []).includes(name)) return region;
  }
  return null;
}

/** Thailand bounds (HTML TH_BOUNDS) for the nationwide camera. */
const TH_BOUNDS: MapBounds = { sw: [97.34, 5.61], ne: [105.64, 20.46], duration: 1200 };

function provinceCount(name: string): ProvinceCount | null {
  const c = PROV_CENTROID[name];
  return c ? { name, center: [c[0], c[1]], count: c[2] } : null;
}
function regionProvinces(region: string): ProvinceCount[] {
  return (REGIONS[region] ?? [])
    .map(provinceCount)
    .filter((p): p is ProvinceCount => p !== null);
}
function regionTotal(region: string): number {
  return regionProvinces(region).reduce((s, p) => s + p.count, 0);
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
const REGION_BADGES: ProvinceCount[] = Object.keys(REGIONS).map((region) => {
  const ps = regionProvinces(region);
  const cx = ps.reduce((s, p) => s + p.center[0], 0) / ps.length;
  const cy = ps.reduce((s, p) => s + p.center[1], 0) / ps.length;
  return { name: REGION_LABEL[region], center: [cx, cy], count: regionTotal(region) };
});
const GRAND_TOTAL = Object.values(PROV_CENTROID).reduce((s, c) => s + c[2], 0);

// Camera presets — exact values from the reference HTML.
const CAM = {
  bkk: { center: [100.528, 13.742], zoom: 11.8, duration: 1100 },
  songkran: { center: [100.484, 13.768], zoom: 12.1, duration: 1100 },
  buffer: { center: [100.498, 13.756], zoom: 11.6, duration: 1100 },
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

/** Hospitals within 5 km of a flood area (buffer analysis). */
const scnBuffer5km = (t: TFunction): Scenario => ({
  id: "buffer5km",
  mode: "analysis",
  layers: ["flood", "buffer", "hospitals"],
  camera: CAM.buffer,
  timeActive: true,
  timeLabel: t("morphism.scenario.buffer.timeLabel"),
  interim: t("morphism.scenario.buffer.interim"),
  steps: [
    { label: t("morphism.scenario.buffer.step1"), wait: 360 },
    { label: t("morphism.scenario.buffer.step2"), wait: 430 },
    { label: t("morphism.scenario.buffer.step3"), wait: 480 },
    { label: t("morphism.scenario.buffer.step4"), wait: 520 },
  ],
  result: t("morphism.scenario.buffer.result", {
    count: String(FLOOD_RISK),
  }),
});

/** Hospitals in a single province — province-summary aggregation. */
const scnProvince = (name: string, t: TFunction, lang: Lang): Scenario => {
  const p = provinceCount(name)!;
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
const scnRegion = (region: string, t: TFunction, lang: Lang): Scenario => {
  const provinces = regionProvinces(region);
  const total = regionTotal(region);
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
const scnCompareRegions = (t: TFunction, lang: Lang): Scenario => {
  const provinceNames = COMPARE_REGIONS.flatMap((rg) => REGIONS[rg] ?? []);
  const provincePts = provinceNames
    .map(provinceCount)
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
      count: regionTotal(rg),
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
          value: regionTotal(rg),
          swatch: REGION_FILL[rg],
        })),
        exportName: "region-compare",
      },
    ],
  };
};

/** Hospitals nationwide — region-grouped aggregation across all 77 provinces. */
const scnNation = (t: TFunction, lang: Lang): Scenario => {
  // Region-keyed rows so chart labels can be localized (REGION_BADGES.name is a
  // display-only Thai label used for the map aggregate).
  const regionRows = Object.keys(REGIONS).map((rg) => ({
    label: regionLabelShort(rg, lang),
    value: regionTotal(rg),
  }));
  return {
    id: "nation",
    mode: "aggregate",
    layers: [],
    aggregate: REGION_BADGES,
    provinceNames: Object.keys(PROV_CENTROID),
    bounds: TH_BOUNDS,
    interim: t("morphism.scenario.nation.interim"),
    steps: [
      { label: t("morphism.scenario.nation.step1"), wait: 360 },
      { label: t("morphism.scenario.nation.step2"), wait: 440 },
      { label: t("morphism.scenario.nation.step3"), wait: 480 },
    ],
    result: t("morphism.scenario.nation.result", {
      count: GRAND_TOTAL.toLocaleString(),
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
  const parts = raw.split(/\s*(?:\bvs\b|เทียบกับ|เทียบ|กับ)\s*/i);
  if (parts.length >= 2) {
    const a = compareTargetFor(parts[0], t, lang);
    const b = compareTargetFor(parts[parts.length - 1], t, lang);
    if (a && b) return [a, b];
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

  const charts: ChartData[] = [
    {
      kind: "donut",
      title: t("morphism.scenario.floodCompare.chartAreaTitle", {
        yearLabelA: labelA,
        yearLabelB: labelB,
      }),
      centerLabel: t("morphism.scenario.floodCompare.chartAreaCenter"),
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
// Registered flood observation snapshots (each is an INDEPENDENT dataset; the
// server route maps the date → its own Vallaris collection). Add a new date +
// its month/year aliases here and drop its fixture in src/data/flood/<date>.json.
const FLOOD_SNAPSHOTS = new Set<string>([
  "2025-10-19",
  "2025-10-17",
  "2025-10-16",
  "2025-10-15",
  "2025-10-14",
  "2025-10-13",
  "2024-10-12",
  "2024-10-10",
  "2024-10-07",
  "2024-10-05",
  "2024-10-02",
  "2023-10-20",
  "2023-10-18",
  "2023-10-12",
  "2023-10-11",
  "2023-10-10",
  "2022-10-20",
  "2022-10-18",
  "2022-10-15",
  "2022-10-14",
  "2022-10-13",
]);
const FLOOD_SNAPSHOT_BY_MONTH: Record<string, string> = {
  "2025-10": "2025-10-19", // latest snapshot in the month
  "2024-10": "2024-10-12",
  "2023-10": "2023-10-20",
  "2022-10": "2022-10-20",
};
/** Gregorian year → the available observation snapshot for that year. */
const FLOOD_SNAPSHOT_BY_YEAR: Record<string, string> = {
  "2025": "2025-10-19", // latest snapshot in the year
  "2024": "2024-10-12",
  "2023": "2023-10-20",
  "2022": "2022-10-20",
};

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
 * "ต้น/กลาง/ปลายเดือน" → a DATE RANGE. Finds every snapshot inside the period's
 * day window for `monthKey`, displays the newest one, and reports the span
 * (from…to) to the user. Returns null when the window has no data (caller then
 * falls back to plain month handling).
 */
function scnFloodByPeriod(
  monthKey: string,
  period: MonthPeriod,
  t: TFunction,
  lang: Lang,
): Scenario | null {
  const [lo, hi] = periodDayRange(period);
  const inWindow = snapshotsInWindow(monthKey, lo, hi);
  if (!inWindow.length) return null;

  const from = inWindow[0];
  const to = inWindow.at(-1)!;
  const date = to; // display the newest snapshot within the window
  const periodWord = t(PERIOD_LABEL_KEY[period] as "morphism.scenario.flood.periodMid");
  const monthLabel = formatMonth(monthKey, lang); // "ตุลาคม 2568" / "October 2025"
  const rangeLabel =
    from === to
      ? formatDate(to, lang)
      : `${formatDate(from, lang)} – ${formatDate(to, lang)}`;
  const snapLabel = formatDate(date, lang);

  const meta: FloodScenarioMeta = {
    scenarioId: `flood-${date}`,
    date,
    matchMode: "month",
    queriedMonth: monthKey,
    dateLabel: snapLabel,
    hasData: true,
  };
  return {
    id: meta.scenarioId,
    mode: "analysis",
    layers: ["flood"],
    flood: meta,
    timeActive: true,
    timeLabel: rangeLabel,
    interim: t("morphism.scenario.flood.searchingPeriod", {
      period: periodWord,
      month: monthLabel,
    }),
    steps: floodSteps(date, true, `${periodWord}${monthLabel}`, t),
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

/**
 * Thai province aliases / nicknames / English → canonical province name.
 * The canonical name is the single source of truth downstream (scope, filter,
 * camera, boundary, aggregation). Longer full names are matched first (below),
 * so short aliases here only fire when the full name is absent.
 */
const PROVINCE_ALIASES: Record<string, string> = {
  // Bangkok
  กทม: "กรุงเทพมหานคร",
  กรุงเทพ: "กรุงเทพมหานคร",
  bangkok: "กรุงเทพมหานคร",
  bkk: "กรุงเทพมหานคร",
  // Ayutthaya
  อยุธยา: "พระนครศรีอยุธยา",
  ayutthaya: "พระนครศรีอยุธยา",
  "phra nakhon si ayutthaya": "พระนครศรีอยุธยา",
  // Nakhon Ratchasima
  โคราช: "นครราชสีมา",
  korat: "นครราชสีมา",
  // Nakhon Si Thammarat
  เมืองคอน: "นครศรีธรรมราช",
  // Surat Thani
  สุราษฎร์: "สุราษฎร์ธานี",
  surat: "สุราษฎร์ธานี",
  // Ubon Ratchathani
  อุบล: "อุบลราชธานี",
  ubon: "อุบลราชธานี",
  // Udon Thani
  อุดร: "อุดรธานี",
  udon: "อุดรธานี",
  // Common English spellings
  "chiang mai": "เชียงใหม่",
  chiangmai: "เชียงใหม่",
  "chiang rai": "เชียงราย",
  chiangrai: "เชียงราย",
  phuket: "ภูเก็ต",
};

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
): Scenario {
  const q = raw.toLowerCase();
  const isCompare = has(q, "เปรียบเทียบ", "เทียบ", "compare", " vs ", "vs");
  const countIntent = has(
    q,
    "กี่แห่ง",
    "มีกี่",
    "จำนวน",
    "ทั้งหมด",
    "รวมกี่",
    "รวมทั้ง",
    "เท่าไหร่",
    "เท่าไร",
    "นับ",
    "how many",
    "total",
  );
  const isNation = has(q, "ทั่วประเทศ", "ทั้งประเทศ", "ทุกจังหวัด", "nationwide");

  // Flood swipe-compare → two dated targets (year, month, or exact date).
  if (isCompare && has(q, "น้ำท่วม", "flood")) {
    const targets = resolveCompareTargets(raw, t, lang);
    if (targets) return scnFloodCompare(targets[0], targets[1], t);
  }
  // Region/province comparison → chart.
  if (isCompare) return scnCompareRegions(t, lang);

  // Flood during Songkran (specific analysis).
  if (has(q, "สงกรานต์", "songkran")) return scnSongkran(t);

  // Within N km of flood → buffer analysis.
  if (
    has(q, "รัศมี", "buffer", "กม.", "กม", "km", "ภายใน", "within") &&
    has(q, "น้ำท่วม", "flood")
  ) {
    return scnBuffer5km(t);
  }

  // "Show 24-hour hospitals" (+ optional location) → POINT mode, scoped to the
  // EXTRACTED province (never hardcoded Bangkok). No province = current extent.
  if (!countIntent && has(q, "24 ชั่วโมง", "24 ชม", "เปิด 24", "24/7")) {
    return scnCityHospitals(detectProvince(raw), true, t, lang);
  }

  // Nationwide count → region-grouped aggregation.
  if (isNation || (countIntent && has(q, "ทุกที่", "ทั้งหมด"))) {
    return scnNation(t, lang);
  }

  // Region scope → region aggregation.
  const region = detectRegion(q);
  if (region) return scnRegion(region, t, lang);

  // Province scope (with a count/“จังหวัด” intent) → province aggregation.
  const province = detectProvince(raw);
  if (province && (countIntent || has(q, "จังหวัด"))) {
    return scnProvince(province, t, lang);
  }

  // Any remaining count query with no explicit scope → nationwide.
  if (countIntent) return scnNation(t, lang);

  // Flood + a resolvable date/month → deterministic date-based flood scenario
  // (exact date or month snapshot; unknown dates give an explicit empty state).
  if (has(q, "น้ำท่วม", "flood")) {
    const floodDate = resolveFloodDate(raw);

    // "ต้น/กลาง/ปลายเดือน" → a DATE RANGE within the month (e.g. mid-October =
    // 11–20). Resolve the target month from an explicit date/month if present,
    // else the newest year that has that month's data, then show the range.
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
      if (monthKey) {
        const periodScn = scnFloodByPeriod(monthKey, period, t, lang);
        if (periodScn) return periodScn;
      }
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
    if (has(q, "ล่าสุด", "ล่าสุ", "latest", "recent", "newest", "most recent")) {
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
  if (has(q, "น้ำท่วม", "flood")) return scnSongkran(t);

  // A hospital query with no more specific match → point view scoped to the
  // extracted province (or the current extent when none is mentioned).
  if (has(q, "โรงพยาบาล", "รพ", "hospital", "ใกล้ฉัน", "near me")) {
    return scnCityHospitals(detectProvince(raw), false, t, lang);
  }

  // Nothing recognised (random/gibberish text) → unknown: no map change, a
  // friendly fallback message. Do NOT default to a hospital scenario.
  return scnUnknown(t);
}
