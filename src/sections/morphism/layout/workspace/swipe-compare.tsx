"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/actionable/Buttons";
import { Icon } from "@/components/icons";
import { clampClip } from "@/hooks";

interface Props {
  active: boolean;
  /**
   * Divider + overlay are interactive only when BOTH compare maps and their
   * data are ready — until then only Close renders, and the existing map stays
   * untouched underneath. Which colour belongs to which period lives in the
   * LEGEND only (no floating side tags on the map).
   */
  ready: boolean;
  /**
   * Wrapper of the overlay (side B) map. The divider reveals it by writing
   * `clip-path` DIRECTLY on this node — pure CSS, no MapLibre work, no React
   * render, no network — exactly like the compare plugin's native mechanism.
   */
  overlayRef: RefObject<HTMLDivElement | null>;
  /** เปอร์เซ็นต์ที่เผยฝั่งซ้าย (0–100) — committed state (pointerup/keyboard). */
  clip: number;
  onClipChange: (pct: number) => void;
  onClose: () => void;
}

const STEP = 2;
const STEP_LARGE = 10;

/**
 * Flood swipe-compare overlay: a draggable vertical divider CSS-clips the
 * side-B overlay map so two flood dates can be compared. While dragging, the
 * position lives in a ref and is applied to the DOM inside a single
 * requestAnimationFrame per frame; React state is committed ONCE on pointerup
 * (and on discrete keyboard steps) — never on pointermove.
 */
export default function SwipeCompare({
  active,
  ready,
  overlayRef,
  clip,
  onClipChange,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dividerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const frameRef = useRef<number | null>(null);
  const pendingPct = useRef(clip);

  // Write the divider position straight to the DOM (overlay clip + divider
  // left + slider aria). The ONLY per-frame cost of a drag.
  const applyDom = (pct: number) => {
    overlayRef.current?.style.setProperty("clip-path", `inset(0 0 0 ${pct}%)`);
    const d = dividerRef.current;
    if (d) {
      d.style.left = `${pct}%`;
      d.setAttribute("aria-valuenow", String(Math.round(pct)));
    }
  };

  // Keep the DOM in sync with the COMMITTED clip (mount, keyboard steps,
  // pointerup commit, session re-open). Not run during a drag frame.
  useLayoutEffect(() => {
    if (!active) return;
    pendingPct.current = clip;
    applyDom(clip);
    // applyDom only touches refs — safe to omit; overlayRef is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip, active, ready]);

  // Never leak a queued frame when the overlay unmounts mid-drag.
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    },
    [],
  );

  const pctAt = (clientX: number) => {
    const el = wrapperRef.current;
    if (!el) return pendingPct.current;
    const r = el.getBoundingClientRect();
    return clampClip(((clientX - r.left) / r.width) * 100);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    pendingPct.current = pctAt(e.clientX);
    applyDom(pendingPct.current);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    pendingPct.current = pctAt(e.clientX);
    // Coalesce to ONE DOM write per animation frame regardless of the
    // pointer's event rate. No React state, no MapLibre calls, no network.
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      applyDom(pendingPct.current);
    });
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    applyDom(pendingPct.current);
    // Commit to React state ONCE per gesture.
    onClipChange(pendingPct.current);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowLeft: clip - STEP,
      ArrowRight: clip + STEP,
      ArrowDown: clip - STEP,
      ArrowUp: clip + STEP,
      PageDown: clip - STEP_LARGE,
      PageUp: clip + STEP_LARGE,
      Home: 0,
      End: 100,
    };
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key in keys) {
      e.preventDefault();
      onClipChange(keys[e.key]);
    }
  };

  if (!active) return null;

  const pct = Math.round(clip);

  return (
    // The wrapper itself is click-through so the main map underneath stays
    // pannable; only the divider and close button opt back into pointer events.
    // Side labels/colours live in the LEGEND (bottom-left) — no floating tags.
    <div
      ref={wrapperRef}
      className="pointer-events-none absolute inset-0 z-20"
      role="group"
      aria-label={t("morphism.swipe.aria")}
    >
      {/* draggable divider (focusable slider) — enabled only once BOTH sides
          are loaded and the overlay map has rendered (no divider over a map
          that isn't ready to compare yet) */}
      {ready && (
        <div
          ref={dividerRef}
          role="slider"
          tabIndex={0}
          aria-label={t("morphism.swipe.divider")}
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={t("morphism.swipe.valueText", { pct })}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          className="animate-fade group pointer-events-auto absolute inset-y-0 flex w-6 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center outline-none"
          style={{ left: `${clip}%` }}
        >
          {/* the visible vertical line */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-1/2 w-0.75 -translate-x-1/2 bg-background-secondary-default shadow-lg"
          />
          {/* the knob */}
          <span
            aria-hidden
            className="relative flex size-9 items-center justify-center rounded-full border-[3px] border-background-default-default bg-background-secondary-default text-text-secondary-default shadow-lg transition-transform duration-100 group-hover:scale-110 group-focus-visible:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-background-secondary-default group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background-default-default motion-reduce:transition-none"
          >
            <Icon name="ChevronLeft" className="-mr-1.5 size-3" />
            <Icon name="ChevronRight" className="-ml-1.5 size-3" />
          </span>
        </div>
      )}

      {/* close button */}
      <Button
        type="button"
        color="secondary"
        size="small"
        onClick={onClose}
        className="animate-fade pointer-events-auto absolute bottom-4 left-1/2 z-10 -translate-x-1/2 shadow-lg"
      >
        <Icon name="XClose" className="size-4" />
        {t("morphism.swipe.close")}
      </Button>
    </div>
  );
}
