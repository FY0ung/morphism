// Deterministic date/query resolution for the flood scenario. Pure + isomorphic
// (no browser/server APIs) so it is reused by the query matcher (const.tsx) and
// the server route filter, and is trivially unit-testable.
//
// Normalisation rules (per spec):
//   2568 → 2025 (Buddhist Era → Gregorian; year ≥ 2400 ⇒ subtract 543)
//   ตุลา / ต.ค. → ตุลาคม   (colloquial + abbreviations → canonical month)
//   13/10/2568 → 2025-10-13
// Match mode:
//   day + month + year ⇒ "exact-date" (YYYY-MM-DD)
//   month + year only  ⇒ "month"      (YYYY-MM)

export type FloodMatchMode = "exact-date" | "month" | "year" | "none";

export interface FloodDateResolution {
  matchMode: FloodMatchMode;
  /** YYYY-MM-DD when matchMode === "exact-date". */
  resolvedDate?: string;
  /** YYYY-MM when matchMode === "month". */
  resolvedMonth?: string;
  /** Gregorian year (CE). */
  year?: number;
  /** 1–12. */
  month?: number;
  /** 1–31 (exact-date only). */
  day?: number;
}

/** Canonical full Thai month names, index 0 = มกราคม (month 1). */
export const THAI_MONTHS_FULL = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

/** Canonical full English month names, index 0 = January (month 1). */
export const EN_MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

// Every recognised spelling → month number (1–12). Longer / more specific forms
// are matched first (see MONTH_PATTERNS) so "ตุลาคม" wins over "ตุลา".
const MONTH_ALIASES: Record<string, number> = {};
const add = (m: number, ...forms: string[]) => {
  for (const f of forms) MONTH_ALIASES[f.toLowerCase()] = m;
};
// Japanese months are the number + 月 ("10月"), so they are registered as
// aliases here like every other spelling — the resolver itself is unchanged.
add(1, "มกราคม", "ม.ค.", "มกรา", "january", "jan", "1月");
add(2, "กุมภาพันธ์", "ก.พ.", "กุมภา", "february", "feb", "2月");
add(3, "มีนาคม", "มี.ค.", "มีนา", "march", "mar", "3月");
add(4, "เมษายน", "เม.ย.", "เมษา", "april", "apr", "4月");
add(5, "พฤษภาคม", "พ.ค.", "พฤษภา", "may", "5月");
add(6, "มิถุนายน", "มิ.ย.", "มิถุนา", "june", "jun", "6月");
add(7, "กรกฎาคม", "ก.ค.", "กรกฎา", "july", "jul", "7月");
add(8, "สิงหาคม", "ส.ค.", "สิงหา", "august", "aug", "8月");
add(9, "กันยายน", "ก.ย.", "กันยา", "september", "sep", "sept", "9月");
add(10, "ตุลาคม", "ต.ค.", "ตุลา", "october", "oct", "10月");
add(11, "พฤศจิกายน", "พ.ย.", "พฤศจิกา", "november", "nov", "11月");
add(12, "ธันวาคม", "ธ.ค.", "ธันวา", "december", "dec", "12月");

// Match longest patterns first so a canonical name is not shadowed by a shorter
// colloquial prefix it contains.
const MONTH_PATTERNS = Object.keys(MONTH_ALIASES).sort(
  (a, b) => b.length - a.length,
);

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Buddhist-Era → Gregorian (years ≥ 2400 are treated as B.E.). */
export function toGregorianYear(year: number): number {
  return year >= 2400 ? year - 543 : year;
}

/**
 * Expand a 2-digit year to 4 digits. The dataset spans B.E. 2565–2568 (last two
 * digits 65–68) and C.E. 2022–2025 (22–25) — non-overlapping ranges — so ≥ 50 is
 * read as a short Buddhist-Era year (68 → 2568) and < 50 as a short Gregorian
 * year (25 → 2025). 4-digit years pass through unchanged.
 */
