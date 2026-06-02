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

describe("getKsefStatus", () => {
  it("GETs the single-invoice JSON for the given id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { Kod: 0 } }), { status: 200 })
    );
    globalThis.fetch = fetchMock;
    await getKsefStatus("1244512");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.ifirma.pl/iapi/fakturakraj/1244512.json"
    );
  });

  it("maps a KSeF reference number field to govStatus=ok + govId", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            Kod: 0,
            NumerKSeF: "5260250995-20260528-0100001AF629-AF"
          }
        }),
        { status: 200 }
      )
    );
    const result = await getKsefStatus("1");
    expect(result.govStatus).toBe("ok");
    expect(result.govId).toBe("5260250995-20260528-0100001AF629-AF");
  });

  it("returns govStatus=processing when no KSeF number is present yet", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { Kod: 0, CzyWyslano: true } }), { status: 200 })
    );
    const result = await getKsefStatus("1");
    expect(result.govStatus).toBe("processing");
    expect(result.govId).toBeNull();
  });

  it("always returns the raw body for later field discovery", async () => {
    const payload = { response: { Kod: 0, somethingUnknown: 42 } };
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 })
    );
    const result = await getKsefStatus("1");
    expect(result.raw).toEqual(payload);
  });
});
