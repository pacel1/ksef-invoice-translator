import { fakturowniaPost } from "./client";
import { normalizeResponse } from "./issue-faktura";
import type {
  FakturaResult,
  FakturowniaInvoiceResponse,
  FakturowniaIssueInvoiceRequest,
  FakturowniaPosition
} from "./types";

export interface IssueKorektaParams {
  /** The original faktura's Fakturownia id, as stored in fakturownia_invoices.fakturownia_id. */
  originalFakturowniaId: string;
  stripePurchaseId: string;
  issueDate: string;
  reason: string;
  positions: Array<{
    name: string;
    quantity: number;
    /** Negative price_net for the refunded amount. */
    priceNet: string;
    tax: string;
  }>;
  currency: string;
}

export async function issueKorekta(
  params: IssueKorektaParams
): Promise<FakturaResult> {
  const positions: FakturowniaPosition[] = params.positions.map((p) => ({
    name: p.name,
    quantity: p.quantity,
    price_net: p.priceNet,
    tax: p.tax
  }));

  const requestBody: Omit<FakturowniaIssueInvoiceRequest, "api_token"> = {
    invoice: {
      kind: "correction",
      from_invoice_id: Number(params.originalFakturowniaId),
      issue_date: params.issueDate,
      sell_date: params.issueDate,
      // For korekta, buyer fields are inherited from the original; we can
      // re-supply them but Fakturownia ignores changes. Leave them out to
      // avoid accidental drift.
      buyer_tax_no: "",
      buyer_name: "",
      currency: params.currency,
      description: `Faktura korygująca: ${params.reason}`,
      positions,
      gov_save_and_send: true,
      // Distinct oid so we can dedup retries vs the original.
      oid: `${params.stripePurchaseId}:korekta`
    }
  };

  const response = await fakturowniaPost<FakturowniaInvoiceResponse>(
    "/invoices.json",
    requestBody
  );

  return normalizeResponse(response);
}
