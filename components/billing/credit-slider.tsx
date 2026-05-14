"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PACKAGE_SIZES } from "@/lib/billing/pricing";

interface PriceQuote {
  packageSize: number;
  unitPriceCents: number;
  totalAmountCents: number;
  currency: string;
}

export interface CreditSliderProps {
  pickPackageLabel: string;
  unitPriceLabel: string;
  totalLabel: string;
  totalWithTaxLabel: string;
  continueLabel: string;
}

const VAT_RATE = 0.23;
const formatter = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

export function CreditSlider({
  pickPackageLabel,
  unitPriceLabel,
  totalLabel,
  totalWithTaxLabel,
  continueLabel
}: CreditSliderProps) {
  const [size, setSize] = useState(25);
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/billing/price?packageSize=${size}`);
        if (!res.ok) {
          throw new Error("Price unavailable");
        }
        const payload = (await res.json()) as PriceQuote;
        if (!cancelled) setQuote(payload);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Price unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [size]);

  const totalNet = quote ? quote.totalAmountCents / 100 : 0;
  const totalGross = totalNet * (1 + VAT_RATE);
  const unitNet = quote ? quote.unitPriceCents / 100 : 0;

  const ticks = useMemo(() => PACKAGE_SIZES.filter((n) => n % 25 === 0 || n === 5), []);

  async function onContinue() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageSize: size })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Checkout failed");
      }
      window.location.href = payload.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setCreating(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <label htmlFor="slider" className="text-sm font-medium text-slate-700">
        {pickPackageLabel}
      </label>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-5xl font-semibold tabular-nums text-slate-950">{size}</span>
        <span className="text-sm text-slate-500">{unitPriceLabel}</span>
      </div>
      <input
        id="slider"
        type="range"
        min={5}
        max={100}
        step={5}
        value={size}
        onChange={(event) => setSize(Number(event.target.value))}
        className="mt-4 w-full cursor-pointer accent-cyan-700"
      />
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        {ticks.map((tick) => (
          <span key={tick} className={tick === size ? "font-semibold text-slate-900" : ""}>
            {tick}
          </span>
        ))}
      </div>

      <dl className="mt-6 grid gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">{unitPriceLabel}</dt>
          <dd className="font-medium text-slate-900">
            {loading ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : formatter.format(unitNet)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-2">
          <dt className="text-slate-500">{totalLabel}</dt>
          <dd className="text-lg font-semibold text-slate-950 tabular-nums">
            {loading ? "—" : formatter.format(totalNet)}
          </dd>
        </div>
        <div className="flex justify-between text-xs">
          <dt className="text-slate-400">{totalWithTaxLabel}</dt>
          <dd className="text-slate-500 tabular-nums">
            {loading ? "—" : formatter.format(totalGross)}
          </dd>
        </div>
      </dl>

      <Button
        className="mt-6 w-full"
        onClick={onContinue}
        disabled={creating || loading || !quote}
      >
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {continueLabel}
      </Button>

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
