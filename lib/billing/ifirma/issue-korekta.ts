import { ifirmaPost } from "./client";
import type {
  IfirmaKorektaRequest,
  IfirmaPozycja,
  IfirmaResponseEnvelope
} from "./types";

export interface IssueKorektaParams {
  /** iFirma id of the ORIGINAL invoice being corrected. */
  originalProviderInvoiceId: string;
  /** Correction reason enum, e.g. "ZWR_SPRZ_TOW". */
  reason: string;
  issueDate: string;
  /** Payment method enum, e.g. "KOM" (kompensata) for a refund. */
  sposobZaplaty: string;
  /** Gross still considered paid after the correction (0 for a full refund). */
  zaplacono: number;
  /**
   * Corrected (post-refund) line items. For a full refund, Ilosc=0 expresses
   * "everything returned"; iFirma computes the delta from the original.
   */
  positions: IfirmaPozycja[];
}

export interface IssueKorektaResult {
  providerInvoiceId: string;
}

export async function issueKorekta(
  params: IssueKorektaParams
): Promise<IssueKorektaResult> {
  const body: IfirmaKorektaRequest = {
    DataWystawienia: params.issueDate,
    PowodKorekty: params.reason,
    Zaplacono: params.zaplacono,
    SposobZaplaty: params.sposobZaplaty,
    // Automated e-invoice: nobody signs (BPO = bez podpisu odbiorcy).
    RodzajPodpisuOdbiorcy: "BPO",
    // The korekta is issued only after the refund completed, so the
    // statutory correction conditions are met by construction.
    SpelnionoWarunki: true,
    Pozycje: params.positions
  };
  const res = await ifirmaPost<IfirmaResponseEnvelope>(
    `/fakturakraj/korekta/${encodeURIComponent(params.originalProviderInvoiceId)}.json`,
    body
  );
  const id = res.response.Identyfikator;
  if (!id) {
    throw new Error(
      `iFirma korekta returned no Identyfikator (Kod=${res.response.Kod}, ${res.response.Informacja})`
    );
  }
  return { providerInvoiceId: id };
}
