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
});
