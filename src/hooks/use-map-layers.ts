"use client";

import { useCallback, useMemo } from "react";
import { useHistoryStack } from "./use-history-stack";
import type { LayerId, LayersState } from "@/types";

const INITIAL: LayersState = {
  hospitals: { visible: false, byAI: false },
  flood: { visible: false, byAI: false },
  buffer: { visible: false, byAI: false },
  boundaries: { visible: false, byAI: false },
};

/**
 * Layer visibility state for the map, backed by a multi-step undo/redo stack.
 * The AI toggles layers with `byAI = true` so the panel can show an "AI" badge.
 */
export function useMapLayers() {
  const { state: layers, set, undo, redo, canUndo, canRedo, reset } =
    useHistoryStack<LayersState>(INITIAL);

  /** Set a single layer (records history). */
  const setLayer = useCallback(
    (id: LayerId, visible: boolean, byAI = false) => {
      set((prev) => ({
        ...prev,
        [id]: { visible, byAI: visible ? byAI || prev[id].byAI : false },
      }));
    },
    [set],
  );

  /** User toggle from the panel (clears the AI badge). */
  const toggleLayer = useCallback(
    (id: LayerId) => {
      set((prev) => ({
        ...prev,
        [id]: { visible: !prev[id].visible, byAI: false },
      }));
    },
    [set],
  );

  /** Apply a set of layers at once (used by the AI assistant). */
  const applyLayers = useCallback(
    (ids: LayerId[], byAI = true) => {
      set((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          next[id] = { visible: true, byAI };
        });
        return next;
      });
    },
    [set],
  );

  /**
   * Set the visible layers to EXACTLY `ids` (everything else off) in one history
   * entry. Used when switching scenarios so the previous scenario's layers are
   * cleared and only the new scenario's state remains.
   */
  const applyExact = useCallback(
    (ids: LayerId[], byAI = true) => {
      set(() => {
        const next: LayersState = {
          hospitals: { visible: false, byAI: false },
          flood: { visible: false, byAI: false },
          buffer: { visible: false, byAI: false },
          boundaries: { visible: false, byAI: false },
        };
        ids.forEach((id) => {
          next[id] = { visible: true, byAI };
        });
        return next;
      });
    },
    [set],
  );

  const visibleIds = useMemo(
    () =>
      (Object.keys(layers) as LayerId[]).filter((id) => layers[id].visible),
    [layers],
  );

  return {
    layers,
    visibleIds,
    visibleCount: visibleIds.length,
    setLayer,
    toggleLayer,
    applyLayers,
    applyExact,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
  };
}
