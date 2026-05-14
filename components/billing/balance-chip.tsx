"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, ChevronRight, CreditCard, Loader2, Plus } from "lucide-react";

export interface BalanceChipProps {
  initialFree: number;
  initialPaid: number;
  /** "Free credit" or "Darmowy kredyt" */
  freeLabel: string;
  /** "credits" or "kredytów" */
  paidLabel: string;
  /** "Top up" or "Doładuj" — used in the accessible label */
  topUpLabel: string;
  /** "Out of credits" or "Brak kredytów" — used in the zero-balance variant */
  outOfCreditsLabel: string;
}

interface BalanceResponse {
  freeCreditsRemaining: number;
  paidCredits: number;
}

export function BalanceChip({
  initialFree,
  initialPaid,
  freeLabel,
  paidLabel,
  topUpLabel,
  outOfCreditsLabel
}: BalanceChipProps) {
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

  const isZero = free === 0 && paid === 0;
  const ariaLabel = isZero
    ? `${outOfCreditsLabel}. ${topUpLabel}.`
    : `${free} ${freeLabel}, ${paid} ${paidLabel}. ${topUpLabel}.`;

  const containerClass = isZero
    ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <Link
      href="/billing"
      aria-label={ariaLabel}
      className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${containerClass}`}
    >
      {refreshing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
      ) : isZero ? (
        <AlertCircle className="h-3.5 w-3.5 text-amber-700" />
      ) : (
        <>
          <CreditCard className="h-3.5 w-3.5 text-cyan-700 group-hover:hidden" />
          <Plus className="hidden h-3.5 w-3.5 text-cyan-700 group-hover:block" />
        </>
      )}
      {isZero ? (
        <span>{outOfCreditsLabel}</span>
      ) : (
        <>
          <span>
            {free} {freeLabel.toLowerCase()}
          </span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>
            {paid} {paidLabel}
          </span>
        </>
      )}
      <ChevronRight className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
