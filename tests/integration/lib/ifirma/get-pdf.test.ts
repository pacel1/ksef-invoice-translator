import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFakturaPdf } from "@/lib/billing/ifirma/get-pdf";

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

describe("getFakturaPdf", () => {
  it("GETs the .pdf endpoint with Accept: application/pdf and returns bytes", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(pdfBytes, { status: 200, headers: { "Content-Type": "application/pdf" } })
    );
    globalThis.fetch = fetchMock;

    const buf = await getFakturaPdf("1244512");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.ifirma.pl/iapi/fakturakraj/1244512.pdf"
    );
    expect(fetchMock.mock.calls[0][1].headers.Accept).toBe("application/pdf");
    expect(new Uint8Array(buf)).toEqual(pdfBytes);
  });
});
