import Link from "next/link";
import { ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react";
import type {
  InvoiceSortBy,
  InvoiceSummary,
  SortOrder
} from "@/lib/invoice/recent-invoices";
import { cn } from "@/lib/utils";

export interface InvoiceTableLabels {
  numberHeader: string;
  dateHeader: string;
  sellerHeader: string;
  buyerHeader: string;
  amountHeader: string;
  languagesHeader: string;
  actionsHeader: string;
  openLabel: string;
  emptyMessage: string;
  /**
   * Template for the duplicate-copies badge; "{count}" is replaced with
   * the number of other invoices the user has with the same
   * invoice_number (e.g. "+2 kopie", "+1 copy").
   */
  duplicatesBadge?: string;
}

export interface InvoiceTableSortState {
  by: InvoiceSortBy;
  order: SortOrder;
}

export interface InvoiceTableProps {
  rows: ReadonlyArray<InvoiceSummary>;
  labels: InvoiceTableLabels;
  /**
   * Active sort. When omitted (or `onSort` is omitted) the headers render
   * as plain text and don't react to clicks.
   */
  sort?: InvoiceTableSortState;
  onSort?: (column: InvoiceSortBy) => void;
}

const SORTABLE_COLUMNS: ReadonlyArray<InvoiceSortBy> = [
  "createdAt",
  "invoiceNumber",
  "buyerName",
  "status"
];

function formatAmount(value: number | null, currency: string | null): string {
  // invoices.total_gross is stored as the actual decimal PLN amount
  // (e.g. 18597.60), NOT as integer cents — unlike the marketing
  // pricing tables which use cents for Stripe rounding. No /100 here.
  if (value === null || currency === null) return "—";
  return `${value.toFixed(2).replace(".", ",")} ${currency}`;
}

export function InvoiceTable({ rows, labels, sort, onSort }: InvoiceTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-muted px-6 py-12 text-center text-body text-text-muted">
        {labels.emptyMessage}
      </div>
    );
  }

  // We only emit a sortable header (button + aria-sort) when both `sort`
  // and `onSort` are present. The plain rendering path keeps existing
  // call sites (recent sidebar, etc.) free of new behaviour.
  const sortable = sort !== undefined && onSort !== undefined;

  function ariaSortFor(column: InvoiceSortBy): "ascending" | "descending" | "none" {
    if (!sortable || sort?.by !== column) return "none";
    return sort.order === "asc" ? "ascending" : "descending";
  }

  function renderHeader(
    column: InvoiceSortBy | null,
    label: string,
    align: "left" | "right"
  ) {
    const baseTh =
      "px-5 py-3 text-micro uppercase tracking-wide text-text-muted";
    const alignCls = align === "right" ? "text-right" : "text-left";

    if (!column || !sortable) {
      return (
        <th className={cn(baseTh, alignCls)} aria-sort="none">
          {label}
        </th>
      );
    }

    return (
      <th
        className={cn(baseTh, alignCls)}
        aria-sort={ariaSortFor(column)}
      >
        <button
          type="button"
          onClick={() => onSort?.(column)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 text-micro uppercase tracking-wide text-text-muted hover:text-text-strong",
            align === "right" ? "justify-end" : "justify-start"
          )}
        >
          {label}
          <SortGlyph column={column} sort={sort} />
        </button>
      </th>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full">
        <thead className="bg-surface-muted">
          <tr>
            {renderHeader("invoiceNumber", labels.numberHeader, "left")}
            {renderHeader("createdAt", labels.dateHeader, "left")}
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.sellerHeader}
            </th>
            {renderHeader("buyerName", labels.buyerHeader, "left")}
            <th className="px-5 py-3 text-right text-micro uppercase tracking-wide text-text-muted">
              {labels.amountHeader}
            </th>
            {renderHeader("status", labels.languagesHeader, "left")}
            <th className="px-5 py-3 text-right text-micro uppercase tracking-wide text-text-muted">
              <span className="sr-only">{labels.actionsHeader}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-surface-muted">
              <td className="px-5 py-3 font-mono text-small text-text-strong">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{row.invoiceNumber ?? "—"}</span>
                  {row.duplicateCount > 0 && labels.duplicatesBadge ? (
                    <span
                      className="inline-flex h-5 items-center rounded-full bg-warning/15 px-2 text-[10px] font-semibold tracking-wide text-warning"
                      data-testid="duplicate-badge"
                    >
                      {labels.duplicatesBadge.replace(
                        "{count}",
                        String(row.duplicateCount)
                      )}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-5 py-3 text-small text-text">
                {row.issueDate ?? "—"}
              </td>
              <td className="px-5 py-3 text-small text-text">
                {row.sellerName ?? "—"}
              </td>
              <td className="px-5 py-3 text-small text-text">
                {row.buyerName ?? "—"}
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

function SortGlyph({
  column,
  sort
}: {
  column: InvoiceSortBy;
  sort?: InvoiceTableSortState;
}) {
  if (!sort || sort.by !== column) {
    return <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden="true" />;
  }
  return sort.order === "asc" ? (
    <ArrowUp className="h-3 w-3" aria-hidden="true" />
  ) : (
    <ArrowDown className="h-3 w-3" aria-hidden="true" />
  );
}

// Re-export for parents that want to type their own state.
export type { InvoiceSortBy, SortOrder };

// Silence linter for the unused SORTABLE_COLUMNS — kept exported so the
// page-level state machine can reference the same single source of truth
// when validating a click against the whitelist.
export const SORTABLE = SORTABLE_COLUMNS;
