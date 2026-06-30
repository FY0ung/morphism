"use client";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ToolStep } from "@/types";

interface Props {
  steps: ToolStep[];
}

/** The "AI is calling tools" timeline shown inside an assistant bubble. */
export default function ToolSteps({ steps }: Props) {
  if (steps.length === 0) return null;
  return (
    <ol className="mt-2 flex flex-col gap-1.5">
      {steps.map((step) => {
        const done = step.status === "done";
        return (
          <li
            key={step.id}
            className={cn(
              "flex min-h-8 items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-xs",
              done
                ? "border-border-success-default text-text-success-onlight"
                : "border-border-default-default text-text-default-onlight",
            )}
          >
            <Icon
              name={done ? "CheckCircle" : "Sparkle"}
              className={cn(
                "size-3.5",
                !done && "animate-spin motion-reduce:animate-none",
              )}
            />
            <span className="truncate">{step.label}</span>
            {done && step.ms != null && (
              <span className="ml-auto text-[10px] text-text-default-disable">
                {step.ms}ms
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
