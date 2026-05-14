"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import type { LanguageCode } from "@/types/invoice";
import type { WorkspaceLanguageCode } from "./use-translator-workflow";

export interface LanguageOption {
  code: LanguageCode;
  label: string;
}

export interface LanguagePillsProps {
  current: WorkspaceLanguageCode;
  cached: Set<LanguageCode>;
  translating: boolean;
  onSelect: (code: WorkspaceLanguageCode) => void;
  cachedLabel: string;
  moreLanguagesLabel: string;
  /** Localized name for the source language pill (e.g. "Polski" / "Polish"). */
  originalPolishLabel: string;
  allLanguageOptions: ReadonlyArray<LanguageOption>;
}

const DEFAULT_VISIBLE: LanguageCode[] = ["en", "de", "fr", "es", "it"];

export function LanguagePills({
  current,
  cached,
  translating,
  onSelect,
  cachedLabel,
  moreLanguagesLabel,
  originalPolishLabel,
  allLanguageOptions
}: LanguagePillsProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);

  const visibleCodes = new Set<LanguageCode>(DEFAULT_VISIBLE);
  if (current !== "pl" && !visibleCodes.has(current)) {
    visibleCodes.add(current);
  }

  const visiblePills = allLanguageOptions.filter((option) => visibleCodes.has(option.code));
  const overflowPills = allLanguageOptions.filter((option) => !visibleCodes.has(option.code));

  const plActive = current === "pl";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onSelect("pl")}
        aria-pressed={plActive}
        aria-label={`PL — ${originalPolishLabel}`}
        data-cached="source"
        className={pillClass(plActive, false)}
      >
        <span className="font-semibold">PL</span>
      </button>

      {visiblePills.map((option) => {
        const isActive = option.code === current;
        const isCached = cached.has(option.code);
        const showSpinner = translating && isActive;
        const display = option.code.toUpperCase();
        return (
          <button
            key={option.code}
            type="button"
            onClick={() => onSelect(option.code)}
            aria-pressed={isActive}
            aria-label={`${display} — ${option.label}${isCached ? ` (${cachedLabel})` : ""}`}
            data-cached={isCached ? "true" : "false"}
            className={pillClass(isActive, isCached)}
          >
            <span className="font-semibold">{display}</span>
            {showSpinner ? (
              <Loader2 data-testid="pill-spinner" className="h-3.5 w-3.5 animate-spin" />
            ) : isCached ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOverflowOpen((open) => !open)}
          aria-haspopup="listbox"
          aria-expanded={overflowOpen}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {moreLanguagesLabel}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {overflowOpen ? (
          <ul
            role="listbox"
            className="absolute right-0 z-20 mt-2 max-h-72 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {overflowPills.map((option) => {
              const isCached = cached.has(option.code);
              return (
                <li key={option.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      onSelect(option.code);
                      setOverflowOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span>
                      <span className="mr-2 inline-block w-8 font-semibold uppercase">{option.code}</span>
                      {option.label}
                    </span>
                    {isCached ? <Check className="h-3.5 w-3.5 text-cyan-700" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function pillClass(active: boolean, cached: boolean): string {
  const base =
    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors";
  if (active) {
    return `${base} border-cyan-700 bg-cyan-700 text-white shadow-sm`;
  }
  if (cached) {
    return `${base} border-slate-200 bg-slate-100 text-slate-900 hover:border-slate-300`;
  }
  return `${base} border-slate-200 bg-white text-slate-700 hover:border-cyan-700 hover:bg-cyan-50/40`;
}
