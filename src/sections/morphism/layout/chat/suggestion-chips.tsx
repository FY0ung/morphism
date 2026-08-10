"use client";

import { useTranslation } from "react-i18next";
import { SUGGESTION_CHIPS } from "../../const";
import { Tag } from "@/components/selection/Tag";

interface Props {
  onPick: (text: string) => void;
  disabled?: boolean;
}

/** Single-row, horizontally scrollable example prompts. */
export default function SuggestionChips({ onPick, disabled }: Props) {
  const { t } = useTranslation();

  return (
    // MOBILE: hidden entirely (`hidden`) — `display:none` leaves no residual
    // spacing inside the bottom sheet. Desktop (`md:` and up) is unchanged.
    <div className="hidden flex-col gap-2 border-t border-border-default-default p-4 md:flex">
      <p className="text-xs font-medium text-text-default-onlight">
        {t("morphism.suggestLabel")}
      </p>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {SUGGESTION_CHIPS.map((key) => {
          const label = t(key);
          return (
            <Tag
              key={key}
              variant="outline"
              color="default"
              size="small"
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-disabled={disabled || undefined}
              onClick={() => {
                if (!disabled) onPick(label);
              }}
              onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(label);
                }
              }}
              className={
                disabled
                  ? "cursor-not-allowed opacity-50 transition-opacity"
                  : "cursor-pointer transition-opacity"
              }
            >
              {label}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
