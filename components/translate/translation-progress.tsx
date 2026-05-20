"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Languages, Loader2, Plus, RotateCw } from "lucide-react";
import type { Copy } from "@/lib/workspace/copy";
import type { JobItem } from "./use-translation-wizard";

export interface TranslationProgressProps {
  item: JobItem;
  copy: Copy;
  /** Language label rendered in the header, already localized. */
  languageLabel: string;
  bilingual: boolean;
  onCancel: () => void;
  /** Retry a failed translation — wired to useTranslationWizard.retryItem. */
  onRetry: (fileSlotId: string) => void;
  onChangeLanguage: () => void;
  onNewTranslation: () => void;
}

/**
 * Single-file "translating" / "error" placeholder shown in Step 3
 * while the AI call is in flight. Replaces the previous bare
 * "Loading preview…" text with a proper progress card:
 *
 *   - Indeterminate animated bar (we don't have % progress from
 *     OpenAI; a styled "bouncing" bar communicates activity)
 *   - Elapsed seconds counter, updates once per second
 *   - Hint reminding the user what AI is/isn't translating
 *   - "Anuluj" CTA wired to the wizard's cancelBatch (works for
 *     single-file too — single-item batch is just a batch with N=1)
 *
 * For an error state, swaps the bar + hint for an error icon, the
 * underlying message, and Ponów / Zmień język / Nowe controls.
 */
export function TranslationProgress({
  item,
  copy,
  languageLabel,
  bilingual,
  onCancel,
  onRetry,
  onChangeLanguage,
  onNewTranslation
}: TranslationProgressProps) {
  const isError = item.status === "error";

  // Tick once per second to keep the elapsed counter alive while the
  // translation is in flight. We don't have a server-side started_at,
  // so we anchor on the moment this component mounts (which is when
  // the wizard transitioned into delivery — close enough).
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (isError) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isError]);

  return (
    <div
      data-testid={isError ? "delivery-error" : "delivery-progress"}
      className="flex h-[calc(100vh-9rem)] flex-col gap-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h1 className="truncate text-h3 text-text-strong">
            {item.invoiceNumber || item.invoiceId} · {languageLabel}
            {bilingual ? ` ${String(copy.deliveryBatchBilingual)}` : ""}
          </h1>
          <p className="text-small text-text-muted">
            {isError
              ? String(copy.deliveryRowErrorTitle)
              : String(copy.deliveryTranslatingTitle)}
          </p>
        </div>
        {!isError ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-danger bg-surface px-4 text-small font-medium text-danger hover:bg-danger/5"
          >
            {String(copy.deliveryCancelCta)}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onRetry(item.fileSlotId)}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm hover:bg-accent-hover"
            >
              <RotateCw className="h-4 w-4" aria-hidden="true" />
              {String(copy.retryCta)}
            </button>
            <button
              type="button"
              onClick={onChangeLanguage}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface px-5 text-small font-medium text-text-strong shadow-sm hover:bg-surface-muted"
            >
              <Languages className="h-4 w-4" aria-hidden="true" />
              {String(copy.changeLanguageCta)}
            </button>
            <button
              type="button"
              onClick={onNewTranslation}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-5 text-small font-medium text-text-muted shadow-sm hover:bg-surface-muted"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {String(copy.newTranslationCta)}
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-surface-muted p-6">
        <div className="flex w-full max-w-lg flex-col items-center gap-5 text-center">
          {isError ? (
            <>
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
                <AlertCircle className="h-7 w-7" aria-hidden="true" />
              </div>
              <p className="text-h3 text-text-strong">
                {item.errorMessage ?? String(copy.deliveryRowErrorTitle)}
              </p>
              <p className="text-small text-text-muted">
                {String(copy.deliveryRowErrorHint)}
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
              </div>
              <div className="w-full">
                <p className="text-h3 text-text-strong">
                  {String(copy.deliveryTranslatingTitle)}…
                </p>
                <p
                  className="mt-1 font-mono text-small text-text-muted"
                  aria-live="polite"
                >
                  {String(copy.deliveryElapsedSeconds).replace(
                    "{seconds}",
                    String(elapsedSec)
                  )}
                </p>
              </div>
              <IndeterminateBar
                aria-label={String(copy.deliveryTranslatingTitle)}
              />
              <p className="text-small text-text-muted">
                {String(copy.deliveryTranslatingHint)}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * CSS-only indeterminate progress bar. Honors prefers-reduced-motion
 * via Tailwind's motion-reduce variant (animation disabled, bar
 * stays at 30% width so the visual element is still present).
 */
function IndeterminateBar({ ...rest }: { "aria-label"?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      {...rest}
      className="h-2 w-full overflow-hidden rounded-full bg-surface"
    >
      <div className="h-full w-1/3 animate-translate-progress rounded-full bg-accent motion-reduce:w-1/3 motion-reduce:animate-none" />
    </div>
  );
}
