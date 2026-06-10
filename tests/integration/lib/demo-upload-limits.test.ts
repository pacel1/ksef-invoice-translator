import { describe, it, expect, beforeEach } from "vitest";
import {
  detectDemoUploadType,
  maxXmlBytes,
  maxPdfBytes,
  maxBytesFor,
  DEMO_UPLOAD_ACCEPT
} from "@/lib/demo/upload-limits";

beforeEach(() => {
  delete process.env.DEMO_MAX_XML_BYTES;
  delete process.env.DEMO_MAX_PDF_BYTES;
});

describe("demo upload limits", () => {
  it("detects xml by mime or extension", () => {
    expect(detectDemoUploadType("faktura.xml", "application/xml")).toBe("xml");
    expect(detectDemoUploadType("faktura.xml", "")).toBe("xml");
    expect(detectDemoUploadType("FAKTURA.XML", "text/xml")).toBe("xml");
  });

  it("detects pdf by mime or extension", () => {
    expect(detectDemoUploadType("faktura.pdf", "application/pdf")).toBe("pdf");
    expect(detectDemoUploadType("Faktura.PDF", "")).toBe("pdf");
  });

  it("returns null for anything else", () => {
    expect(detectDemoUploadType("notes.txt", "text/plain")).toBeNull();
    expect(detectDemoUploadType("invoice.docx", "")).toBeNull();
  });

  it("defaults to 1 MB xml and 8 MB pdf", () => {
    expect(maxXmlBytes()).toBe(1024 * 1024);
    expect(maxPdfBytes()).toBe(8 * 1024 * 1024);
    expect(maxBytesFor("xml")).toBe(maxXmlBytes());
    expect(maxBytesFor("pdf")).toBe(maxPdfBytes());
  });

  it("honours env overrides (server side)", () => {
    process.env.DEMO_MAX_XML_BYTES = "2048";
    process.env.DEMO_MAX_PDF_BYTES = "4096";
    expect(maxXmlBytes()).toBe(2048);
    expect(maxPdfBytes()).toBe(4096);
  });

  it("exposes an accept string covering both types", () => {
    expect(DEMO_UPLOAD_ACCEPT).toContain(".xml");
    expect(DEMO_UPLOAD_ACCEPT).toContain(".pdf");
    expect(DEMO_UPLOAD_ACCEPT).toContain("application/pdf");
  });
});
