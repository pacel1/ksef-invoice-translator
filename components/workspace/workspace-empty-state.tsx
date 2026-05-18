"use client";

import { useRef } from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";

export interface WorkspaceEmptyStateProps {
  uploading: boolean;
  onFile: (file: File) => void;
  uploadTitle: string;
  uploadHelp: string;
  parsingLabel: string;
  onboardingTitle: string;
  onboardingItems: ReadonlyArray<string>;
  /** Optional — only renders the button when both this and `sampleLabel` are provided. */
  onLoadSample?: () => void;
  sampleLabel?: string;
}

export function WorkspaceEmptyState({
  uploading,
  onFile,
  uploadTitle,
  uploadHelp,
  parsingLabel,
  onboardingTitle,
  onboardingItems,
  onLoadSample,
  sampleLabel
}: WorkspaceEmptyStateProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onPickFile() {
    inputRef.current?.click();
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = "";
  }

  return (
    <section className="mt-6 grid gap-6 md:grid-cols-5">
      {/* Drop zone — 3/5 cols */}
      <div className="md:col-span-3">
        <div
          onClick={() => {
            if (!uploading) onPickFile();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file && !uploading) onFile(file);
          }}
          aria-disabled={uploading}
          aria-label={uploadTitle}
          role="button"
          tabIndex={uploading ? -1 : 0}
          onKeyDown={(e) => {
            if (uploading) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPickFile();
            }
          }}
          className={`flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-surface px-6 py-12 text-center shadow-sm transition-colors ${
            uploading
              ? "border-border opacity-60"
              : "border-border-strong hover:border-accent hover:bg-accent-soft"
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-accent" />
              <p className="text-body text-text">{parsingLabel}</p>
            </>
          ) : (
            <>
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
                <UploadCloud className="h-7 w-7" aria-hidden="true" />
              </div>
              <p className="text-h3 text-text-strong">{uploadTitle}</p>
              <p className="mt-2 max-w-md text-small text-text-muted">{uploadHelp}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPickFile();
                }}
                className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
              >
                {uploadTitle.includes("KSeF") ? "Wybierz plik" : "Choose file"}
              </button>
              {onLoadSample && sampleLabel ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadSample();
                  }}
                  className="mt-3 inline-flex text-small font-medium text-accent hover:text-accent-hover"
                >
                  {sampleLabel} →
                </button>
              ) : null}
              <input
                ref={inputRef}
                type="file"
                accept=".xml,application/xml,text/xml,.pdf,application/pdf"
                className="sr-only"
                onChange={onChange}
              />
            </>
          )}
        </div>
      </div>

      {/* Onboarding panel — 2/5 cols */}
      <aside className="md:col-span-2">
        <div className="rounded-xl border border-border bg-surface-muted p-6">
          <h3 className="text-micro uppercase tracking-wide text-text-muted">{onboardingTitle}</h3>
          <ul className="mt-4 space-y-3">
            {onboardingItems.map((item) => (
              <li key={item} className="flex items-start gap-3 text-small text-text">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </section>
  );
}
