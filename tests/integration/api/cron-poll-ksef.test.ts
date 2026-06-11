import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KsefInvoiceResult } from "@/lib/billing/ifirma";

// Row shape is intentionally loose: the cron handler reads whatever columns it
// selected, and the mock store doesn't enforce a schema.
type Row = Record<string, unknown>;

// Shared, hoisted test state so the `vi.mock` factories below can reference it.
// The admin client is backed by a tiny in-memory store that actually applies
// the filters the handler chains (`.eq`, `.lt`, `.not`, ...). This lets a test
// observe the real consequence of the query — e.g. that a freshly-issued row
// is excluded from the processing pass by the `created_at` grace window —
// rather than asserting on the query builder calls.
const h = vi.hoisted(() => {
  const store: { tables: Record<string, Row[]> } = { tables: {} };
  return {
    store,
    seed(table: string, rows: Row[]) {
      store.tables[table] = rows;
    },
    reset() {
      store.tables = {};
    },
    issueFaktura: vi.fn(),
    sendToKsef: vi.fn(),
    issueKorekta: vi.fn(),
    getKsefStatus: vi.fn(),
    buildIfirmaFaktura: vi.fn()
  };
});

vi.mock("@/lib/supabase/admin", () => {
  // Numeric values compare numerically; everything else (notably ISO-8601
  // timestamps, which sort chronologically as strings) compares lexically.
  function compare(a: unknown, b: unknown): number {
    if (typeof a === "number" && typeof b === "number") return a - b;
    const sa = String(a);
    const sb = String(b);
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  }

  interface QueryStub {
    select: (cols?: string) => QueryStub;
    in: (col: string, vals: readonly unknown[]) => QueryStub;
    eq: (col: string, val: unknown) => QueryStub;
    neq: (col: string, val: unknown) => QueryStub;
    lt: (col: string, val: unknown) => QueryStub;
    lte: (col: string, val: unknown) => QueryStub;
    gt: (col: string, val: unknown) => QueryStub;
    gte: (col: string, val: unknown) => QueryStub;
    not: (col: string, op: string, val: unknown) => QueryStub;
    is: (col: string, val: unknown) => QueryStub;
    order: (col: string, opts?: { ascending?: boolean }) => QueryStub;
    limit: (n: number) => QueryStub;
    update: (payload: Row) => QueryStub;
    insert: (payload: Row | Row[]) => QueryStub;
    single: () => Promise<{ data: Row | null; error: unknown }>;
    maybeSingle: () => Promise<{ data: Row | null; error: unknown }>;
    then: (
      onFulfilled: (value: { data: Row[]; error: null }) => unknown
    ) => unknown;
  }

  function makeQuery(table: string): QueryStub {
    const filters: Array<(row: Row) => boolean> = [];
    let sortSpec: { col: string; asc: boolean } | null = null;
    let limitN: number | null = null;
    let mode: "select" | "update" | "insert" = "select";
    let payload: Row | Row[] | null = null;

    const rows = (): Row[] => h.store.tables[table] ?? [];
    const matched = (): Row[] => rows().filter((r) => filters.every((f) => f(r)));
    const clone = (r: Row): Row => ({ ...r });

    function resolve(): { data: Row[]; error: null } {
      if (mode === "insert") {
        const list = Array.isArray(payload) ? payload : payload ? [payload] : [];
        const inserted = list.map(clone);
        (h.store.tables[table] ??= []).push(...inserted);
        return { data: inserted.map(clone), error: null };
      }
      if (mode === "update") {
        const targets = matched();
        for (const t of targets) Object.assign(t, payload);
        return { data: targets.map(clone), error: null };
      }
      let result = matched();
      if (sortSpec) {
        const { col, asc } = sortSpec;
        result = [...result].sort((a, b) => {
          const c = compare(a[col], b[col]);
          return asc ? c : -c;
        });
      }
      if (limitN !== null) result = result.slice(0, limitN);
      return { data: result.map(clone), error: null };
    }

    const query: QueryStub = {
      select: () => query,
      in: (col, vals) => {
        filters.push((r) => (vals as readonly unknown[]).includes(r[col]));
        return query;
      },
      eq: (col, val) => {
        filters.push((r) => r[col] === val);
        return query;
      },
      neq: (col, val) => {
        filters.push((r) => r[col] !== val);
        return query;
      },
      lt: (col, val) => {
        filters.push((r) => compare(r[col], val) < 0);
        return query;
      },
      lte: (col, val) => {
        filters.push((r) => compare(r[col], val) <= 0);
        return query;
      },
      gt: (col, val) => {
        filters.push((r) => compare(r[col], val) > 0);
        return query;
      },
      gte: (col, val) => {
        filters.push((r) => compare(r[col], val) >= 0);
        return query;
      },
      not: (col, op, val) => {
        if (op === "is" && val === null) {
          filters.push((r) => r[col] !== null && r[col] !== undefined);
        } else {
          filters.push((r) => r[col] !== val);
        }
        return query;
      },
      is: (col, val) => {
        filters.push((r) => r[col] === val);
        return query;
      },
      order: (col, opts) => {
        sortSpec = { col, asc: opts?.ascending !== false };
        return query;
      },
      limit: (n) => {
        limitN = n;
        return query;
      },
      update: (p) => {
        mode = "update";
        payload = p;
        return query;
      },
      insert: (p) => {
        mode = "insert";
        payload = p;
        return query;
      },
      single: () => {
        const data = matched()[0] ?? null;
        return Promise.resolve({
          data: data ? clone(data) : null,
          error: data ? null : { message: "No rows found" }
        });
      },
      maybeSingle: () => {
        const data = matched()[0] ?? null;
        return Promise.resolve({ data: data ? clone(data) : null, error: null });
      },
      then: (onFulfilled) => onFulfilled(resolve())
    };
    return query;
  }

  const fakeAdmin = { from: (table: string) => makeQuery(table) };
  return { getSupabaseAdminClient: () => fakeAdmin };
});

