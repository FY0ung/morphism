"use client";

import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/actionable/IconButtons";
import { Button } from "@/components/actionable/Buttons";

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
      <Button
        color="default"
        variant="filled"
        size="medium"
        className="pointer-events-auto border border-border-default-default"
      >
        <Icon name="Clock" />
        <span>{timeActive && timeLabel ? timeLabel : t("morphism.timeAll")}</span>
        {timeActive && (
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
        )}
      </Button>
    </div>
  );
}
