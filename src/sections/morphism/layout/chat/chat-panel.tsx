"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";
import MessageList from "./message-list";
import SuggestionChips from "./suggestion-chips";
import ChatInput from "./chat-input";

interface Props {
  messages: ChatMessage[];
  pending: boolean;
  onSend: (text: string) => void;
  /** Layout sizing classes supplied by the shell (width / order / borders). */
  className?: string;
}

/** The whole chat sidebar (header → transcript → chips → input). */
export default function ChatPanel({
  messages,
  pending,
  onSend,
  className,
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
      <header className="flex items-center gap-2 border-b border-border-default-default px-4 py-3">
        <span
          className="size-2 rounded-full bg-background-success-default"
          aria-hidden
        />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-default-onlight">
          {t("morphism.chatHeader")}
        </h2>
      </header>

      <MessageList messages={messages} />
      <SuggestionChips onPick={onSend} disabled={pending} />
      <ChatInput onSend={onSend} disabled={pending} />
    </aside>
  );
}
