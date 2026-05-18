"use client";

import { useState } from "react";
import { Search } from "lucide-react";

export interface HistoryFilterValues {
  search: string;
  from: string;
  to: string;
}

export interface HistoryFilterBarLabels {
  searchLabel: string;
  searchPlaceholder: string;
  fromLabel: string;
  toLabel: string;
  clearLabel: string;
}

export interface HistoryFilterBarProps {
  labels: HistoryFilterBarLabels;
  onFilterChange: (values: HistoryFilterValues) => void;
  initialSearch?: string;
  initialFrom?: string;
  initialTo?: string;
}

export function HistoryFilterBar({
  labels,
  onFilterChange,
  initialSearch = "",
  initialFrom = "",
  initialTo = ""
}: HistoryFilterBarProps) {
  const [search, setSearch] = useState(initialSearch);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function fire(next: Partial<HistoryFilterValues>) {
    const values: HistoryFilterValues = {
      search: next.search ?? search,
      from: next.from ?? from,
      to: next.to ?? to
    };
    onFilterChange(values);
  }

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
      <label className="flex flex-col gap-1 text-small">
        <span className="font-medium text-text">{labels.searchLabel}</span>
        <span className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              fire({ search: e.target.value });
            }}
            placeholder={labels.searchPlaceholder}
            className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-body text-text-strong outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </span>
      </label>
      <label className="flex flex-col gap-1 text-small">
        <span className="font-medium text-text">{labels.fromLabel}</span>
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            fire({ from: e.target.value });
          }}
          className="h-10 rounded-md border border-border bg-surface px-3 text-body text-text-strong outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </label>
      <label className="flex flex-col gap-1 text-small">
        <span className="font-medium text-text">{labels.toLabel}</span>
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            fire({ to: e.target.value });
          }}
          className="h-10 rounded-md border border-border bg-surface px-3 text-body text-text-strong outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </label>
      <button
        type="button"
        onClick={() => {
          setSearch("");
          setFrom("");
          setTo("");
          onFilterChange({ search: "", from: "", to: "" });
        }}
        className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-small font-medium text-text hover:bg-surface-muted"
      >
        {labels.clearLabel}
      </button>
    </div>
  );
}
