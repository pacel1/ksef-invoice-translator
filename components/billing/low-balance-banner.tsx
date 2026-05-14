"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export interface LowBalanceBannerProps {
  initialFree: number;
  initialPaid: number;
  title: string;
  body: string;
  buyLabel: string;
  closeLabel: string;
}

const STORAGE_KEY = "low-balance-banner-dismissed";

export function LowBalanceBanner({
  initialFree,
  initialPaid,
  title,
  body,
  buyLabel,
  closeLabel
}: LowBalanceBannerProps) {
  const [free, setFree] = useState(initialFree);
  const [paid, setPaid] = useState(initialPaid);
  const [dismissed, setDismissed] = useState(false);

  // Read dismissal flag on mount (sessionStorage isn't available during SSR).
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.sessionStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // Subscribe to credit-balance-changed so the banner disappears the moment the user buys.
  useEffect(() => {
    if (typeof window === "undefined") return;
    async function refetch() {
      try {
        const res = await fetch("/api/me/balance");
        if (!res.ok) return;
        const payload = await res.json();
        setFree(payload.freeCreditsRemaining ?? 0);
        setPaid(payload.paidCredits ?? 0);
      } catch {
        // Silent — banner stays in whatever state it's in.
      }
    }
    function onChange() {
      void refetch();
    }
    window.addEventListener("credit-balance-changed", onChange);
    return () => window.removeEventListener("credit-balance-changed", onChange);
  }, []);

  const isZero = free === 0 && paid === 0;
  if (!isZero || dismissed) return null;

  function onClose() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-soft sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-amber-800">{body}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Link
          href="/billing"
          className="inline-flex h-9 items-center rounded-md bg-amber-900 px-4 text-sm font-semibold text-white hover:bg-amber-950"
        >
          {buyLabel}
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="rounded-md p-1.5 text-amber-700 hover:bg-amber-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
