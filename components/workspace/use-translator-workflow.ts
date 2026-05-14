"use client";

import { useCallback, useState } from "react";
import type { Invoice, LanguageCode } from "@/types/invoice";

export type WorkflowStatus = "idle" | "uploading" | "translating" | "generating-pdf";

export interface UseTranslatorWorkflowResult {
  invoice: Invoice | null;
  invoiceId: string | null;
  status: WorkflowStatus;
  messages: string[];
  insufficientCredit: boolean;
  currentLanguage: LanguageCode;
  bilingual: boolean;
  cachedLanguages: Set<LanguageCode>;
  setCurrentLanguage(lang: LanguageCode): void;
  setBilingual(value: boolean): void;
  upload(file: File): Promise<void>;
  translateCurrent(): Promise<void>;
  downloadPdf(): Promise<void>;
  dismissInsufficientCredit(): void;
  reset(): void;
}

const DEFAULT_LANGUAGE: LanguageCode = "en";

export function useTranslatorWorkflow(): UseTranslatorWorkflowResult {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [messages, setMessages] = useState<string[]>([]);
  const [insufficientCredit, setInsufficientCredit] = useState(false);
  const [currentLanguage, setCurrentLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [bilingual, setBilingualState] = useState(true);
  const [cachedLanguages, setCachedLanguages] = useState<Set<LanguageCode>>(new Set());

  function notifyBalanceChanged() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("credit-balance-changed"));
    }
  }

  const setCurrentLanguage = useCallback((lang: LanguageCode) => {
    setCurrentLanguageState(lang);
  }, []);

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
      setInvoiceId(payload.invoiceId);
      setMessages(payload.warnings ?? []);
      setCachedLanguages(new Set());
      if (payload.isNew) {
        notifyBalanceChanged();
      }
    } catch (error) {
      setInvoice(null);
      setInvoiceId(null);
      setMessages([error instanceof Error ? error.message : "Upload failed"]);
    } finally {
      setStatus("idle");
    }
  }

  async function translateCurrent() {
    if (!invoiceId) return;
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
        next.add(currentLanguage);
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
        body: JSON.stringify({ invoiceId, language: currentLanguage, bilingual })
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
    setCurrentLanguage,
    setBilingual,
    upload,
    translateCurrent,
    downloadPdf,
    dismissInsufficientCredit,
    reset
  };
}
