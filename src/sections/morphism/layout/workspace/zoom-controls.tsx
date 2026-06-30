"use client";

import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/actionable/IconButtons";

type MaplibreMap = import("maplibre-gl").Map;

interface Props {
  /** Live map instance (null until the basemap has loaded). */
  map: MaplibreMap | null;
}

/**
 * Custom zoom in/out controls (replaces MapLibre's NavigationControl) so the
 * buttons live in the right-side control column above the Settings gear and
 * reuse the shared IconButton component.
 */
export default function ZoomControls({ map }: Props) {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-col gap-0 border border-border-default-default rounded-full"
      role="group"
      aria-label={t("morphism.zoom")}
    >
      <IconButton
        variant="filled"
        color="default"
        size="medium"
        onClick={() => map?.zoomIn()}
        aria-label={t("morphism.zoomIn")}
        className="rounded-b-none!"
      >
        <Icon name="Plus"/>
      </IconButton>
      <IconButton
        variant="filled"
        color="default"
        size="medium"
        onClick={() => map?.zoomOut()}
        aria-label={t("morphism.zoomOut")}
                className="rounded-t-none!"

      >
        <Icon name="Minus"/>
      </IconButton>
    </div>
  );
}
