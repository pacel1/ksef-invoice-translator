import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { uploadInvoiceForUser } from "@/lib/invoice/upload-service";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

async function newUser(label: string) {
  const email = `upload-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  return data.user!.id;
}

describe("uploadInvoiceForUser (PDF)", () => {
  it("parses a PDF upload and persists it", async () => {
    const userId = await newUser("pdf-new");
    // For deterministic testing we re-render the sample XML through pdfmake and ingest it.
    // The sample-data folder is XML-only so we synthesise a minimal PDF via the existing renderer.
    const { renderInvoicePdfMake } = await import("@/lib/pdf/invoice-pdfmake");
    const { parseKsefXml } = await import("@/lib/xml/parser");
    const xml = readFileSync(samplePath, "utf8");
    const parsed = parseKsefXml(xml);
    if (!parsed.ok) throw new Error("sample XML failed to parse");
    const pdfBytes = await renderInvoicePdfMake(parsed.invoice, "en", false);
    const file = new File([Buffer.from(pdfBytes)], "sample.pdf", { type: "application/pdf" });

    const result = await uploadInvoiceForUser({ userId, file, supabase: admin });

    expect(result.isNew).toBe(true);
    expect(result.invoice.invoiceNumber).toBeTruthy();

    const { data: row } = await admin
      .from("invoices")
      .select("source_type")
      .eq("id", result.invoiceId)
      .single();
    expect(row?.source_type).toBe("pdf");

    await admin.auth.admin.deleteUser(userId);
  });
});

describe("uploadInvoiceForUser (XML)", () => {
  it("parses a fresh XML upload and persists an invoices row", async () => {
    const userId = await newUser("xml-new");
    const bytes = readFileSync(samplePath);
    const file = new File([bytes], "sample.xml", { type: "application/xml" });

    const result = await uploadInvoiceForUser({ userId, file, supabase: admin });

    expect(result.isNew).toBe(true);
    expect(result.invoiceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.invoice.invoiceNumber).toBeTruthy();
    expect(result.warnings).toEqual(expect.any(Array));

    const { data: row } = await admin
      .from("invoices")
      .select("source_type, source_hash, source_size, invoice_number")
      .eq("id", result.invoiceId)
      .single();
    expect(row?.source_type).toBe("xml");
    expect(row?.source_hash).toHaveLength(64);
    expect(row?.source_size).toBe(bytes.length);
    expect(row?.invoice_number).toBe(result.invoice.invoiceNumber);

    await admin.auth.admin.deleteUser(userId);
  });

  it("returns the existing row when the same bytes are re-uploaded by the same user", async () => {
    const userId = await newUser("xml-dupe");
    const bytes = readFileSync(samplePath);
    const file1 = new File([bytes], "sample.xml", { type: "application/xml" });
    const file2 = new File([bytes], "sample-renamed.xml", { type: "application/xml" });

    const first = await uploadInvoiceForUser({ userId, file: file1, supabase: admin });
    const second = await uploadInvoiceForUser({ userId, file: file2, supabase: admin });

    expect(second.invoiceId).toBe(first.invoiceId);
    expect(second.isNew).toBe(false);
    expect(second.invoice.invoiceNumber).toBe(first.invoice.invoiceNumber);

    const { count } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(count).toBe(1);

    await admin.auth.admin.deleteUser(userId);
  });
});
