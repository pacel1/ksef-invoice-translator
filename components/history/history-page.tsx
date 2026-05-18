"use client";

import { useState, useTransition } from "react";
import {
  HistoryFilterBar,
  type HistoryFilterValues
} from "@/components/history/history-filter-bar";
import { InvoiceTable } from "@/components/history/invoice-table";
import type { ListInvoicesResult } from "@/lib/invoice/recent-invoices";

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
    tableAmountHeader: "Kwota",
    tableLanguagesHeader: "Języki",
    tableActionsHeader: "Akcje",
    tableOpenLabel: "Otwórz",
    tableEmptyMessage: "Brak faktur do wyświetlenia."
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
    tableAmountHeader: "Amount",
    tableLanguagesHeader: "Languages",
    tableActionsHeader: "Actions",
    tableOpenLabel: "Open",
    tableEmptyMessage: "No invoices to show."
  }
} as const;

export function HistoryPage({ initialData, locale }: HistoryPageProps) {
  const t = COPY[locale];
  const [data, setData] = useState<ListInvoicesResult>(initialData);
  const [, startTransition] = useTransition();

  async function applyFilters(values: HistoryFilterValues) {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("perPage", String(initialData.perPage));
    if (values.search) params.set("search", values.search);
    if (values.from) params.set("from", values.from);
    if (values.to) params.set("to", values.to);

    const res = await fetch(`/api/me/invoices?${params.toString()}`);
    if (res.ok) {
      const next = (await res.json()) as ListInvoicesResult;
      startTransition(() => setData(next));
    }
  }

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
        onFilterChange={(values) => {
          void applyFilters(values);
        }}
      />
      <InvoiceTable
        rows={data.rows}
        labels={{
          numberHeader: t.tableNumberHeader,
          dateHeader: t.tableDateHeader,
          sellerHeader: t.tableSellerHeader,
          amountHeader: t.tableAmountHeader,
          languagesHeader: t.tableLanguagesHeader,
          actionsHeader: t.tableActionsHeader,
          openLabel: t.tableOpenLabel,
          emptyMessage: t.tableEmptyMessage
        }}
      />
      {data.totalCount > data.perPage ? (
        <p className="text-small text-text-muted">
          {data.rows.length} / {data.totalCount}
        </p>
      ) : null}
    </section>
  );
}
