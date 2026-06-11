import { describe, expect, it } from "vitest";
import { buildIfirmaFaktura } from "@/lib/billing/build-ifirma-faktura";

const samplePurchase = {
  id: "purchase-uuid",
  package_size: 50,
  unit_price_cents: 156,     // 1.56 PLN net per credit
  total_amount_cents: 7800,  // 78.00 PLN net total
  currency: "pln",
  buyer_nip: "5260250995",
  buyer_business_name: "ACME Sp. z o.o.",
  buyer_email: "biuro@acme.pl",
  buyer_address_line1: "ul. Marszałkowska 1",
  buyer_address_line2: null,
  buyer_postal_code: "00-001",
  buyer_city: "Warszawa",
  buyer_country: "PL",
  created_at: "2026-05-28T10:00:00Z"
};

describe("buildIfirmaFaktura", () => {
  it("maps buyer into a Kontrahent with OsobaFizyczna=false", () => {
    const body = buildIfirmaFaktura(samplePurchase);
    expect(body.Kontrahent.NIP).toBe("5260250995");
    expect(body.Kontrahent.Nazwa).toBe("ACME Sp. z o.o.");
    expect(body.Kontrahent.Ulica).toBe("ul. Marszałkowska 1");
    expect(body.Kontrahent.KodPocztowy).toBe("00-001");
    expect(body.Kontrahent.Miejscowosc).toBe("Warszawa");
    expect(body.Kontrahent.Kraj).toBe("Polska");
    expect(body.Kontrahent.OsobaFizyczna).toBe(false);
  });

  it("strips PL prefix and separators from NIP", () => {
    expect(buildIfirmaFaktura({ ...samplePurchase, buyer_nip: "PL526-025-09-95" }).Kontrahent.NIP).toBe("5260250995");
  });

  it("concatenates line1 + line2 into Ulica", () => {
    const body = buildIfirmaFaktura({ ...samplePurchase, buyer_address_line2: "lok. 5" });
    expect(body.Kontrahent.Ulica).toBe("ul. Marszałkowska 1, lok. 5");
  });

  it("emits one net Pozycja with decimal VAT and TypStawkiVat=PRC", () => {
    const body = buildIfirmaFaktura(samplePurchase);
    expect(body.LiczOd).toBe("NET");
    expect(body.Pozycje).toHaveLength(1);
    expect(body.Pozycje[0].StawkaVat).toBe(0.23);
    expect(body.Pozycje[0].TypStawkiVat).toBe("PRC");
    expect(body.Pozycje[0].Ilosc).toBe(50);
    expect(body.Pozycje[0].CenaJednostkowa).toBe(1.56);
    expect(body.Pozycje[0].NazwaPelna).toBe("KSeF Translator — pakiet 50 kredytów");
  });

  it("sets Zaplacono to the gross total (net × 1.23, rounded to 2dp)", () => {
    const body = buildIfirmaFaktura(samplePurchase);
    // 78.00 net × 1.23 = 95.94
    expect(body.Zaplacono).toBe(95.94);
  });

  // iFirma rejects fakturakraj.json when these documented-required fields are
  // absent (live rejection 2026-06-11: Kod 201 on RodzajPodpisuOdbiorcy).
  it("includes the required iFirma fields: RodzajPodpisuOdbiorcy, ZaplaconoNaDokumencie, WidocznyNumerGios, Numer", () => {
    const body = buildIfirmaFaktura(samplePurchase);
    // BPO = bez podpisu odbiorcy — automated e-invoice, nobody signs.
    expect(body.RodzajPodpisuOdbiorcy).toBe("BPO");
    // Card payments are fully paid up front: amount shown on the document
    // equals the gross paid.
    expect(body.ZaplaconoNaDokumencie).toBe(95.94);
    expect(body.WidocznyNumerGios).toBe(false);
    // null tells iFirma to auto-assign the next number in the series.
    expect(body.Numer).toBeNull();
  });

  it("uses the purchase created_at date for DataWystawienia and DataSprzedazy", () => {
    const body = buildIfirmaFaktura(samplePurchase);
    expect(body.DataWystawienia).toBe("2026-05-28");
    expect(body.DataSprzedazy).toBe("2026-05-28");
  });

  it("throws when buyer_nip is missing", () => {
    expect(() => buildIfirmaFaktura({ ...samplePurchase, buyer_nip: null })).toThrow(/buyer_nip/);
  });

  it("throws when buyer_business_name is missing", () => {
    expect(() => buildIfirmaFaktura({ ...samplePurchase, buyer_business_name: null })).toThrow(/buyer_business_name/);
  });
});
