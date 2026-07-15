// LIVE `prefers-reduced-motion` access (Phase 4D). The old pattern captured
// the preference ONCE at module load, so changing the OS setting mid-session
// had no effect. This module subscribes to the media query and exposes:
//   - isReducedMotion()      → current value (for imperative code: map camera)
//   - useReducedMotionPref() → reactive hook (for rendering decisions)
"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function mql(): MediaQueryList | null {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia(QUERY)
    : null;
}

/** Current preference — safe on the server (false). */
export function isReducedMotion(): boolean {
  return mql()?.matches ?? false;
}

function subscribe(onChange: () => void): () => void {
  const m = mql();
  if (!m) return () => {};
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}

/** Reactive preference — re-renders when the OS setting changes. */
export function useReducedMotionPref(): boolean {
  return useSyncExternalStore(subscribe, isReducedMotion, () => false);
}
