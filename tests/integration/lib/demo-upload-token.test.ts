import { describe, it, expect, beforeEach } from "vitest";
import { signUploadToken, verifyUploadToken, demoContentHash } from "@/lib/demo/upload-token";
import { signDownloadToken } from "@/lib/demo/download-token";

beforeEach(() => {
  process.env.DEMO_TOKEN_SECRET = "unit-secret";
});

const NOW = 1_750_000_000_000;

describe("upload token", () => {
  it("round-trips a valid token within its 60-minute TTL", () => {
    const token = signUploadToken({ hash: "a".repeat(64), lang: "de" }, NOW);
    const result = verifyUploadToken(token, NOW + 59 * 60_000);
    expect(result.valid).toBe(true);
    expect(result.payload).toEqual({ hash: "a".repeat(64), lang: "de" });
  });

  it("rejects an expired token (61 minutes)", () => {
    const token = signUploadToken({ hash: "a".repeat(64), lang: "en" }, NOW);
    expect(verifyUploadToken(token, NOW + 61 * 60_000).valid).toBe(false);
  });

  it("rejects a tampered token and garbage", () => {
    const token = signUploadToken({ hash: "a".repeat(64), lang: "en" }, NOW);
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifyUploadToken(tampered, NOW + 1000).valid).toBe(false);
    expect(verifyUploadToken("not-a-token", NOW).valid).toBe(false);
    expect(verifyUploadToken("", NOW).valid).toBe(false);
  });

  it("rejects a payload missing the hash", () => {
    // A download token has the same signature scheme but no hash field.
    const downloadToken = signDownloadToken({ lang: "en", source: "upload" }, NOW);
    expect(verifyUploadToken(downloadToken, NOW + 1000).valid).toBe(false);
  });
});

describe("demoContentHash", () => {
  it("is deterministic and sensitive to both invoice and xml", async () => {
    const invoice = { invoiceNumber: "FV 1", items: [{ name: "Stół" }] };
    const a = await demoContentHash(invoice, "<Faktura/>");
    const b = await demoContentHash(invoice, "<Faktura/>");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await demoContentHash({ ...invoice, invoiceNumber: "FV 2" }, "<Faktura/>")).not.toBe(a);
    expect(await demoContentHash(invoice, "<Faktura>x</Faktura>")).not.toBe(a);
  });

  it("survives a JSON wire round-trip unchanged", async () => {
    const invoice = { invoiceNumber: "FV 1", seller: { name: "Meble Dębowe" }, items: [{ name: "Stół", quantity: 1 }] };
    const roundTripped = JSON.parse(JSON.stringify(invoice));
    expect(await demoContentHash(roundTripped, "<x/>")).toBe(await demoContentHash(invoice, "<x/>"));
  });
});
