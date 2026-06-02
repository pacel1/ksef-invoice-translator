import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regression test for the korekta idempotency guard. The vat branch already
// short-circuits the create call when `provider_invoice_id` is set; this test
// pins the equivalent behaviour for the correction branch — so a retry never
// issues a second korekta in iFirma against the same original invoice.

const issueKorekta = vi.fn();
const sendToKsef = vi.fn();
vi.mock("@/lib/billing/ifirma", () => ({
  issueFaktura: vi.fn(),
  sendToKsef: (...args: unknown[]) => sendToKsef(...args),
  issueKorekta: (...args: unknown[]) => issueKorekta(...args),
  getKsefStatus: vi.fn()
}));

const KOREKTA_ROW_WITH_PROVIDER_ID = {
  id: "korekta-row-1",
  stripe_purchase_id: "sp-1",
  kind: "correction",
  parent_id: "vat-row-1",
  // Already persisted by a previous attempt — the retry must NOT call
  // issueKorekta again.
  provider_invoice_id: "iFirma-152212",
  attempt_count: 1,
  stripe_purchases: {
    id: "sp-1",
    package_size: 50,
    unit_price_cents: 156,
    total_amount_cents: 7800,
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
  }
};

const KOREKTA_ROW_FRESH = {
  ...KOREKTA_ROW_WITH_PROVIDER_ID,
  id: "korekta-row-fresh",
  provider_invoice_id: null,
  attempt_count: 0
};

const PARENT_OK = {
  provider_invoice_id: "iFirma-1244512",
  gov_status: "ok",
  gov_id: "5260250995-20260528-0100001AF629-AF"
};

// Toggle which pending row the mocked Supabase returns. We swap this between
// test cases to drive the two scenarios.
let pendingRow: typeof KOREKTA_ROW_WITH_PROVIDER_ID | typeof KOREKTA_ROW_FRESH =
  KOREKTA_ROW_WITH_PROVIDER_ID;

vi.mock("@/lib/supabase/admin", () => {
  function makeQuery() {
    const filters: Array<{ method: string; args: unknown[] }> = [];
    const chain: Record<string, unknown> = {};
    const methods = [
      "select",
      "in",
      "eq",
      "neq",
      "lt",
      "lte",
      "gt",
      "gte",
      "not",
      "is",
      "order",
      "limit",
      "update",
      "insert",
      "single",
      "maybeSingle"
    ];
    for (const m of methods) {
      chain[m] = (...args: unknown[]) => {
        filters.push({ method: m, args });
        return chain;
      };
    }
    chain.then = (resolve: (v: unknown) => unknown) => {
      const isUpdate = filters.some((f) => f.method === "update");
      const isParentLookup = filters.some((f) => f.method === "single");
      const isPendingScan = filters.some(
        (f) =>
          f.method === "in" &&
          Array.isArray(f.args[1]) &&
          (f.args[1] as string[]).includes("pending")
      );
      const isProcessingScan = filters.some(
        (f) =>
          f.method === "eq" &&
          f.args[0] === "gov_status" &&
          f.args[1] === "processing"
      );

      if (isUpdate) return resolve({ data: { id: "k1" }, error: null });
      if (isParentLookup) return resolve({ data: PARENT_OK, error: null });
      if (isPendingScan) return resolve({ data: [pendingRow], error: null });
      if (isProcessingScan) return resolve({ data: [], error: null });
      return resolve({ data: [], error: null });
    };
    return chain;
  }
  return {
    getSupabaseAdminClient: () => ({ from: () => makeQuery() })
  };
});

import { POST } from "@/app/api/cron/poll-ksef/route";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.CRON_SECRET = "test-cron-secret";
  process.env.IFIRMA_USERNAME = "test-login";
  process.env.IFIRMA_INVOICE_KEY = "0123456789abcdef0123456789abcdef";
  process.env.KSEF_LIVE = "true";
  issueKorekta.mockReset();
  sendToKsef.mockReset();
  sendToKsef.mockResolvedValue(undefined);
  issueKorekta.mockResolvedValue({ providerInvoiceId: "iFirma-152212-fresh" });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function makeRequest(): Request {
  return new Request("http://localhost/api/cron/poll-ksef", {
    method: "POST",
    headers: { Authorization: "Bearer test-cron-secret" }
  });
}

describe("/api/cron/poll-ksef — korekta idempotency", () => {
  it("does NOT call issueKorekta when the row already has provider_invoice_id (retry case)", async () => {
    pendingRow = KOREKTA_ROW_WITH_PROVIDER_ID;

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    expect(issueKorekta).not.toHaveBeenCalled();
    // The existing provider_invoice_id is still pushed to KSeF on the retry.
    expect(sendToKsef).toHaveBeenCalledWith("iFirma-152212", { korekta: true });
  });

  it("DOES call issueKorekta when the row has no provider_invoice_id yet (happy path)", async () => {
    pendingRow = KOREKTA_ROW_FRESH;

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    expect(issueKorekta).toHaveBeenCalledTimes(1);
    // The freshly-created id flows into sendToKsef.
    expect(sendToKsef).toHaveBeenCalledWith("iFirma-152212-fresh", {
      korekta: true
    });
  });
});
