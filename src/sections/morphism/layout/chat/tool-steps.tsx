"use client";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ToolStep } from "@/types";

interface Props {
  steps: ToolStep[];
}

/** ms below 1000 → "N ms"; at/above 1000 → "N.N s" (one decimal). */
function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** The "AI is calling tools" timeline shown inside an assistant bubble. */
export default function ToolSteps({ steps }: Props) {
  if (steps.length === 0) return null;
  return (
    <ol className="mt-2 flex flex-col gap-2">
      {steps.map((step) => {
        const done = step.status === "done";
        const error = step.status === "error";

        return (
          <li
            key={step.id}
            className={cn(
              "grid min-h-8 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-lg border p-2 text-xs font-medium",
              done &&
              "border-border-success-default text-text-success-onlight",
              error &&
              "border-border-error-default text-text-error-onlight",
              !done &&
              !error &&
              "border-border-default-default text-text-default-onlight",
            )}
          >
            <Icon
              name={done ? "CheckCircle" : error ? "XCircle" : "Sparkle"}
              className={cn(
                "mt-0.5 shrink-0",
                !done &&
                !error &&
                "animate-spin motion-reduce:animate-none",
              )}
            />

            <span className="min-w-0 line-clamp-2 whitespace-normal break-all leading-4">
              {step.label}
            </span>

            {(done || error) && step.ms != null && (
              <span className="shrink-0 whitespace-nowrap text-[8px] leading-4 text-text-default-onlight">
                {formatDuration(step.ms)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
