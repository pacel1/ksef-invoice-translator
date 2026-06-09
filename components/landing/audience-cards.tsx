import { Store, Calculator } from "lucide-react";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";

export interface AudienceCardsProps {
  locale: LandingLocale;
}

const ICONS = [Store, Calculator];

export function AudienceCards({ locale }: AudienceCardsProps) {
  const t = landingCopy[locale].builtForTwo;
  return (
    <section id="dla-kogo" className="bg-paper-soft">
      <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
        <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-brand">{t.eyebrow}</p>
        <h2 className="mt-3 max-w-2xl font-heading text-h2x text-ink">{t.heading}</h2>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {t.lanes.map((lane, i) => {
            const Icon = ICONS[i] ?? Store;
            return (
              <div key={i} className="rounded-2xl border border-line bg-paper p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-heading text-[18px] font-semibold text-ink">{lane.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-copy">{lane.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default AudienceCards;
