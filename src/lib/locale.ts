// Single source of truth for the supported UI locales and the fallback rule.
// Pure + isomorphic (no React/browser APIs) so the language provider, the
// settings switch, and the test suite all resolve a locale the SAME way — an
// unknown/undefined value always falls back to English, never a broken locale.
import type { DateLang } from "@/lib/flood-date";

/** UI locales, in selector order. `ja` is displayed compactly as "JP". */
export type UiLang = DateLang; // "en" | "th" | "ja"

export const UI_LANGS: readonly UiLang[] = ["en", "th", "ja"] as const;

/** Resolve any stored/i18n value to a supported locale (unknown → "en"). */
export function resolveUiLang(value: unknown): UiLang {
  return value === "th" ? "th" : value === "ja" ? "ja" : "en";
}
