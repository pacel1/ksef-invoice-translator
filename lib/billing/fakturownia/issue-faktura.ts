import { fakturowniaPost } from "./client";
import type {
  FakturaResult,
  FakturowniaInvoiceResponse,
  FakturowniaIssueInvoiceRequest,
  FakturowniaPosition
} from "./types";

export interface IssueFakturaParams {
  /** Our stripe_purchases.id — sent as `oid` for retry idempotency. */
  stripePurchaseId: string;
  /** YYYY-MM-DD. */
  issueDate: string;
  buyer: {
    /** 10-digit PL NIP (no dashes, no PL prefix). */
    taxNo: string;
    name: string;
    street?: string;
    postCode?: string;
    city?: string;
    /** ISO 3166-1 alpha-2 lowercase. Default "pl". */
    country?: string;
    email?: string;
  };
  positions: Array<{
    name: string;
    quantity: number;
    /** Net unit price as a string, two decimals. */
    priceNet: string;
    /** VAT rate as Fakturownia expects: "23", "8", "5", "0", "np", "zw". */
    tax: string;
  }>;
  /** lowercase ISO 4217 — "pln" | "eur" | "usd". */
  currency: string;
  /** Optional human-readable note. */
  description?: string;
}

const ISSUE_INVOICE_PATH = "/invoices.json";

export async function issueFaktura(
  params: IssueFakturaParams
): Promise<FakturaResult> {
  const positions: FakturowniaPosition[] = params.positions.map((p) => ({
    name: p.name,
    quantity: p.quantity,
    price_net: p.priceNet,
    tax: p.tax
  }));

  const requestBody: Omit<FakturowniaIssueInvoiceRequest, "api_token"> = {
    invoice: {
      kind: "vat",
      issue_date: params.issueDate,
      sell_date: params.issueDate,
      buyer_tax_no: params.buyer.taxNo,
      buyer_name: params.buyer.name,
      buyer_street: params.buyer.street,
      buyer_post_code: params.buyer.postCode,
      buyer_city: params.buyer.city,
      buyer_country: params.buyer.country ?? "pl",
      buyer_email: params.buyer.email,
      currency: params.currency,
      description: params.description,
      positions,
      gov_save_and_send: true,
      oid: params.stripePurchaseId
    }
  };

  const response = await fakturowniaPost<FakturowniaInvoiceResponse>(
    ISSUE_INVOICE_PATH,
    requestBody
  );

  return normalizeResponse(response);
}

export function normalizeResponse(
  response: FakturowniaInvoiceResponse
): FakturaResult {
  // Fakturownia returns `null` for gov_status when KSeF hasn't acknowledged
  // yet (or when the account isn't KSeF-configured). Treat null as
  // 'processing' so our state machine drives toward terminal via the cron.
  const govStatus = response.gov_status ?? "processing";
  return {
    fakturowniaId: String(response.id),
    invoiceNumber: response.number,
    pdfUrl: response.view_url,
    govStatus,
    govId: response.gov_id,
    govSendDate: response.gov_send_date,
    govVerificationLink: response.gov_verification_link,
    errorMessages: response.gov_error_messages ?? []
  };
}
