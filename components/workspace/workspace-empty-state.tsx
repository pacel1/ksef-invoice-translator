"use client";

import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";

export interface WorkspaceEmptyStateProps {
  uploading: boolean;
  onFile(file?: File): void;
  uploadTitle: string;
  uploadHelp: string;
  parsingLabel: string;
  onboardingTitle: string;
  onboardingItems: ReadonlyArray<string>;
}

export function WorkspaceEmptyState({
  uploading,
  onFile,
  uploadTitle,
  uploadHelp,
  parsingLabel,
  onboardingTitle,
  onboardingItems
}: WorkspaceEmptyStateProps) {
  return (
    <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
      <DropZone
        uploading={uploading}
        onFile={onFile}
        title={uploadTitle}
        help={uploadHelp}
        parsingLabel={parsingLabel}
      />
      <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {onboardingTitle}
        </h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-700">
          {onboardingItems.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function DropZone({
  uploading,
  onFile,
  title,
  help,
  parsingLabel
}: {
  uploading: boolean;
  onFile: (file?: File) => void;
  title: string;
  help: string;
  parsingLabel: string;
}) {
  if (uploading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-600">
        <div>
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-cyan-700" />
          {parsingLabel}
        </div>
      </div>
    );
  }
  return (
    <label
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onFile(event.dataTransfer.files[0]);
      }}
      className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center transition-colors hover:border-cyan-700 hover:bg-cyan-50/40"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
        <UploadCloud className="h-6 w-6" />
      </div>
      <span className="mt-4 text-base font-semibold text-slate-950">{title}</span>
      <span className="mt-2 text-sm text-slate-500">{help}</span>
      <input
        type="file"
        accept=".xml,application/xml,text/xml,.pdf,application/pdf"
        className="sr-only"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
    </label>
  );
}
