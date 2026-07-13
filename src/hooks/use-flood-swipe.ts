"use client";

import { useCallback, useEffect, useState } from "react";

// Clip stays inside [4, 96] so a sliver of each side is always visible — mirrors
// the reference `setSwipe` clamp.
const MIN = 4;
const MAX = 96;
const clamp = (n: number) => Math.max(MIN, Math.min(MAX, n));

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
