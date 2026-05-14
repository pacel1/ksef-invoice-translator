"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Download, Languages, Loader2, ScanLine, UploadCloud } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InvoicePreview } from "@/components/invoice-preview";
import { copy, type UiLanguage } from "@/lib/workspace/copy";
import { getLanguageOptions } from "@/lib/translation/languages";
import { useTranslatorWorkflow, type WorkspaceLanguageCode } from "./use-translator-workflow";
import { InsufficientCreditModal } from "./insufficient-credit-modal";

export interface TranslatorWorkspaceProps {
  uiLanguage?: UiLanguage;
}

export function TranslatorWorkspace({ uiLanguage = "pl" }: TranslatorWorkspaceProps) {
  const t = copy[uiLanguage];
  const [language, setLanguage] = useState<WorkspaceLanguageCode>("pl");
  const [bilingual, setBilingual] = useState(true);
  const {
    invoice,
    status,
    messages,
    insufficientCredit,
    previewPdfUrl,
    isPreparingPreview,
    upload,
    translate,
    downloadPdf,
    dismissInsufficientCredit
  } = useTranslatorWorkflow();

  const languageOptions = useMemo(() => getLanguageOptions(uiLanguage), [uiLanguage]);
  const selectedLanguage =
    language === "pl" ? "PL" : languageOptions.find((option) => option.code === language)?.label ?? language;
  const originalPolishOption = uiLanguage === "pl" ? "Oryginal PL" : "Original PL";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-soft md:flex-row md:items-center md:justify-between">
        <div className="grid gap-2 sm:grid-cols-[220px_auto] sm:items-center">
          <label htmlFor="language" className="text-sm font-medium text-slate-700">
            {String(t.targetLanguage)}
          </label>
          <select
            id="language"
            value={language}
            onChange={(event) => {
              const nextLanguage = event.target.value as WorkspaceLanguageCode;
              setLanguage(nextLanguage);
              if (invoice) void translate(nextLanguage, bilingual);
            }}
            className="h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="pl">{originalPolishOption}</option>
            {languageOptions.map((option) => (
              <option key={option.code} value={option.code}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-medium text-cyan-900">
            <input
              type="checkbox"
              checked={bilingual}
              disabled={language === "pl"}
              onChange={(event) => {
                setBilingual(event.target.checked);
                if (invoice && language !== "pl") void translate(language, event.target.checked);
              }}
              className="h-4 w-4 rounded border-cyan-300 text-cyan-700 focus:ring-cyan-700"
            />
            {String(t.bilingual)}
          </label>
          <Button
            onClick={() => translate(language, bilingual)}
            disabled={!invoice || language === "pl" || status === "translating"}
            variant="outline"
          >
            {status === "translating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
            {String(t.translate)}
          </Button>
          <Button
            onClick={() => downloadPdf(language, bilingual)}
            disabled={!invoice || status === "generating-pdf"}
          >
            {status === "generating-pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {String(t.download)}
          </Button>
        </div>
      </div>

      {messages.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          {messages.map((message) => <p key={message}>{message}</p>)}
        </div>
      ) : null}

      {!invoice ? (
        <DropZone onFile={(f) => f && upload(f)} title={String(t.uploadTitle)} help={String(t.uploadHelp)} disabled={status === "uploading"} />
      ) : null}

      {status === "uploading" ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-600">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-cyan-700" />
          {String(t.parsing)}
        </div>
      ) : invoice ? (
        <OfficialPdfPreview
          pdfUrl={previewPdfUrl}
          isLoading={isPreparingPreview}
          fallback={<InvoicePreview invoice={invoice} language={language === "pl" ? "en" : language} bilingual={language !== "pl" && bilingual} />}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-600">
          <ScanLine className="mx-auto mb-3 h-8 w-8 text-cyan-700" />
          {String(t.empty)} {selectedLanguage}.
          <p className="mt-4 text-xs text-slate-500">
            <Link className="font-medium underline" href="/">← {uiLanguage === "pl" ? "Strona główna" : "Home"}</Link>
          </p>
        </div>
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

function DropZone({
  onFile,
  title,
  help,
  disabled
}: {
  onFile: (file?: File) => void;
  title: string;
  help: string;
  disabled?: boolean;
}) {
  return (
    <label
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (!disabled) onFile(event.dataTransfer.files[0]);
      }}
      aria-disabled={disabled}
      className={`flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center transition-colors ${disabled ? "opacity-60" : "hover:border-cyan-700 hover:bg-cyan-50/40"}`}
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
        disabled={disabled}
        onChange={(event) => onFile(event.target.files?.[0])}
      />
    </label>
  );
}
