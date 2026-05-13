import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { uploadInvoiceForUser } from "@/lib/invoice/upload-service";
import { getOrCreateTranslation } from "@/lib/translation/translation-cache";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

const createdUserIds: string[] = [];

async function userWithInvoice(label: string) {
  const email = `cache-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  const userId = data.user!.id;
  createdUserIds.push(userId);
  const bytes = readFileSync(samplePath);
  const file = new File([bytes], "sample.xml", { type: "application/xml" });
  const upload = await uploadInvoiceForUser({ userId, file, supabase: admin });
  return { userId, invoiceId: upload.invoiceId, invoice: upload.invoice };
}

afterEach(async () => {
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()!;
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe("getOrCreateTranslation", () => {
  it("inserts a row on cache miss and reads it back on hit", async () => {
    const { invoiceId, invoice } = await userWithInvoice("hit");

    const first = await getOrCreateTranslation({
      supabase: admin,
      invoice,
      invoiceId,
      language: "en",
      bilingual: true
    });
    expect(first.cached).toBe(false);
    expect(first.invoice.invoiceNumber).toBe(invoice.invoiceNumber);

    const { count } = await admin
      .from("translations")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoiceId);
    expect(count).toBe(1);

    const second = await getOrCreateTranslation({
      supabase: admin,
      invoice,
      invoiceId,
      language: "en",
      bilingual: true
    });
    expect(second.cached).toBe(true);
    expect(second.invoice.invoiceNumber).toBe(invoice.invoiceNumber);
  });

  it("treats (language, bilingual) as distinct cache keys", async () => {
    const { invoiceId, invoice } = await userWithInvoice("keys");

    await getOrCreateTranslation({ supabase: admin, invoice, invoiceId, language: "en", bilingual: true });
    await getOrCreateTranslation({ supabase: admin, invoice, invoiceId, language: "en", bilingual: false });
    await getOrCreateTranslation({ supabase: admin, invoice, invoiceId, language: "de", bilingual: true });

    const { count } = await admin
      .from("translations")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoiceId);
    expect(count).toBe(3);
  });
});
