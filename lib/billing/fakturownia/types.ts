/**
 * Fakturownia REST API type stubs. Mirrors the public JSON shape from
 * https://github.com/fakturownia/API. Only the fields we actually use
 * are typed — the API returns dozens more, but adding them as we need
 * them is cheaper than typing the world up-front.
 */

/** Fakturownia document kinds we issue. */
export type FakturowniaKind = "vat" | "correction";

/**
 * KSeF lifecycle as Fakturownia reports it on every invoice response.
 * Our DB column `gov_status` mirrors this set, plus 'pending' (we haven't
 * called Fakturownia yet) and 'failed' (the API call itself blew up).
 */
export type FakturowniaGovStatus =
  | "processing"
  | "ok"
  | "send_error"
  | "server_error";

/** A single line item on a faktura. */
export interface FakturowniaPosition {
  /** Product/service name shown on the PDF. */
  name: string;
  quantity: number;
  /** Net unit price as a string in PLN (Fakturownia accepts string OR number;
   *  string avoids JS float drift). E.g. "100.00". */
  price_net: string;
  /** VAT rate as a string. "23" for 23%, "0" for 0%, "np" for not-subject,
   *  "zw" for zwolniony. For EU reverse-charge B2B: "np". */
  tax: string;
  /** PKWiU / GTU classification (optional, leave empty for SaaS services). */
  pkwiu?: string;
}

/**
 * Payload for POST /invoices.json. Most fields are optional in
 * Fakturownia's API; we always set the ones below for consistency.
 */
export interface FakturowniaIssueInvoiceRequest {
  api_token: string;
  invoice: {
    kind: FakturowniaKind;
    /** For 'correction' invoices, the parent invoice's Fakturownia id. */
    from_invoice_id?: number;
    /** Issue date in YYYY-MM-DD. */
    issue_date: string;
    /** Sell date (data sprzedaży) in YYYY-MM-DD. Usually == issue_date for digital services. */
    sell_date?: string;
    /** Buyer's NIP (10 digits, no dashes). Required for our B2B flow. */
    buyer_tax_no: string;
    /** Buyer name (company name). */
    buyer_name: string;
    /** Buyer street + number. */
    buyer_street?: string;
    /** Buyer "31-000 Kraków" — single field per Fakturownia convention. */
    buyer_post_code?: string;
    buyer_city?: string;
    /** ISO 3166-1 alpha-2 country code, lowercase. Default "pl". */
    buyer_country?: string;
    buyer_email?: string;
    /** Seller fields come from Fakturownia account settings — don't pass them. */
    /** Currency code, lowercase. "pln" / "eur" / "usd". */
    currency?: string;
    /** Optional human-readable note shown on PDF. */
    description?: string;
    /** Line items. */
    positions: FakturowniaPosition[];
    /** If true (and KSeF is enabled in account settings), Fakturownia
     *  auto-submits the document to KSeF immediately after creation.
     *  Always true for our B2B flow. */
    gov_save_and_send?: boolean;
    /** Our internal id for idempotent retries (we send the
     *  stripe_purchase_id here). */
    oid?: string;
  };
}

/** Subset of fields we read off the API response. */
export interface FakturowniaInvoiceResponse {
  /** Fakturownia's primary key — store as our `fakturownia_id`. */
  id: number;
  /** Issued invoice number per Fakturownia's numbering scheme. */
  number: string;
  /** Signed PDF URL (Fakturownia adds a token; the link works without auth). */
  view_url: string;
  /** KSeF status — `null` if KSeF disabled or not yet sent. */
  gov_status: FakturowniaGovStatus | null;
  /** KSeF reference number (35 chars). Null until accepted. */
  gov_id: string | null;
  /** When Fakturownia last sent the document to KSeF. */
  gov_send_date: string | null;
  /** When KSeF accepted/rejected. */
  gov_status_date: string | null;
  /** Error messages from KSeF; populated on `send_error` / `server_error`. */
  gov_error_messages: string[] | null;
  /** Human-readable verification link customers can paste into ksef.mf.gov.pl. */
  gov_verification_link: string | null;
}

/** Normalized result our callers consume; insulates them from API drift. */
export interface FakturaResult {
  fakturowniaId: string;     // numeric id stringified
  invoiceNumber: string;
  pdfUrl: string;
  govStatus: "processing" | "ok" | "send_error" | "server_error";
  govId: string | null;
  govSendDate: string | null;
  govVerificationLink: string | null;
  errorMessages: string[];
}

/** Error envelope from Fakturownia on 4xx/5xx. */
export interface FakturowniaErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

export class FakturowniaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: FakturowniaErrorBody | string,
    message: string
  ) {
    super(message);
    this.name = "FakturowniaApiError";
  }
}
