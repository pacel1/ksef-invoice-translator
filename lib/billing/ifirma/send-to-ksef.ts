import { ifirmaPost } from "./client";
import type { IfirmaResponseEnvelope } from "./types";

export interface SendToKsefOptions {
  /** True for a faktura korygująca (uses the /korekta path). */
  korekta: boolean;
}

/**
 * Submit an already-created iFirma invoice to KSeF. The client throws on
 * Kod !== 0, so a successful resolve means iFirma accepted the submission
 * request (KSeF acceptance itself is async — poll via get-status).
 */
export async function sendToKsef(
  providerInvoiceId: string,
  options: SendToKsefOptions
): Promise<void> {
  const segment = options.korekta ? "fakturakraj/korekta" : "fakturakraj";
  await ifirmaPost<IfirmaResponseEnvelope>(
    `/${segment}/ksef/send/${encodeURIComponent(providerInvoiceId)}.json`,
    { DataWysylki: null }
  );
}
