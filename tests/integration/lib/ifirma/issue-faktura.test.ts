import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueFaktura } from "@/lib/billing/ifirma/issue-faktura";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.IFIRMA_USERNAME = "testuser";
  process.env.IFIRMA_INVOICE_KEY = "0123456789abcdef0123456789abcdef";
  delete process.env.IFIRMA_BASE_URL;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

const sampleBody = {
  Zaplacono: 95.94,
  ZaplaconoNaDokumencie: 95.94,
  LiczOd: "NET" as const,
  DataWystawienia: "2026-05-28",
  DataSprzedazy: "2026-05-28",
  FormatDatySprzedazy: "DZN" as const,
  SposobZaplaty: "PRZ",
  NazwaSeriiNumeracji: "default",
  RodzajPodpisuOdbiorcy: "BPO" as const,
  WidocznyNumerGios: false,
  Numer: null,
  Pozycje: [
    {
      StawkaVat: 0.23,
      Ilosc: 50,
      CenaJednostkowa: 1.56,
      NazwaPelna: "KSeF Translator — pakiet 50 kredytów",
      Jednostka: "szt",
      PKWiU: "",
      TypStawkiVat: "PRC" as const
    }
  ],
  Kontrahent: {
    Nazwa: "ACME Sp. z o.o.",
    NIP: "5260250995",
    Ulica: "ul. Marszałkowska 1",
    KodPocztowy: "00-001",
    Miejscowosc: "Warszawa",
    Kraj: "Polska",
    Email: "biuro@acme.pl",
    OsobaFizyczna: false
  }
};

describe("issueFaktura", () => {
  it("POSTs to /fakturakraj.json and returns the Identyfikator", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response: { Kod: 0, Informacja: "Faktura dodana.", Identyfikator: "1244512" }
        }),
        { status: 200 }
      )
    );
    globalThis.fetch = fetchMock;

    const result = await issueFaktura(sampleBody);

    expect(fetchMock.mock.calls[0][0]).toBe("https://www.ifirma.pl/iapi/fakturakraj.json");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.LiczOd).toBe("NET");
    expect(body.Pozycje[0].StawkaVat).toBe(0.23);
    expect(body.Kontrahent.OsobaFizyczna).toBe(false);
    expect(result.providerInvoiceId).toBe("1244512");
  });

  it("throws when the response has no Identyfikator", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { Kod: 0, Informacja: "ok" } }), { status: 200 })
    );
    await expect(issueFaktura(sampleBody)).rejects.toThrow(/Identyfikator/);
  });
});
