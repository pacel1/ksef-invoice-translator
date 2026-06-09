import { landingCopy, type LandingLocale } from "@/lib/landing/copy";

export interface HowItWorksStepsProps {
  locale: LandingLocale;
}

export function HowItWorksSteps({ locale }: HowItWorksStepsProps) {
  const t = landingCopy[locale].howItWorks;
  return (
    <section id="jak-to-dziala" className="bg-paper-soft">
      <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
        <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-brand">{t.eyebrow}</p>
        <h2 className="mt-3 max-w-2xl font-heading text-h2x text-ink">{t.heading}</h2>

        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {t.steps.map((s, i) => (
            <li key={i} className="flex flex-col">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft font-heading text-[18px] font-bold tabular-nums text-brand">
                {i + 1}
              </span>
              <h3 className="mt-4 font-heading text-[18px] font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-copy">{s.body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-[13px] text-copy-muted">{t.footnote}</p>
      </div>
    </section>
  );
}

export default HowItWorksSteps;
