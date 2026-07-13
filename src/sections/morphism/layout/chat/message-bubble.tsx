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
        <div className="text-sm rounded-2xl rounded-br-sm bg-background-primary-default px-4 py-2 text-text-primary-default font-medium">
          {message.text}
        </div>
      </div>
    );
  }

  const loading = Boolean(message.pending);

  return (
    <div className="w-full max-w-[94%] self-start">
      <div
        aria-busy={loading}
        className="text-sm rounded-2xl rounded-bl-sm border border-border-default-default bg-background-default-light p-4"
      >
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-text-secondary-onlight">
          {/* Static supplied artwork (decorative). No next/image for a plain asset. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/morphism/fah.svg"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="size-5 shrink-0"
          />
          {t("morphism.assistantName")}
        </div>

        {message.pending && message.text === "" && (
          <p className="text-text-default-default font-medium">{t("morphism.thinking")}</p>
        )}
        {message.text && (
          <p className="whitespace-pre-line text-text-default-default font-medium">
            {message.text}
          </p>
        )}

        {message.steps && message.steps.length > 0 && (
          <ToolSteps steps={message.steps} />
        )}

        {message.charts?.map((chart) => (
          <ChartCard key={chart.exportName} chart={chart} />
        ))}

        {message.result && (
          <div
            className={cn(
              "mt-3 flex items-center gap-2 font-semibold text-text-success-onlight",
            )}
          >
            <Icon name="CheckCircle"/>
            {message.result}
          </div>
        )}
      </div>
    </div>
  );
}
