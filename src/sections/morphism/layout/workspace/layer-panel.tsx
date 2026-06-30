"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { LAYER_META } from "../../const";
import type { LayerId, LayersState } from "@/types";

interface Props {
  open: boolean;
  layers: LayersState;
  onToggle: (id: LayerId) => void;
}

/** Data-layers panel — checkbox per layer with an "AI" badge when AI-enabled. */
export default function LayerPanel({ open, layers, onToggle }: Props) {
  const { t } = useTranslation();

  return (
    <div className={cn(
        "absolute right-12 top-0 z-50 w-75 origin-top-right rounded-2xl border border-border-default-default bg-background-default-default p-4 shadow-xl transition-[opacity,transform] duration-200",
        open
          ? "opacity-100"
          : "pointer-events-none scale-95 opacity-0",
      )}
      role="group"
      aria-label={t("morphism.layersTitle")}
      aria-hidden={!open}
    >
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-default-onlight">
        {t("morphism.layersTitle")}
      </h3>
      {LAYER_META.map((meta) => {
        const state = layers[meta.id];
        return (
          <label
            key={meta.id}
            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-1.5 py-2 text-[13px] transition-colors hover:bg-background-default-light"
          >
            <input
              type="checkbox"
              checked={state.visible}
              onChange={() => onToggle(meta.id)}
              className="size-4 accent-background-primary-default"
            />
            <span
              className={cn(
                "size-3 flex-none",
                meta.round ? "rounded-full" : "rounded-sm",
                meta.swatchClass,
              )}
              aria-hidden
            />
            <span className="flex-1 text-text-default-default">
              {t(meta.labelKey as "morphism.layer.hospitals")}
            </span>
            {state.visible && state.byAI && (
              <span className="rounded-sm bg-background-secondary-default px-1.5 py-px text-[10px] font-bold text-text-secondary-default">
                {t("morphism.aiMark")}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
