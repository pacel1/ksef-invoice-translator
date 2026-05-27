import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueKorekta } from "@/lib/billing/fakturownia/issue-korekta";

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

describe("issueKorekta", () => {
  it("posts kind='correction' with from_invoice_id referencing the original", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 99999,
          number: "FK/1/27/05/2026",
          view_url: "https://example.com/korekta",
          gov_status: "processing",
          gov_id: null,
          gov_send_date: "2026-05-27T11:00:00Z",
          gov_status_date: null,
          gov_error_messages: null,
          gov_verification_link: null
        }),
        { status: 200 }
      )
    );
    globalThis.fetch = fetchMock;

    await issueKorekta({
      originalFakturowniaId: "12345",
      stripePurchaseId: "purchase-uuid",
      issueDate: "2026-05-28",
      reason: "Zwrot kredytów - rezygnacja klienta",
      positions: [
        {
          name: "KSeF Translator — pakiet 50 kredytów",
          quantity: 50,
          priceNet: "-10.00",  // negative for refund
          tax: "23"
        }
      ],
      currency: "pln"
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.invoice.kind).toBe("correction");
    expect(body.invoice.from_invoice_id).toBe(12345);
    expect(body.invoice.oid).toBe("purchase-uuid:korekta");
    expect(body.invoice.gov_save_and_send).toBe(true);
    expect(body.invoice.description).toContain("Zwrot");
    expect(body.invoice.positions[0].price_net).toBe("-10.00");
  });
});
