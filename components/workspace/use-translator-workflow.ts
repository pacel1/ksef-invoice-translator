"use client";

import { useState } from "react";
import type { Invoice, LanguageCode } from "@/types/invoice";

export type WorkflowStatus = "idle" | "uploading" | "translating" | "generating-pdf";

export interface UseTranslatorWorkflowResult {
  invoice: Invoice | null;
  invoiceId: string | null;
  status: WorkflowStatus;
  messages: string[];
  insufficientCredit: boolean;
  upload(file: File): Promise<void>;
  translate(language: LanguageCode, bilingual: boolean): Promise<void>;
  downloadPdf(language: LanguageCode, bilingual: boolean): Promise<void>;
  dismissInsufficientCredit(): void;
  reset(): void;
}

export function useTranslatorWorkflow(): UseTranslatorWorkflowResult {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [messages, setMessages] = useState<string[]>([]);
  const [insufficientCredit, setInsufficientCredit] = useState(false);

  function notifyBalanceChanged() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("credit-balance-changed"));
    }
  }

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

  async function translate(language: LanguageCode, bilingual: boolean) {
    if (!invoiceId) return;
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

  async function downloadPdf(language: LanguageCode, bilingual: boolean) {
    if (!invoiceId || !invoice) return;
    setStatus("generating-pdf");
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, language, bilingual })
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
  }

  return {
    invoice,
    invoiceId,
    status,
    messages,
    insufficientCredit,
    upload,
    translate,
    downloadPdf,
    dismissInsufficientCredit,
    reset
  };
}
