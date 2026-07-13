"use client";

import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/actionable/IconButtons";
import { useMounted } from "@/hooks";
import { cn } from "@/lib/utils";
import type { LayoutDirection } from "@/types";

interface Props {
  open: boolean;
  onToggle: () => void;
  direction: LayoutDirection;
  onChange: (dir: LayoutDirection) => void;
}

const DIR_OPTIONS: { value: LayoutDirection; labelKey: string }[] = [
  { value: "ltr", labelKey: "morphism.dir.ltr" },
  { value: "rtl", labelKey: "morphism.dir.rtl" },
];

interface ThemeCard {
  value: "dark" | "light" | "colorblind";
  labelKey: string;
  descKey: string;
  disabled?: boolean;
}

const THEME_CARDS: ThemeCard[] = [
  { value: "dark", labelKey: "morphism.theme.dark", descKey: "morphism.theme.darkDesc" },
  { value: "light", labelKey: "morphism.theme.light", descKey: "morphism.theme.lightDesc" },
  {
    value: "colorblind",
    labelKey: "morphism.theme.colorblind",
    descKey: "morphism.theme.colorblindDesc",
    disabled: true,
  },
];

const optionClass =
  "flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-1.5 py-2 text-[13px] transition-colors hover:bg-background-default-light";

/** Illustrative, non-interactive theme preview thumbnail (token-only). */
function ThemeThumb({ value }: { value: ThemeCard["value"] }) {
  const shell =
    "relative flex size-11 flex-none items-center justify-center overflow-hidden rounded-lg border border-border-default-default";
  if (value === "dark") {
    return (
      <span className={cn(shell, "bg-background-primary-default")} aria-hidden>
        <Icon name="Moon01" className="size-5 text-text-primary-default" />
      </span>
    );
  }
  if (value === "light") {
    return (
      <span className={cn(shell, "bg-background-default-light")} aria-hidden>
        <Icon name="Sun" className="size-5 text-text-warning-onlight" />
      </span>
    );
  }
  // Color-blindness: a two-tone split swatch (colour-vision palette).
  return (
    <span className={cn(shell, "bg-background-default-light")} aria-hidden>
      <span className="absolute inset-y-0 left-0 w-1/2 bg-background-info-default" />
      <span className="absolute inset-y-0 right-0 w-1/2 bg-background-secondary-default" />
    </span>
  );
}

/** Gear button + popover: theme (dark/light) and chat/map layout direction. */
export default function SettingsPopover({
  open,
  onToggle,
  direction,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  // Default to dark for SSR/first paint to avoid hydration mismatch.
  const activeTheme = mounted ? resolvedTheme ?? "dark" : "dark";

  return (
    <>
      <IconButton
        variant="filled"
        color="default"
        size="medium"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={t("morphism.openSettings")}
        className="border border-border-default-default"
      >
        <Icon name="Settings02" />
      </IconButton>

      <div
        role="dialog"
        aria-label={t("morphism.settingsAria")}
        aria-hidden={!open}
        className={cn(
          "absolute right-12 bottom-12 z-50 w-75 origin-bottom-right rounded-2xl border border-border-default-default bg-background-default-default p-3 shadow-xl transition-[opacity,transform] duration-200",
          open ? "opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
      >
        {/* Theme — selectable cards (no radio inputs) */}
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-default-onlight">
          {t("morphism.theme.title")}
        </h3>
        <div role="radiogroup" aria-label={t("morphism.theme.title")} className="flex flex-col gap-1.5">
          {THEME_CARDS.map((card) => {
            const active = !card.disabled && activeTheme === card.value;
            return (
              <button
                key={card.value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-disabled={card.disabled}
                disabled={card.disabled}
                onClick={() => {
                  if (!card.disabled) setTheme(card.value);
                }}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-border-primary-default focus-visible:ring-offset-1 focus-visible:ring-offset-background-default-default motion-reduce:transition-none",
                  card.disabled
                    ? "cursor-not-allowed border-border-default-default bg-background-default-default opacity-60"
                    : active
                      ? "cursor-pointer border-border-primary-default bg-background-primary-light"
                      : "cursor-pointer border-border-default-default bg-background-default-default hover:border-border-primary-onlight hover:bg-background-default-light",
                )}
              >
                <ThemeThumb value={card.value} />

                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-text-default-default">
                    {t(card.labelKey as "morphism.theme.dark")}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-text-default-onlight">
                    {t(card.descKey as "morphism.theme.darkDesc")}
                  </span>
                  {card.disabled && (
                    <span className="mt-1.5 inline-flex items-center rounded-full border border-border-default-default bg-background-default-light px-2 py-0.5 text-[10px] font-medium text-text-default-onlight">
                      {t("morphism.theme.comingSoon")}
                    </span>
                  )}
                </span>

                {active && (
                  <span
                    className="flex size-5 flex-none items-center justify-center rounded-full bg-background-primary-default"
                    aria-label={t("morphism.theme.selected")}
                  >
                    <Icon name="Check" className="size-3 text-text-primary-default" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Layout direction */}
        <h3 className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-text-default-onlight">
          {t("morphism.settingsTitle")}
        </h3>
        {DIR_OPTIONS.map((opt) => (
          <label key={opt.value} className={optionClass}>
            <input
              type="radio"
              name="layoutDir"
              value={opt.value}
              checked={direction === opt.value}
              onChange={() => onChange(opt.value)}
              className="size-4 accent-background-primary-default"
            />
            <span className="text-text-default-default">
              {t(opt.labelKey as "morphism.dir.ltr")}
            </span>
          </label>
        ))}
      </div>
    </>
  );
}
