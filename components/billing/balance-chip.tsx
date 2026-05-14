"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

export interface BalanceChipProps {
  initialFree: number;
  initialPaid: number;
  /** "Free credit" or "Darmowy kredyt" */
  freeLabel: string;
  /** "credits" or "kredytów" */
  paidLabel: string;
}

interface BalanceResponse {
  freeCreditsRemaining: number;
  paidCredits: number;
}

export function BalanceChip({ initialFree, initialPaid, freeLabel, paidLabel }: BalanceChipProps) {
  const [free, setFree] = useState(initialFree);
  const [paid, setPaid] = useState(initialPaid);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function refetch() {
      setRefreshing(true);
      try {
        const res = await fetch("/api/me/balance");
        if (!res.ok) return;
        const payload = (await res.json()) as BalanceResponse;
        setFree(payload.freeCreditsRemaining);
        setPaid(payload.paidCredits);
      } finally {
        setRefreshing(false);
      }
    }

    function onCreditChange() {
      void refetch();
    }

    window.addEventListener("credit-balance-changed", onCreditChange);
    return () => window.removeEventListener("credit-balance-changed", onCreditChange);
  }, []);

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
      {refreshing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
      ) : (
        <CreditCard className="h-3.5 w-3.5 text-cyan-700" />
      )}
      <span aria-label={`${free} ${freeLabel}`}>
        {free} {freeLabel.toLowerCase()}
      </span>
      <span aria-hidden="true" className="text-slate-300">·</span>
      <span aria-label={`${paid} ${paidLabel}`}>
        {paid} {paidLabel}
      </span>
    </span>
  );
}
