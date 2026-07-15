// Aggregation over the NORMALIZED hospital dataset — the single source the
// scenario resolver uses for province/region/nationwide totals, so map labels,
// charts and chat summaries all report the SAME numbers as the rendered points
// (never a static reference table once the dataset has loaded).
import { normalizeProvinceName } from "@/lib/geo";
import type { HospitalFC } from "@/types";

/** Canonical Thai province name → hospital count, from the loaded dataset. */
export type ProvinceCounts = ReadonlyMap<string, number>;

/**
 * Count hospitals per canonical province. Features without a resolvable
 * province still count toward the grand total via `totalOf` (they simply have
 * no per-province row). Pure + O(features); memoize at the call site.
 */
export function buildProvinceCounts(fc: HospitalFC): ProvinceCounts {
  const counts = new Map<string, number>();
  for (const f of fc.features) {
    const canon = normalizeProvinceName(f.properties.province);
    if (!canon) continue;
    counts.set(canon, (counts.get(canon) ?? 0) + 1);
  }
  return counts;
}

/** Total across every counted province. */
export function totalOfCounts(counts: ProvinceCounts): number {
  let sum = 0;
  for (const v of counts.values()) sum += v;
  return sum;
}
