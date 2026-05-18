"use client";

import { useState } from "react";
import { priceForPackage, PACKAGE_SIZES } from "@/lib/billing/pricing";

export interface PublicPricingSliderLabels {
  packageLabel: string;
  totalLabel: string;
  perInvoiceLabel: string;
}

export interface PublicPricingSliderProps {
  locale: "pl" | "en";
  labels: PublicPricingSliderLabels;
  defaultPackageSize?: number;
}

function formatPLN(cents: number, locale: "pl" | "en"): string {
  const amount = cents / 100;
  return locale === "pl"
    ? `${amount.toFixed(2).replace(".", ",")} zł`
    : `PLN ${amount.toFixed(2)}`;
}

const MIN = PACKAGE_SIZES[0];
const MAX = PACKAGE_SIZES[PACKAGE_SIZES.length - 1];

export function PublicPricingSlider({
  locale,
  labels,
  defaultPackageSize = 25
}: PublicPricingSliderProps) {
  const [size, setSize] = useState<number>(defaultPackageSize);
  const quote = priceForPackage(size);

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <p className="text-micro uppercase tracking-wide text-text-muted">
            {labels.packageLabel}
          </p>
          <p className="mt-1 text-number-xl tabular-nums text-text-strong">{size}</p>
        </div>
        <div>
          <p className="text-micro uppercase tracking-wide text-text-muted">
            {labels.totalLabel}
          </p>
          <p className="mt-1 text-h1 tabular-nums text-text-strong">
            {formatPLN(quote.totalAmountCents, locale)}
          </p>
        </div>
        <div>
          <p className="text-micro uppercase tracking-wide text-text-muted">
            {labels.perInvoiceLabel}
          </p>
          <p className="mt-1 text-h1 tabular-nums text-accent">
            {formatPLN(quote.unitPriceCents, locale)}
          </p>
        </div>
      </div>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={5}
        value={size}
        onChange={(e) => setSize(Number(e.target.value))}
        className="mt-6 w-full accent-[hsl(var(--accent))]"
        aria-label={labels.packageLabel}
      />
      <div
        aria-hidden="true"
        className="mt-2 flex justify-between text-micro tabular-nums text-text-muted"
      >
        <span>{`${MIN} →`}</span>
        <span>{`← ${MAX}`}</span>
      </div>
    </div>
  );
}
