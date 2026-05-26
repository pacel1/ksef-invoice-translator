"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  HistoryFilterBar,
  type HistoryFilterValues
} from "@/components/history/history-filter-bar";
import { InvoiceTable } from "@/components/history/invoice-table";
import type {
  InvoiceSortBy,
  ListInvoicesResult,
  SortOrder
} from "@/lib/invoice/recent-invoices";
import { cn } from "@/lib/utils";

export interface HistoryPageProps {
  initialData: ListInvoicesResult;
  locale: "pl" | "en";
}

const COPY = {
  pl: {
    heading: "Historia faktur",
    subheading: "Wszystkie twoje przesłane faktury w jednym miejscu.",
    filterSearchLabel: "Szukaj numeru faktury",
    filterSearchPlaceholder: "F/24/...",
    filterFromLabel: "Od",
    filterToLabel: "Do",
    filterClearLabel: "Wyczyść filtry",
    tableNumberHeader: "Numer",
    tableDateHeader: "Data wystawienia",
    tableSellerHeader: "Sprzedawca",
    tableBuyerHeader: "Nabywca",
    tableAmountHeader: "Kwota",
    tableLanguagesHeader: "Status",
    tableActionsHeader: "Akcje",
    tableOpenLabel: "Otwórz",
    tableEmptyMessage: "Brak faktur do wyświetlenia.",
    tableDuplicatesBadge: "+{count} kopie",
    mobileLabelDate: "Data",
    mobileLabelSeller: "Sprzedawca",
    mobileLabelBuyer: "Nabywca",
    mobileLabelAmount: "Kwota",
    mobileLabelLanguages: "Status",
    paginationPrev: "Poprzednia",
    paginationNext: "Następna",
    paginationPageOf: "Strona {page} z {total}"
  },
  en: {
    heading: "Invoice history",
    subheading: "All your uploaded invoices in one place.",
    filterSearchLabel: "Search by invoice number",
    filterSearchPlaceholder: "F/24/...",
    filterFromLabel: "From",
    filterToLabel: "To",
    filterClearLabel: "Clear filters",
    tableNumberHeader: "Number",
    tableDateHeader: "Issue date",
    tableSellerHeader: "Seller",
    tableBuyerHeader: "Buyer",
    tableAmountHeader: "Amount",
    tableLanguagesHeader: "Status",
    tableActionsHeader: "Actions",
    tableOpenLabel: "Open",
    tableEmptyMessage: "No invoices to show.",
    tableDuplicatesBadge: "+{count} copies",
    mobileLabelDate: "Date",
    mobileLabelSeller: "Seller",
    mobileLabelBuyer: "Buyer",
    mobileLabelAmount: "Amount",
    mobileLabelLanguages: "Status",
    paginationPrev: "Previous",
    paginationNext: "Next",
    paginationPageOf: "Page {page} of {total}"
  }
} as const;

// Default sort direction the first time a column is clicked. Most text
// columns read left-to-right, so ascending is the natural opener; for
// the date-and-status columns "most recent / most translated first" is
// what humans expect.
const DEFAULT_DIRECTION: Record<InvoiceSortBy, SortOrder> = {
  createdAt: "desc",
  invoiceNumber: "asc",
  buyerName: "asc",
  status: "desc"
};

