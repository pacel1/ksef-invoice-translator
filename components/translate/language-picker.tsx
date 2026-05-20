"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getLanguageOptions } from "@/lib/translation/languages";
import type { LanguageCode } from "@/types/invoice";
import { cn } from "@/lib/utils";

const QUICK_PICKS: ReadonlyArray<LanguageCode> = ["en", "de", "fr", "es"];

export interface LanguagePickerProps {
  uiLanguage: "pl" | "en";
  value: LanguageCode | null;
  onSelect: (code: LanguageCode) => void;
  searchPlaceholder: string;
  showAllLabel: string;
  /** Tooltip / sr-only text shown if someone tries to interact with PL. */
  polishLockedLabel: string;
}

/**
 * Language picker for Step 2. Two affordances:
 *   1. Four quick-pick chips for the most common targets (EN, DE, FR, ES).
 *   2. A "Pokaż wszystkie 22" toggle that reveals a searchable list of
 *      every supported language EXCEPT Polish (spec §3.4 — Polish is the
 *      source, never a valid target).
 *
 * The expanded list renders as <ul role="listbox"><li role="option"> so
 * screen readers announce it as a combobox. Search filter is purely
 * client-side over the pre-loaded language names.
 */
export function LanguagePicker({
  uiLanguage,
  value,
  onSelect,
  searchPlaceholder,
  showAllLabel,
  polishLockedLabel
}: LanguagePickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");

  const allOptions = useMemo(() => {
    return getLanguageOptions(uiLanguage).filter(
      (opt) => (opt.code as string) !== "pl"
    );
  }, [uiLanguage]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allOptions;
    const q = query.trim().toLowerCase();
    return allOptions.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [allOptions, query]);

  return (
    <div data-testid="language-picker" className="rounded-xl border border-border bg-surface p-5">
      {/* Quick chips */}
      <div className="flex flex-wrap gap-2">
        {QUICK_PICKS.map((code) => {
          const opt = allOptions.find((o) => o.code === code);
          if (!opt) return null;
          const selected = value === code;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(code)}
              title={opt.label}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-small font-medium transition-colors duration-hover",
                selected
                  ? "border-accent bg-accent text-white"
                  : "border-border-strong bg-surface text-text-strong hover:border-accent hover:bg-accent-soft"
              )}
            >
              {code.toUpperCase()}
              <span className="text-text-muted text-micro font-normal">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expand toggle */}
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-4 inline-flex cursor-pointer items-center text-small font-medium text-accent hover:text-accent-hover"
        >
          {showAllLabel} →
        </button>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent">
            <Search className="h-4 w-4 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full bg-transparent text-small text-text-strong placeholder:text-text-muted focus:outline-none"
            />
          </div>

          <ul
            role="listbox"
            aria-label={polishLockedLabel}
            className="mt-3 max-h-64 overflow-y-auto rounded-md border border-border bg-surface"
          >
            {filtered.map((opt) => {
              const selected = value === opt.code;
              return (
                <li
                  key={opt.code}
                  role="option"
                  aria-selected={selected}
                  aria-label={opt.label}
                  onClick={() => onSelect(opt.code)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-small transition-colors duration-hover hover:bg-surface-muted",
                    selected && "bg-accent-soft text-accent"
                  )}
                >
                  <span className="font-medium text-text-strong">
                    {opt.code.toUpperCase()}
                  </span>
                  <span className="text-text-muted">{opt.label}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