function normalizeYear(year: number): number {
  if (year >= 100) return year;
  return year >= 50 ? 2500 + year : 2000 + year;
}

/** Gregorian → Buddhist-Era (for display). */
export function toBuddhistYear(yearCE: number): number {
  return yearCE + 543;
}

function detectMonth(lower: string): number | undefined {
  for (const p of MONTH_PATTERNS) {
    if (lower.includes(p)) return MONTH_ALIASES[p];
  }
  return undefined;
}

/** Public: month number (1–12) for a month word in free text, else undefined. */
export function detectFloodMonth(raw: string): number | undefined {
  return detectMonth(raw.trim().toLowerCase());
}

/** Part-of-month modifier: ต้นเดือน / กลางเดือน / ปลายเดือน (early/mid/late). */
export type MonthPeriod = "early" | "mid" | "late";

/**
 * Detect a "part of the month" phrase in free text (Thai, English or
 * Japanese), e.g. "กลางเดือนตุลา" / "mid-October" / "10月中旬" → "mid". Only
 * fires on the explicit month-part idioms so it never clashes with the
 * ภาคกลาง (central region) keyword. The Japanese 上旬/中旬/下旬 are added as
 * ALIASES of the same three periods — the window maths below is untouched.
 */
export function detectMonthPeriod(raw: string): MonthPeriod | undefined {
  const l = raw.toLowerCase();
  if (/ต้นเดือน|ช่วงต้นเดือน|\bearly\b|\bbeginning\b|上旬/.test(l)) return "early";
  if (/ปลายเดือน|สิ้นเดือน|ช่วงปลายเดือน|\blate\b|\bend of\b|下旬/.test(l))
    return "late";
  if (/กลางเดือน|ช่วงกลางเดือน|\bmid\b|\bmid-|\bmiddle\b|中旬/.test(l)) return "mid";
  return undefined;
}

/** Inclusive day window [lo, hi] for a month-period modifier. */
export function periodDayRange(period: MonthPeriod): [number, number] {
  if (period === "early") return [1, 10];
  if (period === "mid") return [11, 20];
  return [21, 31];
}

/** Number of days in "YYYY-MM" (day 0 of the NEXT month = last day of this
 *  one — pure calendar arithmetic, no timezone dependence on the result). */
export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * CALENDAR window of a month-period as inclusive ISO dates, e.g.
 * ("2025-10", "mid") → ["2025-10-11", "2025-10-20"]. The upper bound is
 * clamped to the month's real length ("2025-02" late → …-02-28), so the
 * resolved range is always a pair of real calendar dates. Deterministic:
 * depends ONLY on the inputs — never on the dataset registry or today's date.
 */
export function periodCalendarRange(
  monthKey: string,
  period: MonthPeriod,
): [string, string] {
  const [lo, hi] = periodDayRange(period);
  const last = daysInMonth(monthKey);
  return [
    `${monthKey}-${pad2(lo)}`,
    `${monthKey}-${pad2(Math.min(hi, last))}`,
  ];
}

/**
 * Resolve a free-text query (Thai or Gregorian) to a flood observation date or
 * month. Returns matchMode "none" when no month+year could be extracted.
 */
