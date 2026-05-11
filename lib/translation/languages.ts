import type { LanguageCode } from "@/types/invoice";

export const supportedLanguages: Record<LanguageCode, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  nl: "Nederlands",
  pt: "Português",
  cs: "Čeština",
  sk: "Slovenčina",
  hu: "Magyar",
  ro: "Română",
  bg: "Български",
  hr: "Hrvatski",
  sl: "Slovenščina",
  lt: "Lietuvių",
  lv: "Latviešu",
  et: "Eesti",
  da: "Dansk",
  sv: "Svenska",
  fi: "Suomi",
  no: "Norsk",
  el: "Ελληνικά"
};

export const languageOptions = Object.entries(supportedLanguages).map(
  ([code, label]) => ({ code: code as LanguageCode, label })
);
