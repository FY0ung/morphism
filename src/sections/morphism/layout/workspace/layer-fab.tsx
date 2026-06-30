"use client";

import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/actionable/IconButtons";

interface Props {
  open: boolean;
  onToggle: () => void;
}

/** Floating button that opens the data-layers panel. */
export default function LayerFab({ open, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <IconButton
      variant="filled"
      color="default"
      size="medium"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={t("morphism.openLayers")}
      className="border border-border-default-default"
    >
      <Icon name="LayersThree"/>
    </IconButton>
  );
}
