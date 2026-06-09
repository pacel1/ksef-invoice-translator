import type { LandingLocale } from "@/lib/landing/copy";
import { SiteNav } from "@/components/landing/site-nav";
import { Hero } from "@/components/landing/hero";
import { OldWayComparison } from "@/components/landing/old-way-comparison";
import { HowItWorksSteps } from "@/components/landing/how-it-works-steps";
import { PreservedVsTranslated } from "@/components/landing/preserved-vs-translated";
import { AudienceCards } from "@/components/landing/audience-cards";
import { PricingTeaser } from "@/components/landing/pricing-teaser";
import { FaqAccordion } from "@/components/landing/faq-accordion";
import { FinalCta } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";

export interface LandingRebuildProps {
  locale: LandingLocale;
}

export function LandingRebuild({ locale }: LandingRebuildProps) {
  return (
    <div className="flex min-h-screen flex-col bg-paper font-dm text-copy">
      <SiteNav locale={locale} />
      <main className="flex-1">
        <Hero locale={locale} />
        {/* Reserved placeholder for the demo sprint */}
        <section id="demo" aria-hidden="true" />
        <OldWayComparison locale={locale} />
        <HowItWorksSteps locale={locale} />
        <PreservedVsTranslated locale={locale} />
        <AudienceCards locale={locale} />
        <PricingTeaser locale={locale} />
        <FaqAccordion locale={locale} />
      </main>
      <FinalCta locale={locale} />
      <SiteFooter locale={locale} />
    </div>
  );
}

export default LandingRebuild;
