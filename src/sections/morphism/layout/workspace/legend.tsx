"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { LAYER_META } from "../../const";
import type { LayersState, ProvinceCount } from "@/types";

interface Props {
  layers: LayersState;
  /** Whether a province-aggregation scenario is active. */
  aggregate?: ProvinceCount[] | null;
  /** Active boundary colour — the SAME resolved token colour the map polygons
   *  use — so the legend swatch matches the active region exactly. */
  boundaryColor?: string | null;
  /** True when the province polygons failed to load (show an empty state). */
  boundariesError?: boolean;
}

/**
 * Bottom-left legend. In aggregation mode it stays compact — only the symbolic
 * layer meanings (province counts live on the map + in the chat chart, NOT
 * here). Otherwise it lists the visible analysis layers.
 */
export default function Legend({
  layers,
  aggregate,
  boundaryColor,
  boundariesError,
}: Props) {
  const { t } = useTranslation();
  const visible = LAYER_META.filter((m) => layers[m.id].visible);
  const isAggregate = Boolean(aggregate && aggregate.length);

  return (
    <div className="absolute bottom-4 left-4 z-50 min-w-47 rounded-2xl border border-border-default-default bg-background-default-default px-4 py-3 shadow-lg">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-default-onlight">
        {t("morphism.legendTitle")}
      </h4>

      {isAggregate ? (
        <ul className="flex flex-col gap-1">
          <li className="flex items-center gap-2 text-xs text-text-default-default">
            <span
              className="size-3 flex-none rounded-full bg-background-primary-default"
              aria-hidden
            />
            {t("morphism.legend.hospitalsPublic")}
          </li>
          <li className="flex items-center gap-2 text-xs text-text-default-default">
            <span
              className={cn(
                "size-3 flex-none rounded-sm border border-border-default-default",
                // Fallback token class when no active region colour is set.
                !boundaryColor && "bg-background-primary-light",
              )}
              // Same resolved token colour as the active map boundary layer.
              style={boundaryColor ? { backgroundColor: boundaryColor } : undefined}
              aria-hidden
            />
            {t("morphism.legend.boundaryData")}
          </li>
          {boundariesError && (
            <li className="text-xs  text-text-error-onlight">
              {t("morphism.boundariesError")}
            </li>
          )}
        </ul>
      ) : visible.length === 0 ? (
        <p className="text-xs text-text-default-disable">
          {t("morphism.legendEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {visible.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 py-0.5 text-xs text-text-default-default"
            >
              <span
                className={cn(
                  "size-3",
                  m.round ? "rounded-full" : "rounded-sm",
                  m.swatchClass,
                )}
                aria-hidden
              />
              {t(m.labelKey as "morphism.layer.hospitals")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
