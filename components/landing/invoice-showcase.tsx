"use client";

import { useEffect, useState } from "react";
import {
  SHOWCASE_ORDER,
  SHOWCASE_LANGS,
  SHOWCASE_FIXED,
  SHOWCASE_CYCLE_MS
} from "@/lib/landing/invoice-showcase";
import { SHOWCASE_QR_ROWS, SHOWCASE_QR_SIZE } from "@/lib/landing/showcase-qr";
import { qrSvgPath } from "@/lib/landing/qr-svg";
import { cn } from "@/lib/utils";

const QR_PATH = qrSvgPath(SHOWCASE_QR_ROWS);

export function InvoiceShowcase() {
  const [index, setIndex] = useState(0);
  const [swapping, setSwapping] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setIndex(1); // static English, no cycle
      return;
    }
    let swapTimer: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setSwapping(true);
      swapTimer = setTimeout(() => {
        setIndex((i) => (i + 1) % SHOWCASE_ORDER.length);
        setSwapping(false);
      }, 180);
    }, SHOWCASE_CYCLE_MS);
    return () => {
      clearInterval(id);
      clearTimeout(swapTimer);
    };
  }, []);

  const code = SHOWCASE_ORDER[index];
  const L = SHOWCASE_LANGS[code];
  const t = cn("transition-all duration-150", swapping ? "-translate-y-[3px] opacity-0" : "translate-y-0 opacity-100");

  return (
    <div className="relative mx-auto w-full max-w-[420px] motion-safe:animate-bob" aria-hidden="true">
      {/* Decorative auto-cycling illustration: hidden from AT (the hero copy carries the message). */}
      {/* stacked-card depth */}
      <div aria-hidden="true" className="absolute -left-3 -top-3 h-full w-full rounded-2xl border border-line bg-paper opacity-60" />
      <div className="relative overflow-hidden rounded-2xl border border-line bg-paper shadow-raised">
        {/* language strip */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-paper-soft px-3.5 py-3">
          {SHOWCASE_ORDER.map((c) => (
            <span
              key={c}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                c === code ? "bg-brand text-white" : "text-copy-muted"
              )}
            >
              {c}
            </span>
          ))}
          <span className="inline-flex w-full items-center justify-end gap-1.5 text-[11px] font-semibold text-mint min-[480px]:ml-auto min-[480px]:w-auto">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-mint text-[9px] text-white" aria-hidden="true">✓</span>
            <span className={t}>{L.status}</span>
          </span>
        </div>

        {/* body */}
        <div className="relative px-5 py-5">
          <div aria-hidden="true" key={index} className="pointer-events-none absolute inset-x-0 top-0 h-3/5 opacity-0 motion-safe:animate-showcase-scan" style={{ background: "linear-gradient(180deg, transparent, rgba(79,70,229,0.10) 60%, rgba(139,92,246,0.18))" }} />

          <div className="mb-3.5 flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand to-iris" aria-hidden="true" />
              <div>
                <div className="font-heading text-[14px] font-bold text-ink">{SHOWCASE_FIXED.seller}</div>
                <div className={cn("text-[10px] uppercase tracking-wide text-copy-muted", t)}>{L.title}</div>
              </div>
            </div>
            {/* Real, scannable QR (encodes HTTPS://TLUMACZKSEF.PL); the white padding doubles as its quiet zone. */}
            <span className="flex h-[42px] w-[42px] rounded-md bg-white p-[3px]" aria-hidden="true">
              <svg
                data-showcase-qr
                viewBox={`0 0 ${SHOWCASE_QR_SIZE} ${SHOWCASE_QR_SIZE}`}
                className="h-full w-full"
                shapeRendering="crispEdges"
              >
                <path d={QR_PATH} fill="#0B1020" />
              </svg>
            </span>
          </div>

          <div className="border-t border-line-soft pt-3">
            {([
              [L.number, SHOWCASE_FIXED.number],
              [L.issue, SHOWCASE_FIXED.issue],
              [L.buyer, SHOWCASE_FIXED.buyer],
              [L.nip, SHOWCASE_FIXED.nip]
            ] as const).map(([label, value], i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
                <span className={cn("text-copy", t)}>{label}</span>
                <span className="font-semibold tabular-nums text-ink">{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-[10px] bg-paper-soft px-3 py-2.5 text-[12.5px]">
            <span className={cn("font-medium text-ink", t)}>{L.item}</span>
            <span className="whitespace-nowrap font-semibold tabular-nums text-ink">
              {SHOWCASE_FIXED.itemAmount} <span className={t}>{L.cur}</span>
            </span>
          </div>

          <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-line-soft pt-3">
            <span className={cn("text-[13px] font-semibold text-ink", t)}>{L.total}</span>
            <span className="whitespace-nowrap font-heading text-[20px] font-bold tabular-nums text-brand">
              {SHOWCASE_FIXED.total} <span className={t}>{L.cur}</span>
            </span>
          </div>

          <span className={cn("mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-line-soft px-2.5 py-1.5 text-[11px] text-copy-muted", t)}>
            {L.lock}
          </span>
        </div>
      </div>
    </div>
  );
}

export default InvoiceShowcase;
