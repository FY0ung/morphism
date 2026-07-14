"use client";

import { useEffect, useRef } from "react";
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <div
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
