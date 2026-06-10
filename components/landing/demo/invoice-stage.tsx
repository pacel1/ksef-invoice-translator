"use client";

import { useEffect, useRef, useState } from "react";
import { InvoicePreview } from "@/components/invoice-preview";
import { buildDemoInvoice, type DemoLang } from "@/lib/landing/demo-sample";
import type { Invoice } from "@/types/invoice";
import { cn } from "@/lib/utils";

export interface InvoiceStageUpload {
  invoice: Invoice;
  /** The language the upload was translated into (may trail the chips if a re-translate failed). */
  lang: DemoLang;
}

export interface InvoiceStageProps {
  lang: DemoLang;
  watermark: string;
  upload?: InvoiceStageUpload | null;
}

// The A4 preview is 794px wide. We scale it to fit the stage width so the whole
// invoice (including the right-hand amounts column) is always visible at every
// breakpoint, and clip the height to a fixed top slice of the page.
const SOURCE_WIDTH = 794;
const VISIBLE_SOURCE_HEIGHT = 965; // top slice of the ~1123px A4 we reveal
const MAX_SCALE = 0.58;

/**
 * Renders the demo invoice scaled to fit the dark stage width (no horizontal
 * clipping of the amounts), clipping the height to a top slice and fading out the
 * bottom. On a language change it plays a brief shimmer, unless the user prefers
 * reduced motion.
 */
export function InvoiceStage({ lang, watermark, upload }: InvoiceStageProps) {
  const [swapping, setSwapping] = useState(false);
  const [scale, setScale] = useState(MAX_SCALE);
  const first = useRef(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fit the preview to the stage width; recompute on resize.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const fit = () => setScale(Math.min(el.clientWidth / SOURCE_WIDTH, MAX_SCALE) || MAX_SCALE);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Brief shimmer on language change (skipped on first render / reduced motion).
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
  }, [lang, upload]);

  return (
    <div ref={wrapRef} className="relative mx-auto w-full max-w-[460px]">
      <div
        className="relative overflow-hidden rounded-2xl bg-white shadow-raised"
        style={{ height: Math.round(VISIBLE_SOURCE_HEIGHT * scale) }}
      >
        {/* scaled A4 preview; decorative, the chips + copy carry the meaning */}
        <div
          aria-hidden="true"
          className={cn("transition-opacity duration-150", swapping ? "opacity-0" : "opacity-100")}
          style={{ width: SOURCE_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <InvoicePreview
            invoice={upload ? upload.invoice : buildDemoInvoice(lang)}
            language={upload ? upload.lang : lang}
            bilingual={false}
            translated
          />
        </div>

        {/* swap shimmer, replays on language change */}
        <div
          aria-hidden="true"
          key={lang}
          className="pointer-events-none absolute inset-x-0 top-0 h-2/3 opacity-0 motion-safe:animate-showcase-scan"
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
