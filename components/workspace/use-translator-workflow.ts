"use client";

import { useCallback, useEffect, useState } from "react";
import type { Invoice, LanguageCode } from "@/types/invoice";

export type WorkspaceLanguageCode = LanguageCode | "pl";

export type WorkflowStatus = "idle" | "uploading" | "translating" | "generating-pdf";

export interface UseTranslatorWorkflowResult {
  invoice: Invoice | null;
  invoiceId: string | null;
  status: WorkflowStatus;
  messages: string[];
  insufficientCredit: boolean;
  currentLanguage: WorkspaceLanguageCode;
  bilingual: boolean;
  cachedLanguages: Set<LanguageCode>;
  previewPdfUrl: string | null;
  isPreparingPreview: boolean;
  setCurrentLanguage(lang: WorkspaceLanguageCode): void;
  setBilingual(value: boolean): void;
  upload(file: File): Promise<void>;
  loadSample(): Promise<void>;
  translateCurrent(): Promise<void>;
  downloadPdf(): Promise<void>;
  dismissInsufficientCredit(): void;
  reset(): void;
}

/**
 * Default language is "pl" — the user sees the official MF-compatible Polish
 * layout immediately on upload (no translation cost). They click a language pill
 * to translate.
 */
const DEFAULT_LANGUAGE: WorkspaceLanguageCode = "pl";

export function useTranslatorWorkflow(): UseTranslatorWorkflowResult {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [sourceInvoice, setSourceInvoice] = useState<Invoice | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [messages, setMessages] = useState<string[]>([]);
  const [insufficientCredit, setInsufficientCredit] = useState(false);
  const [currentLanguage, setCurrentLanguageState] = useState<WorkspaceLanguageCode>(DEFAULT_LANGUAGE);
  const [bilingual, setBilingualState] = useState(true);
  const [cachedLanguages, setCachedLanguages] = useState<Set<LanguageCode>>(new Set());
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isPreparingPreview, setIsPreparingPreview] = useState(false);

  // PDF preview pipeline — regenerates whenever the selected language/bilingual
  // changes. Skips non-"pl" languages until their translation is cached, so the
  // /api/pdf call never races ahead of /api/translate.
  useEffect(() => {
    if (!invoiceId || !invoice) {
      setPreviewPdfUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return null;
      });
      setIsPreparingPreview(false);
      return;
    }
    if (currentLanguage !== "pl" && !cachedLanguages.has(currentLanguage)) {
      // Translation not yet available — preview useEffect will re-fire once it
      // lands in cachedLanguages.
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
        language: currentLanguage,
        bilingual: currentLanguage !== "pl" && bilingual,
        translated: currentLanguage !== "pl",
        preview: true
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
  }, [invoiceId, invoice, currentLanguage, bilingual, cachedLanguages]);

  function notifyBalanceChanged() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("credit-balance-changed"));
    }
  }

  const setCurrentLanguage = useCallback((lang: WorkspaceLanguageCode) => {
    setCurrentLanguageState(lang);
    // Instant switch back to the source invoice when the user picks PL.
    if (lang === "pl") {
      setInvoice((prev) => sourceInvoice ?? prev);
    }
  }, [sourceInvoice]);

  const setBilingual = useCallback((value: boolean) => {
    setBilingualState(value);
  }, []);

  async function upload(file: File) {
    setMessages([]);
    setStatus("uploading");
    setInsufficientCredit(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });

      if (res.status === 402) {
        setInsufficientCredit(true);
        return;
      }

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Upload failed");
      }

      setInvoice(payload.invoice);
      setSourceInvoice(payload.invoice);
      setInvoiceId(payload.invoiceId);
      setMessages(payload.warnings ?? []);
      setCachedLanguages(new Set());
      if (payload.isNew) {
        notifyBalanceChanged();
      }
    } catch (error) {
      setInvoice(null);
      setSourceInvoice(null);
      setInvoiceId(null);
      setMessages([error instanceof Error ? error.message : "Upload failed"]);
    } finally {
      setStatus("idle");
    }
  }

  async function loadSample() {
    try {
      const res = await fetch("/sample-data/sample-fa3-invoice.xml");
      if (!res.ok) {
        setMessages(["Nie udało się załadować przykładowej faktury."]);
        return;
      }
      const blob = await res.blob();
      const file = new File([blob], "sample-fa3-invoice.xml", { type: "application/xml" });
      await upload(file);
    } catch (err) {
      console.warn("[loadSample] failed:", err);
      setMessages(["Nie udało się załadować przykładowej faktury."]);
    }
  }

  async function translateCurrent() {
    if (!invoiceId) return;
    if (currentLanguage === "pl") {
      // PL is the source — instant restore, no API call.
      if (sourceInvoice) setInvoice(sourceInvoice);
      return;
    }
    if (cachedLanguages.has(currentLanguage)) return; // no-op when cached

    setStatus("translating");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, language: currentLanguage, bilingual })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Translation failed");
      }
      setInvoice(payload.invoice);
      setCachedLanguages((prev) => {
        const next = new Set(prev);
        next.add(currentLanguage as LanguageCode);
        return next;
      });
    } catch (error) {
      setMessages([error instanceof Error ? error.message : "Translation failed"]);
    } finally {
      setStatus("idle");
    }
  }

  async function downloadPdf() {
    if (!invoiceId || !invoice) return;
    setStatus("generating-pdf");
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          language: currentLanguage,
          bilingual: currentLanguage !== "pl" && bilingual,
          translated: currentLanguage !== "pl"
        })
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

  function dismissInsufficientCredit() {
    setInsufficientCredit(false);
  }

  function reset() {
    setInvoice(null);
    setSourceInvoice(null);
    setInvoiceId(null);
    setMessages([]);
    setStatus("idle");
    setInsufficientCredit(false);
    setCurrentLanguageState(DEFAULT_LANGUAGE);
    setBilingualState(true);
    setCachedLanguages(new Set());
  }

  return {
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
  };
}
