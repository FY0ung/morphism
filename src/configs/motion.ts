// ─────────────────────────────────────────────────────────────────────────────
// SHARED MOTION CONFIG (Phase 4A) — the single source of duration/easing.
// Components must reference these instead of scattering arbitrary numbers.
//
// Principles (see docs/regression-checklist.md + Phase 4 brief):
// - motion communicates state change / continuity / feedback — never decoration
// - UI feedback lives in the 120–220 ms band; longer only for spatial continuity
// - reduced motion: read LIVE via lib/reduced-motion (never once at module load)
// ─────────────────────────────────────────────────────────────────────────────

/** UI transition durations (ms). */
export const MOTION = {
  /** Immediate feedback: hover/press states, small toggles. */
  fast: 120,
  /** Standard UI transitions: fades, chat message entrance, dropdowns. */
  base: 180,
  /** Panels / popovers / toast slide+fade. */
  panel: 220,
} as const;

/** Standard easing — gentle decelerate for entrances, symmetric for moves. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const; // motion/react format
export const EASE_CSS = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Map camera durations (ms) — CENTRALIZED names for the values the scenarios
 * already use (unchanged behavior). `replayFactor` shortens undo/redo camera
 * flights: history steps should feel like "going back", not a new flight.
 */
export const CAMERA = {
  /** Flood scenario fit (was FLOOD_FIT_DURATION). */
  floodFit: 700,
  /** Hospital / POI scope fit. */
  scopeFit: 1100,
  /** Aggregate / region / nationwide fit. */
  aggregateFit: 1200,
  /** Multiplier applied to camera durations while replaying undo/redo. */
  replayFactor: 0.35,
} as const;
