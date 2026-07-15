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
}

/** Scrollable transcript that auto-sticks to the latest message. */
export default function MessageList({
  messages,
  onReopenCompare,
  activeSwipe,
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
      className="no-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto p-4"
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
