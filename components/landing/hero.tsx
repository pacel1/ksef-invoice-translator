import { landingCopy, type LandingLocale } from "@/lib/landing/copy";
import { Eyebrow } from "@/components/landing/ui/eyebrow";
import { TrackedCtaLink } from "@/components/landing/ui/tracked-cta-link";
import { InvoiceShowcase } from "@/components/landing/invoice-showcase";

export interface HeroProps {
  locale: LandingLocale;
}

export function Hero({ locale }: HeroProps) {
  const t = landingCopy[locale].hero;
  return (
    <section id="hero" className="relative overflow-hidden bg-paper">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-10%] top-[-20%] h-[460px] w-[520px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.16), rgba(217,70,239,0.06) 45%, transparent 70%)" }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 md:px-8 md:py-20 lg:grid-cols-2 lg:items-center lg:gap-14">
        <div>
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h1 className="mt-5 font-heading text-hero text-ink">
            {t.headlineLead}{" "}
            {/* Gradient kept >=3:1 on white for large text (brand ~5.8:1, iris ~3.45:1). */}
            <span className="bg-gradient-to-r from-brand to-iris bg-clip-text text-transparent">{t.headlineTurn}</span>
          </h1>
          <p className="mt-5 max-w-[34em] text-[clamp(0.95rem,1.4vw,1.05rem)] leading-relaxed text-copy">{t.subline}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <TrackedCtaLink
              href="#demo"
              ctaId="hero_primary"
              locale={locale}
              className="inline-flex items-center justify-center gap-2 rounded-[11px] font-dm font-semibold transition-colors duration-150 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-brand text-white shadow-brand hover:bg-brand-hover h-[52px] px-6 text-[15px]"
            >
              {t.ctaPrimary}
            </TrackedCtaLink>
            <TrackedCtaLink
              href="#demo"
              ctaId="hero_secondary"
              locale={locale}
              className="inline-flex items-center justify-center gap-2 rounded-[11px] font-dm font-semibold transition-colors duration-150 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-paper text-ink border border-line hover:bg-paper-soft h-[52px] px-6 text-[15px]"
            >
              {t.ctaSecondary}
            </TrackedCtaLink>
          </div>
          <p className="mt-4 flex items-center gap-2 text-[13px] text-copy-muted">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" aria-hidden="true" />
            {t.reassurance}
          </p>
        </div>
        <div className="lg:justify-self-end">
          <InvoiceShowcase />
        </div>
      </div>
    </section>
  );
}

export default Hero;
