import { X, Check } from "lucide-react";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";

export interface OldWayComparisonProps {
  locale: LandingLocale;
}

export function OldWayComparison({ locale }: OldWayComparisonProps) {
  const t = landingCopy[locale].whyOldWay;
  return (
    <section id="dlaczego" className="bg-paper">
      <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
        <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-brand">{t.eyebrow}</p>
        <h2 className="mt-3 max-w-3xl font-heading text-h2x text-ink">{t.heading}</h2>

        <ul className="mt-10 space-y-3">
          {t.problems.map((p, i) => (
            <li key={i} className="flex items-start gap-4 rounded-2xl border border-line bg-paper-soft p-5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-negative/10 text-negative">
                <X className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="font-dm font-semibold text-ink">{p.action}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-copy">{p.consequence}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-start gap-4 rounded-2xl border border-brand/30 bg-brand-soft p-5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint/15 text-mint">
            <Check className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="font-dm text-[15px] font-medium text-ink">{t.resolution}</p>
        </div>
      </div>
    </section>
  );
}

export default OldWayComparison;
