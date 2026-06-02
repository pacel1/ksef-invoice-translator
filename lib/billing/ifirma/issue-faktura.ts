import { ifirmaPost } from "./client";
import type { IfirmaInvoiceRequest, IfirmaResponseEnvelope } from "./types";

export interface IssueFakturaResult {
  providerInvoiceId: string;
}

/**
 * Create a domestic VAT invoice in iFirma. Does NOT send it to KSeF — that's
 * a separate call (see send-to-ksef.ts). Returns the iFirma invoice id.
 */
export async function issueFaktura(
  body: IfirmaInvoiceRequest
): Promise<IssueFakturaResult> {
  const res = await ifirmaPost<IfirmaResponseEnvelope>("/fakturakraj.json", body);
  const id = res.response.Identyfikator;
  if (!id) {
    throw new Error(
      `iFirma /fakturakraj.json returned no Identyfikator (Kod=${res.response.Kod}, ${res.response.Informacja})`
    );
  }
  return { providerInvoiceId: id };
}
