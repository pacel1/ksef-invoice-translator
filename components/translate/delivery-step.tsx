"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Languages, Pencil, Plus } from "lucide-react";
import { TranslationEditor } from "./translation-editor";
import { TranslationProgress } from "./translation-progress";
import type { Copy } from "@/lib/workspace/copy";
import { languageNamesByUi } from "@/lib/translation/languages";
import type { LanguageCode } from "@/types/invoice";
import type { JobItem, WizardApi } from "./use-translation-wizard";
import { TranslationRow } from "./translation-row";
import { cn } from "@/lib/utils";

export interface DeliveryStepProps {
  copy: Copy;
  api: WizardApi;
  jobItems: ReadonlyArray<JobItem>;
  language: LanguageCode;
  bilingual: boolean;
  onCancelBatch: () => void;
  onResumeBatch: () => Promise<void> | void;
  onRetryItem: (fileSlotId: string) => Promise<void> | void;
  onChangeLanguage: () => void;
  onNewTranslation: () => void;
  /** Optional — when provided, the single-file view renders an "Edytuj" CTA. */
  onEdit?: (invoiceId: string) => void;
}

/**
 * Step 3 router. Branches on the job count:
 *   N = 1 → <DeliverySingle>  — PDF preview + Download + Change language
 *   N > 1 → <DeliveryBatch>   — progress + per-row list + Stop/Resume/Zip
 *
 * N = 0 falls through to the batch shell (so users who arrived here in
 * an empty state via /translate?invoiceId&missing still see actionable UI).
 */
export function DeliveryStep(props: DeliveryStepProps) {
  const isSingle = props.jobItems.length === 1;
  return (
    <div data-testid="wizard-step-delivery">
      {isSingle ? <DeliverySingle {...props} /> : <DeliveryBatch {...props} />}
    </div>
  );
}

// ─── Single-file branch ────────────────────────────────────────────────────

