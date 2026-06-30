"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types";
import MessageBubble from "./message-bubble";

interface Props {
  messages: ChatMessage[];
}

/** Scrollable transcript that auto-sticks to the latest message. */
export default function MessageList({ messages }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <div
      className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto p-4"
      aria-live="polite"
    >
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
