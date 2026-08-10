"use client";

import { useEffect, useRef } from "react";
import { isReducedMotion } from "@/lib/reduced-motion";
import type { ChatMessage, SwipeCompare } from "@/types";
import MessageBubble from "./message-bubble";

interface Props {
  messages: ChatMessage[];
  /** Re-open a closed swipe-compare from a compare result card. */
  onReopenCompare?: (sel: SwipeCompare) => void;
  /** The swipe-compare currently open on the map (null when closed). */
  activeSwipe?: SwipeCompare | null;
  /** MOBILE bottom sheet: start a sheet drag (only when already scrolled to
   *  the top, so normal transcript scrolling is never hijacked). */
  onPullDown?: (e: React.PointerEvent) => void;
}

/** Scrollable transcript that auto-sticks to the latest message. */
export default function MessageList({
  messages,
  onReopenCompare,
  activeSwipe,
  onPullDown,
}: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // True while the user is at (or near) the bottom — tracked on scroll so
  // step updates never yank someone who scrolled up to read older messages.
  const pinnedRef = useRef(true);

  useEffect(() => {
    // Auto-stick ONLY when already near the bottom; smooth normally, instant
    // under reduced motion. Repeated step updates coalesce naturally because
    // the browser interrupts an in-flight smooth scroll with the newer target.
    if (!pinnedRef.current) return;
    endRef.current?.scrollIntoView({
      block: "end",
      behavior: isReducedMotion() ? "auto" : "smooth",
    });
  }, [messages]);

  return (
    <div
      ref={scrollerRef}
      onScroll={() => {
        const el = scrollerRef.current;
        if (!el) return;
        pinnedRef.current =
          el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      onPointerDown={(e) => {
        if (!onPullDown) return;
        // Only when the transcript is already at the very top does a pull
        // belong to the sheet; otherwise the user is scrolling content.
        if ((scrollerRef.current?.scrollTop ?? 0) > 0) return;
        // Never hijack interactive controls inside the transcript (chart export
        // menu, re-open-compare button, links) — their clicks must still fire.
        if (
          (e.target as HTMLElement).closest(
            "button, a, input, select, textarea, [role='button'], [role='menu']",
          )
        ) {
          return;
        }
        onPullDown(e);
      }}
      // `min-h-0` is what lets this be the ONLY scrolling region in the sheet's
      // flex column (header + input stay pinned, messages take the remainder).
      className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4"
      aria-live="polite"
    >
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          onReopenCompare={onReopenCompare}
          activeSwipe={activeSwipe}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
