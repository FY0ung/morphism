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
  FloodFC,
  BoundaryFC,
} from "@/types";

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
const BKK_H24 = countWhere((r) => r[4] === "กรุงเทพมหานคร" && r[3]);
// Hospitals near the flood polygon / buffer (central Bangkok) — risk set.
const FLOOD_RISK = countWhere(
  (r) => r[4] === "กรุงเทพมหานคร" && r[1] <= 100.55,
);

export const MOCK_FLOOD: FloodFC = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [100.485, 13.700],
            [100.535, 13.694],
            [100.548, 13.732],
            [100.503, 13.748],
            [100.478, 13.722],
            [100.485, 13.700],
          ],
        ],
      },
      properties: { year: 2569, severity: 2, areaKm2: 18.4 },
    },
  ],
};

export const MOCK_BUFFER: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: circleRing([100.5835, 13.7475], 1.8) },
      properties: { radiusKm: 1.8, around: "รพ. กรุงเทพ" },
    },
  ],
};

export const MOCK_BOUNDARIES: BoundaryFC = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [100.44, 13.66],
            [100.62, 13.66],
            [100.62, 13.83],
            [100.44, 13.83],
            [100.44, 13.66],
          ],
        ],
      },
      properties: { name: "กรุงเทพมหานคร", level: "province", code: "10" },
    },
  ],
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

const CATALOG_STEP: ScenarioStep = {
  label: "search_catalog('hospital') → OpenStreetMap",
  wait: 430,
};

/** Bangkok 24-hour hospitals. */
const scnBkk24 = (): Scenario => ({
  id: "bkk24",
  mode: "points",
  layers: ["hospitals"],
  camera: CAM.bkk,
  interim: "กำลังหาโรงพยาบาลที่เปิด 24 ชั่วโมงในกรุงเทพ…",
  steps: [
    { label: "get_view() → กรุงเทพอยู่ในจอ", wait: 380 },
    CATALOG_STEP,
    { label: "add_layer('health_facilities')", wait: 380 },
    { label: "attribute_filter(hours='24/7')", wait: 430 },
  ],
  result: `พบโรงพยาบาล 24 ชั่วโมง ${BKK_H24} แห่ง — แสดงบนแผนที่แล้ว`,
});

/** Flood during the last Songkran period. */
const scnSongkran = (): Scenario => ({
  id: "songkran",
  mode: "analysis",
  layers: ["flood"],
  camera: CAM.songkran,
  timeActive: true,
  timeLabel: "13 – 15 เม.ย. 2568 (สงกรานต์)",
  interim: 'เข้าใจแล้ว — "ช่วงสงกรานต์" คือ 13–15 เมษายน กำลังกรองข้อมูล…',
  steps: [
    { label: "ตีความ 'สงกรานต์' → 13–15 เม.ย. 2568", wait: 430 },
    { label: "set_time_range(2025-04-13 → 04-15)", wait: 380 },
    { label: "toggle_layer('flood_events', visible)", wait: 430 },
  ],
  result:
    "แสดงขอบเขตน้ำท่วมจากข้อมูลสำรวจ — ซูมออกเห็นภาพรวม, ซูมเข้าเห็นขอบเขตจริง",
});

/** Hospitals within 5 km of a flood area (buffer analysis). */
const scnBuffer5km = (): Scenario => ({
  id: "buffer5km",
  mode: "analysis",
  layers: ["flood", "buffer", "hospitals"],
  camera: CAM.buffer,
  timeActive: true,
  timeLabel: "2 – 8 มิ.ย. 2569 (สัปดาห์ที่แล้ว)",
  interim: "งานนี้ต้องวิเคราะห์หลายขั้น — ขอไล่ทีละขั้นนะครับ",
  steps: [
    { label: "set_time_range(สัปดาห์ที่แล้ว)", wait: 360 },
    { label: "query: โหลดขอบเขตน้ำท่วม", wait: 430 },
    { label: "buffer(flood, 5 km) + จุดศูนย์กลาง", wait: 480 },
    { label: "spatial_query(hospitals ∩ buffer)", wait: 520 },
  ],
  result: `พบโรงพยาบาลในรัศมีเสี่ยง ${FLOOD_RISK} แห่ง (จุดสีแดง) — ประโยคเดียว ไม่ต้องใช้เครื่องมือ GIS`,
});

