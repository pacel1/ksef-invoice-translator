"use client";

import { useEffect, useState } from "react";
import type { Invoice, LanguageCode } from "@/types/invoice";

export type WorkspaceLanguageCode = LanguageCode | "pl";

export type WorkflowStatus = "idle" | "uploading" | "translating" | "generating-pdf";

export interface UseTranslatorWorkflowResult {
  invoice: Invoice | null;
  invoiceId: string | null;
  status: WorkflowStatus;
  messages: string[];
  previewPdfUrl: string | null;
  isPreparingPreview: boolean;
  upload(file: File): Promise<void>;
  translate(language: WorkspaceLanguageCode, bilingual: boolean): Promise<void>;
  downloadPdf(language: WorkspaceLanguageCode, bilingual: boolean): Promise<void>;
  reset(): void;
}

export function useTranslatorWorkflow(): UseTranslatorWorkflowResult {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [sourceInvoice, setSourceInvoice] = useState<Invoice | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [messages, setMessages] = useState<string[]>([]);
  const [previewLanguage, setPreviewLanguage] = useState<WorkspaceLanguageCode>("pl");
  const [previewBilingual, setPreviewBilingual] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isPreparingPreview, setIsPreparingPreview] = useState(false);

  useEffect(() => {
    if (!invoiceId || !invoice) {
      setPreviewPdfUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return null;
      });
      setIsPreparingPreview(false);
      return;
    }

    const controller = new AbortController();
    let nextUrl: string | null = null;
    setIsPreparingPreview(true);

    fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId,
        language: previewLanguage,
        bilingual: previewLanguage !== "pl" && previewBilingual,
        translated: previewLanguage !== "pl"
      }),
      signal: controller.signal
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("PDF preview generation failed");
        const blob = await res.blob();
        nextUrl = URL.createObjectURL(blob);
        setPreviewPdfUrl((currentUrl) => {
          if (currentUrl) URL.revokeObjectURL(currentUrl);
          return nextUrl;
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.warn("[workspace] preview PDF failed:", error);
        setPreviewPdfUrl((currentUrl) => {
          if (currentUrl) URL.revokeObjectURL(currentUrl);
          return null;
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsPreparingPreview(false);
      });

    return () => {
      controller.abort();
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [invoiceId, invoice, previewLanguage, previewBilingual]);

  async function upload(file: File) {
    setMessages([]);
    setStatus("uploading");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Upload failed");
      }
      setInvoice(payload.invoice);
      setSourceInvoice(payload.invoice);
      setInvoiceId(payload.invoiceId);
      setMessages(payload.warnings ?? []);
    } catch (error) {
      setInvoice(null);
      setSourceInvoice(null);
      setInvoiceId(null);
      setMessages([error instanceof Error ? error.message : "Upload failed"]);
    } finally {
      setStatus("idle");
    }
  }

  async function translate(language: WorkspaceLanguageCode, bilingual: boolean) {
    if (!invoiceId) return;
    setPreviewLanguage(language);
    setPreviewBilingual(language !== "pl" && bilingual);
    if (language === "pl") {
      setInvoice(sourceInvoice);
      return;
    }
    setStatus("translating");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, language, bilingual })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Translation failed");
      }
      setInvoice(payload.invoice);
    } catch (error) {
      setMessages([error instanceof Error ? error.message : "Translation failed"]);
    } finally {
      setStatus("idle");
    }
  }

  async function downloadPdf(language: WorkspaceLanguageCode, bilingual: boolean) {
    if (!invoiceId || !invoice) return;
    setStatus("generating-pdf");
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, language, bilingual: language !== "pl" && bilingual, translated: language !== "pl" })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "PDF generation failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ksef-invoice-${invoice.invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessages([error instanceof Error ? error.message : "PDF generation failed"]);
    } finally {
      setStatus("idle");
    }
  }

  function reset() {
    setInvoice(null);
    setSourceInvoice(null);
    setInvoiceId(null);
    setMessages([]);
    setStatus("idle");
  }

  return { invoice, invoiceId, status, messages, previewPdfUrl, isPreparingPreview, upload, translate, downloadPdf, reset };
}
