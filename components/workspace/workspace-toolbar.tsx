"use client";

import { Download, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguagePills, type LanguageOption } from "./language-pills";
import type { LanguageCode } from "@/types/invoice";
import type { WorkflowStatus } from "./use-translator-workflow";

export interface WorkspaceToolbarProps {
  currentLanguage: LanguageCode;
  cachedLanguages: Set<LanguageCode>;
  bilingual: boolean;
  status: WorkflowStatus;
  onSelectLanguage(code: LanguageCode): void;
  onToggleBilingual(value: boolean): void;
  onDownloadPdf(): void;
  onNewInvoice(): void;
  bilingualLabel: string;
  downloadLabel: string;
  newInvoiceLabel: string;
  cachedLabel: string;
  moreLanguagesLabel: string;
  languageOptions: ReadonlyArray<LanguageOption>;
}

export function WorkspaceToolbar({
  currentLanguage,
  cachedLanguages,
  bilingual,
  status,
  onSelectLanguage,
  onToggleBilingual,
  onDownloadPdf,
  onNewInvoice,
  bilingualLabel,
  downloadLabel,
  newInvoiceLabel,
  cachedLabel,
  moreLanguagesLabel,
  languageOptions
}: WorkspaceToolbarProps) {
  const translating = status === "translating";
  const generatingPdf = status === "generating-pdf";

  return (
    <div
      role="region"
      aria-label={downloadLabel}
      className="sticky bottom-0 z-10 -mx-5 mt-4 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/70 md:-mx-8 md:px-8"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <LanguagePills
          current={currentLanguage}
          cached={cachedLanguages}
          translating={translating}
          onSelect={onSelectLanguage}
          cachedLabel={cachedLabel}
          moreLanguagesLabel={moreLanguagesLabel}
          allLanguageOptions={languageOptions}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-medium text-cyan-900">
            <input
              type="checkbox"
              checked={bilingual}
              onChange={(event) => onToggleBilingual(event.target.checked)}
              className="h-4 w-4 rounded border-cyan-300 text-cyan-700 focus:ring-cyan-700"
            />
            {bilingualLabel}
          </label>
          <Button variant="outline" onClick={onNewInvoice}>
            <Plus className="h-4 w-4" />
            {newInvoiceLabel}
          </Button>
          <Button onClick={onDownloadPdf} disabled={generatingPdf}>
            {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloadLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