export function resolveFloodDate(raw: string): FloodDateResolution {
  const text = raw.trim();
  const lower = text.toLowerCase();

  // 1. Year-first: yyyy-mm-dd, yyyy/mm/dd, yyyy.mm.dd, compact yyyymmdd, or the
  //    Japanese form yyyy年M月D日 (Buddhist-Era years normalised, e.g.
  //    2568-10-13, 25681013, 2025年10月13日). Japanese is only a SEPARATOR
  //    spelling of the same year-month-day order, so it feeds the identical
  //    canonicalisation below — no separate date path.
  const ymd =
    lower.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/) ??
    lower.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/) ??
    lower.match(/(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)/);
  if (ymd) {
    const year = toGregorianYear(Number(ymd[1]));
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return buildExact(year, month, day);
    }
  }

  // 2. Day-first numeric: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy — 2- or 4-digit year
  //    (e.g. 13/10/2568, 13-10-68, 13.10.25).
  const dmy = lower.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = toGregorianYear(normalizeYear(Number(dmy[3])));
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return buildExact(year, month, day);
    }
  }

  // 3. Textual month (+ optional day) + 4-digit year.
  const month = detectMonth(lower);
  const yearMatch = lower.match(/\b(\d{4})\b/);
  if (month && yearMatch) {
    const year = toGregorianYear(Number(yearMatch[1]));
    // Day = first 1–2 digit number that is NOT part of the year token.
    const withoutYear = lower.replace(yearMatch[0], " ");
    const dayMatch = withoutYear.match(/(?<!\d)(\d{1,2})(?!\d)/);
    const day = dayMatch ? Number(dayMatch[1]) : undefined;
    if (day && day >= 1 && day <= 31) return buildExact(year, month, day);
    return buildMonth(year, month);
  }

  // 4. Year only (no month), e.g. "น้ำท่วมปี 2565" / "flood 2022".
  if (yearMatch) {
    const year = toGregorianYear(Number(yearMatch[1]));
    return { matchMode: "year", year };
  }

  return { matchMode: "none" };
}

function buildExact(
  year: number,
  month: number,
  day: number,
): FloodDateResolution {
  return {
    matchMode: "exact-date",
    resolvedDate: `${year}-${pad2(month)}-${pad2(day)}`,
    year,
    month,
    day,
  };
}

function buildMonth(year: number, month: number): FloodDateResolution {
  return {
    matchMode: "month",
    resolvedMonth: `${year}-${pad2(month)}`,
    year,
    month,
  };
}

/** "2025-10-13" → "13 ตุลาคม 2568". */
export function formatThaiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${THAI_MONTHS_FULL[m - 1]} ${toBuddhistYear(y)}`;
}

/** "2025-10" → "ตุลาคม 2568". */
export function formatThaiMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${THAI_MONTHS_FULL[m - 1]} ${toBuddhistYear(y)}`;
}

/** "2025-12-18" → "2025年12月18日" (Gregorian; Japanese uses CE years). */
export function formatJapaneseDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

/** "2025-12" → "2025年12月" (Gregorian). */
export function formatJapaneseMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${y}年${m}月`;
}

/** Supported UI locales for date labels. */
export type DateLang = "en" | "th" | "ja";

/**
 * Locale-aware date label.
 *   th → "13 ตุลาคม 2568" (Buddhist Era)
 *   ja → "2025年10月13日" (Gregorian)
 *   en → "13 October 2025" (Gregorian)
 */
export function formatDate(iso: string, lang: DateLang): string {
  if (lang === "th") return formatThaiDate(iso);
  if (lang === "ja") return formatJapaneseDate(iso);
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${EN_MONTHS_FULL[m - 1]} ${y}`;
}

/**
 * Locale-aware month label.
 *   th → "ตุลาคม 2568" (Buddhist Era)
 *   ja → "2025年10月" (Gregorian)
 *   en → "October 2025" (Gregorian)
 */
export function formatMonth(ym: string, lang: DateLang): string {
  if (lang === "th") return formatThaiMonth(ym);
  if (lang === "ja") return formatJapaneseMonth(ym);
  const [y, m] = ym.split("-").map(Number);
  return `${EN_MONTHS_FULL[m - 1]} ${y}`;
}

/**
 * Extract the acquisition date embedded in a dataset `file_name` and normalise
 * it to YYYY-MM-DD. Uses the FIRST 8-digit YYYYMMDD token (e.g.
 * "S1C_20251013_0559, rd2_20251013_1817" → "2025-10-13").
 * NOTE: this is the observation date — never use `_createdAt` for this.
 */
export function extractFileNameDate(fileName: string | undefined): string | null {
  if (!fileName) return null;
  const m = fileName.match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}
