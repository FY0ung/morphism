"use client";

import { useTranslation } from "react-i18next";
import { SUGGESTION_CHIPS } from "../../const";

interface Props {
  onPick: (text: string) => void;
  disabled?: boolean;
}

/** Single-row, horizontally scrollable example prompts. */
export default function SuggestionChips({ onPick, disabled }: Props) {
  const { t } = useTranslation();

  return (
    <div className="border-t border-border-default-default px-4 py-2">
      <span className="mb-2 block text-xs font-semibold text-text-default-onlight">
        {t("morphism.suggestLabel")}
      </span>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {SUGGESTION_CHIPS.map((key) => {
          const label = t(key);
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onPick(label)}
              className="min-h-8 flex-none whitespace-nowrap rounded-full border border-border-default-onlight px-4 py-1.5 text-[13px] text-text-default-onlight transition-all hover:-translate-y-px hover:border-border-primary-default hover:bg-background-primary-light hover:text-text-primary-onlight disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:hover:translate-y-0"
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
