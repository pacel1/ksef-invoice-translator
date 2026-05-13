import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { uploadInvoiceForUser, UploadError } from "@/lib/invoice/upload-service";
import { sha256Hex } from "@/lib/invoice/source-hash";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

const createdUserIds: string[] = [];

async function newUser(label: string) {
  const email = `upload-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  const id = data.user!.id;
  createdUserIds.push(id);
  return id;
}

afterEach(async () => {
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()!;
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe("uploadInvoiceForUser (PDF)", () => {
  // The repo does not ship a real KSeF PDF fixture (sample-data is XML-only) and
  // the pdfmake-rendered output does not round-trip through parseKsefPdf, so the
  // happy path is verified end-to-end in the E2E suite once a real fixture lands.
  // Here we cover the dispatch + error path and the dedupe short-circuit.

  it("routes a .pdf upload to the PDF parser and surfaces a 422 on unparseable bytes", async () => {
    const userId = await newUser("pdf-bad");
    // A few bytes of pure junk — definitely not a valid KSeF PDF.
    const bytes = Buffer.from("%PDF-1.4 not a real pdf");
    const file = new File([bytes], "garbage.pdf", { type: "application/pdf" });

    let thrown: unknown;
    try {
      await uploadInvoiceForUser({ userId, file, supabase: admin });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(UploadError);
    expect((thrown as UploadError).status).toBe(422);

    // No row was persisted because parsing failed.
    const { count } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(count).toBe(0);
  });

  it("dedupes PDF uploads via source_hash before parsing", async () => {
    const userId = await newUser("pdf-dedupe");
    const bytes = Buffer.from("%PDF-1.4 placeholder");
    const hash = await sha256Hex(bytes);

    // Seed an invoices row as if a prior PDF upload had succeeded.
    const seeded = await admin
      .from("invoices")
      .insert({
        user_id: userId,
        source_type: "pdf",
        source_hash: hash,
        source_size: bytes.length,
        source_data: { invoiceNumber: "FX-SEEDED" } as unknown as Record<string, unknown>,
        warnings: []
      })
      .select("id")
      .single();
    expect(seeded.error).toBeNull();

    // Re-upload the same bytes — the dedupe lookup short-circuits before parseKsefPdf runs.
    const file = new File([bytes], "again.pdf", { type: "application/pdf" });
    const result = await uploadInvoiceForUser({ userId, file, supabase: admin });

    expect(result.isNew).toBe(false);
    expect(result.invoiceId).toBe(seeded.data!.id);
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
  });
});
