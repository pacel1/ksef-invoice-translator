"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface CostPreviewLabels {
  cost: string;
  balance: string;
  after: string;
  /** Plural units label ("kredytów"). */
  credits: string;
  /** Optional singular form ("kredyt"); falls back to plural if absent. */
  creditSingular?: string;
}

export interface CostPreviewProps {
  /** How many credits this batch will consume (max — cache hits refund). */
  cost: number;
  /** Server-rendered snapshot of the user's balance at page load. */
  initialBalance: number;
  labels: CostPreviewLabels;
}

/**
 * Three-row cost card sitting on Step 2 (spec §3.4). Reads the balance
 * snapshot from props and listens to the existing `credit-balance-changed`
 * window event for live updates so Stripe webhook completions while the
 * user sits on this page reflect immediately.
 *
 * `aria-live="polite"` so screen readers announce when the after-value
 * crosses zero (e.g. after a webhook landed mid-flow and unblocked them).
 */
export function CostPreview({ cost, initialBalance, labels }: CostPreviewProps) {
  const [balance, setBalance] = useState(initialBalance);

  useEffect(() => {
    function onBalanceChanged(event: Event) {
      const custom = event as CustomEvent<{ total?: number }>;
      if (typeof custom.detail?.total === "number") {
        setBalance(custom.detail.total);
      }
    }
    window.addEventListener("credit-balance-changed", onBalanceChanged);
    return () => {
      window.removeEventListener("credit-balance-changed", onBalanceChanged);
    };
  }, []);

  const after = balance - cost;
  const insufficient = after < 0;

  return (
    <div
      data-testid="cost-preview"
      aria-live="polite"
      className={cn(
        "rounded-xl border bg-surface p-5 transition-colors duration-hover",
        insufficient
          ? "border-danger bg-danger/5 text-danger"
          : "border-border"
      )}
    >
      <dl className="grid gap-3 sm:grid-cols-3">
        <Row label={labels.cost} value={cost} labels={labels} />
        <Row label={labels.balance} value={balance} labels={labels} />
        <Row
          label={labels.after}
          value={after}
          labels={labels}
          highlight={insufficient ? "danger" : undefined}
        />
      </dl>
    </div>
  );
}

interface RowProps {
  label: string;
  value: number;
  labels: CostPreviewLabels;
  highlight?: "danger";
}

function Row({ label, value, labels, highlight }: RowProps) {
  const unit =
    Math.abs(value) === 1 && labels.creditSingular
      ? labels.creditSingular
      : labels.credits;

  return (
    <div className="flex flex-col gap-1">
      <dt className="text-micro uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd
        className={cn(
          "text-h2",
          highlight === "danger" ? "text-danger" : "text-text-strong"
        )}
      >
        {value} {unit}
      </dd>
    </div>
  );
}
