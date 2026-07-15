"use client";

import { useCallback, useRef, useState } from "react";
import type { Scenario } from "@/types";

/**
 * Scene-level undo/redo — extracted verbatim from MorphismView (Phase 3B).
 *
 * The layer-visibility stack (useMapLayers) only rewinds WHICH layers are on —
 * meaningless when two flood dates share the same layers. This records the
 * whole APPLIED SCENARIO instead, so undo/redo step between real map states
 * (flood date, aggregation, compare, camera). `null` = the initial blank map.
 * Replaying re-runs the caller's apply function, which is deterministic, so
 * the scene is reconstructed exactly (flood re-fetches + refits).
 *
 * The hook owns ONLY the history bookkeeping; how a scenario (or the blank
 * state) is applied stays with the caller via `applyReplay`.
 */
export function useSceneHistory(
  /** Re-apply a stored scene (`null` = reset to the initial blank map). Runs
   *  with the replay flag set — record() calls during replay are ignored. */
  applyReplay: (s: Scenario | null) => void,
) {
  const sceneRef = useRef<{
    past: (Scenario | null)[];
    present: Scenario | null;
    future: (Scenario | null)[];
  }>({ past: [], present: null, future: [] });
  // True while an undo/redo is re-applying a scenario, so the apply path can
  // skip recording it as a new history entry.
  const replayingRef = useRef(false);
  const [nav, setNav] = useState({ canUndo: false, canRedo: false });

  const syncNav = useCallback(() => {
    setNav({
      canUndo: sceneRef.current.past.length > 0,
      canRedo: sceneRef.current.future.length > 0,
    });
  }, []);

  /** Record a newly APPLIED scenario (no-op during replay). */
  const record = useCallback(
    (scenario: Scenario) => {
      if (replayingRef.current) return;
      const s = sceneRef.current;
      s.past.push(s.present);
      s.present = scenario;
      s.future = [];
      syncNav();
    },
    [syncNav],
  );

  const replay = useCallback(
    (s: Scenario | null) => {
      replayingRef.current = true;
      try {
        applyReplay(s);
      } finally {
        replayingRef.current = false;
      }
    },
    [applyReplay],
  );

  const undo = useCallback(() => {
    const s = sceneRef.current;
    if (s.past.length === 0) return;
    s.future.unshift(s.present);
    s.present = s.past.pop() ?? null;
    syncNav();
    replay(s.present);
  }, [replay, syncNav]);

  const redo = useCallback(() => {
    const s = sceneRef.current;
    if (s.future.length === 0) return;
    s.past.push(s.present);
    s.present = s.future.shift() ?? null;
    syncNav();
    replay(s.present);
  }, [replay, syncNav]);

  return { nav, record, undo, redo };
}
