import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getKsefStatus } from "@/lib/billing/ifirma/get-status";

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

// The single-invoice GET returns the invoice object DIRECTLY (no { response }
// wrapper) — confirmed against the live iFirma API on 2026-06-02. These
// fixtures use that real shape.

describe("getKsefStatus", () => {
  it("GETs the single-invoice JSON for the given id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ Numer: 9 }), { status: 200 })
    );
    globalThis.fetch = fetchMock;
    await getKsefStatus("1244512");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.ifirma.pl/iapi/fakturakraj/1244512.json"
    );
  });

  it("maps NumerKSEF + StatusKSEF=PRZYJETA_W_KSEF to govStatus=ok + govId", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Numer: 9,
          NumerKSEF: "5213500025-20260520-560CCC000005-68",
          StatusKSEF: {
            Status: "PRZYJETA_W_KSEF",
            Opis: "Sukces (kod przetwarzania: 200)"
          }
        }),
        { status: 200 }
      )
    );
    const result = await getKsefStatus("1");
    expect(result.govStatus).toBe("ok");
    expect(result.govId).toBe("5213500025-20260520-560CCC000005-68");
    expect(result.errorMessages).toEqual([]);
  });

  it("treats a PRZYJ* status as accepted even if NumerKSEF is briefly absent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Numer: 9,
          NumerKSEF: null,
          StatusKSEF: { Status: "PRZYJETA_W_KSEF", Opis: "Sukces" }
        }),
        { status: 200 }
      )
    );
    const result = await getKsefStatus("1");
    expect(result.govStatus).toBe("ok");
  });

  it("maps a rejection status to send_error + surfaces Opis as the message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Numer: 9,
          NumerKSEF: null,
          StatusKSEF: {
            Status: "ODRZUCONA_PRZEZ_KSEF",
            Opis: "Błąd walidacji: niepoprawny NIP nabywcy"
          }
        }),
        { status: 200 }
      )
    );
    const result = await getKsefStatus("1");
    expect(result.govStatus).toBe("send_error");
    expect(result.errorMessages).toEqual([
      "Błąd walidacji: niepoprawny NIP nabywcy"
    ]);
    expect(result.govId).toBeNull();
  });

  it("maps a BŁĄD send-error status to send_error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Numer: 9,
          NumerKSEF: null,
          StatusKSEF: { Status: "BŁĄD_WYSYŁKI", Opis: "Timeout bramki KSeF" }
        }),
        { status: 200 }
      )
    );
    const result = await getKsefStatus("1");
    expect(result.govStatus).toBe("send_error");
    expect(result.errorMessages).toEqual(["Timeout bramki KSeF"]);
  });

  it("returns processing when sent but not yet accepted (no number, non-terminal status)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          Numer: 9,
          NumerKSEF: null,
          StatusKSEF: { Status: "WYSLANA_DO_KSEF", Opis: "W trakcie przetwarzania" }
        }),
        { status: 200 }
      )
    );
    const result = await getKsefStatus("1");
    expect(result.govStatus).toBe("processing");
    expect(result.govId).toBeNull();
  });

  it("returns processing when StatusKSEF is absent (not yet dispatched)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ Numer: 9 }), { status: 200 })
    );
    const result = await getKsefStatus("1");
    expect(result.govStatus).toBe("processing");
    expect(result.govId).toBeNull();
  });

  it("always returns the raw body for audit/debugging", async () => {
    const payload = { Numer: 9, StatusKSEF: { Status: "PRZYJETA_W_KSEF" } };
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 })
    );
    const result = await getKsefStatus("1");
    expect(result.raw).toEqual(payload);
  });
});
