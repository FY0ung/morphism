"use client";

// Drag state for the MOBILE AI bottom sheet. Desktop never activates this: the
// hook reports `enabled: false` at/above the `md` breakpoint and the sheet
// wrapper falls back to `display: contents`, so the desktop DOM is untouched.
//
// SINGLE SOURCE OF TRUTH: the sheet's VISIBLE height is published as the CSS
// custom property `--mobile-sheet-h` on <html>. The sheet sizes itself from it
// (so its input is always pinned to the real viewport bottom) and the floating
// map chrome (legend / settings / AI-sees) offsets from the same value — no
// component re-derives snap points.
//
// Performance contract: during a drag the variable is written DIRECTLY inside
// one rAF frame — no React state per pointermove, no map resize, and layout is
// confined to the fixed sheet subtree. React state commits once, on release.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SHEET_DEFAULT_SNAP,
  SHEET_HEIGHT_VAR,
  SHEET_MOBILE_QUERY,
  SHEET_SNAP_VH,
  SHEET_VELOCITY_THRESHOLD,
  nearestSnapByHeight,
  snapHeightPx,
  stepSnap,
  type SheetSnap,
} from "@/configs/mobile-sheet";

interface BottomSheet {
  /** True only below the `md` breakpoint (mobile presentation active). */
  enabled: boolean;
  snap: SheetSnap;
  setSnap: (snap: SheetSnap) => void;
  /** Advance collapsed → default → expanded → collapsed (handle tap/Enter). */
  cycleSnap: () => void;
  /** Move one step up (-1) / down (+1) — arrow keys. */
  stepBy: (dir: -1 | 1) => void;
  dragging: boolean;
  sheetRef: React.RefObject<HTMLDivElement | null>;
  /** Spread on the drag handle (and header) to start a drag. */
  onDragStart: (e: React.PointerEvent) => void;
  /** Software-keyboard inset (px) so the input never hides behind it. */
  keyboardInset: number;
}

/** Write the shared visible-height variable (one style write, no React). */
function publishHeight(px: number): void {
  document.documentElement.style.setProperty(SHEET_HEIGHT_VAR, `${px}px`);
}

export function useBottomSheet(): BottomSheet {
  const [enabled, setEnabled] = useState(false);
  const [snap, setSnapState] = useState<SheetSnap>(SHEET_DEFAULT_SNAP);
  const [dragging, setDragging] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  // Live drag bookkeeping — refs only, so pointermove never re-renders.
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const heightRef = useRef(0);
  const lastYRef = useRef(0);
  const lastTRef = useRef(0);
  const velocityRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  // ── mobile detection (presentation is CSS; gestures need the JS signal) ──
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(SHEET_MOBILE_QUERY);
    const sync = () => setEnabled(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // ── software keyboard: keep the input above the keyboard (visualViewport) ─
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      setKeyboardInset(
        Math.max(0, window.innerHeight - vv.height - vv.offsetTop),
      );
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [enabled]);

  /** Publish the resting height for a snap (mount / snap change / resize). */
  const applySnapHeight = useCallback((next: SheetSnap) => {
    if (typeof window === "undefined") return;
    const px = snapHeightPx(next, window.innerHeight);
    heightRef.current = px;
    publishHeight(px);
  }, []);

  // Keep the published height correct on snap change, rotation and resize.
  useEffect(() => {
    if (!enabled) {
      // Leaving mobile: drop the variable so desktop reads nothing from it.
      document.documentElement.style.removeProperty(SHEET_HEIGHT_VAR);
      return;
    }
    applySnapHeight(snap);
    const onResize = () => {
      if (!draggingRef.current) applySnapHeight(snap);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [enabled, snap, applySnapHeight]);

  const setSnap = useCallback((next: SheetSnap) => setSnapState(next), []);
  const cycleSnap = useCallback(() => {
    setSnapState((s) =>
      s === "collapsed" ? "default" : s === "default" ? "expanded" : "collapsed",
    );
  }, []);
  const stepBy = useCallback(
    (dir: -1 | 1) => setSnapState((s) => stepSnap(s, dir)),
    [],
  );

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      // Own the gesture: the map underneath must never pan while dragging.
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

      draggingRef.current = true;
      setDragging(true);
      startYRef.current = e.clientY;
      lastYRef.current = e.clientY;
      lastTRef.current = performance.now();
      velocityRef.current = 0;
      startHeightRef.current = heightRef.current;

      const vh = window.innerHeight;
      const minH = SHEET_SNAP_VH.collapsed * vh;
      const maxH = SHEET_SNAP_VH.expanded * vh;

      const onMove = (ev: PointerEvent) => {
        // Dragging UP (negative dy) grows the sheet.
        const dy = ev.clientY - startYRef.current;
        heightRef.current = Math.min(
          maxH,
          Math.max(minH, startHeightRef.current - dy),
        );
        const now = performance.now();
        const dt = now - lastTRef.current;
        if (dt > 0) {
          velocityRef.current = (ev.clientY - lastYRef.current) / dt;
          lastYRef.current = ev.clientY;
          lastTRef.current = now;
        }
        // One write per frame, straight to the DOM (no React state).
        if (frameRef.current == null) {
          frameRef.current = requestAnimationFrame(() => {
            frameRef.current = null;
            publishHeight(heightRef.current);
          });
        }
      };

      const finish = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        if (frameRef.current != null) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        draggingRef.current = false;
        setDragging(false);

        const v = velocityRef.current; // + = downward (shrinking)
        const nearest = nearestSnapByHeight(heightRef.current, vh);
        // A deliberate flick advances one snap; otherwise settle on the nearest.
        const resolved =
          Math.abs(v) > SHEET_VELOCITY_THRESHOLD
            ? stepSnap(nearest, v > 0 ? 1 : -1)
            : nearest;
        setSnapState(resolved);
        applySnapHeight(resolved);
      };

      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [enabled, applySnapHeight],
  );

  useEffect(() => {
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return {
    enabled,
    snap,
    setSnap,
    cycleSnap,
    stepBy,
    dragging,
    sheetRef,
    onDragStart,
    keyboardInset,
  };
}
