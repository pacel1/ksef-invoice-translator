import { describe, it, expect, vi, beforeEach } from "vitest";

const { renderOfficialFa3Pdf } = vi.hoisted(() => ({ renderOfficialFa3Pdf: vi.fn() }));
vi.mock("@/lib/mf-fa3/official-renderer", () => ({ renderOfficialFa3Pdf }));

import { POST } from "@/app/api/demo/pdf/route";
import { signDownloadToken } from "@/lib/demo/download-token";

function post(body: unknown) {
  return new Request("http://x/api/demo/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  renderOfficialFa3Pdf.mockReset().mockResolvedValue(Buffer.from("%PDF-1.7 demo"));
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