export function HistoryPage({ initialData, locale }: HistoryPageProps) {
  const t = COPY[locale];
  const [data, setData] = useState<ListInvoicesResult>(initialData);
  const [filters, setFilters] = useState<HistoryFilterValues>({
    search: "",
    from: "",
    to: ""
  });
  const [sortBy, setSortBy] = useState<InvoiceSortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [, startTransition] = useTransition();

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(data.totalCount / data.perPage)),
    [data.totalCount, data.perPage]
  );

  const fetchPage = useCallback(
    async (
      page: number,
      nextFilters: HistoryFilterValues,
      nextSortBy: InvoiceSortBy,
      nextSortOrder: SortOrder
    ) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(data.perPage));
      params.set("sortBy", nextSortBy);
      params.set("sortOrder", nextSortOrder);
      if (nextFilters.search) params.set("search", nextFilters.search);
      if (nextFilters.from) params.set("from", nextFilters.from);
      if (nextFilters.to) params.set("to", nextFilters.to);

      const res = await fetch(`/api/me/invoices?${params.toString()}`);
      if (!res.ok) return;
      const next = (await res.json()) as ListInvoicesResult;
      startTransition(() => setData(next));
    },
    [data.perPage]
  );

  const handleFilters = useCallback(
    (values: HistoryFilterValues) => {
      setFilters(values);
      void fetchPage(1, values, sortBy, sortOrder);
    },
    [fetchPage, sortBy, sortOrder]
  );

  const handleSort = useCallback(
    (column: InvoiceSortBy) => {
      let nextOrder: SortOrder;
      if (column === sortBy) {
        nextOrder = sortOrder === "asc" ? "desc" : "asc";
      } else {
        nextOrder = DEFAULT_DIRECTION[column];
      }
      setSortBy(column);
      setSortOrder(nextOrder);
      void fetchPage(1, filters, column, nextOrder);
    },
    [fetchPage, filters, sortBy, sortOrder]
  );

  const handlePage = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages) return;
      void fetchPage(page, filters, sortBy, sortOrder);
    },
    [fetchPage, filters, sortBy, sortOrder, totalPages]
  );

  const prevDisabled = data.page <= 1;
  const nextDisabled = data.page >= totalPages;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-h1 text-text-strong">{t.heading}</h1>
        <p className="mt-2 text-body text-text-muted">{t.subheading}</p>
      </header>
      <HistoryFilterBar
        labels={{
          searchLabel: t.filterSearchLabel,
          searchPlaceholder: t.filterSearchPlaceholder,
          fromLabel: t.filterFromLabel,
          toLabel: t.filterToLabel,
          clearLabel: t.filterClearLabel
        }}
        onFilterChange={handleFilters}
      />
      <InvoiceTable
        rows={data.rows}
        sort={{ by: sortBy, order: sortOrder }}
        onSort={handleSort}
        labels={{
          numberHeader: t.tableNumberHeader,
          dateHeader: t.tableDateHeader,
          sellerHeader: t.tableSellerHeader,
          buyerHeader: t.tableBuyerHeader,
          amountHeader: t.tableAmountHeader,
          languagesHeader: t.tableLanguagesHeader,
          actionsHeader: t.tableActionsHeader,
          openLabel: t.tableOpenLabel,
          emptyMessage: t.tableEmptyMessage,
          duplicatesBadge: t.tableDuplicatesBadge,
          mobileLabelDate: t.mobileLabelDate,
          mobileLabelSeller: t.mobileLabelSeller,
          mobileLabelBuyer: t.mobileLabelBuyer,
          mobileLabelAmount: t.mobileLabelAmount,
          mobileLabelLanguages: t.mobileLabelLanguages
        }}
      />
      {totalPages > 1 ? (
        <nav
          aria-label="pagination"
          className="flex items-center justify-between gap-3"
        >
          <p className="text-small text-text-muted" aria-live="polite">
            {t.paginationPageOf
              .replace("{page}", String(data.page))
              .replace("{total}", String(totalPages))}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePage(data.page - 1)}
              disabled={prevDisabled}
              className={cn(
                "inline-flex h-9 items-center gap-1 rounded-md border border-border bg-surface px-3 text-small font-medium text-text-strong hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50",
                !prevDisabled && "cursor-pointer"
              )}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {t.paginationPrev}
            </button>
            <button
              type="button"
              onClick={() => handlePage(data.page + 1)}
              disabled={nextDisabled}
              className={cn(
                "inline-flex h-9 items-center gap-1 rounded-md border border-border bg-surface px-3 text-small font-medium text-text-strong hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50",
                !nextDisabled && "cursor-pointer"
              )}
            >
              {t.paginationNext}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </nav>
      ) : null}
    </section>
  );
}
