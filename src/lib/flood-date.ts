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

// Every recognised spelling → month number (1–12). Longer / more specific forms
// are matched first (see MONTH_PATTERNS) so "ตุลาคม" wins over "ตุลา".
const MONTH_ALIASES: Record<string, number> = {};
const add = (m: number, ...forms: string[]) => {
  for (const f of forms) MONTH_ALIASES[f.toLowerCase()] = m;
};
add(1, "มกราคม", "ม.ค.", "มกรา", "january", "jan");
add(2, "กุมภาพันธ์", "ก.พ.", "กุมภา", "february", "feb");
add(3, "มีนาคม", "มี.ค.", "มีนา", "march", "mar");
add(4, "เมษายน", "เม.ย.", "เมษา", "april", "apr");
add(5, "พฤษภาคม", "พ.ค.", "พฤษภา", "may");
add(6, "มิถุนายน", "มิ.ย.", "มิถุนา", "june", "jun");
add(7, "กรกฎาคม", "ก.ค.", "กรกฎา", "july", "jul");
add(8, "สิงหาคม", "ส.ค.", "สิงหา", "august", "aug");
add(9, "กันยายน", "ก.ย.", "กันยา", "september", "sep", "sept");
add(10, "ตุลาคม", "ต.ค.", "ตุลา", "october", "oct");
add(11, "พฤศจิกายน", "พ.ย.", "พฤศจิกา", "november", "nov");
add(12, "ธันวาคม", "ธ.ค.", "ธันวา", "december", "dec");

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

/**
 * Resolve a free-text query (Thai or Gregorian) to a flood observation date or
 * month. Returns matchMode "none" when no month+year could be extracted.
 */
export function resolveFloodDate(raw: string): FloodDateResolution {
  const text = raw.trim();
  const lower = text.toLowerCase();

  // 1. ISO yyyy-mm-dd.
  const iso = lower.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const year = toGregorianYear(Number(iso[1]));
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return buildExact(year, month, day);
    }
  }

  // 2. Numeric dd/mm/yyyy (or d/m/yyyy), separators / . -
  const dmy = lower.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = toGregorianYear(Number(dmy[3]));
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
