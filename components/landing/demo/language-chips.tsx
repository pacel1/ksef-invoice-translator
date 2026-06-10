"use client";

import { DEMO_LANGS, type DemoLang } from "@/lib/landing/demo-sample";
import { cn } from "@/lib/utils";

export interface LanguageChipsProps {
  value: DemoLang;
  onChange: (lang: DemoLang) => void;
  label: string;
}

export function LanguageChips({ value, onChange, label }: LanguageChipsProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center justify-center gap-2">
      {DEMO_LANGS.map(({ code, label: chip }) => {
        const active = code === value;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(code)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
              active
                ? "bg-brand text-white"
                : "border border-white/10 bg-ink-panel text-white/70 hover:text-white"
            )}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}

export default LanguageChips;
