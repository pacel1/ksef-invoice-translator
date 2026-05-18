import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { LegalDocLayout } from "@/components/marketing/legal-doc-layout";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

const LAST_UPDATED = "2026-05-18";

export interface PrivacyPageProps {
  locale: MarketingLocale;
}

export function PrivacyPage({ locale }: PrivacyPageProps) {
  const t = marketingCopy[locale].privacy;
  const sections = [
    { id: "wstep", title: t.placeholderHeading, content: t.placeholderBody }
  ];

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale={locale} />
      <main className="flex flex-1 flex-col">
        <LegalDocLayout
          title={t.heroHeadline}
          lastUpdatedLabel={t.lastUpdated}
          lastUpdatedDate={LAST_UPDATED}
          tocHeading={t.tocHeading}
          sections={sections}
        />
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
