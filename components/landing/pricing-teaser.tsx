import { Check } from "lucide-react";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";
import { Button } from "@/components/landing/ui/button";

export interface PricingTeaserProps {
  locale: LandingLocale;
}

export function PricingTeaser({ locale }: PricingTeaserProps) {
  const t = landingCopy[locale].pricing;
  return (
    <section id="cennik" className="bg-paper">
      <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
        <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-brand">{t.eyebrow}</p>
        <h2 className="mt-3 max-w-2xl font-heading text-h2x text-ink">{t.heading}</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-copy">{t.sub}</p>

        <div className="mt-10 grid gap-8 md:grid-cols-2 md:items-center">
          <ul className="space-y-3">
            {t.promises.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-[14px] text-copy">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint/15 text-mint">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>

          <div className="rounded-2xl border border-line bg-paper-soft p-6">
            <p className="font-dm text-[13px] font-medium text-copy-muted">{t.ladderLabel}</p>
            <ul className="mt-4 space-y-2.5">
              {t.ladder.map((row, i) => {
                const highlight = i === t.ladder.length - 1;
                return (
                  <li
                    key={row.size}
                    className={
                      highlight
                        ? "flex items-center justify-between rounded-xl border border-brand/30 bg-brand-soft px-4 py-3"
                        : "flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-3"
                    }
                  >
                    <span className="font-dm text-[14px] text-ink">
                      <span className="font-semibold tabular-nums">{row.size}</span> {t.packUnit}
                    </span>
                    <span className="flex items-baseline gap-1">
                      <span className={highlight ? "font-heading text-[16px] font-bold tabular-nums text-brand" : "font-heading text-[15px] font-semibold tabular-nums text-ink"}>
                        {row.perInvoice}
                      </span>
                      <span className="font-dm text-[12px] font-normal text-copy-muted">{t.perInvoiceLabel}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-copy-muted">{t.note}</p>
          <Button href={t.ctaHref} variant="ghost">{t.cta}</Button>
        </div>
      </div>
    </section>
  );
}

export default PricingTeaser;
