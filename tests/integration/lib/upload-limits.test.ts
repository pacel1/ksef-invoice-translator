import { describe, it, expect, afterEach } from "vitest";
import { uploadInvoiceForUser, UploadError } from "@/lib/invoice/upload-service";

// A Supabase stand-in that fails loudly if touched: the size check must reject
// before any DB access (and before buffering the file into memory).
const throwingSupabase = {
  from() {
    throw new Error("DB must not be touched when the file is too large");
  }
} as never;

async function expectStatus(file: File): Promise<number | undefined> {
  try {
    await uploadInvoiceForUser({ userId: "u", file, supabase: throwingSupabase });
  } catch (error) {
    if (error instanceof UploadError) return error.status;
    throw error;
  }
  return undefined;
}

afterEach(() => {
  delete process.env.MAX_UPLOAD_XML_BYTES;
  delete process.env.MAX_UPLOAD_PDF_BYTES;
});

describe("upload size limits", () => {
  it("rejects an oversized XML file with 413 before any DB access", async () => {
    process.env.MAX_UPLOAD_XML_BYTES = "10";
    const file = new File([Buffer.from("<xml>well over the tiny cap</xml>")], "big.xml", {
      type: "application/xml"
    });
    expect(await expectStatus(file)).toBe(413);
  });

  it("rejects an oversized PDF file with 413 before any DB access", async () => {
    process.env.MAX_UPLOAD_PDF_BYTES = "10";
    const file = new File([Buffer.from("%PDF-1.4 larger than ten bytes")], "big.pdf", {
      type: "application/pdf"
    });
    expect(await expectStatus(file)).toBe(413);
  });
});
