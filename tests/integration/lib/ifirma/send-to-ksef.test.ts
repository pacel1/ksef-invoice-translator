import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendToKsef } from "@/lib/billing/ifirma/send-to-ksef";

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

describe("sendToKsef", () => {
  it("POSTs DataWysylki:null to the vat send endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { Kod: 0, Informacja: "Wysłano." } }), { status: 200 })
    );
    globalThis.fetch = fetchMock;

    await sendToKsef("1244512", { korekta: false });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.ifirma.pl/iapi/fakturakraj/ksef/send/1244512.json"
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ DataWysylki: null });
  });

  it("uses the korekta path when korekta=true", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { Kod: 0 } }), { status: 200 })
    );
    globalThis.fetch = fetchMock;

    await sendToKsef("152212", { korekta: true });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.ifirma.pl/iapi/fakturakraj/korekta/ksef/send/152212.json"
    );
  });
});
