import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueFaktura } from "@/lib/billing/fakturownia/issue-faktura";

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

describe("issueFaktura", () => {
  const sampleParams = {
    stripePurchaseId: "purchase-uuid",
    issueDate: "2026-05-27",
    buyer: {
      taxNo: "5260250995",
      name: "ACME Sp. z o.o.",
      street: "ul. Marszałkowska 1",
      postCode: "00-001",
      city: "Warszawa",
      country: "pl",
      email: "biuro@acme.pl"
    },
    positions: [
      {
        name: "KSeF Translator — pakiet 50 kredytów",
        quantity: 50,
        priceNet: "10.00",
        tax: "23"
      }
    ],
    currency: "pln" as const
  };

  it("posts the right body shape to /invoices.json", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 12345,
          number: "F/27/05/2026",
          view_url: "https://mycompany.demo.fakturownia.pl/invoices/12345/view?token=xyz",
          gov_status: "processing",
          gov_id: null,
          gov_send_date: "2026-05-27T10:00:00Z",
          gov_status_date: null,
          gov_error_messages: null,
          gov_verification_link: null
        }),
        { status: 200 }
      )
    );
    globalThis.fetch = fetchMock;

    await issueFaktura(sampleParams);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.invoice.kind).toBe("vat");
    expect(body.invoice.buyer_tax_no).toBe("5260250995");
    expect(body.invoice.buyer_name).toBe("ACME Sp. z o.o.");
    expect(body.invoice.issue_date).toBe("2026-05-27");
    expect(body.invoice.gov_save_and_send).toBe(true);
    expect(body.invoice.oid).toBe("purchase-uuid");
    expect(body.invoice.positions).toHaveLength(1);
    expect(body.invoice.positions[0]).toMatchObject({
      name: "KSeF Translator — pakiet 50 kredytów",
      quantity: 50,
      price_net: "10.00",
      tax: "23"
    });
    expect(body.invoice.currency).toBe("pln");
    expect(body.api_token).toBe("test-token");
  });

  it("returns a normalized FakturaResult", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 12345,
          number: "F/27/05/2026",
          view_url: "https://example.com/pdf",
          gov_status: "processing",
          gov_id: null,
          gov_send_date: "2026-05-27T10:00:00Z",
          gov_status_date: null,
          gov_error_messages: null,
          gov_verification_link: null
        }),
        { status: 200 }
      )
    );

    const result = await issueFaktura(sampleParams);

    expect(result).toEqual({
      fakturowniaId: "12345",
      invoiceNumber: "F/27/05/2026",
      pdfUrl: "https://example.com/pdf",
      govStatus: "processing",
      govId: null,
      govSendDate: "2026-05-27T10:00:00Z",
      govVerificationLink: null,
      errorMessages: []
    });
  });

  it("normalizes a null gov_status to 'processing' for downstream state machine", async () => {
    // Fakturownia returns null when KSeF hasn't been called yet (e.g., account
    // not connected). We treat this as 'processing' so the cron picks it up
    // and retries; if the account is misconfigured the next poll will surface
    // the real error.
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          number: "F/1/2026",
          view_url: "https://example.com",
          gov_status: null,
          gov_id: null,
          gov_send_date: null,
          gov_status_date: null,
          gov_error_messages: null,
          gov_verification_link: null
        }),
        { status: 200 }
      )
    );

    const result = await issueFaktura(sampleParams);
    expect(result.govStatus).toBe("processing");
  });

  it("forwards gov_error_messages as errorMessages", async () => {
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
          gov_error_messages: ["NIP nie istnieje", "Niepoprawna data"],
          gov_verification_link: null
        }),
        { status: 200 }
      )
    );

    const result = await issueFaktura(sampleParams);
    expect(result.govStatus).toBe("send_error");
    expect(result.errorMessages).toEqual(["NIP nie istnieje", "Niepoprawna data"]);
  });
});
