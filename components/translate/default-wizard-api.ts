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
 * Endpoints (PR #C):
 *   - `POST /api/upload-batch`  → multi-file multipart, per-file results,
 *                                 cap of 20 files per call, no credit charge
 *   - `POST /api/translate`     → consumes credit on cache-miss when
 *                                 TRANSLATE_V2 is on; returns cacheHit flag
 *   - `POST /api/pdf`           → returns the rendered PDF blob
 *   - downloadZip               → temporary fallback (returns first PDF blob).
 *                                 Replaced with `/api/translate/zip` in PR #D
 *                                 once a zip dependency is added deliberately.
 */
export function createDefaultWizardApi(): WizardApi {
  return {
    async uploadBatch(files): Promise<UploadBatchResponse> {
      // Single multipart POST — every file rides in one round-trip and
      // the server returns per-file results so partial success doesn't
      // poison the batch.
      const fd = new FormData();
      for (const file of files) {
        fd.append("file", file);
      }

      let res: Response;
      try {
        res = await fetch("/api/upload-batch", {
          method: "POST",
          body: fd
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Network error";
        return {
          results: files.map(
            (file): UploadBatchResult => ({
              ok: false,
              fileName: file.name,
              error: reason
            })
          )
        };
      }

      if (res.status === 413) {
        return {
          results: files.map(
            (file): UploadBatchResult => ({
              ok: false,
              fileName: file.name,
              error: "Batch too large (max 20 files)"
            })
          )
        };
      }

      if (!res.ok) {
        const reason = `Upload failed (${res.status})`;
        return {
          results: files.map(
            (file): UploadBatchResult => ({
              ok: false,
              fileName: file.name,
              error: reason
            })
          )
        };
      }

      const payload = (await res.json()) as UploadBatchResponse;
      return payload;
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
      // Real server-side ZIP endpoint (PR #D). Posts the invoice id list,
      // server fetches+translates+renders+zips, returns the archive blob.
      const res = await fetch("/api/translate/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceIds: [...invoiceIds],
          language,
          bilingual
        })
      });
      if (!res.ok) {
        throw new Error(`Zip download failed (${res.status})`);
      }
      return res.blob();
    }
  };
}
