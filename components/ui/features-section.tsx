"use client";

import * as React from "react";
import { ArrowRight, BadgeCheck, Check, Clock, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface FeatureItem {
  title: string;
  body: string;
  illustration: React.ReactNode;
  /** True for the hero card that spans both columns on md+ */
  hero?: boolean;
}

export interface FeaturesSectionProps {
  /** Muted first half of the heading */
  headingMuted: string;
  /** Accent second half — receives the foreground color */
  headingAccent: string;
  items: FeatureItem[];
  className?: string;
}

export function FeaturesSection({
  headingMuted,
  headingAccent,
  items,
  className
}: FeaturesSectionProps) {
  const heroItem = items.find((item) => item.hero);
  const smallItems = items.filter((item) => !item.hero);

  return (
    <section className={cn("bg-surface", className)}>
      <div className="mx-auto w-full max-w-5xl px-5 py-24 md:px-8">
        <h2 className="max-w-3xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          <span className="text-text-muted">{headingMuted} </span>
          <span className="text-text-strong">{headingAccent}</span>
        </h2>

        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {heroItem ? (
            <div className="space-y-4 sm:col-span-2">
              <Card variant="soft" className="overflow-hidden px-6 pt-6">
                <div className="mx-auto -mt-2 w-full max-w-xl">{heroItem.illustration}</div>
              </Card>
              <div className="max-w-2xl">
                <h3 className="text-lg font-semibold text-text-strong">{heroItem.title}</h3>
                <p className="mt-3 text-balance text-text-muted">{heroItem.body}</p>
              </div>
            </div>
          ) : null}

          {smallItems.map((item, i) => (
            <div key={i} className="grid grid-rows-[1fr_auto] space-y-4">
              <Card variant="soft" className="overflow-hidden p-6">
                {item.illustration}
              </Card>
              <div>
                <h3 className="text-lg font-semibold text-text-strong">{item.title}</h3>
                <p className="mt-3 text-balance text-text-muted">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Illustrations ---------------- */

/**
 * Hero illustration: side-by-side mapping of MF FA(3) field codes
 * to translated labels, showing that field structure is preserved.
 */
export function FieldMappingIllustration() {
  const rows: ReadonlyArray<{ code: string; pl: string; en: string }> = [
    { code: "P_1", pl: "Data wystawienia", en: "Issue date" },
    { code: "P_13_1", pl: "Wartość netto", en: "Net value" },
    { code: "P_15", pl: "Wartość brutto", en: "Gross value" },
    { code: "P_18A", pl: "Razem do zapłaty", en: "Total due" }
  ];

  return (
    <Card aria-hidden className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-muted">
          <span className="rounded-md bg-accent-soft px-2 py-1 font-mono text-accent">PL</span>
          <ArrowRight className="h-3.5 w-3.5" />
          <span className="rounded-md bg-[hsl(var(--success))]/10 px-2 py-1 font-mono text-[hsl(var(--success))]">EN</span>
        </div>
        <span className="text-xs text-text-muted">XML FA(3) → PDF</span>
      </div>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.code}
            className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-3 rounded-lg border border-border/60 bg-surface px-3 py-2.5 text-sm"
          >
            <span className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-text-muted">
              {row.code}
            </span>
            <span className="truncate text-text-strong">{row.pl}</span>
            <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
            <span className="truncate text-text-strong">{row.en}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-[hsl(var(--success))]">
          <BadgeCheck className="h-3.5 w-3.5" />
          47 pól MF zachowanych
        </span>
        <span className="text-text-muted">schemat 2025-06-25</span>
      </div>
    </Card>
  );
}

/**
 * Left card: pricing tiers showing per-invoice cost dropping with package size.
 */
export function PricingTiersIllustration() {
  const tiers: ReadonlyArray<{ size: number; unit: string; highlight?: boolean }> = [
    { size: 5, unit: "4,99 zł" },
    { size: 25, unit: "4,49 zł" },
    { size: 100, unit: "2,99 zł", highlight: true }
  ];

  return (
    <Card aria-hidden className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Pakiet
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          za fakturę
        </span>
      </div>

      <div className="space-y-2">
        {tiers.map((tier) => (
          <div
            key={tier.size}
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors",
              tier.highlight
                ? "border-accent/40 bg-accent-soft"
                : "border-border/60 bg-surface"
            )}
          >
            <span
              className={cn(
                "font-mono tabular-nums",
                tier.highlight ? "text-accent" : "text-text-strong"
              )}
            >
              {tier.size}
            </span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                tier.highlight ? "text-accent" : "text-text-strong"
              )}
            >
              {tier.unit}
            </span>
          </div>
        ))}
      </div>

      <ul className="mt-4 space-y-1.5 text-xs text-text-muted">
        <li className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
          Żadnej miesięcznej opłaty
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
          Niewykorzystane kredyty nie wygasają
        </li>
      </ul>
    </Card>
  );
}

/**
 * Right card: "server in Frankfurt" with EU residency + 30-day deletion timer.
 */
export function DataResidencyIllustration() {
  return (
    <Card aria-hidden className="overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="text-sm">
            <div className="font-semibold text-text-strong">Frankfurt 🇪🇺</div>
            <div className="text-xs text-text-muted">Supabase · AWS eu-central-1</div>
          </div>
        </div>
        <span className="rounded-full bg-[hsl(var(--success))]/10 px-2 py-0.5 text-xs font-semibold text-[hsl(var(--success))]">
          RODO
        </span>
      </div>

      <div className="mt-4 rounded-lg border border-border/60 bg-surface p-3">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Auto-kasowanie
          </span>
          <span className="font-semibold tabular-nums text-text-strong">30 dni</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full w-[35%] rounded-full bg-accent" />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-text-muted">
          <span>upload</span>
          <span>dzień 10/30</span>
          <span>usunięcie</span>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-xs text-text-muted">
        <li className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
          Szyfrowanie w transferze i w spoczynku
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
          Dane nigdy nie opuszczają UE
        </li>
      </ul>
    </Card>
  );
}

export default FeaturesSection;
