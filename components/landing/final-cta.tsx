import { landingCopy, type LandingLocale } from "@/lib/landing/copy";
import { TrackedCtaLink } from "@/components/landing/ui/tracked-cta-link";

export interface FinalCtaProps {
  locale: LandingLocale;
}

export function FinalCta({ locale }: FinalCtaProps) {
  const t = landingCopy[locale].finalCta;
  return (
    <section className="relative overflow-hidden bg-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-40%] h-[420px] w-[520px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.28), rgba(217,70,239,0.08) 45%, transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-3xl px-5 py-20 text-center md:px-8 md:py-24">
        <h2 className="font-heading text-h2x text-white">{t.heading}</h2>
        <p className="mx-auto mt-4 max-w-xl font-dm text-[16px] leading-relaxed text-white/70">{t.sub}</p>
        <div className="mt-9">
          <TrackedCtaLink
            href="/login"
            ctaId="final_cta"
            locale={locale}
            className="inline-flex h-[52px] items-center justify-center rounded-[11px] bg-white px-7 font-dm text-[15px] font-semibold text-ink hover:bg-paper-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            {t.cta}
          </TrackedCtaLink>
        </div>
      </div>
    </section>
  );
}

export default FinalCta;
