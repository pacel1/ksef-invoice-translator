import { describe, it, expect, vi, beforeEach } from "vitest";

const { renderOfficialFa3Pdf } = vi.hoisted(() => ({ renderOfficialFa3Pdf: vi.fn() }));
vi.mock("@/lib/mf-fa3/official-renderer", () => ({ renderOfficialFa3Pdf }));

const { consumePdf } = vi.hoisted(() => ({ consumePdf: vi.fn() }));
vi.mock("@/lib/demo/rate-limit", () => ({ consumePdf, clientIpFrom: () => "1.2.3.4" }));

import { POST } from "@/app/api/demo/pdf/route";
import { signDownloadToken } from "@/lib/demo/download-token";
import { buildDemoInvoice } from "@/lib/landing/demo-sample";
import { signUploadToken, demoContentHash } from "@/lib/demo/upload-token";

function post(body: unknown) {
  return new Request("http://x/api/demo/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  renderOfficialFa3Pdf.mockReset().mockResolvedValue(Buffer.from("%PDF-1.7 demo"));
  consumePdf.mockReset().mockResolvedValue({ allowed: true, count: 1 });
  process.env.DEMO_TOKEN_SECRET = "unit-secret";
});

describe("POST /api/demo/pdf", () => {
  it("renders and streams the demo PDF for a valid token", async () => {
    const token = signDownloadToken({ lang: "de", source: "sample" });
    const res = await POST(post({ downloadToken: token }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const arg = renderOfficialFa3Pdf.mock.calls[0][0];
    expect(arg.language).toBe("de");
    expect(arg.translated).toBe(true);
    expect(arg.bilingual).toBe(false);
    expect(typeof arg.sourceXml).toBe("string");
    expect(arg.sourceXml).toContain("FA (3)");
    expect(arg.invoice.items[1].translatedName).toBe("Eichenstuhl „Helena”");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("rejects a missing/invalid token", async () => {
    expect((await POST(post({ downloadToken: "garbage" }))).status).toBe(401);
    expect((await POST(post({}))).status).toBe(400);
  });

  it("rejects an expired token (401)", async () => {
    const token = signDownloadToken({ lang: "en", source: "sample" }, Date.now() - 60 * 60_000);
    expect((await POST(post({ downloadToken: token }))).status).toBe(401);
  });

  it("rejects a token carrying an unsupported language (401)", async () => {
    const token = signDownloadToken({ lang: "xx", source: "sample" });
    expect((await POST(post({ downloadToken: token }))).status).toBe(401);
    expect(renderOfficialFa3Pdf).not.toHaveBeenCalled();
  });

  it("returns 500 when the renderer throws", async () => {
    renderOfficialFa3Pdf.mockRejectedValueOnce(new Error("render boom"));
    const token = signDownloadToken({ lang: "en", source: "sample" });
    expect((await POST(post({ downloadToken: token }))).status).toBe(500);
  });

  it("returns 500 when the token secret is not configured", async () => {
    delete process.env.DEMO_TOKEN_SECRET;
    expect((await POST(post({ downloadToken: "anything" }))).status).toBe(500);
  });
});

describe("POST /api/demo/pdf (upload source)", () => {
  const UPLOAD_XML = "<Faktura><Fa><P_2>FV 7/2026</P_2></Fa></Faktura>";

  async function uploadBody(overrides: Partial<{ invoice: unknown; sourceXml: string; uploadToken: string }> = {}) {
    const invoice = overrides.invoice ?? buildDemoInvoice("de");
    const sourceXml = overrides.sourceXml ?? UPLOAD_XML;
    const uploadToken =
      overrides.uploadToken ?? signUploadToken({ hash: await demoContentHash(invoice, sourceXml), lang: "de" });
    return { downloadToken: signDownloadToken({ lang: "de", source: "upload" }), invoice, sourceXml, uploadToken };
  }

  it("renders the exact uploaded invoice for a valid token pair", async () => {
    const res = await POST(post(await uploadBody()));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const arg = renderOfficialFa3Pdf.mock.calls[0][0];
    expect(arg.sourceXml).toBe(UPLOAD_XML);
    expect(arg.language).toBe("de");
    expect(arg.translated).toBe(true);
    expect(arg.bilingual).toBe(false);
    expect(arg.invoice.items[1].translatedName).toBe("Eichenstuhl „Helena”");
  });

  it("rejects a hash mismatch (tampered invoice) with 401", async () => {
    const body = await uploadBody();
    const tampered = JSON.parse(JSON.stringify(body.invoice)) as { items: { name: string }[] };
    tampered.items[0].name = "EVIL CONTENT";
    const res = await POST(post({ ...body, invoice: tampered }));
    expect(res.status).toBe(401);
    expect(renderOfficialFa3Pdf).not.toHaveBeenCalled();
  });

  it("rejects a missing upload payload with 400", async () => {
    const res = await POST(post({ downloadToken: signDownloadToken({ lang: "de", source: "upload" }) }));
    expect(res.status).toBe(400);
  });

  it("rejects an expired uploadToken with 401", async () => {
    const invoice = buildDemoInvoice("de");
    const stale = signUploadToken(
      { hash: await demoContentHash(invoice, UPLOAD_XML), lang: "de" },
      Date.now() - 2 * 60 * 60_000
    );
    const res = await POST(post(await uploadBody({ uploadToken: stale })));
    expect(res.status).toBe(401);
  });

  it("rejects hash-matching but schema-invalid invoice JSON with 400", async () => {
    const junk = { totally: "not-an-invoice" };
    const res = await POST(post(await uploadBody({ invoice: junk })));
    expect(res.status).toBe(400);
    expect(renderOfficialFa3Pdf).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-IP pdf cap is hit (sample and upload alike)", async () => {
    consumePdf.mockResolvedValueOnce({ allowed: false, count: 99 });
    const res = await POST(post({ downloadToken: signDownloadToken({ lang: "de", source: "sample" }) }));
    expect(res.status).toBe(429);
    expect(renderOfficialFa3Pdf).not.toHaveBeenCalled();
  });
});
