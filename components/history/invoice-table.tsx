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
   * Labels for the mobile card view's <dl>. The desktop column headers
   * are too verbose (and often diagonal-aligned) for a vertical card,
   * so we accept dedicated short forms.
   */
  mobileLabelDate: string;
  mobileLabelSeller: string;
  mobileLabelBuyer: string;
  mobileLabelAmount: string;
  mobileLabelLanguages: string;
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

// Column widths sum to 100. Explicit widths keep the desktop table from
// collapsing or expanding columns based on row content — combined with
// `table-fixed` they produce a stable, predictable layout regardless of
// how long a seller/buyer name is.
const COLUMN_WIDTHS = [
  { key: "number", width: "14%" },
  { key: "date", width: "11%" },
  { key: "seller", width: "19%" },
  { key: "buyer", width: "19%" },
  { key: "amount", width: "11%" },
  { key: "languages", width: "14%" },
  { key: "actions", width: "12%" }
] as const;

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
      "whitespace-nowrap px-5 py-3 text-micro uppercase tracking-wide text-text-muted";
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
            "inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-micro uppercase tracking-wide text-text-muted hover:text-text-strong",
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
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-sm md:block">
        <table className="w-full table-fixed">
          <colgroup>
            {COLUMN_WIDTHS.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead className="bg-surface-muted">
            <tr>
              {renderHeader("invoiceNumber", labels.numberHeader, "left")}
              {renderHeader("createdAt", labels.dateHeader, "left")}
              <th className="whitespace-nowrap px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
                {labels.sellerHeader}
              </th>
              {renderHeader("buyerName", labels.buyerHeader, "left")}
              <th className="whitespace-nowrap px-5 py-3 text-right text-micro uppercase tracking-wide text-text-muted">
                {labels.amountHeader}
              </th>
              {renderHeader("status", labels.languagesHeader, "left")}
              <th className="whitespace-nowrap px-5 py-3 text-right text-micro uppercase tracking-wide text-text-muted">
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
                <td className="whitespace-nowrap px-5 py-3 text-small text-text">
                  {row.issueDate ?? "—"}
                </td>
                <td className="px-5 py-3 text-small text-text">
                  <span className="block truncate" title={row.sellerName ?? undefined}>
                    {row.sellerName ?? "—"}
                  </span>
                </td>
                <td className="px-5 py-3 text-small text-text">
                  <span className="block truncate" title={row.buyerName ?? undefined}>
                    {row.buyerName ?? "—"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-small tabular-nums text-text">
                  {formatAmount(row.totalGross, row.currency)}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    <span
                      data-testid="lang-pill-PL"
                      className="inline-flex h-5 items-center rounded-full bg-accent-soft px-2 text-[10px] font-semibold tracking-wide text-accent"
                    >
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
      <ul
        data-testid="invoice-card-list"
        className="flex flex-col gap-3 md:hidden"
      >
        {rows.map((row) => (
          <li
            key={row.id}
            data-testid="invoice-card"
            className="rounded-xl border border-border bg-surface p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 font-mono text-small text-text-strong">
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
              <Link
                href={`/translate?invoiceId=${row.id}`}
                className="cursor-pointer whitespace-nowrap text-small font-medium text-accent hover:text-accent-hover"
              >
                {labels.openLabel} →
              </Link>
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-small">
              <dt className="text-text-muted">{labels.mobileLabelDate}</dt>
              <dd className="text-text">{row.issueDate ?? "—"}</dd>
              <dt className="text-text-muted">{labels.mobileLabelSeller}</dt>
              <dd className="text-text">{row.sellerName ?? "—"}</dd>
              <dt className="text-text-muted">{labels.mobileLabelBuyer}</dt>
              <dd className="text-text">{row.buyerName ?? "—"}</dd>
              <dt className="text-text-muted">{labels.mobileLabelAmount}</dt>
              <dd className="tabular-nums text-text">
                {formatAmount(row.totalGross, row.currency)}
              </dd>
              <dt className="text-text-muted">{labels.mobileLabelLanguages}</dt>
              <dd>
                <div className="flex flex-wrap gap-1">
                  <span
                    data-testid="lang-pill-PL"
                    className="inline-flex h-5 items-center rounded-full bg-accent-soft px-2 text-[10px] font-semibold tracking-wide text-accent"
                  >
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
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
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
