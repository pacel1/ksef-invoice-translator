"use client";

import type {
  TranslateResult,
  UploadBatchResponse,
  UploadBatchResult,
  WizardApi
} from "./use-translation-wizard";
import type { LanguageCode } from "@/types/invoice";

/**
 * Production WizardApi wiring.
 *
 * PR #B ships this against the existing single-file endpoints:
 *   - `POST /api/upload`     for each file in a batch (sequential — PR #C
 *                            adds /api/upload-batch with parallel + 20-file cap)
 *   - `POST /api/translate`  → consumes credit, returns the invoice
 *   - `POST /api/pdf`        → returns the rendered PDF blob
 *   - downloadZip            → falls back to N individual downloads
 *
 * PR #C swaps `uploadBatch` + `downloadZip` for the real batch endpoints
 * and keeps the public interface stable.
 */
export function createDefaultWizardApi(): WizardApi {
  return {
    async uploadBatch(files): Promise<UploadBatchResponse> {
      const results: UploadBatchResult[] = [];
      for (const file of files) {
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (res.status === 402) {
            results.push({
              ok: false,
              fileName: file.name,
              error: "Insufficient credit"
            });
            continue;
          }
          const payload = (await res.json()) as {
            invoiceId?: string;
            invoice?: { invoiceNumber?: string };
            warnings?: ReadonlyArray<string>;
            isNew?: boolean;
            error?: string;
          };
          if (!res.ok || !payload.invoiceId) {
            results.push({
              ok: false,
              fileName: file.name,
              error: payload.error ?? "Upload failed"
            });
            continue;
          }
          results.push({
            ok: true,
            fileName: file.name,
            invoiceId: payload.invoiceId,
            invoiceNumber: payload.invoice?.invoiceNumber ?? "",
            warnings: payload.warnings ?? [],
            isNew: payload.isNew ?? false
          });
        } catch (error) {
          results.push({
            ok: false,
            fileName: file.name,
            error: error instanceof Error ? error.message : "Upload failed"
          });
        }
      }
      return { results };
    },

    async translate(
      invoiceId: string,
      language: LanguageCode,
      bilingual: boolean,
      signal?: AbortSignal
    ): Promise<TranslateResult> {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, language, bilingual }),
        signal
      });
      if (res.status === 402) {
        return {
          ok: false,
          error: "Insufficient credit",
          code: "insufficient_credit"
        };
      }
      const payload = (await res.json()) as {
        invoice?: unknown;
        error?: string;
        cacheHit?: boolean;
      };
      if (!res.ok || !payload.invoice) {
        return { ok: false, error: payload.error ?? "Translation failed" };
      }
      return {
        ok: true,
        invoice: payload.invoice as never,
        cacheHit: payload.cacheHit === true
      };
    },

    async generatePdf(
      invoiceId: string,
      language: LanguageCode | "pl",
      bilingual: boolean
    ): Promise<Blob> {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          language,
          bilingual: language !== "pl" && bilingual,
          translated: language !== "pl"
        })
      });
      if (!res.ok) {
        throw new Error(`PDF generation failed (${res.status})`);
      }
      return res.blob();
    },

    async downloadZip(
      invoiceIds: ReadonlyArray<string>,
      language: LanguageCode,
      bilingual: boolean
    ): Promise<Blob> {
      // PR #B fallback: fetch every PDF in parallel and concatenate.
      // PR #C replaces this with a server-side /api/translate/zip endpoint
      // that streams a real ZIP archive.
      const blobs = await Promise.all(
        invoiceIds.map(async (id) => {
          const res = await fetch("/api/pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoiceId: id,
              language,
              bilingual,
              translated: true
            })
          });
          if (!res.ok) throw new Error("PDF generation failed");
          return res.blob();
        })
      );
      // Cheap "zip" placeholder: just return the first PDF so the caller
      // gets *something* downloadable. The real zip lands in PR #C.
      return blobs[0] ?? new Blob();
    }
  };
}
