"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { InvoicePreview } from "@/components/invoice-preview";
import { WorkspaceToolbar } from "./workspace-toolbar";
import type { LanguageOption } from "./language-pills";
import type { Invoice, LanguageCode } from "@/types/invoice";
import type { WorkflowStatus, WorkspaceLanguageCode } from "./use-translator-workflow";

export interface WorkspaceInvoiceViewProps {
  invoice: Invoice;
  currentLanguage: WorkspaceLanguageCode;
  cachedLanguages: Set<LanguageCode>;
  bilingual: boolean;
  status: WorkflowStatus;
  previewPdfUrl: string | null;
  isPreparingPreview: boolean;
  onSelectLanguage(code: WorkspaceLanguageCode): void;
  onToggleBilingual(value: boolean): void;
  onDownloadPdf(): void;
  onNewInvoice(): void;
  bilingualLabel: string;
  downloadLabel: string;
  newInvoiceLabel: string;
  cachedLabel: string;
  moreLanguagesLabel: string;
  originalPolishLabel: string;
  languageOptions: ReadonlyArray<LanguageOption>;
}

export function WorkspaceInvoiceView(props: WorkspaceInvoiceViewProps) {
  // The PDF iframe (MF-compatible) is the primary surface. When the server-side
  // preview isn't ready yet (initial fetch or transient error), fall back to the
  // React InvoicePreview so the user is never staring at a blank page.
  const fallbackLanguage: LanguageCode =
    props.currentLanguage === "pl" ? "en" : props.currentLanguage;
  const fallbackBilingual = props.currentLanguage !== "pl" && props.bilingual;

  return (
    <div className="flex flex-col gap-4">
      <OfficialPdfPreview
        pdfUrl={props.previewPdfUrl}
        isLoading={props.isPreparingPreview}
        fallback={
          <InvoicePreview
            invoice={props.invoice}
            language={fallbackLanguage}
            bilingual={fallbackBilingual}
          />
        }
      />
      <WorkspaceToolbar
        currentLanguage={props.currentLanguage}
        cachedLanguages={props.cachedLanguages}
        bilingual={props.bilingual}
        status={props.status}
        onSelectLanguage={props.onSelectLanguage}
        onToggleBilingual={props.onToggleBilingual}
        onDownloadPdf={props.onDownloadPdf}
        onNewInvoice={props.onNewInvoice}
        bilingualLabel={props.bilingualLabel}
        downloadLabel={props.downloadLabel}
        newInvoiceLabel={props.newInvoiceLabel}
        cachedLabel={props.cachedLabel}
        moreLanguagesLabel={props.moreLanguagesLabel}
        originalPolishLabel={props.originalPolishLabel}
        languageOptions={props.languageOptions}
      />
    </div>
  );
}

function OfficialPdfPreview({
  pdfUrl,
  isLoading,
  fallback
}: {
  pdfUrl: string | null;
  isLoading: boolean;
  fallback: ReactNode;
}) {
  if (pdfUrl) {
    const previewSrc = `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&zoom=page-width`;
    return (
      <div className="pb-4">
        <iframe
          title="Invoice PDF preview"
          src={previewSrc}
          className="mx-auto h-[calc(100vh-120px)] min-h-[760px] w-full max-w-5xl border border-slate-300 bg-white shadow-soft"
        />
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-600">
        <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-cyan-700" />
        Preparing MF-compatible PDF preview...
      </div>
    );
  }
  return <>{fallback}</>;
}
