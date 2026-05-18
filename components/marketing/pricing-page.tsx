import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { MarketingFAQ } from "@/components/marketing/marketing-faq";
import { PublicPricingSlider } from "@/components/marketing/public-pricing-slider";
import { PricingLadderTable } from "@/components/marketing/pricing-ladder-table";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface PricingPageProps {
  locale: MarketingLocale;
}

export function PricingPage({ locale }: PricingPageProps) {
  const t = marketingCopy[locale].pricing;
  const sliderLabels = {
    packageLabel: t.packageLabel,
    totalLabel: t.totalLabel,
    perInvoiceLabel: t.perInvoiceLabel
  };
  const ladderLabels = t.ladder;

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale={locale} />
      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-4xl px-5 pt-20 pb-12 text-center md:px-8">
          <h1 className="text-display text-text-strong">{t.heroHeadline}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-body text-text-muted">{t.heroSubhead}</p>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.sliderHeading}</h2>
          <div className="mt-6">
            <PublicPricingSlider locale={locale} labels={sliderLabels} />
          </div>
          <p className="mt-3 text-small text-text-muted">{t.vatNote}</p>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.ladderHeading}</h2>
          <div className="mt-6">
            <PricingLadderTable locale={locale} labels={ladderLabels} />
          </div>
        </section>

        <section className="bg-surface-muted py-16">
          <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
            <h2 className="text-h2 text-text-strong">{t.freeTierHeading}</h2>
            <p className="mt-3 text-body text-text-muted">{t.freeTierBody}</p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl px-5 py-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.includedHeading}</h2>
          <ul className="mt-6 space-y-3">
            {t.included.map((item) => (
              <li key={item} className="flex items-start gap-3 text-body text-text">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-3xl px-5 py-16 md:px-8">
          <MarketingFAQ heading={t.faqHeading} items={t.faq} />
        </section>

        <section className="mx-auto w-full max-w-3xl px-5 py-20 text-center md:px-8">
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-8 text-body font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
          >
            {t.finalCta}
          </Link>
        </section>
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
