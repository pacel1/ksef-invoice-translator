import Link from "next/link";
import type { InvoiceSummary } from "@/lib/invoice/recent-invoices";

export interface InvoiceTableLabels {
  numberHeader: string;
  dateHeader: string;
  sellerHeader: string;
  amountHeader: string;
  languagesHeader: string;
  actionsHeader: string;
  openLabel: string;
  emptyMessage: string;
}

export interface InvoiceTableProps {
  rows: ReadonlyArray<InvoiceSummary>;
  labels: InvoiceTableLabels;
}

function formatAmount(value: number | null, currency: string | null): string {
  // invoices.total_gross is stored as the actual decimal PLN amount
  // (e.g. 18597.60), NOT as integer cents — unlike the marketing
  // pricing tables which use cents for Stripe rounding. No /100 here.
  if (value === null || currency === null) return "—";
  return `${value.toFixed(2).replace(".", ",")} ${currency}`;
}

export function InvoiceTable({ rows, labels }: InvoiceTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-muted px-6 py-12 text-center text-body text-text-muted">
        {labels.emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full">
        <thead className="bg-surface-muted">
          <tr>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.numberHeader}
            </th>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.dateHeader}
            </th>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.sellerHeader}
            </th>
            <th className="px-5 py-3 text-right text-micro uppercase tracking-wide text-text-muted">
              {labels.amountHeader}
            </th>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.languagesHeader}
            </th>
            <th className="px-5 py-3 text-right text-micro uppercase tracking-wide text-text-muted">
              <span className="sr-only">{labels.actionsHeader}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface-muted">
              <td className="px-5 py-3 font-mono text-small text-text-strong">
                {row.invoiceNumber ?? "—"}
              </td>
              <td className="px-5 py-3 text-small text-text">
                {row.issueDate ?? "—"}
              </td>
              <td className="px-5 py-3 text-small text-text">
                {row.sellerName ?? "—"}
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-right text-small tabular-nums text-text">
                {formatAmount(row.totalGross, row.currency)}
              </td>
              <td className="px-5 py-3">
                <div className="flex flex-wrap gap-1">
                  <span className="inline-flex h-5 items-center rounded-full bg-accent-soft px-2 text-[10px] font-semibold tracking-wide text-accent">
                    PL
                  </span>
                  {row.translatedLanguages.map((lang) => (
                    <span
                      key={lang}
                      className="inline-flex h-5 items-center rounded-full bg-surface-muted px-2 text-[10px] font-semibold tracking-wide text-text"
                    >
                      {lang.toUpperCase()}
                    </span>
                  ))}
                </div>
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-right">
                <Link
                  href={`/translate?invoiceId=${row.id}`}
                  className="cursor-pointer text-small font-medium text-accent hover:text-accent-hover"
                >
                  {labels.openLabel} →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
