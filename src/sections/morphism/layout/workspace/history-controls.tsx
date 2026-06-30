"use client";

import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/actionable/IconButtons";

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const btn =
  "border border-border-default-default !bg-background-default-default shadow-sm transition-colors enabled:hover:border-border-primary-default enabled:hover:text-text-primary-onlight disabled:cursor-not-allowed disabled:text-text-default-disable disabled:opacity-55";

/** Undo / Redo stack controls (top-right of the map). */
export default function HistoryControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Props) {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-col gap-4"
      role="group"
      aria-label={`${t("morphism.undo")} / ${t("morphism.redo")}`}
    >
      <IconButton
        type="button"
        variant="text"
        color="default"
        size="medium"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label={t("morphism.undo")}
        title={t("morphism.undo")}
        className={btn}
      >
        <Icon name="Undo" />
      </IconButton>
      <IconButton
        type="button"
        variant="text"
        color="default"
        size="medium"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label={t("morphism.redo")}
        title={t("morphism.redo")}
        className={btn}
      >
        <Icon name="Redo" />
      </IconButton>
    </div>
  );
}
