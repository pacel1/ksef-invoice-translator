import { fakturowniaGet } from "./client";
import { normalizeResponse } from "./issue-faktura";
import type { FakturaResult, FakturowniaInvoiceResponse } from "./types";

/**
 * Poll Fakturownia for the current KSeF state of a previously-issued
 * invoice. Returns the same FakturaResult shape as issueFaktura so the
 * caller can treat the row uniformly.
 */
export async function getFakturaStatus(
  fakturowniaId: string
): Promise<FakturaResult> {
  const response = await fakturowniaGet<FakturowniaInvoiceResponse>(
    `/invoices/${encodeURIComponent(fakturowniaId)}.json`
  );
  return normalizeResponse(response);
}
