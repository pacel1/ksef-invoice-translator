import { landingCopy, type LandingLocale } from "@/lib/landing/copy";
import { Eyebrow } from "@/components/landing/ui/eyebrow";
import { Button } from "@/components/landing/ui/button";
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
            <span className="bg-gradient-to-r from-iris to-plum bg-clip-text text-transparent">{t.headlineTurn}</span>
          </h1>
          <p className="mt-5 max-w-[34em] text-[clamp(0.95rem,1.4vw,1.05rem)] leading-relaxed text-copy">{t.subline}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button href="#demo" size="lg">{t.ctaPrimary}</Button>
            <Button href="#demo" size="lg" variant="ghost">{t.ctaSecondary}</Button>
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
