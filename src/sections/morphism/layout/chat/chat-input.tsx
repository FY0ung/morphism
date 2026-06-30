"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/actionable/IconButtons";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

/** Pill text field + send button. */
export default function ChatInput({ onSend, disabled }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };

  return (
    <form
      className="border-t border-border-default-default px-4 pb-4 pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-2 rounded-full border-[1.5px] border-border-default-default bg-background-default-light py-1 pl-4 pr-1 transition-colors focus-within:border-border-primary-default">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("morphism.inputPlaceholder")}
          aria-label={t("morphism.inputPlaceholder")}
          autoComplete="off"
          className="min-h-9 min-w-0 flex-1 bg-transparent text-sm text-text-default-default outline-none placeholder:text-text-default-disable"
        />
        <IconButton
          type="submit"
          variant="filled"
          color="primary"
          size="medium"
          disabled={disabled || value.trim() === ""}
          aria-label={t("morphism.send")}
          className="flex-none transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:!bg-background-default-light disabled:!text-text-default-disable motion-reduce:hover:scale-100"
        >
          <Icon name="Send01" className="size-4" />
        </IconButton>
      </div>
    </form>
  );
}
