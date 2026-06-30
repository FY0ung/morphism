"use client";

import { useCallback, useState } from "react";

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

/**
 * Generic multi-step undo/redo stack.
 * `set` records a new entry; `undo`/`redo` move the pointer.
 */
export function useHistoryStack<T>(initial: T) {
  const [hist, setHist] = useState<History<T>>({
    past: [],
    present: initial,
    future: [],
  });

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setHist((h) => {
      const value =
        typeof next === "function"
          ? (next as (prev: T) => T)(h.present)
          : next;
      if (Object.is(value, h.present)) return h;
      return { past: [...h.past, h.present], present: value, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setHist((h) => {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1];
      return {
        past: h.past.slice(0, -1),
        present: previous,
        future: [h.present, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHist((h) => {
      if (h.future.length === 0) return h;
      const next = h.future[0];
      return {
        past: [...h.past, h.present],
        present: next,
        future: h.future.slice(1),
      };
    });
  }, []);

  const reset = useCallback((value: T) => {
    setHist({ past: [], present: value, future: [] });
  }, []);

  return {
    state: hist.present,
    set,
    undo,
    redo,
    reset,
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0,
  };
}
