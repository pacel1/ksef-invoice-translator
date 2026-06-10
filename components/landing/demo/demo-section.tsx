"use client";

import { useState } from "react";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";
import { DEMO_DEFAULT_LANG, type DemoLang } from "@/lib/landing/demo-sample";
import { LanguageChips } from "@/components/landing/demo/language-chips";
import { InvoiceStage } from "@/components/landing/demo/invoice-stage";
import { DownloadGate } from "@/components/landing/demo/download-gate";

export interface DemoSectionProps {
  locale: LandingLocale;
}

export function DemoSection({ locale }: DemoSectionProps) {
  const t = landingCopy[locale].demo;
  const [lang, setLang] = useState<DemoLang>(DEMO_DEFAULT_LANG);
  const [gateOpen, setGateOpen] = useState(false);

  return (
    <section id="demo" className="bg-ink">
      <div className="mx-auto max-w-5xl px-5 py-20 md:px-8 md:py-24">
        <div className="text-center">
          <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-indigo-300">{t.eyebrow}</p>
          <h2 className="mx-auto mt-3 max-w-2xl font-heading text-h2x text-white">{t.heading}</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-white/70">{t.sub}</p>
        </div>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-2">
          <LanguageChips value={lang} onChange={setLang} label={t.languagesLabel} />
          <button
            type="button"
            onClick={() => setGateOpen(true)}
            aria-label={t.moreAria}
            className="rounded-full border border-white/10 bg-ink-panel px-3.5 py-1.5 text-[12px] font-semibold text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            {t.moreLabel}
          </button>
        </div>

        <div className="mt-9">
          <InvoiceStage lang={lang} watermark={t.watermark} />
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          {gateOpen ? (
            <DownloadGate lang={lang} t={t} />
          ) : (
            <button
              type="button"
              onClick={() => setGateOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-[15px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              {t.download}
            </button>
          )}
          <p className="flex items-center gap-2 text-[13px] text-white/60">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" aria-hidden="true" />
            {t.privacy}
          </p>
        </div>
      </div>
    </section>
  );
}

export default DemoSection;
