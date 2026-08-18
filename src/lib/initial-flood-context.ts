// Initial map CONTEXT resolution — the newest usable registered flood DATE
// snapshot shown automatically when the app opens (before any question).
//
// This is map context, NOT an AI scenario: nothing here talks to the chat,
// the scene history, or the camera. Selection is a REGISTRY question — the
// newest date snapshot whose lightweight assets are actually reachable —
// never the calendar ("today"/"last week") and never a year aggregate.
//
// Pure + injectable (probe passed in) so it is unit-testable without a
// network; the view supplies a probe that fetches only lightweight artifacts
// (stats/overview), never the raw full GeoJSON.

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolve the newest USABLE date snapshot from `datesNewestFirst`.
 *   • Only exact DATE keys participate (year aggregates like "year-2025" are
 *     skipped by shape — the initial context is always one real observation).
 *   • `probe(date)` answers whether the snapshot's lightweight assets are
 *     usable; a rejecting/false probe skips that date and tries the next.
 *   • No usable snapshot → null (the caller keeps the empty initial state —
 *     a missing OPTIONAL context must never break startup).
 */
export async function resolveInitialFloodContext(
  datesNewestFirst: readonly string[],
  probe: (date: string) => Promise<boolean>,
): Promise<string | null> {
  for (const date of datesNewestFirst) {
    if (!DATE_KEY_RE.test(date)) continue; // never a year-aggregate key
    try {
      if (await probe(date)) return date;
    } catch {
      continue; // transient probe failure → try the next-newest snapshot
    }
  }
  return null;
}
