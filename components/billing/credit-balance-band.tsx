export interface CreditBalanceBandLabels {
  paidLabel: string;
  freeLabel: string;
  nextFreeLabel: string;
}

export interface CreditBalanceBandProps {
  paidCredits: number;
  freeCreditsRemaining: number;
  nextFreeAt: string;
  labels: CreditBalanceBandLabels;
}

export function CreditBalanceBand({
  paidCredits,
  freeCreditsRemaining,
  nextFreeAt,
  labels
}: CreditBalanceBandProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-col items-baseline gap-2 sm:flex-row sm:gap-4">
        <span className="text-number-xl tabular-nums text-text-strong">{paidCredits}</span>
        <span className="text-body text-text-muted">{labels.paidLabel}</span>
      </div>
      {freeCreditsRemaining > 0 ? (
        <p className="mt-2 text-small font-semibold text-text-strong">
          {`${freeCreditsRemaining} ${labels.freeLabel}`}
        </p>
      ) : null}
      <p className="mt-3 text-micro text-text-muted">
        {labels.nextFreeLabel} <time dateTime={nextFreeAt}>{nextFreeAt}</time>
      </p>
    </div>
  );
}