vi.mock("@/lib/billing/ifirma", () => ({
  issueFaktura: h.issueFaktura,
  sendToKsef: h.sendToKsef,
  issueKorekta: h.issueKorekta,
  getKsefStatus: h.getKsefStatus
}));

vi.mock("@/lib/billing/build-ifirma-faktura", () => ({
  buildIfirmaFaktura: h.buildIfirmaFaktura
}));

import { POST } from "@/app/api/cron/poll-ksef/route";

const ORIGINAL_ENV = { ...process.env };

function ksefStatusResult(
  overrides: Partial<KsefInvoiceResult> = {}
): KsefInvoiceResult {
  return {
    providerInvoiceId: "iFirma-1",
    govStatus: "processing",
    govId: null,
    errorMessages: [],
    ...overrides
  };
}

beforeEach(() => {
  process.env.CRON_SECRET = "test-cron-secret";
  process.env.IFIRMA_USERNAME = "test-login";
  process.env.IFIRMA_INVOICE_KEY = "0123456789abcdef0123456789abcdef";
  process.env.KSEF_LIVE = "true";

  vi.clearAllMocks();
  h.reset();
  // Sensible defaults — individual tests override when needed.
  h.buildIfirmaFaktura.mockReturnValue({
    Pozycje: [],
    Kontrahent: { Nazwa: "x", NIP: "0000000000", OsobaFizyczna: false }
  });
  h.issueFaktura.mockResolvedValue({ providerInvoiceId: "iFirma-fresh" });
  h.sendToKsef.mockResolvedValue(undefined);
  h.getKsefStatus.mockResolvedValue(
    ksefStatusResult({ govStatus: "ok", govId: "KSEF-OK-1" })
  );
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

describe("/api/cron/poll-ksef retry-budget protection", () => {
  // Regression: the pending pass issues a faktura and flips it to
  // 'processing'. The processing pass that follows in the SAME invocation
  // must not poll it — the freshly-submitted document is still 'processing'
  // in KSeF, so polling would burn one of the 5 attempt-count retries for
  // no information.
  it("does not poll a row it just issued in the same invocation", async () => {
    const nowIso = new Date().toISOString();
    h.seed("ksef_invoices", [
      {
        id: "row-fresh",
        kind: "vat",
        parent_id: null,
        attempt_count: 0,
        gov_status: "pending",
        provider_invoice_id: null,
        created_at: nowIso,
        stripe_purchase_id: "sp-fresh",
        stripe_purchases: { id: "sp-fresh" }
      }
    ]);

    const res = await POST(makeRequest("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const actions = body.processed.map((p: { action: string }) => p.action);

    // The row really was issued this cycle (vat: create + send-to-KSeF)...
    expect(h.issueFaktura).toHaveBeenCalledTimes(1);
    expect(h.sendToKsef).toHaveBeenCalledTimes(1);
    expect(actions).toContain("issued");

    // ...yet the processing pass left it alone — no poll, no wasted attempt.
    expect(h.getKsefStatus).not.toHaveBeenCalled();
    expect(actions).not.toContain("polled");

    // It stays 'processing', a candidate for a *future* cycle once it ages
    // past the grace window — the attempt_count was not spent here.
    expect(h.store.tables["ksef_invoices"][0].gov_status).toBe("processing");
  });

  // Boundary check proving the grace window — not some accident of the mock —
  // is what skips the fresh row: a processing row older than the window IS
  // polled as normal.
  it("polls a processing row once it is older than the grace window", async () => {
    const oldIso = new Date(Date.now() - 60_000).toISOString();
    h.seed("ksef_invoices", [
      {
        id: "row-old",
        kind: "vat",
        parent_id: null,
        attempt_count: 1,
        gov_status: "processing",
        provider_invoice_id: "iFirma-old",
        created_at: oldIso,
        stripe_purchase_id: "sp-old",
        stripe_purchases: { id: "sp-old" }
      }
    ]);

    const res = await POST(makeRequest("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const actions = body.processed.map((p: { action: string }) => p.action);

    expect(h.issueFaktura).not.toHaveBeenCalled();
    expect(h.getKsefStatus).toHaveBeenCalledTimes(1);
    expect(h.getKsefStatus).toHaveBeenCalledWith("iFirma-old");
    expect(actions).toContain("polled");
  });
});

describe("/api/cron/poll-ksef double-issue protection", () => {
  // A row another worker has already claimed (flipped pending -> processing as
  // its issuance claim) but not yet minted (provider_invoice_id null) must NOT
  // be issued by this run: it is out of the pending pool, and the stranded-claim
  // recovery leaves it alone while it is still fresh. This is the property that
  // stops two overlapping cron runs from minting duplicate legal documents.
  it("does not re-issue a row another worker just claimed", async () => {
    const nowIso = new Date().toISOString();
    h.seed("ksef_invoices", [
      {
        id: "row-claimed",
        kind: "vat",
        parent_id: null,
        attempt_count: 1,
        gov_status: "processing",
        provider_invoice_id: null,
        created_at: nowIso,
        updated_at: nowIso,
        stripe_purchase_id: "sp-claimed",
        stripe_purchases: { id: "sp-claimed" }
      }
    ]);

    const res = await POST(makeRequest("Bearer test-cron-secret"));
    expect(res.status).toBe(200);

    expect(h.issueFaktura).not.toHaveBeenCalled();
    // Still 'processing' (untouched), not reverted or re-minted.
    expect(h.store.tables["ksef_invoices"][0].gov_status).toBe("processing");
    expect(h.store.tables["ksef_invoices"][0].provider_invoice_id).toBeNull();
  });

  // The flip side: a claim that crashed before minting (processing + null
  // provider) and is now older than the recovery window is reclaimed and issued.
  it("recovers and issues a stranded claim older than the recovery window", async () => {
    const oldIso = new Date(Date.now() - 10 * 60_000).toISOString();
    h.seed("ksef_invoices", [
      {
        id: "row-stranded",
        kind: "vat",
        parent_id: null,
        attempt_count: 1,
        gov_status: "processing",
        provider_invoice_id: null,
        created_at: oldIso,
        updated_at: oldIso,
        stripe_purchase_id: "sp-stranded",
        stripe_purchases: { id: "sp-stranded" }
      }
    ]);

    const res = await POST(makeRequest("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const actions = body.processed.map((p: { action: string }) => p.action);

    expect(h.issueFaktura).toHaveBeenCalledTimes(1);
    expect(actions).toContain("issued");
  });
});
