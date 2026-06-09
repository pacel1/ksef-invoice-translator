import { Lock, Languages } from "lucide-react";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";

export interface PreservedVsTranslatedProps {
  locale: LandingLocale;
}

export function PreservedVsTranslated({ locale }: PreservedVsTranslatedProps) {
  const t = landingCopy[locale].whatStays;
  return (
    <section id="co-zostaje" className="bg-paper">
      <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
        <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-brand">{t.eyebrow}</p>
        <h2 className="mt-3 max-w-2xl font-heading text-h2x text-ink">{t.heading}</h2>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-paper-soft p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink/5 text-ink">
                <Lock className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="font-heading text-[17px] font-semibold text-ink">{t.keptLabel}</h3>
            </div>
            <ul className="mt-4 space-y-2.5">
              {t.kept.map((k, i) => (
                <li key={i} className="flex items-center gap-2.5 text-[14px] text-copy">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink/40" aria-hidden="true" />
                  {k}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-brand/20 bg-brand-soft p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Languages className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="font-heading text-[17px] font-semibold text-ink">{t.translatedLabel}</h3>
            </div>
            <ul className="mt-4 space-y-2.5">
              {t.translated.map((k, i) => (
                <li key={i} className="flex items-center gap-2.5 text-[14px] text-copy">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                  {k}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-[14px] leading-relaxed text-copy-muted">{t.trust}</p>
      </div>
    </section>
  );
}

export default PreservedVsTranslated;
