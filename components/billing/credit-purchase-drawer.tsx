"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CreditSlider } from "@/components/billing/credit-slider";

export interface CreditSliderLabels {
  pickPackageLabel: string;
  unitPriceLabel: string;
  totalLabel: string;
  totalWithTaxLabel: string;
  continueLabel: string;
}

export interface CreditPurchaseDrawerLabels {
  title: string;
  closeLabel: string;
}

export interface CreditPurchaseDrawerProps {
  sliderLabels: CreditSliderLabels;
  labels: CreditPurchaseDrawerLabels;
}

export function CreditPurchaseDrawer({ sliderLabels, labels }: CreditPurchaseDrawerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("open-credit-drawer", onOpen);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("open-credit-drawer", onOpen);
      window.removeEventListener("keydown", onEsc);
    };
  }, []);

  if (!open) return null;

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 bg-text-strong/30 backdrop-blur-sm"
        aria-hidden="true"
      />
      <aside
        data-drawer-open="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-drawer-title"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-surface shadow-lg"
      >
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id="credit-drawer-title" className="text-h3 text-text-strong">
            {labels.title}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={labels.closeLabel}
            className="rounded-md p-2 text-text-muted hover:bg-surface-muted hover:text-text-strong"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <CreditSlider
            pickPackageLabel={sliderLabels.pickPackageLabel}
            unitPriceLabel={sliderLabels.unitPriceLabel}
            totalLabel={sliderLabels.totalLabel}
            totalWithTaxLabel={sliderLabels.totalWithTaxLabel}
            continueLabel={sliderLabels.continueLabel}
          />
        </div>
      </aside>
    </>
  );
}
