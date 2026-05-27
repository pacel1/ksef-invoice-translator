import { describe, expect, it } from "vitest";
import { buildFakturaParams } from "@/lib/billing/build-faktura-params";

describe("buildFakturaParams", () => {
  const samplePurchase = {
    id: "purchase-uuid",
    package_size: 50,
    unit_price_cents: 1000, // 10.00 PLN
    total_amount_cents: 50000, // 500.00 PLN
    currency: "pln",
    buyer_nip: "5260250995",
    buyer_business_name: "ACME Sp. z o.o.",
    buyer_email: "biuro@acme.pl",
    buyer_address_line1: "ul. Marszałkowska 1",
    buyer_address_line2: null,
    buyer_postal_code: "00-001",
    buyer_city: "Warszawa",
    buyer_country: "PL",
    created_at: "2026-05-27T10:00:00Z"
  };

  it("maps NIP, name, and address into the buyer block", () => {
    const params = buildFakturaParams(samplePurchase);
    expect(params.buyer.taxNo).toBe("5260250995");
    expect(params.buyer.name).toBe("ACME Sp. z o.o.");
    expect(params.buyer.email).toBe("biuro@acme.pl");
    expect(params.buyer.street).toBe("ul. Marszałkowska 1");
    expect(params.buyer.postCode).toBe("00-001");
    expect(params.buyer.city).toBe("Warszawa");
    expect(params.buyer.country).toBe("pl"); // lowercased
  });

  it("strips PL prefix from NIP if Stripe stored eu_vat format", () => {
    const params = buildFakturaParams({
      ...samplePurchase,
      buyer_nip: "PL5260250995"
    });
    expect(params.buyer.taxNo).toBe("5260250995");
  });

  it("strips dashes and spaces from NIP", () => {
    const params = buildFakturaParams({
      ...samplePurchase,
      buyer_nip: "526-025-09-95"
    });
    expect(params.buyer.taxNo).toBe("5260250995");
  });

  it("formats unit_price_cents into a two-decimal price_net string", () => {
    const params = buildFakturaParams(samplePurchase);
    expect(params.positions[0].priceNet).toBe("10.00");
  });

  it("concatenates address_line1 + address_line2 into a single street field", () => {
    const params = buildFakturaParams({
      ...samplePurchase,
      buyer_address_line1: "ul. Marszałkowska 1",
      buyer_address_line2: "lok. 5"
    });
    expect(params.buyer.street).toBe("ul. Marszałkowska 1, lok. 5");
  });

  it("uses only line1 when line2 is null", () => {
    const params = buildFakturaParams(samplePurchase);
    expect(params.buyer.street).toBe("ul. Marszałkowska 1");
  });

  it("returns undefined street when both lines are null", () => {
    const params = buildFakturaParams({
      ...samplePurchase,
      buyer_address_line1: null,
      buyer_address_line2: null
    });
    expect(params.buyer.street).toBeUndefined();
  });

  it("includes a single position line with quantity = package_size", () => {
    const params = buildFakturaParams(samplePurchase);
    expect(params.positions).toHaveLength(1);
    expect(params.positions[0].quantity).toBe(50);
    expect(params.positions[0].name).toBe(
      "KSeF Translator — pakiet 50 kredytów"
    );
    expect(params.positions[0].tax).toBe("23");
  });

  it("uses the purchase created_at date in YYYY-MM-DD format", () => {
    const params = buildFakturaParams(samplePurchase);
    expect(params.issueDate).toBe("2026-05-27");
  });

  it("passes through stripePurchaseId for idempotency", () => {
    const params = buildFakturaParams(samplePurchase);
    expect(params.stripePurchaseId).toBe("purchase-uuid");
  });

  it("throws when buyer_nip is missing", () => {
    expect(() =>
      buildFakturaParams({ ...samplePurchase, buyer_nip: null })
    ).toThrow(/buyer_nip/);
  });

  it("throws when buyer_business_name is missing", () => {
    expect(() =>
      buildFakturaParams({ ...samplePurchase, buyer_business_name: null })
    ).toThrow(/buyer_business_name/);
  });
});
