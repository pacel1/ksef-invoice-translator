import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { verifyTurnstile, consumeTranslate, translateInvoiceFreeText } = vi.hoisted(() => ({
  verifyTurnstile: vi.fn(),
  consumeTranslate: vi.fn(),
  translateInvoiceFreeText: vi.fn()
}));
vi.mock("@/lib/demo/turnstile", () => ({ verifyTurnstile }));
vi.mock("@/lib/demo/rate-limit", () => ({ consumeTranslate, clientIpFrom: () => "1.2.3.4" }));
vi.mock("@/lib/translation/engine", () => ({ translateInvoiceFreeText }));

import { POST } from "@/app/api/demo/translate/route";
import { verifyUploadToken, demoContentHash } from "@/lib/demo/upload-token";
import { maxXmlBytes } from "@/lib/demo/upload-limits";

const SAMPLE_XML = readFileSync(join(process.cwd(), "public/sample-data/demo-fa3-export.xml"), "utf8");

function post(fields: { file?: File; lang?: string; turnstileToken?: string }) {
  const form = new FormData();
  if (fields.file) form.set("file", fields.file);
  if (fields.lang) form.set("lang", fields.lang);
  if (fields.turnstileToken) form.set("turnstileToken", fields.turnstileToken);
  return new Request("http://x/api/demo/translate", { method: "POST", body: form });
}

function xmlFile(content: string = SAMPLE_XML, name = "faktura.xml") {
  return new File([content], name, { type: "application/xml" });
}

beforeEach(() => {
  verifyTurnstile.mockReset().mockResolvedValue({ ok: true });
  consumeTranslate.mockReset().mockResolvedValue({ allowed: true, ipCount: 1, globalCount: 1 });
  translateInvoiceFreeText
    .mockReset()
    .mockImplementation(async (invoice: object, language: string) => ({ ...invoice, language }));
  process.env.DEMO_TOKEN_SECRET = "unit-secret";
});

describe("POST /api/demo/translate", () => {
  it("translates a valid XML upload and returns invoice + sourceXml + a binding uploadToken", async () => {
    const res = await POST(post({ file: xmlFile(), lang: "de", turnstileToken: "t" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.invoice.language).toBe("de");
    expect(json.sourceXml).toBe(SAMPLE_XML);
    expect(translateInvoiceFreeText).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceNumber: "FV 2026/05/0142" }),
      "de"
    );
    const verdict = verifyUploadToken(json.uploadToken);
    expect(verdict.valid).toBe(true);
    expect(verdict.payload?.lang).toBe("de");
    expect(verdict.payload?.hash).toBe(await demoContentHash(json.invoice, json.sourceXml));
  });

  it("builds the KSeF QR verification link for XML uploads (same fidelity as the app upload path)", async () => {
    const res = await POST(post({ file: xmlFile(), lang: "en", turnstileToken: "t" }));
    const json = await res.json();
    expect(json.invoice.verification?.qrLink).toContain("https://qr.ksef.mf.gov.pl/invoice/");
  });

  it("returns 403 when Turnstile fails (and never consumes the cap)", async () => {
    verifyTurnstile.mockResolvedValueOnce({ ok: false });
    const res = await POST(post({ file: xmlFile(), lang: "en", turnstileToken: "bad" }));
    expect(res.status).toBe(403);
    expect(consumeTranslate).not.toHaveBeenCalled();
  });

  it("returns 429 with code rate_limited past the per-IP cap", async () => {
    consumeTranslate.mockResolvedValueOnce({ allowed: false, reason: "ip", ipCount: 6, globalCount: 10 });
    const res = await POST(post({ file: xmlFile(), lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("rate_limited");
  });

  it("returns 503 with code circuit_breaker past the global cap", async () => {
    consumeTranslate.mockResolvedValueOnce({ allowed: false, reason: "global", ipCount: 1, globalCount: 501 });
    const res = await POST(post({ file: xmlFile(), lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("circuit_breaker");
  });

  it("returns 415 for any non-XML file, including PDFs (after the cap is consumed, per the locked spec order)", async () => {
    const pdf = new File(["%PDF-1.7"], "faktura.pdf", { type: "application/pdf" });
    expect((await POST(post({ file: pdf, lang: "en", turnstileToken: "t" }))).status).toBe(415);
    const txt = new File(["x"], "notes.txt", { type: "text/plain" });
    expect((await POST(post({ file: txt, lang: "en", turnstileToken: "t" }))).status).toBe(415);
    expect(consumeTranslate).toHaveBeenCalled();
    expect(translateInvoiceFreeText).not.toHaveBeenCalled();
  });

  it("returns 413 for an oversized XML", async () => {
    const big = "a".repeat(maxXmlBytes() + 1);
    const res = await POST(post({ file: xmlFile(big), lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(413);
    expect(translateInvoiceFreeText).not.toHaveBeenCalled();
  });

  it("returns 422 for XML that does not parse as FA(3)", async () => {
    const res = await POST(post({ file: xmlFile("<not-an-invoice>"), lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(422);
    expect(translateInvoiceFreeText).not.toHaveBeenCalled();
  });

  it("returns 502 when the translation engine fails", async () => {
    translateInvoiceFreeText.mockRejectedValueOnce(new Error("openai down"));
    const res = await POST(post({ file: xmlFile(), lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(502);
  });

  it("returns 400 for a missing file or unsupported language", async () => {
    expect((await POST(post({ lang: "en", turnstileToken: "t" }))).status).toBe(400);
    expect((await POST(post({ file: xmlFile(), lang: "xx", turnstileToken: "t" }))).status).toBe(400);
  });

  it("rejects an oversized body via Content-Length before reading the form", async () => {
    const formData = vi.fn();
    const request = {
      headers: new Headers({ "content-length": String(100 * 1024 * 1024) }),
      formData
    } as unknown as Request;
    const res = await POST(request);
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("too_large");
    expect(formData).not.toHaveBeenCalled();
  });
});
