"use client";

import { useEffect } from "react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import merge from "lodash/merge";
import thLocal from "./project/th.json";
import enLocal from "./project/en.json";
import jaLocal from "./project/ja.json";
import { localStorageGetItem } from "@/lib/utils";
import { resolveUiLang } from "@/lib/locale";
import "dayjs/locale/th";
import "dayjs/locale/en";
import "dayjs/locale/ja";
import dayjs from "dayjs";
import buddhistEra from "dayjs/plugin/buddhistEra";
import LocalizedFormat from "dayjs/plugin/localizedFormat";

dayjs.extend(buddhistEra);
dayjs.extend(LocalizedFormat);

// Stable language for SSR and the FIRST client render (English by default).
// Server and first client paint must agree, so this must not depend on
// localStorage — that is read after mount in the effect below.
const DEFAULT_LANG = "en";

// Initialise i18n exactly once, at module load — never during render. Calling
// init() (or changeLanguage) while rendering makes react-i18next update its
// state mid-render ("Cannot update a component while rendering a different
// component"), and reading localStorage in render diverges server/client text
// (hydration mismatch). Doing it here avoids both.
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: merge({}, enLocal) },
      th: { translation: merge({}, thLocal) },
      ja: { translation: merge({}, jaLocal) },
    },
    lng: DEFAULT_LANG,
    fallbackLng: DEFAULT_LANG,
    debug: false,
    ns: ["translation"],
    defaultNS: "translation",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}
dayjs.locale(DEFAULT_LANG);

const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  // Read the saved language only after mount, then sync i18n + dayjs. Running
  // this in an effect (not during render) keeps the first paint identical to the
  // server; any language change happens client-side, post-hydration.
  useEffect(() => {
    const stored = localStorageGetItem("storage");
    const lang = stored && typeof stored === "object" ? stored.lang : undefined;
    // Default English; honour a saved Thai or Japanese preference. Any unknown
    // value falls back to English (never a broken locale).
    const next = resolveUiLang(lang);
    if (i18n.language !== next) void i18n.changeLanguage(next);
    dayjs.locale(next === "th" ? "th" : next === "ja" ? "ja" : "en-gb");

    // Keep <html lang> in sync so screen readers announce content in the active
    // language (accessibility). This does NOT touch theme or layout direction,
    // and never resets map data. Fires on every switch via i18n's event.
    const syncHtmlLang = (lng: string) => {
      document.documentElement.lang = resolveUiLang(lng);
    };
    syncHtmlLang(next);
    i18n.on("languageChanged", syncHtmlLang);
    return () => i18n.off("languageChanged", syncHtmlLang);
  }, []);

  return <>{children}</>;
};

export default LanguageProvider;