/** Hospitals in a single province — province-summary aggregation. */
const scnProvince = (name: string): Scenario => {
  const p = provinceCount(name)!;
  return {
    id: "province",
    mode: "aggregate",
    layers: [],
    aggregate: [p],
    provinceNames: [name],
    bounds: boundsOf([p], 0.85, 1200),
    interim: `กำลังนับโรงพยาบาลในจังหวัด${name}…`,
    steps: [
      { label: `geocode('${name}') → ศูนย์กลางจังหวัด`, wait: 360 },
      { ...CATALOG_STEP, wait: 420 },
      { label: `aggregate(province='${name}') → นับรวม`, wait: 460 },
    ],
    result: `จังหวัด${name}มีโรงพยาบาลรัฐ ${p.count} แห่ง — ตัวเลขรวมแสดงบนแผนที่`,
  };
};

/** Hospitals across a region — province aggregation + per-province bar chart. */
const scnRegion = (region: string): Scenario => {
  const provinces = regionProvinces(region);
  const total = regionTotal(region);
  const label = REGION_LABEL[region];
  return {
    id: "region",
    mode: "aggregate",
    layers: [],
    aggregate: provinces,
    provinceNames: REGIONS[region] ?? [],
    bounds: boundsOf(provinces),
    interim: `กำลังรวบรวมโรงพยาบาลใน${label} (${provinces.length} จังหวัด)…`,
    steps: [
      { label: `resolve_region('${region}') → ${provinces.length} จังหวัด`, wait: 380 },
      { ...CATALOG_STEP, wait: 420 },
      { label: `group_by(province) ใน${label}`, wait: 480 },
    ],
    result: `${label}มีโรงพยาบาลรัฐรวม ${total.toLocaleString()} แห่ง ใน ${provinces.length} จังหวัด — ตัวเลขรวมแสดงในแต่ละจังหวัดบนแผนที่`,
    chart: {
      kind: "bar",
      title: `จำนวนโรงพยาบาลรัฐต่อจังหวัด — ${label}`,
      rows: [...provinces]
        .sort((a, b) => b.count - a.count)
        .map((p) => ({ label: p.name, value: p.count })),
      exportName: `hospitals-by-province-${region}`,
    },
  };
};

/** Compare regions (North vs Northeast) — donut/bar of counts. */
const scnCompareRegions = (): Scenario => ({
  id: "cmp",
  mode: "points",
  layers: ["boundaries"],
  camera: CAM.compare,
  interim: "กำลังเปรียบเทียบโรงพยาบาลรัฐ: ภาคเหนือ · ภาคอีสาน…",
  steps: [
    { label: "resolve_entities() → 2 กลุ่ม", wait: 360 },
    { ...CATALOG_STEP, wait: 420 },
    { label: "group_by(region) → จัดกลุ่มแยกรายภาค (คงสีประจำภาค)", wait: 460 },
  ],
  result: "เปรียบเทียบจำนวนโรงพยาบาลรัฐรายภาคแล้ว — ดูกราฟด้านล่างครับ",
  chart: {
    kind: "bar",
    title: "เปรียบเทียบจำนวนโรงพยาบาลรัฐ — ภาคเหนือ vs ภาคอีสาน",
    rows: [
      { label: "ภาคอีสาน", value: 938 },
      { label: "ภาคเหนือ", value: 642 },
    ],
    exportName: "region-compare",
  },
});

/** Hospitals nationwide — region-grouped aggregation across all 77 provinces. */
const scnNation = (): Scenario => ({
  id: "nation",
  mode: "aggregate",
  layers: [],
  aggregate: REGION_BADGES,
  provinceNames: Object.keys(PROV_CENTROID),
  bounds: TH_BOUNDS,
  interim: "กำลังรวบรวมโรงพยาบาลรัฐทั่วประเทศ…",
  steps: [
    { label: "resolve_scope() → ทั้งประเทศ (77 จังหวัด)", wait: 360 },
    { label: "search_catalog('hospital') → ข้อมูลสถานพยาบาลรัฐ", wait: 440 },
    { label: "group_by(region) → จัดกลุ่มราย 6 ภาค", wait: 480 },
  ],
  result: `ทั่วประเทศมีโรงพยาบาลรัฐรวม ${GRAND_TOTAL.toLocaleString()} แห่ง ใน 77 จังหวัด — ตัวเลขรวมรายภาคบนแผนที่`,
  chart: {
    kind: "bar",
    title: "จำนวนโรงพยาบาลรัฐรายภาค — ทั่วประเทศ",
    rows: [...REGION_BADGES]
      .sort((a, b) => b.count - a.count)
      .map((r) => ({ label: r.name, value: r.count })),
    exportName: "hospitals-by-region",
  },
});

