"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { LAYER_META } from "../../const";
import { FLOOD_COMPARE_SIDES } from "@/configs/flood-compare";
import type { AdminBoundaryLevel } from "@/hooks";
import type { LayersState, ProvinceCount, SwipeCompare } from "@/types";

// Admin level → its exact legend label, so the legend always states WHICH
// administrative level the boundaries layer is currently showing.
const ADM_LEVEL_KEY = {
  region: "morphism.legend.admRegion",
  province: "morphism.legend.admProvince",
  district: "morphism.legend.admDistrict",
  subdistrict: "morphism.legend.admSubdistrict",
} as const;

interface Props {
  layers: LayersState;
  /** Whether a province-aggregation scenario is active. */
  aggregate?: ProvinceCount[] | null;
  /** Active boundary colour — the SAME resolved token colour the map polygons
   *  use — so the legend swatch matches the active region exactly. */
  boundaryColor?: string | null;
  /** True when the province polygons failed to load (show an empty state). */
  boundariesError?: boolean;
  /** Admin level the manual boundaries layer is rendering, null when off. */
  boundariesLevel?: AdminBoundaryLevel | null;
  /** Active flood year-compare (year A = left, year B = right), else null. */
  swipe?: SwipeCompare | null;
  /** Region-compare rows (label + colour class), else null. */
  compareRegions?: { label: string; swatch: string }[] | null;
  /** Active date-based flood scenario label (e.g. "13 ตุลาคม 2568"), else null. */
  floodDateLabel?: string | null;
  /** True when the flood data shown is a partial sample. */
  floodPartial?: boolean;
  /** Active 5 km flood-proximity analysis (real server-side result): the
   *  RESOLVED snapshot date label + whether that snapshot is partial. */
  floodBuffer?: { dateLabel: string; partial: boolean } | null;
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
  boundariesLevel,
  swipe,
  compareRegions,
  floodDateLabel,
  floodPartial,
  floodBuffer,
}: Props) {
  const { t } = useTranslation();
  const visible = LAYER_META.filter((m) => layers[m.id].visible);
  const isAggregate = Boolean(aggregate && aggregate.length);

  return (
    <div className="absolute bottom-4 left-4 z-50 min-w-47 rounded-2xl border border-border-default-default bg-background-default-default px-4 py-3 shadow-lg">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-default-onlight">
        {t("morphism.legendTitle")}
      </h4>

      {compareRegions && compareRegions.length ? (
        <ul className="flex flex-col gap-1">
          {compareRegions.map((r) => (
            <li
              key={r.label}
              className="flex items-center gap-2 text-xs text-text-default-default"
            >
              <span className={cn("size-3 flex-none rounded-sm", r.swatch)} aria-hidden />
              {r.label}
            </li>
          ))}
        </ul>
      ) : swipe ? (
        <ul className="flex flex-col gap-1">
          <li className="flex items-center gap-2 text-xs text-text-default-default">
            <span
              className={cn(
                "size-3 flex-none rounded-sm",
                FLOOD_COMPARE_SIDES.a.bg,
              )}
              aria-hidden
            />
            {swipe.labelA}
          </li>
          <li className="flex items-center gap-2 text-xs text-text-default-default">
            <span
              className={cn(
                "size-3 flex-none rounded-sm",
                FLOOD_COMPARE_SIDES.b.bg,
              )}
              aria-hidden
            />
            {swipe.labelB}
          </li>
        </ul>
      ) : floodBuffer ? (
        /* 5 km flood-proximity analysis — hospitals / flood areas (with the
           RESOLVED snapshot date) / the 5 km relation, + partial notice. */
        <ul className="flex flex-col gap-1">
          <li className="flex items-center gap-2 text-xs text-text-default-default">
            <span
              className="size-3 flex-none rounded-full bg-background-primary-default"
              aria-hidden
            />
            {t("morphism.layer.hospitals")}
          </li>
          <li className="flex items-center gap-2 text-xs text-text-default-default">
            <span
              className="size-3 flex-none rounded-sm bg-background-info-default"
              aria-hidden
            />
            {t("morphism.legend.floodDate", { date: floodBuffer.dateLabel })}
          </li>
          <li className="flex items-center gap-2 text-xs text-text-default-default">
            <span
              className="size-3 flex-none rounded-sm bg-background-success-default"
              aria-hidden
            />
            {t("morphism.legend.floodBuffer")}
          </li>
          {floodBuffer.partial && (
            <li className="text-xs text-text-default-disable">
              {t("morphism.legend.floodSample")}
            </li>
          )}
        </ul>
      ) : floodDateLabel ? (
        <ul className="flex flex-col gap-1">
          <li className="flex items-center gap-2 text-xs text-text-default-default">
            <span
              className="size-3 flex-none rounded-sm bg-background-info-default"
              aria-hidden
            />
            {t("morphism.layer.flood")}
          </li>
          {floodPartial && (
            <li className="text-xs text-text-default-disable">
              {t("morphism.legend.floodSample")}
            </li>
          )}
        </ul>
      ) : isAggregate ? (
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
              {/* Boundaries: state the EXACT admin level being rendered. */}
              {m.id === "boundaries" && boundariesLevel
                ? t(ADM_LEVEL_KEY[boundariesLevel])
                : t(m.labelKey as "morphism.layer.hospitals")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
