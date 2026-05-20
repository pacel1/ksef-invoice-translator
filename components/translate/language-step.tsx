"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import type { Copy } from "@/lib/workspace/copy";
import type { LanguageCode } from "@/types/invoice";
import { LanguagePicker } from "./language-picker";
import { FormatPicker } from "./format-picker";
import { CostPreview } from "./cost-preview";
import { cn } from "@/lib/utils";

export interface LanguageStepProps {
  uiLanguage: "pl" | "en";
  copy: Copy;
  language: LanguageCode | null;
  bilingual: boolean;
  /** Credits the batch will consume at most (cache hits refund). */
  cost: number;
  /** Initial balance snapshot — CostPreview listens for live updates. */
  balance: number;
  onSetLanguage: (code: LanguageCode) => void;
  onSetBilingual: (value: boolean) => void;
  onBack: () => void;
  onTranslate: () => Promise<void> | void;
}

/**
 * Step 2: language + format + cost commitment. Composes three children:
 *   - LanguagePicker → target language (PL excluded)
 *   - FormatPicker   → mono vs bilingual
 *   - CostPreview    → real-time cost/balance/after math
 *
 * CTA logic:
 *   language === null                       → disabled Tłumacz CTA
 *   language set, balance ≥ cost            → enabled Tłumacz CTA
 *   balance < cost                          → CTA swaps to Doładuj kredyty
 *                                             (links to /billing?return=/translate)
 */
export function LanguageStep({
  uiLanguage,
  copy,
  language,
  bilingual,
  cost,
  balance,
  onSetLanguage,
  onSetBilingual,
  onBack,
  onTranslate
}: LanguageStepProps) {
  const headingForCount =
    cost === 1
      ? String(copy.languageHeadingForSingular)
      : String(copy.languageHeadingForPlural).replace("{count}", String(cost));

  const insufficient = balance < cost;
  const translateLabel =
    cost === 1
      ? String(copy.translateCtaSingular)
      : String(copy.translateCtaPlural).replace("{count}", String(cost));

  return (
    <div data-testid="wizard-step-language" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1 text-text-strong">
          {String(copy.languageHeading)}
        </h1>
        <p className="text-body text-text-muted">{headingForCount}</p>
      </header>

      <section>
        <h2 className="mb-2 text-micro uppercase tracking-wide text-text-muted">
          {String(copy.targetLangLabel)}
        </h2>
        <LanguagePicker
          uiLanguage={uiLanguage}
          value={language}
          onSelect={onSetLanguage}
          searchPlaceholder={String(copy.targetLangSearchPlaceholder)}
          showAllLabel={String(copy.showAllLanguages)}
          polishLockedLabel={String(copy.polishSourceLocked)}
        />
      </section>

      <section>
        <h2 className="mb-2 text-micro uppercase tracking-wide text-text-muted">
          {String(copy.formatLabel)}
        </h2>
        <FormatPicker
          bilingual={bilingual}
          onChange={onSetBilingual}
          monoLabel={String(copy.formatMono)}
          monoHelp={String(copy.formatMonoHelp)}
          bilingualLabel={String(copy.formatBilingual)}
          bilingualHelp={String(copy.formatBilingualHelp)}
        />
      </section>

      <CostPreview
        cost={cost}
        initialBalance={balance}
        labels={{
          cost: String(copy.costLabel),
          balance: String(copy.balanceLabel),
          after: String(copy.afterLabel),
          credits: String(copy.creditsUnit),
          creditSingular: String(copy.creditsUnitSingular)
        }}
      />

      <p className="flex items-start gap-2 rounded-lg bg-surface-muted px-4 py-3 text-small text-text">
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-text-muted"
          aria-hidden="true"
        />
        <span>{String(copy.dataImmutableNotice)}</span>
      </p>

      <footer className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface px-5 text-small font-medium text-text-strong shadow-sm transition-colors duration-hover hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          ← {String(copy.backCta)}
        </button>

        {insufficient ? (
          <div className="flex flex-col items-end gap-1">
            <Link
              href={`/billing?return=${encodeURIComponent("/translate")}&pending=${cost}`}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm transition-colors duration-hover hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {String(copy.insufficientCreditsCta)}
            </Link>
            <span className="text-micro text-text-muted">
              {String(copy.insufficientCreditsHint)}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void onTranslate()}
            disabled={language === null}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm transition-colors duration-hover hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:bg-border disabled:text-text-muted",
              language !== null && "cursor-pointer"
            )}
          >
            {translateLabel}
          </button>
        )}
      </footer>
    </div>
  );
}
