/**
 * iFirma REST API type stubs (https://api.ifirma.pl). Only the fields we
 * read or write are typed.
 */

/** VAT rate kind. "PRC" = percentage; "ZW" = zwolniony; "NP" = nie podlega. */
export type IfirmaTypStawkiVat = "PRC" | "ZW" | "NP";

/** A single invoice line item (pozycja). */
export interface IfirmaPozycja {
  /** Decimal VAT rate, e.g. 0.23 for 23%. */
  StawkaVat: number;
  Ilosc: number;
  /** Net unit price (LiczOd="NET"). */
  CenaJednostkowa: number;
  NazwaPelna: string;
  Jednostka: string;
  PKWiU?: string;
  TypStawkiVat: IfirmaTypStawkiVat;
}

/** Buyer (kontrahent). For B2B, OsobaFizyczna=false and NIP is required. */
export interface IfirmaKontrahent {
  Nazwa: string;
  NIP: string;
  Ulica?: string;
  KodPocztowy?: string;
  Miejscowosc?: string;
  /** Full country name in Polish, e.g. "Polska". */
  Kraj?: string;
  Email?: string;
  OsobaFizyczna: boolean;
}

/**
 * Recipient signature type. "BPO" = bez podpisu odbiorcy (no recipient
 * signature) — the right value for automated e-invoices; "OUP" = authorized
 * person; "UPO" = authorization on file; "BWO" = neither party signs.
 */
export type IfirmaRodzajPodpisuOdbiorcy = "OUP" | "UPO" | "BPO" | "BWO";

/** Body for POST /iapi/fakturakraj.json. */
export interface IfirmaInvoiceRequest {
  /** Gross amount paid. */
  Zaplacono: number;
  /** Gross amount shown as paid on the document; required by iFirma. */
  ZaplaconoNaDokumencie: number;
  /** "NET" = prices are net; "BRT" = prices are gross. */
  LiczOd: "NET" | "BRT";
  DataWystawienia: string;
  DataSprzedazy: string;
  /** "DZN" = day-level sale date. */
  FormatDatySprzedazy: "DZN" | "MIE";
  /** "PRZ" = przelew (bank transfer). */
  SposobZaplaty: string;
  NazwaSeriiNumeracji: string;
  RodzajPodpisuOdbiorcy: IfirmaRodzajPodpisuOdbiorcy;
  /** Whether the GIOŚ registration number prints on the invoice; required. */
  WidocznyNumerGios: boolean;
  /** Explicit invoice number, or null to auto-assign from the series. */
  Numer: string | null;
  Pozycje: IfirmaPozycja[];
  Kontrahent: IfirmaKontrahent;
}

/** Body for POST /iapi/fakturakraj/korekta/<id>.json. */
export interface IfirmaKorektaRequest {
  DataWystawienia: string;
  /** Correction reason enum, e.g. "ZWR_SPRZ_TOW" (return of goods/services). */
  PowodKorekty: string;
  Zaplacono: number;
  SposobZaplaty: string;
  RodzajPodpisuOdbiorcy: IfirmaRodzajPodpisuOdbiorcy;
  /** Statutory correction conditions met (required by iFirma). */
  SpelnionoWarunki: boolean;
  Pozycje: IfirmaPozycja[];
}

/** Standard iFirma response envelope. */
export interface IfirmaResponseEnvelope {
  response: {
    /** 0 = success. */
    Kod: number;
    Informacja: string;
    /** Present on create/korekta success — the new invoice id. */
    Identyfikator?: string;
  };
}

/**
 * Normalized status result our callers consume. `govStatus` follows the
 * same enum as the DB column. `raw` carries the untouched provider body so
 * we can discover the real KSeF-status fields with live creds (the iFirma
 * docs don't document them).
 */
export interface KsefInvoiceResult {
  providerInvoiceId: string;
  govStatus: "pending" | "processing" | "ok" | "send_error" | "failed";
  govId: string | null;
  errorMessages: string[];
  raw?: unknown;
}

export class IfirmaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly kod: number | null,
    public readonly body: unknown,
    message: string
  ) {
    super(message);
    this.name = "IfirmaApiError";
  }
}
