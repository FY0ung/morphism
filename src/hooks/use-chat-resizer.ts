"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutDirection } from "@/types";

const MIN = 320;
const MAX = 640;
const STEP = 24;
const STORAGE_KEY = "morphism.chatWidth";

const clamp = (w: number) => Math.min(MAX, Math.max(MIN, w));

/**
 * Draggable / keyboard-resizable chat width.
 * Direction-aware (LTR/RTL) and persisted to localStorage.
 */
export function useChatResizer(direction: LayoutDirection = "ltr") {
  const [width, setWidth] = useState(400);
  const [active, setActive] = useState(false);

  // Root element carrying the `--chat-w` CSS variable. During a drag the
  // width is written HERE directly (one style write per move, zero React
  // renders of the app tree); React state commits ONCE on pointerup.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef(width);
  const dirRef = useRef(direction);
  const startX = useRef(0);
  const startW = useRef(0);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);
  useEffect(() => {
    dirRef.current = direction;
  }, [direction]);

  // Restore persisted width on mount. The setState runs inside a rAF callback
  // (async), so the effect body itself never sets state synchronously — and
  // the first paint still matches SSR (no hydration mismatch).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const stored = Number(localStorage.getItem(STORAGE_KEY));
      if (stored >= MIN && stored <= MAX) setWidth(stored);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const persist = useCallback((w: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(w));
    } catch {
      /* storage unavailable — ignore */
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    setActive(true);
    startX.current = e.clientX;
    startW.current = widthRef.current;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - startX.current;
      const delta = dirRef.current === "rtl" ? -dx : dx;
      const next = clamp(startW.current + delta);
      // Direct DOM write — the layout updates visually without re-rendering
      // the whole view on every pointermove (Phase 4B-6).
      widthRef.current = next;
      rootRef.current?.style.setProperty("--chat-w", `${next}px`);
    };
    const onUp = () => {
      setActive(false);
      setWidth(widthRef.current); // commit React state ONCE per gesture
      persist(widthRef.current);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [active, persist]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const grow = e.key === "ArrowRight" ? 1 : -1;
      const sign = dirRef.current === "rtl" ? -grow : grow;
      const next = clamp(widthRef.current + sign * STEP);
      setWidth(next);
      persist(next);
    },
    [persist],
  );

  return { width, active, onPointerDown, onKeyDown, rootRef, MIN, MAX };
}
