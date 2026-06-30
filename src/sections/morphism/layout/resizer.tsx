"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface Props {
  active: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

/** Draggable divider between the chat panel and the map (keyboard-accessible). */
export default function Resizer({ active, onPointerDown, onKeyDown }: Props) {
  const { t } = useTranslation();
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("morphism.resizeHandle")}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={cn(
        "group relative z-20 hidden  flex-none cursor-col-resize touch-none md:block",
        "focus-visible:outline-none",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 border-l transition-colors",
          active
            ? "border-l-2 border-border-primary-default"
            : "border-transparent group-hover:border-l-2 group-hover:border-border-primary-default group-focus-visible:border-l-2 group-focus-visible:border-border-primary-default",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background-primary-default transition-opacity",
          active
            ? "opacity-90"
            : "opacity-0 group-hover:opacity-90 group-focus-visible:opacity-90",
        )}
        aria-hidden
      />
    </div>
  );
}
