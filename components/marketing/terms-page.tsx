import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { LegalDocLayout } from "@/components/marketing/legal-doc-layout";
import { getTermsSections, TERMS_LAST_UPDATED } from "@/lib/legal/terms";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface TermsPageProps {
  locale: MarketingLocale;
}

export function TermsPage({ locale }: TermsPageProps) {
  const t = marketingCopy[locale].terms;
  const sections = getTermsSections(locale);

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale={locale} />
      <main className="flex flex-1 flex-col">
        <LegalDocLayout
          title={t.heroHeadline}
          lastUpdatedLabel={t.lastUpdated}
          lastUpdatedDate={TERMS_LAST_UPDATED}
          tocHeading={t.tocHeading}
          sections={sections}
        />
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
