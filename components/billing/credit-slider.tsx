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
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <label htmlFor="slider" className="text-small font-medium text-text">
        {pickPackageLabel}
      </label>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-number-xl font-semibold tabular-nums text-text-strong">{size}</span>
        <span className="text-small text-text-muted">{unitPriceLabel}</span>
      </div>
      <input
        id="slider"
        type="range"
        min={5}
        max={100}
        step={5}
        value={size}
        onChange={(event) => setSize(Number(event.target.value))}
        className="mt-4 w-full cursor-pointer accent-[hsl(var(--accent))]"
      />
      <div className="mt-1 flex justify-between text-micro tabular-nums text-text-muted">
        {ticks.map((tick) => (
          <span key={tick} className={tick === size ? "font-semibold text-text-strong" : ""}>
            {tick}
          </span>
        ))}
      </div>

      <dl className="mt-6 grid gap-2 text-small">
        <div className="flex justify-between">
          <dt className="text-text-muted">{unitPriceLabel}</dt>
          <dd className="font-medium tabular-nums text-text-strong">
            {loading ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : formatter.format(unitNet)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-border pt-2">
          <dt className="text-text-muted">{totalLabel}</dt>
          <dd className="text-lg font-semibold tabular-nums text-text-strong">
            {loading ? "—" : formatter.format(totalNet)}
          </dd>
        </div>
        <div className="flex justify-between text-micro">
          <dt className="text-text-muted">{totalWithTaxLabel}</dt>
          <dd className="tabular-nums text-text-muted">
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

      {error ? <p className="mt-3 text-small text-rose-700">{error}</p> : null}
    </div>
  );
}
