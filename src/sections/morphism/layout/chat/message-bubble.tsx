"use client";

import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";
import ToolSteps from "./tool-steps";
import ChartCard from "./chart-card";

interface Props {
  message: ChatMessage;
}

export default function MessageBubble({ message }: Props) {
  const { t } = useTranslation();

  if (message.role === "user") {
    return (
      <div className="max-w-[94%] self-end">
        <div className="rounded-[16px] rounded-br-sm bg-background-primary-default px-4 py-3 text-text-primary-default shadow-sm">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[94%] self-start">
      <div className="rounded-[16px] rounded-bl-sm border border-border-default-default bg-background-default-light px-4 py-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary-onlight">
          <Icon name="Sparkle" className="size-3.5" />
          {t("morphism.assistantName")}
        </div>

        {message.pending && message.text === "" && (
          <p className="text-text-default-default">{t("morphism.thinking")}</p>
        )}
        {message.text && (
          <p className="text-text-default-default">{message.text}</p>
        )}

        {message.steps && message.steps.length > 0 && (
          <ToolSteps steps={message.steps} />
        )}

        {message.chart && <ChartCard chart={message.chart} />}

        {message.result && (
          <div
            className={cn(
              "mt-3 flex items-center gap-2 font-semibold text-text-success-onlight",
            )}
          >
            <Icon name="CheckCircle" className="size-4" />
            {message.result}
          </div>
        )}
      </div>
    </div>
  );
}
