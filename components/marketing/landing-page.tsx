import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { TrustStrip } from "@/components/trust/trust-strip";
import { PriceSnippet } from "@/components/trust/price-snippet";
import { FounderCard } from "@/components/trust/founder-card";
import { MarketingFAQ } from "@/components/marketing/marketing-faq";
import { PublicPricingSlider } from "@/components/marketing/public-pricing-slider";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";
import { FOUNDER } from "@/lib/brand/founder";

export interface LandingPageProps {
  locale: MarketingLocale;
}

export function LandingPage({ locale }: LandingPageProps) {
  const t = marketingCopy[locale].landing;
  const pricingLabels = {
    packageLabel: marketingCopy[locale].pricing.packageLabel,
    totalLabel: marketingCopy[locale].pricing.totalLabel,
    perInvoiceLabel: marketingCopy[locale].pricing.perInvoiceLabel
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale={locale} />
      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="mx-auto w-full max-w-5xl px-5 py-20 text-center md:px-8 md:py-28">
          <h1 className="text-display text-text-strong">{t.heroHeadline}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-body text-text-muted">{t.heroSubhead}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-6 text-body font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
            >
              {t.heroCtaPrimary}
            </Link>
            <Link
              href="#demo"
              className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-surface px-6 text-body font-medium text-text transition-colors duration-hover ease-out hover:bg-surface-muted"
            >
              {t.heroCtaSecondary}
            </Link>
          </div>
          <div className="mt-6 flex justify-center">
            <PriceSnippet locale={locale} variant="inline" />
          </div>
        </section>

        {/* Live demo strip (static for Sprint 2) */}
        <section id="demo" className="bg-surface-muted">
          <div className="mx-auto max-w-6xl px-5 py-16 md:px-8">
            <h2 className="text-center text-h2 text-text-strong">{t.demoStripHeading}</h2>
            <p className="mt-2 text-center text-small text-text-muted">{t.demoStripCaption}</p>
            <div className="mt-8 rounded-xl border border-border bg-surface p-12 text-center text-small text-text-muted shadow-sm">
              <p className="font-medium text-text-strong">Demo — wkrótce interaktywne</p>
              <p className="mt-2">Tłumaczenia są generowane przez API w czasie rzeczywistym.</p>
            </div>
          </div>
        </section>

        {/* Three value props */}
        <section className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8">
          <h2 className="text-center text-h2 text-text-strong">{t.valueProps.heading}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {t.valueProps.items.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                <CheckCircle2 className="h-6 w-6 text-accent" aria-hidden="true" />
                <h3 className="mt-3 text-h3 text-text-strong">{item.title}</h3>
                <p className="mt-2 text-small text-text">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* TrustStrip */}
        <section className="bg-surface-muted py-12">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <TrustStrip locale={locale} />
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="mx-auto w-full max-w-4xl px-5 py-20 md:px-8">
          <div className="text-center">
            <h2 className="text-h2 text-text-strong">{t.pricingTeaser.heading}</h2>
            <p className="mt-2 text-small text-text-muted">{t.pricingTeaser.sliderLabel}</p>
          </div>
          <div className="mt-8">
            <PublicPricingSlider locale={locale} labels={pricingLabels} />
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/pricing"
              className="inline-flex text-small font-medium text-accent hover:text-accent-hover"
            >
              {t.pricingTeaser.cta} →
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto w-full max-w-3xl px-5 py-20 md:px-8">
          <MarketingFAQ heading={t.faq.heading} items={t.faq.items} />
        </section>

        {/* Founder */}
        <section className="bg-surface-muted py-16">
          <div className="mx-auto max-w-3xl px-5 md:px-8">
            <h2 className="text-center text-h2 text-text-strong">{t.founderHeading}</h2>
            <div className="mt-8">
              <FounderCard
                name={FOUNDER.name}
                photoUrl={FOUNDER.photoUrl}
                statement={FOUNDER.statement}
                contactEmail={FOUNDER.contactEmail}
              />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto w-full max-w-3xl px-5 py-20 text-center md:px-8">
          <h2 className="text-h1 text-text-strong">{t.finalCta.heading}</h2>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-8 text-body font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
            >
              {t.finalCta.cta}
            </Link>
          </div>
        </section>
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
