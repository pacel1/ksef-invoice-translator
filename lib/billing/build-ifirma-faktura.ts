import type { IfirmaInvoiceRequest } from "./ifirma";

/** Subset of stripe_purchases columns needed to build an iFirma invoice. */
export interface PurchaseRow {
  id: string;
  package_size: number;
  unit_price_cents: number;
  total_amount_cents: number;
  currency: string;
  buyer_nip: string | null;
  buyer_business_name: string | null;
  buyer_email: string | null;
  buyer_address_line1: string | null;
  buyer_address_line2: string | null;
  buyer_postal_code: string | null;
  buyer_city: string | null;
  buyer_country: string | null;
  created_at: string;
}

const PL_VAT_RATE = 0.23;

function normalizeNip(raw: string): string {
  return raw.replace(/^PL/i, "").replace(/[-.\s]/g, "");
}

function buildStreet(line1: string | null, line2: string | null): string | undefined {
  const parts = [line1, line2]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p && p.length > 0));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** Polish full country name iFirma expects. Default "Polska". */
function countryName(code: string | null): string {
  // We only sell B2B to PL-NIP holders, so PL is the norm. Map the common
  // ISO code; otherwise pass through whatever's stored (iFirma accepts the
  // Polish country name — verify exotic cases against live creds).
  if (!code || code.toUpperCase() === "PL") return "Polska";
  return code;
}

export function buildIfirmaFaktura(row: PurchaseRow): IfirmaInvoiceRequest {
  if (!row.buyer_nip || row.buyer_nip.trim() === "") {
    throw new Error(`buyer_nip missing on stripe_purchases ${row.id} — cannot issue B2B faktura`);
  }
  if (!row.buyer_business_name || row.buyer_business_name.trim() === "") {
    throw new Error(`buyer_business_name missing on stripe_purchases ${row.id} — cannot issue B2B faktura`);
  }

  const issueDate = row.created_at.slice(0, 10);
  const unitNet = row.unit_price_cents / 100;
  const netTotalCents = row.unit_price_cents * row.package_size;
  // Gross = net × 1.23, rounded to grosze, then to PLN.
  const grossCents = Math.round(netTotalCents * (1 + PL_VAT_RATE));
  const zaplacono = grossCents / 100;

  return {
    Zaplacono: zaplacono,
    LiczOd: "NET",
    DataWystawienia: issueDate,
    DataSprzedazy: issueDate,
    FormatDatySprzedazy: "DZN",
    SposobZaplaty: "PRZ",
    NazwaSeriiNumeracji: "default",
    Pozycje: [
      {
        StawkaVat: PL_VAT_RATE,
        Ilosc: row.package_size,
        CenaJednostkowa: unitNet,
        NazwaPelna: `KSeF Translator — pakiet ${row.package_size} kredytów`,
        Jednostka: "szt",
        PKWiU: "",
        TypStawkiVat: "PRC"
      }
    ],
    Kontrahent: {
      Nazwa: row.buyer_business_name,
      NIP: normalizeNip(row.buyer_nip),
      Ulica: buildStreet(row.buyer_address_line1, row.buyer_address_line2),
      KodPocztowy: row.buyer_postal_code ?? undefined,
      Miejscowosc: row.buyer_city ?? undefined,
      Kraj: countryName(row.buyer_country),
      Email: row.buyer_email ?? undefined,
      OsobaFizyczna: false
    }
  };
}
