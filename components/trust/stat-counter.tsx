/**
 * StatCounter — renders a big number + label, but only when the value is
 * meaningful (≥ STAT_COUNTER_THRESHOLD). Below that, it returns null so we
 * never show fake or unimpressive stats. See specs/2026-05-18 §4.3.
 */
export const STAT_COUNTER_THRESHOLD = 50;

export interface StatCounterProps {
  value: number;
  label: string;
}

export function StatCounter({ value, label }: StatCounterProps) {
  if (value < STAT_COUNTER_THRESHOLD) return null;
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-number-xl tabular-nums text-text-strong">{value}</span>
      <span className="text-small uppercase tracking-wide text-text-muted">{label}</span>
    </div>
  );
}
