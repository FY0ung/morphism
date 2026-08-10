"use client";

// MOBILE-ONLY presentation wrapper for the AI chat panel.
//
// Desktop: the wrapper is `md:contents`, so it disappears from the box tree and
// its child (ChatPanel) stays the exact same flex item it is today — the
// desktop column, resizer, sizing and DOM order are untouched.
//
// Mobile: it becomes a fixed bottom sheet layered over the map. The map keeps
// its own element and MapLibre instance underneath (never remounted), and the
// sheet only ever moves by `transform`, so no snap change resizes the map.

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useReducedMotionPref } from "@/lib/reduced-motion";
import { type SheetSnap } from "@/configs/mobile-sheet";

interface Props {
  children: React.ReactNode;
  enabled: boolean;
  snap: SheetSnap;
  dragging: boolean;
  sheetRef: React.RefObject<HTMLDivElement | null>;
  onDragStart: (e: React.PointerEvent) => void;
  onCycle: () => void;
  onStep: (dir: -1 | 1) => void;
  /** Software-keyboard inset (px) so the input never hides behind it. */
  keyboardInset: number;
}

export default function MobileSheet({
  children,
  enabled,
  snap,
  dragging,
  sheetRef,
  onDragStart,
  onCycle,
  onStep,
  keyboardInset,
}: Props) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotionPref();

  return (
    <div
      ref={sheetRef}
      // `md:contents` → on desktop this element imposes no layout at all.
      className={cn(
        // Sized (not translated) from the SHARED height var, so the sheet's
        // bottom edge is always the viewport bottom → the chat input below the
        // scroll area is visible in EVERY snap state. The fallback keeps first
        // paint correct before hydration publishes the variable.
        "fixed inset-x-0 bottom-0 z-30 flex h-[var(--mobile-sheet-h,50dvh)] flex-col overflow-hidden",
        "rounded-t-2xl border-t border-border-default-default bg-background-default-default shadow-lg",
        "md:contents",
        !dragging && !reduceMotion && "transition-[height] duration-300 ease-out",
        "motion-reduce:transition-none",
      )}
      // Only the software-keyboard inset is dynamic (visualViewport, mobile) —
      // it lifts the whole sheet so the input clears the keyboard.
      style={
        enabled && keyboardInset
          ? ({ bottom: `${keyboardInset}px` } as React.CSSProperties)
          : undefined
      }
      role={enabled ? "region" : undefined}
      aria-label={enabled ? t("morphism.sheet.aria") : undefined}
    >
      {/* Drag handle — mobile only. Also a real button: tap/Enter cycles the
          snap states and arrows step them, so drag is never the ONLY way. */}
      <button
        type="button"
        onPointerDown={onDragStart}
        onClick={onCycle}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onStep(-1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onStep(1);
          }
        }}
        aria-label={t("morphism.sheet.handle")}
        aria-expanded={snap === "expanded"}
        className={cn(
          "flex w-full flex-none touch-none cursor-grab items-center justify-center py-2 active:cursor-grabbing",
          "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-border-primary-default",
          "md:hidden",
        )}
      >
        <span
          aria-hidden
          className="h-1 w-10 rounded-full bg-border-default-onlight"
        />
      </button>

      {children}
    </div>
  );
}
