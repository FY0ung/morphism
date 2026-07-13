"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/actionable/Buttons";
import { Icon } from "@/components/icons";
import { FLOOD_COMPARE_SIDES } from "@/configs/flood-compare";

interface Props {
  active: boolean;
  /** ปี (พ.ศ.) ฝั่งซ้าย */
  yearA: number;
  /** ปี (พ.ศ.) ฝั่งขวา */
  yearB: number;
  /** เปอร์เซ็นต์ที่เผยฝั่งซ้าย (0–100) */
  clip: number;
  onClipChange: (pct: number) => void;
  onClose: () => void;
}

const STEP = 2;
const STEP_LARGE = 10;

/**
 * Flood swipe-compare overlay: a draggable vertical divider clips the second
 * map (owned by useFloodSwipe) left/right so two flood years can be compared.
 * The divider is a focusable slider — arrow/Page/Home/End keys move it too.
 */
export default function SwipeCompare({
  active,
  yearA,
  yearB,
  clip,
  onClipChange,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const pctAt = (clientX: number) => {
    const el = wrapperRef.current;
    if (!el) return clip;
    const r = el.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * 100;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onClipChange(pctAt(e.clientX));
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current) onClipChange(pctAt(e.clientX));
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
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
  const tagClass =
    "pointer-events-none absolute top-16 z-10 inline-flex items-center gap-1.5 rounded-full border border-border-default-default bg-background-default-default px-2.5 py-1 text-xs font-semibold text-text-default-onlight shadow-md";
  const dotClass = "size-2.5 flex-none rounded-full";

  return (
    // The wrapper itself is click-through so the main map underneath stays
    // pannable; only the divider and close button opt back into pointer events.
    <div
      ref={wrapperRef}
      className="pointer-events-none absolute inset-0 z-20"
      role="group"
      aria-label={t("morphism.swipe.aria")}
    >
      {/* corner tags labelling each side — dot colour matches the map layer */}
      <span className={`${tagClass} left-3`}>
        <span className={`${dotClass} ${FLOOD_COMPARE_SIDES.a.bg}`} aria-hidden />
        {t("morphism.swipe.side", { year: yearA })}
      </span>
      <span className={`${tagClass} right-3`}>
        <span className={`${dotClass} ${FLOOD_COMPARE_SIDES.b.bg}`} aria-hidden />
        {t("morphism.swipe.side", { year: yearB })}
      </span>

      {/* draggable divider (focusable slider) */}
      <div
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
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        className="group pointer-events-auto absolute inset-y-0 flex w-6 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center outline-none"
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

      {/* close button */}
      <Button
        type="button"
        color="secondary"
        size="small"
        onClick={onClose}
        className="pointer-events-auto absolute bottom-4 left-1/2 z-10 -translate-x-1/2 shadow-lg"
      >
        <Icon name="XClose" className="size-4" />
        {t("morphism.swipe.close")}
      </Button>
    </div>
  );
}
