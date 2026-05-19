"use client";

import { useEffect, useMemo, useRef } from "react";
import { copy, type UiLanguage } from "@/lib/workspace/copy";
import { getLanguageOptions } from "@/lib/translation/languages";
import { useTranslatorWorkflow } from "./use-translator-workflow";
import { InsufficientCreditModal } from "./insufficient-credit-modal";
import { WorkspaceEmptyState } from "./workspace-empty-state";
import { WorkspaceInvoiceView } from "./workspace-invoice-view";

export interface TranslatorWorkspaceProps {
  uiLanguage?: UiLanguage;
}

export function TranslatorWorkspace({ uiLanguage = "pl" }: TranslatorWorkspaceProps) {
  const t = copy[uiLanguage];
  const {
    invoice,
    invoiceId,
    status,
    messages,
    insufficientCredit,
    currentLanguage,
    bilingual,
    cachedLanguages,
    previewPdfUrl,
    isPreparingPreview,
    setCurrentLanguage,
    setBilingual,
    upload,
    loadSample,
    translateCurrent,
    downloadPdf,
    dismissInsufficientCredit,
    reset
  } = useTranslatorWorkflow();

  const languageOptions = useMemo(() => getLanguageOptions(uiLanguage), [uiLanguage]);

  // Auto-translate when the user picks a non-PL language that isn't cached yet.
  // The "pl" branch is the source invoice (no API call needed); the hook handles
  // restoring source on setCurrentLanguage("pl").
  const lastTriedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!invoice) return;
    if (!invoiceId) return;
    if (currentLanguage === "pl") return;
    if (cachedLanguages.has(currentLanguage)) return;
    if (status !== "idle") return;
    const key = `${invoiceId}:${currentLanguage}:${bilingual ? "bilingual" : "translated"}`;
    if (lastTriedRef.current === key) return;
    lastTriedRef.current = key;
    void translateCurrent();
  }, [invoice, invoiceId, currentLanguage, bilingual, cachedLanguages, status, translateCurrent]);

  const onboardingItems = [
    String(t.onboardingItem1),
    String(t.onboardingItem2),
    String(t.onboardingItem3),
    String(t.onboardingItem4)
  ];

  return (
    <section className="flex flex-col gap-6">
      {messages.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          {messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}

      {invoice ? (
        <WorkspaceInvoiceView
          invoice={invoice}
          currentLanguage={currentLanguage}
          cachedLanguages={cachedLanguages}
          bilingual={bilingual}
          status={status}
          previewPdfUrl={previewPdfUrl}
          isPreparingPreview={isPreparingPreview}
          onSelectLanguage={setCurrentLanguage}
          onToggleBilingual={setBilingual}
          onDownloadPdf={downloadPdf}
          onNewInvoice={reset}
          bilingualLabel={String(t.bilingual)}
          downloadLabel={String(t.download)}
          newInvoiceLabel={String(t.newInvoice)}
          cachedLabel={String(t.cached)}
          moreLanguagesLabel={String(t.moreLanguages)}
          originalPolishLabel={String(t.originalPolish)}
          languageOptions={languageOptions}
        />
      ) : (
        <WorkspaceEmptyState
          uploading={status === "uploading"}
          onFile={(f) => f && upload(f)}
          uploadTitle={String(t.uploadTitle)}
          uploadHelp={String(t.uploadHelp)}
          parsingLabel={String(t.parsing)}
          onboardingTitle={String(t.onboardingTitle)}
          onboardingItems={onboardingItems}
          onLoadSample={loadSample}
          sampleLabel={String(t.tryWithSample)}
        />
      )}

      <InsufficientCreditModal
        open={insufficientCredit}
        title={String(t.outOfCreditsTitle)}
        body={String(t.outOfCreditsBody)}
        buyLabel={String(t.buyCredits)}
        cancelLabel={String(t.cancel)}
        onClose={dismissInsufficientCredit}
      />
    </section>
  );
}
