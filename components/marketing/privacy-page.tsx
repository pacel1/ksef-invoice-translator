import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { LegalDocLayout } from "@/components/marketing/legal-doc-layout";
import { getPrivacySections, PRIVACY_LAST_UPDATED } from "@/lib/legal/privacy";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface PrivacyPageProps {
  locale: MarketingLocale;
}

export function PrivacyPage({ locale }: PrivacyPageProps) {
  const t = marketingCopy[locale].privacy;
  const sections = getPrivacySections(locale);

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale={locale} />
      <main className="flex flex-1 flex-col">
        <LegalDocLayout
          title={t.heroHeadline}
          lastUpdatedLabel={t.lastUpdated}
          lastUpdatedDate={PRIVACY_LAST_UPDATED}
          tocHeading={t.tocHeading}
          sections={sections}
        />
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
