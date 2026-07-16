"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/actionable/IconButtons";
import { useMounted } from "@/hooks";
import { cn, localStorageGetItem, localStorageSetItem } from "@/lib/utils";
import { resolveUiLang, type UiLang } from "@/lib/locale";
import dayjs from "dayjs";
import { motion, useReducedMotion } from "motion/react";
import type { LayoutDirection } from "@/types";

// Locale code `ja` shown compactly as "JP" to match the EN/TH pill style.
type LangCode = UiLang;

const LANG_OPTIONS: { value: LangCode; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "th", label: "TH" },
  { value: "ja", label: "JP" },
];

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

/**
 * Accessible animated radio: a native (visually-hidden) input drives the ring
 * fill + a spring-like dot that scales in on check. Token-only colours; honours
 * keyboard focus and prefers-reduced-motion.
 */
function AnimatedRadio({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  const reduce = useReducedMotion();
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-background-default-light">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={cn(
          "relative grid size-5 flex-none place-items-center rounded-full border-2 transition-colors duration-200",
          checked
            ? "border-transparent bg-background-primary-default"
            : "border-border-primary-default bg-background-default-default",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-border-primary-default peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background-default-default",
        )}
      >
        {/* Inner dot: elastic spring pop on select (overshoots, then settles). */}
        <motion.span
          initial={false}
          animate={{ scale: checked ? 1 : 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", stiffness: 600, damping: 15 }
          }
          className="size-2 rounded-full bg-background-default-default"
        />
      </span>
      <span className="text-[13px] text-text-default-default">{label}</span>
    </label>
  );
}

/**
 * Segmented language switch: a full-width pill with a spring-slid highlight
 * (shared `layoutId`) that glides under the active option. Token-only colours.
 */
function LanguageSwitch({
  value,
  onChange,
  ariaLabel,
}: {
  value: LangCode;
  onChange: (lng: LangCode) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="mb-3 inline-flex rounded-full border border-border-default-default bg-background-default-light p-1"
    >
      {LANG_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className="relative rounded-full px-4 py-1.5 text-center text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-border-primary-default"
          >
            {active && (
              <motion.span
                layoutId="langSwitchKnob"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-full bg-background-primary-default shadow-sm"
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 transition-colors",
                active
                  ? "text-text-primary-default"
                  : "text-text-default-onlight",
              )}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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
  const { t, i18n } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  // Default to dark for SSR/first paint to avoid hydration mismatch.
  const activeTheme = mounted ? resolvedTheme ?? "dark" : "dark";
  // Language matches SSR/first paint ("en") until mounted, then reflects i18n.
  const activeLang: LangCode = mounted ? resolveUiLang(i18n.language) : "en";

  const changeLanguage = (lng: LangCode) => {
    void i18n.changeLanguage(lng);
    dayjs.locale(lng === "th" ? "th" : lng === "ja" ? "ja" : "en");
    const stored = localStorageGetItem("storage");
    const base = stored && typeof stored === "object" ? stored : {};
    localStorageSetItem("storage", { ...base, lang: lng });
  };

  // Close on outside click or Escape (only while open).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onToggle();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onToggle();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onToggle]);

  return (
    <div ref={rootRef} className="contents">
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

        {/* Language */}
        <h3 className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-text-default-onlight">
          {t("morphism.language.title")}
        </h3>
        <LanguageSwitch
          value={activeLang}
          onChange={changeLanguage}
          ariaLabel={t("morphism.language.title")}
        />

        {/* Layout direction */}
        <h3 className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-text-default-onlight">
          {t("morphism.settingsTitle")}
        </h3>
        <div
          role="radiogroup"
          aria-label={t("morphism.settingsTitle")}
          className="flex flex-col gap-0.5"
        >
          {DIR_OPTIONS.map((opt) => (
            <AnimatedRadio
              key={opt.value}
              name="layoutDir"
              checked={direction === opt.value}
              onChange={() => onChange(opt.value)}
              label={t(opt.labelKey as "morphism.dir.ltr")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
