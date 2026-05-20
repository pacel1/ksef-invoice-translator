"use client";

import { useRef } from "react";
import { Info, UploadCloud } from "lucide-react";
import type { Copy } from "@/lib/workspace/copy";
import type {
  FileSlot,
  WizardApi
} from "./use-translation-wizard";
import { UploadFileRow } from "./upload-file-row";
import { cn } from "@/lib/utils";

export interface UploadStepProps {
  files: ReadonlyArray<FileSlot>;
  copy: Copy;
  onAddFiles: (files: ReadonlyArray<File>) => Promise<void> | void;
  onRemoveFile: (localId: string) => void;
  onClearAll: () => void;
  onNext: () => void;
}

// Re-export for the orchestrator's type-only imports.
export type { WizardApi };

/**
 * Step 1: file collection. Two layouts share a single component so
 * the user doesn't re-learn the page after the first drop.
 *
 *   - Empty state    → hero drop zone, helper, trust notice
 *   - Files present  → compact drop zone (left) + file list (right)
 *
 * Continue button is enabled iff ≥1 file is in 'ready' state. Files
 * in 'parsing' or 'error' don't block — the user can either wait or
 * remove. Files in 'duplicate' status count as ready (server already
 * accepted them; no credit will be consumed downstream).
 */
export function UploadStep({
  files,
  copy,
  onAddFiles,
  onRemoveFile,
  onClearAll,
  onNext
}: UploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isEmpty = files.length === 0;

  function pickFiles() {
    inputRef.current?.click();
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const list = event.target.files;
    if (!list || list.length === 0) return;
    void onAddFiles(Array.from(list));
    event.target.value = "";
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const list = event.dataTransfer.files;
    if (!list || list.length === 0) return;
    void onAddFiles(Array.from(list));
  }

  const readyCount = files.filter(
    (slot) => slot.status === "ready" || slot.status === "duplicate"
  ).length;
  const canContinue = readyCount > 0;

  const countCopy =
    readyCount === 1
      ? String(copy.filesReadyCountSingular)
      : String(copy.filesReadyCountPlural).replace(
          "{count}",
          String(readyCount)
        );

  return (
    <div data-testid="wizard-step-upload" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-strong">{String(copy.uploadHeading)}</h1>
        <p className="text-body text-text-muted">{String(copy.uploadHelpMulti)}</p>
      </header>

      {isEmpty ? (
        <>
          <div
            data-testid="upload-dropzone"
            role="button"
            tabIndex={0}
            aria-label={String(copy.uploadHeading)}
            onClick={pickFiles}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                pickFiles();
              }
            }}
            className={cn(
              "flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-strong bg-surface px-6 py-12 text-center shadow-sm transition-colors duration-hover hover:border-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            )}
          >
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
              <UploadCloud className="h-7 w-7" aria-hidden="true" />
            </div>
            <p className="text-h3 text-text-strong">{String(copy.uploadDropHint)}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                pickFiles();
              }}
              className="mt-5 inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm transition-colors duration-hover hover:bg-accent-hover"
            >
              {String(copy.uploadCta)}
            </button>
            <p className="mt-4 text-small text-text-muted">
              {String(copy.uploadFormatHint)}
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".xml,application/xml,text/xml,.pdf,application/pdf"
              className="sr-only"
              onChange={onInputChange}
            />
          </div>

          <p className="flex items-start gap-2 rounded-lg bg-surface-muted px-4 py-3 text-small text-text">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-text-muted"
              aria-hidden="true"
            />
            <span>{String(copy.dataImmutableNotice)}</span>
          </p>
        </>
      ) : (
        <div className="grid gap-6 md:grid-cols-5">
          {/* Compact add-more drop zone — left, 2/5 cols */}
          <div className="md:col-span-2">
            <div
              data-testid="upload-dropzone"
              role="button"
              tabIndex={0}
              aria-label={String(copy.addMoreFiles)}
              onClick={pickFiles}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pickFiles();
                }
              }}
              className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface px-4 py-6 text-center transition-colors duration-hover hover:border-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <UploadCloud className="h-5 w-5 text-accent" aria-hidden="true" />
              <span className="text-small font-medium text-text-strong">
                {String(copy.addMoreFiles)}
              </span>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".xml,application/xml,text/xml,.pdf,application/pdf"
                className="sr-only"
                onChange={onInputChange}
              />
            </div>
          </div>

          {/* File list — right, 3/5 cols */}
          <div className="md:col-span-3">
            <div className="flex items-center justify-between">
              <p className="text-small font-medium text-text-strong">
                {countCopy}
              </p>
              <button
                type="button"
                onClick={onClearAll}
                className="text-small font-medium text-text-muted hover:text-text-strong cursor-pointer"
              >
                {String(copy.clearAllCta)}
              </button>
            </div>
            <ul data-testid="upload-file-list" className="mt-3 flex flex-col gap-2">
              {files.map((slot) => (
                <UploadFileRow
                  key={slot.localId}
                  slot={slot}
                  copy={copy}
                  onRemove={onRemoveFile}
                />
              ))}
            </ul>
          </div>
        </div>
      )}

      <footer className="flex items-center justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm transition-colors duration-hover hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:bg-border disabled:text-text-muted",
            canContinue && "cursor-pointer"
          )}
        >
          {String(copy.continueCta)}
        </button>
      </footer>
    </div>
  );
}