function DeliverySingle(props: DeliveryStepProps) {
  const { jobItems, copy, language, bilingual, api } = props;
  const item = jobItems[0];

  // Resolve the human-readable language name for the title — fall back
  // gracefully if the code isn't in the table (shouldn't happen post-validation).
  const langLabel =
    (languageNamesByUi.pl as Record<string, string>)[language] ?? language;

  const [editorOpen, setEditorOpen] = useState(false);
  // Bumped after every Save in the editor — keys the iframe so it
  // remounts with a fresh PDF blob URL.
  const [previewVersion, setPreviewVersion] = useState(0);

  const download = useCallback(async () => {
    if (!item) return;
    const blob = await api.generatePdf(item.invoiceId, language, bilingual);
    triggerBlobDownload(
      blob,
      `ksef-translation-${item.invoiceNumber || item.invoiceId}.pdf`
    );
  }, [api, item, language, bilingual]);

  if (!item) {
    return (
      <div data-testid="delivery-single" className="rounded-xl border border-border bg-surface p-6">
        <p className="text-body text-text-muted">{String(copy.deliveryReadyTitle)}</p>
      </div>
    );
  }

  // While the translation is in flight (or has just errored) we don't
  // have a stable PDF to preview yet. Swap in <TranslationProgress>
  // which shows an indeterminate bar + elapsed counter + cancel CTA.
  // Only render the iframe path once the item is fully 'done'.
  if (item.status === "queued" || item.status === "translating") {
    return (
      <TranslationProgress
        item={item}
        copy={copy}
        languageLabel={langLabel}
        bilingual={bilingual}
        onCancel={props.onCancelBatch}
        onRetry={(slotId) => void props.onRetryItem(slotId)}
        onChangeLanguage={props.onChangeLanguage}
        onNewTranslation={props.onNewTranslation}
      />
    );
  }
  if (item.status === "error") {
    return (
      <TranslationProgress
        item={item}
        copy={copy}
        languageLabel={langLabel}
        bilingual={bilingual}
        onCancel={props.onCancelBatch}
        onRetry={(slotId) => void props.onRetryItem(slotId)}
        onChangeLanguage={props.onChangeLanguage}
        onNewTranslation={props.onNewTranslation}
      />
    );
  }

  return (
    <div
      data-testid="delivery-single"
      className="flex h-[calc(100vh-9rem)] flex-col gap-3"
    >
      {/* Sticky action bar — title + CTAs above the fold. The preview
          scrolls inside the next container, so these buttons remain
          accessible regardless of how long the invoice runs. */}
      <header className="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface pb-3">
        <div className="min-w-0">
          <h1 className="truncate text-h3 text-text-strong">
            {item.invoiceNumber} · {langLabel}
            {bilingual ? ` ${String(copy.deliveryBatchBilingual)}` : ""}
          </h1>
          <p className="text-small text-text-muted">
            {String(copy.deliveryReadyTitle)} ·{" "}
            <span className="text-success">
              ✓ {String(copy.deliveryReadySaved)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void download()}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm hover:bg-accent-hover"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {String(copy.downloadPdfCta)}
          </button>
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface px-5 text-small font-medium text-text-strong shadow-sm hover:bg-surface-muted"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {String(copy.editTranslationCta)}
          </button>
          <button
            type="button"
            onClick={props.onChangeLanguage}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface px-5 text-small font-medium text-text-strong shadow-sm hover:bg-surface-muted"
          >
            <Languages className="h-4 w-4" aria-hidden="true" />
            {String(copy.changeLanguageCta)}
          </button>
          <button
            type="button"
            onClick={props.onNewTranslation}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-5 text-small font-medium text-text-muted shadow-sm hover:bg-surface-muted"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {String(copy.newTranslationCta)}
          </button>
        </div>
      </header>

      {/* Preview fills the remaining viewport height. The iframe inside
          gets browser-native PDF controls (zoom, page nav, print, save).
          The previewVersion key forces a remount after every editor save
          so the iframe re-fetches the regenerated PDF. */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface-muted shadow-sm">
        <PdfPreview
          key={previewVersion}
          api={api}
          item={item}
          language={language}
          bilingual={bilingual}
        />
      </div>

      <TranslationEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        invoiceId={item.invoiceId}
        language={language}
        bilingual={bilingual}
        copy={copy}
        onSaved={() => setPreviewVersion((v) => v + 1)}
      />
    </div>
  );
}

// ─── Batch branch ──────────────────────────────────────────────────────────

function DeliveryBatch(props: DeliveryStepProps) {
  const { jobItems, copy, language, bilingual, api } = props;

  const done = jobItems.filter((j) => j.status === "done").length;
  const total = jobItems.length;
  const inflight = jobItems.some(
    (j) => j.status === "queued" || j.status === "translating"
  );
  const cancelled =
    !inflight &&
    jobItems.some((j) => j.status === "error") &&
    jobItems.some((j) => j.status !== "done");

  const langLabel =
    (languageNamesByUi.pl as Record<string, string>)[language] ?? language;
  const title =
    total === 1
      ? String(copy.deliveryBatchTitleSingular).replace("{language}", langLabel)
      : String(copy.deliveryBatchTitlePlural)
          .replace("{count}", String(total))
          .replace("{language}", langLabel);

  const progressCopy = String(copy.progressCount)
    .replace("{done}", String(done))
    .replace("{total}", String(total));

  const downloadOne = useCallback(
    async (fileSlotId: string) => {
      const it = jobItems.find((j) => j.fileSlotId === fileSlotId);
      if (!it) return;
      const blob = await api.generatePdf(it.invoiceId, language, bilingual);
      triggerBlobDownload(
        blob,
        `ksef-translation-${it.invoiceNumber || it.invoiceId}.pdf`
      );
    },
    [api, jobItems, language, bilingual]
  );

  const previewOne = useCallback(
    async (fileSlotId: string) => {
      // For v1, "Podgląd" just opens the PDF in a new tab — same blob as
      // the download, no extra round-trip. Full inline preview is a PR #D
      // polish item.
      const it = jobItems.find((j) => j.fileSlotId === fileSlotId);
      if (!it) return;
      const blob = await api.generatePdf(it.invoiceId, language, bilingual);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      // Don't revoke immediately — let the tab handle it. Most browsers
      // will GC eventually.
    },
    [api, jobItems, language, bilingual]
  );

  const downloadZip = useCallback(async () => {
    const ids = jobItems.filter((j) => j.status === "done").map((j) => j.invoiceId);
    if (ids.length === 0) return;
    const blob = await api.downloadZip(ids, language, bilingual);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-T:]/g, "").slice(0, 12);
    triggerBlobDownload(blob, `tlumaczenia-${stamp}.zip`);
  }, [api, jobItems, language, bilingual]);

  return (
    <div data-testid="delivery-batch" className="flex flex-col gap-4">
      {/* Sticky-feeling action bar: title + global controls grouped at the
          top so the user doesn't have to scroll past every row to find
          'Pobierz wszystkie' or 'Nowe tłumaczenie'. */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h1 className="truncate text-h3 text-text-strong">
            {title}
            {bilingual ? ` ${String(copy.deliveryBatchBilingual)}` : ""}
          </h1>
          <p className="text-small text-text-muted">{progressCopy}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {inflight ? (
            <button
              type="button"
              onClick={props.onCancelBatch}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-danger bg-surface px-4 text-small font-medium text-danger hover:bg-danger/5"
            >
              {String(copy.cancelBatchCta)}
            </button>
          ) : cancelled ? (
            <button
              type="button"
              onClick={() => void props.onResumeBatch()}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-accent bg-surface px-4 text-small font-medium text-accent hover:bg-accent-soft"
            >
              {String(copy.resumeBatchCta)}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void downloadZip()}
            disabled={done === 0}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-border disabled:text-text-muted",
              done > 0 && "cursor-pointer"
            )}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {String(copy.downloadAllZipCta)}
          </button>
          <button
            type="button"
            onClick={props.onChangeLanguage}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface px-5 text-small font-medium text-text-strong shadow-sm hover:bg-surface-muted"
          >
            <Languages className="h-4 w-4" aria-hidden="true" />
            {String(copy.translateAgainCta)}
          </button>
          <button
            type="button"
            onClick={props.onNewTranslation}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-5 text-small font-medium text-text-muted shadow-sm hover:bg-surface-muted"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {String(copy.newTranslationCta)}
          </button>
        </div>
      </header>

      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full bg-accent transition-all"
          style={{
            width: total === 0 ? "0%" : `${Math.round((done / total) * 100)}%`
          }}
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuetext={progressCopy}
        />
      </div>

      <ul className="flex flex-col gap-2">
        {jobItems.map((item) => (
          <TranslationRow
            key={item.fileSlotId}
            item={item}
            copy={copy}
            onDownload={downloadOne}
            onPreview={previewOne}
            onRetry={(slotId) => void props.onRetryItem(slotId)}
          />
        ))}
      </ul>

    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function PdfPreview({
  api,
  item,
  language,
  bilingual
}: {
  api: WizardApi;
  item: JobItem;
  language: LanguageCode;
  bilingual: boolean;
}) {
  // Minimal inline preview for PR #B — fetches the PDF and renders it
  // in an <iframe>. Full polish (loading skeleton, React fallback
  // component) lands in PR #D. We keep the file simple so PR #B reviews
  // focus on the wizard flow, not the rendering pipeline.
  const url = usePdfUrl(api, item.invoiceId, language, bilingual);
  if (!url) {
    return (
      <div className="flex h-full items-center justify-center text-small text-text-muted">
        Loading preview…
      </div>
    );
  }
  return (
    <iframe
      src={url}
      title={`Preview ${item.invoiceNumber || item.invoiceId}`}
      className="h-full w-full rounded-xl"
    />
  );
}

function usePdfUrl(
  api: WizardApi,
  invoiceId: string,
  language: LanguageCode,
  bilingual: boolean
): string | null {
  // Tiny inline hook so the PdfPreview body stays declarative.
  // Using dynamic `require` would be cleaner with SSR concerns; here we
  // rely on a useEffect for the fetch.
  const [url, setUrl] = useStateNullable<string>();
  useEffectFetchPdf(api, invoiceId, language, bilingual, setUrl);
  return url;
}

// Lightweight wrappers so the JSX above reads as configuration, not plumbing.
function useStateNullable<T>(): [T | null, (v: T | null) => void] {
  const [value, setValue] = useState<T | null>(null);
  return [value, setValue];
}
function useEffectFetchPdf(
  api: WizardApi,
  invoiceId: string,
  language: LanguageCode,
  bilingual: boolean,
  setUrl: (v: string | null) => void
) {
  useEffect(() => {
    let revoked = false;
    let createdUrl: string | null = null;
    api
      .generatePdf(invoiceId, language, bilingual)
      .then((blob) => {
        if (revoked) return;
        createdUrl = URL.createObjectURL(blob);
        setUrl(createdUrl);
      })
      .catch(() => {
        if (!revoked) setUrl(null);
      });
    return () => {
      revoked = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [api, invoiceId, language, bilingual, setUrl]);
}
