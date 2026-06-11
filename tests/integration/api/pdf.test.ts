import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

beforeAll(async () => {
  const ping = await fetch(`${APP}/`).catch(() => null);
  if (!ping) {
    throw new Error(`Next dev server not reachable at ${APP}.`);
  }
});

describe("POST /api/pdf", () => {
  // The inline render path (raw { invoice }) now requires a session: it has no
  // production caller (the wizard renders via { invoiceId }) and rendering an
  // arbitrary invoice anonymously was a free CPU/KSeF-fetch abuse surface.
  // Actual PDF rendering is covered by the demo-pdf integration tests.
  it("requires auth on the inline render path (401 when no session)", async () => {
    const xml = readFileSync(samplePath, "utf8");
    const { parseKsefXml } = await import("@/lib/xml/parser");
    const parsed = parseKsefXml(xml);
    if (!parsed.ok) throw new Error("sample XML failed to parse");

    const res = await fetch(`${APP}/api/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice: parsed.invoice, language: "en", bilingual: true })
    });

    expect(res.status).toBe(401);
  });

  it("rejects payload missing both invoiceId and invoice", async () => {
    const res = await fetch(`${APP}/api/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "en", bilingual: true })
    });
    expect(res.status).toBe(400);
  });

  it("requires auth on the cached-mode path (401 when no session)", async () => {
    const res = await fetch(`${APP}/api/pdf`, {
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
