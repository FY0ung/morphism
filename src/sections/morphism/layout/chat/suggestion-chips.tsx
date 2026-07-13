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
    <div className="flex flex-col gap-2 border-t border-border-default-default p-4">
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
              onClick={() => onPick(label)}
              // disabled={disabled}
            >
              {label}

            </Tag>
          );
        })}
      </div>
    </div>
  );
}
