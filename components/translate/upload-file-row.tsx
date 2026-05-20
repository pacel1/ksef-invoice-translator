"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import type { Copy } from "@/lib/workspace/copy";
import type { FileSlot } from "./use-translation-wizard";
import { cn } from "@/lib/utils";

export interface UploadFileRowProps {
  slot: FileSlot;
  copy: Copy;
  onRemove: (localId: string) => void;
}

/**
 * One row in the upload-step file list. Visually compact — the primary
 * label is the parsed invoice number when available, falling back to
 * the raw filename while parsing.
 *
 * State-driven visuals (spec §3.3):
 *   parsing   → spinner + filename + "Sprawdzam…"
 *   ready     → green check + invoice number + file size
 *   error     → red dot + filename + error message
 *   duplicate → amber dot + filename + "Już była tłumaczona"
 *
 * All four states keep the "×" remove button so the user can drop
 * any row, including ones in error.
 */
export function UploadFileRow({ slot, copy, onRemove }: UploadFileRowProps) {
  // While parsing/erroring we don't trust invoiceNumber yet — fall back to
  // the raw filename so the user always sees a stable identifier.
  const showInvoiceNumber =
    (slot.status === "ready" || slot.status === "duplicate") &&
    typeof slot.invoiceNumber === "string" &&
    slot.invoiceNumber.length > 0;
  const primaryLabel = showInvoiceNumber
    ? (slot.invoiceNumber as string)
    : slot.file.name;
  const removeLabel = String(copy.removeFileLabel).replace(
    "{filename}",
    slot.file.name
  );

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <StatusIcon status={slot.status} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body text-text-strong">{primaryLabel}</p>
          <p className="truncate text-small text-text-muted">
            <SecondaryLine slot={slot} copy={copy} />
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(slot.localId)}
        aria-label={removeLabel}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors duration-hover hover:bg-surface-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

function StatusIcon({ status }: { status: FileSlot["status"] }) {
  switch (status) {
    case "parsing":
      return (
        <Loader2
          className="h-5 w-5 shrink-0 animate-spin text-accent"
          data-testid="file-row-spinner"
          aria-hidden="true"
        />
      );
    case "ready":
      return (
        <CheckCircle2
          className="h-5 w-5 shrink-0 text-success"
          data-testid="file-row-check"
          aria-hidden="true"
        />
      );
    case "error":
      return (
        <AlertCircle
          className="h-5 w-5 shrink-0 text-danger"
          data-testid="file-row-error"
          aria-hidden="true"
        />
      );
    case "duplicate":
      return (
        <AlertTriangle
          className="h-5 w-5 shrink-0 text-warning"
          data-testid="file-row-warning"
          aria-hidden="true"
        />
      );
    default: {
      const _exhaustive: never = status;
      void _exhaustive;
      return null;
    }
  }
}

function SecondaryLine({ slot, copy }: { slot: FileSlot; copy: Copy }) {
  switch (slot.status) {
    case "parsing":
      return <>{String(copy.parsingRow)}</>;
    case "ready":
      return (
        <span className={cn("inline-flex gap-2")}>
          <span>{slot.file.name}</span>
          <span aria-hidden="true">·</span>
          <span>{formatBytes(slot.file.size)}</span>
        </span>
      );
    case "error":
      return <>{slot.errorMessage ?? "Translation failed"}</>;
    case "duplicate":
      return <>{String(copy.duplicateRow)}</>;
    default: {
      const _exhaustive: never = slot.status;
      void _exhaustive;
      return null;
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
