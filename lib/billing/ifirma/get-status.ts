import { ifirmaGet } from "./client";
import type { KsefInvoiceResult } from "./types";

// A KSeF reference number is 35 chars: NIP-DATE-12HEX-CRC. We don't hard-fail
// on the format; this is just a heuristic to recognise a "looks like a numer
// KSeF" string while the real field name is unconfirmed.
const KSEF_NUMBER_RE = /^\d{10}-\d{8}-[0-9A-F]{12}-[0-9A-F]{2}$/i;

/**
 * Best-effort KSeF status read. iFirma's docs don't document the KSeF-status
 * response, so we GET the single-invoice JSON and scan for:
 *   - any key containing "ksef" whose value looks like a numer KSeF -> ok
 *   - a truthy CzyWyslano (sent flag) with no number yet -> processing
 *   - otherwise -> processing (keep polling; the cron caps attempts)
 * The untouched body is returned on `raw` (and logged) so the real field
 * names can be confirmed against live creds, then this can be tightened.
 */
export async function getKsefStatus(
  providerInvoiceId: string
): Promise<KsefInvoiceResult> {
  const body = await ifirmaGet<Record<string, unknown>>(
    `/fakturakraj/${encodeURIComponent(providerInvoiceId)}.json`
  );

  // iFirma 200 bodies are wrapped in { response: {...} }; flatten for scanning.
  const inner =
    (body as { response?: Record<string, unknown> }).response ?? body;

  console.info(
    "[ifirma/get-status] raw KSeF status body for invoice",
    providerInvoiceId,
    JSON.stringify(inner)
  );

  const govId = findKsefNumber(inner);
  if (govId) {
    return { providerInvoiceId, govStatus: "ok", govId, errorMessages: [], raw: body };
  }

  return {
    providerInvoiceId,
    govStatus: "processing",
    govId: null,
    errorMessages: [],
    raw: body
  };
}

function findKsefNumber(obj: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(obj)) {
    if (
      key.toLowerCase().includes("ksef") &&
      typeof value === "string" &&
      KSEF_NUMBER_RE.test(value)
    ) {
      return value;
    }
  }
  return null;
}
