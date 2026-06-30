"use client";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

interface Props {
  message: string | null;
}

/** Transient confirmation toast, centred at the bottom of the map. */
export default function Toast({ message }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-border-primary-default bg-background-default-default px-6 py-3 text-[13px] font-semibold shadow-xl transition-transform duration-300",
        message ? "translate-y-0" : "translate-y-22 opacity-0",
      )}
    >
      <Icon name="CheckCircle" className="size-4 text-text-primary-onlight" />
      <span>{message}</span>
    </div>
  );
}
