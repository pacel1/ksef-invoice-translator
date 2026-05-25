"use client";

import { AlertCircle, CheckCircle2, Circle, Download, Eye, Loader2, RotateCw } from "lucide-react";
import type { Copy } from "@/lib/workspace/copy";
import type { JobItem } from "./use-translation-wizard";
import { cn } from "@/lib/utils";

export interface TranslationRowProps {
  item: JobItem;
  copy: Copy;
  onDownload: (fileSlotId: string) => void;
  onPreview: (fileSlotId: string) => void;
  onRetry: (fileSlotId: string) => void;
  /**
   * Optional row-level handler invoked when the user clicks anywhere on
   * the body of a done row (outside the action buttons). Used to open
   * the same single-invoice editor the one-file flow exposes, so users
   * can edit fields directly from the batch results table.
   */
  onOpenEditor?: (fileSlotId: string) => void;
}

/**
 * One row in the batch delivery list. Status-driven affordances:
 *   queued      → muted dot + "w kolejce"
 *   translating → spinner + "tłumaczę…"
 *   done        → green check + duration + Podgląd + Pobierz (+ "Z cache"
 *                 badge if creditConsumed=false)
 *   error       → red dot + error message + Ponów
 */
export function TranslationRow({
  item,
  copy,
  onDownload,
  onPreview,
  onRetry,
  onOpenEditor
}: TranslationRowProps) {
  const clickable = item.status === "done" && Boolean(onOpenEditor);

  function handleBodyClick() {
    if (clickable) onOpenEditor?.(item.fileSlotId);
  }

  function handleBodyKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenEditor?.(item.fileSlotId);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-md",
          clickable &&
            "cursor-pointer hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        )}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-label={
          clickable ? String(copy.editTranslationCta) : undefined
        }
        onClick={handleBodyClick}
        onKeyDown={handleBodyKey}
      >
        <StatusIcon status={item.status} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body text-text-strong">
            {item.invoiceNumber || item.invoiceId}
          </p>
          <p className="truncate text-small text-text-muted">
            <Secondary item={item} copy={copy} />
          </p>
        </div>
      </div>
      <RowActions
        item={item}
        copy={copy}
        onDownload={onDownload}
        onPreview={onPreview}
        onRetry={onRetry}
      />
    </li>
  );
}

function StatusIcon({ status }: { status: JobItem["status"] }) {
  switch (status) {
    case "queued":
      return <Circle className="h-5 w-5 shrink-0 text-text-muted" aria-hidden="true" />;
    case "translating":
      return (
        <Loader2
          className="h-5 w-5 shrink-0 animate-spin text-accent"
          data-testid="row-spinner"
          aria-hidden="true"
        />
      );
    case "done":
      return <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />;
    case "error":
      return <AlertCircle className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />;
    default: {
      const _exhaustive: never = status;
      void _exhaustive;
      return null;
    }
  }
}

function Secondary({ item, copy }: { item: JobItem; copy: Copy }) {
  switch (item.status) {
    case "queued":
      return <>{String(copy.queuedLabel)}</>;
    case "translating":
      return <>{String(copy.translatingLabel)}</>;
    case "done": {
      const seconds = item.durationMs ? Math.max(1, Math.round(item.durationMs / 1000)) : null;
      return (
        <span className="inline-flex items-center gap-2">
          {seconds ? <span>{seconds} s</span> : null}
          {item.creditConsumed === false ? (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-micro font-medium text-warning">
              {String(copy.cacheHitBadge)}
            </span>
          ) : null}
        </span>
      );
    }
    case "error":
      return <>{item.errorMessage ?? "Translation failed"}</>;
    default: {
      const _exhaustive: never = item.status;
      void _exhaustive;
      return null;
    }
  }
}

interface RowActionsProps {
  item: JobItem;
  copy: Copy;
  onDownload: (fileSlotId: string) => void;
  onPreview: (fileSlotId: string) => void;
  onRetry: (fileSlotId: string) => void;
}

function RowActions({ item, copy, onDownload, onPreview, onRetry }: RowActionsProps) {
  if (item.status === "done") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPreview(item.fileSlotId)}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-small font-medium text-text-strong hover:bg-surface-muted"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          {String(copy.previewCta)}
        </button>
        <button
          type="button"
          onClick={() => onDownload(item.fileSlotId)}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3 text-small font-medium text-white hover:bg-accent-hover"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {String(copy.downloadCta)}
        </button>
      </div>
    );
  }
  if (item.status === "error") {
    return (
      <button
        type="button"
        onClick={() => onRetry(item.fileSlotId)}
        className={cn(
          "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-danger bg-surface px-3 text-small font-medium text-danger hover:bg-danger/5"
        )}
      >
        <RotateCw className="h-4 w-4" aria-hidden="true" />
        {String(copy.retryCta)}
      </button>
    );
  }
  return null;
}
