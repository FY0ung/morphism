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

const THEME_OPTIONS: { value: "dark" | "light"; labelKey: string }[] = [
  { value: "dark", labelKey: "morphism.theme.dark" },
  { value: "light", labelKey: "morphism.theme.light" },
];

const optionClass =
  "flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-1.5 py-2 text-[13px] transition-colors hover:bg-background-default-light";

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
        {/* Theme */}
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-default-onlight">
          {t("morphism.theme.title")}
        </h3>
        {THEME_OPTIONS.map((opt) => (
          <label key={opt.value} className={optionClass}>
            <input
              type="radio"
              name="morphismTheme"
              value={opt.value}
              checked={activeTheme === opt.value}
              onChange={() => setTheme(opt.value)}
              className="size-4 accent-background-primary-default"
            />
            <span className="text-text-default-default">
              {t(opt.labelKey as "morphism.theme.dark")}
            </span>
          </label>
        ))}

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
