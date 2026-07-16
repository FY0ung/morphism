// Locale-agnostic intent keyword groups for the Morphism scenario parser
// (sections/morphism/const.tsx → resolveScenario). ONE canonical intent per
// group; add per-locale aliases (Thai · English · Japanese) HERE, never inside
// UI components. The parser matches the NORMALIZED query against these.

const HALFWIDTH_KATAKANA = /[｡-ﾟ]+/g;

/**
 * Fold a raw query for keyword matching:
 *   • full-width ASCII "！"–"～" (U+FF01–FF5E) → ASCII (e.g. "５ｋｍ" → "5km")
 *   • ideographic space U+3000 → normal space
 *   • half-width katakana (U+FF61–FF9F, incl. dakuten) → full-width ("ｷﾛ" → "キロ")
 *   • then lowercase for the Latin aliases
 *
 * A plain `normalize("NFKC")` is deliberately NOT used: NFKC decomposes Thai
 * SARA AM (ำ → ํ + า), which would break every Thai keyword. This targeted fold
 * only touches full-width/half-width forms and leaves Thai/CJK code points as-is.
 */
export function normalizeQuery(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const c = ch.codePointAt(0)!;
    if (c >= 0xff01 && c <= 0xff5e) out += String.fromCodePoint(c - 0xfee0);
    else if (c === 0x3000) out += " ";
    else out += ch;
  }
  return out.replace(HALFWIDTH_KATAKANA, (m) => m.normalize("NFKC")).toLowerCase();
}

/** Flood / inundation. */
export const FLOOD_TERMS: string[] = ["น้ำท่วม", "flood", "洪水", "浸水"];

/** Hospital / clinic / "near me". */
export const HOSPITAL_TERMS: string[] = [
  "โรงพยาบาล",
  "รพ",
  "hospital",
  "ใกล้ฉัน",
  "near me",
  "病院",
];

/**
 * Distance / spatial-relation terms that — together with a flood term — mean the
 * "hospitals within 5 km of flood areas" buffer analysis. Japanese: 以内
 * (within), 周辺 (around), 近く (near), 半径 (radius), キロ/キロメートル (km).
 */
export const BUFFER_TERMS: string[] = [
  "รัศมี",
  "buffer",
  "กม.",
  "กม",
  "km",
  "ภายใน",
  "within",
  "以内",
  "周辺",
  "近く",
  "半径",
  "キロメートル",
  "キロ",
];

/** 24-hour / round-the-clock. */
export const H24_TERMS: string[] = [
  "24 ชั่วโมง",
  "24 ชม",
  "เปิด 24",
  "24/7",
  "24-hour",
  "24 hour",
  "24hr",
  "24時間",
];

/** Compare / versus. */
export const COMPARE_TERMS: string[] = [
  "เปรียบเทียบ",
  "เทียบ",
  "compare",
  " vs ",
  "vs",
  "比較",
  "比べ",
];

/** "How many / count / total". */
export const COUNT_TERMS: string[] = [
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
  "何か所",
  "何ヶ所",
  "何箇所",
  "いくつ",
  "件数",
];

/** Nationwide. */
export const NATION_TERMS: string[] = [
  "ทั่วประเทศ",
  "ทั้งประเทศ",
  "ทุกจังหวัด",
  "nationwide",
  "全国",
];

/** "Latest / most recent". */
export const LATEST_TERMS: string[] = [
  "ล่าสุด",
  "ล่าสุ",
  "latest",
  "recent",
  "newest",
  "most recent",
  "最新",
  "直近",
];

/** Songkran. */
export const SONGKRAN_TERMS: string[] = ["สงกรานต์", "songkran", "ソンクラン"];
