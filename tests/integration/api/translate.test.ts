import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

beforeAll(async () => {
  const ping = await fetch(`${APP}/`).catch(() => null);
  if (!ping) {
    throw new Error(`Next dev server not reachable at ${APP}. Start with tmux + 'npm run dev'.`);
  }
});

describe("POST /api/translate", () => {
  it("translates an inline invoice payload anonymously (legacy mode)", async () => {
    const xml = readFileSync(samplePath, "utf8");
    const { parseKsefXml } = await import("@/lib/xml/parser");
    const parsed = parseKsefXml(xml);
    if (!parsed.ok) throw new Error("sample XML failed to parse");

    const res = await fetch(`${APP}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice: parsed.invoice, language: "en", bilingual: true })
    });

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.invoice).toBeTruthy();
    expect(payload.invoice.invoiceNumber).toBe(parsed.invoice.invoiceNumber);
    expect(payload.cached).toBe(false);
  });

  it("rejects payload missing both invoiceId and invoice", async () => {
    const res = await fetch(`${APP}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "en", bilingual: true })
    });

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toMatch(/invoiceId|invoice/);
  });

  it("requires auth on the cached-mode path (401 when no session cookie)", async () => {
    const res = await fetch(`${APP}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: "00000000-0000-0000-0000-000000000000",
        language: "en",
        bilingual: true
      })
    });

    expect(res.status).toBe(401);
  });
});
