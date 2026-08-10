// Mobile AI bottom-sheet geometry. MOBILE ONLY — the desktop layout (chat
// column + draggable resizer) never reads these values.
//
// Each snap is the fraction of the viewport height the sheet OCCUPIES. The
// sheet is sized (not translated) to that height, so its chat input is always
// pinned to the real viewport bottom in every state, and the floating map
// chrome can sit directly above the sheet's top edge.

export type SheetSnap = "collapsed" | "default" | "expanded";

/**
 * The ONE shared value: the sheet's current visible height, published on
 * <html> by useBottomSheet. The sheet sizes from it; the map chrome offsets
 * from it. Nothing else re-derives snap positions.
 */
export const SHEET_HEIGHT_VAR = "--mobile-sheet-h";

/** Visible fraction of the viewport per snap (≈20vh / 50vh / 88vh). */
export const SHEET_SNAP_VH: Record<SheetSnap, number> = {
  collapsed: 0.2,
  default: 0.5,
  expanded: 0.88,
};

/** Ordered low → high; used for cycling and nearest-snap resolution. */
export const SHEET_SNAP_ORDER: SheetSnap[] = [
  "collapsed",
  "default",
  "expanded",
];

/** Opening state on mobile. */
export const SHEET_DEFAULT_SNAP: SheetSnap = "default";

/** Gap kept between the floating map chrome and the sheet's top edge (px). */
export const SHEET_CHROME_GAP_PX = 12;

/**
 * Bottom offset for floating map chrome (legend / settings / AI-sees) — the ONE
 * class every consumer uses, so no component re-derives the sheet position.
 * MOBILE: sits `SHEET_CHROME_GAP_PX` above the sheet's top edge, tracking the
 * shared height variable. DESKTOP (`md:`): the original `bottom-4`, unchanged.
 */
export const MAP_CHROME_BOTTOM_CLASS =
  "bottom-[calc(var(--mobile-sheet-h,50dvh)+12px)] md:bottom-4";

/** Applied while NOT dragging so chrome eases with the sheet's snap animation
 *  (during a drag the variable updates per frame and must not lag behind). */
export const MAP_CHROME_TRANSITION_CLASS =
  "transition-[bottom] duration-300 ease-out motion-reduce:transition-none";

/**
 * Flick threshold (px/ms). Above this, release advances one snap in the drag
 * direction instead of resolving to the nearest snap.
 */
export const SHEET_VELOCITY_THRESHOLD = 0.5;

/** Tailwind `md` (768px) is the desktop breakpoint — mobile is below it. */
export const SHEET_MOBILE_QUERY = "(max-width: 767.98px)";

/** Sheet height (px) for a snap at the given viewport height. */
export function snapHeightPx(snap: SheetSnap, viewportH: number): number {
  return SHEET_SNAP_VH[snap] * viewportH;
}

/** Snap whose height is closest to `height` (px). */
export function nearestSnapByHeight(
  height: number,
  viewportH: number,
): SheetSnap {
  let best = SHEET_SNAP_ORDER[0];
  let bestDist = Infinity;
  for (const s of SHEET_SNAP_ORDER) {
    const d = Math.abs(snapHeightPx(s, viewportH) - height);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

/** One step up (`-1`) or down (`+1`) the snap order, clamped at the ends. */
export function stepSnap(snap: SheetSnap, dir: -1 | 1): SheetSnap {
  const i = SHEET_SNAP_ORDER.indexOf(snap);
  const next = Math.min(
    SHEET_SNAP_ORDER.length - 1,
    Math.max(0, i + (dir === 1 ? 1 : -1)),
  );
  return SHEET_SNAP_ORDER[next];
}
