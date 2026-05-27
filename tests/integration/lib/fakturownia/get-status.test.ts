import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFakturaStatus } from "@/lib/billing/fakturownia/get-status";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.FAKTUROWNIA_ACCOUNT = "mycompany";
  process.env.FAKTUROWNIA_API_TOKEN = "test-token";
  process.env.FAKTUROWNIA_ENV = "demo";
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

describe("getFakturaStatus", () => {
  it("hits GET /invoices/{id}.json with api_token query param", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 12345,
          number: "F/27/05/2026",
          view_url: "https://example.com",
          gov_status: "ok",
          gov_id: "5260250995-20260527-0100001AF629-AF",
          gov_send_date: "2026-05-27T10:00:00Z",
          gov_status_date: "2026-05-27T10:00:05Z",
          gov_error_messages: null,
          gov_verification_link: "https://ksef.mf.gov.pl/web/verify/..."
        }),
        { status: 200 }
      )
    );
    globalThis.fetch = fetchMock;

    const result = await getFakturaStatus("12345");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://mycompany.demo.fakturownia.pl/invoices/12345.json?api_token=test-token"
    );
    expect(result.govStatus).toBe("ok");
    expect(result.govId).toBe("5260250995-20260527-0100001AF629-AF");
    expect(result.govVerificationLink).toBe(
      "https://ksef.mf.gov.pl/web/verify/..."
    );
  });

  it("returns errorMessages for send_error states", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          number: "F/1/2026",
          view_url: "https://example.com",
          gov_status: "send_error",
          gov_id: null,
          gov_send_date: "2026-05-27T10:00:00Z",
          gov_status_date: "2026-05-27T10:00:05Z",
          gov_error_messages: ["Niepoprawny NIP nabywcy"],
          gov_verification_link: null
        }),
        { status: 200 }
      )
    );

    const result = await getFakturaStatus("1");
    expect(result.govStatus).toBe("send_error");
    expect(result.errorMessages).toEqual(["Niepoprawny NIP nabywcy"]);
  });
});
