"use client";

import { InvoicePreview } from "@/components/invoice-preview";
import { WorkspaceToolbar } from "./workspace-toolbar";
import type { LanguageOption } from "./language-pills";
import type { Invoice, LanguageCode } from "@/types/invoice";
import type { WorkflowStatus } from "./use-translator-workflow";

export interface WorkspaceInvoiceViewProps {
  invoice: Invoice;
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

export function WorkspaceInvoiceView(props: WorkspaceInvoiceViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <InvoicePreview
        invoice={props.invoice}
        language={props.currentLanguage}
        bilingual={props.bilingual}
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
        languageOptions={props.languageOptions}
      />
    </div>
  );
}
