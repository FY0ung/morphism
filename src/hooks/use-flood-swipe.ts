"use client";

import { useCallback, useEffect, useState } from "react";

// Clip stays inside [4, 96] so a sliver of each side is always visible — mirrors
// the reference `setSwipe` clamp. Exported so the divider's rAF drag path (which
// bypasses React state) clamps with the SAME rule.
const MIN = 4;
const MAX = 96;
export const clampClip = (n: number) => Math.max(MIN, Math.min(MAX, n));
const clamp = clampClip;

interface UseFloodSwipeArgs {
  /** Whether the compare overlay is on. */
  active: boolean;
}

/**
 * Owns the swipe-compare divider position (percent from the left). The two years
 * are drawn + clipped directly on the MAIN map (see use-morphism-map's
 * setFloodCompare / setFloodCompareClip), so no second map instance is needed —
 * this hook is just the divider's state.
 */
export function useFloodSwipe({ active }: UseFloodSwipeArgs) {
  const [clip, setClipState] = useState(50);
  const setClip = useCallback((pct: number) => setClipState(clamp(pct)), []);

  // Re-centre the divider each time the compare mode (re)opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (active) setClipState(50);
  }, [active]);

  return { clip, setClip };
}
