"use client";

import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/actionable/IconButtons";

interface Props {
  timeActive: boolean;
  /** Time-range label shown when a scenario sets a filter (e.g. Songkran). */
  timeLabel?: string | null;
  onClearTime: () => void;
}

/** Top overlay: time-filter pill (left). The AI-context chip now lives in the
 *  right-side control column (see MorphismView). */
export default function MapTopBar({
  timeActive,
  timeLabel,
  onClearTime,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-50 flex items-start gap-2">
      {/* Status pill, NOT a control: it never had an onClick, and rendering it
          as <Button> nested the real clear-IconButton <button> inside another
          <button> — invalid HTML that caused a React hydration error. A <div>
          with the exact same utility classes (Button filled/default/medium)
          keeps the appearance identical; the clear button stays a real button. */}
      <div
        className="inline-flex text-nowrap gap-2 items-center justify-center rounded-full bg-background-default-default text-text-default-default hover:bg-background-default-hover h-10 px-4 text-sm pointer-events-auto border border-border-default-default"
        role="status"
      >
        <Icon name="Clock" />
        <span>{timeActive && timeLabel ? timeLabel : t("morphism.timeAll")}</span>
        {/* {timeActive && (
          <IconButton
            color="default"
            variant="text"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onClearTime();
            }}
            aria-label={t("morphism.clearTime")}
            className="pointer-events-auto"
          >
            <Icon name="XClose" />
          </IconButton>
        )} */}
      </div>
    </div>
  );
}
