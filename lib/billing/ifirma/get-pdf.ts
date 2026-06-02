import { ifirmaGetBinary } from "./client";

/** Fetch the rendered faktura PDF bytes from iFirma (authenticated). */
export async function getFakturaPdf(
  providerInvoiceId: string
): Promise<ArrayBuffer> {
  return ifirmaGetBinary(
    `/fakturakraj/${encodeURIComponent(providerInvoiceId)}.pdf`
  );
}
