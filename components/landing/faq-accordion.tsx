import { ChevronDown } from "lucide-react";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";

export interface FaqAccordionProps {
  locale: LandingLocale;
}

export function FaqAccordion({ locale }: FaqAccordionProps) {
  const t = landingCopy[locale].faq;
  return (
    <section id="faq" className="bg-paper-soft">
      <div className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-20">
        <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-brand">{t.eyebrow}</p>
        <h2 className="mt-3 font-heading text-h2x text-ink">{t.heading}</h2>

        <div className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
          {t.items.map((item) => (
            <details key={item.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-dm text-[15px] font-semibold text-ink">
                <span>{item.q}</span>
                <ChevronDown className="h-5 w-5 shrink-0 text-copy-muted transition-transform duration-150 ease-out group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-copy">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FaqAccordion;
