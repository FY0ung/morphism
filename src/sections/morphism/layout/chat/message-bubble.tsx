"use client";

import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import { MOTION, EASE_OUT } from "@/configs/motion";
import { Button } from "@/components/actionable/Buttons";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { FLOOD_COMPARE_SIDES } from "@/configs/flood-compare";
import type { ChatMessage, SwipeCompare } from "@/types";
import ToolSteps from "./tool-steps";
import ChartCard from "./chart-card";

interface Props {
  message: ChatMessage;
  /** Re-open a closed swipe-compare (compare result cards only). */
  onReopenCompare?: (sel: SwipeCompare) => void;
  /** The swipe-compare currently open on the map (null when closed). */
  activeSwipe?: SwipeCompare | null;
}

export default function MessageBubble({
  message,
  onReopenCompare,
  activeSwipe,
}: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  // Entrance ONLY on mount (fade + slight rise). Updates to an existing
  // message (steps, result text) re-render the same mounted component, so the
  // animation never replays. Reduced motion → instant.
  const entrance = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: reduce ? { opacity: 1 } : { opacity: 1, y: 0 },
    transition: reduce
      ? { duration: 0 }
      : { duration: MOTION.base / 1000, ease: EASE_OUT },
  } as const;

  if (message.role === "user") {
    return (
      <motion.div {...entrance} className="max-w-[94%] self-end">
        <div className="text-sm rounded-2xl rounded-br-sm bg-background-primary-default px-4 py-2 text-text-primary-default font-medium">
          {message.text}
        </div>
      </motion.div>
    );
  }

  const loading = Boolean(message.pending);
  // Compare result card: offer a re-open action once THIS comparison is not
  // the one on the map (i.e. the user closed it or opened a different one).
  const swipeSel = message.swipe;
  const swipeIsOpen = Boolean(
    swipeSel &&
      activeSwipe &&
      activeSwipe.dateA === swipeSel.dateA &&
      activeSwipe.dateB === swipeSel.dateB,
  );

  return (
    <motion.div {...entrance} className="w-full max-w-[94%] self-start">
      <div
        aria-busy={loading}
        className="text-sm rounded-2xl rounded-bl-sm border border-border-default-default bg-background-default-light p-4"
      >
        {/* Identity row (avatar + name) on every AI reply EXCEPT the welcome
            card — the header now carries the Morphism identity, so repeating it
            inside the greeting would duplicate it. Removing the row leaves the
            card's own p-4 top padding, so no empty gap remains. */}
        {message.id !== "greeting" && (
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
        )}

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

        {/* Re-open the swipe comparison this card described. Disabled while it
            is already open, so the card doubles as the "how do I get back?"
            affordance after Close comparison. */}
        {swipeSel && onReopenCompare && !loading && (
          <div className="mt-3">
            <Button
              type="button"
              color="secondary"
              size="small"
              disabled={swipeIsOpen}
              aria-disabled={swipeIsOpen}
              onClick={() => onReopenCompare(swipeSel)}
              className={cn(
                "focus-visible:outline-2 focus-visible:outline-border-primary-default",
                swipeIsOpen && "cursor-default opacity-60",
              )}
            >
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  FLOOD_COMPARE_SIDES.a.bg,
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "-ml-1 size-2.5 rounded-full",
                  FLOOD_COMPARE_SIDES.b.bg,
                )}
                aria-hidden
              />
              {swipeIsOpen
                ? t("morphism.swipe.reopenActive")
                : t("morphism.swipe.reopen")}
            </Button>
          </div>
        )}

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
    </motion.div>
  );
}
