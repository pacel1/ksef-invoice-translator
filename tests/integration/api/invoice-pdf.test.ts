import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

// Mocks for the route's dependencies.
const getUser = vi.fn();
const maybeSingle = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) })
    })
  })
}));
const getFakturaPdf = vi.fn();
vi.mock("@/lib/billing/ifirma", () => ({ getFakturaPdf: (id: string) => getFakturaPdf(id) }));

import { GET } from "@/app/api/invoices/[id]/pdf/route";

beforeEach(() => {
  process.env.IFIRMA_USERNAME = "u";
  process.env.IFIRMA_INVOICE_KEY = "0123456789abcdef0123456789abcdef";
  getUser.mockReset();
  maybeSingle.mockReset();
  getFakturaPdf.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function req(): Request {
  return new Request("http://localhost/api/invoices/ksef-1/pdf");
}

describe("GET /api/invoices/[id]/pdf", () => {
  it("401 when not authenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await GET(req(), { params: Promise.resolve({ id: "ksef-1" }) });
    expect(res.status).toBe(401);
  });

  it("404 when the ksef_invoice row is not visible to the user (RLS)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await GET(req(), { params: Promise.resolve({ id: "ksef-1" }) });
    expect(res.status).toBe(404);
  });

  it("404 when the row has no provider_invoice_id yet", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { id: "ksef-1", provider_invoice_id: null }, error: null });
    const res = await GET(req(), { params: Promise.resolve({ id: "ksef-1" }) });
    expect(res.status).toBe(404);
  });

  it("streams the PDF with application/pdf when authorized", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { id: "ksef-1", provider_invoice_id: "1244512" }, error: null });
    getFakturaPdf.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer);
    const res = await GET(req(), { params: Promise.resolve({ id: "ksef-1" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(getFakturaPdf).toHaveBeenCalledWith("1244512");
  });
});
