import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueKorekta } from "@/lib/billing/ifirma/issue-korekta";

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

describe("issueKorekta", () => {
  it("POSTs to /fakturakraj/korekta/<originalId>.json and returns the new id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ response: { Kod: 0, Identyfikator: "152212" } }),
        { status: 200 }
      )
    );
    globalThis.fetch = fetchMock;

    const result = await issueKorekta({
      originalProviderInvoiceId: "1244512",
      reason: "ZWR_SPRZ_TOW",
      issueDate: "2026-05-29",
      sposobZaplaty: "KOM",
      zaplacono: 0,
      positions: [
        {
          StawkaVat: 0.23,
          Ilosc: 0,
          CenaJednostkowa: 1.56,
          NazwaPelna: "KSeF Translator — pakiet 50 kredytów",
          Jednostka: "szt",
          TypStawkiVat: "PRC"
        }
      ]
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.ifirma.pl/iapi/fakturakraj/korekta/1244512.json"
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.PowodKorekty).toBe("ZWR_SPRZ_TOW");
    expect(body.DataWystawienia).toBe("2026-05-29");
    expect(body.Pozycje[0].Ilosc).toBe(0);
    expect(result.providerInvoiceId).toBe("152212");
  });
});
