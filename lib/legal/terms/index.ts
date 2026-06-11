import type { LegalSection } from "@/components/marketing/legal-doc-layout";
import type { MarketingLocale } from "@/lib/marketing/copy";
import { TERMS_SECTIONS_PL } from "@/lib/legal/terms/pl";
import { TERMS_SECTIONS_EN } from "@/lib/legal/terms/en";

export const TERMS_LAST_UPDATED = "2026-06-11";

export function getTermsSections(locale: MarketingLocale): ReadonlyArray<LegalSection> {
  return locale === "pl" ? TERMS_SECTIONS_PL : TERMS_SECTIONS_EN;
}
