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
  // CATEGORICAL region roles (globals.css). Default mode aliases the exact
  // original tokens (primary/success/secondary/error/info/warning), so default
  // rendering is unchanged; the colour-vision palettes override each role with
  // its 6-class categorical sample. Mapping is fixed by REGION IDENTITY —
  // never reordered by count/value.
  กลาง: "--color-data-region-central", // default → primary (pigeon)
  เหนือ: "--color-data-region-north", // default → success (tower/teal)
  อีสาน: "--color-data-region-northeast", // default → secondary (lilac)
  ใต้: "--color-data-region-south", // default → error (illusion/rose)
  ตะวันออก: "--color-data-region-east", // default → info (blue)
  ตะวันตก: "--color-data-region-west", // default → warning (green)
};

/** Default token when a province's region is unknown. */
export const REGION_DEFAULT_TOKEN = "--color-border-primary-default";

// Region → Tailwind utility classes for the SAME tokens as REGION_TOKEN_VAR
// (literal strings so Tailwind emits them). Used by the donut swatch + legend so
// map, chart and legend colours stay identical. เหนือ = tower/teal (success),
// อีสาน = lilac/purple (secondary).
export const REGION_FILL: Record<string, string> = {
  กลาง: "fill-data-region-central",
  เหนือ: "fill-data-region-north",
  อีสาน: "fill-data-region-northeast",
  ใต้: "fill-data-region-south",
  ตะวันออก: "fill-data-region-east",
  ตะวันตก: "fill-data-region-west",
};

