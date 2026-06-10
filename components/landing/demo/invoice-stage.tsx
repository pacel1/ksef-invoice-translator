"use client";

import { useEffect, useRef, useState } from "react";
import { InvoicePreview } from "@/components/invoice-preview";
import { buildDemoInvoice, type DemoLang } from "@/lib/landing/demo-sample";
import { cn } from "@/lib/utils";

export interface InvoiceStageProps {
  lang: DemoLang;
  watermark: string;
}

/**
 * Renders the demo invoice scaled to fit the dark stage. The full A4 preview is
 * 794px wide; we scale it down and clip the height, fading out the bottom. On a
 * language change we play a brief shimmer, unless the user prefers reduced motion.
 */
export function InvoiceStage({ lang, watermark }: InvoiceStageProps) {
  const [swapping, setSwapping] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    setSwapping(true);
    const t = setTimeout(() => setSwapping(false), 180);
    return () => clearTimeout(t);
  }, [lang]);

  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-raised" style={{ height: 560 }}>
        {/* scaled A4 preview; decorative, the chips + copy carry the meaning */}
        <div
          aria-hidden="true"
          className={cn("transition-opacity duration-150", swapping ? "opacity-0" : "opacity-100")}
          style={{ width: 794, transform: "scale(0.58)", transformOrigin: "top left" }}
        >
          <InvoicePreview invoice={buildDemoInvoice(lang)} language={lang} bilingual={false} translated />
        </div>

        {/* swap shimmer, replays on language change */}
        <div
          aria-hidden="true"
          key={lang}
          className="pointer-events-none absolute inset-x-0 top-0 h-2/3 motion-safe:animate-showcase-scan"
          style={{ background: "linear-gradient(180deg, transparent, rgba(79,70,229,0.10) 60%, rgba(139,92,246,0.18))" }}
        />

        {/* bottom fade so the clipped page edge reads as intentional */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />

        {/* watermark */}
        <span className="pointer-events-none absolute right-4 top-3 text-[10px] font-bold tracking-[0.2em] text-slate-300">
          {watermark}
        </span>
      </div>
    </div>
  );
}

export default InvoiceStage;
