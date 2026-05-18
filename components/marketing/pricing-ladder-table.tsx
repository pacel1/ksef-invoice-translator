import { priceForPackage } from "@/lib/billing/pricing";

export interface PricingLadderLabels {
  packageHeader: string;
  totalHeader: string;
  perInvoiceHeader: string;
}

export interface PricingLadderTableProps {
  locale: "pl" | "en";
  labels: PricingLadderLabels;
  currentPackageSize?: number;
}

const LADDER_SIZES = [5, 10, 25, 50, 100] as const;

function formatPLN(cents: number, locale: "pl" | "en"): string {
  const amount = cents / 100;
  return locale === "pl"
    ? `${amount.toFixed(2).replace(".", ",")} zł`
    : `PLN ${amount.toFixed(2)}`;
}

export function PricingLadderTable({
  locale,
  labels,
  currentPackageSize
}: PricingLadderTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full">
        <thead className="bg-surface-muted">
          <tr>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.packageHeader}
            </th>
            <th className="px-5 py-3 text-right text-micro uppercase tracking-wide text-text-muted">
              {labels.totalHeader}
            </th>
            <th className="px-5 py-3 text-right text-micro uppercase tracking-wide text-text-muted">
              {labels.perInvoiceHeader}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {LADDER_SIZES.map((size) => {
            const quote = priceForPackage(size);
            const isCurrent = size === currentPackageSize;
            return (
              <tr
                key={size}
                data-current={isCurrent ? "true" : "false"}
                className={isCurrent ? "bg-accent-soft" : ""}
              >
                <td className="px-5 py-3 text-body tabular-nums text-text-strong">{size}</td>
                <td className="px-5 py-3 text-right text-body tabular-nums text-text">
                  {formatPLN(quote.totalAmountCents, locale)}
                </td>
                <td className="px-5 py-3 text-right text-body font-semibold tabular-nums text-accent">
                  {formatPLN(quote.unitPriceCents, locale)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
