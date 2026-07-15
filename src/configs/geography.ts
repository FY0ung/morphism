// ─────────────────────────────────────────────────────────────────────────────
// GEOGRAPHIC / DATASET CONFIG (Phase 3D) — Thai provinces, regions, centroids,
// display names, aliases and region colour tokens. Pure data: NO intent
// parsing, no scenario logic, no i18n. The intent resolver
// (sections/morphism/const.tsx) CONSUMES this; another deployment replaces
// THIS file (plus configs/flood-datasets.ts) to re-target the app's geography.
//
// PROV_CENTROID counts are the static pre-load fallback only — once the real
// hospital dataset loads, live counts from lib/hospital-stats take over.
// ─────────────────────────────────────────────────────────────────────────────

/* Province aggregation (region/province/nation summary mode).
 * The full centroid + per-province hospital-count table and the region→province
 * grouping are the exact deterministic values from the reference HTML
 * (PROV_CENTROID + REGIONS). [lng, lat, count]. */
export const PROV_CENTROID: Record<string, [number, number, number]> = {
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

export const REGIONS: Record<string, string[]> = {
  เหนือ: ["เชียงใหม่", "เชียงราย", "ลำปาง", "ลำพูน", "แม่ฮ่องสอน", "น่าน", "พะเยา", "แพร่", "อุตรดิตถ์"],
  กลาง: ["กรุงเทพมหานคร", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "สมุทรสาคร", "สมุทรสงคราม", "นครปฐม", "พระนครศรีอยุธยา", "อ่างทอง", "ลพบุรี", "สิงห์บุรี", "ชัยนาท", "สระบุรี", "สุพรรณบุรี", "นครสวรรค์", "อุทัยธานี", "กำแพงเพชร", "สุโขทัย", "พิษณุโลก", "พิจิตร", "เพชรบูรณ์", "ตาก"],
  อีสาน: ["นครราชสีมา", "บุรีรัมย์", "สุรินทร์", "ศรีสะเกษ", "อุบลราชธานี", "ยโสธร", "ชัยภูมิ", "อำนาจเจริญ", "หนองบัวลำภู", "ขอนแก่น", "อุดรธานี", "เลย", "หนองคาย", "มหาสารคาม", "ร้อยเอ็ด", "กาฬสินธุ์", "สกลนคร", "นครพนม", "มุกดาหาร", "บึงกาฬ"],
  ตะวันออก: ["ชลบุรี", "ระยอง", "จันทบุรี", "ตราด", "ฉะเชิงเทรา", "ปราจีนบุรี", "สระแก้ว", "นครนายก"],
  ตะวันตก: ["ราชบุรี", "กาญจนบุรี", "เพชรบุรี", "ประจวบคีรีขันธ์"],
  ใต้: ["นครศรีธรรมราช", "กระบี่", "พังงา", "ภูเก็ต", "สุราษฎร์ธานี", "ระนอง", "ชุมพร", "สงขลา", "สตูล", "ตรัง", "พัทลุง", "ปัตตานี", "ยะลา", "นราธิวาส"],
};

export const REGION_LABEL: Record<string, string> = {
  เหนือ: "ภาคเหนือ", กลาง: "ภาคกลาง", อีสาน: "ภาคอีสาน",
  ตะวันออก: "ภาคตะวันออก", ตะวันตก: "ภาคตะวันตก", ใต้: "ภาคใต้",
};

/* ──────────────────────────────────────────────────────────────────────────
 * ENGLISH DISPLAY LOOKUPS (display-only — the Thai names above remain the
 * canonical object keys / data / query-match keywords used everywhere else).
 * ────────────────────────────────────────────────────────────────────────── */

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

export const REGION_EN_SHORT: Record<string, string> = {
  เหนือ: "North",
  กลาง: "Central",
  อีสาน: "Northeast",
  ตะวันออก: "East",
  ตะวันตก: "West",
  ใต้: "South",
};

export const REGION_EN_LONG: Record<string, string> = {
  เหนือ: "the North",
  กลาง: "the Central region",
  อีสาน: "the Northeast",
  ตะวันออก: "the East",
  ตะวันตก: "the West",
  ใต้: "the South",
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

/**
 * Thai province aliases / nicknames / English → canonical province name.
 * The canonical name is the single source of truth downstream (scope, filter,
 * camera, boundary, aggregation). Longer full names are matched first (below),
 * so short aliases here only fire when the full name is absent.
 */
export const PROVINCE_ALIASES: Record<string, string> = {
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
