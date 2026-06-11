import type { LegalSection } from "@/components/marketing/legal-doc-layout";
import type { MarketingLocale } from "@/lib/marketing/copy";
import { PRIVACY_SECTIONS_PL } from "@/lib/legal/privacy/pl";
import { PRIVACY_SECTIONS_EN } from "@/lib/legal/privacy/en";

export const PRIVACY_LAST_UPDATED = "2026-06-11";

export function getPrivacySections(locale: MarketingLocale): ReadonlyArray<LegalSection> {
  return locale === "pl" ? PRIVACY_SECTIONS_PL : PRIVACY_SECTIONS_EN;
}
