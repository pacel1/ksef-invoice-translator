import type { LanguageCode } from "@/types/invoice";

export const supportedLanguages: Record<LanguageCode, string> = {
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  nl: "Dutch",
  pt: "Portuguese",
  cs: "Czech",
  sk: "Slovak",
  hu: "Hungarian",
  ro: "Romanian",
  bg: "Bulgarian",
  hr: "Croatian",
  sl: "Slovenian",
  lt: "Lithuanian",
  lv: "Latvian",
  et: "Estonian",
  da: "Danish",
  sv: "Swedish",
  fi: "Finnish",
  no: "Norwegian",
  el: "Greek"
};

export const languageNamesByUi = {
  pl: {
    en: "angielski",
    de: "niemiecki",
    fr: "francuski",
    es: "hiszpański",
    it: "włoski",
    nl: "niderlandzki",
    pt: "portugalski",
    cs: "czeski",
    sk: "słowacki",
    hu: "węgierski",
    ro: "rumuński",
    bg: "bułgarski",
    hr: "chorwacki",
    sl: "słoweński",
    lt: "litewski",
    lv: "łotewski",
    et: "estoński",
    da: "duński",
    sv: "szwedzki",
    fi: "fiński",
    no: "norweski",
    el: "grecki"
  },
  en: supportedLanguages
} satisfies Record<"pl" | "en", Record<LanguageCode, string>>;

export const translationTargets = supportedLanguages;

export function getLanguageOptions(uiLanguage: keyof typeof languageNamesByUi) {
  const names = languageNamesByUi[uiLanguage];
  return Object.entries(names).map(([code, label]) => ({ code: code as LanguageCode, label }));
}
