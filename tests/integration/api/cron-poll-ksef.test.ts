import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the admin client so the integration test doesn't actually hit Supabase
// (and doesn't require ksef_invoices rows or service-role creds to be fully
// loaded in the test runner). The cron handler only calls `.from(...)` on the
// admin client; we return a chainable stub whose select queries resolve to an
// empty array.
vi.mock("@/lib/supabase/admin", () => {
  const emptyResult = { data: [], error: null };
  // Build a chainable query stub. Every method returns `this` until the
  // chain is awaited, at which point it resolves to `emptyResult`.
  function makeQuery(): unknown {
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
      chain[m] = () => chain;
    }
    // `then` makes the chain thenable so `await query` resolves.
    chain.then = (resolve: (value: unknown) => unknown) => resolve(emptyResult);
    return chain;
  }
  const fakeAdmin = {
    from: () => makeQuery()
  };
  return { getSupabaseAdminClient: () => fakeAdmin };
});

import { POST } from "@/app/api/cron/poll-ksef/route";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.CRON_SECRET = "test-cron-secret";
  process.env.IFIRMA_USERNAME = "test-login";
  process.env.IFIRMA_INVOICE_KEY = "0123456789abcdef0123456789abcdef";
  process.env.KSEF_LIVE = "true";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/cron/poll-ksef", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {}
  });
}

describe("/api/cron/poll-ksef", () => {
  it("rejects requests without Bearer CRON_SECRET", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("rejects requests with the wrong Bearer token", async () => {
    const res = await POST(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with an empty work report when no rows are due", async () => {
    const res = await POST(makeRequest("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("processed");
    expect(Array.isArray(body.processed)).toBe(true);
  });

  it("skips when KSEF_LIVE is false", async () => {
    process.env.KSEF_LIVE = "false";
    const res = await POST(makeRequest("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
  });
});