export const REGION_BG: Record<string, string> = {
  กลาง: "bg-data-region-central",
  เหนือ: "bg-data-region-north",
  อีสาน: "bg-data-region-northeast",
  ใต้: "bg-data-region-south",
  ตะวันออก: "bg-data-region-east",
  ตะวันตก: "bg-data-region-west",
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

/* ── Presentation destinations ─────────────────────────────────────────────
 * Named places OUTSIDE the Thai dataset that demo/presentation prompts fly to.
 * Deterministic registry (no geocoding round-trip, no coordinates scattered in
 * components): a prompt resolves a KEY here and the scenario builds its camera
 * from the entry. Zooms are city/metro level — enough context to recognise the
 * destination, never street level.
 * ───────────────────────────────────────────────────────────────────────── */
export interface PresentationPlace {
  /** Display name (proper noun — never localized). */
  name: string;
  /** [lng, lat] of the city centre. */
  center: [number, number];
  /** City/metro-level zoom for a presentation view. */
  zoom: number;
  /**
   * REAL administrative boundary of the municipality as closed [lng, lat]
   * rings (a MultiPolygon outer-ring set — mainland plus detached islands).
   *
   * Source: MLIT 国土数値情報 行政区域データ (N03-21), via
   * smartnews-smri/japan-topography (municipality level, 1 % simplification).
   * Hiroshima City is a designated city, so the dataset stores it as its eight
   * WARD polygons (N03_003 = 広島市, N03_007 = 34101–34108); those were
   * dissolved into the city outline by cancelling shared ward edges, and the
   * result was cross-checked against the same project's pre-dissolved
   * designated-city file. Generalized for display at city zoom — presentation
   * geometry, never used for analysis or measurement.
   */
  boundary: [number, number][][];
}

export const PRESENTATION_PLACES: Record<string, PresentationPlace> = {
  // FOSS4G 2026 host city — Hiroshima City (広島市), Hiroshima Prefecture.
  hiroshima: {
    name: "Hiroshima City, Japan",
    center: [132.4553, 34.3853],
    zoom: 10,
    boundary: [
      [
        [132.4229,34.363],[132.4205,34.3592],[132.4367,34.3531],[132.438,34.3456],
        [132.444,34.3405],[132.4498,34.3408],[132.4495,34.3468],[132.4525,34.3528],
        [132.4691,34.3529],[132.4785,34.3567],[132.4826,34.3536],[132.492,34.3535],
        [132.4964,34.357],[132.5062,34.3557],[132.5176,34.3651],[132.5178,34.3638],
        [132.5182,34.3617],[132.5182,34.3622],[132.5274,34.3685],[132.5311,34.3761],
        [132.5462,34.3861],[132.558,34.3851],[132.5669,34.3817],[132.5661,34.3761],
        [132.5787,34.3745],[132.5812,34.3808],[132.5915,34.3804],[132.5983,34.3785],
        [132.6013,34.3803],[132.6145,34.3749],[132.6229,34.3731],[132.6314,34.3616],
        [132.6275,34.3532],[132.6428,34.3533],[132.6442,34.3617],[132.651,34.3647],
        [132.6536,34.3687],[132.6501,34.3765],[132.6493,34.3836],[132.6443,34.3888],
        [132.6465,34.3959],[132.6404,34.3991],[132.6443,34.4131],[132.6522,34.4223],
        [132.6598,34.4233],[132.6661,34.4276],[132.6635,34.4375],[132.6546,34.4435],
        [132.6475,34.4376],[132.6415,34.442],[132.6357,34.4434],[132.6332,34.45],
        [132.624,34.4463],[132.6154,34.4465],[132.614,34.4512],[132.6079,34.4565],
        [132.6005,34.4573],[132.6025,34.4681],[132.606,34.4717],[132.6068,34.481],
        [132.601,34.4834],[132.603,34.4872],[132.6092,34.4903],[132.6187,34.4908],
        [132.6283,34.4983],[132.6334,34.507],[132.6444,34.5053],[132.6491,34.5146],
        [132.656,34.5234],[132.6629,34.5265],[132.6654,34.5315],[132.6737,34.5304],
        [132.6842,34.5268],[132.6931,34.5294],[132.6961,34.5358],[132.6869,34.5414],
        [132.6921,34.5463],[132.6876,34.5567],[132.6899,34.5618],[132.6833,34.5655],
        [132.6856,34.5721],[132.6941,34.5839],[132.6929,34.5898],[132.6791,34.604],
        [132.6716,34.6068],[132.6648,34.6069],[132.654,34.5995],[132.6457,34.602],
        [132.6325,34.5972],[132.6245,34.6],[132.6196,34.5987],[132.6136,34.6012],
        [132.6086,34.5963],[132.6104,34.5923],[132.6082,34.586],[132.5962,34.5853],
        [132.5903,34.5816],[132.5908,34.5752],[132.5781,34.564],[132.5732,34.5632],
        [132.5692,34.5726],[132.5657,34.5721],[132.5605,34.5769],[132.5507,34.5783],
        [132.544,34.5837],[132.5385,34.5832],[132.5307,34.5882],[132.5326,34.5909],
        [132.5248,34.6064],[132.5194,34.607],[132.5118,34.5964],[132.4993,34.5937],
        [132.4982,34.599],[132.4876,34.606],[132.4813,34.6061],[132.4803,34.6118],
        [132.4724,34.6148],[132.4644,34.6138],[132.4567,34.6032],[132.4497,34.5998],
        [132.4389,34.592],[132.4307,34.5973],[132.4258,34.6032],[132.4207,34.6031],
        [132.4153,34.5991],[132.4047,34.6023],[132.4001,34.6039],[132.3947,34.5991],
        [132.3901,34.5916],[132.3918,34.5854],[132.3873,34.5831],[132.3881,34.5733],
        [132.3907,34.5711],[132.3898,34.5622],[132.3748,34.548],[132.3677,34.545],
        [132.367,34.5401],[132.3599,34.5381],[132.3635,34.5475],[132.3526,34.5545],
        [132.3428,34.5519],[132.3405,34.5552],[132.331,34.5552],[132.305,34.5507],
        [132.2922,34.5474],[132.2915,34.5447],[132.2789,34.5423],[132.2695,34.5354],
        [132.2656,34.5359],[132.2492,34.5297],[132.2396,34.517],[132.2424,34.5104],
        [132.239,34.5075],[132.2332,34.5111],[132.2299,34.5094],[132.215,34.5142],
        [132.2057,34.5098],[132.2039,34.4994],[132.1961,34.4964],[132.1889,34.4983],
        [132.2,34.4909],[132.2033,34.4847],[132.1967,34.4776],[132.1935,34.4679],
        [132.1936,34.4574],[132.1961,34.4532],[132.1786,34.4426],[132.1914,34.4352],
        [132.1936,34.4314],[132.1909,34.4243],[132.1956,34.4159],[132.2182,34.4163],
        [132.2189,34.4199],[132.229,34.4311],[132.2357,34.4311],[132.2451,34.4233],
        [132.2495,34.4236],[132.2543,34.4178],[132.2548,34.414],[132.2813,34.4096],
        [132.2848,34.4025],[132.2831,34.4002],[132.2844,34.3897],[132.2932,34.3853],
        [132.3001,34.3843],[132.3035,34.3926],[132.3004,34.3991],[132.2996,34.4073],
        [132.3052,34.4145],[132.3114,34.4193],[132.3144,34.4159],[132.313,34.4101],
        [132.3167,34.4061],[132.3243,34.4058],[132.3207,34.3973],[132.3209,34.388],
        [132.317,34.3813],[132.3236,34.3796],[132.3346,34.3723],[132.3354,34.3676],
        [132.3423,34.3663],[132.347,34.3565],[132.3603,34.3557],[132.3647,34.3475],
        [132.3769,34.3524],[132.3751,34.3597],[132.3782,34.3609],[132.3975,34.363],
        [132.3993,34.3654],[132.4132,34.3572],[132.4205,34.3592],[132.4229,34.363]
      ],
      [
        [132.5192,34.3566],[132.5229,34.3419],[132.5301,34.3337],[132.5336,34.3164],
        [132.5364,34.3147],[132.5545,34.3128],[132.5567,34.3229],[132.5517,34.3316],
        [132.5514,34.3398],[132.5544,34.3441],[132.5489,34.3568],[132.5392,34.3615],
        [132.538,34.3581],[132.5281,34.3601],[132.5192,34.3566]
      ],
      [
        [132.4409,34.3259],[132.4325,34.3201],[132.4337,34.3147],[132.424,34.3028],
        [132.4318,34.2981],[132.4422,34.3024],[132.4455,34.3178],[132.4441,34.3252],
        [132.4409,34.3259]
      ]
    ],
  },
};
