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
      // MOBILE: tighter padding + safe-area inset so the control clears the
      // home indicator inside the bottom sheet. Desktop padding unchanged (p-4).
      className="flex-none border-t border-border-default-default px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:p-4 md:pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {/* MOBILE: 40px total control height (h-10, tighter padding + smaller
          send button). Desktop keeps the accepted 56px pill (md:h-14!, p-2). */}
      <div className="flex h-10! items-center gap-2 rounded-full border-2 border-border-default-default bg-background-default-light py-0 pl-3 pr-1 transition-colors focus-within:border-border-primary-default md:h-14! md:p-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("morphism.inputPlaceholder")}
          aria-label={t("morphism.inputPlaceholder")}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm text-text-default-default outline-none placeholder:text-text-default-disable md:min-h-9"
        />
        <IconButton
          type="submit"
          variant="filled"
          color="primary"
          size="medium"
          // MOBILE: 32px so the button sits comfortably inside the 40px pill
          // (4px breathing room top/bottom). DESKTOP: 40px — identical to the
          // `medium` preset, so the desktop button is unchanged.
          sizeClassName="size-8 md:size-10"
          disabled={disabled || value.trim() === ""}
          aria-label={t("morphism.send")}
          className="flex-none transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:bg-background-default-light! disabled:text-text-default-disable! motion-reduce:hover:scale-100"
        >
          <Icon name="Send01"/>
        </IconButton>
      </div>
    </form>
  );
}
