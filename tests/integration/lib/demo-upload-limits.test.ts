import { describe, it, expect, beforeEach } from "vitest";
import { isDemoXmlUpload, maxXmlBytes, DEMO_UPLOAD_ACCEPT } from "@/lib/demo/upload-limits";

beforeEach(() => {
  delete process.env.DEMO_MAX_XML_BYTES;
});

describe("demo upload limits (xml only)", () => {
  it("accepts xml by mime or extension", () => {
    expect(isDemoXmlUpload("faktura.xml", "application/xml")).toBe(true);
    expect(isDemoXmlUpload("faktura.xml", "")).toBe(true);
    expect(isDemoXmlUpload("FAKTURA.XML", "text/xml")).toBe(true);
  });

  it("rejects pdf and everything else", () => {
    expect(isDemoXmlUpload("faktura.pdf", "application/pdf")).toBe(false);
    expect(isDemoXmlUpload("Faktura.PDF", "")).toBe(false);
    expect(isDemoXmlUpload("notes.txt", "text/plain")).toBe(false);
    expect(isDemoXmlUpload("invoice.docx", "")).toBe(false);
  });

  it("defaults to 1 MB and honours the server-side env override", () => {
    expect(maxXmlBytes()).toBe(1024 * 1024);
    process.env.DEMO_MAX_XML_BYTES = "2048";
    expect(maxXmlBytes()).toBe(2048);
  });

  it("exposes an accept string covering xml only", () => {
    expect(DEMO_UPLOAD_ACCEPT).toContain(".xml");
    expect(DEMO_UPLOAD_ACCEPT).toContain("application/xml");
    expect(DEMO_UPLOAD_ACCEPT).not.toContain("pdf");
  });
});
