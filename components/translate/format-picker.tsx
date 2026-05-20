"use client";

import { cn } from "@/lib/utils";

export interface FormatPickerProps {
  bilingual: boolean;
  onChange: (bilingual: boolean) => void;
  monoLabel: string;
  monoHelp: string;
  bilingualLabel: string;
  bilingualHelp: string;
}

/**
 * Step 2 format selector. Two-radio component:
 *   - Tylko tłumaczenie  → mono (target language only)
 *   - Dwujęzycznie       → bilingual (target + Polish side by side)
 *
 * Same credit cost either way (one render of the cached translation),
 * so the picker is purely a presentation choice.
 */
export function FormatPicker({
  bilingual,
  onChange,
  monoLabel,
  monoHelp,
  bilingualLabel,
  bilingualHelp
}: FormatPickerProps) {
  return (
    <fieldset
      data-testid="format-picker"
      className="rounded-xl border border-border bg-surface p-5"
    >
      <legend className="sr-only">{monoLabel} / {bilingualLabel}</legend>
      <div className="flex flex-col gap-3">
        <Option
          checked={!bilingual}
          onClick={() => onChange(false)}
          label={monoLabel}
          help={monoHelp}
        />
        <Option
          checked={bilingual}
          onClick={() => onChange(true)}
          label={bilingualLabel}
          help={bilingualHelp}
        />
      </div>
    </fieldset>
  );
}

interface OptionProps {
  checked: boolean;
  onClick: () => void;
  label: string;
  help: string;
}

function Option({ checked, onClick, label, help }: OptionProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-hover",
        checked
          ? "border-accent bg-accent-soft"
          : "border-border hover:border-border-strong"
      )}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onClick}
        className="mt-1 h-4 w-4 cursor-pointer accent-accent"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-body font-medium text-text-strong">{label}</span>
        {help ? (
          <span className="text-small text-text-muted">{help}</span>
        ) : null}
      </span>
    </label>
  );
}
