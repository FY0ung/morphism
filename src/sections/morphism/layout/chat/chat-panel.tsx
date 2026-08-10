"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ChatMessage, SwipeCompare } from "@/types";
import MessageList from "./message-list";
import SuggestionChips from "./suggestion-chips";
import ChatInput from "./chat-input";

interface Props {
  messages: ChatMessage[];
  pending: boolean;
  onSend: (text: string) => void;
  /** Re-open a closed swipe-compare from a compare result card. */
  onReopenCompare?: (sel: SwipeCompare) => void;
  /** The swipe-compare currently open on the map (null when closed). */
  activeSwipe?: SwipeCompare | null;
  /** Layout sizing classes supplied by the shell (width / order / borders). */
  className?: string;
  /** MOBILE bottom sheet: dragging the header also moves the sheet (no-op on
   *  desktop, where the sheet wrapper is inert). */
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
}

/** The whole chat sidebar (header → transcript → chips → input). */
export default function ChatPanel({
  messages,
  pending,
  onSend,
  onReopenCompare,
  activeSwipe,
  className,
  onHeaderPointerDown,
}: Props) {
  const { t } = useTranslation();

  return (
    <aside
      className={cn(
        "flex min-h-0 min-w-0 flex-col bg-background-default-default",
        className,
      )}
      aria-label={t("morphism.chatAria")}
    >
      <header
        onPointerDown={onHeaderPointerDown}
        className="flex flex-none touch-pan-y items-center gap-2 border-b border-border-default-default px-4 py-3 md:touch-auto"
      >
        {/* Product identity in the header. Reuses the same avatar asset +
            typography as the message identity row. The avatar carries the
            accessible label ("Morphism"); the visible name is a decorative echo
            (aria-hidden) so screen readers announce it only once. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/morphism/fah.svg"
          alt={t("morphism.assistantName")}
          draggable={false}
          className="size-5 shrink-0"
        />
        <h2
          aria-hidden="true"
          className="text-xs font-semibold text-text-primary-onlight"
        >
          {t("morphism.assistantName")}
        </h2>
      </header>

      <MessageList
        messages={messages}
        onReopenCompare={onReopenCompare}
        activeSwipe={activeSwipe}
        onPullDown={onHeaderPointerDown}
      />
      <SuggestionChips onPick={onSend} disabled={pending} />
      <ChatInput onSend={onSend} disabled={pending} />
    </aside>
  );
}
