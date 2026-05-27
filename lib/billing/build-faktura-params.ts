import type { IssueFakturaParams } from "./fakturownia";

/**
 * Subset of `stripe_purchases` columns needed to build faktura params.
 * Defined inline instead of importing the full DB-generated type so this
 * module can be tested with hand-rolled fixtures.
 */
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

function normalizeNip(raw: string): string {
  // Strip PL prefix (eu_vat format), dashes, spaces, dots.
  return raw.replace(/^PL/i, "").replace(/[-.\s]/g, "");
}

function buildStreet(
  line1: string | null,
  line2: string | null
): string | undefined {
  // Fakturownia uses ONE buyer_street field; Stripe gives us two address
  // lines. Concatenate non-empty ones with a comma so suite/apartment info
  // survives the round-trip.
  const parts = [line1, line2]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p && p.length > 0));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function centsToString(cents: number): string {
  // Fakturownia accepts numbers but we send strings to avoid float drift.
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return `${whole}.${fraction.toString().padStart(2, "0")}`;
}

export function buildFakturaParams(row: PurchaseRow): IssueFakturaParams {
  if (!row.buyer_nip || row.buyer_nip.trim() === "") {
    throw new Error(
      `buyer_nip missing on stripe_purchases ${row.id} — cannot issue B2B faktura`
    );
  }
  if (!row.buyer_business_name || row.buyer_business_name.trim() === "") {
    throw new Error(
      `buyer_business_name missing on stripe_purchases ${row.id} — cannot issue B2B faktura`
    );
  }

  const issueDate = row.created_at.slice(0, 10); // YYYY-MM-DD from ISO string

  return {
    stripePurchaseId: row.id,
    issueDate,
    buyer: {
      taxNo: normalizeNip(row.buyer_nip),
      name: row.buyer_business_name,
      street: buildStreet(row.buyer_address_line1, row.buyer_address_line2),
      postCode: row.buyer_postal_code ?? undefined,
      city: row.buyer_city ?? undefined,
      country: (row.buyer_country ?? "PL").toLowerCase(),
      email: row.buyer_email ?? undefined
    },
    positions: [
      {
        name: `KSeF Translator — pakiet ${row.package_size} kredytów`,
        quantity: row.package_size,
        priceNet: centsToString(row.unit_price_cents),
        // PL standard VAT rate. For non-PL buyers we'd switch to "np" with
        // reverse-charge annotation, but the B2B-only + Polish-NIP-required
        // checkout flow makes this PL B2B by construction.
        tax: "23"
      }
    ],
    currency: row.currency
  };
}