/** Flood swipe-compare between two years. */
const scnFloodCompare = (yearA: number, yearB: number): Scenario => ({
  id: "floodcmp",
  mode: "analysis",
  layers: ["flood"],
  timeActive: true,
  swipe: { yearA, yearB },
  interim: `กำลังวิเคราะห์การเปลี่ยนแปลงของน้ำท่วม ปี ${yearA} เทียบ ปี ${yearB}…`,
  steps: [
    { label: `resolve_periods() → ปี ${yearA} · ปี ${yearB}`, wait: 360 },
    { label: `load flood_extent(${yearA}) + flood_extent(${yearB})`, wait: 470 },
    { label: "zonal_stats(flood) → พื้นที่/เขตที่ได้รับผลกระทบ", wait: 480 },
  ],
  result:
    "เปิดโหมดเทียบน้ำท่วมซ้าย–ขวาให้แล้วครับ ลากตัวแบ่งเพื่อเทียบสองปี",
});

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

/** Detect a province name in the query (Bangkok aliases included). */
function detectProvince(raw: string): string | null {
  if (raw.includes("กรุงเทพ") || raw.toLowerCase().includes("bangkok"))
    return "กรุงเทพมหานคร";
  for (const name of Object.keys(PROV_CENTROID)) {
    if (raw.includes(name)) return name;
  }
  return null;
}

/**
 * Deterministic intent resolver — maps a free-text query to a fixed scenario.
 * Every "how many / count" query (and any region/province scope) routes to the
 * boundary-aggregation display mode; specific "show hospitals" queries stay in
 * point mode. Mirrors the reference HTML's query detection (no random output).
 */
export function resolveScenario(raw: string): Scenario {
  const t = raw.toLowerCase();
  const isCompare = has(t, "เปรียบเทียบ", "เทียบ", "compare", " vs ", "vs");
  const countIntent = has(
    t,
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
  const isNation = has(t, "ทั่วประเทศ", "ทั้งประเทศ", "ทุกจังหวัด", "nationwide");

  // Flood swipe-compare → needs two years.
  if (isCompare && has(t, "น้ำท่วม", "flood")) {
    const years = (raw.match(/\d{4}/g) ?? []).map(Number);
    if (years.length >= 2) return scnFloodCompare(years[0], years[1]);
  }
  // Region/province comparison → chart.
  if (isCompare) return scnCompareRegions();

  // Flood during Songkran (specific analysis).
  if (has(t, "สงกรานต์", "songkran")) return scnSongkran();

  // Within N km of flood → buffer analysis.
  if (
    has(t, "รัศมี", "buffer", "กม.", "กม", "km", "ภายใน", "within") &&
    has(t, "น้ำท่วม", "flood")
  ) {
    return scnBuffer5km();
  }

  // Specific "show 24-hour hospitals" → POINT mode (not a count query).
  if (!countIntent && has(t, "24 ชั่วโมง", "24 ชม", "เปิด 24", "24/7")) {
    return scnBkk24();
  }

  // Nationwide count → region-grouped aggregation.
  if (isNation || (countIntent && has(t, "ทุกที่", "ทั้งหมด"))) {
    return scnNation();
  }

  // Region scope → region aggregation.
  const region = detectRegion(t);
  if (region) return scnRegion(region);

  // Province scope (with a count/“จังหวัด” intent) → province aggregation.
  const province = detectProvince(raw);
  if (province && (countIntent || has(t, "จังหวัด"))) {
    return scnProvince(province);
  }

  // Any remaining count query with no explicit scope → nationwide.
  if (countIntent) return scnNation();

  // Generic flood request.
  if (has(t, "น้ำท่วม", "flood")) return scnSongkran();

  // Default → Bangkok 24-hour hospitals (point mode).
  return scnBkk24();
}
