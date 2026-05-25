import Link from "next/link";
import { Globe2, ShieldCheck, Zap } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { TrustStrip } from "@/components/trust/trust-strip";
import { FounderCard } from "@/components/trust/founder-card";
import { MarketingFAQ } from "@/components/marketing/marketing-faq";
import { PublicPricingSlider } from "@/components/marketing/public-pricing-slider";
import { HeroSection } from "@/components/ui/hero-section-9";
import { AnimatedTestimonials } from "@/components/ui/animated-testimonials";
import {
  FeaturesSection,
  FieldMappingIllustration,
  PricingTiersIllustration,
  DataResidencyIllustration
} from "@/components/ui/features-section";
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
        <HeroSection
          title={t.heroHeadline}
          subtitle={t.heroSubhead}
          note={t.heroFreeNote}
          actions={[
            {
              text: t.heroCtaPrimary,
              href: "/login",
              variant: "default",
              className: "shadow-sm"
            },
            {
              text: t.heroCtaSecondary,
              href: "#features",
              variant: "outline"
            }
          ]}
          stats={[
            {
              value: "20+",
              label: locale === "pl" ? "języków docelowych" : "target languages",
              icon: <Globe2 className="h-5 w-5" aria-hidden="true" />
            },
            {
              value: "MF FA(3)",
              label: locale === "pl" ? "zgodny ze schematem" : "schema compliant",
              icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            },
            {
              value: "~4 s",
              label: locale === "pl" ? "średnio na fakturę" : "average per invoice",
              icon: <Zap className="h-5 w-5" aria-hidden="true" />
            }
          ]}
          images={[
            { src: "/marketing/invoice-pl.svg", alt: "Polska faktura FA(3) — oryginał" },
            { src: "/marketing/invoice-en.svg", alt: "English translation — same invoice" }
          ]}
          translationLabel="4 s"
        />

        {/* Features — 1 hero card + 2 small cards */}
        <div id="features" />
        <FeaturesSection
          headingMuted={t.features.headingMuted}
          headingAccent={t.features.headingAccent}
          items={[
            {
              title: t.features.items.fieldMapping.title,
              body: t.features.items.fieldMapping.body,
              illustration: <FieldMappingIllustration />,
              hero: true
            },
            {
              title: t.features.items.pricing.title,
              body: t.features.items.pricing.body,
              illustration: <PricingTiersIllustration />
            },
            {
              title: t.features.items.residency.title,
              body: t.features.items.residency.body,
              illustration: <DataResidencyIllustration />
            }
          ]}
        />

        {/* Testimonials */}
        <AnimatedTestimonials
          badgeText={t.testimonials.badge}
          title={t.testimonials.heading}
          subtitle={t.testimonials.subhead}
          testimonials={t.testimonials.items}
        />

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
